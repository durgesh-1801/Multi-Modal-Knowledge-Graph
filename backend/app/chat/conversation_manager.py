"""
Conversation Manager Service.

Manages multi-turn conversation session states, message ordering, history retrieval,
and session clearing. Implements an in-memory session store designed with a pluggable
interface for seamless future Redis / PostgreSQL replacement.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.core.logging import logger
from app.schemas.chat import ChatMessage, Conversation


class ConversationManager:
    """
    Pluggable Conversation Manager tracking session messages and history contexts.
    """

    def __init__(self, max_history_messages: int = 10) -> None:
        self.max_history_messages: int = max_history_messages
        # In-memory store: conversation_id -> Conversation
        self._store: Dict[str, Conversation] = {}

    def create_session(
        self, conversation_id: Optional[str] = None, session_id: Optional[str] = None
    ) -> Conversation:
        """
        Creates or retrieves a conversation session.

        Args:
            conversation_id: Optional existing conversation ID.
            session_id: Optional user session tracking ID.

        Returns:
            Conversation: Conversation state object.
        """
        cid = conversation_id or f"conv_{uuid.uuid4().hex[:10]}"
        sid = session_id or f"sess_{uuid.uuid4().hex[:10]}"

        if cid in self._store:
            return self._store[cid]

        now_iso = datetime.now(timezone.utc).isoformat()
        conv = Conversation(
            conversation_id=cid,
            session_id=sid,
            messages=[],
            created_at=now_iso,
            updated_at=now_iso,
        )
        self._store[cid] = conv
        logger.info(f"Created new conversation session: ID='{cid}' (Session='{sid}')")
        return conv

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ChatMessage:
        """
        Appends a message to the active conversation history.

        Args:
            conversation_id: Target conversation ID.
            role: 'user' or 'assistant'.
            content: Message body string.
            metadata: Custom message metadata.

        Returns:
            ChatMessage: Appended message model.
        """
        conv = self.create_session(conversation_id=conversation_id)

        now_iso = datetime.now(timezone.utc).isoformat()
        msg = ChatMessage(
            role=role,
            content=content,
            timestamp=now_iso,
            metadata=metadata or {},
        )
        conv.messages.append(msg)
        conv.updated_at = now_iso

        logger.info(
            f"Added [{role}] message to conversation '{conversation_id}' (Total: {len(conv.messages)} msgs)"
        )
        return msg

    def get_history(
        self, conversation_id: str, limit: Optional[int] = None
    ) -> List[ChatMessage]:
        """
        Retrieves recent message history for a conversation up to max_history_messages limit.

        Args:
            conversation_id: Target conversation ID.
            limit: Optional custom history length limit.

        Returns:
            List[ChatMessage]: Ordered history messages.
        """
        if conversation_id not in self._store:
            return []

        conv = self._store[conversation_id]
        max_msgs = limit if limit else self.max_history_messages
        return conv.messages[-max_msgs:]

    def clear_history(self, conversation_id: str) -> bool:
        """
        Clears all message history for a specified conversation.

        Args:
            conversation_id: Target conversation ID.

        Returns:
            bool: True if cleared, False if conversation did not exist.
        """
        if conversation_id in self._store:
            self._store[conversation_id].messages.clear()
            self._store[conversation_id].updated_at = datetime.now(timezone.utc).isoformat()
            logger.info(f"Cleared message history for conversation '{conversation_id}'.")
            return True
        return False

    def summarize_history(self, conversation_id: str) -> str:
        """
        Formats recent chat history into a concise text summary string for prompt inclusion.

        Args:
            conversation_id: Target conversation ID.

        Returns:
            str: Formatted history summary string.
        """
        history = self.get_history(conversation_id, limit=6)
        if not history:
            return ""

        summary_lines = []
        for msg in history:
            role_label = "User" if msg.role == "user" else "Assistant"
            summary_lines.append(f"{role_label}: {msg.content}")

        return "\n".join(summary_lines)
