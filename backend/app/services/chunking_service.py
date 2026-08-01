"""
Document Chunking Service.

Provides text segmentation algorithms (recursive, sentence-aware, fixed-size)
with configurable chunk sizes, overlaps, and metadata preservation.
"""

import re
from typing import Any, Dict, List, Optional
from app.core.logging import logger
from app.schemas.embeddings import Chunk


class ChunkingService:
    """
    Modular Chunking Service for segmenting raw document text into graph & vector ready chunks.
    """

    def create_chunks(
        self,
        text: str,
        document_id: str,
        page_number: int = 1,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        method: str = "recursive",
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]:
        """
        Segments input text into structured Chunk models using specified strategy.

        Args:
            text: Raw input text to segment.
            document_id: Parent document identifier.
            page_number: 1-indexed page number.
            chunk_size: Target character length per chunk.
            chunk_overlap: Overlap character length between adjacent chunks.
            method: Chunking strategy ('recursive', 'sentence', or 'fixed').
            extra_metadata: Custom key-value pairs attached to chunk metadata.

        Returns:
            List[Chunk]: List of generated text chunks.
        """
        if not text or not text.strip():
            return []

        logger.info(
            f"Chunking document '{document_id}' (Page {page_number}) using method '{method}' "
            f"(Size: {chunk_size}, Overlap: {chunk_overlap})"
        )

        clean_text = text.strip()
        metadata_base = extra_metadata.copy() if extra_metadata else {}

        raw_str_chunks: List[str] = []

        if method == "sentence":
            raw_str_chunks = self._sentence_aware_chunking(clean_text, chunk_size, chunk_overlap)
        elif method == "fixed":
            raw_str_chunks = self._fixed_size_chunking(clean_text, chunk_size, chunk_overlap)
        else:
            # Default: Recursive splitting on paragraphs -> sentences -> words
            raw_str_chunks = self._recursive_chunking(clean_text, chunk_size, chunk_overlap)

        chunks: List[Chunk] = []
        for idx, chunk_str in enumerate(raw_str_chunks):
            cid = f"{document_id}_p{page_number}_chk_{idx}"
            chunks.append(
                Chunk(
                    chunk_id=cid,
                    document_id=document_id,
                    page_number=page_number,
                    chunk_text=chunk_str,
                    metadata={
                        **metadata_base,
                        "chunk_index": idx,
                        "char_length": len(chunk_str),
                    },
                )
            )

        logger.info(f"Generated {len(chunks)} chunks for document '{document_id}'.")
        return chunks

    def _fixed_size_chunking(
        self, text: str, chunk_size: int, chunk_overlap: int
    ) -> List[str]:
        """Fixed-character window slicing with overlap."""
        chunks: List[str] = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunk_str = text[start:end].strip()
            if chunk_str:
                chunks.append(chunk_str)
            start += max(1, chunk_size - chunk_overlap)

        return chunks

    def _sentence_aware_chunking(
        self, text: str, chunk_size: int, chunk_overlap: int
    ) -> List[str]:
        """Sentence boundary chunking ensuring sentences are not split mid-word."""
        sentences = re.split(r"(?<=[.!?\n])\s+", text)
        chunks: List[str] = []
        current_chunk: List[str] = []
        current_len = 0

        for sent in sentences:
            sent_len = len(sent)
            if current_len + sent_len > chunk_size and current_chunk:
                chunk_text = " ".join(current_chunk).strip()
                if chunk_text:
                    chunks.append(chunk_text)
                
                # Retain overlap sentences if possible
                overlap_len = 0
                new_chunk: List[str] = []
                for prev_sent in reversed(current_chunk):
                    if overlap_len + len(prev_sent) <= chunk_overlap:
                        new_chunk.insert(0, prev_sent)
                        overlap_len += len(prev_sent)
                    else:
                        break
                current_chunk = new_chunk
                current_len = sum(len(s) for s in current_chunk)

            current_chunk.append(sent)
            current_len += sent_len

        if current_chunk:
            final_str = " ".join(current_chunk).strip()
            if final_str:
                chunks.append(final_str)

        return chunks

    def _recursive_chunking(
        self, text: str, chunk_size: int, chunk_overlap: int
    ) -> List[str]:
        """Hierarchical recursive text splitting by paragraphs, newlines, and sentences."""
        separators = ["\n\n", "\n", ". ", " ", ""]
        return self._split_recursive(text, separators, chunk_size, chunk_overlap)

    def _split_recursive(
        self, text: str, separators: List[str], chunk_size: int, chunk_overlap: int
    ) -> List[str]:
        """Internal recursive helper function for hierarchical splitting."""
        final_chunks: List[str] = []
        if len(text) <= chunk_size or not separators:
            return [text.strip()] if text.strip() else []

        sep = separators[0]
        next_seps = separators[1:]

        splits = text.split(sep) if sep else list(text)
        current_doc: List[str] = []
        current_len = 0

        for s in splits:
            if current_len + len(s) + len(sep) > chunk_size:
                if current_doc:
                    chunk_text = sep.join(current_doc).strip()
                    if len(chunk_text) > chunk_size and next_seps:
                        final_chunks.extend(
                            self._split_recursive(chunk_text, next_seps, chunk_size, chunk_overlap)
                        )
                    elif chunk_text:
                        final_chunks.append(chunk_text)
                    current_doc = []
                    current_len = 0

            current_doc.append(s)
            current_len += len(s) + len(sep)

        if current_doc:
            remainder_text = sep.join(current_doc).strip()
            if len(remainder_text) > chunk_size and next_seps:
                final_chunks.extend(
                    self._split_recursive(remainder_text, next_seps, chunk_size, chunk_overlap)
                )
            elif remainder_text:
                final_chunks.append(remainder_text)

        return final_chunks
