import os
import re
import uuid
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import yt_dlp
import whisper
from transformers import pipeline

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(title="AI Video Summarizer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Lazy-loaded ML models (loaded once on first use) ─────────────────────────
_whisper_model = None
_summarizer    = None
_sentiment     = None


def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        print("Loading Whisper model (base)…")
        _whisper_model = whisper.load_model("base")
    return _whisper_model


def get_summarizer():
    global _summarizer
    if _summarizer is None:
        print("Loading summarization model…")
        _summarizer = pipeline(
            "summarization",
            model="facebook/bart-large-cnn",
            device=-1,  # CPU
        )
    return _summarizer


def get_sentiment():
    global _sentiment
    if _sentiment is None:
        print("Loading sentiment model…")
        _sentiment = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
            device=-1,
        )
    return _sentiment


# ── In-memory job store ───────────────────────────────────────────────────────
jobs: dict[str, dict] = {}

# ── Schemas ───────────────────────────────────────────────────────────────────
class VideoRequest(BaseModel):
    url: str


class TranscriptRequest(BaseModel):
    transcript: str
    title: str = "User Provided Transcript"


# ── Helpers ───────────────────────────────────────────────────────────────────
def chunk_text(text: str, max_tokens: int = 900) -> list[str]:
    """Split text into ~900-word chunks (BART limit)."""
    words = text.split()
    chunks, buf = [], []
    for w in words:
        buf.append(w)
        if len(buf) >= max_tokens:
            chunks.append(" ".join(buf))
            buf = []
    if buf:
        chunks.append(" ".join(buf))
    return chunks


def summarize_text(text: str) -> str:
    summarizer = get_summarizer()
    chunks = chunk_text(text, 900)
    summaries = []
    for chunk in chunks:
        if len(chunk.split()) < 30:
            summaries.append(chunk)
            continue
        out = summarizer(chunk, max_length=150, min_length=40, do_sample=False)
        summaries.append(out[0]["summary_text"])
    combined = " ".join(summaries)
    # If multiple chunks → summarize again
    if len(summaries) > 1 and len(combined.split()) > 100:
        final = summarizer(combined[:3000], max_length=200, min_length=60, do_sample=False)
        return final[0]["summary_text"]
    return combined


def extract_key_points(text: str) -> list[str]:
    """Heuristic: pick sentences that contain strong signal words."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    signal = [
        "important", "key", "significant", "main", "primary",
        "critical", "essential", "focus", "highlight", "conclude",
        "therefore", "result", "introduce", "explain", "demonstrate",
    ]
    scored = []
    for s in sentences:
        s = s.strip()
        if len(s.split()) < 6:
            continue
        score = sum(1 for kw in signal if kw in s.lower())
        scored.append((score, s))
    scored.sort(key=lambda x: -x[0])
    top = [s for _, s in scored[:5]]
    return top if top else sentences[:3]


def analyse_segments(text: str) -> list[dict]:
    """Split transcript into ~5 segments and analyse each."""
    sentiment = get_sentiment()
    words   = text.split()
    n       = max(1, len(words) // 5)
    chunks  = [words[i : i + n] for i in range(0, len(words), n)][:5]
    segments = []
    for idx, chunk in enumerate(chunks):
        snippet = " ".join(chunk)
        minutes = idx * (len(words) // (5 * 150))          # rough minute estimate
        time_str = f"{minutes:02d}:00"
        # Truncate to 512 tokens for DistilBERT
        trunc = " ".join(chunk[:100])
        try:
            sent = sentiment(trunc[:512])[0]
            label = sent["label"].lower()          # "positive" / "negative"
        except Exception:
            label = "neutral"
        summary_words = chunk[:20]
        segments.append({
            "time": time_str,
            "text": " ".join(summary_words) + "…",
            "sentiment": label,
        })
    return segments


def run_pipeline(job_id: str, transcript: str, title: str):
    try:
        jobs[job_id]["status"] = "summarizing"
        summary = summarize_text(transcript)

        jobs[job_id]["status"] = "extracting_keypoints"
        key_points = extract_key_points(transcript)

        jobs[job_id]["status"] = "analysing_segments"
        segments = analyse_segments(transcript)

        word_count  = len(transcript.split())
        read_min    = max(1, word_count // 200)

        jobs[job_id].update({
            "status"    : "done",
            "title"     : title,
            "summary"   : summary,
            "key_points": key_points,
            "segments"  : segments,
            "word_count": word_count,
            "read_min"  : read_min,
            "transcript": transcript[:2000] + ("…" if len(transcript) > 2000 else ""),
        })
    except Exception as e:
        jobs[job_id]["status"]  = "error"
        jobs[job_id]["message"] = str(e)


def download_and_transcribe(job_id: str, url: str):
    tmp_dir = tempfile.mkdtemp()
    audio_path = os.path.join(tmp_dir, "audio.%(ext)s")
    try:
        # 1. Download audio
        jobs[job_id]["status"] = "downloading"
        ydl_opts = {
            "format"        : "bestaudio/best",
            "outtmpl"       : audio_path,
            "quiet"         : True,
            "no_warnings"   : True,
            "postprocessors": [{
                "key"            : "FFmpegExtractAudio",
                "preferredcodec" : "mp3",
            }],
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info  = ydl.extract_info(url, download=True)
            title = info.get("title", "Video")

        # Find the downloaded file
        mp3_file = os.path.join(tmp_dir, "audio.mp3")
        if not os.path.exists(mp3_file):
            candidates = list(Path(tmp_dir).glob("audio.*"))
            mp3_file   = str(candidates[0]) if candidates else None

        if not mp3_file:
            raise FileNotFoundError("Audio download failed.")

        # 2. Transcribe
        jobs[job_id]["status"] = "transcribing"
        model      = get_whisper()
        result     = model.transcribe(mp3_file, fp16=False)
        transcript = result["text"].strip()

        if not transcript:
            raise ValueError("Transcription produced empty text.")

        # 3. ML pipeline
        run_pipeline(job_id, transcript, title)

    except Exception as e:
        jobs[job_id]["status"]  = "error"
        jobs[job_id]["message"] = str(e)
    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.post("/api/summarize/url")
async def summarize_url(req: VideoRequest, bg: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued"}
    bg.add_task(download_and_transcribe, job_id, req.url)
    return {"job_id": job_id}


@app.post("/api/summarize/transcript")
async def summarize_transcript(req: TranscriptRequest, bg: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued"}
    bg.add_task(run_pipeline, job_id, req.transcript, req.title)
    return {"job_id": job_id}


@app.get("/api/job/{job_id}")
async def get_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    return jobs[job_id]


@app.get("/api/health")
async def health():
    return {"status": "ok"}
