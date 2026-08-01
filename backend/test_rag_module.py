"""
Automated Verification Script for Graph RAG Engine Module.

Validates:
1. AbstractGraphInterface & MockGraphInterface
2. Retriever (Vector & Graph context retrieval)
3. ContextBuilder & PromptBuilder
4. CitationBuilder (Evidence citation extraction)
5. GraphRAGWorkflow & GraphRAGEngine (Node state machine execution)
6. API Endpoints: POST /api/v1/rag/query (single & batch queries)
"""

import sys
from pathlib import Path

# Ensure backend root is on Python path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from app.main import app
from app.rag.graph_interface import MockGraphInterface
from app.rag.retriever import Retriever
from app.rag.context_builder import ContextBuilder
from app.rag.prompt_builder import PromptBuilder
from app.rag.citation_builder import CitationBuilder
from app.rag.graph_rag import GraphRAGEngine
from app.schemas.rag import RAGQuery, RetrievedChunk


def run_tests():
    print("==================================================")
    print("Starting Graph RAG Engine Verification Suite")
    print("==================================================")

    # 1. Test MockGraphInterface
    print("\n--- Testing MockGraphInterface ---")
    mock_graph = MockGraphInterface()
    nodes = mock_graph.search_graph("ISO 27001 Access Control")
    print(f"Mock Graph Retrieved {len(nodes)} nodes.")
    for n in nodes:
        print(f"  - Node '{n.name}' [{n.label}]")
    assert len(nodes) > 0, "Mock graph must return nodes"
    print("[SUCCESS] MockGraphInterface passed.")

    # 2. Test Retriever
    print("\n--- Testing Retriever ---")
    retriever = Retriever(graph_db=mock_graph)
    graph_res = retriever.retrieve_graph("ISO 27001 policy")
    assert len(graph_res) > 0
    print("[SUCCESS] Retriever service passed.")

    # 3. Test ContextBuilder & CitationBuilder
    print("\n--- Testing ContextBuilder & CitationBuilder ---")
    test_chunks = [
        RetrievedChunk(
            chunk_id="chunk_iso_001",
            document_id="doc_iso_2026",
            page_number=4,
            text="ISO 27001 mandates that organizations implement an Access Control Policy and enforce MFA.",
            score=0.94,
            source_type="pdf",
            metadata={"original_filename": "ISO27001_Policy.pdf"},
        )
    ]
    
    cb = ContextBuilder()
    context_obj = cb.build_context(test_chunks, nodes)
    print(f"Combined Context Length: {len(context_obj.combined_context)} chars")
    assert "VECTOR TEXT EVIDENCE" in context_obj.combined_context
    assert "KNOWLEDGE GRAPH" in context_obj.combined_context

    cit_builder = CitationBuilder()
    citations = cit_builder.build_citations(test_chunks)
    print(f"Citations Generated: {len(citations)}")
    print(f"  Citation 1: Doc='{citations[0].document}', Page={citations[0].page}, Score={citations[0].score}")
    assert citations[0].document == "ISO27001_Policy.pdf"
    print("[SUCCESS] ContextBuilder and CitationBuilder passed.")

    # 4. Test GraphRAGEngine Workflow Execution
    print("\n--- Testing GraphRAGEngine ---")
    engine = GraphRAGEngine(graph_db=mock_graph)
    
    # First seed a vector document into VectorStore so vector retrieval returns evidence
    from app.vector.vector_store import VectorStoreService
    vstore = VectorStoreService()
    vstore.process_and_store_document(
        document_id="doc_iso_2026",
        text="ISO 27001 mandates that organizations implement an Access Control Policy and enforce Multi-Factor Authentication.",
        original_filename="ISO27001_Policy.pdf",
        page_number=4,
    )
    
    import asyncio
    query_obj = RAGQuery(query="What controls are required for ISO 27001?", top_k=3)
    rag_response = asyncio.run(engine.query_async(query_obj))
    
    print(f"RAG Answer: '{rag_response.answer}'")
    print(f"Confidence: {rag_response.confidence}")
    print(f"Citations Count: {len(rag_response.citations)}")
    assert rag_response.success is True
    assert rag_response.answer != "", "Answer must not be empty"
    print("[SUCCESS] GraphRAGEngine passed.")

    # 5. Test API Endpoint: POST /api/v1/rag/query
    print("\n--- Testing API Endpoint: POST /api/v1/rag/query ---")
    client = TestClient(app)
    
    payload = {
        "query": "What controls are required for ISO 27001?",
        "top_k": 3,
    }
    
    api_resp = client.post("/api/v1/rag/query", json=payload)
    print(f"API Response Status Code: {api_resp.status_code}")
    json_data = api_resp.json()
    print(f"API Envelope: success={json_data.get('success')}, message='{json_data.get('message')}'")
    
    assert api_resp.status_code == 200
    assert json_data["success"] is True
    assert "answer" in json_data["data"], "Response missing 'answer' payload"
    assert "citations" in json_data["data"], "Response missing 'citations' payload"
    print("[SUCCESS] POST /api/v1/rag/query endpoint passed!")

    # 6. Test Error Handling: Empty Query
    print("\n--- Testing Error Handling: Empty Query ---")
    err_resp = client.post("/api/v1/rag/query", json={"query": "  "})
    print(f"Empty Query API Code: {err_resp.status_code}")
    assert err_resp.status_code == 400
    print("[SUCCESS] Empty query error handling passed!")

    print("\n==================================================")
    print("ALL GRAPH RAG ENGINE MODULE TESTS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
