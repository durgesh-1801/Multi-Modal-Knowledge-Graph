"""
AI Conversational Chat API Router.

Provides endpoints for conversational AI compliance guidance, history management, and session clearing:
- POST /chat: Submits query to AI Chat Orchestrator, returning answer & citations.
- POST /chat/batch: Batch chat queries endpoint.
- GET /chat/history/{conversation_id}: Retrieves multi-turn chat message history.
- DELETE /chat/history/{conversation_id}: Deletes session chat history.
- POST /chat/clear: Clears active session history.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.chat.chat_service import ChatService
from app.core.logging import logger
from app.schemas.chat import (
    BatchChatRequest,
    BatchChatResponse,
    ChatMessage,
    ChatRequest,
    ChatResponse,
)
from app.schemas.common import StandardResponse

router = APIRouter()
chat_service = ChatService()


class ClearHistoryRequest(BaseModel):
    conversation_id: str


@router.post(
    "",
    response_model=StandardResponse[ChatResponse],
    status_code=status.HTTP_200_OK,
    summary="Submit Conversational Compliance Chat Query",
    description=(
        "Executes AI Chat Orchestrator pipeline: classifies user intent, retrieves multi-turn history, "
        "invokes Graph RAG Engine, ranks citations, and returns grounded answer."
    ),
)
async def chat(
    payload: ChatRequest,
) -> StandardResponse[ChatResponse]:
    """
    Primary conversational chat query endpoint handler.
    """
    if not payload.query or not payload.query.strip():
        logger.warning("Chat endpoint invoked with empty query.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat query cannot be empty.",
        )

    try:
        response_data: ChatResponse = await chat_service.chat_async(
            query=payload.query,
            conversation_id=payload.conversation_id,
            session_id=payload.session_id,
            top_k=payload.top_k,
        )

        return StandardResponse[ChatResponse](
            success=True,
            message="Chat query processed successfully",
            data=response_data,
        )

    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Chat orchestration error: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat orchestration failed: {str(err)}",
        )


@router.post(
    "/batch",
    response_model=StandardResponse[BatchChatResponse],
    status_code=status.HTTP_200_OK,
    summary="Submit Batch Chat Queries",
    description="Processes multiple conversational chat queries in batch.",
)
async def chat_batch(
    payload: BatchChatRequest,
) -> StandardResponse[BatchChatResponse]:
    """
    Batch chat query endpoint handler.
    """
    if not payload.queries or len(payload.queries) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query list for batch chat cannot be empty.",
        )

    try:
        results: List[ChatResponse] = await chat_service.chat_batch_async(payload.queries)
        batch_response = BatchChatResponse(success=True, results=results)

        return StandardResponse[BatchChatResponse](
            success=True,
            message="Batch chat queries processed successfully",
            data=batch_response,
        )

    except Exception as err:
        logger.error(f"Batch chat processing error: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch chat failed: {str(err)}",
        )


@router.get(
    "/history/{conversation_id}",
    response_model=StandardResponse[List[ChatMessage]],
    status_code=status.HTTP_200_OK,
    summary="Retrieve Conversation Chat History",
    description="Returns ordered historical chat messages for a specific conversation_id.",
)
async def get_chat_history(
    conversation_id: str,
) -> StandardResponse[List[ChatMessage]]:
    """
    Chat history retrieval endpoint handler.
    """
    if not conversation_id or not conversation_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="conversation_id is required.",
        )

    history = chat_service.conv_manager.get_history(conversation_id)
    return StandardResponse[List[ChatMessage]](
        success=True,
        message=f"Retrieved {len(history)} messages for conversation '{conversation_id}'",
        data=history,
    )


@router.delete(
    "/history/{conversation_id}",
    response_model=StandardResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Delete Conversation History",
    description="Deletes all historical chat messages for a specific conversation_id.",
)
async def delete_chat_history(
    conversation_id: str,
) -> StandardResponse[dict]:
    """
    Delete conversation history endpoint handler.
    """
    if not conversation_id or not conversation_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="conversation_id is required.",
        )

    cleared = chat_service.conv_manager.clear_history(conversation_id)
    return StandardResponse[dict](
        success=cleared,
        message=f"Cleared history for conversation '{conversation_id}'",
        data={"conversation_id": conversation_id, "cleared": cleared},
    )


@router.post(
    "/clear",
    response_model=StandardResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Clear Active Session History",
    description="Clears historical messages for the specified conversation session.",
)
async def clear_chat_history(
    payload: ClearHistoryRequest,
) -> StandardResponse[dict]:
    """
    Clear session history endpoint handler.
    """
    cleared = chat_service.conv_manager.clear_history(payload.conversation_id)
    return StandardResponse[dict](
        success=cleared,
        message=f"Cleared history for conversation '{payload.conversation_id}'",
        data={"conversation_id": payload.conversation_id, "cleared": cleared},
    )
