"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dices } from "lucide-react";

/**
 * «Sortear» in the cinema version (boards po-m-cine / po-d-cine): a departures board over the chat.
 * The result already came from the server; the board is only built to land on it.
 *
 * Timeline (ms): 0–300 the board fades in · from 300 every flap jumps letters every 60 ms · flap i
 * stops on its letter at 1200 + i·90 (left to right) · when the last one stops, the label turns into
 * «DECIDIDO POR SORTEO» and «Vamos a Madrid» rises 6 px · it holds ~900 ms · 400 ms fade out.
 * «Toca para saltar» (or Escape) ends it at once. Always dark, like a real board. Phone: the whole
 * screen; desktop: only the chat column (the host passed in).
 */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const START = 300;
const TICK = 60;
const FIRST_STOP = 1200;
const STAGGER = 90;
const HOLD = 900;
const FADE = 400;

/** «MADRID» → " MADRID " in 8 flaps; never fewer than 8, never more than 16. */
function boardText(word: string): string[] {
  const w = word.toLocaleUpperCase("es-ES").slice(0, 16);
  const n = Math.max(8, Math.min(16, w.length + 2));
  const left = Math.floor((n - w.length) / 2);
  return Array.from({ length: n }, (_, i) => w[i - left] ?? " ");
}

export function DrawBoard({
  host,
  winner,
  headline,
  question,
  tied,
  launcher,
  onDone,
}: {
  /** Where the board goes (the chat column). */
  host: HTMLElement | null;
  /** The option drawn («Madrid») and how it reads («Vamos a Madrid»). */
  winner: string;
  headline: string;
  question: string;
  tied: string[];
  /** «Ana» / «ti». */
  launcher: string;
  onDone: () => void;
}) {
  const [t, setT] = useState(0);
  const [closing, setClosing] = useState(false);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(390);

  const flaps = boardText(winner);
  const lastStop = FIRST_STOP + (flaps.length - 1) * STAGGER;
  const winnerAt = lastStop + 70;
  const fadeAt = winnerAt + HOLD;

  useLayoutEffect(() => {
    const el = host;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [host]);

  useEffect(() => {
    let raf = 0;
    let last = -TICK;
    const loop = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const el = now - startRef.current;
      if (el - last >= TICK || el >= fadeAt) { last = el; setT(el); }
      if (el >= fadeAt + FADE) { doneRef.current(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // Focus on the board itself (no ring): Escape and the skip button work from there.
    boardRef.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(raf);
  }, [fadeAt]);

  const skip = () => {
    if (closing) return;
    setClosing(true);
    setT(fadeAt);
    setTimeout(() => doneRef.current(), 200);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); skip(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!host) return null;

  // Flap size: 36×52 on a phone, 64×84 from 768 px; smaller if the word does not fit.
  const big = width >= 768;
  const gap = big ? 6 : 4;
  const want = big ? 64 : 36;
  const fit = Math.floor((width - 32 - gap * (flaps.length - 1)) / flaps.length);
  const fw = Math.max(18, Math.min(want, fit));
  const fh = Math.round(fw * (big ? 84 / 64 : 52 / 36));
  const fs = Math.round(fw * (big ? 44 / 64 : 28 / 36));

  const shown = t >= winnerAt;
  const opacity = closing || t >= fadeAt ? 0 : t < START ? t / START : 1;
  const charAt = (i: number) => {
    if (t < START) return " ";
    if (t >= FIRST_STOP + i * STAGGER) return flaps[i];
    // Same jumps for everyone watching (not random per device): from the time and the column.
    const h = Math.imul(Math.floor(t / TICK) + 1, 2654435761) ^ Math.imul(i + 1, 40503);
    return LETTERS[(h >>> 0) % LETTERS.length];
  };

  return createPortal(
    <div
      ref={boardRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Sorteo"
      onClick={skip}
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center outline-none"
      style={{ background: "rgba(10,10,12,.94)", gap: big ? 22 : 16, opacity, transition: `opacity ${closing || t >= fadeAt ? FADE : 0}ms cubic-bezier(.2,0,0,1)` }}
    >
      <Dices className="size-[28px]" style={{ color: "#3cddc2" }} aria-hidden />
      <div className="relative h-[20px] w-full text-center text-[12px] font-[var(--fw-semibold)] tracking-[.08em]" style={{ color: "#a0a0a9" }}>
        <span className="absolute inset-x-0 transition-opacity duration-200" style={{ opacity: shown ? 0 : 1 }}>
          SORTEO · {question.toLocaleUpperCase("es-ES")}
        </span>
        <span className="absolute inset-x-0 transition-[opacity,transform] duration-300" style={{ color: "#3cddc2", opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(6px)" }}>
          DECIDIDO POR SORTEO
        </span>
      </div>
      <div aria-hidden className="flex justify-center" style={{ gap }}>
        {flaps.map((_, i) => (
          <span
            key={i}
            className="relative flex items-center justify-center overflow-hidden rounded-[6px] font-[var(--fw-semibold)] tabular-nums"
            style={{ width: fw, height: fh, fontSize: fs, background: "#1a1a1f", border: "1px solid #2a2a31", color: "#ededef" }}
          >
            {charAt(i)}
            <i className="absolute inset-x-0 top-1/2 h-px" style={{ background: "#0b0b0d", opacity: 0.9 }} />
          </span>
        ))}
      </div>
      <div className="px-[16px] text-center transition-[opacity,transform] duration-300 ease-[cubic-bezier(.2,0,0,1.05)]" style={{ marginTop: big ? 24 : 18, opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(6px)" }}>
        <p className="[font-family:var(--font-display-face)]" style={{ fontSize: big ? 36 : 26, color: "#ededef" }}>{headline}</p>
        <p className="mt-[4px] text-[13px]" style={{ color: "#a0a0a9" }}>{tied.join(" o ")} · lanzado por {launcher}</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); skip(); }}
        className="absolute left-1/2 h-[44px] -translate-x-1/2 rounded-[8px] px-[16px] text-[13px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#3cddc2]"
        style={{ bottom: big ? 32 : 110, color: "#a0a0a9" }}
      >
        Toca para saltar
      </button>
      <span role="status" className="sr-only">{shown ? `Decidido por sorteo: ${winner}` : `Sorteando entre ${tied.join(" y ")}`}</span>
    </div>,
    host,
  );
}
