"""
Document Upload & PDF Ingestion API Router.

Provides endpoints for ingesting, validating, storing, and parsing PDF compliance files.
Supports single and batch PDF uploads, PyMuPDF + pdfplumber text parsing, structured table extractions,
and AUTOMATIC Knowledge Graph construction (Text Extraction -> Chunking & Vector DB -> Entity Extraction -> Relationship Extraction -> Neo4j Graph Storage).
"""

from typing import Any, List, Union
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

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
) -> StandardResponse[Union[PDFProcessedData, List[PDFProcessedData]]]:
    """
    Handles PDF document upload, disk persistence, text/table parsing, Qdrant vector storage,
    entity/relationship extraction, and automatic Neo4j Knowledge Graph construction.
    """
    if not files or len(files) == 0:
        logger.warning("Upload request received with no files attached.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided in upload request.",
        )

    graph_builder = GraphBuilderService(graph_db=graph_db)
    processed_results: List[PDFProcessedData] = []

    for file in files:
        original_filename = file.filename or "uploaded_document.pdf"
        logger.info(f"Processing upload request for file: '{original_filename}'")

        # 1. Validate PDF file
        binary_content = await file_manager.validate_pdf(file)

        # 2. Generate unique storage filename and persist to disk
        unique_filename = file_manager.generate_unique_filename(original_filename)
        saved_path = file_manager.save_file(binary_content, unique_filename)

        try:
            # 3. Parse Metadata and Page Text
            metadata, pages = pdf_parser.parse_bytes(binary_content)

            if not metadata.title:
                metadata.title = original_filename

            # 4. Extract Structured Tables
            tables = table_parser.parse_file(saved_path)

            # Assemble full document text
            combined_text = "\n\n".join(
                [f"Page {getattr(p, 'page', getattr(p, 'page_number', 1))}:\n{p.text}" for p in pages if p.text]
            )

            if combined_text.strip():
                # 5. Chunking & Qdrant Vector DB Storage
                logger.info(f"Storing vector embeddings for '{unique_filename}' in Qdrant")
                vector_store.process_and_store_document(
                    document_id=unique_filename,
                    text=combined_text,
                    source_type="pdf",
                    original_filename=original_filename,
                )

                # 6. Hybrid Entity Extraction
                logger.info(f"Extracting entities for '{unique_filename}'")
                entity_res = await entity_extractor.extract_entities_async(
                    text=combined_text,
                    enable_spacy=True,
                    enable_rules=True,
                    enable_gemini=False,  # Fallback to rules/spacy when offline
                )

                # 7. Hybrid Relationship Extraction
                logger.info(f"Extracting relationships for '{unique_filename}'")
                rel_res = await relationship_extractor.extract_relationships_async(
                    text=combined_text,
                    entities=entity_res.entities,
                    enable_rules=True,
                    enable_gemini=False,
                )

                # 8. Automatic Neo4j Knowledge Graph Construction
                logger.info(f"Building Neo4j Knowledge Graph for '{unique_filename}'")
                graph_builder.build_graph_from_extraction(
                    entities=entity_res.entities,
                    relationships=rel_res.relationships,
                    document_id=unique_filename,
                )

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
            file_manager.delete_file(saved_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process PDF '{original_filename}': {str(parse_error)}",
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
