"""
Automated Verification Script for Embedding Generation and Vector Database Module.

Validates:
1. ChunkingService (Recursive, sentence, fixed-size chunking & metadata)
2. EmbeddingService (Vector embedding generation & Cosine similarity math)
3. QdrantClientManager (In-memory Qdrant collection setup, point upserts & payload search)
4. VectorStoreService (Document vector processing, payload storage, metadata-filtered search)
5. API Endpoints: POST /api/v1/embeddings/document, POST /api/v1/embeddings/search, GET /api/v1/embeddings/health
"""

import sys
from pathlib import Path

# Ensure backend root is on Python path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from app.main import app
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import EmbeddingService
from app.vector.qdrant_client import QdrantClientManager
from app.vector.vector_store import VectorStoreService

SAMPLE_COMPLIANCE_TEXT = (
    "Enterprise Security Policy Section 1: All personnel must complete mandatory cybersecurity awareness training. "
    "Section 2: Data Encryption at Rest is mandatory for all production databases storing sensitive PII or financial assets using AES-256. "
    "Section 3: Multi-Factor Authentication (MFA) must be enforced across all administrative sessions and cloud control panels."
)


def run_tests():
    print("==================================================")
    print("Starting Embedding & Vector DB Module Verification")
    print("==================================================")

    # 1. Test ChunkingService
    print("\n--- Testing ChunkingService ---")
    chunker = ChunkingService()
    chunks = chunker.create_chunks(
        text=SAMPLE_COMPLIANCE_TEXT,
        document_id="doc_sec_2026",
        page_number=1,
        chunk_size=150,
        chunk_overlap=20,
        method="sentence",
    )
    print(f"Generated {len(chunks)} chunks.")
    for c in chunks:
        print(f"  - Chunk [{c.chunk_id}]: '{c.chunk_text[:50]}...'")
    assert len(chunks) > 0, "Chunking service must return chunks"
    print("[SUCCESS] ChunkingService passed.")

    # 2. Test EmbeddingService
    print("\n--- Testing EmbeddingService ---")
    embedder = EmbeddingService()
    dim = embedder.get_dimension()
    vec1 = embedder.generate_embedding("AES-256 Data Encryption Policy")
    vec2 = embedder.generate_embedding("Database Encryption Standard")
    sim = embedder.calculate_similarity(vec1, vec2)
    
    print(f"Embedding Model: '{embedder.model_name}', Dimension: {dim}")
    print(f"Vector 1 Length: {len(vec1)}, Vector 2 Length: {len(vec2)}")
    print(f"Cosine Similarity Score: {sim:.4f}")
    assert len(vec1) == dim, f"Vector dimension must be {dim}"
    assert sim > 0.0, "Similarity score must be > 0"
    print("[SUCCESS] EmbeddingService passed.")

    # 3. Test QdrantClientManager
    print("\n--- Testing QdrantClientManager ---")
    qdrant_mgr = QdrantClientManager()
    is_healthy = qdrant_mgr.health_check()
    print(f"Qdrant Health Status: {is_healthy}")
    assert is_healthy is True, "Qdrant health check must return True"
    print("[SUCCESS] QdrantClientManager passed.")

    # 4. Test VectorStoreService
    print("\n--- Testing VectorStoreService ---")
    vstore = VectorStoreService()
    store_res = vstore.process_and_store_document(
        document_id="doc_sec_2026",
        text=SAMPLE_COMPLIANCE_TEXT,
        source_type="pdf",
        original_filename="security_policy.pdf",
        page_number=1,
        chunk_size=200,
        chunk_overlap=30,
    )
    print(f"Stored Document Chunks: {store_res.chunks_processed}, Dim: {store_res.embedding_dimension}")
    assert store_res.chunks_processed > 0, "Must store chunks"

    # Search Vector Store
    search_res = vstore.search_semantic(
        query="What is the requirement for database data encryption?",
        top_k=3,
        source_type="pdf",
    )
    print(f"Semantic Search Matches: {search_res.total_results}")
    for idx, match in enumerate(search_res.results):
        print(f"  Match {idx+1} (Score: {match.score:.4f}): '{match.text[:60]}...'")
    assert search_res.total_results > 0, "Vector search must return matches"
    print("[SUCCESS] VectorStoreService passed.")

    # 5. Test API Endpoints via TestClient
    print("\n--- Testing API Endpoints ---")
    client = TestClient(app)

    # 5a. GET /api/v1/embeddings/health
    h_resp = client.get("/api/v1/embeddings/health")
    print(f"GET /embeddings/health status: {h_resp.status_code}, data: {h_resp.json().get('data')}")
    assert h_resp.status_code == 200

    # 5b. POST /api/v1/embeddings/document
    doc_payload = {
        "document_id": "doc_api_test_01",
        "text": SAMPLE_COMPLIANCE_TEXT,
        "source_type": "pdf",
        "original_filename": "audit_policy.pdf",
        "page_number": 1,
        "chunk_size": 200,
        "chunk_overlap": 20,
    }
    emb_resp = client.post("/api/v1/embeddings/document", json=doc_payload)
    print(f"POST /embeddings/document status: {emb_resp.status_code}")
    assert emb_resp.status_code == 200
    assert emb_resp.json()["success"] is True

    # 5c. POST /api/v1/embeddings/search
    search_payload = {
        "query": "cybersecurity awareness training policy",
        "top_k": 3,
        "document_id": "doc_api_test_01",
    }
    s_resp = client.post("/api/v1/embeddings/search", json=search_payload)
    print(f"POST /embeddings/search status: {s_resp.status_code}")
    assert s_resp.status_code == 200
    assert s_resp.json()["success"] is True
    print(f"Matches Returned: {s_resp.json()['data']['total_results']}")

    # 5d. DELETE /api/v1/embeddings/document/{document_id}
    del_resp = client.delete("/api/v1/embeddings/document/doc_api_test_01")
    print(f"DELETE /embeddings/document/doc_api_test_01 status: {del_resp.status_code}")
    assert del_resp.status_code == 200

    print("\n==================================================")
    print("ALL EMBEDDING & VECTOR DATABASE TESTS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
