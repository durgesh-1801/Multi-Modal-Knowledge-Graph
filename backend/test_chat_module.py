"""
Automated Verification Script for AI Chat Orchestrator Module.

Validates:
1. QueryClassifier (Intent detection rules)
2. ConversationManager (Session tracking & message history management)
3. CitationService (Deduplication, ranking, and formatting)
4. ResponseGenerator (Output assembly)
5. ChatService (Master AI Orchestration pipeline & Graph RAG integration)
6. API Endpoints: POST /api/v1/chat, GET /api/v1/chat/history/{id}, DELETE /api/v1/chat/history/{id}, POST /api/v1/chat/clear
"""

import sys
import asyncio
from pathlib import Path

# Ensure backend root is on Python path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from app.main import app
from app.chat.query_classifier import QueryClassifier
from app.chat.conversation_manager import ConversationManager
from app.chat.citation_service import CitationService
from app.chat.chat_service import ChatService
from app.schemas.rag import Citation


def run_tests():
    print("==================================================")
    print("Starting AI Chat Orchestrator Verification Suite")
    print("==================================================")

    # 1. Test QueryClassifier
    print("\n--- Testing QueryClassifier ---")
    classifier = QueryClassifier()
    intent1 = classifier.classify("What is the ISO 27001 Access Control Policy?")
    intent2 = classifier.classify("Hello team!")
    intent3 = classifier.classify("What audit findings relate to unencrypted S3 buckets?")
    
    print(f"Query 1 Intent: '{intent1.intent}' (Conf: {intent1.confidence})")
    print(f"Query 2 Intent: '{intent2.intent}' (Conf: {intent2.confidence})")
    print(f"Query 3 Intent: '{intent3.intent}' (Conf: {intent3.confidence})")
    
    assert intent1.intent == "policy_lookup"
    assert intent2.intent == "greeting"
    assert intent3.intent == "audit_question"
    print("[SUCCESS] QueryClassifier passed.")

    # 2. Test ConversationManager
    print("\n--- Testing ConversationManager ---")
    conv_mgr = ConversationManager()
    conv = conv_mgr.create_session(conversation_id="conv_test_100")
    print(f"Session Created: ID='{conv.conversation_id}', Session='{conv.session_id}'")
    
    msg1 = conv_mgr.add_message("conv_test_100", "user", "What are the password complexity requirements?")
    msg2 = conv_mgr.add_message("conv_test_100", "assistant", "Passwords must be at least 12 characters.")
    
    history = conv_mgr.get_history("conv_test_100")
    print(f"History Length: {len(history)} messages.")
    assert len(history) == 2, "Expected 2 messages in history"
    
    summary = conv_mgr.summarize_history("conv_test_100")
    print(f"History Summary:\n{summary}")
    assert "Passwords must be" in summary
    print("[SUCCESS] ConversationManager passed.")

    # 3. Test CitationService
    print("\n--- Testing CitationService ---")
    cit_service = CitationService()
    raw_cits = [
        Citation(document="Policy.pdf", page=2, chunk_id="chk_1", snippet="Snippet 1", score=0.88, source_type="pdf"),
        Citation(document="Policy.pdf", page=2, chunk_id="chk_1", snippet="Snippet 1", score=0.88, source_type="pdf"),
        Citation(document="Policy.pdf", page=5, chunk_id="chk_2", snippet="Snippet 2", score=0.96, source_type="pdf"),
    ]
    processed_cits = cit_service.process_citations(raw_cits, max_citations=5)
    print(f"Processed Citations Count: {len(processed_cits)} (Original: {len(raw_cits)})")
    print(f"Top Ranked Citation Score: {processed_cits[0].relevance}")
    assert len(processed_cits) == 2, "Deduplication should leave 2 unique citations"
    assert processed_cits[0].relevance == 0.96, "Top citation must be score 0.96"
    print("[SUCCESS] CitationService passed.")

    # 4. Test ChatService Orchestration
    print("\n--- Testing ChatService ---")
    chat_service = ChatService()
    chat_resp = asyncio.run(chat_service.chat_async(
        query="What controls are required for ISO 27001?",
        conversation_id="conv_test_100",
    ))
    
    print(f"Chat Response Conv ID: '{chat_resp.conversation_id}'")
    print(f"Query Type: '{chat_resp.query_type}'")
    print(f"Answer: '{chat_resp.answer[:80]}...'")
    print(f"Confidence: {chat_resp.confidence}")
    print(f"Processing Time: {chat_resp.processing_time}s")
    assert chat_resp.success is True
    assert chat_resp.answer != "", "Answer must not be empty"
    print("[SUCCESS] ChatService master orchestration passed.")

    # 5. Test API Endpoints
    print("\n--- Testing API Endpoints ---")
    client = TestClient(app)

    # 5a. POST /api/v1/chat
    chat_payload = {
        "query": "Explain ISO 27001 access control requirements.",
        "conversation_id": "conv_api_200",
    }
    api_resp = client.post("/api/v1/chat", json=chat_payload)
    print(f"POST /chat Response Status Code: {api_resp.status_code}")
    json_data = api_resp.json()
    print(f"API Envelope: success={json_data.get('success')}, message='{json_data.get('message')}'")
    assert api_resp.status_code == 200
    assert json_data["success"] is True
    assert "answer" in json_data["data"], "Response missing 'answer'"
    assert json_data["data"]["conversation_id"] == "conv_api_200"

    # 5b. GET /api/v1/chat/history/conv_api_200
    hist_resp = client.get("/api/v1/chat/history/conv_api_200")
    print(f"GET /chat/history status: {hist_resp.status_code}, messages: {len(hist_resp.json().get('data', []))}")
    assert hist_resp.status_code == 200
    assert len(hist_resp.json()["data"]) >= 2

    # 5c. POST /api/v1/chat/clear
    clear_resp = client.post("/api/v1/chat/clear", json={"conversation_id": "conv_api_200"})
    print(f"POST /chat/clear status: {clear_resp.status_code}")
    assert clear_resp.status_code == 200

    # 5d. DELETE /api/v1/chat/history/conv_api_200
    del_resp = client.delete("/api/v1/chat/history/conv_api_200")
    print(f"DELETE /chat/history status: {del_resp.status_code}")
    assert del_resp.status_code == 200

    print("\n==================================================")
    print("ALL AI CHAT ORCHESTRATOR MODULE TESTS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
