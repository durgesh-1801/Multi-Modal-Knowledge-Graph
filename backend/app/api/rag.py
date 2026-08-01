"""
Graph RAG Engine API Router.

Provides endpoints for executing grounded Graph RAG queries and batch queries:
- POST /rag/query: Single query Graph RAG endpoint returning answer, citations, and context.
- POST /rag/query/batch: Batch query Graph RAG endpoint.
"""

from typing import List
from fastapi import APIRouter, HTTPException, status

from app.core.logging import logger
from app.rag.graph_rag import GraphRAGEngine
from app.schemas.common import StandardResponse
from app.schemas.rag import (
    BatchRAGRequest,
    BatchRAGResponse,
    RAGQuery,
    RAGResponse,
)

router = APIRouter()
rag_engine = GraphRAGEngine()


@router.post(
    "/query",
    response_model=StandardResponse[RAGResponse],
    status_code=status.HTTP_200_OK,
    summary="Execute Graph RAG Query with Citations",
    description=(
        "Executes a Graph RAG pipeline combining vector semantic search (Qdrant), "
        "Knowledge Graph facts (AbstractGraphInterface), Gemini LLM answer generation, "
        "and evidence citation extraction."
    ),
)
async def execute_rag_query(
    payload: RAGQuery,
) -> StandardResponse[RAGResponse]:
    """
    Single RAG query endpoint handler.
    """
    if not payload.query or not payload.query.strip():
        logger.warning("RAG query endpoint invoked with empty query.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query string cannot be empty.",
        )

    try:
        response_data: RAGResponse = await rag_engine.query_async(payload)

        return StandardResponse[RAGResponse](
            success=True,
            message="Graph RAG query processed successfully",
            data=response_data,
        )

    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Graph RAG query execution error: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Graph RAG pipeline failed: {str(err)}",
        )


@router.post(
    "/query/batch",
    response_model=StandardResponse[BatchRAGResponse],
    status_code=status.HTTP_200_OK,
    summary="Execute Batch Graph RAG Queries",
    description="Processes multiple RAG queries in batch and returns grounded answers with citations for each.",
)
async def execute_rag_query_batch(
    payload: BatchRAGRequest,
) -> StandardResponse[BatchRAGResponse]:
    """
    Batch RAG query endpoint handler.
    """
    if not payload.queries or len(payload.queries) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query list for batch RAG execution cannot be empty.",
        )

    try:
        results: List[RAGResponse] = await rag_engine.query_batch_async(payload.queries)

        batch_payload = BatchRAGResponse(
            success=True,
            results=results,
        )

        return StandardResponse[BatchRAGResponse](
            success=True,
            message="Batch Graph RAG queries completed successfully",
            data=batch_payload,
        )

    except Exception as err:
        logger.error(f"Batch Graph RAG execution error: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch Graph RAG failed: {str(err)}",
        )
