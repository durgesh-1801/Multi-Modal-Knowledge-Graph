"""
Relationship Extraction Pydantic Schemas.

Defines Pydantic models for extracted graph relationships, Neo4j-ready graph nodes,
graph payloads, extraction requests, single-document response envelopes, and batch requests.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.entity import Entity


class Relationship(BaseModel):
    """
    Graph relationship edge connecting a source entity to a target entity.
    """

    source: str = Field(..., description="Source entity name.")
    target: str = Field(..., description="Target entity name.")
    relation: str = Field(
        ...,
        description=(
            "Normalized relationship type (e.g. requires, implements, implemented_by, "
            "belongs_to, owned_by, managed_by, governed_by, mitigated_by, references)."
        ),
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence score of relationship extraction."
    )
    source_engine: str = Field(
        ..., description="Extraction component origin (e.g. 'Rule-Based', 'Gemini', or 'Rule-Based+Gemini')."
    )
    reason: Optional[str] = Field(
        default=None, description="Optional explanation or reasoning for the relationship."
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional contextual metadata for the edge."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "source": "ISO 27001",
                "target": "Access Control Policy",
                "relation": "requires",
                "confidence": 0.98,
                "source_engine": "Rule-Based",
                "reason": "ISO 27001 mandates access control policies.",
            }
        }
    }


class GraphNode(BaseModel):
    """
    Neo4j graph-ready node entity representation.
    """

    id: str = Field(..., description="Unique node identifier string.")
    name: str = Field(..., description="Display name of the node.")
    label: str = Field(..., description="Primary node label/category (e.g. Regulation, Policy, Control).")
    properties: Dict[str, Any] = Field(
        default_factory=dict, description="Node property key-value map for Graph DB insertion."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "iso_27001",
                "name": "ISO 27001",
                "label": "Standard",
                "properties": {"confidence": 0.98, "source": "Rule-Based"},
            }
        }
    }


class GraphPayload(BaseModel):
    """
    Graph-ready payload structure containing nodes and relationship edges.
    """

    nodes: List[GraphNode] = Field(
        default_factory=list, description="List of unique graph nodes."
    )
    relationships: List[Relationship] = Field(
        default_factory=list, description="List of directed relationship edges."
    )


class RelationshipRequest(BaseModel):
    """
    Request payload for extracting relationships from text and entities.
    """

    text: str = Field(
        ..., min_length=1, description="Raw input document text to analyze for relationships."
    )
    entities: Optional[List[Entity]] = Field(
        default=None,
        description="Optional list of previously extracted entities. If omitted, entities are extracted automatically.",
    )
    enable_rules: bool = Field(
        default=True, description="Toggle Rule-based relationship extraction stage."
    )
    enable_gemini: bool = Field(
        default=True, description="Toggle Gemini LLM semantic relationship extraction stage."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "ISO 27001 requires an Access Control Policy which is implemented by the IT Department.",
                "entities": None,
                "enable_rules": True,
                "enable_gemini": True,
            }
        }
    }


class RelationshipResponse(BaseModel):
    """
    Response payload for single document relationship extraction POST /extract/relationships.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    nodes: List[GraphNode] = Field(
        default_factory=list, description="List of unique graph nodes created."
    )
    relationships: List[Relationship] = Field(
        default_factory=list, description="List of extracted, normalized, deduplicated relationships."
    )
    total_relationships: int = Field(default=0, description="Total count of unique relationships.")
    processing_time_ms: float = Field(
        ..., description="Total execution duration of pipeline in milliseconds."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "nodes": [
                    {"id": "iso_27001", "name": "ISO 27001", "label": "Standard"}
                ],
                "relationships": [
                    {
                        "source": "ISO 27001",
                        "target": "Access Control Policy",
                        "relation": "requires",
                        "confidence": 0.98,
                        "source_engine": "Rule-Based",
                    }
                ],
                "total_relationships": 1,
                "processing_time_ms": 110.5,
            }
        }
    }


class BatchRelationshipRequest(BaseModel):
    """
    Payload for submitting multiple document requests for batch relationship extraction.
    """

    documents: List[RelationshipRequest] = Field(
        ..., min_length=1, description="List of relationship extraction requests."
    )


class BatchRelationshipResponse(BaseModel):
    """
    Response payload for batch relationship extraction.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    results: List[RelationshipResponse] = Field(
        default_factory=list, description="List of relationship responses per document."
    )
