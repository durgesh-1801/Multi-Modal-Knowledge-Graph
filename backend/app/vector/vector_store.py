"""
Vector Store Orchestration Service.

High-level application service uniting ChunkingService, EmbeddingService,
and QdrantClientManager to ingest documents, generate embeddings, store payloads,
and execute semantic vector searches.
"""

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.core.logging import logger
from app.schemas.embeddings import (
    EmbeddingMetadata,
    EmbeddingResponse,
    SearchResult,
    VectorSearchResponse,
)
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import EmbeddingService
from app.vector.qdrant_client import QdrantClientManager


class VectorStoreService:
    """
    High-level Vector Store Service managing document ingestion, vector storage,
    deletion, and metadata-filtered similarity searches.
    """

    def __init__(self) -> None:
        self.chunker: ChunkingService = ChunkingService()
        self.embedder: EmbeddingService = EmbeddingService()
        self.qdrant: QdrantClientManager = QdrantClientManager()
        self.collection_name: str = settings.QDRANT_COLLECTION_NAME

    def process_and_store_document(
        self,
        document_id: str,
        text: str,
        source_type: str = "pdf",
        original_filename: str = "document.pdf",
        page_number: int = 1,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
    ) -> EmbeddingResponse:
        """
        Chunks raw text, generates dense vector embeddings, and stores points in Qdrant.

        Args:
            document_id: Unique document identifier.
            text: Raw input text.
            source_type: Document format (pdf, ocr, audio, table).
            original_filename: Original filename.
            page_number: Page number.
            chunk_size: Chunk size threshold.
            chunk_overlap: Chunk overlap threshold.

        Returns:
            EmbeddingResponse: Status response object.
        """
        start_time = time.time()
        logger.info(f"Processing and storing document vector embeddings for ID '{document_id}'")

        # 1. Segment text into Chunks
        chunks = self.chunker.create_chunks(
            text=text,
            document_id=document_id,
            page_number=page_number,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            extra_metadata={
                "source_type": source_type,
                "original_filename": original_filename,
            },
        )

        if not chunks:
            logger.warning(f"No chunks generated for document '{document_id}'.")
            return EmbeddingResponse(
                success=True,
                document_id=document_id,
                chunks_processed=0,
                embedding_dimension=self.embedder.get_dimension(),
                processing_time_ms=0.0,
            )

        # 2. Generate Dense Embeddings
        chunk_vector_pairs = self.embedder.generate_document_embeddings(chunks)
        vector_dim = self.embedder.get_dimension()

        # 3. Assemble Point IDs, Vectors, and Payloads
        point_ids: List[str] = []
        vectors: List[List[float]] = []
        payloads: List[Dict[str, Any]] = []

        now_iso = datetime.now(timezone.utc).isoformat()

        for chunk, vec in chunk_vector_pairs:
            meta = EmbeddingMetadata(
                document_id=document_id,
                chunk_id=chunk.chunk_id,
                page_number=page_number,
                source_type=source_type,
                original_filename=original_filename,
                timestamp=now_iso,
            )

            point_ids.append(chunk.chunk_id)
            vectors.append(vec)
            payloads.append(
                {
                    **meta.model_dump(),
                    "text": chunk.chunk_text,
                    "char_length": len(chunk.chunk_text),
                }
            )

        # 4. Upsert into Qdrant
        self.qdrant.upsert_vectors(
            collection_name=self.collection_name,
            vectors=vectors,
            payloads=payloads,
            ids=point_ids,
        )

        elapsed_ms = (time.time() - start_time) * 1000.0
        logger.info(
            f"Successfully stored {len(chunks)} vectors for document '{document_id}' in {elapsed_ms:.1f}ms."
        )

        return EmbeddingResponse(
            success=True,
            document_id=document_id,
            chunks_processed=len(chunks),
            embedding_dimension=vector_dim,
            processing_time_ms=round(elapsed_ms, 2),
        )

    def search_semantic(
        self,
        query: str,
        top_k: int = 5,
        document_id: Optional[str] = None,
        source_type: Optional[str] = None,
        page_number: Optional[int] = None,
        score_threshold: Optional[float] = 0.0,
    ) -> VectorSearchResponse:
        """
        Executes dense vector semantic search against Qdrant collection with metadata filtering.

        Args:
            query: Natural language query text.
            top_k: Maximum matches to return.
            document_id: Optional document ID filter.
            source_type: Optional source format filter (pdf, ocr, audio, table).
            page_number: Optional page filter.
            score_threshold: Minimum similarity threshold.

        Returns:
            VectorSearchResponse: Ranked search matches payload.
        """
        start_time = time.time()
        logger.info(f"Executing semantic vector search for query: '{query[:50]}...'")

        # 1. Generate Query Vector Embedding
        query_vector = self.embedder.generate_embedding(query)

        # 2. Execute Qdrant Vector Search
        scored_points = self.qdrant.search_vectors(
            collection_name=self.collection_name,
            query_vector=query_vector,
            top_k=top_k,
            document_id=document_id,
            source_type=source_type,
            page_number=page_number,
            score_threshold=score_threshold,
        )

        # 3. Format Search Results
        results: List[SearchResult] = []
        for pt in scored_points:
            pload = pt.payload or {}
            results.append(
                SearchResult(
                    score=round(float(pt.score), 4),
                    chunk_id=str(pload.get("chunk_id", str(pt.id))),
                    document_id=str(pload.get("document_id", "")),
                    page_number=int(pload.get("page_number", 1)),
                    text=str(pload.get("text", "")),
                    metadata=pload,
                )
            )

        latency_ms = (time.time() - start_time) * 1000.0
        logger.info(f"Semantic search completed in {latency_ms:.1f}ms (Found {len(results)} matches).")

        return VectorSearchResponse(
            success=True,
            query=query,
            results=results,
            total_results=len(results),
            search_latency_ms=round(latency_ms, 2),
        )

    def delete_document_vectors(self, document_id: str) -> bool:
        """Deletes all vector embeddings for a specific document_id."""
        logger.info(f"Deleting document vector embeddings for ID '{document_id}'")
        return self.qdrant.delete_vectors(
            collection_name=self.collection_name, document_id=document_id
        )

    def get_health(self) -> Dict[str, Any]:
        """Checks Qdrant vector store health status."""
        is_healthy = self.qdrant.health_check()
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "qdrant_connected": is_healthy,
            "collection_name": self.collection_name,
            "embedding_model": self.embedder.model_name,
            "embedding_dimension": self.embedder.get_dimension(),
        }
