#!/usr/bin/env python3
"""
One-time script to download pyannote models for offline use.

Uses HuggingFace token to download:
- pyannote/speaker-diarization-3.1

After running this script once, the models are cached locally and
the system works fully offline.

Usage:
    cd backend
    source venv/bin/activate
    python scripts/download_models.py
    
If you have SSL issues (corporate proxy), run with:
    SSL_CERT_FILE="" REQUESTS_CA_BUNDLE="" python scripts/download_models.py
"""
import os
import sys
import ssl
from pathlib import Path

# Workaround for SSL certificate issues (corporate proxies, VPNs)
# This disables SSL verification - only use for downloading models
if os.environ.get("DISABLE_SSL_VERIFY") or os.environ.get("SSL_CERT_FILE") == "":
    print("WARNING: SSL verification disabled")
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    # Monkey-patch SSL context
    ssl._create_default_https_context = ssl._create_unverified_context
    
    # Set environment variable for httpx/requests
    os.environ["CURL_CA_BUNDLE"] = ""
    os.environ["REQUESTS_CA_BUNDLE"] = ""

# Try to load .env file
try:
    from dotenv import load_dotenv
    # Path to .env (one level up from scripts/)
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

# HuggingFace token for pyannote model access
# This token has been accepted for pyannote terms of service
HF_TOKEN = os.getenv("HF_TOKEN")


def download_models():
    """Download pyannote speaker diarization models."""
    print("=" * 60)
    print("Pyannote Model Downloader")
    print("=" * 60)
    print()
    
    # Check if pyannote is installed
    try:
        from pyannote.audio import Pipeline
        import torch
    except ImportError as e:
        print(f"Error: Required packages not installed: {e}")
        print("Please run: pip install -r requirements.txt")
        sys.exit(1)
    
    # Check for GPU/MPS
    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"Device: CUDA GPU")
    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        device = torch.device("mps")
        print(f"Device: Apple Silicon MPS")
    else:
        device = torch.device("cpu")
        print(f"Device: CPU")
        print("Note: Running on CPU. GPU/MPS recommended for faster diarization.")
    print()
    
    if not HF_TOKEN:
        print("Error: HF_TOKEN not found in environment or .env file.")
        print("Please set HF_TOKEN in your .env file.")
        sys.exit(1)
        
    print("Downloading pyannote/speaker-diarization-3.1...")
    print("This may take several minutes on first run.")
    print()
    
    try:
        # Note: newer versions of pyannote use 'token' instead of 'use_auth_token'
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=HF_TOKEN
        )
        pipeline.to(device)
        
        print()
        print("=" * 60)
        print("SUCCESS! Models downloaded and cached.")
        print("=" * 60)
        print()
        print("Cache location: ~/.cache/huggingface/hub/")
        print()
        print("The diarization service will now work offline.")
        print("You can run the transcriber application normally.")
        
    except Exception as e:
        print()
        print("=" * 60)
        print("ERROR: Failed to download models")
        print("=" * 60)
        print(f"Error: {e}")
        print()
        print("Troubleshooting:")
        print("1. Check your internet connection")
        print("2. If you have SSL/certificate issues, try:")
        print("   DISABLE_SSL_VERIFY=1 python scripts/download_models.py")
        print("3. Ensure the HuggingFace token is valid")
        print("4. Accept pyannote terms at: https://huggingface.co/pyannote/speaker-diarization-3.1")
        sys.exit(1)


if __name__ == "__main__":
    download_models()
