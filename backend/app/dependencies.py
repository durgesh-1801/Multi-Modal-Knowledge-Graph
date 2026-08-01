"""
FastAPI Dependency Injection Module.

Provides reusable dependency providers for external clients and services:
- Gemini AI Client
- Qdrant Vector DB Client
- Neo4j Knowledge Graph Driver & Interface
"""

from typing import Any, AsyncGenerator, Optional
from fastapi import Depends

from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.rag.graph_interface import AbstractGraphInterface, MockGraphInterface, Neo4jGraphInterface

import socket
from urllib.parse import urlparse

# Global singleton instance for Graph Database interface
_GRAPH_INTERFACE_INSTANCE: Optional[AbstractGraphInterface] = None


def _is_neo4j_reachable(uri: str, timeout: float = 1.0) -> bool:
    try:
        parsed = urlparse(uri)
        host = parsed.hostname or "localhost"
        port = parsed.port or 7687
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def get_graph_interface(
    settings: Settings = Depends(get_settings),
) -> AbstractGraphInterface:
    """
    Dependency provider returning the Knowledge Graph Interface.
    Attempts to initialize `Neo4jGraphInterface` and falls back to `MockGraphInterface`
    if the remote Neo4j service is unreachable.
    """
    global _GRAPH_INTERFACE_INSTANCE
    if _GRAPH_INTERFACE_INSTANCE is None:
        if _is_neo4j_reachable(settings.NEO4J_URI, timeout=1.0):
            try:
                logger.info(f"Connecting to Neo4j Graph DB at '{settings.NEO4J_URI}'")
                neo4j_adapter = Neo4jGraphInterface(
                    uri=settings.NEO4J_URI,
                    auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
                    database=settings.NEO4J_DATABASE,
                )
                neo4j_adapter.get_graph_statistics()
                _GRAPH_INTERFACE_INSTANCE = neo4j_adapter
                logger.info("Successfully connected to live Neo4j database instance.")
            except Exception as err:
                logger.warning(
                    f"Unable to verify Neo4j host connection '{settings.NEO4J_URI}' ({err}). "
                    "Initializing local in-memory MockGraphInterface fallback."
                )
                _GRAPH_INTERFACE_INSTANCE = MockGraphInterface()
        else:
            logger.info(
                f"Neo4j host '{settings.NEO4J_URI}' is offline or port unreachable. "
                "Using MockGraphInterface fallback."
            )
            _GRAPH_INTERFACE_INSTANCE = MockGraphInterface()

    return _GRAPH_INTERFACE_INSTANCE


async def get_gemini_client(
    settings: Settings = Depends(get_settings),
) -> Optional[Any]:
    """
    Dependency provider for Google Gemini AI Client.
    """
    logger.debug("Resolving Gemini client dependency.")
    client: Optional[Any] = None
    try:
        yield client
    finally:
        pass


async def get_qdrant_client(
    settings: Settings = Depends(get_settings),
) -> AsyncGenerator[Optional[Any], None]:
    """
    Dependency provider for Qdrant Vector Database Client.
    """
    logger.debug("Resolving Qdrant client dependency.")
    client: Optional[Any] = None
    try:
        yield client
    finally:
        pass


async def get_neo4j_client(
    settings: Settings = Depends(get_settings),
) -> AsyncGenerator[AbstractGraphInterface, None]:
    """
    Dependency provider for Neo4j Knowledge Graph Database Client/Driver.
    """
    graph_db = get_graph_interface(settings=settings)
    try:
        yield graph_db
    finally:
        pass
