"""
Audio Transcription API Router.

Provides endpoints for ingesting, validating, preprocessing, and transcribing audio recordings
(MP3, WAV, M4A, AAC, OGG, FLAC, WEBM) via OpenAI Whisper (Large-V3 / Turbo).
"""

from pathlib import Path
from typing import List, Union
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.logging import logger
from app.schemas.audio import (
    AudioUploadResponse,
    BatchTranscriptResponse,
)
from app.schemas.common import StandardResponse
from app.services.audio_preprocessor import AudioPreprocessor
from app.services.audio_transcriber import AudioTranscriber
from app.services.file_manager import FileManager

from app.core.audit import record_audit_log
from app.core.rbac import Permission
from app.core.security import require_permission
from app.schemas.rbac import UserResponse

router = APIRouter()

ALLOWED_AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".ogg",
    ".flac",
    ".webm",
}

# Initialize service instances for audio router
audio_dir = Path(settings.UPLOAD_DIRECTORY) / "audio"
file_manager = FileManager(upload_dir=audio_dir)
preprocessor = AudioPreprocessor()
transcriber = AudioTranscriber()


@router.post(
    "",
    response_model=StandardResponse[Union[AudioUploadResponse, BatchTranscriptResponse]],
    status_code=status.HTTP_200_OK,
    summary="Upload and Transcribe Audio Recordings",
    description=(
        "Ingests single or multiple audio files (MP3, WAV, M4A, AAC, OGG, FLAC, WEBM), "
        "validates formats and size limits, preprocesses audio (16kHz mono volume normalized), "
        "runs Whisper transcription, and returns timestamped segments with speaker labels."
    ),
)
async def upload_audio(
    files: List[UploadFile] = File(
        ..., description="One or multiple audio files to upload and transcribe."
    ),
    current_user: UserResponse = Depends(require_permission(Permission.UPLOAD_AUDIO)),
) -> StandardResponse[Union[AudioUploadResponse, BatchTranscriptResponse]]:
    """
    Audio upload and transcription endpoint handler.
    """
    if not files or len(files) == 0:
        logger.warning("Audio upload request received with no files attached.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio files provided in request.",
        )

    processed_responses: List[AudioUploadResponse] = []

    for file in files:
        original_filename = file.filename or "uploaded_audio.mp3"
        ext = "." + original_filename.split(".")[-1].lower() if "." in original_filename else ""

        # 1. Extension Validation
        if ext not in ALLOWED_AUDIO_EXTENSIONS:
            logger.warning(f"Audio upload rejected: Unsupported extension '{ext}'.")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported audio format '{ext}'. Supported formats: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}",
            )

        # 2. Read File Binary Content
        content = await file.read()
        if not content or len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Uploaded audio file '{original_filename}' is empty.",
            )

        # 3. Size Limit Validation
        if len(content) > settings.MAX_UPLOAD_SIZE:
            max_mb = settings.MAX_UPLOAD_SIZE / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Audio file '{original_filename}' exceeds maximum allowed size of {max_mb:.1f} MB.",
            )

        # 4. Save Audio File to Disk
        unique_filename = file_manager.generate_unique_filename(original_filename)
        saved_path = file_manager.save_file(content, unique_filename)

        try:
            # 5. Preprocess Audio (16kHz mono, volume normalized, silent edges trimmed)
            prep_wav_path, duration_sec, sample_rate = preprocessor.preprocess_audio(
                saved_path
            )

            # 6. Transcribe Audio via Whisper Service
            transcript_data = transcriber.transcribe_audio(
                file_path=prep_wav_path,
                duration_sec=duration_sec,
                sample_rate=sample_rate,
                original_file_size=len(content),
            )

            response_obj = AudioUploadResponse(
                file_name=original_filename,
                saved_filename=unique_filename,
                transcript=transcript_data,
            )
            processed_responses.append(response_obj)

        except Exception as err:
            logger.error(
                f"Transcription failure for '{original_filename}': {err}", exc_info=True
            )
            file_manager.delete_file(saved_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Audio transcription failed for '{original_filename}': {str(err)}",
            )

    if len(processed_responses) == 1:
        return StandardResponse[AudioUploadResponse](
            success=True,
            message="Audio transcribed successfully",
            data=processed_responses[0],
        )
    else:
        batch_payload = BatchTranscriptResponse(
            success=True, files=processed_responses
        )
        return StandardResponse[BatchTranscriptResponse](
            success=True,
            message="Batch audio transcription completed successfully",
            data=batch_payload,
        )
