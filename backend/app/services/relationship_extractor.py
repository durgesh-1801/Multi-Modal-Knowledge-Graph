"""
Relationship Extractor Master Pipeline Service.

Orchestrates the hybrid multi-stage relationship extraction architecture:
1. Entity Resolution (autonomously extracts entities via EntityExtractor if omitted)
2. Rule-Based Relationship Extraction (sentence boundary & verbal pattern matching)
3. Gemini LLM Semantic Relationship Extraction
4. Results Merging & Relation Type Normalization
5. Edge Deduplication & Neo4j Graph-Ready Payload Assembly
"""

import time
from typing import List, Optional
from app.core.logging import logger
from app.schemas.entity import Entity
from app.schemas.relationship import Relationship, RelationshipResponse
from app.services.entity_extractor import EntityExtractor
from app.services.gemini_relationships import GeminiRelationshipExtractor
from app.services.relationship_normalizer import RelationshipNormalizer
from app.services.rule_relationships import RuleRelationshipExtractor


class RelationshipExtractor:
    """
    Unified Master Relationship Extractor pipeline converting compliance text and entities
    into graph-ready JSON payloads for Neo4j Knowledge Graph ingestion.
    """

    def __init__(self) -> None:
        self.entity_extractor: EntityExtractor = EntityExtractor()
        self.rule_extractor: RuleRelationshipExtractor = RuleRelationshipExtractor()
        self.gemini_extractor: GeminiRelationshipExtractor = GeminiRelationshipExtractor()
        self.normalizer: RelationshipNormalizer = RelationshipNormalizer()

    async def extract_relationships_async(
        self,
        text: str,
        entities: Optional[List[Entity]] = None,
        enable_rules: bool = True,
        enable_gemini: bool = True,
    ) -> RelationshipResponse:
        """
        Asynchronously executes the complete relationship extraction pipeline.

        Args:
            text: Raw input document text.
            entities: Optional list of pre-extracted entities.
            enable_rules: Flag to toggle Rule-based extraction stage.
            enable_gemini: Flag to toggle Gemini LLM extraction stage.

        Returns:
            RelationshipResponse: Graph-ready response containing nodes and relationships.
        """
        start_pipeline = time.time()
        logger.info(
            f"Initiating Relationship Extraction Pipeline (Text length: {len(text)} chars)"
        )

        # Step 1: Autonomous Entity Resolution
        resolved_entities: List[Entity] = entities or []
        if not resolved_entities:
            logger.info("No entities provided. Executing autonomous EntityExtractor...")
            entity_resp = await self.entity_extractor.extract_entities_async(text)
            resolved_entities = entity_resp.entities
            logger.info(f"Autonomously resolved {len(resolved_entities)} entities.")

        raw_relationships: List[Relationship] = []

        # Step 2: Rule-Based Relationship Extraction
        if enable_rules:
            t0 = time.time()
            rule_rels = self.rule_extractor.extract(text, resolved_entities)
            raw_relationships.extend(rule_rels)
            logger.info(f"Stage 1 (Rule-Based) finished in {(time.time() - t0)*1000:.1f}ms")

        # Step 3: Gemini Semantic Relationship Extraction
        if enable_gemini:
            t0 = time.time()
            gemini_rels = await self.gemini_extractor.extract_async(text, resolved_entities)
            raw_relationships.extend(gemini_rels)
            logger.info(f"Stage 2 (Gemini) finished in {(time.time() - t0)*1000:.1f}ms")

        # Step 4 & 5: Normalization & Deduplication
        t0 = time.time()
        deduped_rels = self.normalizer.normalize_and_deduplicate(raw_relationships)

        # Step 6: Graph Payload Assembly
        graph_payload = self.normalizer.build_graph_payload(deduped_rels, resolved_entities)
        logger.info(
            f"Stages 4, 5 & 6 (Normalize, Deduplicate & Graph Payload) finished in {(time.time() - t0)*1000:.1f}ms"
        )

        elapsed_ms = (time.time() - start_pipeline) * 1000.0
        logger.info(
            f"Relationship Extraction Pipeline complete in {elapsed_ms:.1f}ms. Total edges: {len(graph_payload.relationships)}"
        )

        return RelationshipResponse(
            success=True,
            nodes=graph_payload.nodes,
            relationships=graph_payload.relationships,
            total_relationships=len(graph_payload.relationships),
            processing_time_ms=round(elapsed_ms, 2),
        )

    def extract_relationships_sync(
        self,
        text: str,
        entities: Optional[List[Entity]] = None,
        enable_rules: bool = True,
        enable_gemini: bool = True,
    ) -> RelationshipResponse:
        """Synchronous wrapper for extract_relationships_async."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(
                        asyncio.run,
                        self.extract_relationships_async(
                            text, entities, enable_rules, enable_gemini
                        ),
                    ).result()
            return loop.run_until_complete(
                self.extract_relationships_async(
                    text, entities, enable_rules, enable_gemini
                )
            )
        except Exception:
            return asyncio.run(
                self.extract_relationships_async(
                    text, entities, enable_rules, enable_gemini
                )
            )
