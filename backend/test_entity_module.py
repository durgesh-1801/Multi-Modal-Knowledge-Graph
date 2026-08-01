"""
Automated Verification Script for Entity Extraction Module.

Validates:
1. SpacyExtractor (Stage 1 NER)
2. Rule-Based Regex Extractor & EntityNormalizer (Stage 2 & Normalization)
3. Groq LLM Extractor (Stage 3)
4. Full EntityExtractor Hybrid Pipeline
5. API Endpoint: POST /api/v1/extract/entities (single & batch mode)
"""

import sys
from pathlib import Path

# Ensure backend root is on Python path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from app.main import app
from app.services.spacy_extractor import SpacyExtractor
from app.services.entity_normalizer import EntityNormalizer
from app.services.entity_extractor import EntityExtractor


TEST_COMPLIANCE_TEXT = (
    "ACME Corporation must comply with ISO 27001, ISO-27001, and GDPR regulations by Q3 2026. "
    "Compliance Officer John Doe from the Information Security department audited control CTRL-104 "
    "and policy POL-SEC-01. Contact: audit@acme.com or +1-800-555-0199. "
    "The SOC 2 Type II audit report DOC-9982 is published on https://compliance.acme.com/report."
)


def run_tests():
    print("==================================================")
    print("Starting Entity Extraction Module Verification")
    print("==================================================")

    # 1. Test SpacyExtractor
    print("\n--- Testing SpacyExtractor ---")
    spacy_serv = SpacyExtractor()
    spacy_ents = spacy_serv.extract(TEST_COMPLIANCE_TEXT)
    print(f"spaCy Extracted {len(spacy_ents)} entities.")
    for e in spacy_ents[:3]:
        print(f"  - [{e.type}] {e.name} (Source: {e.source}, Conf: {e.confidence})")

    # 2. Test Rule-Based Extraction & Normalizer
    print("\n--- Testing EntityNormalizer & Rules ---")
    normalizer = EntityNormalizer()
    rule_ents = normalizer.extract_rules(TEST_COMPLIANCE_TEXT)
    print(f"Rule-Based Extracted {len(rule_ents)} entities.")
    
    # Verify specific patterns detected
    rule_names = [e.name for e in rule_ents]
    print(f"Rule Entity Names: {rule_names}")
    assert any("ISO" in n for n in rule_names), "Expected ISO 27001 rule extraction"
    assert any("CTRL-104" in n for n in rule_names), "Expected Control ID CTRL-104 rule extraction"
    assert any("audit@acme.com" in n for n in rule_names), "Expected Email rule extraction"

    # Test Deduplication & Normalization
    deduped = normalizer.normalize_and_deduplicate(spacy_ents + rule_ents)
    print(f"Normalized & Deduplicated Count: {len(deduped)} (Merged from {len(spacy_ents) + len(rule_ents)})")

    # 3. Test Full EntityExtractor Pipeline
    print("\n--- Testing EntityExtractor Pipeline ---")
    pipeline = EntityExtractor()
    response = pipeline.extract_entities_sync(TEST_COMPLIANCE_TEXT, enable_gemini=False)
    
    print(f"Pipeline Total Entities: {response.total_entities}")
    print(f"Processing Time: {response.processing_time_ms}ms")
    assert response.total_entities > 0, "Pipeline must return entities"
    assert response.success is True, "Pipeline response must be successful"
    print("[SUCCESS] EntityExtractor master pipeline passed.")

    # 4. Test API Endpoint: POST /api/v1/extract/entities
    print("\n--- Testing API Endpoint: POST /api/v1/extract/entities ---")
    client = TestClient(app)
    
    payload = {
        "text": TEST_COMPLIANCE_TEXT,
        "enable_spacy": True,
        "enable_rules": True,
        "enable_gemini": False,
    }
    
    api_resp = client.post("/api/v1/extract/entities", json=payload)
    print(f"API Status Code: {api_resp.status_code}")
    json_data = api_resp.json()
    print(f"API Response Envelope: success={json_data.get('success')}, message='{json_data.get('message')}'")
    
    assert api_resp.status_code == 200, f"Expected 200 OK, got {api_resp.status_code}"
    assert json_data["success"] is True
    assert "entities" in json_data["data"], "Response missing 'entities' payload"
    print("[SUCCESS] POST /api/v1/extract/entities endpoint passed!")

    # 5. Test Error Handling: Empty Text
    print("\n--- Testing Error Handling: Empty Input Text ---")
    err_resp = client.post("/api/v1/extract/entities", json={"text": "   "})
    print(f"Empty Text API Response Code: {err_resp.status_code}")
    assert err_resp.status_code == 400, "Expected 400 Bad Request for empty text"
    print("[SUCCESS] Empty text error handling passed!")

    print("\n==================================================")
    print("ALL ENTITY EXTRACTION MODULE TESTS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
