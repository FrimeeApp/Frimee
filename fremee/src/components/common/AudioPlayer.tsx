"use client";

import { useRef, useState } from "react";

export default function AudioPlayer({ src, sending }: { src: string; sending?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s) || s === 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };
  const progress = duration > 0 && isFinite(duration) ? Math.min(currentTime / duration, 1) : 0;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play(); setPlaying(true); }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const a = e.currentTarget;
    if (isFinite(a.duration) && a.duration > 0) { setDuration(a.duration); }
    else { a.currentTime = 1e101; }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const a = e.currentTarget;
    setCurrentTime(a.currentTime);
    if ((!isFinite(duration) || duration === 0) && isFinite(a.duration) && a.duration > 0) {
      setDuration(a.duration);
      a.currentTime = 0;
    }
  };

  const bars = [3, 6, 10, 7, 13, 9, 5, 12, 7, 10, 14, 6, 9, 12, 4, 8, 11, 7, 13, 5];
  const W = 160;
  const H = 20;
  const barW = Math.floor((W - (bars.length - 1) * 2) / bars.length);

  return (
    <div className="flex w-[210px] items-center gap-[8px] py-[2px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { setPlaying(false); setCurrentTime(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
      />

      <button
        type="button"
        onClick={toggle}
        disabled={sending}
        className="shrink-0 transition-opacity disabled:opacity-40"
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="18" fill="currentColor" fillOpacity="0.18" />
          {sending ? (
            <path d="M18 10 A8 8 0 0 1 26 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.8s" repeatCount="indefinite" />
            </path>
          ) : playing ? (
            <>
              <rect x="13" y="12" width="4" height="12" rx="1.5" fill="currentColor" />
              <rect x="20" y="12" width="4" height="12" rx="1.5" fill="currentColor" />
            </>
          ) : (
            <path d="M15 12l11 6-11 6V12z" fill="currentColor" />
          )}
        </svg>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="cursor-pointer"
          onClick={(e) => {
            if (!audioRef.current || !duration) return;
            const r = e.currentTarget.getBoundingClientRect();
            audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * duration;
          }}
        >
          {bars.map((h, i) => (
            <rect
              key={i}
              x={i * (barW + 2)}
              y={H - h}
              width={barW}
              height={h}
              rx={barW / 2}
              fill="currentColor"
              fillOpacity={i / bars.length < progress ? 0.9 : 0.25}
            />
          ))}
        </svg>
        <span className="text-[10px] leading-none opacity-60">
          {fmt(currentTime > 0 ? currentTime : duration)}
        </span>
      </div>
    </div>
  );
}
