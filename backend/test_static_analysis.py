"""
Static Analysis & Module Import Auditor.
"""

import importlib
import sys
from pathlib import Path

backend_root = Path(__file__).parent
sys.path.insert(0, str(backend_root))

MODULES_TO_AUDIT = [
    "app.core.config",
    "app.core.logging",
    "app.dependencies",
    "app.schemas.common",
    "app.schemas.upload",
    "app.schemas.ocr",
    "app.schemas.audio",
    "app.schemas.entity",
    "app.schemas.relationship",
    "app.schemas.embeddings",
    "app.schemas.rag",
    "app.schemas.chat",
    "app.schemas.graph",
    "app.services.file_manager",
    "app.services.pdf_parser",
    "app.services.table_parser",
    "app.services.image_preprocessor",
    "app.services.ocr_service",
    "app.services.audio_preprocessor",
    "app.services.audio_transcriber",
    "app.services.spacy_extractor",
    "app.services.llm_extractor",
    "app.services.entity_normalizer",
    "app.services.entity_extractor",
    "app.services.rule_relationships",
    "app.services.llm_relationships",
    "app.services.relationship_normalizer",
    "app.services.relationship_extractor",
    "app.services.chunking_service",
    "app.services.embedding_service",
    "app.services.graph_builder",
    "app.vector.qdrant_client",
    "app.vector.vector_store",
    "app.rag.graph_interface",
    "app.rag.retriever",
    "app.rag.context_builder",
    "app.rag.prompt_builder",
    "app.rag.citation_builder",
    "app.rag.langgraph_workflow",
    "app.rag.graph_rag",
    "app.chat.query_classifier",
    "app.chat.conversation_manager",
    "app.chat.citation_service",
    "app.chat.response_generator",
    "app.chat.chat_service",
    "app.api.upload",
    "app.api.ocr",
    "app.api.audio",
    "app.api.entity",
    "app.api.relationship",
    "app.api.embeddings",
    "app.api.graph",
    "app.api.rag",
    "app.api.chat",
    "app.api",
    "app.main",
]

def audit():
    print("==================================================")
    print("Starting Static Analysis & Module Import Audit")
    print("==================================================")

    passed = 0
    failed = 0
    errors = []

    for mod_name in MODULES_TO_AUDIT:
        try:
            importlib.import_module(mod_name)
            passed += 1
            print(f"[OK] {mod_name}")
        except Exception as err:
            failed += 1
            errors.append((mod_name, str(err)))
            print(f"[FAILED] {mod_name}: {err}")

    print("\n--------------------------------------------------")
    print(f"Total Modules Audited: {len(MODULES_TO_AUDIT)}")
    print(f"Passed: {passed}, Failed: {failed}")
    
    if errors:
        print("\nFailures Detail:")
        for mod, err in errors:
            print(f"  - {mod}: {err}")
        sys.exit(1)
    else:
        print("ALL MODULE IMPORTS AND DEPENDENCIES CLEAN!")

if __name__ == "__main__":
    audit()
