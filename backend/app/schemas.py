from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, List, Any, Union
import json


# Diarization segment schemas

class TranscriptSegment(BaseModel):
    """Schema for a single transcript segment with speaker label."""
    start: float
    end: float
    text: str
    speaker: str


class TranscriptSegmentsResponse(BaseModel):
    """Schema for diarized transcript segments."""
    segments: List[TranscriptSegment] = []
    speakers: List[str] = []
    full_text: str = ""


class TranscriptionBase(BaseModel):
    """Base schema for transcription data."""
    filename: str
    language: str = "auto"


class TranscriptionCreate(TranscriptionBase):
    """Schema for creating a new transcription."""
    title: Optional[str] = None
    description: Optional[str] = None


class TranscriptionUpdate(BaseModel):
    """Schema for updating a transcription."""
    title: Optional[str] = None
    description: Optional[str] = None
    transcript_text: Optional[str] = None


class TranscriptionResponse(BaseModel):
    """Schema for transcription response."""
    id: int
    conversation_id: Optional[int] = None
    chunk_index: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    filename: str
    audio_path: str
    transcript_path: Optional[str] = None
    language: str
    detected_language: Optional[str] = None
    status: str
    duration_sec: Optional[float] = None
    transcript_text: Optional[str] = None
    transcript_segments: Optional[TranscriptSegmentsResponse] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    is_hallucination: bool = False
    
    @field_validator('transcript_segments', mode='before')
    @classmethod
    def parse_transcript_segments(cls, v):
        """Parse JSON string to dict if needed."""
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return None
        return v
    
    class Config:
        from_attributes = True


class TranscriptionList(BaseModel):
    """Schema for listing transcriptions."""
    id: int
    conversation_id: Optional[int] = None
    chunk_index: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    filename: str
    language: str
    detected_language: Optional[str] = None
    status: str
    duration_sec: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    is_hallucination: bool = False
    
    class Config:
        from_attributes = True


class TranscriptionStatus(BaseModel):
    """Schema for transcription status check."""
    id: int
    status: str
    error_message: Optional[str] = None


class UploadResponse(BaseModel):
    """Schema for upload response."""
    id: int
    message: str
    status: str
    conversation_id: Optional[int] = None


# Conversation schemas

class ConversationCreate(BaseModel):
    """Schema for creating a new conversation."""
    title: Optional[str] = None
    description: Optional[str] = None
    language: str = "auto"
    trim_silence: bool = False
    chunk_interval_sec: int = 60  # Default 1 minute chunks
    num_speakers: Optional[int] = 2  # Expected number of speakers for diarization, None to disable


class ConversationUpdate(BaseModel):
    """Schema for updating a conversation."""
    title: Optional[str] = None
    description: Optional[str] = None


class ConversationChunkResponse(BaseModel):
    """Schema for a transcription chunk within a conversation."""
    id: int
    chunk_index: int
    filename: str
    status: str
    duration_sec: Optional[float] = None
    transcript_text: Optional[str] = None
    transcript_segments: Optional[TranscriptSegmentsResponse] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    is_hallucination: bool = False
    
    @field_validator('transcript_segments', mode='before')
    @classmethod
    def parse_transcript_segments(cls, v):
        """Parse JSON string to dict if needed."""
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return None
        return v
    
    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    """Schema for conversation response."""
    id: int
    title: Optional[str] = None
    description: Optional[str] = None
    language: str
    trim_silence: bool
    chunk_interval_sec: int
    num_speakers: Optional[int] = 2
    status: str
    total_duration_sec: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    chunks: List[ConversationChunkResponse] = []
    
    class Config:
        from_attributes = True


class ConversationList(BaseModel):
    """Schema for listing conversations."""
    id: int
    title: Optional[str] = None
    description: Optional[str] = None
    language: str
    status: str
    total_duration_sec: Optional[float] = None
    chunk_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ConversationTranscript(BaseModel):
    """Schema for full conversation transcript."""
    id: int
    title: Optional[str] = None
    full_transcript: str
    full_transcript_with_speakers: Optional[str] = None
    total_duration_sec: Optional[float] = None
    speakers: List[str] = []
