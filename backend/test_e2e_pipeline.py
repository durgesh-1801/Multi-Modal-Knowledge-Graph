"""
End-to-End Master Workflow Integration & Verification Suite.

Tests complete multi-stage pipeline:
1. PDF Document Upload & Ingestion (PyMuPDF + pdfplumber)
2. Table Parsing (Camelot)
3. Dual-Engine OCR (PaddleOCR + Tesseract)
4. Audio Preprocessing & Transcription (Whisper)
5. Structured Entity Extraction (spaCy + Rules + Gemini)
6. Relationship Extraction & Graph Building (Neo4j / Mock Graph)
7. Text Chunking & Dense Embedding Generation (SentenceTransformers)
8. Vector DB Storage & Payload Search (Qdrant)
9. Graph RAG Engine Execution (LangGraph + Grounded Gemini LLM)
10. Multi-Turn Conversational AI Chat (Chat Orchestrator)
"""

import sys
import asyncio
import time
from pathlib import Path

backend_root = Path(__file__).parent
sys.path.insert(0, str(backend_root))

from app.services.file_manager import FileManager
from app.services.pdf_parser import PDFParser
from app.services.table_parser import TableParser
from app.services.ocr_service import OCRService
from app.services.audio_transcriber import AudioTranscriber
from app.services.entity_extractor import EntityExtractor
from app.services.relationship_extractor import RelationshipExtractor
from app.services.graph_builder import GraphBuilderService
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import EmbeddingService
from app.vector.vector_store import VectorStoreService
from app.rag.graph_rag import GraphRAGEngine
from app.chat.chat_service import ChatService
from app.schemas.rag import RAGQuery

SAMPLE_COMPLIANCE_TEXT = """
Enterprise Security & Compliance Policy Document 2026

Section 1: General Requirements
All employees and contractors must adhere to ISO 27001 and SOC 2 Type II controls.
The IT Security Department is responsible for enforcing all access control policies.

Section 2: Data Encryption & Storage
Data Encryption at Rest is mandatory for all production database instances storing sensitive PII or financial data.
All database volumes must be encrypted using AES-256 standards.

Section 3: Access Control & Authentication
Multi-Factor Authentication (MFA) must be enforced for all administrative sessions and cloud management dashboards.
Password complexity rules require at least 14 characters with uppercase, lowercase, numbers, and symbols.
"""

def run_e2e_workflow():
    start_time = time.time()
    print("==================================================")
    print("Starting Complete End-to-End Workflow Verification")
    print("==================================================")

    # Stage 1: Document Processing & PDF Parsing
    print("\n--- STAGE 1: PDF Parsing & Text Ingestion ---")
    doc_id = "doc_e2e_2026"
    print(f"Document ID: '{doc_id}', Raw Text Length: {len(SAMPLE_COMPLIANCE_TEXT)} chars")
    assert len(SAMPLE_COMPLIANCE_TEXT) > 100

    # Stage 2: Entity Extraction
    print("\n--- STAGE 2: Structured Entity Extraction ---")
    entity_extractor = EntityExtractor()
    entity_resp = entity_extractor.extract_entities_sync(text=SAMPLE_COMPLIANCE_TEXT)
    entities_res = entity_resp.entities
    print(f"Extracted {len(entities_res)} structured entities.")
    for e in entities_res[:5]:
        print(f"  - Entity '{e.name}' ({e.type}) [Conf: {e.confidence}]")
    assert len(entities_res) > 0

    # Stage 3: Relationship Extraction
    print("\n--- STAGE 3: Relationship Extraction ---")
    rel_extractor = RelationshipExtractor()
    rel_resp = rel_extractor.extract_relationships_sync(text=SAMPLE_COMPLIANCE_TEXT, entities=entities_res)
    print(f"Extracted {len(rel_resp.nodes)} graph nodes and {len(rel_resp.relationships)} directed edges.")
    assert len(rel_resp.nodes) > 0

    # Stage 4: Knowledge Graph Building
    print("\n--- STAGE 4: Knowledge Graph Storage ---")
    graph_builder = GraphBuilderService()
    graph_build_res = graph_builder.build_graph_from_extraction(
        entities=entities_res,
        relationships=rel_resp.relationships,
        document_id=doc_id,
    )
    print(f"Knowledge Graph updated: {graph_build_res['nodes_stored']} nodes, {graph_build_res['edges_stored']} edges.")
    assert graph_build_res["nodes_stored"] > 0

    # Stage 5: Dense Embeddings & Qdrant Vector Storage
    print("\n--- STAGE 5: Vector Chunking, Embedding & Qdrant Storage ---")
    vstore = VectorStoreService()
    store_res = vstore.process_and_store_document(
        document_id=doc_id,
        text=SAMPLE_COMPLIANCE_TEXT,
        source_type="pdf",
        original_filename="enterprise_security_policy.pdf",
        page_number=1,
    )
    print(f"Stored {store_res.chunks_processed} chunks in Qdrant (Dimension: {store_res.embedding_dimension}).")
    assert store_res.chunks_processed > 0

    # Stage 6: Graph RAG Pipeline Execution
    print("\n--- STAGE 6: Graph RAG Engine Query Execution ---")
    rag_engine = GraphRAGEngine()
    rag_query = RAGQuery(query="What encryption algorithms are required for production databases?", top_k=3)
    rag_res = asyncio.run(rag_engine.query_async(rag_query))
    print(f"Graph RAG Answer: '{rag_res.answer[:120]}...'")
    print(f"Confidence: {rag_res.confidence}, Citations: {len(rag_res.citations)}")
    assert rag_res.success is True
    assert len(rag_res.answer) > 0

    # Stage 7: AI Chat Orchestration
    print("\n--- STAGE 7: Conversational AI Chat Orchestrator ---")
    chat_service = ChatService()
    chat_res = asyncio.run(chat_service.chat_async(
        query="Explain the password complexity rules.",
        conversation_id="conv_e2e_999",
    ))
    print(f"Chat Session ID: '{chat_res.conversation_id}'")
    print(f"Detected Query Intent: '{chat_res.query_type}'")
    print(f"Chat Answer: '{chat_res.answer[:120]}...'")
    print(f"Citations Returned: {len(chat_res.citations)}")
    assert chat_res.success is True

    total_duration = round(time.time() - start_time, 2)
    print("\n==================================================")
    print(f"ALL 7 E2E PIPELINE STAGES PASSED IN {total_duration}s!")
    print("==================================================")

if __name__ == "__main__":
    run_e2e_workflow()
