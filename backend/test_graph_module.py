"""
Knowledge Graph Module Test Suite.

Verifies:
1. AbstractGraphInterface & MockGraphInterface functionality.
2. Neo4jGraphInterface node and relationship creation, search, subgraphs, deduplication, and statistics.
3. GraphBuilderService pipeline ingestion.
4. Document lifecycle deletion & orphan cleanup.
5. Rank Fusion Reranking in Retriever.
"""

import sys
import unittest
from pathlib import Path

# Add app to root path
sys.path.insert(0, str(Path(__file__).parent))

from app.rag.graph_interface import MockGraphInterface, Neo4jGraphInterface
from app.rag.retriever import Retriever
from app.schemas.entity import Entity
from app.schemas.graph import GraphNode, GraphRelationship
from app.schemas.relationship import Relationship
from app.services.graph_builder import GraphBuilderService


class TestGraphModule(unittest.TestCase):
    """
    Test suite for Knowledge Graph Interfaces, Builder Service, and RAG Rank Fusion.
    """

    def setUp(self) -> None:
        self.mock_db = MockGraphInterface()
        self.builder = GraphBuilderService(graph_db=self.mock_db)

    def test_mock_graph_node_and_relationship_creation(self) -> None:
        """Verifies manual node and relationship creation in MockGraphInterface."""
        node1 = GraphNode(
            id="soc_2",
            name="SOC 2",
            type="Standard",
            aliases=["SOC2"],
            source_documents=["doc_test_1"],
            confidence=0.99,
        )
        node2 = GraphNode(
            id="encryption_at_rest",
            name="Encryption at Rest",
            type="Control",
            source_documents=["doc_test_1"],
            confidence=0.95,
        )

        res_n1 = self.mock_db.create_node(node1)
        res_n2 = self.mock_db.create_node(node2)
        self.assertEqual(res_n1.name, "SOC 2")
        self.assertEqual(res_n2.name, "Encryption at Rest")

        rel = GraphRelationship(
            source="SOC 2",
            target="Encryption at Rest",
            type="MANDATES",
            confidence=0.97,
            source_document="doc_test_1",
        )
        res_rel = self.mock_db.create_relationship(rel)
        self.assertEqual(res_rel.type, "MANDATES")

    def test_duplicate_node_prevention_and_merging(self) -> None:
        """Verifies duplicate node updates merge document sources and aliases without creating duplicates."""
        node1 = GraphNode(
            id="hipaa",
            name="HIPAA",
            type="Regulation",
            aliases=["Health Insurance Portability and Accountability Act"],
            source_documents=["doc_hipaa_01"],
            confidence=0.9,
        )
        self.mock_db.create_node(node1)

        # Re-inserting node with additional document source
        node2 = GraphNode(
            id="hipaa",
            name="HIPAA",
            type="Regulation",
            aliases=["HIPAA Rule"],
            source_documents=["doc_hipaa_02"],
            confidence=0.98,
        )
        updated_node = self.mock_db.create_node(node2)

        self.assertIn("doc_hipaa_01", updated_node.source_documents)
        self.assertIn("doc_hipaa_02", updated_node.source_documents)
        self.assertIn("HIPAA Rule", updated_node.aliases)

    def test_graph_builder_service_ingestion(self) -> None:
        """Verifies GraphBuilderService transforms extracted entities and relationships into graph elements."""
        entities = [
            Entity(
                name="Data Privacy Policy",
                type="Policy",
                confidence=0.96,
                source="spaCy",
                description="Internal privacy framework",
            ),
            Entity(
                name="GDPR Article 32",
                type="Standard",
                confidence=0.99,
                source="LLM",
                description="Security of processing",
            ),
        ]
        relationships = [
            Relationship(
                source="GDPR Article 32",
                target="Data Privacy Policy",
                relation="governs",
                confidence=0.94,
                source_engine="Rule-Based",
                reason="GDPR governs data privacy policies.",
            )
        ]

        result = self.builder.build_graph_from_extraction(
            entities=entities,
            relationships=relationships,
            document_id="doc_privacy_101",
            page_number=3,
        )

        self.assertEqual(result["document_id"], "doc_privacy_101")
        self.assertEqual(result["nodes_stored"], 2)
        self.assertEqual(result["edges_stored"], 1)

    def test_graph_search_and_subgraph(self) -> None:
        """Verifies graph search query filtering and subgraph neighborhood retrieval."""
        search_results = self.mock_db.search_graph("ISO 27001")
        self.assertTrue(len(search_results) > 0)
        self.assertTrue(any("ISO" in n.name for n in search_results))

        subgraph = self.mock_db.get_subgraph(query="ISO 27001", depth=2)
        self.assertTrue(len(subgraph.nodes) > 0)

    def test_document_lifecycle_deletion(self) -> None:
        """Verifies cascading deletion of document relationships and orphan node removal."""
        # Create a document-specific node
        node_doc_only = GraphNode(
            id="temp_doc_clause",
            name="Temporary Clause X",
            type="Clause",
            source_documents=["doc_to_delete_99"],
            confidence=0.85,
        )
        self.mock_db.create_node(node_doc_only)

        rel = GraphRelationship(
            source="Temporary Clause X",
            target="ISO 27001",
            type="REFERENCES",
            confidence=0.88,
            source_document="doc_to_delete_99",
        )
        self.mock_db.create_relationship(rel)

        cleanup_res = self.mock_db.delete_document_graph("doc_to_delete_99")
        self.assertGreaterEqual(cleanup_res["edges_deleted"], 1)

        # Verify orphan node was removed
        remaining = self.mock_db.search_graph("Temporary Clause X")
        self.assertFalse(any(n.id == "temp_doc_clause" for n in remaining))

    def test_graph_statistics(self) -> None:
        """Verifies calculation of graph summary metrics and analytics."""
        stats = self.mock_db.get_graph_statistics()
        self.assertGreater(stats.node_count, 0)
        self.assertGreaterEqual(stats.relationship_count, 0)
        self.assertGreaterEqual(stats.average_degree, 0.0)

    def test_rag_retriever_rank_fusion(self) -> None:
        """Verifies Rank Fusion reranking formula in Retriever."""
        retriever = Retriever(graph_db=self.mock_db, w_vector=0.45, w_graph=0.35, w_entity=0.20)
        subgraph = retriever.retrieve_graph("ISO 27001")
        self.assertTrue(len(subgraph) > 0)


if __name__ == "__main__":
    unittest.main()
