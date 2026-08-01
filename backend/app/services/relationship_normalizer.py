"""
Relationship Normalizer & Graph Builder Service.

Normalizes relationship types, standardizes source and target entity names,
deduplicates directed edges, and constructs graph-ready payloads (nodes and relationships)
formatted for downstream Neo4j Knowledge Graph ingestion.
"""

import re
from typing import Dict, List, Set, Tuple
from app.core.logging import logger
from app.schemas.entity import Entity
from app.schemas.relationship import GraphNode, GraphPayload, Relationship


class RelationshipNormalizer:
    """
    Isolated service handling relation type normalization, entity reference resolution,
    edge deduplication, and graph node payload construction.
    """

    # Relation Standardization Map
    RELATION_MAP: Dict[str, str] = {
        "implements": "implements",
        "implemented_by": "implemented_by",
        "implementation": "implements",
        "requires": "requires",
        "requirement": "requires",
        "belongs to": "belongs_to",
        "belongs_to": "belongs_to",
        "managed by": "managed_by",
        "managed_by": "managed_by",
        "owned by": "owned_by",
        "owned_by": "owned_by",
        "assigned to": "assigned_to",
        "assigned_to": "assigned_to",
        "reports to": "reports_to",
        "reports_to": "reports_to",
        "audited by": "audited_by",
        "audited_by": "audited_by",
        "mitigated by": "mitigated_by",
        "mitigated_by": "mitigated_by",
        "governed by": "governed_by",
        "governed_by": "governed_by",
        "references": "references",
        "referenced_by": "references",
        "related to": "related_to",
        "related_to": "related_to",
        "linked to": "linked_to",
        "linked_to": "linked_to",
        "depends on": "depends_on",
        "depends_on": "depends_on",
        "part of": "part_of",
        "part_of": "part_of",
        "contains": "contains",
        "uses": "uses",
        "protects": "protects",
        "creates": "creates",
        "updates": "updates",
        "approves": "approves",
        "reviews": "reviews",
        "monitors": "monitors",
        "controls": "controls",
        "communicates_with": "communicates_with",
        "affects": "affects",
        "triggered_by": "triggered_by",
        "generated_from": "generated_from",
    }

    def normalize_relation_name(self, raw_relation: str) -> str:
        """
        Normalizes relationship string to canonical lower_snake_case format.
        """
        clean = raw_relation.strip().lower().replace("-", "_")
        return self.RELATION_MAP.get(clean, clean.replace(" ", "_"))

    @staticmethod
    def generate_node_id(entity_name: str) -> str:
        """
        Generates a clean, safe graph node ID from an entity name.
        """
        clean = re.sub(r"[^\w\s-]", "", entity_name.strip().lower())
        return re.sub(r"[-\s]+", "_", clean)

    def normalize_and_deduplicate(
        self, raw_relationships: List[Relationship]
    ) -> List[Relationship]:
        """
        Normalizes relation names and entity titles, deduplicating identical edges.

        Args:
            raw_relationships: List of raw relationships from all extraction engines.

        Returns:
            List[Relationship]: Deduplicated, canonical relationship edges.
        """
        if not raw_relationships:
            return []

        logger.info(f"Normalizing and deduplicating {len(raw_relationships)} raw relationships.")
        merged_map: Dict[str, Relationship] = {}

        for rel in raw_relationships:
            norm_source = " ".join(rel.source.strip().split())
            norm_target = " ".join(rel.target.strip().split())
            norm_relation = self.normalize_relation_name(rel.relation)

            # Skip self-loop relationships where source equals target
            if norm_source.lower() == norm_target.lower():
                continue

            edge_key = f"{norm_source.lower()}::[{norm_relation}]::{norm_target.lower()}"

            if edge_key in merged_map:
                existing = merged_map[edge_key]
                existing.confidence = max(existing.confidence, rel.confidence)

                if rel.source_engine not in existing.source_engine:
                    existing.source_engine = f"{existing.source_engine}+{rel.source_engine}"

                if not existing.reason and rel.reason:
                    existing.reason = rel.reason
            else:
                merged_map[edge_key] = Relationship(
                    source=norm_source,
                    target=norm_target,
                    relation=norm_relation,
                    confidence=round(rel.confidence, 4),
                    source_engine=rel.source_engine,
                    reason=rel.reason,
                    metadata=rel.metadata,
                )

        final_relationships = list(merged_map.values())
        logger.info(f"Deduplication complete. Retained {len(final_relationships)} unique relationships.")
        return final_relationships

    def build_graph_payload(
        self, relationships: List[Relationship], known_entities: List[Entity] = None
    ) -> GraphPayload:
        """
        Constructs a graph-ready payload (GraphNode list and Relationship list) for Neo4j.

        Args:
            relationships: Deduplicated relationships list.
            known_entities: Optional list of known extracted entities for label resolution.

        Returns:
            GraphPayload: Graph-ready nodes and relationships object.
        """
        entity_label_map: Dict[str, str] = {}
        nodes_map: Dict[str, GraphNode] = {}

        if known_entities:
            for ent in known_entities:
                entity_label_map[ent.name.lower()] = ent.type
                nid = self.generate_node_id(ent.name)
                if nid not in nodes_map:
                    nodes_map[nid] = GraphNode(
                        id=nid,
                        name=ent.name,
                        label=ent.type,
                        properties={"confidence": ent.confidence, "source": ent.source},
                    )

        for rel in relationships:
            # Source Node
            src_id = self.generate_node_id(rel.source)
            if src_id not in nodes_map:
                src_label = entity_label_map.get(rel.source.lower(), "Entity")
                nodes_map[src_id] = GraphNode(
                    id=src_id,
                    name=rel.source,
                    label=src_label,
                    properties={"confidence": rel.confidence, "source": rel.source_engine},
                )

            # Target Node
            tgt_id = self.generate_node_id(rel.target)
            if tgt_id not in nodes_map:
                tgt_label = entity_label_map.get(rel.target.lower(), "Entity")
                nodes_map[tgt_id] = GraphNode(
                    id=tgt_id,
                    name=rel.target,
                    label=tgt_label,
                    properties={"confidence": rel.confidence, "source": rel.source_engine},
                )

        graph_nodes = list(nodes_map.values())
        logger.info(
            f"Constructed Graph Payload with {len(graph_nodes)} nodes and {len(relationships)} edges."
        )

        return GraphPayload(nodes=graph_nodes, relationships=relationships)
