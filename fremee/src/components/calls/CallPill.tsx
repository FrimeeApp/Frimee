"use client";

import { useEffect, useRef, useState } from "react";
import { MicOff, ScreenShare } from "lucide-react";
import type { CallMiembro } from "@/hooks/useCall";
import { AvatarStack, CallAvatar, HangUpIcon } from "./ui";

type Corner = "br" | "bl" | "tr" | "tl";

/**
 * The call while you use the app (boards C3, M13, D13): two sibling buttons, the pill (back to
 * the call) and hang up. Phones: above the bottom navigation, full width. Desktop: bottom right,
 * 320 wide; drag it to another corner. Live dot turquoise; reconnecting turns it amber.
 */
export default function CallPill({ title, persona, group, activeSince, muted, reconnecting, sharing, onExpand, onEnd }: {
  title: string;
  /** 1:1: the other person. */
  persona?: { id: string; nombre: string; foto?: string };
  /** Group: the others in the call. */
  group?: CallMiembro[];
  activeSince: number | null;
  muted: boolean;
  reconnecting: boolean;
  sharing: boolean;
  onExpand: () => void;
  onEnd: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const total = activeSince ? Math.max(0, Math.floor((now - activeSince) / 1000)) : 0;
  const h = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  const timer = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;

  // Desktop: drag to another corner.
  const [corner, setCorner] = useState<Corner>("br");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const grab = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const moved = useRef(false);
  const W = 320;
  const H = 56;
  const M = 24;
  const cornerStyle: React.CSSProperties = drag
    ? { left: drag.x, top: drag.y }
    : { [corner[0] === "b" ? "bottom" : "top"]: M, [corner[1] === "r" ? "right" : "left"]: M };

  const sub = reconnecting ? (
    <span className="truncate text-[var(--stage-warn)]">Reconectando...</span>
  ) : (
    <span className="call-num flex min-w-0 items-center gap-1.5 truncate">
      {timer}
      {group && <> · {group.length + 1}</>}
      {muted && <span className="inline-flex items-center gap-1"> · <MicOff className="size-3" aria-hidden />Silenciado</span>}
      {sharing && <span className="inline-flex items-center gap-1"> · <ScreenShare className="size-3" aria-hidden />Compartiendo</span>}
    </span>
  );

  const body = (
    <>
      <button
        type="button"
        aria-label={`Volver a la llamada con ${title}`}
        onClick={() => { if (!moved.current) onExpand(); moved.current = false; }}
        className="flex h-full min-w-0 flex-1 items-center gap-3 pl-2 text-left"
      >
        {group && group.length > 1
          ? <AvatarStack miembros={group} size={28} ring="var(--call-pill-bg)" max={3} />
          : <CallAvatar id={persona?.id ?? title} nombre={persona?.nombre ?? title} foto={persona?.foto} size={36} />}
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{title}</span>
          <span className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${reconnecting ? "" : "call-live"}`} style={{ background: reconnecting ? "var(--stage-warn)" : "var(--call-accent-text)" }} />
            {sub}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Colgar"
        onClick={onEnd}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--call-reject)] text-white transition-colors hover:bg-[var(--stage-hangup-hover)] active:scale-95"
      >
        <HangUpIcon size={20} />
      </button>
    </>
  );

  return (
    <>
      {/* Phones: above the bottom navigation. */}
      <div
        className="call-drop fixed inset-x-3 z-40 flex h-14 items-center gap-2 rounded-full border border-[var(--call-pill-border)] bg-[var(--call-pill-bg)] pr-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.12)] md:hidden"
        style={{ bottom: "calc(clamp(56px, 8dvh, 64px) + env(safe-area-inset-bottom) + 12px)" }}
      >
        {body}
      </div>
      {/* Desktop: a corner, draggable. */}
      <div
        className="call-drop fixed z-40 hidden items-center gap-2 rounded-full border border-[var(--call-pill-border)] bg-[var(--call-pill-bg)] pr-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.14)] md:flex"
        style={{ width: W, height: H, ...cornerStyle, touchAction: "none", transition: drag ? "none" : "left 240ms var(--call-ease), top 240ms var(--call-ease)" }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[aria-label="Colgar"]')) return;
          const r = e.currentTarget.getBoundingClientRect();
          grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const g = grab.current;
          if (!g) return;
          if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 6) return;
          g.moved = true;
          setDrag({ x: Math.max(0, Math.min(window.innerWidth - W, e.clientX - g.dx)), y: Math.max(0, Math.min(window.innerHeight - H, e.clientY - g.dy)) });
        }}
        onPointerUp={() => {
          const g = grab.current;
          grab.current = null;
          if (!g?.moved || !drag) return;
          moved.current = true;
          const right = drag.x + W / 2 > window.innerWidth / 2;
          const bottom = drag.y + H / 2 > window.innerHeight / 2;
          setCorner(`${bottom ? "b" : "t"}${right ? "r" : "l"}` as Corner);
          setDrag(null);
        }}
      >
        {body}
      </div>
    </>
  );
}
