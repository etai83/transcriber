# Local Audio Transcription Web Application - Project Plan

## Overview
A web application that receives audio recordings, transcribes them locally (no cloud APIs), supports English and Hebrew, and manages files with a local database.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│   (React/Vue or plain HTML+JS)                              │
│   - Upload audio files                                       │
│   - Display transcription history                            │
│   - View/play audio + transcription side-by-side            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Python/FastAPI)                 │
│   - REST API endpoints                                       │
│   - File management                                          │
│   - Transcription job orchestration                          │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Whisper Model  │  │   SQLite DB     │  │  File Storage   │
│  (Local STT)    │  │  (Metadata)     │  │  (Audio/Text)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Technology Stack

### Backend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | **FastAPI** (Python) | Async support, easy API creation, auto-docs |
| Transcription | **OpenAI Whisper** (local) | Free, offline, supports Hebrew & English |
| Database | **SQLite** | Lightweight, no setup, file-based |
| ORM | **SQLAlchemy** | Pythonic DB operations |

### Frontend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | **React** or **Vanilla JS** | Modern, component-based |
| Styling | **Tailwind CSS** | Rapid UI development |
| HTTP Client | **Axios** or **Fetch API** | API communication |

### Local Speech-to-Text: Whisper
- **Model**: OpenAI's Whisper (runs completely offline)
- **Variants**: 
  - `tiny` - Fastest, lower accuracy (~1GB VRAM)
  - `base` - Good balance (~1GB VRAM)
  - `small` - Better accuracy (~2GB VRAM)
  - `medium` - High accuracy (~5GB VRAM)
  - `large` - Best accuracy (~10GB VRAM)
- **Hebrew Support**: Built-in, works well with `small` model and above

---

## Database Schema

```sql
CREATE TABLE transcriptions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    filename        TEXT NOT NULL,           -- Original filename
    audio_path      TEXT NOT NULL,           -- Local path to audio file
    transcript_path TEXT,                    -- Local path to transcript .txt file
    language        TEXT DEFAULT 'auto',     -- 'en', 'he', or 'auto'
    status          TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
    duration_sec    REAL,                    -- Audio duration in seconds
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at    DATETIME,
    error_message   TEXT                     -- Error details if failed
);
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload audio file, start transcription |
| `GET` | `/api/transcriptions` | List all transcriptions |
| `GET` | `/api/transcriptions/{id}` | Get single transcription details |
| `GET` | `/api/transcriptions/{id}/audio` | Stream/download audio file |
| `GET` | `/api/transcriptions/{id}/transcript` | Get transcript text |
| `DELETE` | `/api/transcriptions/{id}` | Delete transcription + files |
| `GET` | `/api/status/{id}` | Check transcription job status |

---

## Directory Structure

```
transcriber/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Configuration settings
│   │   ├── database.py          # SQLite/SQLAlchemy setup
│   │   ├── models.py            # DB models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   └── transcriptions.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── transcriber.py   # Whisper integration
│   │       └── file_manager.py  # File operations
│   ├── storage/
│   │   ├── audio/               # Uploaded audio files
│   │   └── transcripts/         # Generated .txt files
│   ├── transcriber.db           # SQLite database
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioUploader.jsx
│   │   │   ├── TranscriptionList.jsx
│   │   │   ├── TranscriptionViewer.jsx
│   │   │   └── AudioPlayer.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── ViewTranscription.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── PLAN.md
└── README.md
```

---

## Implementation Phases

### Phase 1: Backend Foundation
1. Set up Python virtual environment
2. Install dependencies (FastAPI, Whisper, SQLAlchemy)
3. Create SQLite database and models
4. Implement file storage system
5. Create basic API endpoints (upload, list)

### Phase 2: Transcription Engine
1. Integrate Whisper model
2. Implement async transcription processing
3. Add language detection/selection (English/Hebrew)
4. Save transcripts to text files
5. Update database with results

### Phase 3: Frontend Development
1. Create React app with Vite
2. Build upload component with drag-and-drop
3. Create transcription list view
4. Build transcription detail view with audio player
5. Add loading states and error handling

### Phase 4: Integration & Polish
1. Connect frontend to backend API
2. Add CORS configuration
3. Implement real-time status updates (polling or WebSocket)
4. Add delete functionality
5. Error handling and validation

### Phase 5: Testing & Documentation
1. Test with various audio formats
2. Test Hebrew and English transcription
3. Write README with setup instructions
4. Document API endpoints

---

## Key Features

### Must Have (MVP)
- [x] Upload audio files (mp3, wav, m4a, webm)
- [x] Local transcription using Whisper
- [x] Support English and Hebrew languages
- [x] Store audio file paths in SQLite
- [x] Store transcript file paths in SQLite
- [x] List all transcriptions
- [x] View individual transcription with text
- [x] Play audio from the interface

### Nice to Have (Future)
- [ ] Real-time transcription progress
- [ ] Edit transcripts
- [ ] Export to SRT/VTT subtitles
- [ ] Batch upload multiple files
- [ ] Search through transcripts
- [ ] Speaker diarization
- [ ] Timestamp alignment

---

## Dependencies

### Backend (requirements.txt)
```
fastapi>=0.104.0
uvicorn>=0.24.0
python-multipart>=0.0.6
sqlalchemy>=2.0.0
openai-whisper>=20231117
torch>=2.0.0
pydantic>=2.0.0
python-dotenv>=1.0.0
aiofiles>=23.0.0
```

### Frontend (package.json)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.0.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^3.0.0"
  }
}
```

---

## Configuration

### Environment Variables (.env)
```env
# Whisper model size: tiny, base, small, medium, large
WHISPER_MODEL=small

# Storage paths
AUDIO_STORAGE_PATH=./storage/audio
TRANSCRIPT_STORAGE_PATH=./storage/transcripts
DATABASE_URL=sqlite:///./transcriber.db

# Server
HOST=0.0.0.0
PORT=8000

# Default language (en, he, or auto for detection)
DEFAULT_LANGUAGE=auto
```

---

## Setup Instructions (Preview)

```bash
# 1. Clone and setup backend
cd transcriber/backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# 2. Start backend server
python run.py

# 3. In another terminal, setup frontend
cd transcriber/frontend
npm install
npm run dev

# 4. Open http://localhost:5173 in browser
```

---

## Notes

### Hebrew Support
- Whisper has excellent multilingual support including Hebrew
- For best Hebrew results, use `small` model or larger
- Can auto-detect language or force specific language

### Performance Considerations
- First transcription will download the Whisper model (~1-3GB depending on size)
- Larger models = better accuracy but slower processing
- GPU acceleration recommended for large files
- Consider using `faster-whisper` for better CPU performance

### File Formats Supported
- MP3, WAV, M4A, FLAC, OGG, WEBM
- Whisper handles conversion internally via ffmpeg
- Ensure ffmpeg is installed on the system
