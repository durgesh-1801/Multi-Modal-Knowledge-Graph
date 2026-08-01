"""
OCR Pydantic Schemas.

Defines Pydantic models for OCR requests, image & PDF OCR results, confidence metrics,
page extractions, and batch processing envelopes.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class OCRConfidence(BaseModel):
    """
    Confidence score metrics across extracted text blocks.
    """

    average_confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Average confidence score across all text blocks."
    )
    min_confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Minimum confidence score observed."
    )
    max_confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Maximum confidence score observed."
    )
    engine_used: str = Field(
        ..., description="Name of the OCR engine used (e.g. 'PaddleOCR' or 'Tesseract')."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "average_confidence": 0.96,
                "min_confidence": 0.88,
                "max_confidence": 0.99,
                "engine_used": "PaddleOCR",
            }
        }
    }


class OCRPage(BaseModel):
    """
    OCR extraction result for a single page.
    """

    page: int = Field(..., description="1-indexed page number.")
    text: str = Field(..., description="Extracted text content from OCR.")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence score for page text extraction."
    )
    engine_used: str = Field(
        default="PaddleOCR", description="OCR engine utilized for this page."
    )
    processing_time_ms: float = Field(
        default=0.0, description="Time taken to process page in milliseconds."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "page": 1,
                "text": "ENTERPRISE COMPLIANCE REPORT 2026\nSection 1...",
                "confidence": 0.97,
                "engine_used": "PaddleOCR",
                "processing_time_ms": 142.5,
            }
        }
    }


class ImageOCRResponse(BaseModel):
    """
    Response model for single image OCR endpoint POST /ocr/image.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    text: str = Field(..., description="Extracted text string from image.")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence score of text extraction."
    )
    engine_used: str = Field(
        ..., description="Name of OCR engine used ('PaddleOCR' or 'Tesseract')."
    )
    processing_time_ms: float = Field(
        ..., description="Processing time in milliseconds."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "text": "CONFIDENTIAL COMPLIANCE DOCUMENT",
                "confidence": 0.98,
                "engine_used": "PaddleOCR",
                "processing_time_ms": 85.2,
            }
        }
    }


class OCRResponse(BaseModel):
    """
    Response model for single PDF OCR endpoint POST /ocr/pdf.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    pages: List[OCRPage] = Field(
        default_factory=list, description="List of OCR page extractions."
    )
    total_pages: int = Field(default=0, description="Total number of pages processed.")
    overall_confidence: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Average confidence across all pages."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "pages": [
                    {
                        "page": 1,
                        "text": "Page 1 OCR text...",
                        "confidence": 0.96,
                        "engine_used": "PaddleOCR",
                        "processing_time_ms": 120.0,
                    }
                ],
                "total_pages": 1,
                "overall_confidence": 0.96,
            }
        }
    }


class BatchOCRFileResult(BaseModel):
    """
    OCR extraction result for a single file in a batch processing request.
    """

    file_name: str = Field(..., description="Original filename.")
    pages: List[OCRPage] = Field(
        default_factory=list, description="Extracted pages for this document."
    )
    overall_confidence: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Average confidence score."
    )


class BatchOCRResponse(BaseModel):
    """
    Response model for batch PDF/Image OCR processing.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    files: List[BatchOCRFileResult] = Field(
        default_factory=list, description="List of processed file OCR results."
    )


class OCRRequest(BaseModel):
    """
    Optional control parameters for OCR execution.
    """

    min_confidence_threshold: float = Field(
        default=0.70,
        ge=0.0,
        le=1.0,
        description="Confidence threshold below which fallback OCR is triggered.",
    )
    force_ocr: bool = Field(
        default=False,
        description="If True, forces OCR even if native text extraction is present.",
    )
    language: str = Field(
        default="eng", description="Language code for OCR processing."
    )
