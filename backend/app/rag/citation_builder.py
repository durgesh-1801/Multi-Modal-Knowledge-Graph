"""
Citation Builder Service.

Generates structured, evidence-backed `Citation` objects from top-K retrieved vector text chunks.
"""

from typing import List
from app.core.logging import logger
from app.schemas.rag import Citation, RetrievedChunk


class CitationBuilder:
    """
    Service extracting supporting evidence citations from retrieved chunks.
    """

    def build_citations(self, chunks: List[RetrievedChunk]) -> List[Citation]:
        """
        Generates structured Citation objects from retrieved vector chunks.

        Args:
            chunks: Top-K retrieved vector text chunks.

        Returns:
            List[Citation]: Evidence citations with snippets and scores.
        """
        logger.info(f"Generating citations from {len(chunks)} evidence chunks.")
        citations: List[Citation] = []

        for chunk in chunks:
            doc_name = str(chunk.metadata.get("original_filename", chunk.document_id))
            snippet_str = chunk.text[:180] + "..." if len(chunk.text) > 180 else chunk.text

            citations.append(
                Citation(
                    document=doc_name,
                    page=chunk.page_number,
                    chunk_id=chunk.chunk_id,
                    snippet=snippet_str,
                    score=round(chunk.score, 4),
                    source_type=chunk.source_type,
                )
            )

        return citations
