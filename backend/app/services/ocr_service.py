"""
OCR Service Module.

Provides dual-engine OCR (PaddleOCR primary, Tesseract fallback), automatic OCR decision
evaluator (`needs_ocr`), PDF page image rendering (pdf2image + PyMuPDF fallback),
confidence score tracking, and result merging.
"""

import io
import time
from typing import List, Optional, Tuple, Union
import fitz  # PyMuPDF
import numpy as np
from PIL import Image

from app.core.logging import logger
from app.schemas.ocr import OCRPage
from app.services.image_preprocessor import ImagePreprocessor


class OCRService:
    """
    Modular OCR Service orchestrating PaddleOCR primary engine, Tesseract OCR fallback,
    image preprocessing, confidence evaluation, and PDF page conversion.
    """

    def __init__(self, confidence_threshold: float = 0.70) -> None:
        """
        Initializes OCRService.

        Args:
            confidence_threshold: Threshold below which primary OCR is deemed low-confidence.
        """
        self.confidence_threshold: float = confidence_threshold
        self.preprocessor: ImagePreprocessor = ImagePreprocessor()
        self._paddle_ocr_engine = None

    @staticmethod
    def needs_ocr(text: str, min_chars_per_page: int = 50) -> bool:
        """
        Determines whether a page or document requires OCR based on text character count.

        Args:
            text: Extracted native PDF text.
            min_chars_per_page: Minimum character count threshold.

        Returns:
            bool: True if text is below threshold (indicating scanned PDF), False otherwise.
        """
        clean_text = text.strip() if text else ""
        need = len(clean_text) < min_chars_per_page
        logger.debug(
            f"needs_ocr check: text length={len(clean_text)}, threshold={min_chars_per_page} -> {need}"
        )
        return need

    @staticmethod
    def detect_low_confidence(confidence: float, threshold: float = 0.70) -> bool:
        """
        Evaluates whether an OCR extraction confidence score is low.
        """
        return confidence < threshold

    def extract_with_paddle(self, img: np.ndarray) -> Tuple[str, float]:
        """
        Extracts text and confidence using PaddleOCR.

        Args:
            img: OpenCV grayscale or BGR numpy array image.

        Returns:
            Tuple[str, float]: Extracted text and average confidence score (0.0 to 1.0).
        """
        try:
            if self._paddle_ocr_engine is None:
                from paddleocr import PaddleOCR

                # Initialize PaddleOCR engine lazily (English)
                self._paddle_ocr_engine = PaddleOCR(
                    use_angle_cls=True, lang="en", show_log=False
                )

            result = self._paddle_ocr_engine.ocr(img, cls=True)
            if not result or not result[0]:
                return "", 0.0

            text_lines: List[str] = []
            confidences: List[float] = []

            for line in result[0]:
                if line and len(line) >= 2:
                    text_str, conf = line[1][0], float(line[1][1])
                    if text_str.strip():
                        text_lines.append(text_str.strip())
                        confidences.append(conf)

            full_text = "\n".join(text_lines)
            avg_conf = float(np.mean(confidences)) if confidences else 0.0
            logger.info(
                f"PaddleOCR extracted {len(text_lines)} lines with average confidence: {avg_conf:.3f}"
            )
            return full_text, avg_conf

        except Exception as err:
            logger.warning(f"PaddleOCR extraction failed: {err}")
            return "", 0.0

    def extract_with_tesseract(self, img: np.ndarray) -> Tuple[str, float]:
        """
        Extracts text and confidence using Tesseract OCR fallback engine.

        Args:
            img: OpenCV grayscale or BGR numpy array image.

        Returns:
            Tuple[str, float]: Extracted text and average confidence score (0.0 to 1.0).
        """
        try:
            import pytesseract
            from pytesseract import Output

            data = pytesseract.image_to_data(img, output_type=Output.DICT)
            n_boxes = len(data["text"])
            text_words: List[str] = []
            confidences: List[float] = []

            for i in range(n_boxes):
                word = data["text"][i].strip()
                conf_val = float(data["conf"][i])
                if word and conf_val > 0:
                    text_words.append(word)
                    # Convert 0-100 score to 0.0-1.0 scale
                    confidences.append(conf_val / 100.0)

            full_text = " ".join(text_words)
            avg_conf = float(np.mean(confidences)) if confidences else 0.0
            logger.info(
                f"Tesseract OCR extracted {len(text_words)} words with average confidence: {avg_conf:.3f}"
            )
            return full_text, avg_conf

        except Exception as err:
            logger.warning(f"Tesseract OCR extraction failed: {err}")
            return "", 0.0

    def merge_results(
        self,
        res_primary: Tuple[str, float, str],
        res_fallback: Tuple[str, float, str],
    ) -> Tuple[str, float, str]:
        """
        Compares two OCR engine extraction results and retains the result with higher confidence score.

        Args:
            res_primary: (text, confidence, engine_name)
            res_fallback: (text, confidence, engine_name)

        Returns:
            Tuple[str, float, str]: Highest confidence OCR result.
        """
        text_p, conf_p, eng_p = res_primary
        text_f, conf_f, eng_f = res_fallback

        if conf_f > conf_p and text_f.strip():
            logger.info(
                f"Fallback engine '{eng_f}' achieved higher confidence ({conf_f:.3f}) than '{eng_p}' ({conf_p:.3f}). Retaining fallback."
            )
            return res_fallback
        return res_primary

    def extract_text_from_page(
        self, page_img: Union[np.ndarray, Image.Image, bytes], page_num: int = 1
    ) -> OCRPage:
        """
        Preprocesses a single page image and executes dual OCR engine extraction with fallback.

        Args:
            page_img: Raw page image input.
            page_num: 1-indexed page number.

        Returns:
            OCRPage: Struct containing page text, confidence, engine used, and timing.
        """
        start_time = time.time()
        logger.info(f"Starting OCR processing for Page {page_num}")

        # 1. Preprocess Image
        preprocessed_img = self.preprocessor.preprocess_image(page_img)

        # 2. Attempt Primary Extraction (PaddleOCR)
        text_paddle, conf_paddle = self.extract_with_paddle(preprocessed_img)
        primary_result = (text_paddle, conf_paddle, "PaddleOCR")

        final_text, final_conf, final_engine = primary_result

        # 3. Evaluate Fallback (Tesseract) if confidence is low or Paddle failed
        if self.detect_low_confidence(conf_paddle, self.confidence_threshold):
            logger.info(
                f"Page {page_num}: Primary OCR confidence ({conf_paddle:.3f}) below threshold ({self.confidence_threshold}). Invoking Tesseract fallback."
            )
            text_tess, conf_tess = self.extract_with_tesseract(preprocessed_img)
            fallback_result = (text_tess, conf_tess, "Tesseract")

            final_text, final_conf, final_engine = self.merge_results(
                primary_result, fallback_result
            )

        elapsed_ms = (time.time() - start_time) * 1000.0
        logger.info(
            f"Completed OCR for Page {page_num} in {elapsed_ms:.1f}ms using '{final_engine}' (Confidence: {final_conf:.3f})"
        )

        return OCRPage(
            page=page_num,
            text=final_text,
            confidence=round(final_conf, 4),
            engine_used=final_engine,
            processing_time_ms=round(elapsed_ms, 2),
        )

    def extract_text_from_image(
        self, image_bytes: bytes
    ) -> Tuple[str, float, str, float]:
        """
        Executes complete OCR pipeline on a single standalone image.

        Args:
            image_bytes: Binary image bytes (jpg, png, webp, etc.).

        Returns:
            Tuple[str, float, str, float]: (text, confidence, engine_used, processing_time_ms).
        """
        page_res = self.extract_text_from_page(image_bytes, page_num=1)
        return (
            page_res.text,
            page_res.confidence,
            page_res.engine_used,
            page_res.processing_time_ms,
        )

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> List[OCRPage]:
        """
        Converts scanned PDF pages into images and runs OCR page by page.

        Args:
            pdf_bytes: Raw binary bytes of PDF document.

        Returns:
            List[OCRPage]: Page OCR extraction results.
        """
        logger.info("Rendering PDF pages to images for OCR processing.")
        images: List[Image.Image] = []

        # 1. Attempt rendering via pdf2image
        try:
            from pdf2image import convert_from_bytes

            images = convert_from_bytes(pdf_bytes, dpi=300)
            logger.info(f"pdf2image rendered {len(images)} page images.")
        except Exception as p2i_err:
            logger.warning(
                f"pdf2image failed or Poppler missing ({p2i_err}). Falling back to PyMuPDF pixmap rendering."
            )
            # Fallback: PyMuPDF high-resolution rendering directly in Python
            try:
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                for page_idx in range(len(doc)):
                    page = doc[page_idx]
                    # Matrix 2.0x = ~150-300 DPI high resolution
                    pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
                    img_data = pix.tobytes("png")
                    pil_img = Image.open(io.BytesIO(img_data))
                    images.append(pil_img)
                doc.close()
                logger.info(
                    f"PyMuPDF pixmap fallback rendered {len(images)} page images."
                )
            except Exception as pymupdf_err:
                logger.error(f"PyMuPDF page rendering failed: {pymupdf_err}")
                raise ValueError("Failed to render PDF pages into images for OCR.")

        # 2. Perform OCR on each rendered page image
        ocr_pages: List[OCRPage] = []
        for idx, page_image in enumerate(images):
            ocr_page = self.extract_text_from_page(page_image, page_num=idx + 1)
            ocr_pages.append(ocr_page)

        return ocr_pages
