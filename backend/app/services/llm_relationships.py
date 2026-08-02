"""
LLM Relationship Extractor Service.

Provides Stage 2 semantic relationship extraction using the LLM Provider Abstraction Layer.
Infers policy responsibilities, compliance dependencies, risk mitigations,
and department ownerships from text and entity context.
"""

import time
from typing import List, Optional

from app.core.llm_provider import BaseLLMProvider, get_llm_provider_instance
from app.core.logging import logger
from app.prompts.relationship_prompt import build_relationship_prompt
from app.schemas.entity import Entity
from app.schemas.relationship import Relationship


class LLMRelationshipExtractor:
    """
    Stage 2 Relationship Extractor leveraging provider-independent LLM for complex semantic link extractions.
    """

    def __init__(self, llm_provider: Optional[BaseLLMProvider] = None) -> None:
        self.llm_provider: BaseLLMProvider = llm_provider or get_llm_provider_instance()

    async def extract_async(self, text: str, entities: List[Entity]) -> List[Relationship]:
        """
        Asynchronously invokes LLM Provider to extract relationships between entities.

        Args:
            text: Input document text.
            entities: Known extracted entities list.

        Returns:
            List[Relationship]: Extracted semantic relationships.
        """
        if not text or not text.strip():
            return []

        logger.info(f"Executing Stage 2: LLM Relationship Extraction via provider '{self.llm_provider.provider_name}'.")

        # Sub-step 1: Prompt Construction
        t_prompt = time.time()
        ent_summary = ", ".join([f"{e.name} ({e.type})" for e in entities[:25]])
        prompt_text = build_relationship_prompt(text[:8000], ent_summary)
        prompt_ms = (time.time() - t_prompt) * 1000.0
        logger.info(f"[PERF] [LLMRelationships] PromptConstruction: {prompt_ms:.2f} ms")

        try:
            sys_instruct = (
                "You are an expert compliance AI. Extract relationships between entities from text into JSON. "
                "Output strictly a JSON object with a key 'relationships' containing a list of objects with "
                "'source', 'target', 'relation', 'confidence', and 'reason'."
            )

            # Sub-step 2: LLM Inference
            t_infer = time.time()
            json_data = await self.llm_provider.generate_json(
                prompt=prompt_text,
                system_prompt=sys_instruct,
                temperature=0.1,
            )
            infer_ms = (time.time() - t_infer) * 1000.0
            logger.info(f"[PERF] [LLMRelationships] ModelInference: {infer_ms:.2f} ms")

            # Sub-step 3: Response Parsing & Modeling
            t_parse = time.time()
            raw_list = json_data.get("relationships", []) if isinstance(json_data, dict) else json_data
            relationships: List[Relationship] = []

            if isinstance(raw_list, list):
                for item in raw_list:
                    if isinstance(item, dict) and "source" in item and "target" in item and "relation" in item:
                        src = str(item["source"]).strip()
                        tgt = str(item["target"]).strip()
                        rel = str(item["relation"]).strip()
                        conf = float(item.get("confidence", 0.95))
                        reason_str = str(item.get("reason", "")).strip()

                        if src and tgt and rel:
                            relationships.append(
                                Relationship(
                                    source=src,
                                    target=tgt,
                                    relation=rel,
                                    confidence=round(conf, 4),
                                    source_engine="LLM",
                                    reason=reason_str if reason_str else None,
                                    metadata={
                                        "llm_model": self.llm_provider.active_model,
                                        "provider": self.llm_provider.provider_name,
                                    },
                                )
                            )

            parse_ms = (time.time() - t_parse) * 1000.0
            logger.info(f"[PERF] [LLMRelationships] ResponseParsing: {parse_ms:.2f} ms ({len(relationships)} rels)")
            logger.info(f"LLM Relationship Extractor extracted {len(relationships)} semantic relationships.")
            return relationships

        except Exception as err:
            logger.error(f"LLM Relationship Extraction failed: {err}")
            return []


# Alias for backward compatibility during transition
GeminiRelationshipExtractor = LLMRelationshipExtractor
