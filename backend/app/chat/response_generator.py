"""
Chat Response Generator Service.

Assembles structured `ChatResponse` objects combining LLM generated answers,
intent classifications, processing timing metrics, related entities extracted from context,
and formatted evidence citations.
"""

import time
from typing import List, Optional
from app.core.logging import logger
from app.schemas.chat import ChatCitation, ChatResponse
from app.schemas.rag import RAGResponse


class ResponseGenerator:
    """
    Response Generator service structuring chat responses and extracting related entities.
    """

    def generate_response(
        self,
        conversation_id: str,
        query_type: str,
        rag_response: RAGResponse,
        citations: List[ChatCitation],
        start_time: float,
    ) -> ChatResponse:
        """
        Assembles complete ChatResponse object.

        Args:
            conversation_id: Active conversation session ID.
            query_type: Intent category string (e.g. policy_lookup).
            rag_response: Response output from Graph RAG Engine.
            citations: Processed chat citations.
            start_time: Execution start timestamp in seconds.

        Returns:
            ChatResponse: Structured output model.
        """
        elapsed_sec = round(time.time() - start_time, 2)
        logger.info(
            f"Generating ChatResponse for conv '{conversation_id}' (QueryType: '{query_type}', Latency: {elapsed_sec}s)"
        )

        # Extract related entity names from retrieved Graph RAG context
        related_entities: List[str] = self.extract_related_entities(rag_response)

        return ChatResponse(
            success=rag_response.success,
            conversation_id=conversation_id,
            query_type=query_type,
            answer=rag_response.answer,
            confidence=round(rag_response.confidence, 4),
            processing_time=elapsed_sec,
            related_entities=related_entities,
            citations=citations,
        )

    @staticmethod
    def extract_related_entities(rag_response: RAGResponse) -> List[str]:
        """Extracts unique entity names present in Knowledge Graph context nodes."""
        entities = set()
        if rag_response.context and rag_response.context.graph_context:
            for node in rag_response.context.graph_context:
                if node.name:
                    entities.add(node.name)
        return list(entities)
