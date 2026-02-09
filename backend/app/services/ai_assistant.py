"""
AI Assistant service for generating live recommendations during conversation recording.
Supports Google Gemini and Ollama (local LLMs) for analyzing transcribed chunks.
"""

import google.generativeai as genai
import httpx
from typing import List, Optional, Dict, Any
from ..config import settings


class AIAssistantService:
    """Service for generating AI-powered recommendations during conversations."""
    
    _gemini_model = None
    _gemini_model_name = None
    
    @classmethod
    def _get_gemini_model(cls):
        """Get or create the Gemini model instance."""
        if not settings.google_api_key:
            raise ValueError("Google API key not configured. Set GOOGLE_API_KEY in .env file.")
        
        if cls._gemini_model is None or cls._gemini_model_name != settings.ai_assistant_model:
            genai.configure(api_key=settings.google_api_key)
            cls._gemini_model = genai.GenerativeModel(settings.ai_assistant_model)
            cls._gemini_model_name = settings.ai_assistant_model
        
        return cls._gemini_model
    
    @classmethod
    def is_enabled(cls) -> bool:
        """Check if AI assistant is enabled and configured."""
        if not settings.ai_assistant_enabled:
            return False
        
        if settings.ai_assistant_provider == "gemini":
            return bool(settings.google_api_key)
        elif settings.ai_assistant_provider == "ollama":
            return True  # Ollama doesn't require API key
        
        return False
    
    @classmethod
    def get_settings(cls) -> Dict[str, Any]:
        """Get current AI assistant settings."""
        current_model = (
            settings.ai_assistant_model if settings.ai_assistant_provider == "gemini"
            else settings.ai_assistant_ollama_model
        )
        return {
            "enabled": settings.ai_assistant_enabled,
            "provider": settings.ai_assistant_provider,
            "model": current_model,
            "max_context_chunks": settings.ai_assistant_max_context_chunks,
            "api_key_configured": bool(settings.google_api_key) if settings.ai_assistant_provider == "gemini" else True,
            "ollama_url": settings.ai_assistant_ollama_url if settings.ai_assistant_provider == "ollama" else None
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
                "error": "AI Assistant is not enabled or not configured"
            }
        
        try:
            # Build context from previous chunks
            context_text = ""
            if previous_context:
                context_text = "\n---\n".join(previous_context[-settings.ai_assistant_max_context_chunks:])
            
            # Craft the prompt
            prompt = cls._build_prompt(latest_text, context_text, language)
            
            # Route to the appropriate provider
            if settings.ai_assistant_provider == "gemini":
                return await cls._generate_with_gemini(prompt, previous_context)
            elif settings.ai_assistant_provider == "ollama":
                return await cls._generate_with_ollama(prompt, previous_context)
            else:
                return {
                    "suggestions": [],
                    "error": f"Unknown AI provider: {settings.ai_assistant_provider}"
                }
            
        except Exception as e:
            return {
                "suggestions": [],
                "error": str(e)
            }
    
    @classmethod
    async def _generate_with_gemini(cls, prompt: str, previous_context: Optional[List[str]]) -> Dict[str, Any]:
        """Generate recommendations using Google Gemini."""
        model = cls._get_gemini_model()
        
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                max_output_tokens=500,
            )
        )
        
        suggestions = cls._parse_response(response.text)
        
        return {
            "suggestions": suggestions,
            "model": settings.ai_assistant_model,
            "provider": "gemini",
            "context_chunks_used": len(previous_context) if previous_context else 0
        }
    
    @classmethod
    async def _generate_with_ollama(cls, prompt: str, previous_context: Optional[List[str]]) -> Dict[str, Any]:
        """Generate recommendations using Ollama (local LLM)."""
        ollama_url = settings.ai_assistant_ollama_url.rstrip("/")
        model_name = settings.ai_assistant_ollama_model
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{ollama_url}/api/generate",
                    json={
                        "model": model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "num_predict": 500,
                        }
                    }
                )
                response.raise_for_status()
                result = response.json()
                
                suggestions = cls._parse_response(result.get("response", ""))
                
                return {
                    "suggestions": suggestions,
                    "model": model_name,
                    "provider": "ollama",
                    "context_chunks_used": len(previous_context) if previous_context else 0
                }
                
            except httpx.ConnectError:
                return {
                    "suggestions": [],
                    "error": f"Cannot connect to Ollama at {ollama_url}. Make sure Ollama is running."
                }
            except httpx.HTTPStatusError as e:
                return {
                    "suggestions": [],
                    "error": f"Ollama error: {e.response.text}"
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
    
    @classmethod
    async def generate_conversation_metadata(
        cls,
        full_transcript: str,
        language: str = "auto"
    ) -> Dict[str, Any]:
        """
        Generate a title and description for a completed conversation.
        
        Args:
            full_transcript: The complete transcript of the conversation
            language: Detected language of the transcript
            
        Returns:
            Dictionary with title, description, and metadata
        """
        if not cls.is_enabled():
            return {
                "title": None,
                "description": None,
                "error": "AI Assistant is not enabled or not configured"
            }
        
        if not full_transcript or len(full_transcript.strip()) < 10:
            return {
                "title": None,
                "description": None,
                "error": "Transcript too short to generate metadata"
            }
        
        try:
            # Build the prompt for metadata generation
            prompt = cls._build_metadata_prompt(full_transcript, language)
            
            # Route to the appropriate provider
            if settings.ai_assistant_provider == "gemini":
                return await cls._generate_metadata_with_gemini(prompt)
            elif settings.ai_assistant_provider == "ollama":
                return await cls._generate_metadata_with_ollama(prompt)
            else:
                return {
                    "title": None,
                    "description": None,
                    "error": f"Unknown AI provider: {settings.ai_assistant_provider}"
                }
            
        except Exception as e:
            return {
                "title": None,
                "description": None,
                "error": str(e)
            }
    
    @classmethod
    def _build_metadata_prompt(cls, full_transcript: str, language: str) -> str:
        """Build the prompt for generating conversation title and description."""
        
        # Truncate transcript if too long (keep first and last parts)
        max_length = 4000
        if len(full_transcript) > max_length:
            half = max_length // 2
            full_transcript = full_transcript[:half] + "\n\n[...middle section omitted...]\n\n" + full_transcript[-half:]
        
        language_instruction = ""
        if language == "he":
            language_instruction = "The conversation is in Hebrew. Generate title and description in Hebrew."
        elif language == "en":
            language_instruction = "The conversation is in English. Generate title and description in English."
        else:
            language_instruction = "Detect the language and generate title and description in the same language as the conversation."
        
        prompt = f"""You are an AI assistant analyzing a completed conversation recording. 
Your task is to generate:
1. A concise, descriptive TITLE (3-8 words max)
2. A brief DESCRIPTION summarizing the main topics and key points (1-3 sentences)

{language_instruction}

Conversation transcript:
{full_transcript}

Based on this conversation, generate:
- A clear, specific title that captures the main topic or purpose
- A description that summarizes key points, decisions, or topics discussed

Format your response exactly as:
TITLE: <your title here>
DESCRIPTION: <your description here>

Be concise and professional. Focus on the actual content and topics discussed."""

        return prompt
    
    @classmethod
    async def _generate_metadata_with_gemini(cls, prompt: str) -> Dict[str, Any]:
        """Generate conversation metadata using Google Gemini."""
        model = cls._get_gemini_model()
        
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.5,  # Lower temperature for more consistent results
                max_output_tokens=300,
            )
        )
        
        result = cls._parse_metadata_response(response.text)
        result["model"] = settings.ai_assistant_model
        result["provider"] = "gemini"
        
        return result
    
    @classmethod
    async def _generate_metadata_with_ollama(cls, prompt: str) -> Dict[str, Any]:
        """Generate conversation metadata using Ollama (local LLM)."""
        ollama_url = settings.ai_assistant_ollama_url.rstrip("/")
        model_name = settings.ai_assistant_ollama_model
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{ollama_url}/api/generate",
                    json={
                        "model": model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.5,
                            "num_predict": 300,
                        }
                    }
                )
                response.raise_for_status()
                api_result = response.json()
                
                result = cls._parse_metadata_response(api_result.get("response", ""))
                result["model"] = model_name
                result["provider"] = "ollama"
                
                return result
                
            except httpx.ConnectError:
                return {
                    "title": None,
                    "description": None,
                    "error": f"Cannot connect to Ollama at {ollama_url}. Make sure Ollama is running."
                }
            except httpx.HTTPStatusError as e:
                return {
                    "title": None,
                    "description": None,
                    "error": f"Ollama error: {e.response.text}"
                }
    
    @classmethod
    def _parse_metadata_response(cls, response_text: str) -> Dict[str, Any]:
        """Parse the AI response to extract title and description."""
        title = None
        description = None
        
        for line in response_text.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            
            if line.startswith("TITLE:"):
                title = line[6:].strip()
            elif line.startswith("DESCRIPTION:"):
                description = line[12:].strip()
        
        # Clean up any markdown or extra formatting
        if title:
            title = title.strip('"\'`')
        if description:
            description = description.strip('"\'`')
        
        return {
            "title": title,
            "description": description,
            "error": None if (title or description) else "Could not parse AI response"
        }


ai_assistant_service = AIAssistantService()
