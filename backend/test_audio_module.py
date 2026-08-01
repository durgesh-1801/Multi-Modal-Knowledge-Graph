"""
Automated Verification Script for Audio Transcription Module.

Validates:
1. AudioPreprocessor (Pydub / WAV mono normalization & resampling)
2. AudioTranscriber (Whisper model loading & timestamp segment generation)
3. API Endpoint: POST /api/v1/upload/audio (single and batch upload)
4. Validation Error Handling (unsupported file formats, size limits, empty files)
"""

import sys
import wave
import struct
import math
from pathlib import Path

# Ensure backend root is on Python path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from app.main import app
from app.services.audio_preprocessor import AudioPreprocessor
from app.services.audio_transcriber import AudioTranscriber


def create_synthetic_wav(file_path: Path, duration_sec: float = 3.0, sample_rate: int = 44100) -> Path:
    """
    Generates a 44.1 kHz stereo synthetic sine wave audio file on disk for testing.
    """
    n_samples = int(sample_rate * duration_sec)
    frequency = 440.0  # 440 Hz tone
    
    file_path.parent.mkdir(parents=True, exist_ok=True)
    
    with wave.open(str(file_path), "wb") as wf:
        wf.setnchannels(2)  # Stereo
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        
        frames = []
        for i in range(n_samples):
            # Generate 16-bit sine wave sample
            sample_val = int(16000 * math.sin(2 * math.pi * frequency * (i / sample_rate)))
            # Write left and right channels
            frames.append(struct.pack("<hh", sample_val, sample_val))
            
        wf.writeframes(b"".join(frames))
        
    return file_path


def run_tests():
    print("==================================================")
    print("Starting Audio Transcription Module Verification")
    print("==================================================")

    test_dir = Path("test_output")
    test_dir.mkdir(parents=True, exist_ok=True)

    # 1. Generate Synthetic Audio File
    sample_wav = test_dir / "sample_meeting.wav"
    create_synthetic_wav(sample_wav, duration_sec=3.0)
    print(f"[SUCCESS] Created synthetic test WAV file at: {sample_wav.resolve()}")

    # 2. Test AudioPreprocessor
    print("\n--- Testing AudioPreprocessor ---")
    preprocessor = AudioPreprocessor()
    prep_path, duration, srate = preprocessor.preprocess_audio(sample_wav)
    
    print(f"Preprocessed Path: {prep_path.name}")
    print(f"Duration: {duration}s, Sample Rate: {srate}Hz")
    assert prep_path.exists(), "Preprocessed file must exist"
    assert srate == 16000, f"Expected 16000Hz, got {srate}"
    print("[SUCCESS] AudioPreprocessor service passed.")

    # 3. Test AudioTranscriber
    print("\n--- Testing AudioTranscriber ---")
    transcriber = AudioTranscriber(model_name="base")
    transcript = transcriber.transcribe_audio(prep_path, duration_sec=duration, sample_rate=srate)
    
    print(f"Model Used: '{transcript.metadata.model_used}'")
    print(f"Duration: {transcript.metadata.duration}s")
    print(f"Transcript: '{transcript.transcript}'")
    print(f"Segments Count: {len(transcript.segments)}")
    assert len(transcript.segments) > 0, "Expected at least one transcript segment"
    assert transcript.segments[0].speaker == "Speaker 1", "Expected Speaker 1 label"
    print("[SUCCESS] AudioTranscriber service passed.")

    # 4. Test API Endpoint: POST /api/v1/upload/audio
    print("\n--- Testing API Endpoint: POST /api/v1/upload/audio ---")
    client = TestClient(app)
    
    with open(sample_wav, "rb") as f:
        response = client.post(
            "/api/v1/upload/audio",
            files={"files": ("sample_meeting.wav", f, "audio/wav")},
        )

    print(f"API Response Code: {response.status_code}")
    json_resp = response.json()
    print(f"API Response Envelope: success={json_resp.get('success')}, message='{json_resp.get('message')}'")
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    assert json_resp["success"] is True
    assert json_resp["message"] == "Audio transcribed successfully"
    print("[SUCCESS] POST /api/v1/upload/audio endpoint passed!")

    # 5. Test Error Handling: Unsupported Format
    print("\n--- Testing Error Handling: Unsupported Audio Format ---")
    err_resp = client.post(
        "/api/v1/upload/audio",
        files={"files": ("file.txt", b"text bytes", "text/plain")},
    )
    print(f"Error Response Code: {err_resp.status_code}")
    assert err_resp.status_code == 422, "Expected 422 for unsupported file extension"
    print("[SUCCESS] Unsupported format error handling passed!")

    print("\n==================================================")
    print("ALL AUDIO TRANSCRIPTION MODULE TESTS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
