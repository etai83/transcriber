"""
Speaker diarization service using pyannote-audio.

This service provides speaker diarization (who spoke when) for audio files.
Models can be loaded from:
1. Local models directory (backend/models/pyannote/) - for offline use
2. HuggingFace cache (~/.cache/huggingface/hub/) - if downloaded previously
3. HuggingFace Hub - downloads on first use (requires internet)

Usage:
    from app.services.diarizer import diarizer_service
    
    # Get speaker segments
    segments = diarizer_service.diarize("path/to/audio.wav", num_speakers=2)
    
    # Merge with Whisper transcript
    result = diarizer_service.merge_with_transcript(whisper_segments, diarization_segments)
"""
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import torch

# HuggingFace token for pyannote model access
HF_TOKEN = "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"

# Path to local models directory
MODELS_DIR = Path(__file__).parent.parent.parent / "models" / "pyannote"


class DiarizerService:
    """Speaker diarization service using pyannote-audio."""
    
    _pipeline = None
    _device = None
    
    @classmethod
    def _load_local_pipeline(cls):
        """
        Load the diarization pipeline from local model files.
        
        This constructs the pipeline manually using locally downloaded models,
        avoiding network requests entirely.
        
        The speaker-diarization-3.1 pipeline uses AgglomerativeClustering 
        (not VBx/PLDA), so we don't need PLDA models.
        """
        from pyannote.audio.pipelines import SpeakerDiarization
        from pyannote.audio import Model
        
        segmentation_dir = MODELS_DIR / "segmentation-3.0"
        embedding_dir = MODELS_DIR / "wespeaker-voxceleb-resnet34-LM"
        
        # Check all required files exist
        required_files = [
            segmentation_dir / "config.yaml",
            segmentation_dir / "pytorch_model.bin",
            embedding_dir / "config.yaml",
            embedding_dir / "pytorch_model.bin",
        ]
        
        for f in required_files:
            if not f.exists():
                raise FileNotFoundError(f"Missing model file: {f}")
        
        print(f"Loading segmentation model from: {segmentation_dir}")
        segmentation_model = Model.from_pretrained(segmentation_dir / "pytorch_model.bin")
        
        print(f"Loading embedding model from: {embedding_dir}")
        embedding_model = Model.from_pretrained(embedding_dir / "pytorch_model.bin")
        
        
        # Create the pipeline with local models using AgglomerativeClustering
        pipeline = SpeakerDiarization(
            segmentation=segmentation_model,
            embedding=embedding_model,
            clustering="AgglomerativeClustering",
            segmentation_batch_size=32,
            embedding_batch_size=32,
            embedding_exclude_overlap=True,
        )
        
        # Set default parameters (from the speaker-diarization-3.1 config)
        pipeline.instantiate({
            "clustering": {
                "method": "centroid",
                "min_cluster_size": 12,
                "threshold": 0.7045654963945799,
            },
            "segmentation": {
                "min_duration_off": 0.0,
            },
        })
        
        return pipeline
    
    @classmethod
    def get_pipeline(cls):
        """
        Lazily load the pyannote diarization pipeline.
        
        The pipeline is loaded once and cached for subsequent calls.
        
        Loading order:
        1. Local models directory (backend/models/pyannote/)
        2. HuggingFace cache (offline mode)
        3. HuggingFace Hub (online download)
        """
        if cls._pipeline is None:
            print("Loading pyannote speaker diarization pipeline...")
            
            try:
                from pyannote.audio import Pipeline
            except ImportError:
                raise ImportError(
                    "pyannote.audio is not installed. "
                    "Run: pip install pyannote.audio>=3.1.0"
                )
            
            # Determine device
            if torch.cuda.is_available():
                cls._device = torch.device("cuda")
                print("Using GPU for diarization")
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                cls._device = torch.device("mps")
                print("Using Apple Silicon MPS for diarization")
            else:
                cls._device = torch.device("cpu")
                print("Using CPU for diarization (this may be slow)")
            
            # Option 1: Try loading from local models directory
            segmentation_model = MODELS_DIR / "segmentation-3.0" / "pytorch_model.bin"
            embedding_model = MODELS_DIR / "wespeaker-voxceleb-resnet34-LM" / "pytorch_model.bin"
            
            if segmentation_model.exists() and embedding_model.exists():
                try:
                    print(f"Loading from local models: {MODELS_DIR}")
                    cls._pipeline = cls._load_local_pipeline()
                    cls._pipeline.to(cls._device)
                    print(f"Diarization pipeline loaded from local models on {cls._device}")
                    return cls._pipeline
                except Exception as local_error:
                    print(f"Local models load failed: {local_error}")
                    import traceback
                    traceback.print_exc()
            
            # Option 2: Try loading from HuggingFace cache (offline mode)
            try:
                print("Attempting to load from HuggingFace cache (offline mode)...")
                os.environ["HF_HUB_OFFLINE"] = "1"
                cls._pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=HF_TOKEN
                )
                cls._pipeline.to(cls._device)
                print(f"Diarization pipeline loaded from cache on {cls._device}")
                return cls._pipeline
            except Exception as cache_error:
                print(f"Cache load failed: {cache_error}")
            
            # Option 3: Try downloading from HuggingFace Hub
            print("Attempting to download models (this requires internet)...")
            os.environ["HF_HUB_OFFLINE"] = "0"
            try:
                cls._pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=HF_TOKEN
                )
                cls._pipeline.to(cls._device)
                print(f"Diarization pipeline downloaded and loaded on {cls._device}")
            except Exception as download_error:
                raise RuntimeError(
                    f"Failed to load diarization pipeline: {download_error}\n\n"
                    "To fix this, manually download the models:\n"
                    "1. See: backend/models/DOWNLOAD_INSTRUCTIONS.md\n"
                    "2. Download files from HuggingFace to backend/models/pyannote/\n"
                    "3. Restart the server"
                )
        
        return cls._pipeline
    
    @classmethod
    def diarize(
        cls, 
        audio_path: str, 
        num_speakers: Optional[int] = None,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform speaker diarization on an audio file.
        
        Args:
            audio_path: Path to the audio file
            num_speakers: Exact number of speakers (if known)
            min_speakers: Minimum number of speakers (if num_speakers not set)
            max_speakers: Maximum number of speakers (if num_speakers not set)
        
        Returns:
            List of segments: [{"start": 0.0, "end": 3.5, "speaker": "SPEAKER_00"}, ...]
        """
        import torchaudio
        
        pipeline = cls.get_pipeline()
        
        # Build diarization parameters
        params = {}
        if num_speakers is not None:
            params["num_speakers"] = num_speakers
        else:
            if min_speakers is not None:
                params["min_speakers"] = min_speakers
            if max_speakers is not None:
                params["max_speakers"] = max_speakers
        
        print(f"Diarizing audio: {audio_path}")
        if params:
            print(f"Diarization params: {params}")
        
        # Pre-load audio using torchaudio to avoid torchcodec issues
        # pyannote expects a dict with 'waveform' and 'sample_rate' keys
        waveform, sample_rate = torchaudio.load(audio_path)
        audio_input = {"waveform": waveform, "sample_rate": sample_rate}
        
        # Run diarization with pre-loaded audio
        diarization_output = pipeline(audio_input, **params)
        
        # Handle new pyannote API (DiarizeOutput dataclass) vs old API (Annotation directly)
        # New API returns DiarizeOutput with speaker_diarization attribute
        if hasattr(diarization_output, 'speaker_diarization'):
            diarization = diarization_output.speaker_diarization
        else:
            # Old API returns Annotation directly
            diarization = diarization_output
        
        # Extract segments
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": round(turn.start, 3),
                "end": round(turn.end, 3),
                "speaker": speaker
            })
        
        # Sort by start time
        segments.sort(key=lambda x: x["start"])
        
        print(f"Found {len(segments)} diarization segments")
        unique_speakers = set(s["speaker"] for s in segments)
        print(f"Detected speakers: {sorted(unique_speakers)}")
        
        return segments
    
    @classmethod
    def merge_with_transcript(
        cls, 
        whisper_segments: List[Dict], 
        diarization_segments: List[Dict]
    ) -> Dict[str, Any]:
        """
        Merge Whisper transcript segments with speaker diarization.
        
        Assigns speaker labels to each transcript segment based on 
        which speaker has the most temporal overlap with that segment,
        then consolidates consecutive segments from the same speaker
        into paragraphs.
        
        Args:
            whisper_segments: Segments from Whisper with 'start', 'end', 'text'
            diarization_segments: Segments from diarize() with 'start', 'end', 'speaker'
        
        Returns:
            Dict with:
            - segments: List of consolidated segments (paragraphs) with speaker labels
            - raw_segments: List of original segments with speaker labels (for detailed view)
            - speakers: List of unique speaker IDs
            - full_text: Formatted transcript with speaker labels
        """
        # First, assign speakers to each Whisper segment
        raw_segments = []
        
        for seg in whisper_segments:
            start = seg.get("start", 0)
            end = seg.get("end", 0)
            text = seg.get("text", "").strip()
            
            # Skip empty segments
            if not text:
                continue
            
            # Find speaker with most overlap
            speaker = cls._find_speaker_for_segment(start, end, diarization_segments)
            
            raw_segments.append({
                "start": round(start, 3),
                "end": round(end, 3),
                "text": text,
                "speaker": speaker
            })
        
        # Consolidate consecutive segments from the same speaker into paragraphs
        consolidated_segments = cls._consolidate_speaker_segments(raw_segments)
        
        # Get unique speakers
        speakers = sorted(set(s["speaker"] for s in raw_segments))
        
        # Build formatted full text with speaker labels
        full_text = cls._format_transcript_with_speakers(consolidated_segments)
        
        return {
            "segments": consolidated_segments,  # Consolidated paragraphs
            "raw_segments": raw_segments,       # Original segments for detailed view
            "speakers": speakers,
            "full_text": full_text
        }
    
    @classmethod
    def _consolidate_speaker_segments(cls, segments: List[Dict]) -> List[Dict]:
        """
        Consolidate consecutive segments from the same speaker into paragraphs.
        
        This merges all consecutive segments from SPEAKER_00, then SPEAKER_01, etc.
        into single paragraph entries, maintaining the alternating speaker order.
        
        Args:
            segments: List of segments with speaker labels
        
        Returns:
            List of consolidated segments where each entry is a paragraph
            from one speaker turn
        """
        if not segments:
            return []
        
        consolidated = []
        current_speaker = None
        current_texts = []
        current_start = None
        current_end = None
        
        for seg in segments:
            speaker = seg["speaker"]
            text = seg["text"]
            start = seg["start"]
            end = seg["end"]
            
            if speaker != current_speaker:
                # Save previous speaker's consolidated segment
                if current_speaker is not None and current_texts:
                    consolidated.append({
                        "start": current_start,
                        "end": current_end,
                        "speaker": current_speaker,
                        "text": " ".join(current_texts)
                    })
                
                # Start new speaker turn
                current_speaker = speaker
                current_texts = [text]
                current_start = start
                current_end = end
            else:
                # Continue same speaker - append text and extend end time
                current_texts.append(text)
                current_end = end
        
        # Don't forget the last speaker's segment
        if current_speaker is not None and current_texts:
            consolidated.append({
                "start": current_start,
                "end": current_end,
                "speaker": current_speaker,
                "text": " ".join(current_texts)
            })
        
        return consolidated
    
    @classmethod
    def _find_speaker_for_segment(
        cls,
        start: float,
        end: float,
        diarization_segments: List[Dict]
    ) -> str:
        """
        Find the speaker with the most temporal overlap for a given time range.
        
        Args:
            start: Segment start time
            end: Segment end time
            diarization_segments: List of diarization segments
        
        Returns:
            Speaker ID (e.g., "SPEAKER_00") or "UNKNOWN"
        """
        best_speaker = "UNKNOWN"
        best_overlap = 0.0
        
        for d in diarization_segments:
            # Calculate overlap
            overlap_start = max(start, d["start"])
            overlap_end = min(end, d["end"])
            overlap = max(0.0, overlap_end - overlap_start)
            
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = d["speaker"]
        
        return best_speaker
    
    @classmethod
    def _format_transcript_with_speakers(cls, consolidated_segments: List[Dict]) -> str:
        """
        Format transcript with speaker labels from consolidated segments.
        
        Args:
            consolidated_segments: List of consolidated segments (paragraphs) with speaker labels
        
        Returns:
            Formatted string like:
            [SPEAKER_00]: Hello, how are you? I was wondering if you could help me.
            [SPEAKER_01]: I'm doing great, thanks! Sure, what do you need?
        """
        if not consolidated_segments:
            return ""
        
        lines = []
        for seg in consolidated_segments:
            speaker = seg["speaker"]
            text = seg["text"]
            lines.append(f"[{speaker}]: {text}")
        
        return "\n".join(lines)
    
    @classmethod
    def segments_to_json(cls, result: Dict[str, Any]) -> str:
        """
        Convert diarization result to JSON string for database storage.
        
        Args:
            result: Result from merge_with_transcript()
        
        Returns:
            JSON string
        """
        return json.dumps(result, ensure_ascii=False, indent=2)
    
    @classmethod
    def segments_from_json(cls, json_str: str) -> Dict[str, Any]:
        """
        Parse diarization result from JSON string.
        
        Args:
            json_str: JSON string from database
        
        Returns:
            Dict with segments, speakers, and full_text
        """
        if not json_str:
            return {"segments": [], "speakers": [], "full_text": ""}
        return json.loads(json_str)


# Singleton instance
diarizer_service = DiarizerService()
