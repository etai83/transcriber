# 🎙️ Local Audio Transcriber

A professional-grade web application for local audio transcription and speaker diarization. Supports English and Hebrew with 100% offline processing using OpenAI's Whisper and Pyannote-audio.

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Python](https://img.shields.io/badge/python-3.9+-yellow)
![Node](https://img.shields.io/badge/node-18+-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## 🌟 Key UI/UX Highlights

- 🎨 **Modern Tab-Based Interface** - Switch between Upload and Record modes seamlessly
- 📊 **Real-Time Visual Feedback** - Animated status indicators, progress bars, and volume meters
- 🎨 **Color-Coded Speaker Labels** - Instantly identify different speakers in conversations (5 unique colors)
- 🔄 **Live Auto-Refresh** - Watch transcription progress update automatically
- 📂 **Expandable File List** - Collapsible views for multi-part conversations
- 💾 **Multiple Export Options** - Copy/Download as Text or JSON with full metadata
- ✏️ **Inline Editing** - Edit titles, descriptions, and transcripts directly in the UI
- 🎵 **Interactive Audio Player** - Seekable playback with visual progress indicators
- 🔁 **Smart Retry System** - Retry individual or all failed transcriptions with one click
- 🌐 **RTL Support** - Automatic text direction for Hebrew content


## ✨ Features

### 🎯 Core Capabilities

- **🏆 Professional Transcription**: Powered by OpenAI Whisper for high-accuracy speech-to-text
- **🌐 Multi-Language Translation**: All audio (English & Hebrew) is automatically translated to English output
- **👥 Speaker Diarization**: Automatically detects and labels different speakers in conversations
- **🇮🇱 Native Hebrew Support**: Optimized for Hebrew and English with automatic language detection
- **📂 100% Local & Private**: All processing happens on your machine. No data ever leaves your computer
- **⚡ Hardware Accelerated**: Supports CUDA (NVIDIA) and MPS (Apple Silicon) for lightning-fast processing

### 🎙️ Recording Features

#### Dual Recording Modes
- **📤 Upload Mode**: Drag-and-drop interface for existing audio files
  - Supports multiple audio formats (MP3, WAV, M4A, WebM, OGG)
  - Real-time file size display and validation
  - Visual drag-and-drop zone with hover effects

- **⏺️ Live Recording Mode**: Browser-based recording with advanced controls
  - **Microphone Selection**: Choose from available audio input devices
  - **Real-time Volume Meter**: Visual feedback with animated audio level display
  - **Recording Controls**:
    - Start/Stop recording
    - Pause/Resume functionality
    - Discard unwanted recordings
  - **Live Preview**: Play back your recording before transcribing
  - **Automatic Chunking**: Records in chunks for long conversations (auto-saves every 3 minutes)

### 🎬 Conversation Management

#### Chunked Recording System
- **Seamless Long Recordings**: Automatically splits recordings into manageable chunks
- **Individual Chunk Status**: Track transcription progress for each chunk
  - Visual status indicators (pending, processing, completed, failed)
  - Individual chunk playback with play/stop controls
  - Per-chunk retry capability for failed transcriptions
- **Batch Operations**: Retry all failed chunks at once
- **Real-time Updates**: Auto-refresh to show processing progress

#### Conversation Metadata
- **Editable Titles & Descriptions**: Add context to your recordings
- **Automatic Timestamps**: Track creation and update times
- **Duration Tracking**: Shows total conversation length and individual chunk durations
- **Chunk Counter**: Displays total number of chunks and completion status

### 📊 Transcription Viewing

#### Multiple View Modes
- **Plain Text View**: Clean, readable transcript without speaker labels
- **Speaker-Labeled View**: Color-coded segments showing who said what
  - Unique color per speaker (up to 5 speakers supported)
  - Speaker legend with visual color mapping
  - Timestamp display for each segment
  - Merged consecutive segments from the same speaker for readability

#### Interactive Transcript Display
- **Smart Formatting**:
  - RTL (Right-to-Left) support for Hebrew text
  - Proper whitespace and paragraph handling
  - Responsive text sizing
- **Status Indicators**:
  - Real-time processing status badges
  - Animated spinners during transcription
  - Error messages with retry options
  - Success indicators with checkmarks

### 🎵 Audio Playback

#### Full-Featured Audio Player
- **Play/Pause Controls**: Large, accessible playback buttons
- **Seekable Progress Bar**: Click to jump to any position
- **Time Display**: Current position and total duration
- **Audio Visualization**: Visual progress indicator
- **Per-Chunk Playback**: Play individual chunks in conversations

### 💾 Export & Sharing

#### Multiple Export Formats
- **Plain Text Export**:
  - Copy to clipboard (one click)
  - Download as .txt file
  - Includes speaker labels when available

- **JSON Export** (Conversations only):
  - Copy structured JSON to clipboard
  - Download as .json file
  - Includes:
    - All conversation metadata
    - Individual chunk data with timestamps
    - Speaker segments (both consolidated and raw)
    - Complete speaker information
    - Transcription statistics
    - Error messages (if any)

### ✏️ Editing & Customization

#### Inline Editing
- **Edit Transcripts**: Modify transcription text directly in the UI
- **Update Metadata**: Change titles and descriptions
- **Save/Cancel**: Clear save/cancel workflow
- **Auto-save Indicators**: Visual feedback during save operations

#### Conversation Management
- **Delete Functionality**: Remove transcriptions and conversations (with confirmation)
- **Automatic Cleanup**: Deletes associated files and database records
- **Bulk Operations**: Delete entire conversations with all chunks

### 🔧 Advanced Processing Features

#### Audio Enhancement
- **🔊 Automatic Audio Normalization**:
  - Detects quiet recordings (common with browser recording)
  - Applies optimal gain to prevent hallucinations
  - Smart limiting to prevent clipping
  - Volume analysis (mean & max dB display)

- **✂️ Silence Removal** (Optional):
  - Trims silent periods from start and end
  - Configurable threshold and duration
  - Reduces processing time for quiet sections

#### Quality Control
- **Hallucination Detection**:
  - Identifies and filters repetitive patterns
  - Removes common false transcriptions
  - Detects overly short audio segments

- **Format Conversion**:
  - Automatic WebM to WAV conversion for browser recordings
  - Ensures compatibility with Whisper processing
  - Proper audio metadata handling

### 🎨 User Interface

#### Modern, Responsive Design
- **Tab-Based Navigation**: Clean interface with Upload and Record modes
- **Visual Status Indicators**:
  - Color-coded status badges (pending/processing/completed/failed)
  - Animated loading spinners
  - Progress indicators
  - Icon-based state visualization

- **Responsive Layout**:
  - Adapts to different screen sizes
  - Hover effects and transitions
  - Intuitive button placement
  - Clear visual hierarchy

#### Visual Feedback
- **Real-time Updates**:
  - Auto-polling during processing
  - Live status updates
  - Immediate visual feedback on actions

- **File List View**:
  - Sortable by date (newest first)
  - Status filtering
  - Quick access to view/play/delete
  - Visual grouping of conversations vs. single files
  - **Expandable Chunks**: Click to expand multi-part conversations to see individual chunk status
  - Inline chunk preview with truncated transcript text

#### Accessibility Features
- **RTL Language Support**: Automatic text direction for Hebrew
- **Clear Icons**: Lucide icon set for intuitive navigation
- **Tooltips**: Helpful hints on hover
- **Keyboard-Friendly**: Standard form controls and navigation

## 🎯 User Experience

### Common Workflows

#### Quick Single-File Transcription
1. Navigate to the **Upload File** tab
2. Drag and drop your audio file (or click to browse)
3. File automatically begins transcription after upload
4. View real-time progress with status indicators
5. Access your completed transcript with play, copy, and download options

#### Recording & Transcribing a Meeting
1. Switch to the **Record** tab
2. Select your preferred microphone from the dropdown
3. Click **Start Recording** and monitor volume levels
4. Use **Pause/Resume** during breaks
5. Click **Stop** when finished — transcription begins automatically
6. View your conversation with speaker labels (if diarization is enabled)

#### Managing Long Conversations
1. Long recordings are automatically split into 3-minute chunks
2. Each chunk transcribes independently (parallel processing)
3. Track progress for individual chunks in the conversation view
4. Retry failed chunks individually or all at once
5. Export complete conversation as plain text or structured JSON

### Status Indicators Guide

| Status | Indicator | Meaning |
|--------|-----------|---------|
| **Pending** | 🟡 Yellow dot | Waiting in queue to start |
| **Processing** | 🔵 Spinning icon | Currently transcribing |
| **Completed** | ✅ Green checkmark | Successfully transcribed |
| **Failed** | ❌ Red X | Error occurred (can retry) |

### Speaker Diarization

When enabled (default: ON), the system automatically:
- Identifies distinct speakers in the conversation
- Assigns unique color labels (Speaker 1, Speaker 2, etc.)
- Groups consecutive sentences from the same speaker
- Provides timestamp ranges for each segment

**View Options:**
- **Plain View**: Clean transcript without speaker labels
- **With Speakers**: Color-coded view showing who said what

**Color Scheme:**
- Speaker 1: Blue
- Speaker 2: Green
- Speaker 3: Purple
- Speaker 4: Orange
- Speaker 5: Pink


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
