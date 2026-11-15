"use client";

import { useMemo, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

const SPEEDS = [1, 1.5, 2] as const;
const BAR_COUNT = 32;

/**
 * The bars of a voice note. The file is not decoded (that would download every note in view):
 * a stable shape per note, derived from its URL, so each one looks different but never changes.
 */
function barsFor(src: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const r = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    // Softer at both ends, like speech starting and stopping.
    const edge = Math.min(1, (i + 1) / 4, (BAR_COUNT - i) / 4);
    out.push(0.2 + 0.8 * r * edge);
  }
  return out;
}

/**
 * Voice note (board «Bitácora» · nota de voz): a 44 px round play button in the inverted colour,
 * the wave with what was played in the text colour and the rest in the secondary one (told apart
 * by lightness, also on the tinted block), then the time and the speed on the same line.
 */
export default function AudioPlayer({ src, sending }: { src: string; sending?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const bars = useMemo(() => barsFor(src), [src]);

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s) || s === 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };
  const progress = duration > 0 && isFinite(duration) ? Math.min(currentTime / duration, 1) : 0;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.playbackRate = speed; void a.play(); setPlaying(true); }
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const seekTo = (fraction: number) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = Math.min(Math.max(fraction, 0), 1) * duration;
    setCurrentTime(a.currentTime);
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

  return (
    <div className="flex w-[264px] max-w-full items-center gap-[10px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        // Notes recorded in the browser (webm) report their length late: take it whenever it arrives,
        // so the wave can show the progress.
        onDurationChange={(e) => { const d = e.currentTarget.duration; if (isFinite(d) && d > 0) setDuration(d); }}
        onEnded={() => { setPlaying(false); setCurrentTime(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
      />

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        disabled={sending}
        className="flex size-[44px] shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg)] transition-opacity disabled:opacity-40"
        aria-label={playing ? "Pausar nota de voz" : "Reproducir nota de voz"}
      >
        {sending ? (
          <Loader2 className="size-[18px] animate-spin" />
        ) : playing ? (
          <Pause className="size-[18px]" fill="currentColor" />
        ) : (
          <Play className="ml-[2px] size-[18px]" fill="currentColor" />
        )}
      </button>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Posición de la nota de voz"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${fmt(currentTime)} de ${fmt(duration)}`}
        className="flex h-[28px] min-w-0 flex-1 cursor-pointer items-center justify-between rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        onClick={(e) => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          seekTo((e.clientX - r.left) / r.width);
        }}
        onKeyDown={(e) => {
          if (!duration) return;
          if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); seekTo((currentTime + 5) / duration); }
          if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); seekTo((currentTime - 5) / duration); }
        }}
      >
        {bars.map((h, i) => (
          <span
            key={i}
            aria-hidden
            className={`w-[2px] shrink-0 rounded-full ${(i + 0.5) / bars.length <= progress ? "bg-[var(--text-primary)]" : "bg-[var(--text-secondary)]"}`}
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        ))}
      </div>

      <span className="shrink-0 text-[12px] tabular-nums text-muted">{fmt(currentTime > 0 ? currentTime : duration)}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); cycleSpeed(); }}
        aria-label={`Velocidad ${speed}×, cambiar`}
        className="flex h-[28px] min-w-[36px] shrink-0 items-center justify-center rounded-full border border-app px-[6px] text-[12px] font-[var(--fw-semibold)] tabular-nums text-app"
      >
        {String(speed).replace(".", ",")}×
      </button>
    </div>
  );
}
