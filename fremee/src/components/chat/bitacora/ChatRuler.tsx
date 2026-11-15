"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ChapterLabel } from "./timeline";

/**
 * The ruler (board m-recorrer, s-sistema «Regla»): travel the whole conversation by days and
 * milestones. On phones a track on the right edge that shows up while scrolling and hides 1.2 s
 * after; dragging its handle jumps from mark to mark, with a short vibration on each milestone.
 * On desktop (s-sistema «Regla en escritorio») a quiet 2 px strip next to the scrollbar: always
 * there, no handle (the scrollbar drags), every mark a link, a tinted box for the stretch on
 * screen and a label on hover or focus.
 *
 * It covers the WHOLE chat, not only what is loaded (the conversation loads 50 at a time): marks
 * are placed by their order among all the messages (`ord`, from the chat index). Going to a mark
 * that is not loaded yet asks the conversation to load back to it (`onReveal`) and then scrolls.
 */
export type RulerMark =
  | { kind: "day"; id: number; ord: number; label: ChapterLabel }
  | { kind: "hito"; id: number; ord: number; label: string; decided: boolean };

type DayMark = Extract<RulerMark, { kind: "day" }>;
type HitoMark = Extract<RulerMark, { kind: "hito" }>;

const TRACK_PAD = 22; // keeps the 44 px handle inside the track at both ends
const HIDE_AFTER_MS = 1200;
const SNAP_PX = 28; // on the track: a mark this close catches the handle
const keyOf = (m: RulerMark) => `${m.kind === "day" ? "d" : "h"}${m.id}`;

export function ChatRuler({
  scrollRef,
  marks,
  total,
  loadedFrom,
  loadedCount,
  readOrd,
  onReveal,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  marks: RulerMark[];
  /** Messages in the whole chat. */
  total: number;
  /** Order of the first loaded message, and how many are loaded (the last ones). */
  loadedFrom: number;
  loadedCount: number;
  /** Order of the first message you had not read when opening the chat: the accent bar. */
  readOrd: number | null;
  /** Load older messages until this one is in the conversation. */
  onReveal: (messageId: number) => Promise<void>;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [scroll, setScroll] = useState({ top: 0, height: 1, client: 0 });
  const [visible, setVisible] = useState(false);
  const [dragOrd, setDragOrd] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnap = useRef<string | null>(null);
  const draggingRef = useRef(false);
  const pendingRef = useRef<RulerMark | null>(null); // to reveal when the drag ends

  const readScroll = useCallback(() => {
    const c = scrollRef.current;
    if (c) setScroll({ top: c.scrollTop, height: c.scrollHeight || 1, client: c.clientHeight });
  }, [scrollRef]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (!draggingRef.current) setVisible(false); }, HIDE_AFTER_MS);
  }, []);

  // Follow the scroll and the size of the content (messages arrive, older pages load, images).
  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const onScroll = () => {
      readScroll();
      setVisible(true);
      scheduleHide();
    };
    c.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(readScroll);
    ro.observe(c);
    if (c.firstElementChild) ro.observe(c.firstElementChild);
    const id = requestAnimationFrame(readScroll);
    return () => { c.removeEventListener("scroll", onScroll); ro.disconnect(); cancelAnimationFrame(id); };
  }, [scrollRef, readScroll, scheduleHide, loadedCount]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  // Loaded content ⇄ order in the whole chat. The loaded messages are the last `loadedCount`, laid
  // out over the scroll height: good enough to place the screen among all the marks.
  const ordAtScroll = (y: number) => loadedFrom + Math.min(1, Math.max(0, y / scroll.height)) * loadedCount;
  const viewTopOrd = ordAtScroll(scroll.top);
  const viewBottomOrd = ordAtScroll(scroll.top + scroll.client);
  const centerOrd = ordAtScroll(scroll.top + scroll.client / 2);
  const span = Math.max(1, total);

  const elementFor = (m: { kind: "day" | "hito"; id: number }) =>
    (m.kind === "day" ? document.getElementById(`day-${m.id}`) : null) ?? document.getElementById(`msg-${m.id}`);

  const scrollToElement = (el: HTMLElement, kind: "day" | "hito") => {
    const c = scrollRef.current;
    if (!c) return;
    const y = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop;
    // A day reads from its title: near the top. A milestone, a third down.
    c.scrollTop = kind === "day" ? y - 8 : y - c.clientHeight / 3;
  };

  /** Go to a mark: scroll if it is loaded, otherwise load back to it first. */
  const goTo = async (m: { kind: "day" | "hito"; id: number }) => {
    let el = elementFor(m);
    if (!el) {
      await onReveal(m.id);
      // The stretch renders on the next frames: wait for the message to be there.
      for (let i = 0; i < 10 && !el; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        el = elementFor(m);
      }
    }
    if (el) scrollToElement(el, m.kind);
  };

  // What a point of the chat stands on: its day and the closest milestone of that day.
  const days = marks.filter((m): m is DayMark => m.kind === "day");
  const dayAt = (ord: number) => [...days].reverse().find((d) => d.ord <= ord + 0.5) ?? days[0] ?? null;
  const hitoNear = (ord: number) => {
    const day = dayAt(ord);
    const next = day ? days.find((d) => d.ord > day.ord) : null;
    return marks
      .filter((m): m is HitoMark => m.kind === "hito" && (!day || m.ord >= day.ord) && (!next || m.ord < next.ord))
      .reduce<HitoMark | null>((best, m) => (!best || Math.abs(m.ord - ord) < Math.abs(best.ord - ord) ? m : best), null);
  };

  const showRuler = scroll.height > scroll.client * 1.5 || loadedFrom > 0;
  if (!showRuler || total === 0) return null;

  /* ── Desktop: a strip with links ─────────────────────────────── */
  if (isDesktop) {
    const trackH = Math.max(0, scroll.client - 32);
    const at = (ord: number) => (ord / span) * trackH;
    const shownMark = hovered ? marks.find((m) => keyOf(m) === hovered) ?? null : null;
    const tipDay = shownMark ? (shownMark.kind === "day" ? shownMark : dayAt(shownMark.ord)) : null;
    const tipHito = shownMark ? (shownMark.kind === "hito" ? shownMark : hitoNear(shownMark.ord)) : null;
    const markProps = (m: RulerMark) => ({
      href: `#msg-${m.id}`,
      onClick: (e: React.MouseEvent) => { e.preventDefault(); void goTo(m); },
      onMouseEnter: () => setHovered(keyOf(m)),
      onMouseLeave: () => setHovered((h) => (h === keyOf(m) ? null : h)),
      onFocus: () => setHovered(keyOf(m)),
      onBlur: () => setHovered((h) => (h === keyOf(m) ? null : h)),
    });
    return (
      <nav aria-label="Recorrer la conversación por días e hitos" className="absolute bottom-[16px] right-[12px] top-[16px] z-[6] w-[24px]">
        <span aria-hidden className="absolute bottom-0 left-[11px] top-0 w-[2px] rounded-[1px] bg-[var(--border)]" />
        {/* The stretch on screen */}
        <span
          aria-hidden
          className="absolute left-0 right-0 rounded-[6px] border border-[var(--chat-me-border)] bg-[var(--chat-tint)]"
          style={{ top: at(viewTopOrd), height: Math.max(8, at(viewBottomOrd) - at(viewTopOrd)) }}
        />
        {marks.map((m) => m.kind === "day" ? (
          <a key={keyOf(m)} {...markProps(m)} aria-label={`Ir a ${m.label.title}`} className="absolute left-0 right-0 flex h-[12px] items-center justify-center rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]" style={{ top: at(m.ord) - 6 }}>
            <span className="h-[2px] w-[12px] rounded-[1px] bg-[var(--text-secondary)]" />
          </a>
        ) : (
          <a key={keyOf(m)} {...markProps(m)} aria-label={`Ir al hito: ${m.label}`} className="absolute left-0 right-0 flex h-[16px] items-center justify-center rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]" style={{ top: at(m.ord) - 8 }}>
            <span aria-hidden className={`size-[8px] rotate-45 rounded-[2px] border-2 border-[var(--primary)] ${m.decided ? "bg-[var(--primary)]" : "bg-[var(--bg)]"}`} />
          </a>
        ))}
        {readOrd !== null && (
          <span aria-hidden className="pointer-events-none absolute left-[3px] right-[3px] h-[3px] rounded-[2px] bg-[var(--primary)]" style={{ top: at(readOrd) - 1 }} />
        )}
        {shownMark && tipDay && (
          <div role="tooltip" className="pointer-events-none absolute right-[30px] z-[3] whitespace-nowrap rounded-[8px] border border-app bg-[var(--bg)] px-[12px] py-[8px] text-app shadow-[0_8px_32px_rgba(0,0,0,0.3)]" style={{ top: at(shownMark.ord) - 24 }}>
            {/* Same look as the desktop menus (board s-sistema «Regla en escritorio»): sheet, border, Inter 13 + milestone in secondary. */}
            <div className="text-[13px] font-[var(--fw-semibold)]">{tipDay.label.title}</div>
            {tipHito && (
              <div className="mt-[2px] flex items-center gap-[6px] text-[12px] text-muted">
                <span aria-hidden className={`size-[8px] shrink-0 rotate-45 rounded-[2px] border-2 border-[var(--primary)] ${tipHito.decided ? "bg-[var(--primary)]" : "bg-[var(--bg)]"}`} />
                {tipHito.label}
              </div>
            )}
          </div>
        )}
      </nav>
    );
  }

  /* ── Phones: a track with a handle ───────────────────────────── */
  const trackH = Math.max(0, scroll.client - 24);
  const usable = Math.max(1, trackH - TRACK_PAD * 2);
  const toTrack = (ord: number) => TRACK_PAD + Math.min(1, Math.max(0, ord / span)) * usable;
  const fromTrack = (t: number) => ((Math.min(Math.max(t, TRACK_PAD), TRACK_PAD + usable) - TRACK_PAD) / usable) * span;

  const dragTo = (clientY: number) => {
    const track = trackRef.current;
    const c = scrollRef.current;
    if (!track || !c) return;
    const t = clientY - track.getBoundingClientRect().top;
    let best: RulerMark | null = null;
    let bestDist = SNAP_PX;
    for (const m of marks) {
      const d = Math.abs(toTrack(m.ord) - t);
      if (d < bestDist) { best = m; bestDist = d; }
    }
    if (best) {
      setDragOrd(best.ord);
      if (lastSnap.current !== keyOf(best)) {
        lastSnap.current = keyOf(best);
        if (best.kind === "hito" && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
      }
      const el = elementFor(best);
      if (el) { pendingRef.current = null; scrollToElement(el, best.kind); } else pendingRef.current = best;
      return;
    }
    const ord = fromTrack(t);
    setDragOrd(ord);
    lastSnap.current = null;
    if (ord >= loadedFrom && ord < loadedFrom + loadedCount) {
      // Inside what is loaded: follow the finger.
      pendingRef.current = null;
      c.scrollTop = ((ord - loadedFrom) / Math.max(1, loadedCount)) * c.scrollHeight - c.clientHeight / 2;
    } else {
      // Outside what is loaded: when the finger lifts, jump to that day (its stretch loads then).
      pendingRef.current = dayAt(ord);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setVisible(true);
    dragTo(e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) dragTo(e.clientY);
  };
  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragOrd(null);
    lastSnap.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) void goTo(pending);
    scheduleHide();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Arrows move by day, Re Pág / Av Pág by milestone (board s-sistema · Accesibilidad).
    const of = (k: RulerMark["kind"]) => marks.filter((m) => m.kind === k);
    let target: RulerMark | undefined;
    if (e.key === "ArrowDown") target = of("day").find((m) => m.ord > centerOrd + 0.5);
    else if (e.key === "ArrowUp") target = [...of("day")].reverse().find((m) => m.ord < centerOrd - 0.5);
    else if (e.key === "PageDown") target = of("hito").find((m) => m.ord > centerOrd + 0.5);
    else if (e.key === "PageUp") target = [...of("hito")].reverse().find((m) => m.ord < centerOrd - 0.5);
    else if (e.key === "Home") target = marks[0];
    else if (e.key === "End") {
      e.preventDefault();
      const c = scrollRef.current;
      if (c) c.scrollTop = c.scrollHeight;
      return;
    } else return;
    e.preventDefault();
    if (target) void goTo(target);
  };

  const cursor = dragOrd ?? centerOrd;
  const currentDay = dayAt(cursor);
  const nearHito = hitoNear(cursor);
  const valueText = [currentDay?.label.title, nearHito?.label].filter(Boolean).join(" · ") || "Conversación";
  const dragging = dragOrd !== null;
  const shown = visible || dragging || focused;
  const thumbTop = toTrack(cursor) - 22;

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
        aria-valuenow={Math.round((cursor / span) * 100)}
        aria-valuetext={valueText}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); scheduleHide(); }}
        className={`absolute bottom-[12px] right-[6px] top-[12px] z-[6] w-[36px] touch-none select-none rounded-[18px] border border-app bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] outline-none backdrop-blur-[6px] transition-opacity duration-200 ease-[cubic-bezier(.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${shown ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {marks.map((m) => m.kind === "day" ? (
          <span key={keyOf(m)} aria-hidden className="absolute left-[10px] h-[2px] w-[14px] rounded-[1px] bg-[var(--text-secondary)]" style={{ top: toTrack(m.ord) - 1 }} />
        ) : (
          <span
            key={keyOf(m)}
            aria-hidden
            className={`absolute left-[13px] size-[8px] rotate-45 rounded-[2px] border-2 border-[var(--primary)] ${m.decided ? "bg-[var(--primary)]" : "bg-[var(--bg)]"}`}
            style={{ top: toTrack(m.ord) - 4 }}
          />
        ))}
        {readOrd !== null && (
          <span aria-hidden className="absolute left-[7px] h-[3px] w-[20px] rounded-[2px] bg-[var(--primary)]" style={{ top: toTrack(readOrd) - 1 }} />
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
          className="pointer-events-none absolute right-[56px] z-[6] min-w-[170px] max-w-[min(260px,calc(100%-80px))] rounded-[8px] border border-app bg-[var(--bg)] px-[12px] py-[8px] text-app shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          style={{ top: Math.max(12, 12 + thumbTop - 6) }}
        >
          <div className="[font-family:var(--font-display-face)] text-[22px] leading-[24px]">{currentDay.label.title}</div>
          {nearHito && (
            <div className="mt-[4px] flex items-center gap-[6px] text-[12px] text-muted">
              <span aria-hidden className={`size-[8px] shrink-0 rotate-45 rounded-[2px] border-2 border-[var(--primary)] ${nearHito.decided ? "bg-[var(--primary)]" : "bg-[var(--bg)]"}`} />
              <span className="truncate">{nearHito.label}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
