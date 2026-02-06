from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Whisper settings
    whisper_model: str = "small"
    
    # Diarization settings
    # Set to False to disable speaker diarization (useful if models aren't downloaded)
    enable_diarization: bool = False
    
    # Storage paths
    audio_storage_path: str = "./storage/audio"
    transcript_storage_path: str = "./storage/transcripts"
    
    # Database
    database_url: str = "sqlite:///./transcriber.db"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Default language
    default_language: str = "auto"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"
    
    def get_audio_path(self) -> Path:
        path = Path(self.audio_storage_path)
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def get_transcript_path(self) -> Path:
        path = Path(self.transcript_storage_path)
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
