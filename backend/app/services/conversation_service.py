from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from ..models import Conversation

class ConversationService:
    def __init__(self, db: Session):
        self.db = db

    def refresh_status(self, conversation_id: int) -> Optional[Conversation]:
        """
        Update conversation status and total duration based on chunk statuses.

        Returns the updated conversation object or None if not found.
        """
        conversation = self.db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            return None

        # Always update total duration from chunks
        # Calculate sum of valid durations
        conversation.total_duration_sec = sum(
            chunk.duration_sec or 0
            for chunk in conversation.chunks
        )

        # Don't override status while actively recording
        # The 'recording' status is manually changed to 'processing' or 'completed'
        # by the complete_conversation endpoint.
        if conversation.status == "recording":
            self.db.commit()
            return conversation

        chunk_statuses = [chunk.status for chunk in conversation.chunks]

        # If no chunks, status remains as is (or could be 'completed' if empty conversation)
        if not chunk_statuses:
            self.db.commit()
            return conversation

        # Determine status based on chunks
        if all(status == "completed" for status in chunk_statuses):
            conversation.status = "completed"
            # Set completed_at if not already set or update it
            if not conversation.completed_at:
                conversation.completed_at = datetime.utcnow()
        elif any(status in ["pending", "processing"] for status in chunk_statuses):
            conversation.status = "processing"
        elif any(status == "failed" for status in chunk_statuses):
            # If some failed and none are pending/processing, the conversation is failed
            # (unless some are completed, but usually failed + completed = partial success or failed)
            # The logic here says: if any failed, and NOT processing, then failed.
            conversation.status = "failed"

        self.db.commit()
        return conversation
