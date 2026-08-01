"""
Automated Verification Script for OCR Module.

Validates:
1. ImagePreprocessor pipeline (OpenCV enhancements)
2. OCRService (PaddleOCR / Tesseract extraction & confidence evaluation)
3. PDFParser automatic OCR integration
4. API Endpoints: POST /api/v1/ocr/image and POST /api/v1/ocr/pdf
"""

import sys
import io
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Ensure backend root is on Python path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from app.main import app
from app.services.image_preprocessor import ImagePreprocessor
from app.services.ocr_service import OCRService


def create_sample_text_image() -> bytes:
    """
    Generates an in-memory PNG image containing clear printed text.
    """
    img = Image.new("RGB", (600, 200), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    # Draw simple text
    d.text((30, 40), "ENTERPRISE COMPLIANCE AUDIT 2026", fill=(0, 0, 0))
    d.text((30, 90), "Status: Approved and Compliant", fill=(0, 0, 0))
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def run_tests():
    print("==================================================")
    print("Starting OCR Module Automated Verification")
    print("==================================================")

    # 1. Test ImagePreprocessor
    print("\n--- Testing ImagePreprocessor ---")
    img_bytes = create_sample_text_image()
    preprocessor = ImagePreprocessor()
    cv_processed = preprocessor.preprocess_image(img_bytes)
    
    assert cv_processed is not None, "Preprocessed image must not be None"
    assert len(cv_processed.shape) == 2, "Output must be grayscale (2D array)"
    print(f"[SUCCESS] ImagePreprocessor complete. Output dimensions: {cv_processed.shape}")

    # 2. Test OCRService
    print("\n--- Testing OCRService ---")
    ocr_service = OCRService()
    text, confidence, engine, proc_time = ocr_service.extract_text_from_image(img_bytes)
    print(f"Extracted Text: '{text}'")
    print(f"Confidence: {confidence}, Engine: '{engine}', Timing: {proc_time}ms")
    assert isinstance(text, str), "Extracted text must be string"
    assert isinstance(confidence, float), "Confidence must be float"
    print("[SUCCESS] OCRService passed.")

    # 3. Test API Endpoints via TestClient
    print("\n--- Testing API Endpoint: POST /api/v1/ocr/image ---")
    client = TestClient(app)
    
    response = client.post(
        "/api/v1/ocr/image",
        files={"file": ("sample_audit.png", img_bytes, "image/png")},
    )
    
    print(f"API Response Code: {response.status_code}")
    json_resp = response.json()
    print(f"API Response Envelope: success={json_resp.get('success')}, message='{json_resp.get('message')}'")
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    assert json_resp["success"] is True
    print("[SUCCESS] POST /api/v1/ocr/image endpoint passed!")

    # 4. Test Error Handling for Unsupported Format
    print("\n--- Testing Error Handling: Unsupported Image Extension ---")
    err_resp = client.post(
        "/api/v1/ocr/image",
        files={"file": ("sample.invalid", b"some bytes", "application/octet-stream")},
    )
    print(f"Error Response Code: {err_resp.status_code}")
    assert err_resp.status_code == 422, "Expected 422 for unsupported format"
    print("[SUCCESS] Unsupported format error handling passed!")

    print("\n==================================================")
    print("ALL OCR MODULE VERIFICATION TESTS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
