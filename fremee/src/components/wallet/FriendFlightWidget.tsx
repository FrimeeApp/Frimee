"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanTicket } from "@/services/api/endpoints/wallet.endpoint";
import { Plane } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function flightProgress(ticket: PlanTicket): number | null {
  if (!ticket.ends_at) return null;
  const now   = Date.now();
  const start = new Date(ticket.starts_at).getTime();
  const end   = new Date(ticket.ends_at).getTime();
  if (now < start || now > end) return null;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function remainingMinutes(ticket: PlanTicket): number {
  if (!ticket.ends_at) return 0;
  return Math.max(0, Math.round((new Date(ticket.ends_at).getTime() - Date.now()) / 60000));
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function FriendFlightWidget({ tickets }: { tickets: PlanTicket[] }) {
  const [now, setNow] = useState(() => Date.now());

  // Refresh every 30 seconds to keep progress accurate
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const activeFlights = tickets.filter(
    t => t.shared_by_user_id && t.type === "flight" && flightProgress(t) !== null
  );

  if (activeFlights.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {activeFlights.map(ticket => (
        <FlightCard key={ticket.id} ticket={ticket} _now={now} />
      ))}
    </div>
  );
}

// ── FlightCard ────────────────────────────────────────────────────────────────

function FlightCard({ ticket, _now }: { ticket: PlanTicket; _now: number }) {
  const progress  = flightProgress(ticket) ?? 0;
  const remaining = remainingMinutes(ticket);
  const trackRef  = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    if (!trackRef.current) return;
    const ro = new ResizeObserver(entries => setTrackW(entries[0].contentRect.width));
    ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, []);

  const PLANE_W  = 32; // px width of plane icon
  const planeX   = progress * Math.max(0, trackW - PLANE_W);

  return (
    <div className="overflow-hidden rounded-[22px] shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
      {/* Sky scene */}
      <div
        className="relative h-[110px] overflow-hidden"
        style={{
          background: "linear-gradient(180deg,#0b1a3b 0%,#1a3a6b 40%,#2d6aad 75%,#5a9fd4 100%)",
        }}
      >
        {/* Stars */}
        {STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: s.x, top: s.y, width: s.r, height: s.r, opacity: s.o }}
          />
        ))}

        {/* Animated clouds */}
        <CloudLayer speedClass="cloud-layer-medium" opacity={0.55} y={18} size={1}   offset={0}   />
        <CloudLayer speedClass="cloud-layer-slow"   opacity={0.35} y={44} size={0.7} offset={40}  />
        <CloudLayer speedClass="cloud-layer-fast"   opacity={0.25} y={62} size={1.3} offset={-20} />

        {/* Flight track line */}
        <div
          ref={trackRef}
          className="absolute left-5 right-5"
          style={{ bottom: 24 }}
        >
          {/* Dashed path */}
          <div className="absolute inset-y-[15px] left-0 right-0 border-b border-dashed border-white/20" />

          {/* Elapsed trail */}
          <div
            className="absolute inset-y-[15px] left-0 border-b-2 border-white/40 transition-[width] duration-1000"
            style={{ width: `${progress * 100}%` }}
          />

          {/* Plane */}
          <div
            className="plane-bob absolute"
            style={{
              bottom: 6,
              left:   planeX,
              width:  PLANE_W,
              transition: "left 1s linear",
            }}
          >
            <PlaneIcon className="size-8 drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
          </div>

          {/* Origin dot */}
          <div className="absolute left-0 top-[11px] size-2 rounded-full bg-white/60" />
          {/* Destination dot */}
          <div className="absolute right-0 top-[11px] size-2 rounded-full bg-white/40" />
        </div>
      </div>

      {/* Info strip */}
      <div className="flex items-center gap-3 bg-[#0d1f3d] px-5 py-3">
        {/* Friend avatar initial */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1e3a6e] text-[13px] font-[var(--fw-bold)] text-white">
          {(ticket.shared_by_nombre ?? "?")[0].toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-[var(--fw-semibold)] text-white">
            {ticket.shared_by_nombre} está volando
            {ticket.from_label && ticket.to_label
              ? ` · ${ticket.from_label} → ${ticket.to_label}`
              : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-white/50">
            {remaining > 0
              ? `Aterriza en ~${remaining < 60 ? `${remaining} min` : `${Math.round(remaining / 60)}h ${remaining % 60}min`}`
              : "Aterrizando"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-center gap-1.5 text-[11px] font-[var(--fw-semibold)] tracking-[0.06em] text-white/70">
            <span>{fmtTime(ticket.starts_at)}</span>
            <div className="h-px w-10 bg-white/20" />
            <span>{ticket.ends_at ? fmtTime(ticket.ends_at) : "—"}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-[90px] overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-[#5a9fd4] transition-[width] duration-1000"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-0.5 text-right text-[11px] text-white/40">
            {Math.round(progress * 100)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ── CloudLayer ────────────────────────────────────────────────────────────────

function CloudLayer({
  speedClass,
  opacity,
  y,
  size,
  offset,
}: {
  speedClass: "cloud-layer-fast" | "cloud-layer-medium" | "cloud-layer-slow";
  opacity: number;
  y: number;
  size: number;
  offset: number;
}) {
  return (
    <div
      className={`pointer-events-none absolute left-0 flex w-[200%] ${speedClass}`}
      style={{ top: y, opacity }}
    >
      {[0, 1].map(copy => (
        <div key={copy} className="flex w-1/2 items-center gap-16 px-8">
          {CLOUD_SHAPES.map((shape, i) => (
            <CloudSvg
              key={i}
              shape={shape}
              style={{
                transform:  `scale(${size}) translateX(${offset}px)`,
                marginLeft: i === 0 ? 0 : shape.gap,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function CloudSvg({ shape, style }: { shape: CloudShape; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 80 32"
      fill="white"
      aria-hidden="true"
      style={{ width: shape.w, height: shape.h, flexShrink: 0, ...style }}
    >
      <ellipse cx="40" cy="22" rx="36" ry="10" />
      <ellipse cx="28" cy="18" rx="18" ry="13" />
      <ellipse cx="52" cy="16" rx="14" ry="11" />
    </svg>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

type CloudShape = { w: number; h: number; gap: number };

const CLOUD_SHAPES: CloudShape[] = [
  { w: 80, h: 32, gap: 0   },
  { w: 56, h: 24, gap: 60  },
  { w: 96, h: 36, gap: 100 },
  { w: 64, h: 28, gap: 80  },
];

const STARS = Array.from({ length: 18 }, (_, i) => ({
  x: `${(i * 37 + 11) % 100}%`,
  y: `${(i * 19 + 5)  % 45}%`,
  r: i % 3 === 0 ? 2 : 1.5,
  o: 0.3 + (i % 4) * 0.15,
}));

// ── Icons ─────────────────────────────────────────────────────────────────────

const PlaneIcon = ({ className = "size-8" }: { className?: string }) => <Plane className={className} aria-hidden />;
