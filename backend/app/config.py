from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Whisper settings
    whisper_model: str = "small"
    
    # Diarization settings
    # Set to False to disable speaker diarization (useful if models aren't downloaded)
    enable_diarization: bool = False
    
    # AI Assistant settings
    ai_assistant_enabled: bool = True
    ai_assistant_provider: str = "ollama"  # "gemini" or "ollama"
    ai_assistant_model: str = "gemini-2.0-flash"  # Model for Gemini
    ai_assistant_ollama_model: str = "llama3.1"  # Model for Ollama
    ai_assistant_ollama_url: str = "http://localhost:11434"  # Ollama server URL
    google_api_key: str = ""
    ai_assistant_max_context_chunks: int = 3
    
    # Storage paths
    audio_storage_path: str = "./storage/audio"
    transcript_storage_path: str = "./storage/transcripts"
    
    # Database
    database_url: str = "sqlite:///./transcriber.db"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = '["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]'  # JSON encoded list of origins
    
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
