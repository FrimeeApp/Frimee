"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/icons";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import {
  listActiveFriendFlightsEndpoint,
  listActiveFriendFerriesEndpoint,
} from "@/services/api/endpoints/wallet.endpoint";
import type { PlanTicket } from "@/services/api/endpoints/wallet.endpoint";
import { flightProgressFromPosition, flightProgressFromTime, AIRPORTS } from "@/lib/airports";
import { buildInternalApiUrl, buildOpenSkyStatesUrl } from "@/config/external";

// ── Time-of-day theming ───────────────────────────────────────────────────────

type DayPhase = "night" | "dawn" | "day" | "dusk";

function getDayPhase(hour: number): DayPhase {
  if (hour >= 5  && hour < 7)  return "dawn";
  if (hour >= 7  && hour < 19) return "day";
  if (hour >= 19 && hour < 21) return "dusk";
  return "night";
}

const SKY_GRADIENTS: Record<DayPhase, string> = {
  day:   "linear-gradient(180deg,#b8d4f0 0%,#cde4f7 50%,#daeeff 100%)",
  dawn:  "linear-gradient(180deg,#f7c59f 0%,#f4a261 30%,#e8c4a0 60%,#d4e8f7 100%)",
  dusk:  "linear-gradient(180deg,#2d1b69 0%,#c0392b 30%,#e67e22 60%,#f39c12 100%)",
  night: "linear-gradient(180deg,#060d1f 0%,#0a1628 40%,#0d2040 70%,#142850 100%)",
};

const SEA_GRADIENTS: Record<DayPhase, string> = {
  day:   "linear-gradient(180deg,#062d45 0%,#0a5070 35%,#1282a2 70%,#23b5d3 100%)",
  dawn:  "linear-gradient(180deg,#1a3a5c 0%,#1a6080 35%,#2e8fa5 60%,#f4a261 100%)",
  dusk:  "linear-gradient(180deg,#1a0a2e 0%,#2c1654 30%,#7b2d8b 60%,#c0392b 100%)",
  night: "linear-gradient(180deg,#020b14 0%,#041525 35%,#062035 70%,#082a42 100%)",
};

const SKY_TEXT: Record<DayPhase, string> = {
  day:   "#1a3a6b",
  dawn:  "#7a2e00",
  dusk:  "#ffffff",
  night: "#ffffff",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type FlightPosition = {
  callsign:    string;
  latitude:    number;
  longitude:   number;
  altitude_m:  number | null;
  velocity_ms: number | null;
  heading:     number | null;
  on_ground:   boolean;
  updated_at:  string;
};


// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlightsPage() {
  const router = useRouter();
  const [nowTs, setNowTs]       = useState(() => Date.now());
  const [flights,   setFlights] = useState<PlanTicket[]>([]);
  const [ferries,   setFerries] = useState<PlanTicket[]>([]);
  const [positions, setPositions] = useState<Record<string, FlightPosition>>({});
  const [loading,   setLoading] = useState(true);

  async function refreshAll() {
    const [f, v] = await Promise.allSettled([
      listActiveFriendFlightsEndpoint(),
      listActiveFriendFerriesEndpoint(),
    ]);
    if (f.status === "fulfilled") setFlights(f.value);
    if (v.status === "fulfilled") setFerries(v.value);
    setLoading(false);
  }

  // ── Flight polling (OpenSky) ──────────────────────────────────────────────

  const flightPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flightsRef    = useRef<PlanTicket[]>([]);
  flightsRef.current  = flights;

  async function pollFlight(ticket: PlanTicket) {
    const callsign = ticket.booking_code?.trim();
    if (!callsign) return;
    const isCapacitor = process.env.NEXT_PUBLIC_BUILD_TARGET === "capacitor";

    if (isCapacitor) {
      try {
        const url = buildOpenSkyStatesUrl(callsign);
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const data = await res.json() as { states: unknown[][] | null };
        if (!data.states?.length) return;
        const s = data.states[0];
        const lat = s[6] as number | null;
        const lon = s[5] as number | null;
        if (lat == null || lon == null) return;
        const pos: FlightPosition = {
          callsign:    (s[1] as string).trim(),
          on_ground:   s[8] as boolean,
          latitude:    lat,
          longitude:   lon,
          altitude_m:  s[7] as number | null,
          velocity_ms: s[9] as number | null,
          heading:     s[10] as number | null,
          updated_at:  new Date().toISOString(),
        };
        setPositions(prev => ({ ...prev, [pos.callsign]: pos }));
        const supabase = createBrowserSupabaseClient();
        await supabase.from("flight_positions").upsert(pos, { onConflict: "callsign" });
      } catch { /* silent */ }
    } else {
      try {
        const params = new URLSearchParams({ callsign });
        if (ticket.from_label) params.set("from", ticket.from_label);
        if (ticket.to_label)   params.set("to",   ticket.to_label);
        if (ticket.starts_at)  params.set("starts_at", ticket.starts_at);
        if (ticket.ends_at)    params.set("ends_at",   ticket.ends_at ?? "");
        const res = await fetch(buildInternalApiUrl(`/api/flights/track?${params}`));
        if (!res.ok) return;
        const pos = await res.json() as FlightPosition;
        setPositions(prev => ({ ...prev, [pos.callsign]: pos }));
      } catch { /* silent */ }
    }
  }

  async function pollAllFlights() { for (const t of flightsRef.current) await pollFlight(t); }

  useEffect(() => {
    const interval = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    refreshAll();

    const supabase = createBrowserSupabaseClient();

    const ticketsChannel = supabase
      .channel("active-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_tickets" }, refreshAll)
      .subscribe();

    const positionsChannel = supabase
      .channel("flight-positions")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_positions" },
        (payload) => {
          setPositions(prev => {
            const updated = { ...prev };
            if (payload.eventType === "DELETE") {
              delete updated[(payload.old as FlightPosition).callsign];
            } else {
              const pos = payload.new as FlightPosition;
              updated[pos.callsign] = pos;
            }
            return updated;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(positionsChannel);
      if (flightPollRef.current) clearInterval(flightPollRef.current);
    };
  }, []);

  useEffect(() => {
    if (flightPollRef.current) clearInterval(flightPollRef.current);
    if (flights.length === 0) return;
    pollAllFlights();
    flightPollRef.current = setInterval(pollAllFlights, 30_000);
    return () => { if (flightPollRef.current) clearInterval(flightPollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flights]);

  const hasFlights = flights.length > 0;
  const hasFerries = ferries.length > 0;
  const isEmpty    = !hasFlights && !hasFerries;

  return (
    <main className="min-h-screen px-safe pt-[calc(env(safe-area-inset-top)+var(--space-6))] pb-[calc(var(--space-20)+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-[420px] px-4">

        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex size-9 items-center justify-center rounded-full text-app transition-opacity hover:opacity-70"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <h1 className="text-[20px] font-[var(--fw-bold)] text-app">En ruta</h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1].map(i => (
              <div key={i} className="h-[178px] animate-pulse rounded-[20px] bg-[var(--bg-secondary,#f0f0f0)]" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-3 pt-20 text-center">
            <div
              className="flex size-16 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg,#b8d4f0 0%,#daeeff 100%)" }}
            >
              <PlaneSvg size={36} />
            </div>
            <p className="text-[15px] font-semibold text-app">Sin viajes activos</p>
            <p className="max-w-[240px] text-[13px] text-[var(--text-secondary)]">
              Cuando un amigo suba su boarding pass o ticket de ferry aparecerá aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {hasFlights && (
              <section className="space-y-4">
                {(hasFlights && hasFerries) && (
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">Vuelos</p>
                )}
                {flights.map(ticket => (
                  <FlightWidget
                    key={ticket.id}
                    ticket={ticket}
                    position={ticket.booking_code ? positions[ticket.booking_code.trim()] ?? null : null}
                    nowTs={nowTs}
                  />
                ))}
              </section>
            )}

            {hasFerries && (
              <section className="space-y-4">
                {(hasFlights && hasFerries) && (
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">Ferries</p>
                )}
                {ferries.map(ticket => (
                  <FerryWidget
                    key={ticket.id}
                    ticket={ticket}
                    nowTs={nowTs}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ── FlightWidget ──────────────────────────────────────────────────────────────

function FlightWidget({ ticket, position, nowTs }: { ticket: PlanTicket; position: FlightPosition | null; nowTs: number }) {
  const from = ticket.from_label ?? "";
  const to   = ticket.to_label   ?? "";

  const progress = position
    ? (flightProgressFromPosition(from, to, position.latitude, position.longitude) ?? flightProgressFromTime(ticket.starts_at, ticket.ends_at ?? ticket.starts_at))
    : flightProgressFromTime(ticket.starts_at, ticket.ends_at ?? ticket.starts_at);

  const PLANE_W  = 64;
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    if (!trackRef.current) return;
    const ro = new ResizeObserver(e => setTrackW(e[0].contentRect.width));
    ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, []);

  const planeX = progress * Math.max(0, trackW - PLANE_W);
  void nowTs;

  const phase = getDayPhase(new Date().getHours());
  const skyBg = SKY_GRADIENTS[phase];
  const textColor = SKY_TEXT[phase];
  const isLight = phase === "day" || phase === "dawn";

  const aereolineaLabel = ticket.title ?? "Vuelo";
  const pct = Math.round(progress * 100);

  const remainingLabel = (() => {
    if (!ticket.ends_at) return null;
    const msLeft = new Date(ticket.ends_at).getTime() - Date.now();
    if (msLeft <= 0) return "Aterrizado";
    const totalMin = Math.round(msLeft / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  })();

  return (
    <div
      className="overflow-hidden rounded-[24px]"
      style={{ boxShadow: "0 8px 32px rgba(26,58,107,0.22)" }}
    >
      {/* ── Cielo ── */}
      <div
        className="relative overflow-hidden"
        style={{ height: 148, background: skyBg }}
      >
        {ticket.booking_code && (
          <div className="absolute right-3 top-3 rounded-md px-2 py-0.5"
            style={{ background: isLight ? "rgba(26,58,107,0.1)" : "rgba(255,255,255,0.12)", backdropFilter: "blur(4px)" }}>
            <span className="text-[10px] font-bold tracking-widest" style={{ color: isLight ? `${textColor}99` : "rgba(255,255,255,0.7)" }}>{ticket.booking_code}</span>
          </div>
        )}

        <div className="absolute inset-x-0 top-4 flex items-center justify-center gap-3">
          <span className="text-[26px] font-black leading-none tracking-tight drop-shadow-sm" style={{ color: textColor }}>{from || "—"}</span>
          <span className="text-[14px] font-light" style={{ color: `${textColor}60` }}>⟶</span>
          <span className="text-[26px] font-black leading-none tracking-tight drop-shadow-sm" style={{ color: textColor }}>{to || "—"}</span>
        </div>

        <CloudRow y={55}  speed={28} opacity={isLight ? 0.9 : 0.08} scale={1}   delay={0}  />
        <CloudRow y={80}  speed={40} opacity={isLight ? 0.6 : 0.05} scale={0.7} delay={8}  />
        <CloudRow y={100} speed={22} opacity={isLight ? 0.4 : 0.04} scale={1.1} delay={14} />

        <div ref={trackRef} className="absolute left-8 right-8" style={{ bottom: 18 }}>
          <div
            className="absolute"
            style={{ bottom: 6, left: planeX, width: PLANE_W, transition: "left 2.5s ease-in-out", zIndex: 4 }}
          >
            <PlaneSvg size={PLANE_W} />
          </div>
        </div>
      </div>

      {/* ── Info strip ── */}
      <div style={{ background: "#ffffff" }}>
        <div className="h-[3px] w-full" style={{ background: "#e8eef5" }}>
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg,#1a3a6b,#2d6aad)",
              transition: "width 2s linear",
              borderRadius: "0 2px 2px 0",
            }}
          />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#0d1f3c,#2d6aad)" }}
          >
            {(ticket.shared_by_nombre ?? "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-[#0d1f3c]">
              {ticket.shared_by_nombre}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#2d6aad]/70">{aereolineaLabel}</p>
          </div>
          {remainingLabel && (
            <div className="shrink-0 text-right">
              <p className="text-[13px] font-bold tabular-nums text-[#2d6aad]">{remainingLabel}</p>
              <p className="mt-0.5 text-[10px] text-[#0d1f3c]/40">
                {position?.on_ground ? "En tierra" : "restante"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FerryWidget ───────────────────────────────────────────────────────────────

function FerryWidget({ ticket, nowTs }: { ticket: PlanTicket; nowTs: number }) {
  const from = ticket.from_label ?? "";
  const to   = ticket.to_label   ?? "";

  const progress = flightProgressFromTime(ticket.starts_at, ticket.ends_at ?? ticket.starts_at);

  const BOAT_W   = 52;
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    if (!trackRef.current) return;
    const ro = new ResizeObserver(e => setTrackW(e[0].contentRect.width));
    ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, []);

  const boatX = progress * Math.max(0, trackW - BOAT_W);
  void nowTs;

  const phase = getDayPhase(new Date().getHours());
  const seaBg = SEA_GRADIENTS[phase];

  const companiaLabel = ticket.title ?? "Ferry";
  const pct = Math.round(progress * 100);

  const remainingLabel = (() => {
    if (!ticket.ends_at) return null;
    const msLeft = new Date(ticket.ends_at).getTime() - Date.now();
    if (msLeft <= 0) return "Llegado";
    const totalMin = Math.round(msLeft / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  })();

  return (
    <div
      className="overflow-hidden rounded-[24px]"
      style={{ boxShadow: "0 8px 32px rgba(10,61,92,0.22)" }}
    >
      {/* ── Mar ── */}
      <div
        className="relative overflow-hidden"
        style={{ height: 148, background: seaBg }}
      >
        {/* Estrellas / horizon glow */}
        <div className="absolute inset-x-0 top-0 h-16 opacity-30"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%,rgba(100,200,255,0.4),transparent)" }} />

        {/* Código en esquina */}
        {ticket.booking_code && (
          <div className="absolute right-3 top-3 rounded-md px-2 py-0.5"
            style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(4px)" }}>
            <span className="text-[10px] font-bold tracking-widest text-white/70">{ticket.booking_code}</span>
          </div>
        )}

        {/* Ruta centrada */}
        <div className="absolute inset-x-0 top-4 flex items-center justify-center gap-3">
          <span className="text-[26px] font-black leading-none tracking-tight text-white drop-shadow-sm">{from || "—"}</span>
          <span className="text-[14px] font-light text-white/40">⟶</span>
          <span className="text-[26px] font-black leading-none tracking-tight text-white drop-shadow-sm">{to || "—"}</span>
        </div>

        {/* Olas */}
        <WaveRow y={68}  speed={8}  opacity={0.18} amplitude={5}  />
        <WaveRow y={82}  speed={11} opacity={0.35} amplitude={7}  />
        <WaveRow y={96}  speed={7}  opacity={0.55} amplitude={5}  />
        <WaveRow y={110} speed={5}  opacity={0.85} amplitude={8}  />

        {/* Barco + track */}
        <div ref={trackRef} className="absolute left-8 right-8" style={{ bottom: 14 }}>
          <div
            className="absolute"
            style={{ bottom: 6, left: boatX, width: BOAT_W, transition: "left 2.5s ease-in-out", zIndex: 4 }}
          >
            <BoatSvg size={BOAT_W} />
          </div>
        </div>
      </div>

      {/* ── Info strip ── */}
      <div style={{ background: "#ffffff" }}>
        {/* Progress bar */}
        <div className="h-[3px] w-full" style={{ background: "#e8f4fb" }}>
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg,#1282a2,#23b5d3)",
              transition: "width 2s linear",
              borderRadius: "0 2px 2px 0",
            }}
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#062d45,#1282a2)" }}
          >
            {(ticket.shared_by_nombre ?? "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-[#062d45]">
              {ticket.shared_by_nombre}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#1282a2]/70">{companiaLabel}</p>
          </div>
          {remainingLabel && (
            <div className="shrink-0 text-right">
              <p className="text-[13px] font-bold tabular-nums text-[#1282a2]">{remainingLabel}</p>
              <p className="mt-0.5 text-[10px] text-[#062d45]/40">restante</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CloudRow ──────────────────────────────────────────────────────────────────

const SHAPES = [
  { w: 80, h: 32 }, { w: 56, h: 24 }, { w: 96, h: 36 }, { w: 64, h: 26 },
];

function CloudRow({ y, speed, opacity, scale, delay }: {
  y: number; speed: number; opacity: number; scale: number; delay: number;
}) {
  return (
    <div
      className="pointer-events-none absolute left-0 flex w-[200%]"
      style={{ top: y, opacity, animation: `sky-drift ${speed}s linear infinite`, animationDelay: `-${delay}s` }}
    >
      {[0, 1].map(copy => (
        <div key={copy} className="flex w-1/2 items-end gap-12 px-6">
          {SHAPES.map((s, i) => (
            <svg key={i} viewBox="0 0 80 32" fill="white" aria-hidden="true"
              style={{ width: s.w * scale, height: s.h * scale, flexShrink: 0 }}>
              <ellipse cx="40" cy="22" rx="36" ry="10" />
              <ellipse cx="28" cy="16" rx="18" ry="14" />
              <ellipse cx="54" cy="14" rx="14" ry="12" />
            </svg>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── WaveRow ───────────────────────────────────────────────────────────────────

function WaveRow({ y, speed, opacity, amplitude }: {
  y: number; speed: number; opacity: number; amplitude: number;
}) {
  const w = 400;
  const h = amplitude * 2 + 4;
  const mid = h / 2;
  const pts: string[] = [];
  for (let x = 0; x <= w; x += 2) {
    const yy = mid + amplitude * Math.sin((x / w) * Math.PI * 4);
    pts.push(`${x},${yy}`);
  }
  const d = `M0,${h} L0,${pts[0]?.split(",")[1] ?? mid} ${pts.map(p => `L${p}`).join(" ")} L${w},${h} Z`;

  return (
    <div
      className="pointer-events-none absolute left-0 w-[200%]"
      style={{ top: y, opacity, animation: `sky-drift ${speed}s linear infinite` }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"
        style={{ width: "100%", height: h, display: "block" }}>
        <path d={d} fill="rgba(255,255,255,1)" />
      </svg>
    </div>
  );
}

// ── Plane SVG ─────────────────────────────────────────────────────────────────

function PlaneSvg({ size = 72 }: { size?: number }) {
  return (
    <svg viewBox="0 0 517 177" aria-hidden="true" style={{ width: size, height: size * (177 / 517) }}>
      <path
        d="M 253.50 169.00 C251.56,172.15 245.00,167.92 245.00,163.52 C245.00,160.53 249.03,157.56 251.87,158.46 C254.45,159.28 255.39,157.60 253.79,155.04 C252.64,153.19 251.50,153.00 241.51,152.98 C235.45,152.97 225.55,152.30 219.50,151.49 C205.46,149.61 203.06,149.63 200.83,151.65 C199.27,153.07 199.00,153.09 199.00,151.81 C199.00,150.55 196.21,150.20 182.25,149.69 C160.59,148.89 141.92,146.07 101.00,137.40 C76.82,132.27 53.31,126.47 46.75,124.01 C41.58,122.07 41.00,121.57 41.00,118.98 C41.00,116.26 40.67,116.04 35.02,114.92 C31.73,114.28 28.52,113.13 27.89,112.37 C26.35,110.51 31.43,110.55 44.41,112.51 C57.11,114.42 60.00,114.42 60.00,112.50 C60.00,111.58 60.94,111.00 62.44,111.00 C63.78,111.00 65.14,110.58 65.45,110.08 C65.95,109.28 60.71,94.11 43.92,47.75 L 40.03 37.00 L 63.17 37.00 L 74.33 47.86 C80.48,53.83 93.85,67.09 104.06,77.33 C121.23,94.56 123.22,96.23 130.56,99.63 C137.41,102.79 139.78,103.37 147.83,103.79 L 157.16 104.28 L 153.08 96.16 C150.84,91.70 149.00,87.81 149.00,87.52 C149.00,87.23 150.25,87.00 151.77,87.00 C153.92,87.00 156.48,88.95 163.25,95.75 L 171.95 104.50 L 189.45 103.94 C199.07,103.64 207.22,103.11 207.55,102.78 C207.89,102.45 207.64,101.19 207.00,100.00 C206.36,98.81 206.10,97.57 206.41,97.25 C207.34,96.32 212.28,98.96 213.88,101.23 L 215.34 103.32 L 311.42 102.64 C394.83,102.05 407.65,101.76 408.62,100.47 C409.55,99.22 409.92,99.20 410.86,100.33 C411.67,101.30 416.18,101.87 426.74,102.32 C448.18,103.24 465.38,106.65 472.00,111.29 C474.68,113.17 473.54,114.00 468.26,114.00 C464.27,114.00 463.89,114.21 464.18,116.25 C464.48,118.37 464.97,118.50 472.50,118.51 C480.99,118.52 483.93,119.55 489.88,124.55 C497.26,130.76 490.61,138.53 474.08,142.98 C470.84,143.85 470.07,144.54 469.81,146.77 C469.51,149.41 469.25,149.52 461.50,150.27 C451.34,151.24 450.39,151.56 452.00,153.50 C452.99,154.69 452.91,155.10 451.61,155.60 C449.40,156.44 449.59,157.85 452.20,159.96 C454.32,161.68 454.34,161.83 452.68,164.37 C450.84,167.17 448.16,167.76 446.20,165.80 C444.54,164.14 444.70,160.50 446.50,159.00 C448.06,157.70 448.41,154.14 447.36,150.20 L 446.74 147.90 L 395.62 148.39 C367.50,148.66 341.69,149.17 338.25,149.53 L 332.00 150.18 L 332.00 143.15 C332.00,139.28 331.53,135.83 330.95,135.47 C326.68,132.83 292.99,128.56 294.40,130.84 C294.81,131.51 297.77,132.03 301.31,132.06 C304.71,132.09 309.75,132.56 312.50,133.10 C317.60,134.11 320.97,134.70 326.75,135.59 L 330.00 136.09 L 330.00 147.42 C330.00,156.36 329.68,159.02 328.47,160.02 C326.11,161.98 297.05,160.78 295.50,158.67 C294.87,157.81 291.36,156.56 287.68,155.89 C284.01,155.21 281.00,154.28 281.00,153.83 C281.00,153.37 277.48,153.00 273.17,153.00 C266.12,153.00 265.12,153.25 263.00,155.50 C261.71,156.88 260.84,158.05 261.08,158.11 C261.31,158.18 262.77,158.38 264.33,158.56 C270.31,159.26 271.87,163.90 267.51,167.99 C265.35,170.02 264.68,170.17 262.46,169.17 C259.33,167.74 254.34,167.64 253.50,169.00 Z"
        fill="#1a3a6b"
      />
    </svg>
  );
}

// ── Boat SVG ──────────────────────────────────────────────────────────────────

function BoatSvg({ size = 56 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 1280 640"
      aria-hidden="true"
      style={{ width: size, height: size * (640 / 1280) }}
    >
      <g transform="translate(0,640) scale(0.1,-0.1)" fill="#062d45" stroke="none">
        <path d="M2255 4856 c-27 -7 -63 -19 -80 -26 l-30 -13 31 -7 c60 -13 72 -34 26 -45 -16 -3 -39 -19 -50 -35 l-22 -29 41 14 c23 8 63 15 90 15 69 0 95 13 102 49 4 17 4 45 1 61 -7 34 -25 37 -109 16z"/>
        <path d="M10630 4731 c-54 -17 -120 -48 -120 -55 0 -2 8 -2 18 1 10 2 31 -1 47 -8 l30 -12 -45 -8 c-25 -4 -205 -15 -400 -23 -334 -16 -438 -20 -970 -46 -709 -34 -1758 -73 -2695 -100 -508 -15 -1216 -12 -1525 5 -662 38 -1736 139 -2545 241 -29 4 -46 3 -42 -2 9 -10 18 -11 662 -83 406 -45 899 -94 1235 -121 69 -6 152 -13 185 -15 207 -18 510 -36 765 -46 540 -22 2075 20 4045 111 848 39 1071 50 1168 56 53 4 97 3 97 -1 0 -5 -7 -17 -17 -27 -25 -27 -12 -30 45 -8 29 11 70 20 91 20 22 0 46 7 55 15 8 8 19 15 25 15 8 0 8 6 2 18 -6 9 -13 34 -16 55 -7 43 -13 44 -95 18z"/>
        <path d="M1680 3695 l-715 -974 -295 0 -295 -1 -100 155 -100 154 -35 -26 c-46 -34 -130 -115 -130 -125 0 -5 9 -4 19 2 25 13 71 13 71 1 0 -6 -9 -16 -20 -24 -13 -9 -23 -30 -26 -53 l-6 -39 27 33 c15 18 52 47 83 64 30 17 57 40 60 50 3 15 22 -7 72 -84 36 -57 63 -105 59 -108 -5 -3 -1 -33 8 -66 15 -54 22 -65 62 -92 25 -17 82 -45 126 -63 100 -41 135 -73 135 -126 0 -42 -16 -72 -83 -152 -76 -90 -83 -156 -37 -337 48 -191 118 -270 295 -331 l80 -28 5500 3 c5489 3 5500 3 5620 23 277 48 478 117 564 194 64 58 83 117 92 290 5 108 18 204 45 340 21 105 40 220 42 258 l4 67 -47 0 -46 0 1 108 c1 59 1 112 1 118 -1 7 -11 12 -23 12 -13 0 -60 3 -105 7 -60 6 -83 5 -83 -4 0 -6 6 -11 13 -11 15 0 64 -37 57 -43 -3 -2 -24 -7 -48 -10 l-42 -5 -867 853 c-477 470 -869 852 -872 850 -2 -3 1 -11 7 -18 7 -8 8 -17 4 -21 -4 -4 -2 -6 4 -4 14 4 67 -48 904 -872 349 -344 675 -664 724 -711 49 -47 85 -89 80 -92 -14 -8 -1628 1290 -1635 1316 -3 12 -19 93 -35 181 -15 87 -30 154 -32 148 -1 -5 9 -77 23 -160 14 -82 25 -156 25 -164 0 -11 -18 -17 -66 -22 -37 -4 -68 -5 -70 -3 -2 1 15 77 37 167 22 91 38 171 36 180 -2 8 -23 -67 -47 -167 l-44 -183 -31 -5 c-29 -5 -1288 -135 -1306 -135 -5 0 -9 7 -9 16 0 19 4 19 -232 -12 -146 -19 -135 -8 -118 -128 9 -58 8 -71 -4 -78 -8 -4 -12 -16 -10 -25 5 -22 104 -783 104 -800 0 -10 -126 -13 -619 -13 l-619 0 -5 28 c-3 15 -29 212 -57 437 -44 337 -56 413 -71 425 -12 11 -19 37 -24 93 -5 48 -12 80 -20 83 -12 5 -334 -34 -346 -42 -5 -3 3 -89 15 -156 4 -21 1 -28 -10 -28 -11 0 -14 -8 -10 -32 3 -18 26 -190 51 -383 25 -192 48 -367 51 -387 l6 -38 -649 0 -649 0 -53 413 c-66 508 -61 477 -76 477 -9 0 -17 30 -26 90 -9 71 -15 90 -28 90 -24 0 -335 -42 -340 -46 -1 -1 2 -42 9 -90 9 -69 9 -89 -1 -95 -10 -6 -2 -87 35 -376 27 -202 51 -389 54 -415 l5 -48 -581 0 -580 0 -10 68 c-5 37 -31 237 -58 444 -35 266 -53 378 -61 378 -14 0 -20 20 -31 110 l-7 65 -40 -1 c-22 0 -102 -9 -179 -19 l-139 -18 7 -70 c4 -39 9 -81 12 -94 5 -17 2 -23 -10 -23 -14 0 -16 -7 -11 -32 5 -33 105 -793 105 -804 0 -30 -140 106 -785 766 -411 421 -784 802 -829 847 l-81 82 -715 -974z m841 828 c63 -65 423 -433 799 -817 377 -385 678 -696 669 -690 -8 5 -353 287 -766 627 l-751 617 -10 48 c-6 26 -16 82 -23 125 -6 43 -14 75 -16 73 -3 -3 2 -49 11 -103 108 -663 256 -1593 256 -1605 0 -4 -47 -8 -105 -8 l-105 0 0 -80 0 -80 -325 0 -325 0 0 40 0 40 -425 0 c-234 0 -425 3 -425 6 0 10 1411 1924 1419 1924 4 0 59 -53 122 -117z m739 -928 l754 -620 -432 -3 -432 -2 0 -90 0 -90 -212 2 -212 3 -43 245 c-24 135 -79 452 -124 705 -44 253 -82 468 -85 479 -6 17 -4 17 13 5 11 -8 359 -293 773 -634z m7560 537 c0 -10 -43 -142 -96 -293 -235 -672 -384 -1099 -390 -1124 -3 -14 -8 -24 -10 -22 -2 2 36 172 86 378 50 206 104 430 120 499 16 69 54 224 83 345 l53 220 54 6 c99 10 100 10 100 -9z m-174 -19 c-3 -10 -24 -97 -47 -193 -23 -96 -54 -227 -69 -290 -193 -805 -241 -1007 -245 -1018 -4 -11 -16 -8 -49 12 -25 14 -64 28 -88 30 l-43 4 -3 66 -3 66 -59 0 -60 0 0 90 0 90 -255 0 c-207 0 -255 3 -255 13 0 8 -22 182 -49 388 -27 206 -53 400 -56 432 -5 37 -12 57 -21 57 -8 0 -15 18 -19 48 -14 95 -26 85 120 100 72 7 355 37 630 66 587 63 578 62 571 39z m1801 -1272 l182 -146 -82 -3 c-611 -20 -1433 -39 -1438 -34 -3 4 -34 160 -68 347 -34 187 -93 510 -131 719 -39 208 -70 385 -70 392 0 7 321 -244 713 -558 391 -314 794 -637 894 -717z m-1502 515 c62 -386 112 -702 111 -703 -1 -1 -50 -3 -110 -4 l-108 -1 -21 -35 -20 -35 -246 7 c-135 4 -246 8 -247 9 -1 0 40 118 91 261 50 143 167 478 260 744 93 266 171 478 173 471 3 -7 55 -329 117 -714z m1590 -558 l40 -42 -42 33 c-45 34 -60 51 -46 51 5 0 27 -19 48 -42z m79 15 c34 -11 42 -11 63 2 l23 15 0 -68 c0 -92 -16 -92 -111 4 -80 81 -78 83 25 47z"/>
        <path d="M2412 4540 c0 -14 2 -19 5 -12 2 6 2 18 0 25 -3 6 -5 1 -5 -13z"/>
      </g>
    </svg>
  );
}
