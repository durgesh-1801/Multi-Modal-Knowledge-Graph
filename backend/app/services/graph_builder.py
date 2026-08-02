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
from app.rag.graph_interface import AbstractGraphInterface, MockGraphInterface
from app.schemas.entity import Entity
from app.schemas.graph import GraphNode, GraphRelationship
from app.schemas.relationship import Relationship


from app.dependencies import get_graph_interface


class GraphBuilderService:
    """
    Service responsible for converting extracted entities & relationships into Neo4j graph nodes
    and edges, and persisting them in batch to the Knowledge Graph.
    """

    def __init__(self, graph_db: Optional[AbstractGraphInterface] = None) -> None:
        self.graph_db: AbstractGraphInterface = graph_db if graph_db is not None else get_graph_interface()

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

        now_str = datetime.utcnow().isoformat()

        # Sub-step 1: Prepare Node Batch
        t_node_prep = time.time()
        nodes_to_create: List[GraphNode] = []
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
            nodes_to_create.append(graph_node)
            created_node_ids.add(node_id)

        node_prep_ms = (time.time() - t_node_prep) * 1000.0
        logger.info(f"[PERF] [GraphBuilder] NodeBatchPreparation: {node_prep_ms:.2f} ms ({len(nodes_to_create)} nodes)")

        # Sub-step 2: Store Node Batch
        t_node_store = time.time()
        if hasattr(self.graph_db, "create_nodes_batch"):
            self.graph_db.create_nodes_batch(nodes_to_create)
        else:
            for n in nodes_to_create:
                self.graph_db.create_node(n)
        node_store_ms = (time.time() - t_node_store) * 1000.0
        logger.info(f"[PERF] [GraphBuilder] GraphDBNodeStorage: {node_store_ms:.2f} ms")

        # Sub-step 3: Prepare Edge Batch & Missing Implicit Nodes
        t_edge_prep = time.time()
        relationships_to_create: List[GraphRelationship] = []
        implicit_nodes_to_create: List[GraphNode] = []

        for rel in relationships:
            if rel.confidence < min_confidence:
                continue

            src_id = rel.source.strip().lower().replace(" ", "_")
            tgt_id = rel.target.strip().lower().replace(" ", "_")

            # Ensure source and target nodes exist in graph
            if src_id not in created_node_ids:
                implicit_nodes_to_create.append(
                    GraphNode(
                        id=src_id,
                        name=rel.source.strip(),
                        type="Entity",
                        source_documents=[document_id],
                        page_numbers=[page_number],
                        confidence=rel.confidence,
                        created_at=now_str,
                        updated_at=now_str,
                    )
                )
                created_node_ids.add(src_id)

            if tgt_id not in created_node_ids:
                implicit_nodes_to_create.append(
                    GraphNode(
                        id=tgt_id,
                        name=rel.target.strip(),
                        type="Entity",
                        source_documents=[document_id],
                        page_numbers=[page_number],
                        confidence=rel.confidence,
                        created_at=now_str,
                        updated_at=now_str,
                    )
                )
                created_node_ids.add(tgt_id)

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
            relationships_to_create.append(graph_rel)

        edge_prep_ms = (time.time() - t_edge_prep) * 1000.0
        logger.info(f"[PERF] [GraphBuilder] EdgeBatchPreparation: {edge_prep_ms:.2f} ms ({len(relationships_to_create)} edges)")

        # Store implicit nodes if any were generated
        if implicit_nodes_to_create:
            if hasattr(self.graph_db, "create_nodes_batch"):
                self.graph_db.create_nodes_batch(implicit_nodes_to_create)
            else:
                for n in implicit_nodes_to_create:
                    self.graph_db.create_node(n)

        # Sub-step 4: Store Edge Batch
        t_edge_store = time.time()
        if hasattr(self.graph_db, "create_relationships_batch"):
            self.graph_db.create_relationships_batch(relationships_to_create)
        else:
            for r in relationships_to_create:
                self.graph_db.create_relationship(r)
        edge_store_ms = (time.time() - t_edge_store) * 1000.0
        logger.info(f"[PERF] [GraphBuilder] GraphDBEdgeStorage: {edge_store_ms:.2f} ms")

        duration_ms = round((time.time() - start_time) * 1000, 2)
        total_nodes = len(nodes_to_create) + len(implicit_nodes_to_create)
        total_edges = len(relationships_to_create)

        logger.info(
            f"Successfully stored Knowledge Graph for '{document_id}': "
            f"{total_nodes} nodes, {total_edges} edges ({duration_ms} ms)"
        )

        return {
            "document_id": document_id,
            "nodes_stored": total_nodes,
            "edges_stored": total_edges,
            "duration_ms": duration_ms,
        }
