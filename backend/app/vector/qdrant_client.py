"""
Qdrant Vector Database Client Manager.

Manages connection pool, in-memory fallbacks, collection lifecycle, vector upserts,
payload deletion, point retrieval, health status, and metadata-filtered similarity searches.
"""

from typing import Any, Dict, List, Optional, Union
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from qdrant_client.http.models import Distance, VectorParams, Filter, FieldCondition, MatchValue

from app.core.config import settings
from app.core.logging import logger


class QdrantClientManager:
    """
    Reusable Qdrant Vector DB client providing connection resilience, collection creation,
    vector storage, point deletion, and payload-filtered vector search.
    """

    def __init__(
        self, url: Optional[str] = None, api_key: Optional[str] = None
    ) -> None:
        self.url: str = url or settings.QDRANT_URL
        self.api_key: Optional[str] = api_key or settings.QDRANT_API_KEY
        self._client: Optional[QdrantClient] = None

    def connect(self) -> QdrantClient:
        """
        Establishes connection to Qdrant server. Fallbacks to in-memory mode if remote host is unavailable.
        """
        if self._client is None:
            logger.info(f"Connecting to Qdrant Vector Store at '{self.url}'")
            try:
                self._client = QdrantClient(url=self.url, api_key=self.api_key, timeout=5.0)
                # Test connectivity
                self._client.get_collections()
                logger.info("Successfully connected to remote Qdrant Vector Store.")
            except Exception as err:
                logger.warning(
                    f"Unable to connect to Qdrant host '{self.url}' ({err}). Initializing local in-memory Qdrant Client."
                )
                self._client = QdrantClient(":memory:")
                logger.info("In-memory Qdrant client initialized successfully.")

        return self._client

    def health_check(self) -> bool:
        """
        Verifies operational health of Qdrant connection.

        Returns:
            bool: True if responsive, False otherwise.
        """
        try:
            client = self.connect()
            client.get_collections()
            return True
        except Exception as err:
            logger.error(f"Qdrant health check failed: {err}")
            return False

    def create_collection(
        self, collection_name: str, vector_size: int = 1024
    ) -> bool:
        """
        Ensures a collection exists in Qdrant with Cosine distance metric.

        Args:
            collection_name: Name of the vector collection.
            vector_size: Dimensionality of vector embeddings.

        Returns:
            bool: True if created or already exists.
        """
        client = self.connect()
        try:
            if not client.collection_exists(collection_name):
                logger.info(
                    f"Creating Qdrant collection '{collection_name}' (Size: {vector_size}, Distance: Cosine)"
                )
                client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
                )
                logger.info(f"Collection '{collection_name}' successfully created.")
            return True
        except Exception as err:
            logger.error(f"Failed to create collection '{collection_name}': {err}")
            return False

    def delete_collection(self, collection_name: str) -> bool:
        """Deletes a collection from Qdrant."""
        client = self.connect()
        try:
            if client.collection_exists(collection_name):
                client.delete_collection(collection_name)
                logger.info(f"Deleted collection '{collection_name}'.")
            return True
        except Exception as err:
            logger.error(f"Failed to delete collection '{collection_name}': {err}")
            return False

    def insert_vectors(
        self,
        collection_name: str,
        vectors: List[List[float]],
        payloads: List[Dict[str, Any]],
        ids: List[Union[str, int]],
    ) -> bool:
        """Alias for upsert_vectors."""
        return self.upsert_vectors(collection_name, vectors, payloads, ids)

    def upsert_vectors(
        self,
        collection_name: str,
        vectors: List[List[float]],
        payloads: List[Dict[str, Any]],
        ids: List[Union[str, int]],
    ) -> bool:
        """
        Upserts vectors and metadata payloads into Qdrant.

        Args:
            collection_name: Target collection.
            vectors: List of dense vector float arrays.
            payloads: List of associated metadata dictionaries.
            ids: List of point IDs.

        Returns:
            bool: True if successful.
        """
        if not vectors or not ids:
            return False

        client = self.connect()

        # Ensure collection exists before upserting
        vector_dim = len(vectors[0])
        self.create_collection(collection_name, vector_size=vector_dim)

        try:
            points = [
                qmodels.PointStruct(id=pid, vector=vec, payload=pload)
                for pid, vec, pload in zip(ids, vectors, payloads)
            ]
            client.upsert(collection_name=collection_name, points=points)
            logger.info(f"Upserted {len(points)} vector points into collection '{collection_name}'.")
            return True
        except Exception as err:
            logger.error(f"Failed to upsert vectors into '{collection_name}': {err}")
            return False

    def delete_vectors(self, collection_name: str, document_id: str) -> bool:
        """
        Deletes vector points associated with a specific document_id.

        Args:
            collection_name: Target collection.
            document_id: Document identifier filter.

        Returns:
            bool: True if points deleted successfully.
        """
        client = self.connect()
        try:
            if client.collection_exists(collection_name):
                filter_obj = Filter(
                    must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
                )
                client.delete(collection_name=collection_name, points_selector=filter_obj)
                logger.info(f"Deleted vectors for document_id '{document_id}' from '{collection_name}'.")
            return True
        except Exception as err:
            logger.error(f"Failed to delete vectors for document_id '{document_id}': {err}")
            return False

    def search_vectors(
        self,
        collection_name: str,
        query_vector: List[float],
        top_k: int = 5,
        document_id: Optional[str] = None,
        source_type: Optional[str] = None,
        page_number: Optional[int] = None,
        score_threshold: Optional[float] = 0.0,
    ) -> List[Any]:
        """
        Executes semantic vector similarity search with optional payload filters.

        Args:
            collection_name: Target collection name.
            query_vector: Dense query float vector.
            top_k: Maximum results to retrieve.
            document_id: Optional document filter.
            source_type: Optional source type filter (pdf, ocr, audio, table).
            page_number: Optional page filter.
            score_threshold: Minimum similarity threshold.

        Returns:
            List[ScoredPoint]: Scored search result points.
        """
        client = self.connect()
        if not client.collection_exists(collection_name):
            logger.warning(f"Search failed: Collection '{collection_name}' does not exist.")
            return []

        # Construct Filter Conditions
        must_conditions = []
        if document_id:
            must_conditions.append(FieldCondition(key="document_id", match=MatchValue(value=document_id)))
        if source_type:
            must_conditions.append(FieldCondition(key="source_type", match=MatchValue(value=source_type)))
        if page_number is not None:
            must_conditions.append(FieldCondition(key="page_number", match=MatchValue(value=page_number)))

        search_filter = Filter(must=must_conditions) if must_conditions else None

        try:
            results = client.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=top_k,
                query_filter=search_filter,
                score_threshold=score_threshold if score_threshold > 0 else None,
            )
            logger.info(f"Qdrant vector search returned {len(results)} matches.")
            return results
        except Exception as err:
            logger.error(f"Qdrant vector search failed: {err}")
            return []

    def get_vector(self, collection_name: str, point_id: Union[str, int]) -> Optional[Any]:
        """Retrieves a single vector point by ID."""
        client = self.connect()
        try:
            pts = client.retrieve(collection_name=collection_name, ids=[point_id])
            return pts[0] if pts else None
        except Exception as err:
            logger.error(f"Failed to retrieve vector point '{point_id}': {err}")
            return None
