"""
API router for AI Assistant recommendations.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import Conversation, Transcription
from ..services.ai_assistant import ai_assistant_service
from ..config import settings


router = APIRouter(prefix="/api/ai-assistant", tags=["ai-assistant"])


class RecommendationRequest(BaseModel):
    """Request body for getting recommendations."""
    conversation_id: int
    chunk_id: Optional[int] = None


class Suggestion(BaseModel):
    """A single AI suggestion."""
    type: str
    title: str
    message: str


class RecommendationResponse(BaseModel):
    """Response containing AI suggestions."""
    suggestions: List[Suggestion]
    model: Optional[str] = None
    context_chunks_used: Optional[int] = None
    error: Optional[str] = None


class SettingsResponse(BaseModel):
    """Response containing AI assistant settings."""
    enabled: bool
    model: str
    max_context_chunks: int
    api_key_configured: bool


@router.get("/settings", response_model=SettingsResponse)
async def get_ai_assistant_settings():
    """Get current AI assistant settings."""
    return ai_assistant_service.get_settings()


@router.post("/recommendations", response_model=RecommendationResponse)
async def get_recommendations(
    request: RecommendationRequest,
    db: Session = Depends(get_db)
):
    """
    Generate AI recommendations based on conversation transcripts.
    
    If chunk_id is provided, uses that chunk as the "latest" text.
    Otherwise, uses the most recently completed chunk.
    """
    # Get the conversation
    conversation = db.query(Conversation).filter(Conversation.id == request.conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get all completed chunks
    completed_chunks = db.query(Transcription).filter(
        Transcription.conversation_id == request.conversation_id,
        Transcription.status == "completed",
        Transcription.transcript_text.isnot(None)
    ).order_by(Transcription.chunk_index).all()
    
    if not completed_chunks:
        return RecommendationResponse(
            suggestions=[],
            error="No completed transcriptions available"
        )
    
    # Determine which chunk is the "latest"
    if request.chunk_id:
        latest_chunk = next((c for c in completed_chunks if c.id == request.chunk_id), None)
        if not latest_chunk:
            raise HTTPException(status_code=404, detail="Chunk not found or not completed")
        # Get previous chunks (before the specified chunk)
        previous_chunks = [c for c in completed_chunks if c.chunk_index < latest_chunk.chunk_index]
    else:
        # Use the most recent completed chunk
        latest_chunk = completed_chunks[-1]
        previous_chunks = completed_chunks[:-1]
    
    # Extract text from chunks
    latest_text = latest_chunk.transcript_text or ""
    previous_context = [c.transcript_text for c in previous_chunks if c.transcript_text]
    
    # Detect language from conversation or latest chunk
    language = conversation.language if conversation.language != "auto" else "auto"
    
    # Generate recommendations
    result = await ai_assistant_service.generate_recommendations(
        latest_text=latest_text,
        previous_context=previous_context,
        conversation_context=conversation.background_context,
        language=language
    )
    
    suggestions = [Suggestion(**s) for s in result.get("suggestions", [])]
    
    # Save suggestions to the chunk for later review
    if suggestions and not result.get("error"):
        import json
        latest_chunk.ai_suggestions = json.dumps([s.model_dump() for s in suggestions])
        # Save model info in format "provider/model"
        provider = result.get("provider", "unknown")
        model = result.get("model", "unknown")
        latest_chunk.ai_model = f"{provider}/{model}"
        db.commit()
    
    return RecommendationResponse(
        suggestions=suggestions,
        model=result.get("model"),
        context_chunks_used=result.get("context_chunks_used"),
        error=result.get("error")
    )


@router.get("/status")
async def get_ai_assistant_status():
    """Check if AI assistant is enabled and ready."""
    return {
        "enabled": ai_assistant_service.is_enabled(),
        "settings": ai_assistant_service.get_settings()
    }
