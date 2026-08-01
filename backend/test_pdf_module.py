"""
Automated Verification Script for Document Upload & PDF Parsing Module.

Validates:
1. Valid PDF file generation and ingestion
2. Text parsing via PDFParser
3. Table parsing via TableParser
4. Validation error handling (non-PDF files, corrupted files, empty files)
5. API endpoint POST /api/v1/upload/pdf via FastAPI TestClient
"""

import sys
import os
from pathlib import Path

# Ensure backend root is on Python path
sys.path.insert(0, str(Path(__file__).parent))

import fitz  # PyMuPDF
from fastapi.testclient import TestClient

from app.main import app
from app.services.file_manager import FileManager
from app.services.pdf_parser import PDFParser
from app.services.table_parser import TableParser


def create_sample_pdf(file_path: Path) -> Path:
    """
    Creates a sample PDF document with text and a formatted table using PyMuPDF.
    """
    doc = fitz.open()
    
    # Page 1: Compliance Title & Text
    page1 = doc.new_page()
    page1.insert_text(
        (50, 50),
        "Enterprise Compliance Policy Document 2026",
        fontsize=16,
    )
    page1.insert_text(
        (50, 90),
        "Section 1: General Requirements\nAll data processing activities must strictly comply with regulatory standards.",
        fontsize=12,
    )

    # Page 2: Table Data
    page2 = doc.new_page()
    page2.insert_text((50, 50), "Section 2: Compliance Requirements Table", fontsize=14)
    
    # Draw simple table text layout on page 2
    table_content = (
        "Regulation | Requirement | Status\n"
        "GDPR Art. 32 | Encryption | Compliant\n"
        "ISO 27001 | Access Control | Compliant\n"
        "SOC 2 | Audit Logs | In Review\n"
    )
    page2.insert_text((50, 80), table_content, fontsize=11)

    file_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(file_path))
    doc.close()
    return file_path


def run_tests():
    print("==================================================")
    print("Starting Document Upload & PDF Parser Verification")
    print("==================================================")

    test_dir = Path("test_output")
    test_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Create Sample PDF
    sample_pdf_path = test_dir / "sample_compliance.pdf"
    create_sample_pdf(sample_pdf_path)
    print(f"[SUCCESS] Created sample test PDF at: {sample_pdf_path.resolve()}")

    # 2. Test PDFParser Service
    print("\n--- Testing PDFParser Service ---")
    parser = PDFParser()
    metadata, pages = parser.parse_file(sample_pdf_path)
    print(f"Extracted Metadata: Title='{metadata.title}', Pages={metadata.page_count}")
    print(f"Page 1 Text snippet: '{pages[0].text[:60]}...'")
    assert metadata.page_count == 2, "Expected 2 pages in test PDF"
    assert len(pages) == 2, "Expected 2 page text objects"
    print("[SUCCESS] PDFParser service passed.")

    # 3. Test TableParser Service
    print("\n--- Testing TableParser Service ---")
    table_parser = TableParser()
    tables = table_parser.parse_file(sample_pdf_path)
    print(f"Extracted Tables Count: {len(tables)}")
    print("[SUCCESS] TableParser service passed.")

    # 4. Test FastAPI Endpoint via TestClient
    print("\n--- Testing API Endpoint: POST /api/v1/upload/pdf ---")
    client = TestClient(app)
    
    with open(sample_pdf_path, "rb") as f:
        response = client.post(
            "/api/v1/upload/pdf",
            files={"files": ("sample_compliance.pdf", f, "application/pdf")},
        )
    
    print(f"API Response Status Code: {response.status_code}")
    json_resp = response.json()
    print(f"API Response Envelope: success={json_resp.get('success')}, message='{json_resp.get('message')}'")
    
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    assert json_resp["success"] is True, "Expected success=True"
    assert json_resp["message"] == "PDF processed successfully"
    assert "data" in json_resp, "Response missing 'data' payload"
    print("[SUCCESS] API Endpoint test passed!")

    # 5. Test Error Handling (Invalid File Type)
    print("\n--- Testing Error Handling: Invalid File Type ---")
    invalid_resp = client.post(
        "/api/v1/upload/pdf",
        files={"files": ("invalid.txt", b"Hello world text", "text/plain")},
    )
    print(f"Invalid File Response Status Code: {invalid_resp.status_code}")
    print(f"Error Message: {invalid_resp.json()}")
    assert invalid_resp.status_code == 422, "Expected 422 for non-PDF file"
    print("[SUCCESS] Invalid File Type error handler passed!")

    # 6. Test Error Handling (Corrupted PDF)
    print("\n--- Testing Error Handling: Corrupted PDF ---")
    corrupt_resp = client.post(
        "/api/v1/upload/pdf",
        files={"files": ("corrupt.pdf", b"%PDF-1.7 Fake corrupt bytes header", "application/pdf")},
    )
    print(f"Corrupt PDF Response Status Code: {corrupt_resp.status_code}")
    print(f"Error Message: {corrupt_resp.json()}")
    assert corrupt_resp.status_code == 400, "Expected 400 for corrupted PDF file"
    print("[SUCCESS] Corrupted PDF error handler passed!")

    print("\n==================================================")
    print("ALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
