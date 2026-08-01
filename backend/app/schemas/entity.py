"""
Entity Extraction Pydantic Schemas.

Defines Pydantic models for extracted entities, normalized entity representations,
extraction request options, single-document response payloads, and batch extraction envelopes.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class Entity(BaseModel):
    """
    Structured Entity extracted from compliance text.
    """

    name: str = Field(..., description="Original raw entity name as extracted from text.")
    type: str = Field(
        ...,
        description=(
            "Entity category type (e.g. Regulation, Standard, Control, Risk, Policy, Organization, "
            "Department, Employee, Document, Date, Deadline, Email, Phone, URL)."
        ),
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence score of the extraction (0.0 to 1.0)."
    )
    source: str = Field(
        ..., description="Extraction component origin (e.g. 'spaCy', 'Rule-Based', 'Gemini', or merged 'spaCy+Gemini')."
    )
    description: Optional[str] = Field(
        default="", description="Optional context description or explanation of the entity."
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional contextual attributes or metadata."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "ISO 27001",
                "type": "Regulation",
                "confidence": 0.98,
                "source": "Rule-Based",
                "description": "International Information Security Standard",
                "metadata": {"standard_code": "ISO/IEC 27001:2022"},
            }
        }
    }


class NormalizedEntity(Entity):
    """
    Canonical normalized entity model incorporating deduplication aliases.
    """

    normalized_name: str = Field(
        ..., description="Standardized, canonical entity name after casing & abbreviation expansion."
    )
    aliases: List[str] = Field(
        default_factory=list,
        description="List of raw name variations merged into this canonical entity.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "ISO-27001",
                "type": "Regulation",
                "confidence": 0.98,
                "source": "Rule-Based+Gemini",
                "description": "International information security standard",
                "normalized_name": "ISO 27001",
                "aliases": ["ISO27001", "ISO-27001", "ISO 27001:2022"],
            }
        }
    }


class EntityRequest(BaseModel):
    """
    Payload for submitting text to the entity extraction pipeline.
    """

    text: str = Field(
        ...,
        min_length=1,
        description="Raw document text (from PDF, OCR, audio transcript, or table) to analyze.",
    )
    enable_spacy: bool = Field(
        default=True, description="Toggle spaCy NER extraction stage."
    )
    enable_rules: bool = Field(
        default=True, description="Toggle Rule-based pattern matching extraction stage."
    )
    enable_gemini: bool = Field(
        default=True, description="Toggle Gemini LLM domain extraction stage."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "Organization ACME Corp must comply with ISO 27001 and GDPR regulations by Q3 2026.",
                "enable_spacy": True,
                "enable_rules": True,
                "enable_gemini": True,
            }
        }
    }


class EntityResponse(BaseModel):
    """
    Response model for single document entity extraction POST /extract/entities.
    """

    success: bool = Field(default=True, description="Operation success flag.")
    entities: List[Entity] = Field(
        default_factory=list, description="List of normalized, deduplicated entities."
    )
    total_entities: int = Field(default=0, description="Total count of unique entities extracted.")
    processing_time_ms: float = Field(
        ..., description="Total execution time of the extraction pipeline in milliseconds."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "entities": [
                    {
                        "name": "ISO 27001",
                        "type": "Regulation",
                        "confidence": 0.98,
                        "source": "Rule-Based",
                        "description": "International Information Security Standard",
                    }
                ],
                "total_entities": 1,
                "processing_time_ms": 142.0,
            }
        }
    }


class BatchEntityRequest(BaseModel):
    """
    Payload for submitting multiple document texts for batch entity extraction.
    """

    documents: List[str] = Field(
        ..., min_length=1, description="List of raw document texts to process."
    )


class BatchEntityResponse(BaseModel):
    """
    Response model for batch document entity extraction.
    """

    success: bool = Field(default=True, description="Operation success flag.")
    results: List[EntityResponse] = Field(
        default_factory=list, description="List of entity extraction responses per document."
    )
