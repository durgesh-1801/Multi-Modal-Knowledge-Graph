"""
Knowledge Graph REST API Router.

Provides endpoints for querying, traversing, searching, analyzing, merging entities,
and cascading document deletion in the Neo4j Knowledge Graph.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.logging import logger
from app.dependencies import get_graph_interface
from app.rag.graph_interface import AbstractGraphInterface
from app.schemas.common import StandardResponse
from app.schemas.graph import (
    EntityMergeRequest,
    GraphNode,
    GraphStatistics,
    SubgraphResponse,
)
from app.vector.vector_store import VectorStoreService

router = APIRouter()
vector_store = VectorStoreService()


@router.get(
    "",
    response_model=StandardResponse[SubgraphResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Knowledge Graph Overview",
    description="Returns top nodes, active relationship edges, and graph summary metadata.",
)
async def get_graph_overview(
    limit: int = Query(default=50, ge=1, le=500, description="Max nodes to retrieve"),
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
) -> StandardResponse[SubgraphResponse]:
    """Retrieves full overview or top-level subgraph of the Knowledge Graph."""
    logger.info(f"Retrieving Knowledge Graph overview (limit={limit})")
    subgraph = graph_db.get_subgraph(query="", depth=2)
    return StandardResponse[SubgraphResponse](
        success=True,
        message="Knowledge Graph overview retrieved successfully",
        data=subgraph,
    )


@router.get(
    "/subgraph",
    response_model=StandardResponse[SubgraphResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Entity Subgraph & Neighborhood",
    description="Retrieves neighborhood subgraph centered around a specific entity ID or term up to specified depth.",
)
async def get_subgraph(
    entity_id: str = Query(..., description="Target entity ID or name to center neighborhood search around"),
    depth: int = Query(default=2, ge=1, le=5, description="Traversal radius depth"),
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
) -> StandardResponse[SubgraphResponse]:
    """Retrieves entity neighborhood subgraph for a given entity_id and traversal depth."""
    logger.info(f"Retrieving subgraph for entity '{entity_id}' with depth {depth}")
    subgraph = graph_db.get_subgraph(query=entity_id, depth=depth)
    return StandardResponse[SubgraphResponse](
        success=True,
        message=f"Subgraph for entity '{entity_id}' retrieved successfully",
        data=subgraph,
    )


@router.get(
    "/search",
    response_model=StandardResponse[List[GraphNode]],
    status_code=status.HTTP_200_OK,
    summary="Search Knowledge Graph Entities",
    description="Searches for matching entities by name, type, alias, or custom properties.",
)
async def search_graph(
    query: str = Query(..., min_length=1, description="Search term query string"),
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
) -> StandardResponse[List[GraphNode]]:
    """Searches graph nodes matching query string."""
    logger.info(f"Searching Knowledge Graph for query: '{query}'")
    matched_nodes = graph_db.search_graph(query=query)
    return StandardResponse[List[GraphNode]](
        success=True,
        message=f"Found {len(matched_nodes)} matching graph nodes",
        data=matched_nodes,
    )


@router.get(
    "/statistics",
    response_model=StandardResponse[GraphStatistics],
    status_code=status.HTTP_200_OK,
    summary="Get Knowledge Graph Analytics & Statistics",
    description="Returns comprehensive graph analytics including node/edge count, degree centrality, graph density, and distributions.",
)
async def get_statistics(
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
) -> StandardResponse[GraphStatistics]:
    """Returns analytics and summary metrics of the Knowledge Graph."""
    logger.info("Computing Knowledge Graph statistics and analytics")
    stats = graph_db.get_graph_statistics()
    return StandardResponse[GraphStatistics](
        success=True,
        message="Knowledge Graph statistics computed successfully",
        data=stats,
    )


@router.post(
    "/merge-entities",
    response_model=StandardResponse[bool],
    status_code=status.HTTP_200_OK,
    summary="Merge Duplicate Entity Nodes",
    description="Merges specified duplicate entity nodes into a single canonical entity node.",
)
async def merge_duplicate_entities(
    payload: EntityMergeRequest,
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
) -> StandardResponse[bool]:
    """Merges duplicate entities into a canonical entity node."""
    logger.info(
        f"Merging duplicate entities {payload.duplicate_names} into canonical entity '{payload.canonical_name}'"
    )
    result = graph_db.merge_duplicate_entities(
        canonical_name=payload.canonical_name, duplicate_names=payload.duplicate_names
    )
    return StandardResponse[bool](
        success=result,
        message=f"Entity deduplication and merge operation completed (success={result})",
        data=result,
    )


@router.delete(
    "/document/{document_id}",
    response_model=StandardResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Delete Document Graph & Vectors (Cascading Clean Up)",
    description="Removes all document graph relationships, cleans up orphaned nodes without active document references, and deletes Qdrant document vectors.",
)
async def delete_document(
    document_id: str,
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
) -> StandardResponse[dict]:
    """Deletes document graph elements and vector store embeddings."""
    logger.info(f"Initiating document graph and vector deletion for document ID: '{document_id}'")

    # 1. Delete document graph relationships and clean orphaned nodes
    graph_cleanup = graph_db.delete_document_graph(document_id=document_id)

    # 2. Delete document vector points from Qdrant
    vectors_deleted = 0
    try:
        vectors_deleted = vector_store.delete_document_vectors(document_id=document_id)
    except Exception as err:
        logger.warning(f"Error removing vectors for document '{document_id}': {err}")

    result_summary = {
        "document_id": document_id,
        "graph_edges_deleted": graph_cleanup.get("edges_deleted", 0),
        "graph_nodes_deleted": graph_cleanup.get("nodes_deleted", 0),
        "vector_chunks_deleted": vectors_deleted,
    }

    logger.info(f"Document deletion completed for '{document_id}': {result_summary}")

    return StandardResponse[dict](
        success=True,
        message=f"Document '{document_id}' graph elements and vectors deleted successfully",
        data=result_summary,
    )
