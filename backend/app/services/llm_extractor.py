"""
LLM Domain Entity Extractor Service.

Provides Stage 3 domain-specific compliance entity extraction using the LLM Provider Abstraction Layer.
Identifies Business Risks, Compliance Controls, Policy Statements, Security Requirements,
Audit Findings, and Mitigation Measures.
"""

from typing import List, Optional

from app.core.llm_provider import BaseLLMProvider, get_llm_provider_instance
from app.core.logging import logger
from app.prompts.entity_prompt import build_entity_prompt
from app.schemas.entity import Entity


class LLMEntityExtractor:
    """
    Stage 3 Extractor leveraging provider-independent LLM for high-precision compliance entity extractions.
    """

    def __init__(self, llm_provider: Optional[BaseLLMProvider] = None) -> None:
        self.llm_provider: BaseLLMProvider = llm_provider or get_llm_provider_instance()

    async def extract_async(self, text: str) -> List[Entity]:
        """
        Asynchronously invokes active LLM Provider to extract compliance entities.

        Args:
            text: Raw input document text.

        Returns:
            List[Entity]: Extracted entities from LLM.
        """
        if not text or not text.strip():
            return []

        logger.info(f"Executing Stage 3: LLM Domain Entity Extraction via provider '{self.llm_provider.provider_name}'.")
        prompt_text = build_entity_prompt(text[:8000])

        try:
            sys_instruct = (
                "You are an expert compliance AI. Extract domain entities from text into JSON. "
                "Output strictly a JSON object with a key 'entities' containing a list of objects with "
                "'name', 'type', 'confidence', and 'description'."
            )
            json_data = await self.llm_provider.generate_json(
                prompt=prompt_text,
                system_prompt=sys_instruct,
                temperature=0.1,
            )

            raw_list = json_data.get("entities", []) if isinstance(json_data, dict) else json_data
            extracted_entities: List[Entity] = []

            if isinstance(raw_list, list):
                for item in raw_list:
                    if isinstance(item, dict) and "name" in item and "type" in item:
                        name = str(item["name"]).strip()
                        ent_type = str(item["type"]).strip()
                        conf = float(item.get("confidence", 0.95))
                        desc = str(item.get("description", "")).strip()

                        if name:
                            extracted_entities.append(
                                Entity(
                                    name=name,
                                    type=ent_type,
                                    confidence=round(conf, 4),
                                    source="LLM",
                                    description=desc,
                                    metadata={
                                        "llm_model": self.llm_provider.active_model,
                                        "provider": self.llm_provider.provider_name,
                                    },
                                )
                            )

            logger.info(f"LLM Extractor extracted {len(extracted_entities)} domain entities.")
            return extracted_entities

        except Exception as err:
            logger.error(f"LLM Entity Extraction failed: {err}")
            return []

    def extract_sync(self, text: str) -> List[Entity]:
        """Synchronous wrapper for extract_async."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, self.extract_async(text)).result()
            return loop.run_until_complete(self.extract_async(text))
        except Exception:
            return asyncio.run(self.extract_async(text))


# Alias for backward compatibility during transition
GeminiExtractor = LLMEntityExtractor
