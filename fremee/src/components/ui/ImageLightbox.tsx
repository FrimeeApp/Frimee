"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type ImageLightboxProps = {
  url: string;
  imageUrls: string[];
  onClose: () => void;
  /** Lines under the current image (who and when, the licence of a stock photo, actions…). */
  caption?: (url: string) => ReactNode;
  /** Which of `imageUrls` are videos: shown with the same player as in the chat (native controls). */
  isVideo?: (url: string) => boolean;
  /** Text alternative of each image («Foto de Álex Prueba, hoy»). */
  alt?: (url: string) => string;
  /** How many there are in all when `imageUrls` is only what has loaded so far («2 de 42»). */
  totalCount?: number;
  /** The shown one changed (its index): lets the caller load more before the end. */
  onIndexChange?: (index: number) => void;
  /** Side panel on wide screens (≥1024 px), 400 px; on narrower ones the caption is used under the image instead. */
  aside?: (url: string) => ReactNode;
};

const MAX_ZOOM = 4;

/**
 * Full-screen viewer, always dark (like the call room). It covers everything, sidebar included,
 * because it is drawn on <body>. Arrows, counter, keyboard (← → Escape, Tab stays inside) and, on
 * phones, swipe to move, swipe down to close, pinch or double tap to zoom.
 */
export function ImageLightbox({ url, imageUrls, onClose, caption, isVideo, alt, totalCount, onIndexChange, aside }: ImageLightboxProps) {
  const [current, setCurrent] = useState(url);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  // While a finger is down the image follows it without easing.
  const [touching, setTouching] = useState(false);

  // Zoom and drags (pinch, pan, swipe).
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [dragY, setDragY] = useState(0);
  const gesture = useRef<{ kind: "none" | "swipe" | "pinch" | "pan"; x: number; y: number; dist: number; scale: number; ox: number; oy: number; lastTap: number }>({ kind: "none", x: 0, y: 0, dist: 0, scale: 1, ox: 0, oy: 0, lastTap: 0 });

  const idx = Math.max(0, imageUrls.indexOf(current));
  const loaded = imageUrls.length;
  const total = Math.max(totalCount ?? 0, loaded);
  const hasPrev = idx > 0;
  const hasNext = idx < loaded - 1;
  const video = Boolean(isVideo?.(current));

  useEffect(() => { setCurrent(url); }, [url]);
  useEffect(() => { setZoom({ scale: 1, x: 0, y: 0 }); setDragY(0); }, [current]);

  // On <body>, the page behind does not scroll, and the focus goes back where it was on closing
  // (the thumbnail it was opened from).
  useEffect(() => {
    setMounted(true);
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  // Once on <body>: the focus goes to «Cerrar».
  useEffect(() => { if (mounted) closeRef.current?.focus(); }, [mounted]);
  useEffect(() => { onIndexChange?.(idx); }, [idx, onIndexChange]);

  const go = (to: number) => { if (to >= 0 && to < loaded) setCurrent(imageUrls[to]); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key === "Tab") {
        // The focus stays inside the viewer.
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href], video[controls]") ?? []);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      // A focused video uses the arrows to seek.
      if (document.activeElement instanceof HTMLVideoElement) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(idx + 1); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  });

  useEffect(() => {
    const el = thumbsRef.current?.children[idx] as HTMLElement | undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [idx]);

  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouching(true);
    // Dragging on a video's progress bar is not a swipe.
    if (e.target instanceof HTMLVideoElement) { gesture.current.kind = "none"; return; }
    const g = gesture.current;
    if (e.touches.length === 2 && !video) {
      Object.assign(g, { kind: "pinch", dist: dist(e.touches), scale: zoom.scale });
      return;
    }
    const t = e.touches[0];
    Object.assign(g, { kind: zoom.scale > 1 ? "pan" : "swipe", x: t.clientX, y: t.clientY, ox: zoom.x, oy: zoom.y });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (g.kind === "pinch" && e.touches.length === 2) {
      const scale = Math.min(MAX_ZOOM, Math.max(1, g.scale * (dist(e.touches) / g.dist)));
      setZoom((z) => (scale === 1 ? { scale: 1, x: 0, y: 0 } : { ...z, scale }));
    } else if (g.kind === "pan") {
      const t = e.touches[0];
      setZoom((z) => ({ ...z, x: g.ox + (t.clientX - g.x), y: g.oy + (t.clientY - g.y) }));
    } else if (g.kind === "swipe") {
      const t = e.touches[0];
      const dy = t.clientY - g.y;
      // Mostly downwards: the image follows the finger (swipe down to close).
      if (dy > 0 && Math.abs(dy) > Math.abs(t.clientX - g.x)) setDragY(dy);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const g = gesture.current;
    const t = e.changedTouches[0];
    if (g.kind === "swipe") {
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (dy > 110 && dy > Math.abs(dx)) { setTouching(false); onCloseRef.current(); return; }
      setDragY(0);
      if (Math.abs(dx) >= 48 && Math.abs(dy) <= 40) go(dx < 0 ? idx + 1 : idx - 1);
      // Double tap: zoom in to 2× or back to 1×.
      if (!video && Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        const now = Date.now();
        if (now - g.lastTap < 300) { setZoom((z) => (z.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2, x: 0, y: 0 })); g.lastTap = 0; }
        else g.lastTap = now;
      }
    }
    if (e.touches.length === 0) { g.kind = "none"; setTouching(false); }
  };

  if (!mounted) return null;

  const arrow = "absolute top-1/2 z-10 flex size-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={total > 1 ? `Visor, ${idx + 1} de ${total}` : "Visor"}
      className="fixed inset-0 z-[400] flex bg-black text-white"
      style={dragY ? { backgroundColor: `rgba(0,0,0,${Math.max(0.35, 1 - dragY / 400)})` } : undefined}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(8px,calc(env(safe-area-inset-top)+8px))]">
        <span aria-live="polite" className="pl-2 text-[14px] tabular-nums text-white/85">{total > 1 ? `${idx + 1} de ${total}` : ""}</span>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" title="Cerrar" className="flex size-[44px] items-center justify-center rounded-full text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <X className="size-6" aria-hidden />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden px-4 py-2 md:px-16"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {hasPrev && (
          <button type="button" onClick={() => go(idx - 1)} aria-label="Anterior" title="Anterior" className={`${arrow} left-3`}>
            <ChevronLeft className="size-6" aria-hidden />
          </button>
        )}
        {video ? (
          <video key={current} src={current} controls playsInline className="max-h-full max-w-full" style={dragY ? { transform: `translateY(${dragY}px)` } : undefined} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current}
            src={current}
            alt={alt?.(current) ?? "Foto"}
            referrerPolicy="no-referrer"
            draggable={false}
            className="max-h-full max-w-full select-none object-contain"
            style={{ transform: `translate(${zoom.x}px, ${zoom.y + dragY}px) scale(${zoom.scale})`, transition: touching ? "none" : "transform 0.15s" }}
          />
        )}
        {hasNext && (
          <button type="button" onClick={() => go(idx + 1)} aria-label="Siguiente" title="Siguiente" className={`${arrow} right-3`}>
            <ChevronRight className="size-6" aria-hidden />
          </button>
        )}
      </div>

      {caption?.(current) && (
        <div className={`shrink-0 px-4 pt-3 text-center text-[14px] text-white/90 ${aside ? "lg:hidden" : ""}`}>{caption(current)}</div>
      )}

      {loaded > 1 ? (
        <div
          ref={thumbsRef}
          className="flex shrink-0 gap-2 overflow-x-auto scrollbar-hide px-0 pt-3 pb-[max(12px,calc(env(safe-area-inset-bottom)+12px))]"
          style={{ paddingInline: "calc(50% - 28px)" }}
        >
          {imageUrls.map((imageUrl, i) => (
            <button
              key={imageUrl}
              type="button"
              onClick={() => setCurrent(imageUrl)}
              aria-label={`${isVideo?.(imageUrl) ? "Vídeo" : "Foto"} ${i + 1} de ${total}`}
              aria-current={imageUrl === current ? "true" : undefined}
              className={`relative shrink-0 overflow-hidden rounded-[6px] border-2 ${imageUrl === current ? "border-white" : "border-transparent opacity-50 hover:opacity-80"}`}
              style={{ width: 56, height: 56 }}
            >
              {isVideo?.(imageUrl)
                ? <video src={`${imageUrl}#t=0.1`} preload="metadata" muted playsInline aria-hidden className="pointer-events-none size-full object-cover" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />}
            </button>
          ))}
        </div>
      ) : (
        <div className="shrink-0 pb-[max(12px,calc(env(safe-area-inset-bottom)+12px))]" />
      )}
      </div>
      {aside && (
        <aside aria-label="Detalles de la foto" className="hidden w-[400px] shrink-0 overflow-y-auto border-l border-[#2a2a31] bg-[#111111] p-6 lg:block">
          {aside(current)}
        </aside>
      )}
    </div>,
    document.body,
  );
}

/** A pill under the image («Ir al mensaje», «Descargar»…): bordered, readable on black. */
export function LightboxAction({ children, onClick, href, download, disabled }: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  download?: string;
  disabled?: boolean;
}) {
  const cls = "inline-flex min-h-[44px] items-center gap-[6px] rounded-full border border-white/35 px-[16px] text-[14px] font-[var(--fw-semibold)] text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50";
  return href ? (
    <a href={href} download={download} target="_blank" rel="noreferrer" className={cls}>{children}</a>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>{children}</button>
  );
}
