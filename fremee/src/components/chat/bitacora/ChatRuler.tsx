"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ChapterLabel } from "./timeline";

/**
 * The ruler (board m-recorrer, s-sistema «Regla»): a track on the right edge of the conversation to
 * travel it by days and milestones. It shows up while scrolling and hides 1.2 s after; dragging its
 * handle jumps from mark to mark, with a short vibration on each milestone.
 *
 * Every mark points to an element of the conversation by id. Positions are measured in the DOM, so
 * the ruler covers what is loaded (older pages join it as they load).
 */
export type RulerMark =
  | { kind: "day"; elementId: string; label: ChapterLabel }
  | { kind: "hito"; elementId: string; label: string; decided: boolean };

type Placed = RulerMark & { y: number };

const TRACK_PAD = 22; // keeps the 44 px handle inside the track at both ends
const HIDE_AFTER_MS = 1200;
const SNAP_PX = 28; // on the track: a mark this close catches the handle

export function ChatRuler({
  scrollRef,
  marks,
  lastReadElementId,
  contentKey,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  marks: RulerMark[];
  /** First message you had not read when opening the chat: the accent bar. */
  lastReadElementId?: string | null;
  /** Changes whenever the messages change, to measure again. */
  contentKey: unknown;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [readY, setReadY] = useState<number | null>(null);
  const [scrollHeight, setScrollHeight] = useState(1);
  const [trackH, setTrackH] = useState(0);
  const [centerY, setCenterY] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [longEnough, setLongEnough] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnap = useRef<string | null>(null);
  const draggingRef = useRef(false);

  // Where an element sits inside the scrolled content.
  const docY = useCallback((el: HTMLElement) => {
    const container = scrollRef.current;
    if (!container) return 0;
    return el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  }, [scrollRef]);

  const measure = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    setScrollHeight(container.scrollHeight || 1);
    // Not worth it on a short chat: under two screens.
    setLongEnough(container.scrollHeight > container.clientHeight * 2);
    // The track spans the conversation's box minus 12 px at each end (it may not be mounted yet).
    setTrackH(container.clientHeight - 24);
    setCenterY(container.scrollTop + container.clientHeight / 2);
    const next: Placed[] = [];
    for (const m of marks) {
      const el = document.getElementById(m.elementId);
      if (el) next.push({ ...m, y: docY(el) });
    }
    setPlaced(next);
    const readEl = lastReadElementId ? document.getElementById(lastReadElementId) : null;
    setReadY(readEl ? docY(readEl) : null);
  }, [scrollRef, marks, lastReadElementId, docY]);

  // Measure after each render of the messages and when anything resizes.
  useEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [measure, contentKey]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    if (container.firstElementChild) ro.observe(container.firstElementChild);
    return () => ro.disconnect();
  }, [scrollRef, measure, contentKey]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (!draggingRef.current) setVisible(false); }, HIDE_AFTER_MS);
  }, []);

  // Appear while scrolling.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onScroll = () => {
      setCenterY(container.scrollTop + container.clientHeight / 2);
      setScrollHeight(container.scrollHeight || 1);
      setVisible(true);
      scheduleHide();
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [scrollRef, scheduleHide]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  // Content position ⇄ track position. The handle stands for the middle of the screen.
  const usable = Math.max(1, trackH - TRACK_PAD * 2);
  const toTrack = (y: number) => TRACK_PAD + Math.min(1, Math.max(0, y / scrollHeight)) * usable;
  const fromTrack = (t: number) => ((Math.min(Math.max(t, TRACK_PAD), TRACK_PAD + usable) - TRACK_PAD) / usable) * scrollHeight;

  const scrollToDocY = (y: number) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = y - container.clientHeight / 2;
  };

  const jumpTo = (mark: Placed) => {
    // A day reads from its title: put it near the top instead of the middle.
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = mark.kind === "day" ? mark.y - 8 : mark.y - container.clientHeight / 3;
    if (lastSnap.current !== mark.elementId) {
      lastSnap.current = mark.elementId;
      if (mark.kind === "hito" && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
    }
  };

  const dragTo = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const t = clientY - track.getBoundingClientRect().top;
    let best: Placed | null = null;
    let bestDist = SNAP_PX;
    for (const m of placed) {
      const d = Math.abs(toTrack(m.y) - t);
      if (d < bestDist) { best = m; bestDist = d; }
    }
    if (best) jumpTo(best);
    else { lastSnap.current = null; scrollToDocY(fromTrack(t)); }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    setVisible(true);
    dragTo(e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    dragTo(e.clientY);
  };
  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    lastSnap.current = null;
    scheduleHide();
  };

  // What the handle stands on: the day above the middle of the screen and the closest milestone of that day.
  const days = placed.filter((m): m is Placed & { kind: "day" } => m.kind === "day");
  const currentDay = [...days].reverse().find((d) => d.y <= centerY + 1) ?? days[0] ?? null;
  const nextDay = currentDay ? days.find((d) => d.y > currentDay.y) : null;
  const dayHitos = placed.filter((m): m is Placed & { kind: "hito" } =>
    m.kind === "hito" && (!currentDay || m.y >= currentDay.y) && (!nextDay || m.y < nextDay.y));
  const nearHito = dayHitos.reduce<(Placed & { kind: "hito" }) | null>(
    (best, m) => (!best || Math.abs(m.y - centerY) < Math.abs(best.y - centerY) ? m : best), null);
  const valueText = [currentDay?.label.title, nearHito?.label].filter(Boolean).join(" · ") || "Conversación";

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const sorted = [...placed].sort((a, b) => a.y - b.y);
    if (sorted.length === 0) return;
    let target: Placed | undefined;
    if (e.key === "ArrowDown" || e.key === "PageDown") target = sorted.find((m) => m.y > centerY + 4);
    else if (e.key === "ArrowUp" || e.key === "PageUp") target = [...sorted].reverse().find((m) => m.y < centerY - 4);
    else if (e.key === "Home") target = sorted[0];
    else if (e.key === "End") {
      e.preventDefault();
      const c = scrollRef.current;
      if (c) c.scrollTop = c.scrollHeight;
      return;
    } else return;
    e.preventDefault();
    if (target) jumpTo(target);
  };

  // Without at least two marks there is nothing to travel.
  if (!longEnough || placed.length < 2) return null;

  const shown = visible || dragging || focused;
  const thumbTop = toTrack(centerY) - 22;

  return (
    <>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Recorrer la conversación"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((centerY / scrollHeight) * 100)}
        aria-valuetext={valueText}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); scheduleHide(); }}
        onMouseEnter={() => { setVisible(true); if (hideTimer.current) clearTimeout(hideTimer.current); }}
        onMouseLeave={scheduleHide}
        className={`absolute bottom-[12px] right-[6px] top-[12px] z-[6] w-[36px] touch-none select-none rounded-[18px] border border-app bg-[var(--surface)] outline-none transition-opacity duration-200 ease-[cubic-bezier(.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${shown ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {placed.map((m) => m.kind === "day" ? (
          <span key={m.elementId} aria-hidden className="absolute left-[10px] h-[2px] w-[14px] rounded-[1px] bg-[var(--text-secondary)]" style={{ top: toTrack(m.y) - 1 }} />
        ) : (
          <span
            key={m.elementId}
            aria-hidden
            className={`absolute left-[13px] size-[8px] rotate-45 rounded-[2px] border-2 border-[var(--primary)] ${m.decided ? "bg-[var(--primary)]" : "bg-[var(--bg)]"}`}
            style={{ top: toTrack(m.y) - 4 }}
          />
        ))}
        {readY !== null && (
          <span aria-hidden className="absolute left-[7px] h-[3px] w-[20px] rounded-[2px] bg-[var(--primary)]" style={{ top: toTrack(readY) - 1 }} />
        )}
        <span
          aria-hidden
          className="absolute -left-[5px] flex size-[44px] items-center justify-center rounded-full border border-app bg-[var(--bg)] text-muted shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
          style={{ top: thumbTop }}
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 9 5-5 5 5" /><path d="m7 15 5 5 5-5" />
          </svg>
        </span>
      </div>
      {(dragging || focused) && currentDay && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-[56px] z-[6] min-w-[170px] max-w-[min(260px,calc(100%-80px))] rounded-[8px] bg-[var(--text-primary)] px-[12px] py-[8px] text-[var(--bg)] shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
          style={{ top: Math.max(12, 12 + thumbTop - 6) }}
        >
          <div className="[font-family:var(--font-display-face)] text-[22px] leading-[24px]">{currentDay.label.title}</div>
          {nearHito && (
            <div className="mt-[4px] flex items-center gap-[6px] text-[12px] opacity-85">
              <span aria-hidden className={`size-[8px] shrink-0 rotate-45 rounded-[2px] border-2 border-[var(--primary)] ${nearHito.decided ? "bg-[var(--primary)]" : "bg-[var(--text-primary)]"}`} />
              <span className="truncate">{nearHito.label}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
