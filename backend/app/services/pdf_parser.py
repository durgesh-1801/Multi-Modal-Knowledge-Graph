"""
PDF Parser Service.

Primary PDF text and metadata extraction using PyMuPDF (fitz) with automatic fallback
to pdfplumber and automated OCR service integration (OCRService.needs_ocr) for scanned PDFs.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

from app.core.logging import logger
from app.schemas.upload import PDFMetadata, PDFPage
from app.services.ocr_service import OCRService


class PDFParser:
    """
    Modular PDF Parser supporting multi-engine extraction (PyMuPDF primary, pdfplumber fallback,
    and automatic OCR Service execution for scanned image PDFs).
    """

    def __init__(self, fallback_threshold_chars: int = 50) -> None:
        """
        Initializes PDFParser.

        Args:
            fallback_threshold_chars: Minimum character count threshold below which fallback/OCR is triggered.
        """
        self.fallback_threshold_chars = fallback_threshold_chars
        self.ocr_service: OCRService = OCRService(confidence_threshold=0.70)

    def parse_bytes(self, content: bytes) -> Tuple[PDFMetadata, List[PDFPage]]:
        """
        Parses a PDF document from binary stream.

        Args:
            content: Raw byte stream of PDF document.

        Returns:
            Tuple[PDFMetadata, List[PDFPage]]: Metadata object and list of page text models.
        """
        logger.info(f"Initiating PDF parsing for byte stream ({len(content)} bytes)")

        # 1. Primary Extraction via PyMuPDF
        metadata, pages, total_chars = self._extract_pymupdf(content=content)
        combined_text = " ".join([p.text for p in pages])

        # 2. Evaluate Automatic OCR Requirement
        if OCRService.needs_ocr(combined_text, min_chars_per_page=self.fallback_threshold_chars):
            logger.warning(
                f"Minimal native text found ({total_chars} chars across {len(pages)} pages). "
                "Evaluating fallback and automatic OCR for scanned PDF."
            )

            # 2a. Attempt pdfplumber fallback first
            fallback_pages = self._extract_pdfplumber_fallback(content=content)
            fallback_text = " ".join([p.text for p in fallback_pages])

            if not OCRService.needs_ocr(fallback_text, min_chars_per_page=self.fallback_threshold_chars):
                pages = fallback_pages
                logger.info("pdfplumber fallback successfully retrieved native text.")
            else:
                # 2b. PDF is a scanned document -> Trigger automatic OCR Service!
                logger.info("Document identified as scanned PDF. Triggering automatic OCR Service...")
                try:
                    ocr_page_results = self.ocr_service.extract_text_from_pdf(content)
                    if ocr_page_results:
                        pages = [
                            PDFPage(page=op.page, text=op.text)
                            for op in ocr_page_results
                        ]
                        logger.info(
                            f"Automatic OCR completed successfully for {len(pages)} pages."
                        )
                except Exception as ocr_err:
                    logger.error(f"Automatic OCR fallback failed: {ocr_err}")

        return metadata, pages

    def parse_file(self, file_path: Union[str, Path]) -> Tuple[PDFMetadata, List[PDFPage]]:
        """
        Parses a PDF document from disk filepath.

        Args:
            file_path: Path to PDF file.

        Returns:
            Tuple[PDFMetadata, List[PDFPage]]: Metadata object and list of page text models.
        """
        path = Path(file_path)
        with open(path, "rb") as f:
            content = f.read()
        return self.parse_bytes(content)

    def _extract_pymupdf(
        self, content: bytes
    ) -> Tuple[PDFMetadata, List[PDFPage], int]:
        """
        Extracts metadata and text using PyMuPDF (fitz).

        Args:
            content: Binary byte stream.

        Returns:
            Tuple[PDFMetadata, List[PDFPage], int]: Metadata, pages list, total character count.
        """
        pages: List[PDFPage] = []
        total_chars = 0

        if fitz is None:
            logger.warning("PyMuPDF (fitz) is not installed. Attempting pdfplumber fallback.")
            fallback_pages = self._extract_pdfplumber_fallback(content=content)
            fallback_text = " ".join([p.text for p in fallback_pages])
            metadata = PDFMetadata(
                title="",
                author="",
                page_count=len(fallback_pages),
                creation_date=None,
                modification_date=None,
                producer="Fallback Parser",
                format="PDF",
            )
            return metadata, fallback_pages, len(fallback_text)

        doc = fitz.open(stream=content, filetype="pdf")

        raw_meta: Dict[str, str] = doc.metadata or {}
        metadata = PDFMetadata(
            title=raw_meta.get("title", "") or "",
            author=raw_meta.get("author", "") or "",
            page_count=len(doc),
            creation_date=raw_meta.get("creationDate", None),
            modification_date=raw_meta.get("modDate", None),
            producer=raw_meta.get("producer", None),
            format=raw_meta.get("format", f"PDF {doc.pdf_version() if hasattr(doc, 'pdf_version') else ''}"),
        )

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text").strip()
            total_chars += len(text)
            pages.append(PDFPage(page=page_num + 1, text=text))

        doc.close()
        logger.info(
            f"PyMuPDF parsed {len(pages)} pages ({total_chars} characters extracted)."
        )
        return metadata, pages, total_chars

    def _extract_pdfplumber_fallback(self, content: bytes) -> List[PDFPage]:
        """
        Fallback extraction method using pdfplumber when primary extraction returns low character count.

        Args:
            content: Binary byte stream.

        Returns:
            List[PDFPage]: Extracted pages from pdfplumber.
        """
        pages: List[PDFPage] = []
        try:
            import io
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for idx, page in enumerate(pdf.pages):
                    text = page.extract_text() or ""
                    pages.append(PDFPage(page=idx + 1, text=text.strip()))
        except Exception as err:
            logger.error(f"pdfplumber fallback extraction failed: {err}")
        return pages
