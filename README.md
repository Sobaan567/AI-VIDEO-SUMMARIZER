# 🎬 VidScan – AI Video Summarizer

**100% free, local, no API keys required.**

Uses **Whisper** (speech-to-text) + **BART** (summarization) + **DistilBERT** (sentiment) + **yt-dlp** (download) + **FastAPI** (backend) + **React/Vite** (frontend).

---

## 📁 Project Structure

```
ai-video-summarizer/
├── backend/
│   ├── main.py              ← FastAPI app (all ML logic)
│   └── requirements.txt     ← Python deps
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        └── App.jsx          ← Full React UI
```

---

## ⚙️ Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| ffmpeg | any recent |

Install **ffmpeg** (required for audio extraction):
```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg

# Windows (via winget)
winget install ffmpeg
```

---

## 🚀 Setup & Run

### 1 — Backend

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies (~3 GB first run — downloads ML models)
pip install -r requirements.txt

# Start server
uvicorn main:app --reload --port 8000
```

> **First run:** Whisper (base, ~140 MB) and BART-large-CNN (~1.6 GB) auto-download on first request. Subsequent runs use the cache.

### 2 — Frontend

```bash
cd frontend

npm install
npm run dev
# → http://localhost:3000
```

---

## 🧠 ML Pipeline

```
YouTube URL
    │
    ▼
yt-dlp  ──► MP3 audio
    │
    ▼
Whisper (base)  ──► Raw transcript text
    │
    ├──► BART-large-CNN  ──► Summary paragraph
    │
    ├──► Heuristic scoring  ──► Top 5 key points
    │
    └──► DistilBERT SST-2  ──► Segment-level sentiment
```

| Model | Task | Size | Source |
|-------|------|------|--------|
| `openai/whisper-base` | Speech-to-text | ~140 MB | OpenAI (MIT) |
| `facebook/bart-large-cnn` | Summarization | ~1.6 GB | Meta (MIT) |
| `distilbert-base-uncased-finetuned-sst-2-english` | Sentiment | ~260 MB | HuggingFace (Apache 2.0) |

---

## 🌐 API Reference

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/summarize/url` | `{ "url": "..." }` | Download & summarize from URL |
| POST | `/api/summarize/transcript` | `{ "transcript": "...", "title": "..." }` | Summarize pasted transcript |
| GET | `/api/job/{job_id}` | — | Poll job status / results |
| GET | `/api/health` | — | Health check |

### Job status flow
```
queued → downloading → transcribing → summarizing
       → extracting_keypoints → analysing_segments → done
                                                   → error
```

---

## 💡 Tips

- **YouTube age-restricted videos** may fail — use a public video.
- **Long videos (>30 min)** take several minutes on CPU; Whisper `base` is fast.
- For faster transcription, swap `whisper.load_model("base")` → `"tiny"` in `main.py`.
- For higher-quality summaries, swap `"facebook/bart-large-cnn"` → `"facebook/bart-large-xsum"`.
- The transcript tab shows only the first 2000 characters; full text is processed internally.

---

## 🔧 Troubleshooting

| Issue | Fix |
|-------|-----|
| `ffmpeg not found` | Install ffmpeg and ensure it's on PATH |
| CUDA / GPU errors | The app defaults to CPU (`device=-1`). Ignore GPU warnings. |
| Model download slow | First run only — models are cached in `~/.cache/huggingface/` |
| Port 8000 in use | `uvicorn main:app --port 8001` and update `API` in `App.jsx` |
| CORS error | Backend must be running before opening the frontend |
