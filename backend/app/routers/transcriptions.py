import asyncio
import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ..database import get_db
from ..models import Transcription, Conversation
from ..services.ai_assistant import ai_assistant_service
from ..schemas import (
    TranscriptionResponse,
    TranscriptionList,
    TranscriptionStatus,
    TranscriptionUpdate,
    UploadResponse
)
from ..services.file_manager import file_manager
from ..services.transcriber import transcriber_service
from ..config import settings
import traceback
import os

router = APIRouter(prefix="/api", tags=["transcriptions"])


async def generate_conversation_metadata_task(conversation_id: int, force_update: bool = False):
    """Background task to generate conversation title and description."""
    engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            return
        
        # Get all completed chunks with transcripts
        completed_chunks = [
            chunk for chunk in conversation.chunks
            if chunk.status == "completed" and chunk.transcript_text
        ]
        
        if not completed_chunks:
            return
            
        # Combine all transcripts
        full_transcript = " ".join([
            chunk.transcript_text 
            for chunk in sorted(completed_chunks, key=lambda c: c.chunk_index or 0)
        ])
        
        # Detect language from chunks
        languages = [chunk.detected_language for chunk in completed_chunks if chunk.detected_language]
        detected_language = max(set(languages), key=languages.count) if languages else conversation.language
        
        # Generate metadata using AI
        if not ai_assistant_service.is_enabled():
            return

        result = await ai_assistant_service.generate_conversation_metadata(
            full_transcript,
            language=detected_language
        )
        
        # Update conversation if we got valid results
        if result.get("title") and not result.get("error"):
            # Update title if it's default/system generated OR forced
            current_title = conversation.title
            is_default_title = (
                not current_title or 
                current_title.startswith("Conversation 20") or
                current_title.startswith("Chunk ")
            )
            
            if is_default_title or force_update:
                conversation.title = result["title"]
        
        if result.get("description") and not result.get("error"):
             # For description, always update if we have a result (or maybe check existing?) 
             # Existing logic was just update. I'll stick to it.
            conversation.description = result["description"]
        
        db.commit()
        
    except Exception as e:
        print(f"Error generating conversation metadata: {e}")
    finally:
        db.close()


def process_transcription(transcription_id: int, db_url: str, num_speakers: Optional[int] = None):
    """Background task to process transcription with optional diarization.
    
    Args:
        transcription_id: ID of the transcription to process
        db_url: Database connection URL
        num_speakers: Number of speakers for diarization (overrides conversation setting)
    """

    
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Get transcription record
        transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
        if not transcription:
            return
        
        # Update status to processing
        transcription.status = "processing"
        db.commit()
        
        # Determine number of speakers for diarization
        # Priority: 1) explicit num_speakers param, 2) conversation setting
        effective_num_speakers = num_speakers
        if effective_num_speakers is None and transcription.conversation_id and settings.enable_diarization:
            conversation = db.query(Conversation).filter(
                Conversation.id == transcription.conversation_id
            ).first()
            if conversation and conversation.num_speakers:
                effective_num_speakers = conversation.num_speakers
        
        # Perform transcription (with diarization if num_speakers is set AND diarization is enabled)
        if effective_num_speakers and settings.enable_diarization:
            print(f"Transcribing with diarization ({effective_num_speakers} speakers)...")
            result = transcriber_service.transcribe_with_diarization(
                transcription.audio_path,
                transcription.language,
                trim_silence=transcription.trim_silence,
                num_speakers=effective_num_speakers
            )
        else:
            if effective_num_speakers and not settings.enable_diarization:
                print("Diarization is disabled in settings. Transcribing without speaker detection.")
            result = transcriber_service.transcribe(
                transcription.audio_path,
                transcription.language,
                trim_silence=transcription.trim_silence
            )
        
        # Save transcript to file
        transcript_path = file_manager.save_transcript(transcription_id, result["text"])
        
        # Update record
        transcription.transcript_path = transcript_path
        transcription.transcript_text = result["text"]
        transcription.detected_language = result["language"]
        transcription.duration_sec = result["duration"]
        transcription.is_hallucination = result.get("is_hallucination", False)
        transcription.status = "completed"
        transcription.completed_at = datetime.utcnow()
        
        # Save diarization segments if available
        if result.get("transcript_segments"):
            transcription.transcript_segments = json.dumps(
                result["transcript_segments"], 
                ensure_ascii=False
            )
        
        db.commit()

        # Refresh conversation status if this transcription belongs to a conversation
        if transcription.conversation_id:
            _refresh_conversation_status(db, transcription.conversation_id)
        
    except Exception as e:
        # Handle errors

        print(f"Transcription error: {e}")
        traceback.print_exc()
        
        transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
        if transcription:
            transcription.status = "failed"
            transcription.error_message = str(e)
            db.commit()

            if transcription.conversation_id:
                _refresh_conversation_status(db, transcription.conversation_id)
    finally:
        db.close()


def _refresh_conversation_status(db: Session, conversation_id: int) -> None:
    """Update conversation status and total duration based on chunk statuses."""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        return

    # Always update total duration from chunks
    conversation.total_duration_sec = sum(
        chunk.duration_sec or 0
        for chunk in conversation.chunks
    )

    # Don't override status while actively recording
    if conversation.status == "recording":
        db.commit()
        return

    chunk_statuses = [chunk.status for chunk in conversation.chunks]
    if not chunk_statuses:
        db.commit()
        return

    if all(status == "completed" for status in chunk_statuses):
        conversation.status = "completed"
        conversation.completed_at = datetime.utcnow()
    elif any(status in ["pending", "processing"] for status in chunk_statuses):
        conversation.status = "processing"
    elif any(status == "failed" for status in chunk_statuses):
        conversation.status = "failed"

    db.commit()


@router.post("/upload", response_model=UploadResponse)
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form(default="auto"),
    trim_silence: bool = Form(default=False),
    num_speakers: Optional[int] = Form(default=None),
    db: Session = Depends(get_db)
):
    """
    Upload an audio file for transcription.
    
    Supported formats: mp3, wav, m4a, flac, ogg, webm, mp4
    Languages: 'en' (English), 'he' (Hebrew), 'auto' (auto-detect)
    trim_silence: If true, removes silence from audio before transcribing
    num_speakers: Number of speakers for diarization (2-10). If provided, enables speaker detection.
    """
    # Validate file extension
    if not file_manager.is_valid_audio_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Supported: {', '.join(file_manager.get_supported_extensions())}"
        )
    
    # Validate language
    valid_languages = ["auto", "en", "he"]
    if language not in valid_languages:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid language. Supported: {', '.join(valid_languages)}"
        )
    
    # Validate num_speakers if provided
    if num_speakers is not None:
        if num_speakers < 1 or num_speakers > 10:
            raise HTTPException(
                status_code=400,
                detail="num_speakers must be between 1 and 10"
            )
    
    # Read file content
    content = await file.read()
    
    # Save audio file
    unique_name, audio_path = file_manager.save_audio_file(content, file.filename)
    
    # Generate default title from filename (remove extension)

    default_title = os.path.splitext(file.filename)[0].replace('_', ' ').replace('-', ' ').title()
    
    # Create database record
    transcription = Transcription(
        title=default_title,
        filename=file.filename,
        audio_path=audio_path,
        language=language,
        trim_silence=trim_silence,
        status="pending"
    )
    db.add(transcription)
    db.commit()
    db.refresh(transcription)
    
    # Start background transcription (pass num_speakers for diarization)

    background_tasks.add_task(
        process_transcription, 
        transcription.id, 
        settings.database_url,
        num_speakers=num_speakers
    )
    
    return UploadResponse(
        id=transcription.id,
        message="File uploaded successfully. Transcription started." + (
            f" Speaker diarization enabled ({num_speakers} speakers)." if num_speakers else ""
        ),
        status="pending"
    )


@router.get("/transcriptions", response_model=List[TranscriptionList])
async def list_transcriptions(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all transcriptions with optional filtering."""
    query = db.query(Transcription)
    
    if status:
        query = query.filter(Transcription.status == status)
    
    transcriptions = query.order_by(Transcription.created_at.desc()).offset(skip).limit(limit).all()
    return transcriptions


@router.get("/transcriptions/{transcription_id}", response_model=TranscriptionResponse)
async def get_transcription(transcription_id: int, db: Session = Depends(get_db)):
    """Get a specific transcription by ID."""
    transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    return transcription


@router.patch("/transcriptions/{transcription_id}", response_model=TranscriptionResponse)
async def update_transcription(
    transcription_id: int,
    update_data: TranscriptionUpdate,
    db: Session = Depends(get_db)
):
    """Update a transcription's title, description, or transcript text."""
    transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    # Update only provided fields
    if update_data.title is not None:
        transcription.title = update_data.title
    if update_data.description is not None:
        transcription.description = update_data.description
    if update_data.transcript_text is not None:
        transcription.transcript_text = update_data.transcript_text
        # Also update the transcript file
        if transcription.transcript_path:
            file_manager.save_transcript(transcription_id, update_data.transcript_text)
    
    db.commit()
    db.refresh(transcription)
    
    return transcription


@router.get("/transcriptions/{transcription_id}/audio")
async def get_audio_file(transcription_id: int, db: Session = Depends(get_db)):
    """Stream/download the audio file."""
    transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    try:
        audio_path = file_manager.get_audio_file(transcription.audio_path)
        return FileResponse(
            audio_path,
            filename=transcription.filename,
            media_type="audio/mpeg"
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Audio file not found")


@router.get("/transcriptions/{transcription_id}/transcript")
async def get_transcript_text(transcription_id: int, db: Session = Depends(get_db)):
    """Get the transcript text."""
    transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    if transcription.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Transcription not ready. Status: {transcription.status}"
        )
    
    return {
        "id": transcription.id,
        "filename": transcription.filename,
        "text": transcription.transcript_text,
        "language": transcription.detected_language
    }


@router.get("/status/{transcription_id}", response_model=TranscriptionStatus)
async def get_status(transcription_id: int, db: Session = Depends(get_db)):
    """Check the status of a transcription job."""
    transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    return TranscriptionStatus(
        id=transcription.id,
        status=transcription.status,
        error_message=transcription.error_message
    )


@router.delete("/transcriptions/{transcription_id}")
async def delete_transcription(transcription_id: int, db: Session = Depends(get_db)):
    """Delete a transcription and its associated files."""
    transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    # Delete files
    file_manager.delete_files(
        audio_path=transcription.audio_path,
        transcript_path=transcription.transcript_path
    )
    
    # Delete database record
    db.delete(transcription)
    db.commit()
    
    return {"message": "Transcription deleted successfully"}


@router.post("/transcriptions/{transcription_id}/retry", response_model=TranscriptionStatus)
async def retry_transcription(
    transcription_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Retry a failed transcription."""
    transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    if transcription.status not in ["failed", "completed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry transcription with status: {transcription.status}"
        )
    
    # Check if audio file still exists
    if not file_manager.get_audio_file(transcription.audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # Reset status
    transcription.status = "pending"
    transcription.error_message = None
    transcription.transcript_text = None
    transcription.transcript_path = None
    transcription.completed_at = None
    db.commit()

    if transcription.conversation_id:
        _refresh_conversation_status(db, transcription.conversation_id)
    
    # Start background transcription

    background_tasks.add_task(process_transcription, transcription.id, settings.database_url)
    
    return TranscriptionStatus(
        id=transcription.id,
        status="pending",
        error_message=None
    )


@router.get("/languages")
async def get_languages():
    """Get supported languages."""
    return transcriber_service.get_supported_languages()


@router.get("/settings/diarization")
async def get_diarization_status():
    """Check if speaker diarization is enabled."""
    return {
        "enabled": settings.enable_diarization,
        "message": "Set ENABLE_DIARIZATION=true in .env to enable speaker diarization"
    }
