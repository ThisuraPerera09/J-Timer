import { useState, useEffect, useRef } from "react";
import "./App.css";

const PRESETS = [
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "15 min", seconds: 900 },
  { label: "30 min", seconds: 1800 },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
}

const MESSAGES = [
  "Jayani... where are you? 😅",
  "Still waiting... are you getting ready? ⏳",
  "Time's up! Jayani is officially late! 💅",
  "Ring ring! Jayani! 🔔",
  "She's late again! Surprise surprise 😂",
  "Your patience has expired 😤",
];

export default function App() {
  const [inputMinutes, setInputMinutes] = useState(10);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [totalTime, setTotalTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("");
  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);
  const alarmIntervalRef = useRef(null);

  function playAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;

      const beats = [0, 0.5, 1.0, 1.5, 2.0, 2.5];
      beats.forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime + t);
        gain.gain.setValueAtTime(0.6, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAndTime?.(0.001, ctx.currentTime + t + 0.4);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + t + 0.4);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.45);
      });
    } catch (_) {}
  }

  function stopAlarm() {
    clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }

  function handleStart() {
    const total = inputMinutes * 60 + inputSeconds;
    if (total <= 0) return;
    clearInterval(intervalRef.current);
    setTotalTime(total);
    setTimeLeft(total);
    setFinished(false);
    setMessage("");
    setRunning(true);
  }

  function handleReset() {
    clearInterval(intervalRef.current);
    stopAlarm();
    setRunning(false);
    setFinished(false);
    setTimeLeft(null);
    setMessage("");
  }

  function handlePause() {
    clearInterval(intervalRef.current);
    setRunning(false);
  }

  function handleResume() {
    if (timeLeft > 0) setRunning(true);
  }

  useEffect(() => {
    if (!running) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          setFinished(true);
          setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
          playAlarm();
          alarmIntervalRef.current = setInterval(playAlarm, 3200);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [running]);

  const displayTime = timeLeft !== null ? timeLeft : inputMinutes * 60 + inputSeconds;
  const progress = totalTime > 0 ? (displayTime / totalTime) * 100 : 100;
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div className={`app${finished ? " alarm-active" : ""}`}>
      <div className="card">
        <h1 className="title">⏰ Jayani&apos;s Late Timer</h1>
        <p className="subtitle">Track how long she&apos;s keeping you waiting 😏</p>

        {/* Preset buttons */}
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className="preset-btn"
              disabled={running}
              onClick={() => {
                setInputMinutes(Math.floor(p.seconds / 60));
                setInputSeconds(0);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Circular progress ring */}
        <div className="ring-wrapper">
          <svg className="ring-svg" viewBox="0 0 280 280">
            <circle cx="140" cy="140" r={radius} fill="none" stroke="#2a2a3e" strokeWidth="12" />
            <circle
              cx="140"
              cy="140"
              r={radius}
              fill="none"
              stroke={finished ? "#ff4d6d" : "#a78bfa"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 140 140)"
              style={{ transition: running ? "stroke-dashoffset 1s linear" : "none" }}
            />
          </svg>
          <div className="ring-text">
            {finished ? (
              <span className="time-display ring-alarm">RING!</span>
            ) : (
              <span className="time-display">{formatTime(displayTime)}</span>
            )}
          </div>
        </div>

        {/* Manual input */}
        {!running && !finished && (
          <div className="inputs">
            <div className="input-group">
              <label>Min</label>
              <input
                type="number"
                min="0"
                max="99"
                value={inputMinutes}
                onChange={(e) => setInputMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            <span className="colon">:</span>
            <div className="input-group">
              <label>Sec</label>
              <input
                type="number"
                min="0"
                max="59"
                value={inputSeconds}
                onChange={(e) =>
                  setInputSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))
                }
              />
            </div>
          </div>
        )}

        {/* Alarm message */}
        {finished && <p className="alarm-msg">{message}</p>}

        {/* Controls */}
        <div className="controls">
          {!running && !finished && (
            <button className="btn btn-start" onClick={handleStart}>
              Start Timer
            </button>
          )}
          {running && (
            <>
              <button className="btn btn-pause" onClick={handlePause}>Pause</button>
              <button className="btn btn-reset" onClick={handleReset}>Reset</button>
            </>
          )}
          {!running && !finished && timeLeft !== null && timeLeft > 0 && (
            <>
              <button className="btn btn-start" onClick={handleResume}>Resume</button>
              <button className="btn btn-reset" onClick={handleReset}>Reset</button>
            </>
          )}
          {finished && (
            <button className="btn btn-arrived" onClick={handleReset}>
              She Arrived! ✅
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
