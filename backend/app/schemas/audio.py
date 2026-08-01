"""
Audio Transcription Schemas.

Defines Pydantic models for transcript segments, audio metadata, complete audio transcripts,
single audio upload responses, and batch transcription payloads.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class TranscriptSegment(BaseModel):
    """
    Individual timestamped text segment from audio transcription with speaker placeholder.
    """

    start: float = Field(..., ge=0.0, description="Start timestamp of segment in seconds.")
    end: float = Field(..., ge=0.0, description="End timestamp of segment in seconds.")
    text: str = Field(..., description="Transcribed text content of segment.")
    speaker: str = Field(
        default="Speaker 1",
        description="Speaker identity label (Placeholder for future diarization module).",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "start": 0.0,
                "end": 5.4,
                "text": "Welcome to the enterprise compliance policy briefing.",
                "speaker": "Speaker 1",
            }
        }
    }


class TranscriptMetadata(BaseModel):
    """
    Technical and execution metadata for audio transcription.
    """

    duration: float = Field(..., ge=0.0, description="Audio duration in seconds.")
    sample_rate: int = Field(default=16000, description="Audio sampling rate in Hz.")
    file_size_bytes: int = Field(..., description="Size of uploaded audio file in bytes.")
    model_used: str = Field(
        ..., description="Whisper model variant utilized (e.g. 'large-v3' or 'turbo')."
    )
    language: str = Field(
        default="en", description="Detected or configured audio spoken language code."
    )
    processing_time_ms: float = Field(
        ..., description="Total transcription processing time in milliseconds."
    )
    confidence: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, description="Optional average transcription confidence."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "duration": 120.5,
                "sample_rate": 16000,
                "file_size_bytes": 1048576,
                "model_used": "large-v3",
                "language": "en",
                "processing_time_ms": 1450.2,
                "confidence": 0.95,
            }
        }
    }


class AudioTranscript(BaseModel):
    """
    Complete audio transcription payload including full text, timestamped segments, and metadata.
    """

    transcript: str = Field(..., description="Full concatenated transcript text.")
    segments: List[TranscriptSegment] = Field(
        default_factory=list, description="Timestamped segments with speaker labels."
    )
    metadata: TranscriptMetadata = Field(..., description="Audio and processing metadata.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "transcript": "Welcome to the compliance meeting...",
                "segments": [
                    {
                        "start": 0.0,
                        "end": 5.4,
                        "text": "Welcome to the compliance meeting.",
                        "speaker": "Speaker 1",
                    }
                ],
                "metadata": {
                    "duration": 5.4,
                    "sample_rate": 16000,
                    "file_size_bytes": 524288,
                    "model_used": "large-v3",
                    "language": "en",
                    "processing_time_ms": 850.0,
                },
            }
        }
    }


class AudioUploadResponse(BaseModel):
    """
    Response model for a single processed audio file upload.
    """

    file_name: str = Field(..., description="Original name of the uploaded audio file.")
    saved_filename: str = Field(..., description="Unique filename generated for storage.")
    transcript: AudioTranscript = Field(..., description="Complete transcription payload.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "file_name": "compliance_meeting.mp3",
                "saved_filename": "compliance_meeting_f8e7d6c5.wav",
                "transcript": {
                    "transcript": "Full meeting transcript text...",
                    "segments": [],
                    "metadata": {
                        "duration": 60.0,
                        "sample_rate": 16000,
                        "file_size_bytes": 1048576,
                        "model_used": "large-v3",
                        "language": "en",
                        "processing_time_ms": 1200.0,
                    },
                },
            }
        }
    }


class BatchTranscriptResponse(BaseModel):
    """
    Response model for batch audio file transcription processing.
    """

    success: bool = Field(default=True, description="Operation status flag.")
    files: List[AudioUploadResponse] = Field(
        default_factory=list, description="List of processed audio transcription objects."
    )
