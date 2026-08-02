"""
Knowledge Graph Pydantic Schemas.

Defines structured schemas for graph nodes, relationships, subgraphs, statistics,
search queries, and entity merging payloads.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    """
    Knowledge Graph Node Schema.
    """

    id: str = Field(..., description="Unique node identifier")
    name: str = Field(..., description="Canonical node name")
    type: str = Field(default="Entity", description="Node entity type or label")
    aliases: List[str] = Field(default_factory=list, description="Synonyms or alias names")
    source_documents: List[str] = Field(
        default_factory=list, description="Associated document IDs"
    )
    page_numbers: List[int] = Field(
        default_factory=list, description="Associated document page numbers"
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Extraction confidence score")
    created_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(),
        description="Node creation timestamp",
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(),
        description="Node last updated timestamp",
    )
    properties: Dict[str, Any] = Field(
        default_factory=dict, description="Custom dynamic metadata properties"
    )

    @property
    def label(self) -> str:
        """Alias property for node entity type."""
        return self.type


class GraphRelationship(BaseModel):
    """
    Knowledge Graph Directed Relationship Edge Schema.
    """

    id: Optional[str] = Field(None, description="Optional unique edge identifier")
    source: str = Field(..., description="Source node name or ID")
    target: str = Field(..., description="Target node name or ID")
    type: str = Field(..., description="Relationship type/predicate (e.g. IMPLEMENTS, MANDATES)")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Relationship extraction confidence score")
    source_document: Optional[str] = Field(None, description="Origin document ID")
    page_number: Optional[int] = Field(None, description="Origin page number")
    created_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(),
        description="Relationship creation timestamp",
    )
    properties: Dict[str, Any] = Field(
        default_factory=dict, description="Custom relationship properties"
    )


class SubgraphResponse(BaseModel):
    """
    Subgraph response containing connected nodes and directed edges.
    """

    nodes: List[GraphNode] = Field(default_factory=list, description="Graph nodes in subgraph")
    edges: List[GraphRelationship] = Field(
        default_factory=list, description="Graph relationships in subgraph"
    )


class GraphStatistics(BaseModel):
    """
    Knowledge Graph Analytics & Summary Statistics Schema.
    """

    node_count: int = Field(default=0, description="Total node count")
    relationship_count: int = Field(default=0, description="Total edge/relationship count")
    document_count: int = Field(default=0, description="Distinct source documents stored")
    entity_types: Dict[str, int] = Field(
        default_factory=dict, description="Distribution of entity types"
    )
    relationship_types: Dict[str, int] = Field(
        default_factory=dict, description="Distribution of relationship types"
    )
    average_degree: float = Field(default=0.0, description="Average node degree")
    graph_density: float = Field(default=0.0, description="Graph density metric")
    most_connected_entities: List[Dict[str, Any]] = Field(
        default_factory=list, description="Entities with highest degree centrality"
    )
    entity_distribution: Dict[str, int] = Field(
        default_factory=dict, description="Entity classification frequency"
    )
    relationship_distribution: Dict[str, int] = Field(
        default_factory=dict, description="Relationship predicate frequency"
    )
    largest_connected_component_size: int = Field(
        default=0, description="Node count of largest connected component"
    )
    connected_components_count: int = Field(
        default=0, description="Number of connected components"
    )
    isolated_nodes_count: int = Field(
        default=0, description="Number of isolated nodes without any edges"
    )


class GraphQueryRequest(BaseModel):
    """
    Request model for searching graph nodes or requesting subgraphs.
    """

    query: Optional[str] = Field(None, description="Search term or node name filter")
    entity_id: Optional[str] = Field(None, description="Target entity ID for neighborhood search")
    depth: int = Field(default=2, ge=1, le=5, description="Traversal depth neighborhood radius")
    min_confidence: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Minimum confidence threshold"
    )


class EntityMergeRequest(BaseModel):
    """
    Request payload for merging duplicate entity nodes into a canonical node.
    """

    canonical_name: str = Field(..., description="Target canonical entity node name")
    duplicate_names: List[str] = Field(
        ..., min_length=1, description="List of duplicate entity node names to merge"
    )
