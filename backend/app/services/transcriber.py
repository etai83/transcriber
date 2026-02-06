import whisper
import torch
import subprocess
import tempfile
import os
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path
from ..config import settings


from .diarizer import diarizer_service
import traceback

class TranscriberService:
    """Service for transcribing audio files using Whisper."""
    
    _model = None
    _model_name = None
    
    @classmethod
    def get_model(cls):
        """Load and cache the Whisper model."""
        if cls._model is None or cls._model_name != settings.whisper_model:
            print(f"Loading Whisper model: {settings.whisper_model}")
            # Check for GPU availability
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"Using device: {device}")
            cls._model = whisper.load_model(settings.whisper_model, device=device)
            cls._model_name = settings.whisper_model
            print("Model loaded successfully")
        return cls._model
    
    @classmethod
    def get_audio_stats(cls, audio_path: str) -> Optional[Dict[str, float]]:
        """
        Get audio statistics using FFmpeg's volumedetect filter.
        
        Returns:
            Dictionary with mean_volume and max_volume in dB, or None if failed
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
    
    @classmethod
    def normalize_audio(cls, audio_path: str, target_db: float = -20.0) -> Optional[str]:
        """
        Normalize audio volume to a target level using FFmpeg.
        
        This is critical for browser-recorded audio which often has very low volume
        (~-70 dB) that causes Whisper to produce hallucinations.
        
        Args:
            audio_path: Path to the input audio file
            target_db: Target mean volume in dB (default -20 dB, which is good for speech)
            
        Returns:
            Path to the normalized audio file, or None if normalization failed
        """
        # First, analyze the current volume
        stats = cls.get_audio_stats(audio_path)
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
            # Also apply a limiter to prevent clipping
            # Explicitly specify format for WebM files to avoid misdetection
            cmd = ["ffmpeg", "-y"]
            if audio_path.lower().endswith('.webm'):
                cmd.extend(["-f", "matroska"])  # WebM is based on Matroska
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
            new_stats = cls.get_audio_stats(temp_path)
            if new_stats:
                print(f"After normalization: mean={new_stats['mean_volume']:.1f} dB")
            
            return temp_path
            
        except Exception as e:
            print(f"Error normalizing audio: {e}")
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            return None
    
    @classmethod
    def convert_to_wav(cls, audio_path: str) -> Optional[str]:
        """
        Convert audio file to WAV format for reliable processing.
        This fixes issues with WebM files that have missing duration metadata.
        
        Args:
            audio_path: Path to the input audio file
            
        Returns:
            Path to the converted WAV file, or None if conversion failed
        """
        temp_fd, temp_path = tempfile.mkstemp(suffix=".wav")
        os.close(temp_fd)
        
        try:
            # Build command - explicitly specify format for WebM files to avoid misdetection
            cmd = ["ffmpeg", "-y"]
            if audio_path.lower().endswith('.webm'):
                cmd.extend(["-f", "matroska"])  # WebM is based on Matroska
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
    
    @classmethod
    def trim_silence(cls, audio_path: str, threshold_db: str = "-30dB", min_duration: float = 0.5) -> str:
        """
        Remove silence from audio file using FFmpeg's silenceremove filter.
        
        Args:
            audio_path: Path to the input audio file
            threshold_db: Silence threshold in dB (default -30dB)
            min_duration: Minimum silence duration to remove in seconds
            
        Returns:
            Path to the trimmed audio file (temporary file)
        """
        # Create a temporary file for the trimmed audio
        _, ext = os.path.splitext(audio_path)
        temp_fd, temp_path = tempfile.mkstemp(suffix=ext)
        os.close(temp_fd)
        
        try:
            # Use FFmpeg silenceremove filter
            # This removes silence from the start and end, and optionally internal silence
            # Explicitly specify format for WebM files to avoid misdetection
            cmd = ["ffmpeg", "-y"]
            if audio_path.lower().endswith('.webm'):
                cmd.extend(["-f", "matroska"])  # WebM is based on Matroska
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
    
    @classmethod
    def detect_language_restricted(cls, audio_path: str) -> str:
        """
        Detect language from audio, restricted to English or Hebrew only.
        
        Whisper may detect other languages, but we force the result to be
        either 'en' or 'he' based on which has the higher probability.
        
        Args:
            audio_path: Path to the audio file (should be WAV for best results)
            
        Returns:
            Language code: 'en' or 'he'
        """
        model = cls.get_model()
        
        # Load audio and get mel spectrogram
        audio = whisper.load_audio(audio_path)
        audio = whisper.pad_or_trim(audio)
        
        # Use the model's feature dimension (n_mels)
        # large-v3 uses 128 mel bins, older models use 80
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
    
    @classmethod
    def transcribe(cls, audio_path: str, language: str = "auto", trim_silence: bool = False) -> Dict[str, Any]:
        """
        Transcribe an audio file.
        
        Args:
            audio_path: Path to the audio file
            language: Language code ('en', 'he') or 'auto' for detection
            trim_silence: Whether to remove silence from audio before transcribing
            
        Returns:
            Dictionary with transcription results
        """
        model = cls.get_model()
        
        temp_files = []  # Track all temporary files for cleanup
        transcribe_path = audio_path
        
        # Convert WebM files to WAV for reliable processing
        # WebM files from browser MediaRecorder often have missing duration metadata
        if audio_path.lower().endswith('.webm'):
            print("Converting WebM to WAV for reliable processing...")
            wav_path = cls.convert_to_wav(audio_path)
            if wav_path:
                temp_files.append(wav_path)
                transcribe_path = wav_path
                print("WebM converted to WAV successfully")
            else:
                print("WebM conversion failed, attempting to use original file")
        
        # Check audio duration - skip very short files that cause errors
        duration = cls.get_audio_duration(transcribe_path)
        print(f"Audio duration: {duration:.2f} seconds")
        if duration < 0.5:
            print(f"Audio too short ({duration:.2f}s), skipping transcription")
            # Clean up temp files before returning
            for temp_path in temp_files:
                if temp_path and os.path.exists(temp_path):
                    os.unlink(temp_path)
            return {
                "text": "",
                "language": "en",
                "source_language": language if language != "auto" else "en",
                "segments": [],
                "duration": duration
            }
        
        # Normalize audio volume - critical for browser recordings which are often very quiet
        # This fixes hallucinations caused by low volume audio (~-70 dB)
        print("Checking audio volume for normalization...")
        normalized_path = cls.normalize_audio(transcribe_path)
        if normalized_path:
            temp_files.append(normalized_path)
            transcribe_path = normalized_path
            print("Audio normalized successfully")
        
        # Optionally trim silence from audio
        if trim_silence:
            print("Trimming silence from audio...")
            trimmed_path = cls.trim_silence(transcribe_path)
            if trimmed_path != transcribe_path:
                temp_files.append(trimmed_path)
                transcribe_path = trimmed_path
                print("Silence trimmed successfully")
        
        try:
            # Prepare transcription options
            # Always translate to English
            options = {
                "verbose": False,
                "task": "translate",  # Translate all audio to English
                "condition_on_previous_text": False,  # Reduces hallucination
                "no_speech_threshold": 0.6,  # Higher threshold to filter silence
                "compression_ratio_threshold": 2.4,  # Filter out repetitive/hallucinated text
            }
            
            # Detect or set source language (restricted to English/Hebrew only)
            if language and language != "auto":
                # User specified language explicitly
                source_language = language
            else:
                # Auto-detect, but restrict to English or Hebrew only
                source_language = cls.detect_language_restricted(transcribe_path)
            
            options["language"] = source_language
            
            # Perform transcription (with translation to English)
            result = model.transcribe(transcribe_path, **options)
            
            # Check for potential hallucination indicators
            text = result["text"].strip()
            
            # Detect repetitive text (hallucination indicator)
            if cls._is_likely_hallucination(text):
                print(f"Warning: Detected likely hallucination: '{text[:100]}...'")
                text = ""  # Return empty string for likely hallucinations
            
            return {
                "text": text,
                "language": "en",  # Output is always English
                "source_language": source_language,  # Detected/specified source language (en or he)
                "segments": result.get("segments", []),
                "duration": result.get("segments", [{}])[-1].get("end", 0) if result.get("segments") else 0
            }
        finally:
            # Clean up all temporary files
            for temp_path in temp_files:
                if temp_path and os.path.exists(temp_path):
                    os.unlink(temp_path)
    
    @classmethod
    def _is_likely_hallucination(cls, text: str) -> bool:
        """
        Detect if transcription text is likely a hallucination.
        Common patterns: very short generic phrases, repetitive text, etc.
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
    
    @classmethod
    def get_audio_duration(cls, audio_path: str) -> float:
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
    
    @classmethod
    def get_supported_languages(cls) -> Dict[str, str]:
        """Return supported languages."""
        return {
            "auto": "Auto-detect",
            "en": "English",
            "he": "Hebrew"
        }
    
    @classmethod
    def transcribe_with_diarization(
        cls, 
        audio_path: str, 
        language: str = "auto", 
        trim_silence: bool = False,
        num_speakers: int = 2
    ) -> Dict[str, Any]:
        """
        Transcribe an audio file with speaker diarization.
        
        This method performs both transcription (using Whisper) and speaker
        diarization (using pyannote-audio), then merges the results to 
        produce a transcript with speaker labels.
        
        IMPORTANT: Unlike transcribe(), this method handles audio processing
        internally to ensure both Whisper and pyannote use the same processed
        audio file (WAV format with proper normalization).
        
        Args:
            audio_path: Path to the audio file
            language: Language code ('en', 'he') or 'auto' for detection
            trim_silence: Whether to remove silence from audio before transcribing
            num_speakers: Expected number of speakers for diarization
            
        Returns:
            Dictionary with transcription results including:
            - text: Plain transcript text
            - language: Output language (always 'en')
            - source_language: Detected source language
            - segments: Whisper segments (without speaker labels)
            - duration: Audio duration in seconds
            - transcript_segments: Diarized transcript data with speaker labels
        """

        model = cls.get_model()
        temp_files = []  # Track all temporary files for cleanup
        transcribe_path = audio_path
        
        try:
            # Step 1: Convert WebM files to WAV for reliable processing
            # Both Whisper and pyannote work better with WAV files
            if audio_path.lower().endswith('.webm'):
                print("Converting WebM to WAV for reliable processing...")
                wav_path = cls.convert_to_wav(audio_path)
                if wav_path:
                    temp_files.append(wav_path)
                    transcribe_path = wav_path
                    print("WebM converted to WAV successfully")
                else:
                    print("WebM conversion failed, attempting to use original file")
            
            # Check audio duration - skip very short files
            duration = cls.get_audio_duration(transcribe_path)
            print(f"Audio duration: {duration:.2f} seconds")
            if duration < 0.5:
                print(f"Audio too short ({duration:.2f}s), skipping transcription")
                return {
                    "text": "",
                    "language": "en",
                    "source_language": language if language != "auto" else "en",
                    "segments": [],
                    "duration": duration,
                    "transcript_segments": {
                        "segments": [],
                        "speakers": [],
                        "full_text": ""
                    }
                }
            
            # Step 2: Normalize audio volume - critical for browser recordings
            print("Checking audio volume for normalization...")
            normalized_path = cls.normalize_audio(transcribe_path)
            if normalized_path:
                temp_files.append(normalized_path)
                transcribe_path = normalized_path
                print("Audio normalized successfully")
            
            # Step 3: Optionally trim silence
            if trim_silence:
                print("Trimming silence from audio...")
                trimmed_path = cls.trim_silence(transcribe_path)
                if trimmed_path != transcribe_path:
                    temp_files.append(trimmed_path)
                    transcribe_path = trimmed_path
                    print("Silence trimmed successfully")
            
            # Step 4: Detect or set source language (restricted to English/Hebrew only)
            if language and language != "auto":
                # User specified language explicitly
                source_language = language
            else:
                # Auto-detect, but restrict to English or Hebrew only
                source_language = cls.detect_language_restricted(transcribe_path)
            
            # Step 5: Transcribe with Whisper
            print(f"Transcribing audio with Whisper (using: {transcribe_path})...")
            options = {
                "verbose": False,
                "task": "translate",  # Translate all audio to English
                "condition_on_previous_text": False,  # Reduces hallucination
                "no_speech_threshold": 0.6,  # Higher threshold to filter silence
                "compression_ratio_threshold": 2.4,  # Filter out repetitive/hallucinated text
                "language": source_language,  # Restricted to en/he only
            }
            
            whisper_result = model.transcribe(transcribe_path, **options)
            
            # Check for potential hallucination
            text = whisper_result["text"].strip()
            if cls._is_likely_hallucination(text):
                print(f"Warning: Detected likely hallucination: '{text[:100]}...'")
                text = ""
            
            result = {
                "text": text,
                "language": "en",  # Output is always English
                "source_language": source_language,  # Detected/specified source language (en or he)
                "segments": whisper_result.get("segments", []),
                "duration": whisper_result.get("segments", [{}])[-1].get("end", 0) if whisper_result.get("segments") else 0
            }
            
            # If transcription failed or produced empty text, skip diarization
            if not result.get("text") or not result.get("segments"):
                print("No transcript text, skipping diarization")
                result["transcript_segments"] = {
                    "segments": [],
                    "speakers": [],
                    "full_text": ""
                }
                return result
            
            # Step 6: Run diarization on the SAME processed audio file
            print(f"Running speaker diarization with {num_speakers} speakers on: {transcribe_path}")
            diarization_segments = diarizer_service.diarize(
                transcribe_path,  # Use the same processed file!
                num_speakers=num_speakers
            )
            
            # Step 7: Merge Whisper segments with diarization results
            transcript_segments = diarizer_service.merge_with_transcript(
                result["segments"],
                diarization_segments
            )
            
            result["transcript_segments"] = transcript_segments
            
            if transcript_segments.get("full_text"):
                print(f"Diarization complete: {len(transcript_segments['speakers'])} speakers detected")
            
            return result
            
        except ImportError as e:
            print(f"Diarization not available: {e}")
            # Fall back to regular transcription
            result = cls.transcribe(audio_path, language, trim_silence)
            result["transcript_segments"] = {
                "segments": [],
                "speakers": [],
                "full_text": ""
            }
            return result
        except Exception as e:
            print(f"Transcription with diarization failed: {e}")

            traceback.print_exc()
            # Fall back to regular transcription
            result = cls.transcribe(audio_path, language, trim_silence)
            result["transcript_segments"] = {
                "segments": [],
                "speakers": [],
                "full_text": ""
            }
            return result
        finally:
            # Clean up all temporary files AFTER both Whisper and pyannote are done
            for temp_path in temp_files:
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.unlink(temp_path)
                        print(f"Cleaned up temp file: {temp_path}")
                    except Exception as e:
                        print(f"Warning: Failed to clean up {temp_path}: {e}")


transcriber_service = TranscriberService()
