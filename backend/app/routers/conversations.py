import json
from datetime import datetime
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Conversation, Transcription
from ..schemas import (
    ConversationCreate,
    ConversationList,
    ConversationResponse,
    ConversationTranscript,
    ConversationUpdate,
    UploadResponse,
)
from ..services.file_manager import file_manager
from .transcriptions import process_transcription

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    conversation_data: ConversationCreate, db: Session = Depends(get_db)
):
    """Create a new conversation for chunked recording."""
    # Generate default title if not provided
    default_title = (
        conversation_data.title
        or f"Conversation {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    )

    conversation = Conversation(
        title=default_title,
        description=conversation_data.description,
        language=conversation_data.language,
        trim_silence=conversation_data.trim_silence,
        chunk_interval_sec=conversation_data.chunk_interval_sec,
        num_speakers=conversation_data.num_speakers,
        status="recording",
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation


@router.post("/{conversation_id}/chunks", response_model=UploadResponse)
async def add_chunk(
    conversation_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    chunk_index: int = Form(...),
    db: Session = Depends(get_db),
):
    """Add a new audio chunk to a conversation."""
    conversation = (
        db.query(Conversation).filter(Conversation.id == conversation_id).first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Validate file
    if not file_manager.is_valid_audio_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Supported: {', '.join(file_manager.get_supported_extensions())}",
        )

    # Read file content
    content = await file.read()

    # Save audio file
    unique_name, audio_path = file_manager.save_audio_file(content, file.filename)

    # Create transcription record linked to conversation
    transcription = Transcription(
        conversation_id=conversation_id,
        chunk_index=chunk_index,
        title=f"Chunk {chunk_index + 1}",
        filename=file.filename,
        audio_path=audio_path,
        language=conversation.language,
        trim_silence=conversation.trim_silence,
        status="pending",
    )
    db.add(transcription)
    db.commit()
    db.refresh(transcription)

    # Start background transcription with diarization if enabled
    from ..config import settings

    background_tasks.add_task(
        process_transcription,
        transcription.id,
        settings.database_url,
        num_speakers=conversation.num_speakers,
    )

    return UploadResponse(
        id=transcription.id,
        message=f"Chunk {chunk_index + 1} uploaded. Transcription started.",
        status="pending",
        conversation_id=conversation_id,
    )


@router.post("/{conversation_id}/complete", response_model=ConversationResponse)
async def complete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """Mark a conversation as complete (recording finished)."""
    conversation = (
        db.query(Conversation).filter(Conversation.id == conversation_id).first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Calculate total duration
    total_duration = sum(chunk.duration_sec or 0 for chunk in conversation.chunks)

    # Determine status based on chunks
    chunk_statuses = [chunk.status for chunk in conversation.chunks]
    if all(s == "completed" for s in chunk_statuses):
        conversation.status = "completed"
        conversation.completed_at = datetime.utcnow()
    elif any(s == "failed" for s in chunk_statuses):
        conversation.status = "failed"
    elif any(s in ["pending", "processing"] for s in chunk_statuses):
        conversation.status = "processing"
    else:
        conversation.status = "completed"
        conversation.completed_at = datetime.utcnow()

    conversation.total_duration_sec = total_duration
    db.commit()
    db.refresh(conversation)

    return conversation


@router.post("/{conversation_id}/refresh-status", response_model=ConversationResponse)
async def refresh_conversation_status(
    conversation_id: int, db: Session = Depends(get_db)
):
    """Refresh a conversation's status based on its chunks (useful after retrying chunks)."""
    conversation = (
        db.query(Conversation).filter(Conversation.id == conversation_id).first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.status == "recording":
        # Don't update status while still recording
        return conversation

    # Calculate total duration
    total_duration = sum(chunk.duration_sec or 0 for chunk in conversation.chunks)

    # Determine status based on chunks
    chunk_statuses = [chunk.status for chunk in conversation.chunks]
    if len(chunk_statuses) == 0:
        pass  # Keep current status
    elif all(s == "completed" for s in chunk_statuses):
        conversation.status = "completed"
        conversation.completed_at = datetime.utcnow()
    elif any(s == "failed" for s in chunk_statuses) and not any(
        s in ["pending", "processing"] for s in chunk_statuses
    ):
        conversation.status = "failed"
    elif any(s in ["pending", "processing"] for s in chunk_statuses):
        conversation.status = "processing"

    conversation.total_duration_sec = total_duration
    db.commit()
    db.refresh(conversation)

    return conversation


@router.get("", response_model=List[ConversationList])
async def list_conversations(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all conversations."""
    query = db.query(Conversation)

    if status:
        query = query.filter(Conversation.status == status)

    conversations = (
        query.order_by(Conversation.created_at.desc()).offset(skip).limit(limit).all()
    )

    # Add chunk count to each conversation
    result = []
    for conv in conversations:
        result.append(
            ConversationList(
                id=conv.id,
                title=conv.title,
                description=conv.description,
                language=conv.language,
                status=conv.status,
                total_duration_sec=conv.total_duration_sec,
                chunk_count=len(conv.chunks),
                created_at=conv.created_at,
                updated_at=conv.updated_at,
            )
        )

    return result


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """Get a specific conversation with all its chunks."""
    conversation = (
        db.query(Conversation).filter(Conversation.id == conversation_id).first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return conversation


@router.get("/{conversation_id}/transcript", response_model=ConversationTranscript)
async def get_conversation_transcript(
    conversation_id: int, db: Session = Depends(get_db)
):
    """Get the full combined transcript for a conversation."""
    conversation = (
        db.query(Conversation).filter(Conversation.id == conversation_id).first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Combine all chunk transcripts in order
    transcripts = []
    speaker_transcripts = []
    all_speakers = set()

    for chunk in sorted(conversation.chunks, key=lambda c: c.chunk_index or 0):
        if chunk.transcript_text:
            transcripts.append(chunk.transcript_text)

        # Parse speaker segments if available
        if chunk.transcript_segments:
            try:
                segments_data = json.loads(chunk.transcript_segments)
                if segments_data.get("full_text"):
                    speaker_transcripts.append(segments_data["full_text"])
                if segments_data.get("speakers"):
                    all_speakers.update(segments_data["speakers"])
            except (json.JSONDecodeError, TypeError):
                pass

    full_transcript = " ".join(transcripts)
    full_transcript_with_speakers = (
        "\n\n".join(speaker_transcripts) if speaker_transcripts else None
    )

    return ConversationTranscript(
        id=conversation.id,
        title=conversation.title,
        full_transcript=full_transcript,
        full_transcript_with_speakers=full_transcript_with_speakers,
        total_duration_sec=conversation.total_duration_sec,
        speakers=sorted(all_speakers),
    )


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: int, update_data: ConversationUpdate, db: Session = Depends(get_db)
):
    """Update a conversation's title or description."""
    conversation = (
        db.query(Conversation).filter(Conversation.id == conversation_id).first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if update_data.title is not None:
        conversation.title = update_data.title
    if update_data.description is not None:
        conversation.description = update_data.description

    db.commit()
    db.refresh(conversation)

    return conversation


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """Delete a conversation and all its chunks."""
    conversation = (
        db.query(Conversation).filter(Conversation.id == conversation_id).first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete all chunk files
    for chunk in conversation.chunks:
        file_manager.delete_files(
            audio_path=chunk.audio_path, transcript_path=chunk.transcript_path
        )
        db.delete(chunk)

    # Delete conversation
    db.delete(conversation)
    db.commit()

    return {"message": "Conversation deleted successfully"}
