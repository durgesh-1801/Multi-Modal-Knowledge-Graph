"""
OCR API Router.

Provides endpoints for extracting text from standalone images and scanned PDF documents:
- POST /ocr/image: Processes JPEG, PNG, WEBP, TIFF, BMP image formats.
- POST /ocr/pdf: Performs full page image rendering and OCR on single or batch PDF documents.
"""

from typing import List, Union
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.logging import logger
from app.schemas.common import StandardResponse
from app.schemas.ocr import (
    BatchOCRFileResult,
    BatchOCRResponse,
    ImageOCRResponse,
    OCRPage,
    OCRResponse,
)
from app.services.file_manager import FileManager
from app.services.ocr_service import OCRService

router = APIRouter()

ocr_service = OCRService()
file_manager = FileManager()

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}


@router.post(
    "/image",
    response_model=StandardResponse[ImageOCRResponse],
    status_code=status.HTTP_200_OK,
    summary="Extract Text from Image File via OCR",
    description=(
        "Processes an uploaded image (JPG, PNG, WEBP, TIFF, BMP), applies OpenCV image "
        "enhancements, runs dual-engine OCR (PaddleOCR + Tesseract), and returns extracted text with confidence."
    ),
)
async def ocr_image(
    file: UploadFile = File(..., description="Image file to perform OCR on."),
) -> StandardResponse[ImageOCRResponse]:
    """
    OCR endpoint for single image files.
    """
    filename = file.filename or "uploaded_image.png"
    ext = "." + filename.split(".")[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        logger.warning(f"Unsupported image extension: '{ext}'")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported image type '{ext}'. Allowed extensions: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}",
        )

    try:
        content = await file.read()
        if not content or len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Image file '{filename}' is empty.",
            )

        text, confidence, engine_used, proc_time = ocr_service.extract_text_from_image(content)

        ocr_data = ImageOCRResponse(
            success=True,
            text=text,
            confidence=round(confidence, 4),
            engine_used=engine_used,
            processing_time_ms=round(proc_time, 2),
        )

        return StandardResponse[ImageOCRResponse](
            success=True,
            message="Image OCR processing successful",
            data=ocr_data,
        )

    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Image OCR failure for '{filename}': {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed for image '{filename}': {str(err)}",
        )


@router.post(
    "/pdf",
    response_model=StandardResponse[Union[OCRResponse, BatchOCRResponse]],
    status_code=status.HTTP_200_OK,
    summary="Extract Text from Scanned PDF Documents via OCR",
    description=(
        "Accepts single or batch scanned PDF files, converts pages into high-resolution images, "
        "runs OCR page by page, and returns structured OCR text with confidence metrics."
    ),
)
async def ocr_pdf(
    files: List[UploadFile] = File(
        ..., description="One or multiple scanned PDF files to process via OCR."
    ),
) -> StandardResponse[Union[OCRResponse, BatchOCRResponse]]:
    """
    OCR endpoint for scanned PDF documents.
    """
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files attached to PDF OCR request.",
        )

    batch_file_results: List[BatchOCRFileResult] = []

    for file in files:
        original_filename = file.filename or "scanned_doc.pdf"
        logger.info(f"Received PDF OCR request for file: '{original_filename}'")

        # Validate PDF binary using FileManager rules
        content = await file_manager.validate_pdf(file)

        try:
            pages: List[OCRPage] = ocr_service.extract_text_from_pdf(content)

            confidences = [p.confidence for p in pages if p.confidence > 0]
            avg_conf = float(sum(confidences) / len(confidences)) if confidences else 0.0

            file_result = BatchOCRFileResult(
                file_name=original_filename,
                pages=pages,
                overall_confidence=round(avg_conf, 4),
            )
            batch_file_results.append(file_result)

        except Exception as err:
            logger.error(f"PDF OCR failed for file '{original_filename}': {err}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"PDF OCR failed for file '{original_filename}': {str(err)}",
            )

    if len(batch_file_results) == 1:
        single_res = batch_file_results[0]
        single_payload = OCRResponse(
            success=True,
            pages=single_res.pages,
            total_pages=len(single_res.pages),
            overall_confidence=single_res.overall_confidence,
        )
        return StandardResponse[OCRResponse](
            success=True,
            message="PDF OCR processing successful",
            data=single_payload,
        )
    else:
        batch_payload = BatchOCRResponse(
            success=True,
            files=batch_file_results,
        )
        return StandardResponse[BatchOCRResponse](
            success=True,
            message="Batch PDF OCR processing successful",
            data=batch_payload,
        )
