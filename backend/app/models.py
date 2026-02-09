from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class Conversation(Base):
    """Database model for conversations (groups of transcription chunks)."""

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=True)  # User-editable title
    description = Column(Text, nullable=True)  # User-editable description
    language = Column(String(10), default="auto")  # Source language hint
    trim_silence = Column(Boolean, default=False)  # Whether to trim silence
    chunk_interval_sec = Column(
        Integer, default=60
    )  # Interval between chunks in seconds
    num_speakers = Column(
        Integer, default=2
    )  # Expected number of speakers for diarization
    status = Column(
        String(20), default="recording"
    )  # recording, processing, completed, failed
    total_duration_sec = Column(Float, nullable=True)  # Total duration of all chunks
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime, nullable=True)

    # Relationship to transcription chunks
    chunks = relationship(
        "Transcription",
        back_populates="conversation",
        order_by="Transcription.chunk_index",
    )

    def __repr__(self):
        return f"<Conversation(id={self.id}, title='{self.title}', status='{self.status}')>"


class Transcription(Base):
    """Database model for transcription records."""

    __tablename__ = "transcriptions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    conversation_id = Column(
        Integer, ForeignKey("conversations.id"), nullable=True
    )  # Optional link to conversation
    chunk_index = Column(
        Integer, nullable=True
    )  # Order within conversation (0, 1, 2, ...)
    title = Column(String(255), nullable=True)  # User-editable title
    description = Column(Text, nullable=True)  # User-editable description
    filename = Column(String(255), nullable=False)  # Original filename
    audio_path = Column(String(500), nullable=False)  # Local path to audio file
    transcript_path = Column(
        String(500), nullable=True
    )  # Local path to transcript .txt
    language = Column(String(10), default="auto")  # 'en', 'he', or 'auto'
    detected_language = Column(
        String(10), nullable=True
    )  # Detected language after processing
    trim_silence = Column(
        Boolean, default=False
    )  # Whether to trim silence before transcribing
    status = Column(
        String(20), default="pending"
    )  # pending, processing, completed, failed
    duration_sec = Column(Float, nullable=True)  # Audio duration in seconds
    transcript_text = Column(
        Text, nullable=True
    )  # Full transcript text (also stored in file)
    transcript_segments = Column(
        Text, nullable=True
    )  # JSON: segments with speaker labels
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)  # Error details if failed
    is_hallucination = Column(
        Boolean, default=False
    )  # Flag if text is likely hallucination

    # Relationship to conversation
    conversation = relationship("Conversation", back_populates="chunks")

    def __repr__(self):
        return f"<Transcription(id={self.id}, title='{self.title}', status='{self.status}')>"
