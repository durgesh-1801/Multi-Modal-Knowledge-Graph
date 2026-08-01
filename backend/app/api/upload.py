"""
Document Upload & PDF Ingestion API Router.

Provides endpoints for ingesting, validating, storing, and parsing PDF compliance files.
Supports single and batch PDF uploads, PyMuPDF + pdfplumber text parsing, and Camelot + pdfplumber table extractions.
"""

from typing import Any, List, Union
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.logging import logger
from app.schemas.common import StandardResponse
from app.schemas.upload import PDFProcessedData
from app.services.file_manager import FileManager
from app.services.pdf_parser import PDFParser
from app.services.table_parser import TableParser

router = APIRouter()

# Initialize singleton service instances for upload router
file_manager = FileManager()
pdf_parser = PDFParser()
table_parser = TableParser()


@router.post(
    "/pdf",
    response_model=StandardResponse[Union[PDFProcessedData, List[PDFProcessedData]]],
    status_code=status.HTTP_200_OK,
    summary="Upload and Parse PDF Compliance Documents",
    description=(
        "Ingests single or multiple PDF files, validates file integrity, saves files to disk, "
        "extracts header metadata and page text, extracts structured tables, and returns "
        "a clean JSON payload for downstream processing modules."
    ),
)
async def upload_pdf(
    files: List[UploadFile] = File(
        ...,
        description="One or multiple PDF compliance documents to upload.",
    ),
) -> StandardResponse[Union[PDFProcessedData, List[PDFProcessedData]]]:
    """
    Handles PDF document upload, validation, disk persistence, text extraction, and table extraction.

    Args:
        files: List of FastAPI UploadFile objects received via multipart/form-data.

    Returns:
        StandardResponse containing parsed PDF document details, page text, and extracted tables.

    Raises:
        HTTPException: 400 Bad Request if file is missing, empty, password-protected, or corrupted.
        HTTPException: 413 Payload Too Large if file size exceeds configured limits.
        HTTPException: 422 Unprocessable Entity if uploaded file is not a PDF.
    """
    if not files or len(files) == 0:
        logger.warning("Upload request received with no files attached.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided in upload request.",
        )

    processed_results: List[PDFProcessedData] = []

    for file in files:
        original_filename = file.filename or "uploaded_document.pdf"
        logger.info(f"Processing upload request for file: '{original_filename}'")

        # 1. Validate PDF file (checks extension, magic bytes, size, password protection, corruption)
        binary_content = await file_manager.validate_pdf(file)

        # 2. Generate unique storage filename and persist to disk
        unique_filename = file_manager.generate_unique_filename(original_filename)
        saved_path = file_manager.save_file(binary_content, unique_filename)

        try:
            # 3. Parse Metadata and Page Text (PyMuPDF primary, pdfplumber fallback)
            metadata, pages = pdf_parser.parse_bytes(binary_content)

            # Preserve original filename in metadata title if title is empty
            if not metadata.title:
                metadata.title = original_filename

            # 4. Extract Structured Tables (Camelot primary, pdfplumber fallback)
            tables = table_parser.parse_file(saved_path)

            # 5. Assemble structured response data object
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
            # Cleanup saved file on processing failure
            file_manager.delete_file(saved_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to extract content from PDF '{original_filename}': {str(parse_error)}",
            )

    # Determine response payload shape (single object or list)
    response_payload: Union[PDFProcessedData, List[PDFProcessedData]] = (
        processed_results[0] if len(processed_results) == 1 else processed_results
    )

    logger.info(f"Successfully processed {len(processed_results)} PDF file(s).")

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
