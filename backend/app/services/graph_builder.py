"""
Graph Builder Service.

Orchestrates batch creation and merging of extracted entities and relationships into the
Neo4j Knowledge Graph interface. Handles document ID tagging, page mapping, metadata assignment,
confidence filtering, and deduplication.
"""

from datetime import datetime
import time
from typing import Any, Dict, List, Optional

from app.core.logging import logger
from app.rag.graph_interface import AbstractGraphInterface
from app.schemas.entity import Entity
from app.schemas.graph import GraphNode, GraphRelationship
from app.schemas.relationship import Relationship


class GraphBuilderService:
    """
    Service responsible for converting extracted entities & relationships into Neo4j graph nodes
    and edges, and persisting them in batch to the Knowledge Graph.
    """

    def __init__(self, graph_db: AbstractGraphInterface) -> None:
        self.graph_db: AbstractGraphInterface = graph_db

    def build_graph_from_extraction(
        self,
        entities: List[Entity],
        relationships: List[Relationship],
        document_id: str,
        page_number: int = 1,
        min_confidence: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Ingests extracted entities and relationships, converts them to GraphNode & GraphRelationship models,
        assigns document & page metadata, and batch stores them in Neo4j.

        Args:
            entities: Extracted entity list.
            relationships: Extracted relationship edge list.
            document_id: Parent document identifier.
            page_number: Page number origin.
            min_confidence: Threshold confidence score below which items are filtered.

        Returns:
            Dict[str, Any]: Insertion summary metrics.
        """
        start_time = time.time()
        logger.info(
            f"Building Knowledge Graph for Document '{document_id}' (Page {page_number}) - "
            f"{len(entities)} entities, {len(relationships)} relationships"
        )

        nodes_processed = 0
        edges_processed = 0
        now_str = datetime.utcnow().isoformat()

        # 1. Process & Insert Entity Nodes
        created_node_ids = set()
        for ent in entities:
            if ent.confidence < min_confidence:
                continue

            node_id = ent.name.strip().lower().replace(" ", "_")
            graph_node = GraphNode(
                id=node_id,
                name=ent.name.strip(),
                type=ent.type,
                aliases=[ent.name.strip()],
                source_documents=[document_id],
                page_numbers=[page_number],
                confidence=ent.confidence,
                created_at=now_str,
                updated_at=now_str,
                properties={
                    "description": ent.description or "",
                    "source_engine": ent.source,
                    **ent.metadata,
                },
            )
            self.graph_db.create_node(graph_node)
            created_node_ids.add(node_id)
            nodes_processed += 1

        # 2. Process & Insert Relationship Edges
        for rel in relationships:
            if rel.confidence < min_confidence:
                continue

            src_id = rel.source.strip().lower().replace(" ", "_")
            tgt_id = rel.target.strip().lower().replace(" ", "_")

            # Ensure source and target nodes exist in graph
            if src_id not in created_node_ids:
                self.graph_db.create_node(
                    GraphNode(
                        id=src_id,
                        name=rel.source.strip(),
                        type="Entity",
                        source_documents=[document_id],
                        page_numbers=[page_number],
                        confidence=rel.confidence,
                    )
                )
            if tgt_id not in created_node_ids:
                self.graph_db.create_node(
                    GraphNode(
                        id=tgt_id,
                        name=rel.target.strip(),
                        type="Entity",
                        source_documents=[document_id],
                        page_numbers=[page_number],
                        confidence=rel.confidence,
                    )
                )

            graph_rel = GraphRelationship(
                source=rel.source.strip(),
                target=rel.target.strip(),
                type=rel.relation.upper(),
                confidence=rel.confidence,
                source_document=document_id,
                page_number=page_number,
                created_at=now_str,
                properties={
                    "source_engine": rel.source_engine,
                    "reason": rel.reason or "",
                    **rel.metadata,
                },
            )
            self.graph_db.create_relationship(graph_rel)
            edges_processed += 1

        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.info(
            f"Successfully stored Knowledge Graph for '{document_id}': "
            f"{nodes_processed} nodes, {edges_processed} edges ({duration_ms} ms)"
        )

        return {
            "document_id": document_id,
            "nodes_stored": nodes_processed,
            "edges_stored": edges_processed,
            "duration_ms": duration_ms,
        }
