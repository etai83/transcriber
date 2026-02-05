# 🎙️ Local Audio Transcriber

A professional-grade web application for local audio transcription and speaker diarization. Supports English and Hebrew with 100% offline processing using OpenAI's Whisper and Pyannote-audio.

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Python](https://img.shields.io/badge/python-3.9+-yellow)
![Node](https://img.shields.io/badge/node-18+-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## ✨ Features

- **🏆 Professional Transcription**: Powered by OpenAI Whisper for high-accuracy speech-to-text.
- **👥 Speaker Diarization**: Automatically detects and labels different speakers in a conversation.
- **🇮🇱 Native Hebrew Support**: Optimized for Hebrew and English, including automatic language detection.
- **⏺️ Advanced Recording**: Record meetings directly in the browser with pause/resume and real-time volume meters.
- **🔊 Audio Normalization**: Automatically fixes quiet recordings to prevent transcription "hallucinations".
- **✂️ Silence Removal**: Optional automatic trimming of silent periods to speed up processing.
- **📂 Local & Private**: All processing happens on your machine. No data ever leaves your computer.
- **⚡ Hardware Accelerated**: Supports CUDA (NVIDIA) and MPS (Apple Silicon) for lightning-fast processing.

## 🛠️ Tech Stack

- **Backend**: FastAPI (Python), SQLAlchemy, OpenAI Whisper, pyannote.audio
- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons
- **Database**: SQLite (No configuration required)
- **Processing**: FFmpeg for robust audio handling

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.9 or higher
- Node.js 18 or higher
- **FFmpeg** (Required for audio processing)

#### Install FFmpeg
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt update && sudo apt install ffmpeg`
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH.

### 2. Set up the Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python run.py
```
The backend will run at `http://localhost:8000`.

### 3. Set up the Frontend

In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
The application will be available at `http://localhost:5173`.

## ⚙️ Configuration

Create or edit `backend/.env` to customize behavior:

```env
# Whisper model: tiny, base, small, medium, large
WHISPER_MODEL=small

# Enable/Disable Speaker Diarization (requires ~2GB extra RAM)
ENABLE_DIARIZATION=true

# Storage paths
AUDIO_STORAGE_PATH=./storage/audio
TRANSCRIPT_STORAGE_PATH=./storage/transcripts

# Default language (en, he, or auto)
DEFAULT_LANGUAGE=auto
```

### Whisper Model Comparison

| Model | Weight | Accuracy (EN) | Accuracy (HE) | Speed |
|-------|--------|---------------|---------------|-------|
| tiny | ~39MB | Good | Fair | 🚀 Fastest |
| base | ~74MB | Good | Fair | 🏎️ Fast |
| small | ~244MB | Great | Good | 🚜 Medium |
| medium| ~769MB | Excellent | Great | 🐢 Slow |
| large | ~1.5GB | Best | Excellent | 🐌 Slowest |

## 📁 Project Structure

```
transcriber/
├── backend/
│   ├── app/
│   │   ├── services/
│   │   │   ├── transcriber.py   # Whisper integration & Normalization
│   │   │   └── diarizer.py      # Speaker diarization logic
│   │   ├── routers/             # API Endpoints
│   │   └── main.py              # FastAPI Application
│   ├── storage/                 # Local data storage
│   └── run.py                   # Server entry point
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioRecorder.jsx # Complex recording UI
│   │   │   ├── AudioUploader.jsx # Drag-and-drop upload
│   │   │   └── TranscriptionList.jsx
│   │   └── pages/                # App views
│   └── vite.config.js
└── README.md
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
