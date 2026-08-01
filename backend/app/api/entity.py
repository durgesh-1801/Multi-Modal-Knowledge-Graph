"""
Entity Extraction API Router.

Provides endpoints for extracting structured compliance entities from text documents and batch texts:
- POST /extract/entities: Single document entity extraction endpoint.
- POST /extract/entities/batch: Batch document entity extraction endpoint.
"""

from fastapi import APIRouter, HTTPException, status

from app.core.logging import logger
from app.schemas.common import StandardResponse
from app.schemas.entity import (
    BatchEntityRequest,
    BatchEntityResponse,
    EntityRequest,
    EntityResponse,
)
from app.services.entity_extractor import EntityExtractor

router = APIRouter()
entity_extractor = EntityExtractor()


@router.post(
    "",
    response_model=StandardResponse[EntityResponse],
    status_code=status.HTTP_200_OK,
    summary="Extract Compliance Entities from Text",
    description=(
        "Executes hybrid multi-stage extraction (spaCy NER + Rule-Based Patterns + Gemini LLM) "
        "to extract, normalize, and deduplicate entities from compliance text."
    ),
)
async def extract_entities(
    payload: EntityRequest,
) -> StandardResponse[EntityResponse]:
    """
    Single document entity extraction endpoint handler.
    """
    if not payload.text or not payload.text.strip():
        logger.warning("Entity extraction endpoint invoked with empty text.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Input text for entity extraction cannot be empty.",
        )

    try:
        response_data: EntityResponse = await entity_extractor.extract_entities_async(
            text=payload.text,
            enable_spacy=payload.enable_spacy,
            enable_rules=payload.enable_rules,
            enable_gemini=payload.enable_gemini,
        )

        return StandardResponse[EntityResponse](
            success=True,
            message="Entities extracted successfully",
            data=response_data,
        )

    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Entity extraction error: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Entity extraction pipeline failed: {str(err)}",
        )


@router.post(
    "/batch",
    response_model=StandardResponse[BatchEntityResponse],
    status_code=status.HTTP_200_OK,
    summary="Extract Entities from Batch Documents",
    description="Processes multiple text documents in batch and returns entity extractions per document.",
)
async def extract_entities_batch(
    payload: BatchEntityRequest,
) -> StandardResponse[BatchEntityResponse]:
    """
    Batch document entity extraction endpoint handler.
    """
    if not payload.documents or len(payload.documents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document list for batch entity extraction cannot be empty.",
        )

    batch_results: List[EntityResponse] = []

    for idx, doc_text in enumerate(payload.documents):
        if not doc_text or not doc_text.strip():
            batch_results.append(
                EntityResponse(
                    success=True,
                    entities=[],
                    total_entities=0,
                    processing_time_ms=0.0,
                )
            )
            continue

        try:
            res = await entity_extractor.extract_entities_async(text=doc_text)
            batch_results.append(res)
        except Exception as err:
            logger.error(f"Error in batch document {idx}: {err}")
            batch_results.append(
                EntityResponse(
                    success=False,
                    entities=[],
                    total_entities=0,
                    processing_time_ms=0.0,
                )
            )

    batch_response = BatchEntityResponse(
        success=True,
        results=batch_results,
    )

    return StandardResponse[BatchEntityResponse](
        success=True,
        message="Batch entity extraction completed successfully",
        data=batch_response,
    )
