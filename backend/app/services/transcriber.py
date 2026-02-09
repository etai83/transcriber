import whisper
import torch
import subprocess
import tempfile
import os
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path
from ..config import settings
from .interfaces import TranscriptionProvider, TranscriptionResult
from .diarizer import diarizer_service
import traceback

class WhisperTranscriptionProvider(TranscriptionProvider):
    """Service for transcribing audio files using Whisper."""
    
    _model = None
    _model_name = None
    
    def get_model(self):
        """Load and cache the Whisper model."""
        if self._model is None or self._model_name != settings.whisper_model:
            print(f"Loading Whisper model: {settings.whisper_model}")
            # Check for GPU availability
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"Using device: {device}")
            self._model = whisper.load_model(settings.whisper_model, device=device)
            self._model_name = settings.whisper_model
            print("Model loaded successfully")
        return self._model
    
    def get_audio_stats(self, audio_path: str) -> Optional[Dict[str, float]]:
        """
        Get audio statistics using FFmpeg's volumedetect filter.
        """
        try:
            # Build command - explicitly specify format for WebM files to avoid misdetection
            cmd = ["ffmpeg"]
            if audio_path.lower().endswith('.webm'):
                cmd.extend(["-f", "matroska"])  # WebM is based on Matroska
            cmd.extend([
                "-i", audio_path,
                "-af", "volumedetect",
                "-f", "null", "-"
            ])
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            stderr = result.stderr
            
            # Parse the output for volume stats
            mean_volume = None
            max_volume = None
            
            for line in stderr.split('\n'):
                if 'mean_volume:' in line:
                    try:
                        mean_volume = float(line.split('mean_volume:')[1].split('dB')[0].strip())
                    except (ValueError, IndexError):
                        pass
                if 'max_volume:' in line:
                    try:
                        max_volume = float(line.split('max_volume:')[1].split('dB')[0].strip())
                    except (ValueError, IndexError):
                        pass
            
            if mean_volume is not None:
                return {"mean_volume": mean_volume, "max_volume": max_volume or mean_volume}
            return None
            
        except Exception as e:
            print(f"Error getting audio stats: {e}")
            return None
    
    def normalize_audio(self, audio_path: str, target_db: float = -20.0) -> Optional[str]:
        """
        Normalize audio volume to a target level using FFmpeg.
        """
        # First, analyze the current volume
        stats = self.get_audio_stats(audio_path)
        if not stats:
            print("Could not analyze audio volume, skipping normalization")
            return None
        
        mean_volume = stats["mean_volume"]
        print(f"Audio volume analysis: mean={mean_volume:.1f} dB, max={stats['max_volume']:.1f} dB")
        
        # Calculate gain needed
        gain = target_db - mean_volume
        
        # If audio is already reasonably loud (within 10dB of target), skip normalization
        if abs(gain) < 10:
            print(f"Audio volume is acceptable (gain would be {gain:.1f} dB), skipping normalization")
            return None
        
        # Limit gain to prevent clipping and excessive amplification
        max_gain = 50  # Maximum 50dB gain
        if gain > max_gain:
            print(f"Limiting gain from {gain:.1f} dB to {max_gain} dB to prevent issues")
            gain = max_gain
        
        print(f"Normalizing audio: applying {gain:.1f} dB gain")
        
        temp_fd, temp_path = tempfile.mkstemp(suffix=".wav")
        os.close(temp_fd)
        
        try:
            # Use FFmpeg to apply gain and normalize
            cmd = ["ffmpeg", "-y"]
            if audio_path.lower().endswith('.webm'):
                cmd.extend(["-f", "matroska"])
            cmd.extend([
                "-i", audio_path,
                "-af", f"volume={gain}dB,alimiter=limit=0.95:attack=5:release=50",
                "-ar", "16000",  # Whisper expects 16kHz
                "-ac", "1",      # Mono
                "-c:a", "pcm_s16le",  # 16-bit PCM
                temp_path
            ])
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"FFmpeg normalization error: {result.stderr}")
                os.unlink(temp_path)
                return None
            
            # Verify the normalized file
            if os.path.getsize(temp_path) < 1000:
                print("Normalized file too small")
                os.unlink(temp_path)
                return None
            
            # Log the new volume for verification
            new_stats = self.get_audio_stats(temp_path)
            if new_stats:
                print(f"After normalization: mean={new_stats['mean_volume']:.1f} dB")
            
            return temp_path
            
        except Exception as e:
            print(f"Error normalizing audio: {e}")
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            return None
    
    def convert_to_wav(self, audio_path: str) -> Optional[str]:
        """
        Convert audio file to WAV format for reliable processing.
        """
        temp_fd, temp_path = tempfile.mkstemp(suffix=".wav")
        os.close(temp_fd)
        
        try:
            cmd = ["ffmpeg", "-y"]
            if audio_path.lower().endswith('.webm'):
                cmd.extend(["-f", "matroska"])
            cmd.extend([
                "-i", audio_path,
                "-ar", "16000",  # Whisper expects 16kHz
                "-ac", "1",      # Mono
                "-c:a", "pcm_s16le",  # 16-bit PCM
                temp_path
            ])
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                print(f"FFmpeg conversion error: {result.stderr}")
                os.unlink(temp_path)
                return None
            
            # Verify the converted file has content
            if os.path.getsize(temp_path) < 1000:  # Less than 1KB
                print("Converted file too small, likely no audio content")
                os.unlink(temp_path)
                return None
                
            return temp_path
            
        except Exception as e:
            print(f"Error converting audio: {e}")
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            return None
    
    def trim_silence(self, audio_path: str, threshold_db: str = "-30dB", min_duration: float = 0.5) -> str:
        """
        Remove silence from audio file using FFmpeg's silenceremove filter.
        """
        # Create a temporary file for the trimmed audio
        _, ext = os.path.splitext(audio_path)
        temp_fd, temp_path = tempfile.mkstemp(suffix=ext)
        os.close(temp_fd)
        
        try:
            cmd = ["ffmpeg", "-y"]
            if audio_path.lower().endswith('.webm'):
                cmd.extend(["-f", "matroska"])
            cmd.extend([
                "-i", audio_path,
                "-af", f"silenceremove=start_periods=1:start_duration={min_duration}:start_threshold={threshold_db}:stop_periods=-1:stop_duration={min_duration}:stop_threshold={threshold_db}",
                "-c:a", "libmp3lame", "-q:a", "2",
                temp_path
            ])
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                print(f"FFmpeg silence removal warning: {result.stderr}")
                # If FFmpeg fails, return original path
                os.unlink(temp_path)
                return audio_path
                
            return temp_path
            
        except Exception as e:
            print(f"Error trimming silence: {e}")
            # Clean up temp file on error
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            return audio_path
    
    def detect_language_restricted(self, audio_path: str) -> str:
        """
        Detect language from audio, restricted to English or Hebrew only.
        """
        model = self.get_model()
        
        # Load audio and get mel spectrogram
        audio = whisper.load_audio(audio_path)
        audio = whisper.pad_or_trim(audio)
        
        # Use the model's feature dimension (n_mels)
        n_mels = model.dims.n_mels
        mel = whisper.log_mel_spectrogram(audio, n_mels=n_mels).to(model.device)
        
        # Detect language probabilities
        _, probs = model.detect_language(mel)
        
        # Get probabilities for English and Hebrew only
        en_prob = probs.get("en", 0)
        he_prob = probs.get("he", 0)
        
        # Choose the higher probability between the two
        detected = "en" if en_prob >= he_prob else "he"
        
        print(f"Language detection: en={en_prob:.3f}, he={he_prob:.3f} -> {detected}")
        
        return detected
    
    def _is_likely_hallucination(self, text: str) -> bool:
        """
        Detect if transcription text is likely a hallucination.
        """
        if not text:
            return False
        
        # Check for very short generic phrases that often indicate hallucination
        hallucination_phrases = [
            "thank you",
            "thanks for watching",
            "subscribe",
            "like and subscribe",
            "see you next time",
            "bye",
            "goodbye",
        ]
        
        text_lower = text.lower().strip()
        
        # Check if entire text is a common hallucination phrase
        for phrase in hallucination_phrases:
            if text_lower == phrase or text_lower == phrase + ".":
                return True
        
        # Check for single word repeated many times (e.g., "DIY DIY DIY DIY")
        words = text_lower.split()
        if len(words) >= 4:
            # Count occurrences of each word
            word_counts = {}
            for word in words:
                # Strip punctuation for comparison
                clean_word = ''.join(c for c in word if c.isalnum())
                if clean_word:
                    word_counts[clean_word] = word_counts.get(clean_word, 0) + 1
            
            # If any single word appears more than 50% of the time, it's likely hallucination
            for word, count in word_counts.items():
                if count >= 4 and count / len(words) > 0.4:
                    print(f"Detected repetitive word hallucination: '{word}' appears {count} times in {len(words)} words")
                    return True
        
        # Check for excessive repetition of phrases (same phrase repeated 3+ times)
        if len(words) >= 6:
            # Check for repeating patterns of 1-4 words
            for pattern_len in range(1, min(5, len(words) // 3 + 1)):
                pattern = ' '.join(words[:pattern_len])
                count = text_lower.count(pattern)
                if count >= 3 and len(pattern) * count > len(text_lower) * 0.5:
                    print(f"Detected repetitive phrase hallucination: '{pattern}' repeated {count} times")
                    return True
        
        return False
    
    def get_audio_duration(self, audio_path: str) -> float:
        """Get the duration of an audio file in seconds."""
        try:
            import subprocess
            result = subprocess.run(
                ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
                capture_output=True,
                text=True
            )
            return float(result.stdout.strip())
        except Exception:
            return 0.0
    
    def get_supported_languages(self) -> Dict[str, str]:
        """Return supported languages."""
        return {
            "auto": "Auto-detect",
            "en": "English",
            "he": "Hebrew"
        }

    def transcribe(
        self,
        audio_path: str, 
        language: str = "auto", 
        trim_silence: bool = False,
        num_speakers: Optional[int] = None,
        **kwargs
    ) -> TranscriptionResult:
        """
        Transcribe an audio file, optionally with speaker diarization.
        """
        model = self.get_model()
        temp_files = []  # Track all temporary files for cleanup
        transcribe_path = audio_path
        
        try:
            # Step 1: Convert WebM files to WAV for reliable processing
            if audio_path.lower().endswith('.webm'):
                print("Converting WebM to WAV for reliable processing...")
                wav_path = self.convert_to_wav(audio_path)
                if wav_path:
                    temp_files.append(wav_path)
                    transcribe_path = wav_path
                    print("WebM converted to WAV successfully")
                else:
                    print("WebM conversion failed, attempting to use original file")
            
            # Check audio duration - skip very short files
            duration = self.get_audio_duration(transcribe_path)
            print(f"Audio duration: {duration:.2f} seconds")
            if duration < 0.5:
                print(f"Audio too short ({duration:.2f}s), skipping transcription")
                return TranscriptionResult(
                    text="",
                    language="en",
                    source_language=language if language != "auto" else "en",
                    segments=[],
                    duration=duration
                )
            
            # Step 2: Normalize audio volume
            print("Checking audio volume for normalization...")
            normalized_path = self.normalize_audio(transcribe_path)
            if normalized_path:
                temp_files.append(normalized_path)
                transcribe_path = normalized_path
                print("Audio normalized successfully")
            
            # Step 3: Optionally trim silence
            if trim_silence:
                print("Trimming silence from audio...")
                trimmed_path = self.trim_silence(transcribe_path)
                if trimmed_path != transcribe_path:
                    temp_files.append(trimmed_path)
                    transcribe_path = trimmed_path
                    print("Silence trimmed successfully")
            
            # Step 4: Detect or set source language
            if language and language != "auto":
                source_language = language
            else:
                source_language = self.detect_language_restricted(transcribe_path)
            
            # Step 5: Transcribe with Whisper
            print(f"Transcribing audio with Whisper (using: {transcribe_path})...")
            options = {
                "verbose": False,
                "task": "translate",  # Translate all audio to English
                "condition_on_previous_text": False,
                "no_speech_threshold": 0.6,
                "compression_ratio_threshold": 2.4,
                "language": source_language,
            }
            
            whisper_result = model.transcribe(transcribe_path, **options)
            
            # Check for potential hallucination
            text = whisper_result["text"].strip()
            is_hallucination = self._is_likely_hallucination(text)
            if is_hallucination:
                print(f"Warning: Detected likely hallucination: '{text[:100]}...'")
            
            result = TranscriptionResult(
                text=text,
                language="en",
                source_language=source_language,
                segments=whisper_result.get("segments", []),
                duration=whisper_result.get("segments", [{}])[-1].get("end", 0) if whisper_result.get("segments") else 0,
                is_hallucination=is_hallucination
            )
            
            # If transcription failed or produced empty text, skip diarization
            if not result.text or not result.segments:
                print("No transcript text, skipping diarization")
                return result
            
            # Step 6: Run diarization if requested
            if num_speakers and num_speakers > 0:
                print(f"Running speaker diarization with {num_speakers} speakers on: {transcribe_path}")
                try:
                    diarization_segments = diarizer_service.diarize(
                        transcribe_path,  # Use the same processed file!
                        num_speakers=num_speakers
                    )

                    # Step 7: Merge Whisper segments with diarization results
                    transcript_segments = diarizer_service.merge_with_transcript(
                        result.segments,
                        diarization_segments
                    )

                    result.transcript_segments = transcript_segments

                    if transcript_segments.get("full_text"):
                        print(f"Diarization complete: {len(transcript_segments['speakers'])} speakers detected")
                except ImportError as e:
                    print(f"Diarization not available: {e}")
                except Exception as e:
                    print(f"Diarization failed: {e}")
                    traceback.print_exc()
            
            return result
            
        finally:
            # Clean up all temporary files
            for temp_path in temp_files:
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.unlink(temp_path)
                        print(f"Cleaned up temp file: {temp_path}")
                    except Exception as e:
                        print(f"Warning: Failed to clean up {temp_path}: {e}")

    # Backward compatibility wrapper for transcribe_with_diarization
    def transcribe_with_diarization(
        self,
        audio_path: str,
        language: str = "auto",
        trim_silence: bool = False,
        num_speakers: int = 2
    ) -> Dict[str, Any]:
        """Deprecated: Use transcribe with num_speakers instead."""
        result = self.transcribe(
            audio_path=audio_path,
            language=language,
            trim_silence=trim_silence,
            num_speakers=num_speakers
        )
        return result.model_dump()

# Singleton instance
transcriber_service = WhisperTranscriptionProvider()
