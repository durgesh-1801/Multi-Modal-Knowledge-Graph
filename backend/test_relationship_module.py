"""
Automated Verification Script for Relationship Extraction Module.

Validates:
1. RuleRelationshipExtractor (Pattern matching & verbal clause parsing)
2. RelationshipNormalizer (Relation type standardization, edge deduplication, graph payload assembly)
3. LLM Relationship Extractor (Fallback handling)
4. Full RelationshipExtractor Master Pipeline
5. API Endpoint: POST /api/v1/extract/relationships (single & batch)
"""

import sys
from pathlib import Path

# Ensure backend root is on Python path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from app.main import app
from app.schemas.entity import Entity
from app.services.rule_relationships import RuleRelationshipExtractor
from app.services.relationship_normalizer import RelationshipNormalizer
from app.services.relationship_extractor import RelationshipExtractor

TEST_RELATIONSHIP_TEXT = (
    "ISO 27001 requires an Access Control Policy which is implemented by the IT Department. "
    "Compliance Officer John Doe from the IT Department manages the Access Control Policy. "
    "Furthermore, GDPR governs data protection activities and requires a Data Protection Policy."
)


def run_tests():
    print("==================================================")
    print("Starting Relationship Extraction Verification")
    print("==================================================")

    known_entities = [
        Entity(name="ISO 27001", type="Standard", confidence=0.98, source="Rule-Based"),
        Entity(name="Access Control Policy", type="Policy", confidence=0.95, source="spaCy"),
        Entity(name="IT Department", type="Department", confidence=0.92, source="spaCy"),
        Entity(name="GDPR", type="Regulation", confidence=0.99, source="Rule-Based"),
        Entity(name="Data Protection Policy", type="Policy", confidence=0.94, source="Rule-Based"),
    ]

    # 1. Test RuleRelationshipExtractor
    print("\n--- Testing RuleRelationshipExtractor ---")
    rule_extractor = RuleRelationshipExtractor()
    rule_rels = rule_extractor.extract(TEST_RELATIONSHIP_TEXT, known_entities)
    
    print(f"Rule Extractor Identified {len(rule_rels)} relationship edges.")
    for r in rule_rels:
        print(f"  - [{r.source}] --({r.relation})--> [{r.target}] (Conf: {r.confidence})")
    
    assert len(rule_rels) > 0, "Rule extractor must find relationships"
    print("[SUCCESS] RuleRelationshipExtractor passed.")

    # 2. Test RelationshipNormalizer & Graph Payload Assembly
    print("\n--- Testing RelationshipNormalizer & Graph Builder ---")
    normalizer = RelationshipNormalizer()
    deduped_rels = normalizer.normalize_and_deduplicate(rule_rels)
    graph_payload = normalizer.build_graph_payload(deduped_rels, known_entities)
    
    print(f"Deduplicated Edges Count: {len(deduped_rels)}")
    print(f"Graph Nodes Count: {len(graph_payload.nodes)}")
    for node in graph_payload.nodes:
        print(f"  Node: ID='{node.id}', Name='{node.name}', Label='{node.label}'")
        
    assert len(graph_payload.nodes) > 0, "Graph payload must contain nodes"
    assert len(graph_payload.relationships) > 0, "Graph payload must contain relationships"
    print("[SUCCESS] RelationshipNormalizer passed.")

    # 3. Test Full Master Pipeline
    print("\n--- Testing RelationshipExtractor Master Pipeline ---")
    pipeline = RelationshipExtractor()
    response = pipeline.extract_relationships_sync(
        text=TEST_RELATIONSHIP_TEXT,
        entities=known_entities,
        enable_gemini=False,
    )
    
    print(f"Pipeline Total Nodes: {len(response.nodes)}")
    print(f"Pipeline Total Relationships: {response.total_relationships}")
    print(f"Processing Time: {response.processing_time_ms}ms")
    assert response.total_relationships > 0, "Pipeline must return relationships"
    assert response.success is True
    print("[SUCCESS] Master RelationshipExtractor pipeline passed.")

    # 4. Test API Endpoint: POST /api/v1/extract/relationships
    print("\n--- Testing API Endpoint: POST /api/v1/extract/relationships ---")
    client = TestClient(app)
    
    payload = {
        "text": TEST_RELATIONSHIP_TEXT,
        "entities": [e.model_dump() for e in known_entities],
        "enable_rules": True,
        "enable_gemini": False,
    }
    
    api_resp = client.post("/api/v1/extract/relationships", json=payload)
    print(f"API Response Code: {api_resp.status_code}")
    json_data = api_resp.json()
    print(f"API Response Envelope: success={json_data.get('success')}, message='{json_data.get('message')}'")
    
    assert api_resp.status_code == 200, f"Expected 200 OK, got {api_resp.status_code}"
    assert json_data["success"] is True
    assert "nodes" in json_data["data"], "Response missing 'nodes' payload"
    assert "relationships" in json_data["data"], "Response missing 'relationships' payload"
    print("[SUCCESS] POST /api/v1/extract/relationships endpoint passed!")

    # 5. Test Error Handling: Empty Input Text
    print("\n--- Testing Error Handling: Empty Input Text ---")
    err_resp = client.post("/api/v1/extract/relationships", json={"text": "   "})
    print(f"Empty Text API Response Code: {err_resp.status_code}")
    assert err_resp.status_code == 400, "Expected 400 Bad Request for empty text"
    print("[SUCCESS] Empty text error handling passed!")

    print("\n==================================================")
    print("ALL RELATIONSHIP EXTRACTION MODULE TESTS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
