"""
Graph RAG Engine Orchestrator.

High-level application service wrapping GraphRAGWorkflow for processing single queries
and batch RAG requests.
"""

from typing import List, Optional
from app.core.logging import logger
from app.rag.graph_interface import AbstractGraphInterface
from app.rag.langgraph_workflow import GraphRAGWorkflow
from app.schemas.rag import RAGQuery, RAGResponse


class GraphRAGEngine:
    """
    Production-ready Graph RAG Engine integrating vector semantic search,
    Knowledge Graph facts, Gemini generation, and strict citation generation.
    """

    def __init__(self, graph_db: Optional[AbstractGraphInterface] = None) -> None:
        self.workflow: GraphRAGWorkflow = GraphRAGWorkflow(graph_db=graph_db)

    async def query_async(self, rag_query: RAGQuery) -> RAGResponse:
        """
        Asynchronously processes a Graph RAG query.

        Args:
            rag_query: Input RAGQuery payload.

        Returns:
            RAGResponse: Grounded answer, citations, and context.
        """
        logger.info(f"GraphRAGEngine executing query: '{rag_query.query}'")
        return await self.workflow.run_pipeline_async(rag_query)

    async def query_batch_async(self, queries: List[RAGQuery]) -> List[RAGResponse]:
        """
        Asynchronously processes a batch of Graph RAG queries.

        Args:
            queries: List of RAGQuery models.

        Returns:
            List[RAGResponse]: List of RAG Responses.
        """
        logger.info(f"GraphRAGEngine executing batch of {len(queries)} queries.")
        results: List[RAGResponse] = []
        for q in queries:
            res = await self.query_async(q)
            results.append(res)
        return results
