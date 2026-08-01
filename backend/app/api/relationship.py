"""
Relationship Extraction API Router.

Provides endpoints for extracting graph-ready relationships and nodes from compliance documents:
- POST /extract/relationships: Single document relationship extraction endpoint.
- POST /extract/relationships/batch: Batch document relationship extraction endpoint.
"""

from typing import List
from fastapi import APIRouter, HTTPException, status

from app.core.logging import logger
from app.schemas.common import StandardResponse
from app.schemas.relationship import (
    BatchRelationshipRequest,
    BatchRelationshipResponse,
    RelationshipRequest,
    RelationshipResponse,
)
from app.services.relationship_extractor import RelationshipExtractor

router = APIRouter()
relationship_extractor = RelationshipExtractor()


@router.post(
    "",
    response_model=StandardResponse[RelationshipResponse],
    status_code=status.HTTP_200_OK,
    summary="Extract Compliance Relationships and Graph Payload from Text",
    description=(
        "Executes hybrid multi-stage relationship extraction (Rule-Based Verbal Patterns + Gemini LLM), "
        "normalizes relation types, deduplicates directed edges, and returns graph-ready JSON nodes and relationships."
    ),
)
async def extract_relationships(
    payload: RelationshipRequest,
) -> StandardResponse[RelationshipResponse]:
    """
    Single document relationship extraction endpoint handler.
    """
    if not payload.text or not payload.text.strip():
        logger.warning("Relationship extraction endpoint invoked with empty text.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Input text for relationship extraction cannot be empty.",
        )

    try:
        response_data: RelationshipResponse = (
            await relationship_extractor.extract_relationships_async(
                text=payload.text,
                entities=payload.entities,
                enable_rules=payload.enable_rules,
                enable_gemini=payload.enable_gemini,
            )
        )

        return StandardResponse[RelationshipResponse](
            success=True,
            message="Relationships extracted successfully",
            data=response_data,
        )

    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Relationship extraction error: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Relationship extraction pipeline failed: {str(err)}",
        )


@router.post(
    "/batch",
    response_model=StandardResponse[BatchRelationshipResponse],
    status_code=status.HTTP_200_OK,
    summary="Extract Relationships from Batch Documents",
    description="Processes multiple document relationship requests in batch and returns graph payloads per document.",
)
async def extract_relationships_batch(
    payload: BatchRelationshipRequest,
) -> StandardResponse[BatchRelationshipResponse]:
    """
    Batch document relationship extraction endpoint handler.
    """
    if not payload.documents or len(payload.documents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document request list for batch relationship extraction cannot be empty.",
        )

    batch_results: List[RelationshipResponse] = []

    for idx, doc_req in enumerate(payload.documents):
        if not doc_req.text or not doc_req.text.strip():
            batch_results.append(
                RelationshipResponse(
                    success=True,
                    nodes=[],
                    relationships=[],
                    total_relationships=0,
                    processing_time_ms=0.0,
                )
            )
            continue

        try:
            res = await relationship_extractor.extract_relationships_async(
                text=doc_req.text,
                entities=doc_req.entities,
                enable_rules=doc_req.enable_rules,
                enable_gemini=doc_req.enable_gemini,
            )
            batch_results.append(res)
        except Exception as err:
            logger.error(f"Error in batch relationship document {idx}: {err}")
            batch_results.append(
                RelationshipResponse(
                    success=False,
                    nodes=[],
                    relationships=[],
                    total_relationships=0,
                    processing_time_ms=0.0,
                )
            )

    batch_response = BatchRelationshipResponse(
        success=True,
        results=batch_results,
    )

    return StandardResponse[BatchRelationshipResponse](
        success=True,
        message="Batch relationship extraction completed successfully",
        data=batch_response,
    )
