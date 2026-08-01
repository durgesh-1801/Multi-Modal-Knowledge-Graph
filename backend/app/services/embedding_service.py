"""
Embedding Generation Service.

Provides dense vector embedding generation using HuggingFace SentenceTransformers
(BAAI/bge-large-en-v1.5 primary, nomic-embed-text alternative).
Auto-detects vector dimensions, normalizes embeddings (L2), and calculates cosine similarity.
"""

from typing import List, Optional, Tuple, Union
import numpy as np

from app.core.config import settings
from app.core.logging import logger
from app.schemas.embeddings import Chunk, EmbeddingResponse


class EmbeddingService:
    """
    Modular Embedding Service supporting auto-dimension discovery, batch vector generation,
    L2 normalization, and similarity math.
    """

    def __init__(self, model_name: Optional[str] = None) -> None:
        self.model_name: str = model_name or settings.EMBEDDING_MODEL
        self._model = None
        self._vector_dim: int = 1024

    def load_model(self, model_name: Optional[str] = None) -> Any:
        """
        Loads and caches the SentenceTransformer embedding model.

        Args:
            model_name: Optional HuggingFace model string.

        Returns:
            SentenceTransformer model instance or fallback marker.
        """
        target_model = model_name or self.model_name

        if self._model is None or self.model_name != target_model:
            logger.info(f"Loading SentenceTransformer embedding model: '{target_model}'")
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(target_model)
                self.model_name = target_model
                self._vector_dim = self._model.get_sentence_embedding_dimension()
                logger.info(
                    f"Successfully loaded embedding model '{target_model}' (Dimension: {self._vector_dim})"
                )
            except Exception as err:
                logger.warning(
                    f"Failed to load SentenceTransformer model '{target_model}' ({err}). Operating in fallback mode."
                )
                self._model = "FALLBACK"
                self.model_name = target_model
                self._vector_dim = 1024

        return self._model

    def get_dimension(self) -> int:
        """Returns the vector dimension size of the active model."""
        self.load_model()
        return self._vector_dim

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generates a single dense vector embedding for input text.

        Args:
            text: Raw input text.

        Returns:
            List[float]: Normalized dense float vector.
        """
        batch = self.generate_batch_embeddings([text])
        return batch[0] if batch else [0.0] * self._vector_dim

    def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generates dense vector embeddings for a batch of text strings.

        Args:
            texts: List of text strings.

        Returns:
            List[List[float]]: List of normalized dense float vectors.
        """
        if not texts:
            return []

        model = self.load_model()

        if model != "FALLBACK":
            try:
                raw_vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
                return [vec.tolist() for vec in raw_vectors]
            except Exception as err:
                logger.error(f"SentenceTransformer encoding failed: {err}")
                model = "FALLBACK"

        # Fallback dense vector generator using deterministically hashed embeddings
        logger.info(f"Generating fallback dense vectors for {len(texts)} texts (Dim: {self._vector_dim}).")
        fallback_results: List[List[float]] = []

        for text in texts:
            # Deterministic pseudo-random vector derived from text hash
            seed = sum(ord(c) for c in text) % (2**32)
            rng = np.random.RandomState(seed)
            vec = rng.randn(self._vector_dim)
            # Normalize vector to unit length
            norm_vec = self.normalize_embedding(vec.tolist())
            fallback_results.append(norm_vec)

        return fallback_results

    def generate_document_embeddings(
        self, chunks: List[Chunk]
    ) -> List[Tuple[Chunk, List[float]]]:
        """
        Generates dense embeddings for a list of Chunk models.

        Args:
            chunks: List of Chunk objects.

        Returns:
            List[Tuple[Chunk, List[float]]]: Tuples pairing each Chunk with its embedding vector.
        """
        if not chunks:
            return []

        texts = [c.chunk_text for c in chunks]
        vectors = self.generate_batch_embeddings(texts)
        return list(zip(chunks, vectors))

    @staticmethod
    def normalize_embedding(vector: List[float]) -> List[float]:
        """Performs L2 normalization on a raw float vector."""
        arr = np.array(vector, dtype=np.float32)
        norm = np.linalg.norm(arr)
        if norm == 0:
            return vector
        return (arr / norm).tolist()

    @staticmethod
    def calculate_similarity(vec1: List[float], vec2: List[float]) -> float:
        """Calculates Cosine Similarity score between two dense vectors."""
        a = np.array(vec1, dtype=np.float32)
        b = np.array(vec2, dtype=np.float32)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))
