"""
Context Builder Service.

Formats and merges vector text chunks and Knowledge Graph facts into a structured
`Context` payload containing markdown formatted prompt text.
"""

from typing import List
from app.core.logging import logger
from app.schemas.rag import Context, RAGGraphNode, RetrievedChunk


class ContextBuilder:
    """
    Service combining vector text chunks and Knowledge Graph facts into unified prompt context.
    """

    def build_context(
        self, chunks: List[RetrievedChunk], graph_nodes: List[RAGGraphNode]
    ) -> Context:
        """
        Builds a structured Context model with formatted combined_context string.

        Args:
            chunks: Retrieved vector text chunks.
            graph_nodes: Knowledge graph facts/nodes.

        Returns:
            Context: Complete context payload.
        """
        logger.info(
            f"Building combined context from {len(chunks)} vector chunks and {len(graph_nodes)} graph nodes."
        )

        context_lines: List[str] = []

        # 1. Format Vector Text Chunks
        context_lines.append("=== RETRIEVED VECTOR TEXT EVIDENCE ===")
        if chunks:
            for idx, chunk in enumerate(chunks, 1):
                doc_name = chunk.metadata.get("original_filename", chunk.document_id)
                context_lines.append(
                    f"[{idx}] Evidence Chunk (Doc: '{doc_name}', Page: {chunk.page_number}, Score: {chunk.score:.2f}):\n"
                    f"\"{chunk.text}\"\n"
                )
        else:
            context_lines.append("No relevant vector text chunks found in uploaded documents.\n")

        # 2. Format Knowledge Graph Facts
        context_lines.append("=== KNOWLEDGE GRAPH RELATIONSHIPS & FACTS ===")
        if graph_nodes:
            for idx, node in enumerate(graph_nodes, 1):
                props_str = ", ".join([f"{k}: {v}" for k, v in node.properties.items()])
                context_lines.append(
                    f"({idx}) Node '{node.name}' [{node.label}]: {props_str}"
                )
        else:
            context_lines.append("No direct Knowledge Graph facts found.\n")

        combined_str = "\n".join(context_lines)

        converted_graph_nodes: List[RAGGraphNode] = []
        for gn in graph_nodes:
            if isinstance(gn, RAGGraphNode):
                converted_graph_nodes.append(gn)
            else:
                converted_graph_nodes.append(
                    RAGGraphNode(
                        id=getattr(gn, "id", gn.name),
                        name=gn.name,
                        label=getattr(gn, "type", getattr(gn, "label", "Entity")),
                        properties=getattr(gn, "properties", {}),
                    )
                )

        return Context(
            vector_context=chunks,
            graph_context=converted_graph_nodes,
            combined_context=combined_str,
        )
