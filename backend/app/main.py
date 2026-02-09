from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import transcriptions, conversations, ai_assistant
from .config import settings

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    print("Database initialized")
    print(f"Using Whisper model: {settings.whisper_model}")
    print(f"Audio storage: {settings.audio_storage_path}")
    print(f"Transcript storage: {settings.transcript_storage_path}")
    ai_model = settings.ai_assistant_ollama_model if settings.ai_assistant_provider == "ollama" else settings.ai_assistant_model
    print(f"AI Assistant: {'enabled' if settings.ai_assistant_enabled else 'disabled'} ({settings.ai_assistant_provider}/{ai_model})")
    yield
    # Cleanup code can go here

# Create FastAPI app
app = FastAPI(
    title="Local Audio Transcriber",
    description="A local web application for transcribing audio files using Whisper. Supports English and Hebrew.",
    version="1.0.0",
    lifespan=lifespan
)

import json

# Configure CORS for frontend
try:
    origins = json.loads(settings.cors_origins)
except json.JSONDecodeError:
    origins = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
    print("Warning: Failed to parse CORS_ORIGINS, using defaults")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(transcriptions.router)
app.include_router(conversations.router)
app.include_router(ai_assistant.router)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "Local Audio Transcriber API",
        "version": "1.0.0",
        "docs": "/docs",
        "supported_languages": ["English", "Hebrew"],
        "endpoints": {
            "upload": "POST /api/upload",
            "list": "GET /api/transcriptions",
            "get": "GET /api/transcriptions/{id}",
            "audio": "GET /api/transcriptions/{id}/audio",
            "transcript": "GET /api/transcriptions/{id}/transcript",
            "status": "GET /api/status/{id}",
            "delete": "DELETE /api/transcriptions/{id}",
            "languages": "GET /api/languages"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
