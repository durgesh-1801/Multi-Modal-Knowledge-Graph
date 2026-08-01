"""
AI Chat Orchestrator Service.

Master AI orchestration service:
1. Receives user query & resolves conversation session.
2. Retrieves conversation history (ConversationManager).
3. Classifies query intent (QueryClassifier).
4. Invokes Graph RAG Engine for grounded vector + graph context retrieval.
5. Formats & deduplicates citations (CitationService).
6. Assembles structured response (ResponseGenerator).
7. Updates conversation history and returns ChatResponse.
"""

import time
from typing import AsyncGenerator, List, Optional
from app.chat.citation_service import CitationService
from app.chat.conversation_manager import ConversationManager
from app.chat.query_classifier import QueryClassifier
from app.chat.response_generator import ResponseGenerator
from app.core.logging import logger
from app.rag.graph_rag import GraphRAGEngine
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.rag import RAGQuery


class ChatService:
    """
    Production-ready AI Chat Orchestrator Service for enterprise compliance guidance.
    """

    def __init__() -> None:
        self.conv_manager: ConversationManager = ConversationManager()
        self.classifier: QueryClassifier = QueryClassifier()
        self.rag_engine: GraphRAGEngine = GraphRAGEngine()
        self.citation_service: CitationService = CitationService()
        self.response_generator: ResponseGenerator = ResponseGenerator()

    async def chat_async(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        session_id: Optional[str] = None,
        top_k: int = 5,
    ) -> ChatResponse:
        """
        Asynchronously processes a user chat query through the full AI orchestration pipeline.

        Args:
            query: Raw user prompt string.
            conversation_id: Optional conversation session ID.
            session_id: Optional user session ID.
            top_k: Top-K vector evidence limit.

        Returns:
            ChatResponse: Grounded conversational answer with citations.
        """
        start_t = time.time()
        logger.info(f"ChatService processing query: '{query[:50]}...'")

        # Step 1: Create or retrieve conversation session
        session = self.conv_manager.create_session(
            conversation_id=conversation_id, session_id=session_id
        )
        cid = session.conversation_id

        # Step 2: Record User Message in Conversation History
        self.conv_manager.add_message(conversation_id=cid, role="user", content=query)

        # Step 3: Retrieve Historical Conversation Context
        history_summary = self.conv_manager.summarize_history(conversation_id=cid)

        # Step 4: Classify Query Intent
        intent_obj = self.classifier.classify(query)
        query_type = intent_obj.intent

        # Step 5: Invoke Graph RAG Engine
        rag_query = RAGQuery(
            query=query,
            top_k=top_k,
            session_id=cid,
        )
        rag_response = await self.rag_engine.query_async(rag_query)

        # Step 6: Process and Format Citations
        citations = self.citation_service.process_citations(
            raw_citations=rag_response.citations, max_citations=5
        )

        # Step 7: Assemble Structured ChatResponse
        response = self.response_generator.generate_response(
            conversation_id=cid,
            query_type=query_type,
            rag_response=rag_response,
            citations=citations,
            start_time=start_t,
        )

        # Step 8: Record Assistant Answer in Conversation History
        self.conv_manager.add_message(
            conversation_id=cid,
            role="assistant",
            content=response.answer,
            metadata={"query_type": query_type, "confidence": response.confidence},
        )

        logger.info(
            f"ChatService finished processing query for conv '{cid}' in {response.processing_time}s"
        )
        return response

    async def chat_batch_async(self, requests: List[ChatRequest]) -> List[ChatResponse]:
        """
        Asynchronously processes a list of ChatRequests in batch.
        """
        logger.info(f"ChatService processing batch of {len(requests)} chat queries.")
        results: List[ChatResponse] = []
        for req in requests:
            res = await self.chat_async(
                query=req.query,
                conversation_id=req.conversation_id,
                session_id=req.session_id,
                top_k=req.top_k,
            )
            results.append(res)
        return results

    async def stream_chat_async(
        self, query: str, conversation_id: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Streaming response generator interface for future Server-Sent Events (SSE) / WebSockets.
        """
        res = await self.chat_async(query=query, conversation_id=conversation_id)
        # Yield answer chunks for streaming
        for word in res.answer.split(" "):
            yield f"{word} "
