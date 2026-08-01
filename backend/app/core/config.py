"""
Centralized Configuration System.

This module manages application settings using Pydantic's BaseSettings.
Environment variables are automatically loaded from a `.env` file if present,
or defaulted to safe fallback values.
"""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings configuration schema.

    Attributes:
        APP_NAME: Name of the application.
        APP_VERSION: Current semantic version of the API backend.
        DEBUG: Flag to toggle development/debug features.
        GEMINI_API_KEY: Secret key for Google Gemini API integration.
        WHISPER_MODEL: Model size/variant for OpenAI Whisper audio transcription.
        EMBEDDING_MODEL: HuggingFace model string for dense vector embeddings.
        QDRANT_URL: Connection URL for Qdrant vector store.
        QDRANT_API_KEY: Optional API key for Qdrant cloud authentication.
        QDRANT_COLLECTION_NAME: Target collection name inside Qdrant.
        NEO4J_URI: Bolt connection URI for Neo4j knowledge graph.
        NEO4J_USERNAME: Username for Neo4j database authentication.
        NEO4J_PASSWORD: Password for Neo4j database authentication.
        UPLOAD_DIRECTORY: Local directory path for temporary file uploads.
        MAX_UPLOAD_SIZE: Maximum allowable upload payload size in bytes.
        LOG_LEVEL: Logging severity filter (DEBUG, INFO, WARNING, ERROR).
    """

    # Application Information
    APP_NAME: str = "Enterprise Compliance Knowledge Graph"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # AI & Model Integrations
    GEMINI_API_KEY: Optional[str] = None
    WHISPER_MODEL: str = "large-v3"
    EMBEDDING_MODEL: str = "BAAI/bge-large-en-v1.5"

    # Vector Storage Integration (Qdrant)
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_NAME: str = "compliance_documents"

    # Knowledge Graph Database Integration (Neo4j)
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "password"

    # Storage & Upload Rules
    UPLOAD_DIRECTORY: str = "uploads"
    MAX_UPLOAD_SIZE: int = 104857600  # 100 MB in bytes

    # Observability & Logging
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


@lru_cache()
def get_settings() -> Settings:
    """
    Retrieves a cached instance of application settings.

    Returns:
        Settings: Singleton instance of application configuration.
    """
    return Settings()


# Export pre-constructed settings instance for convenience across the codebase
settings: Settings = get_settings()
