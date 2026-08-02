"""
RAG Retriever Service with Rank Fusion Reranking.

Executes dense vector semantic search against Qdrant, Knowledge Graph traversal via
AbstractGraphInterface, entity matching, and weighted Rank Fusion scoring:
Fused Score = (Weight_Vector * Vector_Score) + (Weight_Graph * Graph_Score) + (Weight_Entity * Entity_Match_Score)
"""

from typing import Any, Dict, List, Optional, Tuple
from app.core.config import settings
from app.core.logging import logger
from app.rag.graph_interface import AbstractGraphInterface, MockGraphInterface
from app.schemas.graph import GraphNode
from app.schemas.rag import RAGGraphNode, RetrievedChunk
from app.services.embedding_service import EmbeddingService
from app.vector.vector_store import VectorStoreService


from app.dependencies import get_graph_interface


class Retriever:
    """
    RAG Retriever orchestrating dense vector search, graph node traversal, rank fusion reranking, and context merging.
    """

    def __init__(
        self,
        graph_db: Optional[AbstractGraphInterface] = None,
        w_vector: Optional[float] = None,
        w_graph: Optional[float] = None,
        w_entity: Optional[float] = None,
    ) -> None:
        self.embedder: EmbeddingService = EmbeddingService()
        self.vector_store: VectorStoreService = VectorStoreService()
        self.graph_db: AbstractGraphInterface = graph_db if graph_db is not None else get_graph_interface()

        # Configurable Rank Fusion weights
        self.w_vector: float = w_vector if w_vector is not None else settings.RAG_WEIGHT_VECTOR
        self.w_graph: float = w_graph if w_graph is not None else settings.RAG_WEIGHT_GRAPH
        self.w_entity: float = w_entity if w_entity is not None else settings.RAG_WEIGHT_ENTITY

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

    def retrieve_graph(self, query: str, depth: int = 2) -> List[RAGGraphNode]:
        """
        Retrieves matching Knowledge Graph nodes and facts via AbstractGraphInterface.
        """
        logger.info(f"Retrieving Knowledge Graph context for query: '{query[:40]}...' (depth={depth})")
        subgraph_res = self.graph_db.get_subgraph(query, depth=depth)

        rag_nodes: List[RAGGraphNode] = []
        # Convert SubgraphResponse nodes or List[RAGGraphNode]
        nodes_input = subgraph_res.nodes if hasattr(subgraph_res, "nodes") else subgraph_res

        for n in nodes_input:
            if isinstance(n, RAGGraphNode):
                rag_nodes.append(n)
            elif isinstance(n, GraphNode):
                rag_nodes.append(
                    RAGGraphNode(
                        id=n.id,
                        name=n.name,
                        label=n.type,
                        properties={
                            "aliases": n.aliases,
                            "source_documents": n.source_documents,
                            "page_numbers": n.page_numbers,
                            "confidence": n.confidence,
                            **n.properties,
                        },
                    )
                )
        return rag_nodes

    def _compute_entity_match_score(self, text: str, query: str) -> float:
        """Computes query entity token overlap score (0.0 to 1.0)."""
        query_terms = set(query.lower().split())
        if not query_terms:
            return 0.0
        text_lower = text.lower()
        matches = sum(1 for term in query_terms if term in text_lower)
        return round(matches / len(query_terms), 4)

    def rank_fusion(
        self,
        chunks: List[RetrievedChunk],
        graph_nodes: List[RAGGraphNode],
        query: str,
    ) -> List[RetrievedChunk]:
        """
        Applies weighted Rank Fusion scoring across retrieved vector chunks:
        Fused Score = (w_vector * vector_score) + (w_graph * graph_score) + (w_entity * entity_match_score)
        """
        # Map graph entity names to calculate graph relevance boost per chunk
        graph_entity_names = {gn.name.lower() for gn in graph_nodes}

        fused_chunks: List[RetrievedChunk] = []
        for chunk in chunks:
            vector_score = min(max(chunk.score, 0.0), 1.0)

            # Compute graph traversal connectivity score for this chunk
            chunk_text_low = chunk.text.lower()
            graph_matches = sum(1 for en in graph_entity_names if en in chunk_text_low)
            graph_score = min(graph_matches / max(len(graph_entity_names), 1), 1.0)

            # Compute entity match score
            entity_score = self._compute_entity_match_score(chunk.text, query)

            # Weighted Rank Fusion
            fused_score = (
                (self.w_vector * vector_score)
                + (self.w_graph * graph_score)
                + (self.w_entity * entity_score)
            )

            # Update score and store breakdown in metadata
            chunk.score = round(fused_score, 4)
            chunk.metadata["fusion_breakdown"] = {
                "vector_score": vector_score,
                "graph_score": graph_score,
                "entity_score": entity_score,
                "weights": {
                    "vector": self.w_vector,
                    "graph": self.w_graph,
                    "entity": self.w_entity,
                },
            }
            fused_chunks.append(chunk)

        # Sort descending by fused score
        return sorted(fused_chunks, key=lambda c: c.score, reverse=True)

    def rerank_results(self, chunks: List[RetrievedChunk]) -> List[RetrievedChunk]:
        """Legacy helper function for backwards compatibility."""
        return sorted(chunks, key=lambda c: c.score, reverse=True)

    def merge_results(
        self,
        chunks: List[RetrievedChunk],
        graph_nodes: List[RAGGraphNode],
        query: Optional[str] = None,
    ) -> Tuple[List[RetrievedChunk], List[RAGGraphNode]]:
        """Merges vector chunks and graph nodes, applying Rank Fusion if query is provided."""
        if query:
            reranked_chunks = self.rank_fusion(chunks, graph_nodes, query)
        else:
            reranked_chunks = self.rerank_results(chunks)
        return reranked_chunks, graph_nodes
