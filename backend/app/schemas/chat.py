"""
Conversational AI Chat Pydantic Schemas.

Defines Pydantic models for chat requests, chat responses, intent classification,
conversation messages, session tracking, citations, and batch chat payloads.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class QueryIntent(BaseModel):
    """
    Detected user query intent and confidence score.
    """

    intent: str = Field(
        ...,
        description=(
            "Detected query intent category (e.g. policy_lookup, compliance_question, "
            "risk_analysis, audit_question, document_search, requirement_lookup, control_lookup, "
            "general_chat, greeting, followup_question)."
        ),
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Classification confidence score."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "intent": "policy_lookup",
                "confidence": 0.96,
            }
        }
    }


class ChatMessage(BaseModel):
    """
    Single message entry within a conversation history.
    """

    role: str = Field(..., description="Message author role ('user' or 'assistant').")
    content: str = Field(..., description="Message body text.")
    timestamp: str = Field(..., description="ISO 8601 timestamp string.")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Custom message metadata."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "role": "user",
                "content": "Explain ISO 27001 access control requirements.",
                "timestamp": "2026-08-01T12:00:00Z",
            }
        }
    }


class Conversation(BaseModel):
    """
    Complete conversation session object containing message history.
    """

    conversation_id: str = Field(..., description="Unique conversation session ID.")
    session_id: str = Field(..., description="Session tracking identifier.")
    messages: List[ChatMessage] = Field(
        default_factory=list, description="Ordered list of historical messages."
    )
    created_at: str = Field(..., description="Session creation timestamp.")
    updated_at: str = Field(..., description="Last interaction timestamp.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "conversation_id": "conv_998877",
                "session_id": "session_abc123",
                "messages": [],
                "created_at": "2026-08-01T12:00:00Z",
                "updated_at": "2026-08-01T12:05:00Z",
            }
        }
    }


class ChatCitation(BaseModel):
    """
    Formatted evidence citation item for chat responses.
    """

    document: str = Field(..., description="Original document name.")
    page: int = Field(default=1, ge=1, description="Page number.")
    snippet: str = Field(..., description="Supporting evidence text snippet.")
    relevance: float = Field(..., ge=0.0, le=1.0, description="Relevance score.")
    chunk_id: str = Field(..., description="Matching chunk ID.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "document": "ISO27001.pdf",
                "page": 6,
                "snippet": "Access control policies must mandate MFA...",
                "relevance": 0.96,
                "chunk_id": "doc_123_chk_0",
            }
        }
    }


class ChatRequest(BaseModel):
    """
    Request model for submitting a chat prompt to the AI Chat Orchestrator.
    """

    query: str = Field(
        ..., min_length=1, description="User prompt or compliance question."
    )
    conversation_id: Optional[str] = Field(
        default=None, description="Optional conversation ID for history continuation."
    )
    session_id: Optional[str] = Field(
        default=None, description="Optional user session ID."
    )
    top_k: int = Field(
        default=5, ge=1, le=50, description="Number of evidence chunks to retrieve."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "Explain ISO 27001 access control requirements.",
                "conversation_id": "conv_998877",
                "session_id": "session_abc123",
                "top_k": 5,
            }
        }
    }


class ChatResponse(BaseModel):
    """
    Response model returned by POST /chat.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    conversation_id: str = Field(..., description="Active conversation session ID.")
    query_type: str = Field(..., description="Detected query intent category.")
    answer: str = Field(..., description="Grounded conversational AI answer.")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Overall answer confidence score."
    )
    processing_time: float = Field(
        ..., description="Total processing time in seconds."
    )
    related_entities: List[str] = Field(
        default_factory=list, description="Entities referenced in retrieved context."
    )
    citations: List[ChatCitation] = Field(
        default_factory=list, description="Supporting evidence citations."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "conversation_id": "conv_998877",
                "query_type": "policy_lookup",
                "answer": "ISO 27001 requires organizations to establish an Access Control Policy...",
                "confidence": 0.94,
                "processing_time": 1.42,
                "related_entities": ["ISO 27001", "Access Control Policy", "IT Department"],
                "citations": [
                    {
                        "document": "ISO27001.pdf",
                        "page": 6,
                        "snippet": "Access control policies...",
                        "relevance": 0.96,
                        "chunk_id": "doc_123_chk_0",
                    }
                ],
            }
        }
    }


class BatchChatRequest(BaseModel):
    """
    Payload for submitting multiple chat queries in batch.
    """

    queries: List[ChatRequest] = Field(
        ..., min_length=1, description="List of chat requests."
    )


class BatchChatResponse(BaseModel):
    """
    Response model for batch chat queries.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    results: List[ChatResponse] = Field(
        default_factory=list, description="List of chat responses per query."
    )
