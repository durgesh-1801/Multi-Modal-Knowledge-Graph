"""
Audio Preprocessing Service.

Isolates audio ingestion, format conversion, channel downmixing (mono),
volume normalization, 16 kHz resampling, and silence trimming using Pydub / Wave.
"""

from pathlib import Path
from typing import Tuple, Union
from pydub import AudioSegment
from pydub.effects import normalize
from pydub.silence import detect_leading_silence

from app.core.logging import logger


class AudioPreprocessor:
    """
    Isolated Audio Preprocessor converting raw audio files into 16 kHz mono normalized WAV files.
    """

    def preprocess_audio(
        self, input_file_path: Union[str, Path], output_dir: Union[str, Path] = None
    ) -> Tuple[Path, float, int]:
        """
        Executes full preprocessing pipeline on input audio file.

        Args:
            input_file_path: Path to original uploaded audio file.
            output_dir: Destination folder for preprocessed WAV audio.

        Returns:
            Tuple[Path, float, int]: (preprocessed_wav_path, duration_seconds, sample_rate).
        """
        input_path = Path(input_file_path).resolve()
        logger.info(f"Initiating audio preprocessing for file: '{input_path.name}'")

        if output_dir:
            out_folder = Path(output_dir)
        else:
            out_folder = input_path.parent / "preprocessed"
        
        out_folder.mkdir(parents=True, exist_ok=True)
        output_wav_path = out_folder / f"{input_path.stem}_16k_mono.wav"

        try:
            # 1. Load Audio File via Pydub
            audio: AudioSegment = AudioSegment.from_file(input_path)

            # 2. Downmix to Mono Channel
            audio = self.convert_to_mono(audio)

            # 3. Resample to 16,000 Hz (Standard Whisper Input Rate)
            audio = self.resample(audio, target_rate=16000)

            # 4. Normalize Audio Volume Levels
            audio = self.normalize_volume(audio)

            # 5. Trim Leading and Trailing Silence
            audio = self.trim_silence(audio)

            # 6. Export as 16-bit PCM Mono WAV File
            audio.export(output_wav_path, format="wav")
            duration_sec = len(audio) / 1000.0

            logger.info(
                f"Audio preprocessing complete: '{output_wav_path.name}' (Duration: {duration_sec:.2f}s, Rate: 16000Hz)"
            )
            return output_wav_path, duration_sec, 16000

        except Exception as err:
            logger.warning(
                f"Pydub/FFmpeg preprocessing encountered error: {err}. Attempting fallback processing."
            )
            # Basic fallback for direct WAV files if FFmpeg is missing
            return self._fallback_wav_copy(input_path, output_wav_path)

    @staticmethod
    def convert_to_mono(audio: AudioSegment) -> AudioSegment:
        """Converts multi-channel stereo audio down to single-channel mono."""
        if audio.channels > 1:
            return audio.set_channels(1)
        return audio

    @staticmethod
    def resample(audio: AudioSegment, target_rate: int = 16000) -> AudioSegment:
        """Resamples audio frame rate to target frequency (16000 Hz)."""
        if audio.frame_rate != target_rate:
            return audio.set_frame_rate(target_rate)
        return audio

    @staticmethod
    def normalize_volume(audio: AudioSegment) -> AudioSegment:
        """Normalizes peak audio volume levels to prevent quiet or clipped speech."""
        return normalize(audio)

    @staticmethod
    def trim_silence(audio: AudioSegment, silence_threshold_db: int = -40) -> AudioSegment:
        """Trims leading and trailing silence from audio track."""
        try:
            start_trim = detect_leading_silence(audio, silence_threshold=silence_threshold_db)
            end_trim = detect_leading_silence(audio.reverse(), silence_threshold=silence_threshold_db)
            
            duration = len(audio)
            trimmed = audio[start_trim : duration - end_trim]
            
            # Avoid returning 0-length audio
            if len(trimmed) > 100:
                return trimmed
            return audio
        except Exception:
            return audio

    def _fallback_wav_copy(
        self, input_path: Path, output_wav_path: Path
    ) -> Tuple[Path, float, int]:
        """Fallback copy method when Pydub/FFmpeg is unavailable."""
        import shutil
        import wave

        shutil.copy(input_path, output_wav_path)
        duration_sec = 0.0
        sample_rate = 16000

        try:
            with wave.open(str(output_wav_path), "rb") as wf:
                frames = wf.getnframes()
                sample_rate = wf.getframerate()
                duration_sec = frames / float(sample_rate)
        except Exception:
            file_size = output_wav_path.stat().st_size
            # Rough fallback estimation (16kHz 16bit mono = 32,000 bytes/sec)
            duration_sec = file_size / 32000.0

        return output_wav_path, round(duration_sec, 2), sample_rate
