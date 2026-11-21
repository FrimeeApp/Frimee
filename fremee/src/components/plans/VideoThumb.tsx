"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/** 83 → "1:23". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A video in a thumbnail: its first frame, still, with a ▶ and its length (as in the chat).
 * It never plays here: tapping opens the viewer.
 */
export function VideoThumb({ src, small = false }: { src: string; small?: boolean }) {
  const [duration, setDuration] = useState<number | null>(null);
  return (
    <>
      <video
        src={`${src}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full object-cover"
        onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null)}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <span className={`flex items-center justify-center rounded-full bg-black/55 text-white ${small ? "size-6" : "size-9"}`}>
          <Play className={small ? "size-3" : "size-4"} fill="currentColor" />
        </span>
      </span>
      {duration !== null && !small && (
        <span className="tabular-nums pointer-events-none absolute right-1 bottom-1 rounded-full bg-[rgba(17,17,17,.8)] px-1.5 text-[11px] font-[600] leading-5 text-white">
          {formatDuration(duration)}
        </span>
      )}
    </>
  );
}
