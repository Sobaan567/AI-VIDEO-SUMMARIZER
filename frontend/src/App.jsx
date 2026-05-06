import { useState, useRef, useEffect, useCallback } from "react";

const API = "";

/* ── Palette ──────────────────────────────────────────────────────────────── */
const C = {
  bg:      "#05080F",
  surface: "#0B1018",
  card:    "#0F1825",
  border:  "#162030",
  accent:  "#0BFFD0",
  accent2: "#FF5C5C",
  gold:    "#FFD166",
  text:    "#D8E8F8",
  muted:   "#445566",
  dim:     "#1C2A3A",
};

/* ── Global styles injected once ─────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&family=Clash+Display:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${C.bg};
    color: ${C.text};
    font-family: 'JetBrains Mono', monospace;
    min-height: 100vh;
    overflow-x: hidden;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.dim}; border-radius: 2px; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.4; }
  }
  @keyframes scanline {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes blink {
    0%,100% { opacity: 1; }
    50%      { opacity: 0; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }

  .fade-up { animation: fadeUp 0.5s ease both; }
  .fade-up-2 { animation: fadeUp 0.5s 0.1s ease both; }
  .fade-up-3 { animation: fadeUp 0.5s 0.2s ease both; }
  .fade-up-4 { animation: fadeUp 0.5s 0.3s ease both; }

  .tab-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 7px 18px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 1.5px;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
  }
  .tab-btn:hover { border-color: ${C.border}; color: ${C.text}; }
  .tab-btn.active {
    background: ${C.accent}18;
    border-color: ${C.accent}60;
    color: ${C.accent};
  }

  .input-field {
    width: 100%;
    background: ${C.surface};
    border: 1px solid ${C.border};
    border-radius: 8px;
    color: ${C.text};
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    padding: 14px 16px;
    transition: border-color 0.2s;
    outline: none;
    resize: none;
  }
  .input-field::placeholder { color: ${C.muted}; }
  .input-field:focus { border-color: ${C.accent}80; }

  .btn-primary {
    background: ${C.accent};
    color: ${C.bg};
    border: none;
    border-radius: 8px;
    padding: 13px 28px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .segment-row:hover { background: ${C.dim}; }

  .copy-btn {
    background: ${C.dim};
    border: 1px solid ${C.border};
    border-radius: 4px;
    color: ${C.muted};
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    padding: 4px 10px;
    cursor: pointer;
    letter-spacing: 1px;
    text-transform: uppercase;
    transition: all 0.2s;
  }
  .copy-btn:hover { color: ${C.accent}; border-color: ${C.accent}60; }
`;

/* ── Sub-components ───────────────────────────────────────────────────────── */
function Scanline() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:100, overflow:"hidden" }}>
      <div style={{
        position:"absolute", left:0, right:0, height:2,
        background:`linear-gradient(transparent, ${C.accent}18, transparent)`,
        animation:"scanline 8s linear infinite",
      }} />
      {/* subtle vignette */}
      <div style={{
        position:"absolute", inset:0,
        background:`radial-gradient(ellipse at center, transparent 60%, ${C.bg}99 100%)`,
      }} />
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <div style={{
        width:36, height:36, borderRadius:8,
        background:`linear-gradient(135deg, ${C.accent}20, ${C.accent}05)`,
        border:`1px solid ${C.accent}50`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <polygon points="3,2 15,9 3,16" fill={C.accent} opacity="0.9"/>
          <rect x="13" y="5" width="2" height="8" rx="1" fill={C.accent} opacity="0.6"/>
        </svg>
      </div>
      <div>
        <div style={{ fontFamily:"'JetBrains Mono'", fontSize:13, fontWeight:700, color:C.text, letterSpacing:2 }}>
          VID<span style={{ color:C.accent }}>SCAN</span>
        </div>
        <div style={{ fontSize:9, color:C.muted, letterSpacing:2 }}>AI VIDEO SUMMARIZER</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    queued:              { label:"QUEUED",           color:C.muted },
    downloading:         { label:"DOWNLOADING",      color:C.gold  },
    transcribing:        { label:"TRANSCRIBING",     color:C.gold  },
    summarizing:         { label:"SUMMARIZING",      color:C.accent},
    extracting_keypoints:{ label:"EXTRACTING KEYS",  color:C.accent},
    analysing_segments:  { label:"ANALYSING",        color:C.accent},
    done:                { label:"COMPLETE",         color:C.accent},
    error:               { label:"ERROR",            color:C.accent2},
  };
  const s = map[status] || { label: status?.toUpperCase(), color: C.muted };
  const isActive = !["done","error"].includes(status);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{
        width:7, height:7, borderRadius:"50%",
        background:s.color,
        animation: isActive ? "pulse 1.2s ease infinite" : "none",
      }} />
      <span style={{ fontSize:10, letterSpacing:2, color:s.color }}>{s.label}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ width:18, height:18, border:`2px solid ${C.dim}`, borderTop:`2px solid ${C.accent}`, borderRadius:"50%", animation:"spin 0.7s linear infinite", flexShrink:0 }} />
  );
}

function ProgressBar({ status }) {
  const steps = ["queued","downloading","transcribing","summarizing","extracting_keypoints","analysing_segments","done"];
  const idx   = steps.indexOf(status);
  const pct   = status === "done" ? 100 : status === "error" ? 0 : Math.round(((idx+1)/steps.length)*100);
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <StatusBadge status={status} />
        <span style={{ fontSize:10, color:C.muted, letterSpacing:1 }}>{pct}%</span>
      </div>
      <div style={{ height:3, background:C.dim, borderRadius:2, overflow:"hidden" }}>
        <div style={{
          height:"100%", borderRadius:2,
          width:`${pct}%`,
          background: status === "error"
            ? C.accent2
            : `linear-gradient(90deg, ${C.accent}80, ${C.accent})`,
          transition:"width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

function SummaryTab({ data }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(data.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fade-up">
      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"WORDS",    value: data.word_count?.toLocaleString() },
          { label:"READ TIME", value:`~${data.read_min} min` },
          { label:"SEGMENTS",  value: data.segments?.length },
        ].map(s => (
          <div key={s.label} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"14px 16px" }}>
            <div style={{ fontSize:9, color:C.muted, letterSpacing:2, marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:C.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:20, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <span style={{ fontSize:10, letterSpacing:2, color:C.muted }}>SUMMARY</span>
          <button className="copy-btn" onClick={copy}>{copied ? "COPIED ✓" : "COPY"}</button>
        </div>
        <p style={{ fontSize:13, lineHeight:1.9, color:C.text }}>{data.summary}</p>
      </div>

      {/* Key points */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:20 }}>
        <div style={{ fontSize:10, letterSpacing:2, color:C.muted, marginBottom:14 }}>KEY POINTS</div>
        {data.key_points?.map((pt, i) => (
          <div key={i} style={{ display:"flex", gap:12, marginBottom:12, alignItems:"flex-start" }}>
            <div style={{
              flexShrink:0, width:22, height:22, borderRadius:4,
              background:`${C.accent}15`, border:`1px solid ${C.accent}40`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:9, fontWeight:700, color:C.accent,
            }}>{String(i+1).padStart(2,"0")}</div>
            <p style={{ fontSize:12, lineHeight:1.8, color:C.text, paddingTop:2 }}>{pt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SegmentsTab({ data }) {
  return (
    <div className="fade-up">
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"80px 90px 1fr", gap:0, borderBottom:`1px solid ${C.border}`, padding:"10px 20px" }}>
          {["TIME","SENTIMENT","EXCERPT"].map(h => (
            <span key={h} style={{ fontSize:9, letterSpacing:2, color:C.muted }}>{h}</span>
          ))}
        </div>
        {data.segments?.map((seg, i) => {
          const sentCol = seg.sentiment === "positive" ? C.accent : seg.sentiment === "negative" ? C.accent2 : C.muted;
          return (
            <div key={i} className="segment-row" style={{
              display:"grid", gridTemplateColumns:"80px 90px 1fr",
              gap:0, borderBottom: i < data.segments.length-1 ? `1px solid ${C.border}` : "none",
              padding:"14px 20px", transition:"background 0.15s",
              animationDelay:`${i*0.06}s`,
            }}>
              <span style={{ fontSize:12, color:C.accent, fontWeight:600 }}>{seg.time}</span>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:sentCol }} />
                <span style={{ fontSize:10, color:sentCol, textTransform:"uppercase", letterSpacing:1 }}>
                  {seg.sentiment}
                </span>
              </div>
              <p style={{ fontSize:12, color:C.muted, lineHeight:1.7 }}>{seg.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TranscriptTab({ data }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(data.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fade-up">
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <span style={{ fontSize:10, letterSpacing:2, color:C.muted }}>RAW TRANSCRIPT (PREVIEW)</span>
          <button className="copy-btn" onClick={copy}>{copied ? "COPIED ✓" : "COPY"}</button>
        </div>
        <p style={{ fontSize:12, lineHeight:2, color:C.muted, whiteSpace:"pre-wrap" }}>{data.transcript}</p>
      </div>
    </div>
  );
}

/* ── Main App ─────────────────────────────────────────────────────────────── */
export default function App() {
  const [inputMode, setInputMode]   = useState("url");      // "url" | "transcript"
  const [url, setUrl]               = useState("");
  const [transcript, setTranscript] = useState("");
  const [title, setTitle]           = useState("");
  const [jobId, setJobId]           = useState(null);
  const [jobData, setJobData]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [activeTab, setActiveTab]   = useState("summary");
  const pollRef = useRef(null);

  const stopPoll = () => { if (pollRef.current) clearInterval(pollRef.current); };

  const pollJob = useCallback((id) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/api/job/${id}`);
        const data = await res.json();
        setJobData(data);
        if (["done","error"].includes(data.status)) {
          stopPoll();
          setLoading(false);
        }
      } catch { /* network hiccup — keep polling */ }
    }, 1500);
  }, []);

  useEffect(() => () => stopPoll(), []);

  async function handleSubmit() {
    setError("");
    setJobData(null);
    setLoading(true);
    try {
      let res;
      if (inputMode === "url") {
        if (!url.trim()) throw new Error("Please enter a video URL.");
        res = await fetch(`${API}/api/summarize/url`, {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
      } else {
        if (!transcript.trim()) throw new Error("Please paste a transcript.");
        res = await fetch(`${API}/api/summarize/transcript`, {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ transcript: transcript.trim(), title: title.trim() || "My Video" }),
        });
      }
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || "Server error");
      }
      const { job_id } = await res.json();
      setJobId(job_id);
      pollJob(job_id);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  const isDone  = jobData?.status === "done";
  const isError = jobData?.status === "error";

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Scanline />

      {/* Grid background */}
      <div style={{
        position:"fixed", inset:0, zIndex:0, pointerEvents:"none",
        backgroundImage:`
          linear-gradient(${C.dim}40 1px, transparent 1px),
          linear-gradient(90deg, ${C.dim}40 1px, transparent 1px)
        `,
        backgroundSize:"40px 40px",
        maskImage:"radial-gradient(ellipse at center, black 30%, transparent 80%)",
      }} />

      <div style={{ position:"relative", zIndex:1, minHeight:"100vh", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <header style={{
          borderBottom:`1px solid ${C.border}`,
          padding:"18px 32px",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          backdropFilter:"blur(8px)",
        }}>
          <Logo />
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:10, color:C.muted, letterSpacing:1.5 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:C.accent, animation:"pulse 2s ease infinite" }} />
            FREE · LOCAL AI · NO API KEYS
          </div>
        </header>

        {/* Main content */}
        <main style={{ flex:1, maxWidth:820, width:"100%", margin:"0 auto", padding:"40px 24px" }}>

          {/* Hero */}
          <div className="fade-up" style={{ textAlign:"center", marginBottom:48 }}>
            <h1 style={{
              fontFamily:"'JetBrains Mono'", fontSize:"clamp(28px,5vw,48px)",
              fontWeight:700, lineHeight:1.15, marginBottom:14,
              background:`linear-gradient(135deg, ${C.text}, ${C.accent})`,
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            }}>
              AI Video<br />Summarizer
            </h1>
            <p style={{ fontSize:13, color:C.muted, lineHeight:1.8, maxWidth:480, margin:"0 auto" }}>
              Paste a YouTube URL or raw transcript. Local Whisper transcribes the audio,
              BART summarizes, DistilBERT analyses sentiment — 100% free, no API keys.
            </p>
          </div>

          {/* Input card */}
          <div className="fade-up-2" style={{
            background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            padding:"28px 28px 24px", marginBottom:24,
          }}>
            {/* Mode toggle */}
            <div style={{ display:"flex", gap:8, marginBottom:22 }}>
              {[["url","🔗  Video URL"],["transcript","📝  Paste Transcript"]].map(([m,l]) => (
                <button key={m} className={`tab-btn ${inputMode===m?"active":""}`} onClick={() => setInputMode(m)} style={{ color: inputMode===m ? C.accent : C.muted }}>
                  {l}
                </button>
              ))}
            </div>

            {inputMode === "url" ? (
              <input
                className="input-field"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !loading && handleSubmit()}
              />
            ) : (
              <>
                <input
                  className="input-field"
                  placeholder="Video title (optional)"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{ marginBottom:10 }}
                />
                <textarea
                  className="input-field"
                  placeholder="Paste transcript text here…"
                  rows={7}
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                />
              </>
            )}

            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={loading}
                style={{ display:"flex", alignItems:"center", gap:10 }}
              >
                {loading && <Spinner />}
                {loading ? "PROCESSING…" : "SUMMARIZE"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="fade-up" style={{
              background:`${C.accent2}10`, border:`1px solid ${C.accent2}50`,
              borderRadius:10, padding:"14px 18px", marginBottom:20,
              fontSize:12, color:C.accent2,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Progress */}
          {jobData && !isDone && !isError && (
            <div className="fade-up" style={{
              background:C.card, border:`1px solid ${C.border}`,
              borderRadius:10, padding:"18px 22px", marginBottom:20,
            }}>
              <ProgressBar status={jobData.status} />
            </div>
          )}

          {/* Error from backend */}
          {isError && (
            <div className="fade-up" style={{
              background:`${C.accent2}10`, border:`1px solid ${C.accent2}50`,
              borderRadius:10, padding:"14px 18px", marginBottom:20,
              fontSize:12, color:C.accent2,
            }}>
              ⚠ {jobData.message || "An error occurred. Check the backend logs."}
            </div>
          )}

          {/* Results */}
          {isDone && (
            <div className="fade-up">
              {/* Title bar */}
              <div style={{
                background:C.card, border:`1px solid ${C.border}`,
                borderRadius:"12px 12px 0 0", borderBottom:"none",
                padding:"16px 24px",
                display:"flex", justifyContent:"space-between", alignItems:"center",
              }}>
                <div>
                  <div style={{ fontSize:9, letterSpacing:2, color:C.muted, marginBottom:4 }}>ANALYSIS COMPLETE</div>
                  <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{jobData.title}</div>
                </div>
                <StatusBadge status="done" />
              </div>

              {/* Tabs */}
              <div style={{
                background:C.card, borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`,
                padding:"0 24px",
                display:"flex", gap:4, borderBottom:`1px solid ${C.border}`,
              }}>
                {[["summary","SUMMARY"],["segments","SEGMENTS"],["transcript","TRANSCRIPT"]].map(([t,l]) => (
                  <button key={t} className={`tab-btn ${activeTab===t?"active":""}`}
                    onClick={() => setActiveTab(t)}
                    style={{ borderRadius:"0", borderBottom:"none", borderLeft:"none", borderRight:"none",
                      borderTop: activeTab===t ? `2px solid ${C.accent}` : "2px solid transparent",
                      color: activeTab===t ? C.accent : C.muted, padding:"12px 16px",
                    }}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{
                background:C.card, border:`1px solid ${C.border}`, borderTop:"none",
                borderRadius:"0 0 12px 12px", padding:"24px",
              }}>
                {activeTab === "summary"    && <SummaryTab    data={jobData} />}
                {activeTab === "segments"   && <SegmentsTab   data={jobData} />}
                {activeTab === "transcript" && <TranscriptTab data={jobData} />}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer style={{ borderTop:`1px solid ${C.border}`, padding:"14px 32px", textAlign:"center" }}>
          <span style={{ fontSize:10, color:C.muted, letterSpacing:2 }}>
            POWERED BY · WHISPER · BART · DISTILBERT · YT-DLP · FASTAPI · REACT
          </span>
        </footer>
      </div>
    </>
  );
}
