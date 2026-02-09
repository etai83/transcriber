"""
AI Assistant service for generating live recommendations during conversation recording.
Uses Google Gemini to analyze transcribed chunks and generate clarification questions.
"""

import google.generativeai as genai
from typing import List, Optional, Dict, Any
from ..config import settings


class AIAssistantService:
    """Service for generating AI-powered recommendations during conversations."""
    
    _model = None
    _model_name = None
    
    @classmethod
    def _get_model(cls):
        """Get or create the Gemini model instance."""
        if not settings.google_api_key:
            raise ValueError("Google API key not configured. Set GOOGLE_API_KEY in .env file.")
        
        if cls._model is None or cls._model_name != settings.ai_assistant_model:
            genai.configure(api_key=settings.google_api_key)
            cls._model = genai.GenerativeModel(settings.ai_assistant_model)
            cls._model_name = settings.ai_assistant_model
        
        return cls._model
    
    @classmethod
    def is_enabled(cls) -> bool:
        """Check if AI assistant is enabled and configured."""
        return settings.ai_assistant_enabled and bool(settings.google_api_key)
    
    @classmethod
    def get_settings(cls) -> Dict[str, Any]:
        """Get current AI assistant settings."""
        return {
            "enabled": settings.ai_assistant_enabled,
            "model": settings.ai_assistant_model,
            "max_context_chunks": settings.ai_assistant_max_context_chunks,
            "api_key_configured": bool(settings.google_api_key)
        }
    
    @classmethod
    async def generate_recommendations(
        cls,
        latest_text: str,
        previous_context: Optional[List[str]] = None,
        language: str = "auto"
    ) -> Dict[str, Any]:
        """
        Generate clarification questions and recommendations based on the transcribed text.
        
        Args:
            latest_text: The most recent transcribed chunk
            previous_context: List of previous chunk transcripts for context
            language: Detected language of the transcript
            
        Returns:
            Dictionary with suggestions and metadata
        """
        if not cls.is_enabled():
            return {
                "suggestions": [],
                "error": "AI Assistant is not enabled or API key not configured"
            }
        
        try:
            model = cls._get_model()
            
            # Build context from previous chunks
            context_text = ""
            if previous_context:
                context_text = "\n---\n".join(previous_context[-settings.ai_assistant_max_context_chunks:])
            
            # Craft the prompt
            prompt = cls._build_prompt(latest_text, context_text, language)
            
            # Generate response
            response = await model.generate_content_async(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=500,
                )
            )
            
            # Parse the response
            suggestions = cls._parse_response(response.text)
            
            return {
                "suggestions": suggestions,
                "model": settings.ai_assistant_model,
                "context_chunks_used": len(previous_context) if previous_context else 0
            }
            
        except Exception as e:
            return {
                "suggestions": [],
                "error": str(e)
            }
    
    @classmethod
    def _build_prompt(cls, latest_text: str, context_text: str, language: str) -> str:
        """Build the prompt for the AI model."""
        
        language_instruction = ""
        if language == "he":
            language_instruction = "The conversation is in Hebrew. Generate suggestions in Hebrew."
        elif language == "en":
            language_instruction = "The conversation is in English. Generate suggestions in English."
        else:
            language_instruction = "Detect the language and respond in the same language as the conversation."
        
        prompt = f"""You are an AI assistant helping someone understand a live conversation recording. 
Your task is to identify:
1. Any ambiguities or unclear references that might need clarification
2. Important points that might need follow-up questions
3. Technical terms or concepts that might need explanation

{language_instruction}

Previous conversation context:
{context_text if context_text else "(No previous context)"}

Latest transcribed segment:
{latest_text}

Based on this, generate 1-3 helpful suggestions. For each suggestion, provide:
- type: "clarification" | "follow_up" | "note"
- title: A short title (2-5 words)
- message: The actual suggestion or question (1-2 sentences)

Format your response as a simple list with each suggestion on a new line:
TYPE: <type>
TITLE: <title>
MESSAGE: <message>
---

If the text is too short or there's nothing noteworthy, respond with:
NO_SUGGESTIONS

Keep suggestions concise and actionable. Focus on what would genuinely help the listener."""

        return prompt
    
    @classmethod
    def _parse_response(cls, response_text: str) -> List[Dict[str, str]]:
        """Parse the AI response into structured suggestions."""
        
        if "NO_SUGGESTIONS" in response_text:
            return []
        
        suggestions = []
        current_suggestion = {}
        
        for line in response_text.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
                
            if line == "---":
                if current_suggestion and "type" in current_suggestion:
                    suggestions.append(current_suggestion)
                current_suggestion = {}
            elif line.startswith("TYPE:"):
                current_suggestion["type"] = line[5:].strip().lower()
            elif line.startswith("TITLE:"):
                current_suggestion["title"] = line[6:].strip()
            elif line.startswith("MESSAGE:"):
                current_suggestion["message"] = line[8:].strip()
        
        # Don't forget the last suggestion
        if current_suggestion and "type" in current_suggestion:
            suggestions.append(current_suggestion)
        
        # Validate and clean suggestions
        valid_types = {"clarification", "follow_up", "note"}
        validated = []
        for s in suggestions:
            if s.get("type") in valid_types and s.get("title") and s.get("message"):
                validated.append(s)
            elif s.get("title") and s.get("message"):
                # Default to "note" if type is missing or invalid
                s["type"] = "note"
                validated.append(s)
        
        return validated[:3]  # Return at most 3 suggestions


ai_assistant_service = AIAssistantService()
