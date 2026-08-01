"""
API Router package initialization.

Aggregates all application feature sub-routers (upload, chat, ocr, audio, entity, relationship, embeddings, rag) into a master API router.
"""

from fastapi import APIRouter
from app.api.upload import router as upload_router
from app.api.chat import router as chat_router
from app.api.ocr import router as ocr_router
from app.api.audio import router as audio_router
from app.api.entity import router as entity_router
from app.api.relationship import router as relationship_router
from app.api.embeddings import router as embeddings_router
from app.api.rag import router as rag_router

api_router = APIRouter(prefix="/api/v1")

# Include feature routers
api_router.include_router(upload_router, prefix="/upload", tags=["Document Upload"])
api_router.include_router(audio_router, prefix="/upload/audio", tags=["Audio Transcription"])
api_router.include_router(chat_router, prefix="/chat", tags=["Compliance Chat & Queries"])
api_router.include_router(ocr_router, prefix="/ocr", tags=["OCR Processing"])
api_router.include_router(entity_router, prefix="/extract/entities", tags=["Entity Extraction"])
api_router.include_router(
    relationship_router, prefix="/extract/relationships", tags=["Relationship Extraction"]
)
api_router.include_router(
    embeddings_router, prefix="/embeddings", tags=["Embeddings & Vector Search"]
)
api_router.include_router(rag_router, prefix="/rag", tags=["Graph RAG Engine"])

__all__ = ["api_router"]
