"""
Documents Management REST API Router.

Provides endpoints for listing ingested compliance documents, querying document
metadata, and initiating cascading document deletion across the Knowledge Graph and Vector Store.
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.logging import logger
from app.dependencies import get_graph_interface
from app.rag.graph_interface import AbstractGraphInterface
from app.schemas.common import StandardResponse
from app.vector.vector_store import VectorStoreService

from app.core.rbac import Permission
from app.core.security import require_permission
from app.schemas.rbac import UserResponse

router = APIRouter()
vector_store = VectorStoreService()


class DocumentResponseItem(BaseModel):
    """Schema for document summary information returned by GET /documents."""

    id: str = Field(..., description="Unique document ID / filename")
    name: str = Field(..., description="Original or saved document name")
    uuid: str = Field(..., description="Short UUID checksum identifier")
    type: str = Field(default="pdf", description="Document type (pdf, audio, doc, image)")
    size: str = Field(default="Unknown", description="Human-readable file size")
    size_bytes: int = Field(default=0, description="File size in bytes")
    updated: str = Field(default="Recently", description="Relative update time or timestamp")
    status: str = Field(default="Compliant", description="Compliance status (Compliant, Risk Flagged, Processing)")
    confidence: int = Field(default=95, description="Average entity confidence percentage")
    framework: str = Field(default="General Compliance", description="Associated compliance framework")
    entities: List[str] = Field(default_factory=list, description="Extracted entity names")
    node_count: int = Field(default=0, description="Number of graph nodes linked to document")


@router.get(
    "",
    response_model=StandardResponse[List[DocumentResponseItem]],
    status_code=status.HTTP_200_OK,
    summary="Get List of Ingested Documents",
    description="Returns list of all documents ingested into the Knowledge Graph with metadata and linked entities.",
)
async def list_documents(
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
    current_user: UserResponse = Depends(require_permission(Permission.VIEW_GRAPH)),
) -> StandardResponse[List[DocumentResponseItem]]:
    """Retrieves all distinct documents present in the Knowledge Graph and storage directory."""
    logger.info("Retrieving ingested documents list")
    
    upload_dir = Path(settings.UPLOAD_DIRECTORY)
    
    # 1. Gather all nodes from graph to identify documents and linked entities
    subgraph = graph_db.get_subgraph(query="", depth=2)
    doc_map: Dict[str, Dict[str, Any]] = {}
    
    for node in subgraph.nodes:
        for doc_id in getattr(node, "source_documents", []):
            if not doc_id:
                continue
            if doc_id not in doc_map:
                doc_map[doc_id] = {
                    "id": doc_id,
                    "name": doc_id,
                    "uuid": doc_id[:8] if len(doc_id) >= 8 else doc_id,
                    "entities": set(),
                    "confidences": [],
                    "node_count": 0,
                }
            doc_map[doc_id]["entities"].add(node.name)
            doc_map[doc_id]["confidences"].append(getattr(node, "confidence", 0.95))
            doc_map[doc_id]["node_count"] += 1

    # 2. Check disk files in upload directory (recursively including uploads/pdfs, etc.)
    if upload_dir.exists():
        for file_path in upload_dir.rglob("*"):
            if file_path.is_file() and not file_path.name.startswith("."):
                fname = file_path.name
                # Check if fname or unique_id matches
                matched_key = None
                for key in list(doc_map.keys()):
                    if key == fname or key in fname or fname in key:
                        matched_key = key
                        break
                
                if matched_key:
                    doc_map[matched_key]["file_size_bytes"] = file_path.stat().st_size
                else:
                    doc_map[fname] = {
                        "id": fname,
                        "name": fname,
                        "uuid": fname[:8] if len(fname) >= 8 else fname,
                        "entities": set(),
                        "confidences": [0.95],
                        "node_count": 0,
                        "file_size_bytes": file_path.stat().st_size,
                    }

    # 3. Assemble document objects
    documents_list: List[DocumentResponseItem] = []
    for doc_id, data in doc_map.items():
        fname = data["name"]
        doc_type = "pdf"
        if fname.endswith((".mp3", ".wav", ".m4a")):
            doc_type = "audio"
        elif fname.endswith((".doc", ".docx")):
            doc_type = "doc"
        elif fname.endswith((".png", ".jpg", ".jpeg")):
            doc_type = "image"
            
        confs = data.get("confidences", [0.95])
        avg_conf = int(sum(confs) / len(confs) * 100) if confs else 95
        
        file_size_bytes = data.get("file_size_bytes", 0)
        size_str = f"{file_size_bytes / (1024 * 1024):.2f} MB" if file_size_bytes > 0 else "0.5 MB"

        entities_list = list(data["entities"])
        entities_upper = " ".join(entities_list).upper()
        
        framework = "Enterprise Compliance"
        if "NIST" in entities_upper or "RMF" in entities_upper:
            framework = "NIST SP 800-53"
        elif "HIPAA" in entities_upper or "PHI" in entities_upper:
            framework = "HIPAA Security Rule"
        elif "GDPR" in entities_upper:
            framework = "GDPR Data Privacy"
        elif "SOC" in entities_upper or "FINCEN" in entities_upper:
            framework = "SOC 2 Type II"

        documents_list.append(
            DocumentResponseItem(
                id=doc_id,
                name=fname,
                uuid=data["uuid"],
                type=doc_type,
                size=size_str,
                size_bytes=file_size_bytes,
                updated="Just now",
                status="Compliant" if avg_conf >= 80 else "Risk Flagged",
                confidence=min(max(avg_conf, 70), 99),
                framework=framework,
                entities=entities_list[:8],
                node_count=data["node_count"],
            )
        )

    return StandardResponse[List[DocumentResponseItem]](
        success=True,
        message=f"Retrieved {len(documents_list)} documents successfully",
        data=documents_list,
    )


class BulkDeleteRequest(BaseModel):
    document_ids: List[str] = Field(..., description="List of document IDs to delete")


def perform_single_document_deletion(document_id: str, graph_db: AbstractGraphInterface) -> Dict[str, Any]:
    """Helper executing cascading deletion of a document's graph elements, disk file, and vector embeddings."""
    logger.info(f"Initiating cascading document deletion for document ID: '{document_id}'")

    # 1. Clean graph relationships & orphaned nodes
    graph_cleanup = graph_db.delete_document_graph(document_id=document_id)

    # 2. Clean Qdrant vectors
    vectors_deleted = 0
    try:
        vectors_deleted = vector_store.delete_document_vectors(document_id=document_id)
    except Exception as err:
        logger.warning(f"Error removing vectors for document '{document_id}': {err}")

    # 3. Clean physical file if exists in upload directory (search recursively)
    file_deleted = False
    upload_dir = Path(settings.UPLOAD_DIRECTORY)
    if upload_dir.exists():
        for file_path in upload_dir.rglob("*"):
            if file_path.is_file() and (file_path.name == document_id or file_path.stem == document_id or document_id in file_path.name):
                try:
                    os.remove(file_path)
                    file_deleted = True
                    logger.info(f"Deleted physical file from disk: '{file_path}'")
                except Exception as e:
                    logger.warning(f"Could not delete physical file '{file_path}': {e}")

    return {
        "document_id": document_id,
        "graph_edges_deleted": graph_cleanup.get("edges_deleted", 0),
        "graph_nodes_deleted": graph_cleanup.get("nodes_deleted", 0),
        "vector_chunks_deleted": vectors_deleted,
        "file_deleted": file_deleted,
    }


@router.delete(
    "/all",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Clear All Documents",
    description="Permanently deletes all uploaded files, Neo4j graph nodes/edges, and Qdrant vectors.",
)
async def delete_all_documents(
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
    current_user: UserResponse = Depends(require_permission(Permission.DELETE_DOCUMENT)),
) -> StandardResponse[Dict[str, Any]]:
    """Complete document wipe across disk, knowledge graph, and vector database."""
    logger.info("Initiating FULL SYSTEM DOCUMENT WIPE...")

    # 1. Clear Graph DB
    graph_res = graph_db.clear_all()

    # 2. Clear Vector Store
    vector_res = False
    try:
        vector_res = vector_store.clear_all_vectors()
    except Exception as err:
        logger.error(f"Error clearing vector store: {err}")

    # 3. Clear Files on Disk
    files_deleted = 0
    upload_dir = Path(settings.UPLOAD_DIRECTORY)
    if upload_dir.exists():
        for p in list(upload_dir.rglob("*")):
            if p.is_file():
                try:
                    os.remove(p)
                    files_deleted += 1
                except Exception as e:
                    logger.warning(f"Could not remove file '{p}': {e}")

    logger.info(f"FULL DOCUMENT WIPE COMPLETE: {files_deleted} files deleted.")

    return StandardResponse[Dict[str, Any]](
        success=True,
        message="All documents, graph nodes, and vector embeddings successfully cleared.",
        data={
            "files_deleted": files_deleted,
            "graph_cleared": graph_res,
            "vectors_cleared": vector_res,
        },
    )


@router.delete(
    "/bulk",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Bulk Delete Documents",
    description="Deletes multiple documents by ID with cascading cleanup.",
)
async def delete_documents_bulk(
    body: BulkDeleteRequest,
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
    current_user: UserResponse = Depends(require_permission(Permission.DELETE_DOCUMENT)),
) -> StandardResponse[Dict[str, Any]]:
    """Cascading bulk deletion of documents."""
    logger.info(f"Initiating bulk deletion for {len(body.document_ids)} documents.")
    deleted_details = []
    for doc_id in body.document_ids:
        res = perform_single_document_deletion(doc_id, graph_db)
        deleted_details.append(res)

    return StandardResponse[Dict[str, Any]](
        success=True,
        message=f"Successfully processed bulk deletion for {len(body.document_ids)} documents",
        data={
            "total_requested": len(body.document_ids),
            "details": deleted_details,
        },
    )


@router.delete(
    "/{document_id:path}",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Delete Document Graph & Vectors",
    description="Removes document relationships, cleans up orphaned nodes, and deletes vector embeddings.",
)
async def delete_document(
    document_id: str,
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
    current_user: UserResponse = Depends(require_permission(Permission.DELETE_DOCUMENT)),
) -> StandardResponse[Dict[str, Any]]:
    """Cascading deletion of a single document's graph elements, file from disk, and vector embeddings."""
    result_summary = perform_single_document_deletion(document_id, graph_db)

    return StandardResponse[Dict[str, Any]](
        success=True,
        message=f"Document '{document_id}' deleted successfully",
        data=result_summary,
    )
