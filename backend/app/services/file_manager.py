"""
File Manager Service.

Isolates all file, directory, and filesystem storage operations:
- Directory creation & isolation
- Unique filename generation with collision avoidance
- File validation (MIME, PDF magic bytes, size limits, password/corruption checks)
- Asynchronous and synchronous file saving & deletion
"""

import uuid
from pathlib import Path
from typing import Union
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.core.logging import logger


class FileManager:
    """
    Isolated service handling document upload verification, file persistence,
    validation, and filesystem operations.
    """

    def __init__(self, upload_dir: Union[str, Path] = None) -> None:
        """
        Initializes the FileManager instance.

        Args:
            upload_dir: Target directory path for storing uploaded files.
        """
        self.upload_dir: Path = (
            Path(upload_dir) if upload_dir else Path(settings.UPLOAD_DIRECTORY) / "pdfs"
        )
        self.ensure_directory_exists(self.upload_dir)

    @staticmethod
    def ensure_directory_exists(directory_path: Path) -> Path:
        """
        Ensures that a specified directory exists, creating parent folders if needed.

        Args:
            directory_path: Absolute or relative directory Path object.

        Returns:
            Path: The resolved directory path.
        """
        directory_path.mkdir(parents=True, exist_ok=True)
        return directory_path

    @staticmethod
    def generate_unique_filename(original_filename: str) -> str:
        """
        Generates a unique, collision-safe filename preserving the original extension.

        Args:
            original_filename: Raw original filename uploaded by the client.

        Returns:
            str: Unique filename incorporating a UUID4 hex string.
        """
        path = Path(original_filename)
        clean_stem = path.stem.replace(" ", "_")
        unique_suffix = uuid.uuid4().hex[:8]
        extension = path.suffix.lower() if path.suffix else ".pdf"
        return f"{clean_stem}_{unique_suffix}{extension}"

    async def validate_pdf(
        self, file: UploadFile, max_size_bytes: int = settings.MAX_UPLOAD_SIZE
    ) -> bytes:
        """
        Validates uploaded PDF file against type, size, magic bytes, corruption, and encryption rules.

        Args:
            file: FastAPI UploadFile object.
            max_size_bytes: Maximum allowable payload size in bytes.

        Returns:
            bytes: Complete validated binary content of the file.

        Raises:
            HTTPException: 400 Bad Request for corrupted/encrypted PDFs.
            HTTPException: 413 Payload Too Large for oversized files.
            HTTPException: 422 Unprocessable Entity for invalid file types or empty files.
        """
        filename = file.filename or "unknown.pdf"

        # 1. File Extension Check
        if not filename.lower().endswith(".pdf"):
            logger.warning(f"Validation failed: '{filename}' is not a PDF file.")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid file type for '{filename}'. Only PDF files are allowed.",
            )

        # 2. Read File Binary Content
        content: bytes = await file.read()
        await file.seek(0)  # Reset stream position

        # 3. Check for Empty File
        if not content or len(content) == 0:
            logger.warning(f"Validation failed: '{filename}' is empty (0 bytes).")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Uploaded file '{filename}' is empty.",
            )

        # 4. File Size Limit Check
        if len(content) > max_size_bytes:
            max_mb = max_size_bytes / (1024 * 1024)
            logger.warning(
                f"Validation failed: '{filename}' size ({len(content)} bytes) exceeds limit ({max_size_bytes} bytes)."
            )
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File '{filename}' exceeds maximum allowed size of {max_mb:.1f} MB.",
            )

        # 5. Magic Bytes Header Check (%PDF-)
        if not content.startswith(b"%PDF-"):
            logger.warning(
                f"Validation failed: '{filename}' does not contain valid PDF magic bytes."
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{filename}' is not a valid or well-formed PDF document.",
            )

        # 6. Corruption & Password Protection Check
        if fitz is not None:
            try:
                doc = fitz.open(stream=content, filetype="pdf")
                if doc.is_encrypted:
                    # Attempt to authenticate with empty password
                    if not doc.authenticate(""):
                        doc.close()
                        logger.warning(
                            f"Validation failed: '{filename}' is password-protected."
                        )
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"PDF document '{filename}' is password-protected.",
                        )
                
                if doc.page_count < 1:
                    doc.close()
                    logger.warning(f"Validation failed: '{filename}' has 0 pages.")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"PDF document '{filename}' contains no readable pages.",
                    )
                doc.close()
            except HTTPException:
                raise
            except Exception as err:
                logger.error(f"Validation failed: Unable to open PDF '{filename}'. Error: {err}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PDF document '{filename}' is corrupted or unreadable.",
                )
        else:
            # Fallback validation when PyMuPDF is not installed
            if b"%%EOF" not in content[-2048:]:
                logger.warning(f"Validation failed (fallback): '{filename}' missing EOF marker.")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PDF document '{filename}' is corrupted or incomplete.",
                )

        logger.info(f"PDF validation successful for file: '{filename}' ({len(content)} bytes)")
        return content

    def save_file(self, content: bytes, saved_filename: str) -> Path:
        """
        Saves binary content to disk inside the configured upload directory.

        Args:
            content: Raw file bytes to write.
            saved_filename: Unique filename destination.

        Returns:
            Path: Absolute destination file path on disk.
        """
        self.ensure_directory_exists(self.upload_dir)
        destination: Path = self.upload_dir / saved_filename
        with open(destination, "wb") as f:
            f.write(content)
        logger.info(f"Saved file to disk: '{destination.resolve()}'")
        return destination

    def delete_file(self, file_path: Union[str, Path]) -> bool:
        """
        Deletes a file from the filesystem if it exists.

        Args:
            file_path: Path to the target file.

        Returns:
            bool: True if deleted, False if file did not exist.
        """
        target = Path(file_path)
        if target.exists() and target.is_file():
            target.unlink()
            logger.info(f"Deleted file: '{target.resolve()}'")
            return True
        logger.warning(f"Attempted to delete non-existent file: '{target}'")
        return False

    def get_file_path(self, filename: str) -> Path:
        """
        Resolves the full path of a file located in the upload directory.

        Args:
            filename: Name of the file inside upload folder.

        Returns:
            Path: Resolved Path object.
        """
        return (self.upload_dir / filename).resolve()
