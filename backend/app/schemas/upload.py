"""
Document Upload & PDF Parsing Schemas.

Defines Pydantic models for PDF metadata, page text extractions, table extractions,
and upload response payloads.
"""

from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class UploadStatus(str, Enum):
    """
    Status enum representing the processing state of an uploaded document.
    """

    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class PDFMetadata(BaseModel):
    """
    Metadata extracted from a PDF document header.
    """

    title: Optional[str] = Field(default="", description="Document title.")
    author: Optional[str] = Field(default="", description="Document author/creator.")
    page_count: int = Field(default=0, description="Total number of pages in PDF.")
    creation_date: Optional[str] = Field(
        default=None, description="ISO or raw creation timestamp."
    )
    modification_date: Optional[str] = Field(
        default=None, description="ISO or raw last modified timestamp."
    )
    producer: Optional[str] = Field(
        default=None, description="Software tool used to generate PDF."
    )
    format: Optional[str] = Field(
        default=None, description="PDF specification version or format indicator."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "title": "Enterprise Data Protection Policy 2026",
                "author": "Compliance Officer",
                "page_count": 5,
                "creation_date": "2026-01-15",
                "modification_date": "2026-02-01",
                "producer": "PyMuPDF 1.23.0",
                "format": "PDF 1.7",
            }
        }
    }


class PDFPage(BaseModel):
    """
    Extracted textual content for a single PDF page.
    """

    page: int = Field(..., description="1-indexed page number.")
    text: str = Field(..., description="Cleaned extracted textual content of the page.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "page": 1,
                "text": "Enterprise Compliance Policy... Section 1: Overview...",
            }
        }
    }


class ExtractedTable(BaseModel):
    """
    Structured tabular data extracted from a PDF page.
    """

    page: int = Field(..., description="1-indexed page number where the table was found.")
    table: List[List[Optional[str]]] = Field(
        ...,
        description="2D array representation of the extracted table (rows and columns).",
    )
    row_count: int = Field(default=0, description="Total number of rows in the table.")
    col_count: int = Field(default=0, description="Total number of columns in the table.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "page": 2,
                "table": [
                    ["Regulation", "Requirement", "Status"],
                    ["GDPR Art. 32", "Data Encryption", "Compliant"],
                ],
                "row_count": 2,
                "col_count": 3,
            }
        }
    }


class PDFProcessedData(BaseModel):
    """
    Complete parsed result for a single processed PDF document.
    """

    file_name: str = Field(..., description="Original name of the uploaded PDF file.")
    saved_filename: str = Field(
        ..., description="Unique filename generated for storage."
    )
    file_size_bytes: int = Field(..., description="Size of the uploaded PDF in bytes.")
    metadata: PDFMetadata = Field(..., description="Extracted PDF header metadata.")
    pages: List[PDFPage] = Field(
        default_factory=list, description="Extracted page-by-page text content."
    )
    tables: List[ExtractedTable] = Field(
        default_factory=list, description="Extracted tables found in the document."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "file_name": "GDPR_Compliance.pdf",
                "saved_filename": "GDPR_Compliance_a1b2c3d4.pdf",
                "file_size_bytes": 524288,
                "metadata": {
                    "title": "GDPR Compliance",
                    "author": "Legal Dept",
                    "page_count": 2,
                },
                "pages": [{"page": 1, "text": "Page 1 content..."}],
                "tables": [
                    {
                        "page": 1,
                        "table": [["Header 1", "Header 2"]],
                        "row_count": 1,
                        "col_count": 2,
                    }
                ],
            }
        }
    }


class PDFUploadResponse(BaseModel):
    """
    Response model for single or multiple PDF upload and parsing operation.
    """

    uploaded_files: List[PDFProcessedData] = Field(
        ..., description="List of processed PDF file details and extractions."
    )
