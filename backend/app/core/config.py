"""
Centralized Configuration System.

This module manages application settings using Pydantic's BaseSettings.
Environment variables are automatically loaded from a `.env` file if present,
or defaulted to safe fallback values.
"""

from functools import lru_cache
from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings configuration schema.

    Loads values automatically from environment variables or .env file.
    """

    # Application Configuration
    APP_NAME: str = "Multi-Modal Knowledge Graph"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Google Gemini AI Integration
    GEMINI_API_KEY: Optional[str] = None

    # Knowledge Graph Database Integration (Neo4j)
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    NEO4J_DATABASE: str = "neo4j"
    NEO4J_MAX_CONNECTION_POOL_SIZE: int = 50

    # Vector Storage Integration (Qdrant)
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION: str = "knowledge_graph"
    QDRANT_COLLECTION_NAME: Optional[str] = None

    # Embeddings & Speech AI Models
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    WHISPER_MODEL: str = "large-v3"

    # Storage & Upload Rules
    UPLOAD_DIR: str = "uploads"
    UPLOAD_DIRECTORY: Optional[str] = None
    MAX_UPLOAD_SIZE_MB: int = 100
    MAX_UPLOAD_SIZE: Optional[int] = None
    TEMP_DIR: str = "temp"
    CACHE_DIR: str = "cache"

    # Observability & Logging
    LOG_LEVEL: str = "INFO"

    # RAG Rank Fusion Retrieval Weights
    RAG_WEIGHT_VECTOR: float = 0.45
    RAG_WEIGHT_GRAPH: float = 0.35
    RAG_WEIGHT_ENTITY: float = 0.20

    # LLM Parameters
    LLM_MODEL: str = "gemini-2.5-flash"
    TEMPERATURE: float = 0.1
    TOP_K: int = 5

    @model_validator(mode="after")
    def populate_defaults_and_fallbacks(self) -> "Settings":
        """Ensures dual-named variables and computed defaults are populated."""
        if not self.QDRANT_URL:
            self.QDRANT_URL = f"http://{self.QDRANT_HOST}:{self.QDRANT_PORT}"
        if not self.QDRANT_COLLECTION_NAME:
            self.QDRANT_COLLECTION_NAME = self.QDRANT_COLLECTION
        if not self.UPLOAD_DIRECTORY:
            self.UPLOAD_DIRECTORY = self.UPLOAD_DIR
        if not self.MAX_UPLOAD_SIZE:
            self.MAX_UPLOAD_SIZE = self.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        return self

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
