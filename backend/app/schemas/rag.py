"""
Graph RAG Engine Pydantic Schemas.

Defines Pydantic models for citations, retrieved text chunks, graph nodes, combined context,
RAG queries, single-query responses, and batch RAG requests/responses.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class Citation(BaseModel):
    """
    Supporting evidence citation extracted from top-K vector chunks.
    """

    document: str = Field(..., description="Original document filename.")
    page: int = Field(default=1, ge=1, description="Page number of evidence.")
    chunk_id: str = Field(..., description="Unique chunk identifier.")
    snippet: str = Field(..., description="Cleaned evidence text snippet.")
    score: float = Field(..., ge=0.0, le=1.0, description="Relevance score of evidence.")
    source_type: str = Field(
        default="pdf", description="Format type (pdf, ocr, audio, table)."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "document": "ISO27001_Policy.pdf",
                "page": 8,
                "chunk_id": "doc_iso_chk_0",
                "snippet": "Access control policies must mandate MFA across admin sessions...",
                "score": 0.94,
                "source_type": "pdf",
            }
        }
    }


class RetrievedChunk(BaseModel):
    """
    Text chunk retrieved from vector database search.
    """

    chunk_id: str = Field(..., description="Unique chunk ID.")
    document_id: str = Field(..., description="Document ID.")
    page_number: int = Field(default=1, description="Page number.")
    text: str = Field(..., description="Chunk text content.")
    score: float = Field(..., description="Vector similarity score.")
    source_type: str = Field(default="pdf", description="Source format.")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Associated chunk metadata."
    )


class RAGGraphNode(BaseModel):
    """
    Graph node fact retrieved from Knowledge Graph interface.
    """

    id: str = Field(..., description="Node ID.")
    name: str = Field(..., description="Entity name.")
    label: str = Field(..., description="Entity type/label.")
    properties: Dict[str, Any] = Field(
        default_factory=dict, description="Entity properties and relationships."
    )


class Context(BaseModel):
    """
    Unified context payload merging vector chunks and knowledge graph facts.
    """

    vector_context: List[RetrievedChunk] = Field(
        default_factory=list, description="Top-K vector chunks retrieved from Qdrant."
    )
    graph_context: List[RAGGraphNode] = Field(
        default_factory=list, description="Knowledge graph entity nodes and facts."
    )
    combined_context: str = Field(
        ..., description="Formatted markdown context string fed into LLM prompt."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "vector_context": [],
                "graph_context": [],
                "combined_context": "=== VECTOR CHUNKS ===\n...",
            }
        }
    }


class RAGQuery(BaseModel):
    """
    Input query model for Graph RAG processing.
    """

    query: str = Field(
        ..., min_length=1, description="User question or query regarding compliance."
    )
    top_k: int = Field(
        default=5, ge=1, le=50, description="Number of vector chunks to retrieve."
    )
    score_threshold: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Minimum similarity score filter."
    )
    document_id: Optional[str] = Field(
        default=None, description="Optional document ID filter."
    )
    session_id: Optional[str] = Field(
        default=None, description="Optional conversation session ID for multi-turn support."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "What controls are required for ISO 27001?",
                "top_k": 5,
                "score_threshold": 0.5,
                "session_id": "session_123",
            }
        }
    }


class RAGResponse(BaseModel):
    """
    Response model returned by Graph RAG Engine POST /rag/query.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    query: str = Field(..., description="Original user query.")
    answer: str = Field(..., description="Grounded LLM generated answer.")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Overall answer confidence score."
    )
    citations: List[Citation] = Field(
        default_factory=list, description="List of supporting evidence citations."
    )
    context: Context = Field(..., description="Retrieved vector and graph context payload.")
    processing_time_ms: float = Field(
        ..., description="Total execution latency in milliseconds."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "query": "What controls are required for ISO 27001?",
                "answer": "ISO 27001 requires an Access Control Policy [Citation: ISO27001.pdf, Page 8]...",
                "confidence": 0.95,
                "citations": [
                    {
                        "document": "ISO27001.pdf",
                        "page": 8,
                        "chunk_id": "doc_iso_chk_0",
                        "snippet": "Access control policies...",
                        "score": 0.94,
                        "source_type": "pdf",
                    }
                ],
                "processing_time_ms": 320.5,
            }
        }
    }


class BatchRAGRequest(BaseModel):
    """
    Payload for submitting multiple RAG queries in batch.
    """

    queries: List[RAGQuery] = Field(
        ..., min_length=1, description="List of RAG queries to process."
    )


class BatchRAGResponse(BaseModel):
    """
    Response model for batch RAG queries.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    results: List[RAGResponse] = Field(
        default_factory=list, description="List of RAG responses per query."
    )
