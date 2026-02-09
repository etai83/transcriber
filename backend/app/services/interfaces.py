from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class TranscriptionResult(BaseModel):
    """Standardized result from a transcription provider."""
    text: str
    language: str  # The output language (e.g. 'en')
    source_language: Optional[str] = None  # The detected/input language
    segments: List[Dict[str, Any]] = []  # Raw segments from ASR
    duration: float
    is_hallucination: bool = False
    transcript_segments: Optional[Dict[str, Any]] = None  # Diarization results

class TranscriptionProvider(ABC):
    """Abstract base class for transcription services."""

    @abstractmethod
    def transcribe(
        self,
        audio_path: str,
        language: str = "auto",
        trim_silence: bool = False,
        num_speakers: Optional[int] = None,
        **kwargs
    ) -> TranscriptionResult:
        """
        Transcribe audio file.

        Args:
            audio_path: Path to the audio file
            language: Language code ('en', 'he', 'auto')
            trim_silence: Whether to trim silence before processing
            num_speakers: If provided, enable speaker diarization with this number of speakers

        Returns:
            TranscriptionResult object
        """
        pass

    @abstractmethod
    def get_supported_languages(self) -> Dict[str, str]:
        """Return a dictionary of supported languages."""
        pass
