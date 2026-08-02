"""
Document Upload & PDF Ingestion API Router.

Provides endpoints for ingesting, validating, storing, and parsing PDF compliance files.
Supports single and batch PDF uploads, PyMuPDF + pdfplumber text parsing, structured table extractions,
and AUTOMATIC Knowledge Graph construction (Text Extraction -> Chunking & Vector DB -> Entity Extraction -> Relationship Extraction -> Neo4j Graph Storage).
"""

from typing import Any, List, Union
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.core.logging import logger
from app.dependencies import get_graph_interface
from app.rag.graph_interface import AbstractGraphInterface
from app.schemas.common import StandardResponse
from app.schemas.upload import PDFProcessedData
from app.services.entity_extractor import EntityExtractor
from app.services.file_manager import FileManager
from app.services.graph_builder import GraphBuilderService
from app.services.pdf_parser import PDFParser
from app.services.relationship_extractor import RelationshipExtractor
from app.services.table_parser import TableParser
from app.vector.vector_store import VectorStoreService

from app.core.audit import record_audit_log
from app.core.rbac import Permission
from app.core.security import require_permission
from app.schemas.rbac import UserResponse

router = APIRouter()

# Initialize service instances for upload router
file_manager = FileManager()
pdf_parser = PDFParser()
table_parser = TableParser()
vector_store = VectorStoreService()
entity_extractor = EntityExtractor()
relationship_extractor = RelationshipExtractor()


@router.post(
    "/pdf",
    response_model=StandardResponse[Union[PDFProcessedData, List[PDFProcessedData]]],
    status_code=status.HTTP_200_OK,
    summary="Upload, Parse & Process PDF Compliance Documents into Knowledge Graph",
    description=(
        "Ingests PDF compliance files, validates integrity, extracts text/tables, stores dense vector chunks "
        "in Qdrant, extracts & normalizes entities and relationships, and automatically builds the Neo4j Knowledge Graph."
    ),
)
async def upload_pdf(
    files: List[UploadFile] = File(
        ...,
        description="One or multiple PDF compliance documents to upload.",
    ),
    graph_db: AbstractGraphInterface = Depends(get_graph_interface),
    current_user: UserResponse = Depends(require_permission(Permission.UPLOAD_DOCUMENT)),
) -> Any:
    """
    Handles PDF document upload, disk persistence, text/table parsing, Qdrant vector storage,
    entity/relationship extraction, and automatic Neo4j Knowledge Graph construction.
    """
    if not files or len(files) == 0:
        logger.warning("Upload request received with no files attached.")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=StandardResponse[None](
                success=False,
                message="No files provided in upload request.",
                data=None,
            ).model_dump(),
        )

    graph_builder = GraphBuilderService(graph_db=graph_db)
    processed_results: List[PDFProcessedData] = []

    for file in files:
        original_filename = file.filename or "uploaded_document.pdf"
        logger.info(f"Received file '{original_filename}'")
        saved_path = None

        try:
            # 1. Validate PDF file
            try:
                binary_content = await file_manager.validate_pdf(file)
            except HTTPException as val_http_err:
                logger.warning(f"Validation HTTP exception for '{original_filename}': {val_http_err.detail}")
                return JSONResponse(
                    status_code=val_http_err.status_code,
                    content=StandardResponse[None](
                        success=False,
                        message=str(val_http_err.detail),
                        data=None,
                    ).model_dump(),
                )

            # 2. Generate unique storage filename and persist to disk
            unique_filename = file_manager.generate_unique_filename(original_filename)
            saved_path = file_manager.save_file(binary_content, unique_filename)
            logger.info(f"Saved file '{original_filename}' as '{unique_filename}' at {saved_path}")

            logger.info(f"Pipeline started for '{original_filename}' ({unique_filename})")

            # 3. Parse Metadata and Page Text
            metadata, pages = pdf_parser.parse_bytes(binary_content)

            if not metadata.title:
                metadata.title = original_filename

            # 4. Extract Structured Tables
            tables = []
            try:
                tables = table_parser.parse_file(saved_path)
            except Exception as table_err:
                logger.warning(f"Table parsing warning for '{original_filename}': {table_err}")

            # Assemble full document text
            combined_text = "\n\n".join(
                [f"Page {getattr(p, 'page', getattr(p, 'page_number', 1))}:\n{p.text}" for p in pages if p.text]
            )

            if combined_text.strip():
                # 5. Chunking & Qdrant Vector DB Storage
                try:
                    logger.info(f"Storing vector embeddings for '{unique_filename}' in Qdrant")
                    vector_store.process_and_store_document(
                        document_id=unique_filename,
                        text=combined_text,
                        source_type="pdf",
                        original_filename=original_filename,
                    )
                except Exception as vector_err:
                    logger.error(f"Vector storage warning for '{unique_filename}': {vector_err}", exc_info=True)

                # 6. Hybrid Entity Extraction
                extracted_entities = []
                try:
                    logger.info(f"Extracting entities for '{unique_filename}'")
                    entity_res = await entity_extractor.extract_entities_async(
                        text=combined_text,
                        enable_spacy=True,
                        enable_rules=True,
                        enable_gemini=True,
                    )
                    extracted_entities = entity_res.entities
                except Exception as ent_err:
                    logger.error(f"Entity extraction warning for '{unique_filename}': {ent_err}", exc_info=True)

                # 7. Hybrid Relationship Extraction
                extracted_relationships = []
                try:
                    logger.info(f"Extracting relationships for '{unique_filename}'")
                    rel_res = await relationship_extractor.extract_relationships_async(
                        text=combined_text,
                        entities=extracted_entities,
                        enable_rules=True,
                        enable_gemini=True,
                    )
                    extracted_relationships = rel_res.relationships
                except Exception as rel_err:
                    logger.error(f"Relationship extraction warning for '{unique_filename}': {rel_err}", exc_info=True)

                # 8. Automatic Neo4j Knowledge Graph Construction
                try:
                    logger.info(f"Building Neo4j Knowledge Graph for '{unique_filename}'")
                    graph_builder.build_graph_from_extraction(
                        entities=extracted_entities,
                        relationships=extracted_relationships,
                        document_id=unique_filename,
                    )
                except Exception as graph_err:
                    logger.error(f"Graph construction warning for '{unique_filename}': {graph_err}", exc_info=True)

            logger.info(f"Pipeline completed for '{original_filename}' ({unique_filename})")

            # 9. Assemble structured response payload
            processed_data = PDFProcessedData(
                file_name=original_filename,
                saved_filename=unique_filename,
                file_size_bytes=len(binary_content),
                metadata=metadata,
                pages=pages,
                tables=tables,
            )
            processed_results.append(processed_data)

        except Exception as parse_error:
            logger.error(
                f"Extraction failure while processing '{original_filename}': {parse_error}",
                exc_info=True,
            )
            if saved_path:
                file_manager.delete_file(saved_path)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=StandardResponse[None](
                    success=False,
                    message=f"Failed to process PDF '{original_filename}': {str(parse_error)}",
                    data=None,
                ).model_dump(),
            )

    response_payload: Union[PDFProcessedData, List[PDFProcessedData]] = (
        processed_results[0] if len(processed_results) == 1 else processed_results
    )

    logger.info(f"Successfully processed and ingested {len(processed_results)} PDF file(s) into Knowledge Graph.")

    return StandardResponse[Union[PDFProcessedData, List[PDFProcessedData]]](
        success=True,
        message="PDF processed successfully",
        data=response_payload,
    )


@router.post(
    "/audio",
    response_model=StandardResponse[Any],
    status_code=status.HTTP_200_OK,
    summary="Upload Compliance Audio Recording (Placeholder)",
    description="Placeholder endpoint for processing compliance audio files in future phases.",
)
async def upload_audio(
    file: UploadFile = File(..., description="Audio recording file binary stream."),
) -> StandardResponse[Any]:
    """
    Placeholder endpoint for future audio ingestion and Whisper transcription.
    """
    logger.info(f"Audio upload endpoint invoked for file: '{file.filename}'")
    return StandardResponse[Any](
        success=True,
        message="Not implemented",
        data=None,
    )
