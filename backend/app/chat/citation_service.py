"""
Chat Citation Service.

Formats evidence citations into `ChatCitation` objects, ranks citations by relevance score,
deduplicates redundant evidence chunks, and limits citation counts.
"""

from typing import List
from app.core.logging import logger
from app.schemas.chat import ChatCitation
from app.schemas.rag import Citation


class CitationService:
    """
    Isolated Citation Service formatting, ranking, deduplicating, and capping citations for chat responses.
    """

    def process_citations(
        self, raw_citations: List[Citation], max_citations: int = 5
    ) -> List[ChatCitation]:
        """
        Formats, ranks, deduplicates, and limits raw RAG citations.

        Args:
            raw_citations: List of Citation objects from Graph RAG.
            max_citations: Maximum allowable citations in chat response.

        Returns:
            List[ChatCitation]: Processed chat citations.
        """
        if not raw_citations:
            return []

        logger.info(f"Processing {len(raw_citations)} raw citations for chat output.")

        # 1. Format into ChatCitation objects
        chat_cits: List[ChatCitation] = []
        for c in raw_citations:
            chat_cits.append(
                ChatCitation(
                    document=c.document,
                    page=c.page,
                    snippet=c.snippet,
                    relevance=round(c.score, 4),
                    chunk_id=c.chunk_id,
                )
            )

        # 2. Deduplicate Citations (by chunk_id or document+page+snippet)
        deduped = self.deduplicate_citations(chat_cits)

        # 3. Rank Citations by Relevance Score Descending
        ranked = self.rank_citations(deduped)

        # 4. Limit to Max Citations
        final_cits = ranked[:max_citations]

        logger.info(f"Retained {len(final_cits)} ranked, deduplicated citations.")
        return final_cits

    @staticmethod
    def rank_citations(citations: List[ChatCitation]) -> List[ChatCitation]:
        """Ranks citations by relevance score in descending order."""
        return sorted(citations, key=lambda c: c.relevance, reverse=True)

    @staticmethod
    def deduplicate_citations(citations: List[ChatCitation]) -> List[ChatCitation]:
        """Deduplicates citations matching identical chunk_id or document/page/snippet combination."""
        seen_keys = set()
        unique_cits: List[ChatCitation] = []

        for c in citations:
            key = f"{c.chunk_id}::{c.document}::{c.page}"
            if key not in seen_keys:
                seen_keys.add(key)
                unique_cits.append(c)

        return unique_cits
