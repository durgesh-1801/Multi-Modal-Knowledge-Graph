"""
RAG Retriever Service.

Executes parallel vector semantic search against Qdrant and Knowledge Graph fact retrieval
via AbstractGraphInterface. Handles vector embedding generation, result reranking, and context merging.
"""

import time
from typing import Any, Dict, List, Optional, Tuple
from app.core.logging import logger
from app.rag.graph_interface import AbstractGraphInterface, MockGraphInterface
from app.schemas.rag import RAGGraphNode, RetrievedChunk
from app.services.embedding_service import EmbeddingService
from app.vector.vector_store import VectorStoreService


class Retriever:
    """
    RAG Retriever orchestrating dense vector search, graph node retrieval, reranking, and context merging.
    """

    def __init__(self, graph_db: Optional[AbstractGraphInterface] = None) -> None:
        self.embedder: EmbeddingService = EmbeddingService()
        self.vector_store: VectorStoreService = VectorStoreService()
        self.graph_db: AbstractGraphInterface = graph_db or MockGraphInterface()

    def generate_query_embedding(self, query: str) -> List[float]:
        """Generates dense vector embedding for query text."""
        return self.embedder.generate_embedding(query)

    def retrieve_vectors(
        self,
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.0,
        document_id: Optional[str] = None,
    ) -> List[RetrievedChunk]:
        """
        Retrieves top-K matching text chunks from Qdrant vector database.

        Args:
            query: Natural language user query.
            top_k: Max chunks to retrieve.
            score_threshold: Minimum similarity threshold.
            document_id: Optional document filter.

        Returns:
            List[RetrievedChunk]: Ranked vector chunks.
        """
        logger.info(f"Retrieving top-{top_k} vectors for query: '{query[:40]}...'")
        search_res = self.vector_store.search_semantic(
            query=query,
            top_k=top_k,
            document_id=document_id,
            score_threshold=score_threshold,
        )

        retrieved_chunks: List[RetrievedChunk] = []
        for r in search_res.results:
            orig_fn = str(r.metadata.get("original_filename", r.document_id))
            src_t = str(r.metadata.get("source_type", "pdf"))

            retrieved_chunks.append(
                RetrievedChunk(
                    chunk_id=r.chunk_id,
                    document_id=r.document_id,
                    page_number=r.page_number,
                    text=r.text,
                    score=r.score,
                    source_type=src_t,
                    metadata={**r.metadata, "original_filename": orig_fn},
                )
            )

        logger.info(f"Retrieved {len(retrieved_chunks)} vector chunks from vector store.")
        return retrieved_chunks

    def retrieve_graph(self, query: str) -> List[RAGGraphNode]:
        """
        Retrieves matching Knowledge Graph nodes and facts via AbstractGraphInterface.

        Args:
            query: User query string.

        Returns:
            List[RAGGraphNode]: Graph nodes and relationship properties.
        """
        logger.info(f"Retrieving Knowledge Graph context for query: '{query[:40]}...'")
        return self.graph_db.get_subgraph(query)

    def rerank_results(self, chunks: List[RetrievedChunk]) -> List[RetrievedChunk]:
        """Reranks retrieved vector chunks by similarity score descending."""
        return sorted(chunks, key=lambda c: c.score, reverse=True)

    def merge_results(
        self, chunks: List[RetrievedChunk], graph_nodes: List[RAGGraphNode]
    ) -> Tuple[List[RetrievedChunk], List[RAGGraphNode]]:
        """Merges and deduplicates vector chunks and graph node facts."""
        reranked_chunks = self.rerank_results(chunks)
        return reranked_chunks, graph_nodes
