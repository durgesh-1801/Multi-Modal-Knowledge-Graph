"""
LangGraph Workflow State Machine for Graph RAG.

Provides a modular, state-driven workflow orchestration executing discrete Graph RAG nodes:
1. Embed Query
2. Retrieve Vector Context (Qdrant)
3. Retrieve Graph Context (AbstractGraphInterface)
4. Merge Context (ContextBuilder)
5. Build Prompt (PromptBuilder)
6. Generate Answer (Gemini LLM)
7. Generate Citations (CitationBuilder)
8. Assemble Final RAGResponse
"""

import time
from typing import Any, Dict, List, Optional, TypedDict
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.rag.citation_builder import CitationBuilder
from app.rag.context_builder import ContextBuilder
from app.rag.graph_interface import AbstractGraphInterface, MockGraphInterface
from app.rag.prompt_builder import PromptBuilder
from app.rag.retriever import Retriever
from app.schemas.rag import (
    Citation,
    Context,
    RAGGraphNode,
    RAGQuery,
    RAGResponse,
    RetrievedChunk,
)


class RAGState(TypedDict, total=False):
    """
    State container passed through the LangGraph RAG workflow nodes.
    """

    query: str
    query_embedding: List[float]
    top_k: int
    score_threshold: float
    document_id: Optional[str]
    vector_chunks: List[RetrievedChunk]
    graph_nodes: List[RAGGraphNode]
    context: Optional[Context]
    prompt_text: str
    llm_answer: str
    confidence: float
    citations: List[Citation]
    response: Optional[RAGResponse]
    start_time: float


from app.core.llm_provider import BaseLLMProvider, get_llm_provider_instance


class GraphRAGWorkflow:
    """
    Modular LangGraph Workflow for executing state-based Graph RAG pipelines.
    """

    def __init__(
        self,
        graph_db: Optional[AbstractGraphInterface] = None,
        llm_provider: Optional[BaseLLMProvider] = None,
    ) -> None:
        self.retriever: Retriever = Retriever(graph_db=graph_db)
        self.context_builder: ContextBuilder = ContextBuilder()
        self.prompt_builder: PromptBuilder = PromptBuilder()
        self.citation_builder: CitationBuilder = CitationBuilder()
        self.llm_provider: BaseLLMProvider = llm_provider or get_llm_provider_instance()

    async def run_pipeline_async(self, rag_query: RAGQuery) -> RAGResponse:
        """
        Asynchronously executes the Graph RAG state machine nodes sequentially.
        """
        start_t = time.time()
        logger.info(f"Starting Graph RAG Workflow for query: '{rag_query.query}'")

        state: RAGState = {
            "query": rag_query.query,
            "top_k": rag_query.top_k,
            "score_threshold": rag_query.score_threshold,
            "document_id": rag_query.document_id,
            "start_time": start_t,
        }

        # 1. Embed Query Node
        state = self.node_embed_query(state)

        # 2. Parallel Vector & Graph Retrieval Nodes
        state = self.node_retrieve_vectors(state)
        state = self.node_retrieve_graph(state)

        # 3. Merge Context Node
        state = self.node_merge_context(state)

        # 4. Build Prompt Node
        state = self.node_build_prompt(state)

        # 5. Generate Answer Node (Provider-Agnostic LLM)
        state = await self.node_generate_answer(state)

        # 6. Generate Citations Node
        state = self.node_generate_citations(state)

        # 7. Assemble Response Node
        return self.node_assemble_response(state)

    def node_embed_query(self, state: RAGState) -> RAGState:
        """Node 1: Generates query vector embedding."""
        state["query_embedding"] = self.retriever.generate_query_embedding(state["query"])
        return state

    def node_retrieve_vectors(self, state: RAGState) -> RAGState:
        """Node 2: Retrieves vector chunks from Qdrant."""
        state["vector_chunks"] = self.retriever.retrieve_vectors(
            query=state["query"],
            top_k=state["top_k"],
            score_threshold=state["score_threshold"],
            document_id=state.get("document_id"),
        )
        return state

    def node_retrieve_graph(self, state: RAGState) -> RAGState:
        """Node 3: Retrieves Knowledge Graph facts via AbstractGraphInterface."""
        state["graph_nodes"] = self.retriever.retrieve_graph(state["query"])
        return state

    def node_merge_context(self, state: RAGState) -> RAGState:
        """Node 4: Merges vector chunks & graph facts into structured Context."""
        chunks, nodes = self.retriever.merge_results(
            state.get("vector_chunks", []), state.get("graph_nodes", [])
        )
        state["context"] = self.context_builder.build_context(chunks, nodes)
        return state

    def node_build_prompt(self, state: RAGState) -> RAGState:
        """Node 5: Assembles full LLM RAG prompt."""
        context_obj = state["context"]
        state["prompt_text"] = self.prompt_builder.build(state["query"], context_obj)
        return state

    async def node_generate_answer(self, state: RAGState) -> RAGState:
        """Node 6: Generates grounded LLM answer via BaseLLMProvider."""
        prompt_text = state["prompt_text"]
        chunks = state.get("vector_chunks", [])

        # Check if evidence is insufficient
        if not chunks and not state.get("graph_nodes"):
            state["llm_answer"] = "I couldn't find sufficient evidence in the uploaded documents."
            state["confidence"] = 0.0
            return state

        answer = ""
        conf = 0.95

        try:
            sys_instruct = "You are an enterprise compliance AI. Generate grounded, factual answers based strictly on the provided context."
            llm_resp = await self.llm_provider.generate(
                prompt=prompt_text,
                system_prompt=sys_instruct,
                temperature=0.1,
            )
            answer = llm_resp.text
        except Exception as err:
            logger.warning(f"LLM Provider answer generation error in RAG: {err}")

        # Fallback for dev mode when API key is unconfigured or returns empty
        if not answer:
            logger.info("Generating grounded contextual answer fallback.")
            if chunks:
                top_chunk = chunks[0]
                answer = (
                    f"Based on the uploaded document '{top_chunk.metadata.get('original_filename', top_chunk.document_id)}' "
                    f"(Page {top_chunk.page_number}), the evidence indicates: {top_chunk.text}"
                )
                conf = round(float(top_chunk.score), 2)
            else:
                answer = "I couldn't find sufficient evidence in the uploaded documents."
                conf = 0.0

        state["llm_answer"] = answer
        state["confidence"] = conf
        return state

    def node_generate_citations(self, state: RAGState) -> RAGState:
        """Node 7: Extracts structured citations from retrieved chunks."""
        chunks = state.get("vector_chunks", [])
        state["citations"] = self.citation_builder.build_citations(chunks)
        return state

    def node_assemble_response(self, state: RAGState) -> RAGResponse:
        """Node 8: Assembles final RAGResponse object."""
        elapsed_ms = (time.time() - state["start_time"]) * 1000.0
        return RAGResponse(
            success=True,
            query=state["query"],
            answer=state["llm_answer"],
            confidence=state["confidence"],
            citations=state.get("citations", []),
            context=state["context"],
            processing_time_ms=round(elapsed_ms, 2),
        )

