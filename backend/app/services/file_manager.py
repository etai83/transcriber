import os
import shutil
import uuid
from pathlib import Path
from typing import Tuple
from ..config import settings


class FileManager:
    """Manages audio and transcript file operations."""
    
    def __init__(self):
        self.audio_path = settings.get_audio_path()
        self.transcript_path = settings.get_transcript_path()
    
    def save_audio_file(self, file_content: bytes, original_filename: str) -> Tuple[str, str]:
        """
        Save an uploaded audio file.
        
        Returns:
            Tuple of (unique_filename, full_path)
        """
        # Generate unique filename to avoid collisions
        ext = Path(original_filename).suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = self.audio_path / unique_name
        
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        return unique_name, str(file_path.absolute())
    
    def save_transcript(self, transcription_id: int, text: str) -> str:
        """
        Save transcript text to a file.
        
        Returns:
            Full path to the transcript file
        """
        filename = f"transcript_{transcription_id}.txt"
        file_path = self.transcript_path / filename
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text)
        
        return str(file_path.absolute())
    
    def get_audio_file(self, audio_path: str) -> Path:
        """Get the path to an audio file."""
        path = Path(audio_path)
        if path.exists():
            return path
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    
    def get_transcript_file(self, transcript_path: str) -> Path:
        """Get the path to a transcript file."""
        path = Path(transcript_path)
        if path.exists():
            return path
        raise FileNotFoundError(f"Transcript file not found: {transcript_path}")
    
    def read_transcript(self, transcript_path: str) -> str:
        """Read transcript text from file."""
        path = self.get_transcript_file(transcript_path)
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    
    def delete_files(self, audio_path: str = None, transcript_path: str = None):
        """Delete audio and/or transcript files."""
        if audio_path:
            try:
                path = Path(audio_path)
                if path.exists():
                    path.unlink()
            except Exception as e:
                print(f"Error deleting audio file {audio_path}: {e}")
        
        if transcript_path:
            try:
                path = Path(transcript_path)
                if path.exists():
                    path.unlink()
            except Exception as e:
                print(f"Error deleting transcript file {transcript_path}: {e}")
    
    def get_supported_extensions(self) -> list:
        """Return list of supported audio file extensions."""
        return [".mp3", ".wav", ".m4a", ".flac", ".ogg", ".webm", ".mp4", ".mpeg", ".mpga"]
    
    def is_valid_audio_file(self, filename: str) -> bool:
        """Check if the file extension is supported."""
        ext = Path(filename).suffix.lower()
        return ext in self.get_supported_extensions()


file_manager = FileManager()
