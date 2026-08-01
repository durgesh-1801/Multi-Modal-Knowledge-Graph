"""
Embeddings & Vector Database Schemas.

Defines Pydantic models for text chunks, embedding metadata payloads, search results,
document vector embedding requests/responses, and semantic vector search payloads.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class Chunk(BaseModel):
    """
    Extracted text chunk payload with position metadata.
    """

    chunk_id: str = Field(..., description="Unique chunk identifier.")
    document_id: str = Field(..., description="Associated document identifier.")
    page_number: int = Field(default=1, ge=1, description="1-indexed page number.")
    chunk_index: int = Field(default=0, ge=0, description="0-indexed chunk sequence position.")
    chunk_text: str = Field(..., description="Raw text content of the chunk.")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Custom chunk metadata."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "chunk_id": "doc_123_chk_0",
                "document_id": "doc_123",
                "page_number": 4,
                "chunk_index": 0,
                "chunk_text": "Access control policies must mandate 2FA across all administrative sessions...",
                "metadata": {"source_type": "pdf", "original_filename": "policy_2026.pdf"},
            }
        }
    }


class EmbeddingMetadata(BaseModel):
    """
    Metadata payload attached to each vector stored inside Qdrant.
    """

    document_id: str = Field(..., description="Unique document ID.")
    chunk_id: str = Field(..., description="Unique chunk ID.")
    page_number: int = Field(default=1, description="Page number of the chunk.")
    chunk_index: int = Field(default=0, description="0-indexed chunk sequence number.")
    source_type: str = Field(
        default="pdf", description="Source document format (e.g. pdf, ocr, audio, table)."
    )
    original_filename: str = Field(..., description="Original filename.")
    entity_ids: List[str] = Field(
        default_factory=list, description="Optional linked entity identifiers."
    )
    relationship_ids: List[str] = Field(
        default_factory=list, description="Optional linked relationship identifiers."
    )
    timestamp: str = Field(..., description="ISO 8601 creation timestamp.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "document_id": "doc_123",
                "chunk_id": "doc_123_chk_0",
                "page_number": 4,
                "source_type": "pdf",
                "original_filename": "compliance_policy.pdf",
                "entity_ids": ["ent_iso27001"],
                "relationship_ids": ["rel_req_01"],
                "timestamp": "2026-08-01T12:00:00Z",
            }
        }
    }


class SearchResult(BaseModel):
    """
    Individual semantic vector search result.
    """

    score: float = Field(..., ge=-1.0, le=1.0, description="Cosine similarity score.")
    chunk_id: str = Field(..., description="Matching chunk ID.")
    document_id: str = Field(..., description="Associated document ID.")
    page_number: int = Field(default=1, description="Page number.")
    text: str = Field(..., description="Retrieved chunk text content.")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Retrieved vector metadata."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "score": 0.94,
                "chunk_id": "doc_123_chk_0",
                "document_id": "doc_123",
                "page_number": 4,
                "text": "Access control policies must mandate 2FA...",
                "metadata": {"source_type": "pdf", "original_filename": "policy_2026.pdf"},
            }
        }
    }


class EmbeddingRequest(BaseModel):
    """
    Request payload for chunking, embedding, and storing a document in Qdrant.
    """

    document_id: str = Field(..., description="Unique document ID string.")
    text: str = Field(..., min_length=1, description="Raw document text content to embed.")
    source_type: str = Field(
        default="pdf", description="Source type identifier (pdf, ocr, audio, table)."
    )
    original_filename: str = Field(
        default="document.pdf", description="Original filename."
    )
    page_number: int = Field(default=1, ge=1, description="Page number.")
    chunk_size: int = Field(
        default=500, ge=50, description="Target chunk size in characters/tokens."
    )
    chunk_overlap: int = Field(
        default=50, ge=0, description="Chunk overlap in characters/tokens."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "document_id": "doc_compliance_99",
                "text": "Enterprise Security Policy Section 1: All personnel must complete mandatory training...",
                "source_type": "pdf",
                "original_filename": "security_policy.pdf",
                "page_number": 1,
                "chunk_size": 500,
                "chunk_overlap": 50,
            }
        }
    }


class EmbeddingResponse(BaseModel):
    """
    Response model for document embedding generation POST /embeddings/document.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    document_id: str = Field(..., description="Document ID processed.")
    chunks_processed: int = Field(..., description="Total count of text chunks created and stored.")
    embedding_dimension: int = Field(..., description="Vector embedding dimension (e.g. 1024 or 384).")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "document_id": "doc_compliance_99",
                "chunks_processed": 5,
                "embedding_dimension": 1024,
                "processing_time_ms": 230.5,
            }
        }
    }


class VectorSearchRequest(BaseModel):
    """
    Request payload for semantic vector search POST /embeddings/search.
    """

    query: str = Field(
        ..., min_length=1, description="Natural language search query."
    )
    top_k: int = Field(
        default=5, ge=1, le=100, description="Top-K maximum results to return."
    )
    document_id: Optional[str] = Field(
        default=None, description="Optional document ID filter."
    )
    source_type: Optional[str] = Field(
        default=None, description="Optional source type filter (pdf, ocr, audio, table)."
    )
    page_number: Optional[int] = Field(
        default=None, description="Optional page number filter."
    )
    score_threshold: Optional[float] = Field(
        default=0.0, ge=0.0, le=1.0, description="Minimum similarity score threshold."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "What policies relate to encryption and access control?",
                "top_k": 5,
                "source_type": "pdf",
                "score_threshold": 0.50,
            }
        }
    }


class VectorSearchResponse(BaseModel):
    """
    Response payload for semantic vector search.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    query: str = Field(..., description="Original search query string.")
    results: List[SearchResult] = Field(
        default_factory=list, description="List of top-K matching search results."
    )
    total_results: int = Field(default=0, description="Count of results returned.")
    search_latency_ms: float = Field(..., description="Search execution latency in milliseconds.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "query": "What policies relate to encryption?",
                "results": [
                    {
                        "score": 0.94,
                        "chunk_id": "doc_123_chk_0",
                        "document_id": "doc_123",
                        "page_number": 4,
                        "text": "Encryption Policy mandates AES-256...",
                    }
                ],
                "total_results": 1,
                "search_latency_ms": 15.2,
            }
        }
    }
