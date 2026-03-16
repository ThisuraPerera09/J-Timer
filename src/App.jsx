import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

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

function getSecondsUntil(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  // if time has already passed today, target tomorrow
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.round((target - now) / 1000);
}

function formatDateTimeDisplay(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}:${pad(minutes)} ${ampm}`;
}

const MESSAGES = [
  "Time to go, Jayani! 🏃‍♀️",
  "He's waiting for you! Go go go! 💨",
  "You're going to be late! Hurry up! ⏰",
  "Final call! Time to leave! 🚗",
  "Done! Now get out the door! 💅✨",
  "Your date is waiting! Don't keep him waiting! 💕",
];

// default input: 30 minutes from now
function defaultTime() {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function App() {
  const [dateTime, setDateTime] = useState(defaultTime);
  const [timeLeft, setTimeLeft] = useState(null);
  const [totalTime, setTotalTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const intervalRef = useRef(null);
  const timeLeftRef = useRef(0);
  const audioCtxRef = useRef(null);
  const activeOscsRef = useRef([]);
  const alarmIntervalRef = useRef(null);

  function getCtx() {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    return audioCtxRef.current;
  }

  // Gentle ascending chime: C5 → E5 → G5 → C6
  const playChime = useCallback(() => {
    try {
      const ctx = getCtx();
      const notes = [
        { freq: 523.25, delay: 0.0  },  // C5
        { freq: 659.25, delay: 0.38 },  // E5
        { freq: 783.99, delay: 0.76 },  // G5
        { freq: 1046.5, delay: 1.14 },  // C6
      ];
      notes.forEach(({ freq, delay }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        // Bell envelope: instant attack, slow exponential decay
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 1.8);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 1.85);
        activeOscsRef.current.push(osc);
        osc.onended = () => {
          activeOscsRef.current = activeOscsRef.current.filter((o) => o !== osc);
        };
      });
    } catch { /* ignore */ }
  }, []);

  function stopAlarm() {
    clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = null;
    // Force-stop every active oscillator immediately
    activeOscsRef.current.forEach((osc) => { try { osc.stop(); } catch { /* ignore */ } });
    activeOscsRef.current = [];
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }

  function handleStart() {
    if (!dateTime) {
      setError("Please pick a date time first!");
      return;
    }
    const total = getSecondsUntil(dateTime);
    if (total <= 0) {
      setError("That time has already passed!");
      return;
    }
    setError("");
    clearInterval(intervalRef.current);
    setTotalTime(total);
    setTimeLeft(total);
    timeLeftRef.current = total;
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
    setError("");
  }

  // Tick the countdown; all side-effects live in the interval callback (not in a state updater)
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        clearInterval(intervalRef.current);
        setRunning(false);
        setFinished(true);
        setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // Play alarm when finished; cleanup stops it automatically on reset
  useEffect(() => {
    if (!finished) return;
    playChime();
    alarmIntervalRef.current = setInterval(playChime, 3500);
    return () => {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    };
  }, [finished, playChime]);

  const displayTime = timeLeft !== null ? timeLeft : (dateTime ? getSecondsUntil(dateTime) : 0);
  const progress = totalTime > 0 ? (displayTime / totalTime) * 100 : 100;
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div className={`app${finished ? " alarm-active" : ""}`}>
      <div className="card">
        <h1 className="title">✨ Get Ready, Jayani!</h1>
        <p className="subtitle">When is your date? I&apos;ll remind you when it&apos;s time! 💕</p>

        {/* Time picker */}
        {!running && !finished && (
          <div className="time-picker-wrapper">
            <label className="time-label">📅 Date time</label>
            <input
              type="time"
              className="time-picker"
              value={dateTime}
              onChange={(e) => {
                setDateTime(e.target.value);
                setError("");
              }}
            />
            {dateTime && (
              <p className="time-hint">
                Your date is at <strong>{formatDateTimeDisplay(dateTime)}</strong>
              </p>
            )}
            {error && <p className="time-error">{error}</p>}
          </div>
        )}

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
              <>
                <span className="time-display">{formatTime(displayTime)}</span>
                {running && dateTime && (
                  <span className="ring-target">{formatDateTimeDisplay(dateTime)}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Alarm message */}
        {finished && <p className="alarm-msg">{message}</p>}

        {/* Controls */}
        <div className="controls">
          {!running && !finished && (
            <button className="btn btn-start" onClick={handleStart}>
              Start Countdown
            </button>
          )}
          {running && (
            <button className="btn btn-reset" onClick={handleReset}>
              Cancel
            </button>
          )}
          {finished && (
            <button className="btn btn-arrived" onClick={handleReset}>
              I&apos;m Ready! ✅
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
