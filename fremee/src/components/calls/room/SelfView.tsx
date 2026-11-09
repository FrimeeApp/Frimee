"use client";

import { useRef, useState } from "react";
import { MicOff, SwitchCamera } from "lucide-react";
import { CallAvatar } from "../ui";

type Corner = "tl" | "tr" | "bl" | "br";

/**
 * Your own camera over a 1:1 video call (M8a–c, D8). Drag it anywhere; on release it snaps to
 * the nearest corner, and while dragging the four corners are drawn (the nearest in turquoise).
 */
export default function SelfView({
  stage,
  insets,
  mobile,
  cameraOn,
  micOn,
  userId,
  userName,
  userFoto,
  canFlip,
  onFlip,
  attach,
}: {
  /** Size of the area it moves in. */
  stage: { width: number; height: number };
  /** Space kept free at the top (header) and the bottom (controls). */
  insets: { top: number; bottom: number; side: number };
  mobile: boolean;
  cameraOn: boolean;
  micOn: boolean;
  userId: string;
  userName: string;
  userFoto?: string;
  canFlip: boolean;
  onFlip: () => void;
  attach: (trackKey: string, el: HTMLVideoElement | null) => void;
}) {
  const w = mobile ? 104 : 240;
  const h = mobile ? 146 : 135;
  const [corner, setCorner] = useState<Corner>("br");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const grab = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);

  const spots: Record<Corner, { x: number; y: number }> = {
    tl: { x: insets.side, y: insets.top },
    tr: { x: stage.width - w - insets.side, y: insets.top },
    bl: { x: insets.side, y: stage.height - h - insets.bottom },
    br: { x: stage.width - w - insets.side, y: stage.height - h - insets.bottom },
  };
  const nearest = (x: number, y: number): Corner => {
    let best: Corner = "br";
    let bestD = Infinity;
    (Object.keys(spots) as Corner[]).forEach((c) => {
      const d = (spots[c].x - x) ** 2 + (spots[c].y - y) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  };
  const pos = drag ?? spots[corner];
  const near = drag ? nearest(drag.x, drag.y) : null;

  if (stage.width === 0) return null;
  return (
    <>
      {drag && (Object.keys(spots) as Corner[]).map((c) => (
        <div key={c} className="call-pip-slot" data-near={c === near ? "true" : "false"} style={{ left: spots[c].x, top: spots[c].y, width: w, height: h }} />
      ))}
      <div
        className="call-pip"
        data-dragging={drag ? "true" : "false"}
        aria-label="Tu cámara. Arrástrala a otra esquina"
        style={{ left: pos.x, top: pos.y, width: w, height: h }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          grab.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, startX: e.clientX, startY: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const g = grab.current;
          if (!g) return;
          if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 6) return;
          g.moved = true;
          const x = Math.max(0, Math.min(stage.width - w, e.clientX - g.dx));
          const y = Math.max(0, Math.min(stage.height - h, e.clientY - g.dy));
          setDrag({ x, y });
        }}
        onPointerUp={() => {
          if (drag) setCorner(nearest(drag.x, drag.y));
          setDrag(null);
          grab.current = null;
        }}
        onPointerCancel={() => { setDrag(null); grab.current = null; }}
      >
        <video data-own-video autoPlay playsInline muted ref={(el) => attach("__local__", el)} style={{ display: cameraOn ? undefined : "none" }} />
        {!cameraOn && (
          <div className="absolute inset-0 flex items-center justify-center">
            <CallAvatar id={userId} nombre={userName} foto={userFoto} size={mobile ? 48 : 56} />
          </div>
        )}
        {!micOn && (
          <span className="call-tag bottom-2 left-2 px-1.5" aria-label="Micro silenciado">
            <MicOff className="size-3.5" aria-hidden />
          </span>
        )}
        {!mobile && micOn && <span className="call-tag bottom-2 left-2"><span>Tú</span></span>}
        {mobile && cameraOn && canFlip && (
          <button
            type="button"
            aria-label="Girar cámara"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onFlip(); }}
            className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-[var(--stage-label)] text-white"
          >
            <SwitchCamera className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </>
  );
}
