"""
Abstract Graph Database Interface & Mock Implementation.

Defines an abstract interface isolating Knowledge Graph operations:
- get_related_entities()
- get_subgraph()
- get_connected_nodes()
- search_graph()

Provides a pluggable `MockGraphInterface` for local testing until the real Neo4j driver is integrated.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List
from app.core.logging import logger
from app.schemas.rag import RAGGraphNode


class AbstractGraphInterface(ABC):
    """
    Abstract Base Class for Knowledge Graph Database adapters.
    """

    @abstractmethod
    def get_related_entities(self, entity_name: str) -> List[Dict[str, Any]]:
        """Retrieves entity nodes related to a specified entity name."""
        pass

    @abstractmethod
    def get_subgraph(self, query: str) -> List[RAGGraphNode]:
        """Retrieves a subgraph (nodes and connected relationships) matching query terms."""
        pass

    @abstractmethod
    def get_connected_nodes(self, node_id: str) -> List[RAGGraphNode]:
        """Retrieves direct neighbor nodes connected to a specific node_id."""
        pass

    @abstractmethod
    def search_graph(self, query: str) -> List[RAGGraphNode]:
        """Searches graph node names and properties matching query terms."""
        pass


class MockGraphInterface(AbstractGraphInterface):
    """
    Pluggable Mock Graph Interface returning synthetic compliance graph data.
    """

    def __init__(self) -> None:
        # Pre-seeded mock knowledge graph nodes
        self.mock_nodes: List[RAGGraphNode] = [
            RAGGraphNode(
                id="iso_27001",
                name="ISO 27001",
                label="Standard",
                properties={
                    "type": "Standard",
                    "description": "International Information Security Standard",
                    "requires": ["Access Control Policy", "Information Security Policy"],
                },
            ),
            RAGGraphNode(
                id="access_control_policy",
                name="Access Control Policy",
                label="Policy",
                properties={
                    "type": "Policy",
                    "implemented_by": "IT Department",
                    "controls": ["Multi-Factor Authentication", "Password Complexity"],
                },
            ),
            RAGGraphNode(
                id="gdpr",
                name="GDPR",
                label="Regulation",
                properties={
                    "type": "Regulation",
                    "description": "General Data Protection Regulation",
                    "requires": ["Privacy Policy", "Data Protection Impact Assessment"],
                },
            ),
            RAGGraphNode(
                id="mfa",
                name="Multi-Factor Authentication",
                label="Control",
                properties={
                    "type": "Control",
                    "protects": ["Admin Accounts", "Cloud Consoles"],
                    "mitigates": ["Unauthorized Access Risk"],
                },
            ),
            RAGGraphNode(
                id="it_department",
                name="IT Department",
                label="Department",
                properties={
                    "type": "Department",
                    "manages": ["Access Control Policy", "Firewall Configuration"],
                },
            ),
        ]

    def get_related_entities(self, entity_name: str) -> List[Dict[str, Any]]:
        """Returns related entities for entity_name."""
        logger.info(f"MockGraphInterface.get_related_entities('{entity_name}')")
        results = []
        name_low = entity_name.lower()
        for node in self.mock_nodes:
            if name_low in node.name.lower():
                results.append(
                    {
                        "source": node.name,
                        "label": node.label,
                        "relations": node.properties,
                    }
                )
        return results

    def get_subgraph(self, query: str) -> List[RAGGraphNode]:
        """Returns a relevant subgraph matching query terms."""
        logger.info(f"MockGraphInterface.get_subgraph('{query}')")
        return self.search_graph(query)

    def get_connected_nodes(self, node_id: str) -> List[RAGGraphNode]:
        """Returns neighbor nodes for node_id."""
        logger.info(f"MockGraphInterface.get_connected_nodes('{node_id}')")
        target_id = node_id.lower()
        return [node for node in self.mock_nodes if target_id in node.id.lower()]

    def search_graph(self, query: str) -> List[RAGGraphNode]:
        """Searches graph nodes by query matching."""
        logger.info(f"MockGraphInterface.search_graph('{query}')")
        query_terms = query.lower().split()
        matched: List[RAGGraphNode] = []

        for node in self.mock_nodes:
            searchable = (
                f"{node.name} {node.label} {str(node.properties)}".lower()
            )
            if any(term in searchable for term in query_terms):
                matched.append(node)

        # Fallback: if no specific term matched, return default top nodes
        return matched if matched else self.mock_nodes[:2]
