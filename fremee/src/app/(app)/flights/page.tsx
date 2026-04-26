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
import { buildAishubVesselUrl, buildOpenSkyStatesUrl } from "@/config/external";

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

type VesselPosition = {
  mmsi:        string;
  name:        string | null;
  latitude:    number;
  longitude:   number;
  sog:         number | null; // speed over ground (knots)
  cog:         number | null; // course over ground
  heading:     number | null;
  destination: string | null;
  updated_at:  string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const AISHUB_KEY = process.env.NEXT_PUBLIC_AISHUB_KEY ?? "";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlightsPage() {
  const router = useRouter();
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [flights,   setFlights]   = useState<PlanTicket[]>([]);
  const [ferries,   setFerries]   = useState<PlanTicket[]>([]);
  const [positions, setPositions] = useState<Record<string, FlightPosition>>({});
  const [vessels,   setVessels]   = useState<Record<string, VesselPosition>>({});
  const [loading,   setLoading]   = useState(true);

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

  const flightPollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const flightsRef     = useRef<PlanTicket[]>([]);
  flightsRef.current   = flights;

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
        const res = await fetch(`/api/flights/track?${params}`);
        if (!res.ok) return;
        const pos = await res.json() as FlightPosition;
        setPositions(prev => ({ ...prev, [pos.callsign]: pos }));
      } catch { /* silent */ }
    }
  }

  // ── Ferry polling (AISHub) ────────────────────────────────────────────────

  const ferryPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ferriesRef   = useRef<PlanTicket[]>([]);
  ferriesRef.current = ferries;

  async function pollVessel(ticket: PlanTicket) {
    const mmsi = ticket.booking_code?.trim();
    if (!mmsi || !AISHUB_KEY) return;
    try {
      const url = buildAishubVesselUrl(AISHUB_KEY, mmsi);
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const raw = await res.json() as unknown[];
      if (!Array.isArray(raw) || raw.length < 2) return;
      const d = raw[1] as Record<string, unknown>;
      if (!d.LATITUDE || !d.LONGITUDE) return;
      const pos: VesselPosition = {
        mmsi:        String(d.MMSI),
        name:        d.NAME ? String(d.NAME) : null,
        latitude:    Number(d.LATITUDE),
        longitude:   Number(d.LONGITUDE),
        sog:         d.SOG != null ? Number(d.SOG) : null,
        cog:         d.COG != null ? Number(d.COG) : null,
        heading:     d.HEADING != null ? Number(d.HEADING) : null,
        destination: d.DEST ? String(d.DEST) : null,
        updated_at:  new Date().toISOString(),
      };
      setVessels(prev => ({ ...prev, [pos.mmsi]: pos }));
    } catch { /* silent */ }
  }

  async function pollAllFlights()  { for (const t of flightsRef.current)  await pollFlight(t); }
  async function pollAllVessels()  { for (const t of ferriesRef.current)   await pollVessel(t); }

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
      if (ferryPollRef.current)  clearInterval(ferryPollRef.current);
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

  useEffect(() => {
    if (ferryPollRef.current) clearInterval(ferryPollRef.current);
    if (ferries.length === 0) return;
    pollAllVessels();
    ferryPollRef.current = setInterval(pollAllVessels, 60_000); // AISHub: 60s
    return () => { if (ferryPollRef.current) clearInterval(ferryPollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferries]);

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
                    position={ticket.booking_code ? vessels[ticket.booking_code.trim()] ?? null : null}
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

  const PLANE_W  = 72;
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    if (!trackRef.current) return;
    const ro = new ResizeObserver(e => setTrackW(e[0].contentRect.width));
    ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, []);

  const planeX   = progress * Math.max(0, trackW - PLANE_W);
  const speedKmh = position?.velocity_ms ? Math.round(position.velocity_ms * 3.6) : null;
  const altKm    = position?.altitude_m  ? (position.altitude_m / 1000).toFixed(1) : null;

  const originCity = AIRPORTS[from.toUpperCase()]?.city ?? from;
  const destCity   = AIRPORTS[to.toUpperCase()]?.city   ?? to;

  const staleMs = position ? nowTs - new Date(position.updated_at).getTime() : null;
  const isStale = staleMs != null && staleMs > 90_000;

  return (
    <div className="overflow-hidden rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
      <div
        className="relative overflow-hidden"
        style={{ height: 130, background: "linear-gradient(180deg,#b8d4f0 0%,#cde4f7 60%,#daeeff 100%)" }}
      >
        <CloudRow y={8}  speed={28} opacity={0.9} scale={1}   delay={0}  />
        <CloudRow y={36} speed={40} opacity={0.6} scale={0.7} delay={8}  />
        <CloudRow y={60} speed={22} opacity={0.4} scale={1.1} delay={14} />

        <div className="absolute inset-x-5 top-3 flex justify-between">
          <span className="text-[22px] font-black leading-none text-[#1a3a6b]">{from || "—"}</span>
          <span className="text-[22px] font-black leading-none text-[#1a3a6b]">{to   || "—"}</span>
        </div>

        <div ref={trackRef} className="absolute left-6 right-6" style={{ bottom: 18 }}>
          <div
            className="plane-bob absolute"
            style={{ bottom: 10, left: planeX, width: PLANE_W, transition: "left 2s linear", zIndex: 1 }}
          >
            <PlaneSvg size={PLANE_W} />
          </div>
          <div className="relative" style={{ zIndex: 2 }}>
            <div className="absolute left-0 right-0" style={{ top: 6, height: 2, background: "rgba(26,58,107,0.15)", borderRadius: 1 }} />
            <div className="absolute left-0" style={{ top: 6, height: 2, width: `${progress * 100}%`, background: "#1a3a6b", borderRadius: 1, transition: "width 2s linear" }} />
            <div className="absolute" style={{ left: -6, top: 0, width: 14, height: 14, borderRadius: "50%", background: "#1a3a6b", border: "2.5px solid white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
            <div className="absolute" style={{ right: -6, top: 0, width: 14, height: 14, borderRadius: "50%", background: "white", border: "2.5px solid #1a3a6b", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white px-4 py-3">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: "#1a3a6b" }}
        >
          {(ticket.shared_by_nombre ?? "?")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[#1a3a6b]">
            {ticket.shared_by_nombre} · {originCity} → {destCity}
          </p>
          <p className="mt-0.5 text-[11px] text-[#2d6aad]/70">
            {position?.on_ground
              ? "En tierra"
              : `${Math.round(progress * 100)}% del trayecto${isStale ? " · actualizando…" : ""}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold tracking-widest text-[#1a3a6b]/60">{ticket.booking_code}</p>
          {speedKmh && (
            <p className="mt-0.5 text-[11px] text-[#2d6aad]/50">{speedKmh} km/h · {altKm} km</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FerryWidget ───────────────────────────────────────────────────────────────

function FerryWidget({ ticket, position, nowTs }: { ticket: PlanTicket; position: VesselPosition | null; nowTs: number }) {
  const from = ticket.from_label ?? "";
  const to   = ticket.to_label   ?? "";

  const progress  = flightProgressFromTime(ticket.starts_at, ticket.ends_at ?? ticket.starts_at);

  const BOAT_W   = 56;
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    if (!trackRef.current) return;
    const ro = new ResizeObserver(e => setTrackW(e[0].contentRect.width));
    ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, []);

  const boatX    = progress * Math.max(0, trackW - BOAT_W);
  const speedKn  = position?.sog ? Math.round(position.sog) : null;

  const staleMs  = position ? nowTs - new Date(position.updated_at).getTime() : null;
  const isStale  = staleMs != null && staleMs > 180_000;

  return (
    <div className="overflow-hidden rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
      {/* Sea */}
      <div
        className="relative overflow-hidden"
        style={{ height: 130, background: "linear-gradient(180deg,#0a3d5c 0%,#0e6b8c 40%,#1a9abd 70%,#2ab8d9 100%)" }}
      >
        {/* Wave layers */}
        <WaveRow y={55}  speed={6}  opacity={0.35} amplitude={6}  />
        <WaveRow y={70}  speed={9}  opacity={0.5}  amplitude={8}  />
        <WaveRow y={85}  speed={7}  opacity={0.7}  amplitude={5}  />
        <WaveRow y={100} speed={5}  opacity={0.9}  amplitude={9}  />

        {/* Port labels */}
        <div className="absolute inset-x-5 top-3 flex justify-between">
          <span className="text-[22px] font-black leading-none text-white/90">{from || "—"}</span>
          <span className="text-[22px] font-black leading-none text-white/90">{to   || "—"}</span>
        </div>

        {/* Boat track */}
        <div ref={trackRef} className="absolute left-6 right-6" style={{ bottom: 16 }}>
          <div
            className="absolute"
            style={{ bottom: 8, left: boatX, width: BOAT_W, transition: "left 2s linear", zIndex: 3 }}
          >
            <BoatSvg size={BOAT_W} />
          </div>
          <div className="relative" style={{ zIndex: 2 }}>
            {/* Wake line */}
            <div className="absolute left-0 right-0" style={{ top: 6, height: 2, background: "rgba(255,255,255,0.15)", borderRadius: 1 }} />
            <div className="absolute left-0" style={{ top: 6, height: 2, width: `${progress * 100}%`, background: "rgba(255,255,255,0.5)", borderRadius: 1, transition: "width 2s linear" }} />
            <div className="absolute" style={{ left: -6, top: 0, width: 14, height: 14, borderRadius: "50%", background: "white", border: "2.5px solid rgba(255,255,255,0.5)", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
            <div className="absolute" style={{ right: -6, top: 0, width: 14, height: 14, borderRadius: "50%", background: "transparent", border: "2.5px solid rgba(255,255,255,0.5)", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
          </div>
        </div>
      </div>

      {/* Info strip */}
      <div className="flex items-center gap-3 bg-white px-4 py-3">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: "#0a3d5c" }}
        >
          {(ticket.shared_by_nombre ?? "?")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[#0a3d5c]">
            {ticket.shared_by_nombre} · {from} → {to}
          </p>
          <p className="mt-0.5 text-[11px] text-[#0e6b8c]/70">
            {`${Math.round(progress * 100)}% del trayecto${isStale ? " · actualizando…" : ""}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold tracking-widest text-[#0a3d5c]/60">{ticket.booking_code}</p>
          {speedKn && (
            <p className="mt-0.5 text-[11px] text-[#0e6b8c]/50">{speedKn} kn</p>
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
  // SVG sinusoidal wave that tiles horizontally
  const w = 400;
  const h = amplitude * 2 + 4;
  const mid = h / 2;
  // Build a smooth wave path
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

// ── Boat SVG (placeholder — reemplazar con el SVG real) ───────────────────────

function BoatSvg({ size = 56 }: { size?: number }) {
  // TODO: reemplazar con el SVG del barco real cuando lo proporcione el usuario
  return (
    <svg viewBox="0 0 64 40" aria-hidden="true" style={{ width: size, height: size * (40 / 64) }}>
      {/* Casco */}
      <path d="M8 24 L56 24 L50 34 Q32 38 14 34 Z" fill="white" />
      {/* Cubierta */}
      <rect x="20" y="16" width="24" height="8" rx="1" fill="#e8eef5" />
      {/* Superestructura */}
      <rect x="26" y="10" width="14" height="6" rx="1" fill="white" />
      {/* Chimenea */}
      <rect x="31" y="5" width="4" height="5" rx="1" fill="#cc2222" />
      {/* Línea de flotación */}
      <line x1="8" y1="28" x2="56" y2="28" stroke="#1a3a6b" strokeWidth="1.5" opacity="0.3" />
    </svg>
  );
}
