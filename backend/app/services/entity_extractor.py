"""
Entity Extractor Master Pipeline Service.

Orchestrates the hybrid multi-stage entity extraction architecture:
Stage 1: spaCy NER Extraction
Stage 2: Rule-Based Regex Extraction
Stage 3: Gemini LLM Domain Extraction
Stage 4: Results Merging, Casing Normalization & Abbreviation Expansion
Stage 5: Exact & Fuzzy Similarity Deduplication
"""

import time
from typing import List
from app.core.logging import logger
from app.schemas.entity import Entity, EntityResponse
from app.services.entity_normalizer import EntityNormalizer
from app.services.llm_extractor import LLMEntityExtractor
from app.services.spacy_extractor import SpacyExtractor


class EntityExtractor:
    """
    Unified Master Entity Extractor pipeline executing modular extraction stages.
    """

    def __init__(self) -> None:
        self.spacy_extractor: SpacyExtractor = SpacyExtractor()
        self.rule_normalizer: EntityNormalizer = EntityNormalizer()
        self.gemini_extractor: LLMEntityExtractor = LLMEntityExtractor()

    async def extract_entities_async(
        self,
        text: str,
        enable_spacy: bool = True,
        enable_rules: bool = True,
        enable_gemini: bool = True,
    ) -> EntityResponse:
        """
        Asynchronously executes the full hybrid extraction pipeline.

        Args:
            text: Raw input text to process.
            enable_spacy: Flag to execute spaCy stage.
            enable_rules: Flag to execute Rule-based stage.
            enable_gemini: Flag to execute Gemini stage.

        Returns:
            EntityResponse: Response payload containing normalized, deduplicated entities.
        """
        start_pipeline = time.time()
        logger.info(f"Initiating Entity Extraction Pipeline (Input length: {len(text)} chars)")

        raw_entities: List[Entity] = []

        # Stage 1: spaCy NER Extraction
        if enable_spacy:
            t0 = time.time()
            spacy_entities = self.spacy_extractor.extract(text)
            raw_entities.extend(spacy_entities)
            logger.info(f"Stage 1 (spaCy) finished in {(time.time() - t0)*1000:.1f}ms")

        # Stage 2: Rule-Based Extraction
        if enable_rules:
            t0 = time.time()
            rule_entities = self.rule_normalizer.extract_rules(text)
            raw_entities.extend(rule_entities)
            logger.info(f"Stage 2 (Rule-Based) finished in {(time.time() - t0)*1000:.1f}ms")

        # Stage 3: Gemini LLM Extraction
        if enable_gemini:
            t0 = time.time()
            gemini_entities = await self.gemini_extractor.extract_async(text)
            raw_entities.extend(gemini_entities)
            logger.info(f"Stage 3 (Gemini) finished in {(time.time() - t0)*1000:.1f}ms")

        # Stage 4 & 5: Normalization & Deduplication
        t0 = time.time()
        final_entities = self.rule_normalizer.normalize_and_deduplicate(raw_entities)
        logger.info(f"Stages 4 & 5 (Normalize & Deduplicate) finished in {(time.time() - t0)*1000:.1f}ms")

        elapsed_ms = (time.time() - start_pipeline) * 1000.0
        logger.info(
            f"Entity Extraction Pipeline complete in {elapsed_ms:.1f}ms. Total canonical entities: {len(final_entities)}"
        )

        return EntityResponse(
            success=True,
            entities=final_entities,
            total_entities=len(final_entities),
            processing_time_ms=round(elapsed_ms, 2),
        )

    def extract_entities_sync(
        self,
        text: str,
        enable_spacy: bool = True,
        enable_rules: bool = True,
        enable_gemini: bool = True,
    ) -> EntityResponse:
        """Synchronous wrapper for extract_entities_async."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(
                        asyncio.run,
                        self.extract_entities_async(
                            text, enable_spacy, enable_rules, enable_gemini
                        ),
                    ).result()
            return loop.run_until_complete(
                self.extract_entities_async(
                    text, enable_spacy, enable_rules, enable_gemini
                )
            )
        except Exception:
            return asyncio.run(
                self.extract_entities_async(
                    text, enable_spacy, enable_rules, enable_gemini
                )
            )
