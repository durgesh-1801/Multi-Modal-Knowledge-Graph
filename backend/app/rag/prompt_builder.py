"""
RAG Prompt Builder Service.

Assembles prompt payloads combining user query, combined context, and system rules.
"""

from app.core.logging import logger
from app.prompts.rag_prompt import build_rag_prompt
from app.schemas.rag import Context


class PromptBuilder:
    """
    Prompt Builder service formatting prompt text for Gemini LLM.
    """

    def build(self, query: str, context: Context) -> str:
        """
        Constructs full Gemini prompt text.

        Args:
            query: Raw user question.
            context: Context model containing combined_context.

        Returns:
            str: Fully formatted prompt text.
        """
        logger.info(f"Building LLM RAG prompt for query: '{query[:40]}...'")
        return build_rag_prompt(query=query, combined_context=context.combined_context)
