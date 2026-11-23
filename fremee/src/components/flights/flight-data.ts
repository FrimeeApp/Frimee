"use client";
/**
 * Vuelos de amistades: datos, estado y progreso.
 *
 * Los billetes de vuelo de tus amistades llegan de fn_vuelos_amistades (solo nombre, título, ruta y horas,
 * y solo si esa persona deja verlos). El estado sale de las horas del billete; el progreso, de la posición
 * del avión en OpenSky cuando se encuentra, y si no, de las horas.
 * Una sola carga compartida (cada 60 s) mientras haya alguna pantalla que lo use.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { buildInternalApiUrl, buildOpenSkyStatesUrl } from "@/config/external";
import { AIRPORTS, airportTz, flightProgressFromPosition } from "@/lib/airports";
import { flightCallsign } from "@/lib/airlines";

export type FlightState = "scheduled" | "airborne" | "landed";

export type FlightAirport = { iata: string; city: string; tz: string };

export type FriendFlight = {
  id: string;
  userId: string;
  friendName: string;
  /** «IB 3157», si el título lo trae. */
  flightNumber: string | null;
  /** Indicativo ICAO para seguir el avión («IBE3157»). */
  callsign: string | null;
  from: FlightAirport;
  to: FlightAirport;
  depAt: string; // ISO
  arrAt: string; // ISO
  /** 0..1 según la posición real del avión. null si no se encuentra. */
  liveProgress: number | null;
  updatedAt: string; // ISO
};

type Row = {
  id: string; user_id: string; nombre: string; title: string;
  from_label: string | null; to_label: string | null; starts_at: string; ends_at: string;
};

/* ---------------- estado y progreso ---------------- */

const ms = (iso: string) => new Date(iso).getTime();
const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function flightStateAt(f: FriendFlight, now: number): FlightState {
  if (now < ms(f.depAt)) return "scheduled";
  if (now > ms(f.arrAt)) return "landed";
  return "airborne";
}

/** GPS si lo hay; si no, por las horas del billete. */
export function flightProgress(f: FriendFlight, now: number): { p: number; live: boolean } {
  const state = flightStateAt(f, now);
  if (state === "landed") return { p: 1, live: false };
  if (state === "scheduled") return { p: 0, live: false };
  if (f.liveProgress != null) return { p: clamp01(f.liveProgress), live: true };
  return { p: clamp01((now - ms(f.depAt)) / (ms(f.arrAt) - ms(f.depAt))), live: false };
}

export function hhmm(iso: string, tz: string) {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}

export function duration(msLeft: number) {
  const m = Math.max(0, Math.round(msLeft / 60000));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** Texto para la fila de la lista de chats (cuando no hay mensajes sin leer). */
export function flightPreview(f: FriendFlight, now: number): string {
  const state = flightStateAt(f, now);
  if (state === "scheduled") return `Vuela pronto · sale ${hhmm(f.depAt, f.from.tz)} · ${f.from.iata} → ${f.to.iata}`;
  if (state === "airborne") return `En el aire · llega ${hhmm(f.arrAt, f.to.tz)}${f.to.tz !== f.from.tz ? " h. local" : ""}`;
  return `Ha aterrizado en ${f.to.city}`;
}

/** Para el aria-label de la fila: «Ana, en el aire · llega 11:40». */
export function flightA11y(f: FriendFlight, now: number) {
  return `${f.friendName}, ${flightPreview(f, now).toLowerCase()}`;
}

/* ---------------- reloj ---------------- */

export function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

/* ---------------- carga compartida ---------------- */

const toAirport = (label: string | null): FlightAirport => {
  const iata = (label ?? "").trim().toUpperCase();
  return { iata: iata || "—", city: AIRPORTS[iata]?.city ?? (label?.trim() || "—"), tz: airportTz(iata) };
};

const NUMBER_RE = /\b([A-Z0-9]{2})\s?(\d{1,4})[A-Z]?\b/;

function toFlight(r: Row, prev?: FriendFlight): FriendFlight {
  const m = NUMBER_RE.exec(r.title.toUpperCase());
  return {
    id: r.id,
    userId: r.user_id,
    friendName: r.nombre.trim().split(/\s+/)[0] || "Alguien",
    flightNumber: m ? `${m[1]} ${m[2]}` : null,
    callsign: flightCallsign(r.title),
    from: toAirport(r.from_label),
    to: toAirport(r.to_label),
    depAt: r.starts_at,
    arrAt: r.ends_at,
    liveProgress: prev?.liveProgress ?? null,
    updatedAt: prev?.updatedAt ?? new Date().toISOString(),
  };
}

/** Posición del avión → progreso 0..1 sobre su ruta. null si no se encuentra o no conocemos la ruta. */
async function fetchLiveProgress(f: FriendFlight): Promise<number | null> {
  if (!f.callsign) return null;
  try {
    let lat: number | null = null;
    let lon: number | null = null;
    if (process.env.NEXT_PUBLIC_BUILD_TARGET === "capacitor") {
      const res = await fetch(buildOpenSkyStatesUrl(f.callsign), { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const data = (await res.json()) as { states: unknown[][] | null };
      const s = data.states?.[0];
      if (!s) return null;
      lat = s[6] as number | null;
      lon = s[5] as number | null;
    } else {
      const res = await fetch(buildInternalApiUrl(`/api/flights/track?${new URLSearchParams({ callsign: f.callsign })}`));
      if (!res.ok) return null;
      const data = (await res.json()) as { latitude: number | null; longitude: number | null };
      lat = data.latitude;
      lon = data.longitude;
    }
    if (lat == null || lon == null) return null;
    return flightProgressFromPosition(f.from.iata, f.to.iata, lat, lon);
  } catch {
    return null;
  }
}

type Snapshot = { flights: FriendFlight[] };
const EMPTY: Snapshot = { flights: [] };
let snapshot: Snapshot = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

const emit = () => listeners.forEach((l) => l());

async function load() {
  try {
    const { data, error } = await createBrowserSupabaseClient().rpc("fn_vuelos_amistades");
    if (error) throw error;
    const prev = new Map(snapshot.flights.map((f) => [f.id, f]));
    const flights = ((data ?? []) as Row[]).map((r) => toFlight(r, prev.get(r.id)));
    snapshot = { flights };
    emit();
    const now = Date.now();
    const live = await Promise.all(
      flights.map(async (f) => (flightStateAt(f, now) === "airborne" ? await fetchLiveProgress(f) : null)),
    );
    snapshot = {
      flights: flights.map((f, i) => (live[i] != null ? { ...f, liveProgress: live[i], updatedAt: new Date().toISOString() } : { ...f, liveProgress: null })),
    };
    emit();
  } catch {
    /* sin sesión o sin red: se queda lo que había */
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    void load();
    timer = setInterval(() => void load(), 60_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      snapshot = EMPTY;
    }
  };
}

/** Los vuelos de tus amistades que están en ventana (3 h antes de salir hasta 1 h después de aterrizar). */
export function useFriendFlights(): FriendFlight[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY).flights;
}

/** El vuelo de una amistad concreta, si lo hay. */
export function useFriendFlight(userId: string | null | undefined): FriendFlight | null {
  const flights = useFriendFlights();
  return userId ? (flights.find((f) => f.userId === userId) ?? null) : null;
}
