"""
Embedding Generation & Vector Search API Router.

Provides endpoints for document vector embedding generation, Qdrant payload storage,
semantic vector search with metadata filtering, health checks, and document vector deletion.
"""

from fastapi import APIRouter, HTTPException, status

from app.core.logging import logger
from app.schemas.common import StandardResponse
from app.schemas.embeddings import (
    EmbeddingRequest,
    EmbeddingResponse,
    VectorSearchRequest,
    VectorSearchResponse,
)
from app.vector.vector_store import VectorStoreService

router = APIRouter()
vector_store_service = VectorStoreService()


@router.post(
    "/document",
    response_model=StandardResponse[EmbeddingResponse],
    status_code=status.HTTP_200_OK,
    summary="Generate and Store Document Vector Embeddings",
    description=(
        "Segments document text into chunks using ChunkingService, generates dense embeddings "
        "using HuggingFace SentenceTransformer, and stores payloads in Qdrant Vector DB."
    ),
)
async def create_document_embeddings(
    payload: EmbeddingRequest,
) -> StandardResponse[EmbeddingResponse]:
    """
    Document embedding generation & Qdrant storage endpoint handler.
    """
    if not payload.text or not payload.text.strip():
        logger.warning("Embedding request received with empty text.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document text for embedding generation cannot be empty.",
        )

    try:
        response_data: EmbeddingResponse = (
            vector_store_service.process_and_store_document(
                document_id=payload.document_id,
                text=payload.text,
                source_type=payload.source_type,
                original_filename=payload.original_filename,
                page_number=payload.page_number,
                chunk_size=payload.chunk_size,
                chunk_overlap=payload.chunk_overlap,
            )
        )

        return StandardResponse[EmbeddingResponse](
            success=True,
            message="Document embeddings generated and stored successfully",
            data=response_data,
        )

    except Exception as err:
        logger.error(f"Failed to generate embeddings for document '{payload.document_id}': {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Embedding generation failed: {str(err)}",
        )


@router.post(
    "/search",
    response_model=StandardResponse[VectorSearchResponse],
    status_code=status.HTTP_200_OK,
    summary="Semantic Vector Search against Qdrant Store",
    description=(
        "Generates dense query vector embedding and searches Qdrant collection using Cosine distance. "
        "Supports top-K limiting and metadata filters (document_id, source_type, page_number)."
    ),
)
async def search_embeddings(
    payload: VectorSearchRequest,
) -> StandardResponse[VectorSearchResponse]:
    """
    Semantic vector search endpoint handler.
    """
    if not payload.query or not payload.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty.",
        )

    try:
        response_data: VectorSearchResponse = (
            vector_store_service.search_semantic(
                query=payload.query,
                top_k=payload.top_k,
                document_id=payload.document_id,
                source_type=payload.source_type,
                page_number=payload.page_number,
                score_threshold=payload.score_threshold,
            )
        )

        return StandardResponse[VectorSearchResponse](
            success=True,
            message="Semantic search executed successfully",
            data=response_data,
        )

    except Exception as err:
        logger.error(f"Semantic search error: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semantic search failed: {str(err)}",
        )


@router.get(
    "/health",
    tags=["Health Check"],
    summary="Qdrant Vector Database Connectivity Health Check",
    description="Returns operational status of Qdrant vector store connection and embedding model details.",
)
async def embeddings_health() -> StandardResponse[dict]:
    """
    Qdrant connectivity health status check.
    """
    health_data = vector_store_service.get_health()
    return StandardResponse[dict](
        success=health_data.get("qdrant_connected", False),
        message="Qdrant connectivity check completed",
        data=health_data,
    )


@router.delete(
    "/document/{document_id}",
    response_model=StandardResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Delete Document Vector Embeddings",
    description="Deletes all stored vector points associated with a specific document_id from Qdrant.",
)
async def delete_document_embeddings(
    document_id: str,
) -> StandardResponse[dict]:
    """
    Delete document embeddings endpoint handler.
    """
    if not document_id or not document_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_id parameter is required.",
        )

    success = vector_store_service.delete_document_vectors(document_id)
    return StandardResponse[dict](
        success=success,
        message=f"Vector embeddings for document '{document_id}' deleted successfully",
        data={"document_id": document_id, "deleted": success},
    )
