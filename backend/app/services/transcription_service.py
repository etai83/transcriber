from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import json
import traceback

from ..models import Transcription, Conversation
from .interfaces import TranscriptionProvider
from .file_manager import file_manager

class TranscriptionService:
    def __init__(self, db: Session, provider: TranscriptionProvider):
        self.db = db
        self.provider = provider

    def process_job(self, transcription_id: int, num_speakers: Optional[int] = None):
        """
        Process a transcription job.

        Args:
            transcription_id: ID of the transcription to process
            num_speakers: Number of speakers for diarization (overrides conversation setting)
        """
        # Get transcription record
        transcription = self.db.query(Transcription).filter(Transcription.id == transcription_id).first()
        if not transcription:
            print(f"Transcription {transcription_id} not found")
            return

        try:
            # Update status to processing
            transcription.status = "processing"
            self.db.commit()

            # Determine number of speakers
            effective_num_speakers = num_speakers

            # If not explicitly provided, check conversation settings
            if effective_num_speakers is None and transcription.conversation_id:
                conversation = self.db.query(Conversation).filter(
                    Conversation.id == transcription.conversation_id
                ).first()
                if conversation and conversation.num_speakers:
                    effective_num_speakers = conversation.num_speakers

            # Perform transcription
            print(f"Starting transcription for {transcription.id} ({transcription.filename})")

            # Pass diarization request via num_speakers
            result = self.provider.transcribe(
                audio_path=transcription.audio_path,
                language=transcription.language,
                trim_silence=transcription.trim_silence,
                num_speakers=effective_num_speakers
            )

            # Save transcript to file
            transcript_path = file_manager.save_transcript(transcription_id, result.text)

            # Update record
            transcription.transcript_path = transcript_path
            transcription.transcript_text = result.text
            transcription.detected_language = result.source_language
            transcription.duration_sec = result.duration
            transcription.is_hallucination = result.is_hallucination
            transcription.status = "completed"
            transcription.completed_at = datetime.utcnow()

            # Save diarization segments if available
            if result.transcript_segments:
                transcription.transcript_segments = json.dumps(
                    result.transcript_segments,
                    ensure_ascii=False
                )

            self.db.commit()
            print(f"Transcription {transcription_id} completed successfully")

        except Exception as e:
            print(f"Transcription error: {e}")
            traceback.print_exc()

            transcription.status = "failed"
            transcription.error_message = str(e)
            self.db.commit()
