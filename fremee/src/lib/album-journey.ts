import type { AlbumActividad, AlbumFoto, PlanAlbum } from "@/services/api/endpoints/album.endpoint";
import { buildAlbumModel, parseKm, type AlbumModel } from "@/lib/album";
import { decodePolyline, type LatLng } from "@/lib/polyline";
import { TIPOS_TRANSPORTE, type TipoSubplan } from "@/services/api/endpoints/subplanes.endpoint";

/** One activity of the trip as a stop of the journey. */
export type JourneyStop = {
  /** Unique within the trip: the activity id, plus "-llegada" for a flight's landing. */
  key: string;
  actividad: AlbumActividad;
  /** The landing end of a flight or ferry (a stop of its own, with no photos). */
  arrival: boolean;
  /** When the group is here, and when it leaves (ISO). */
  time: string;
  leaves: string;
  /** Place name shown for this stop. */
  place: string;
  at: LatLng | null;
  /** Day photos placed at this stop (closest activity in time, for now). */
  fotos: AlbumFoto[];
  /** Expenses linked to this activity. */
  gasto: number;
};

/** The way from stops[i] to stops[i + 1]. */
export type JourneyLeg = {
  /** Travel mode (APIE, METRO...) or the activity type for flights and ferries (VUELO, BARCO). */
  transporte: string | null;
  /** A flight or ferry between cities: drawn as an arc, framed on its own, km kept apart. */
  long: boolean;
  /** Straight-line km of a flight or ferry (not added to the km travelled in town). */
  longKm: number;
  duracion: string | null;
  distancia: string | null;
  km: number;
  /** Saved route, or a straight line when only both ends are known; null without coordinates. */
  points: LatLng[] | null;
  routed: boolean;
};

export type JourneyDay = {
  key: string;
  number: number;
  /** First activity start (for the header). */
  firstAt: string;
  stops: JourneyStop[];
  legs: JourneyLeg[];
  km: number;
  fotos: number;
  gasto: number;
};

/** Scroll steps of the story, in reading order. */
export type JourneyStep =
  | { kind: "cover" }
  | { kind: "day"; day: number }
  | { kind: "stop"; day: number; stop: number }
  | { kind: "leg"; day: number; leg: number }
  | { kind: "final" };

export type Journey = {
  model: AlbumModel;
  days: JourneyDay[];
  /** The whole trip as one "day" (no leg between days): the final map shows it all. */
  trip: JourneyDay;
  steps: JourneyStep[];
};

function coordsOf(a: AlbumActividad): LatLng | null {
  return a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null;
}

/** Where the way out of an activity starts: a flight or ferry ends at its destination. */
function exitOf(a: AlbumActividad): LatLng | null {
  const isTransport = TIPOS_TRANSPORTE.includes(a.tipo as TipoSubplan);
  if (isTransport && a.fin_lat != null && a.fin_lng != null) return { lat: a.fin_lat, lng: a.fin_lng };
  return coordsOf(a);
}

/** Each photo goes to the last activity that started before it (or the first one). */
function placePhotos(actividades: AlbumActividad[], fotos: AlbumFoto[]): AlbumFoto[][] {
  const buckets = actividades.map((): AlbumFoto[] => []);
  if (actividades.length === 0) return buckets;
  for (const foto of fotos) {
    const at = Date.parse(foto.created_at);
    let index = 0;
    actividades.forEach((a, i) => { if (Date.parse(a.inicio_at) <= at) index = i; });
    buckets.at(index)?.push(foto);
  }
  return buckets;
}

export function buildJourney(album: PlanAlbum): Journey {
  const model = buildAlbumModel(album);
  const days: JourneyDay[] = model.days
    .filter((day) => day.actividades.length > 0)
    .map((day) => {
      const fotosPorParada = placePhotos(day.actividades, day.fotos);
      const stops: JourneyStop[] = [];
      const legs: JourneyLeg[] = [];
      day.actividades.forEach((a, i) => {
        const at = coordsOf(a);
        const previous = stops.at(-1);
        if (previous) {
          const start = previous.arrival ? previous.at : exitOf(previous.actividad);
          const route = a.ruta_polyline ? decodePolyline(a.ruta_polyline) : [];
          legs.push({
            transporte: a.transporte_llegada,
            long: false,
            longKm: 0,
            duracion: a.duracion_viaje,
            distancia: a.distancia_viaje,
            km: parseKm(a.distancia_viaje),
            points: route.length > 1 ? route : start && at ? [start, at] : null,
            routed: route.length > 1,
          });
        }
        const isLong = TIPOS_TRANSPORTE.includes(a.tipo as TipoSubplan) && at != null && a.fin_lat != null && a.fin_lng != null;
        stops.push({
          key: String(a.id),
          actividad: a,
          arrival: false,
          time: a.inicio_at,
          leaves: isLong ? a.inicio_at : a.fin_at || a.inicio_at,
          place: a.ubicacion_nombre?.split(",")[0]?.trim() || a.titulo,
          at,
          fotos: fotosPorParada.at(i) ?? [],
          gasto: album.gastos.filter((g) => g.subplan_id === a.id).reduce((sum, g) => sum + g.total, 0),
        });
        if (isLong && at) {
          const landing = { lat: a.fin_lat as number, lng: a.fin_lng as number };
          legs.push({
            transporte: a.tipo,
            long: true,
            longKm: Math.round(metres(at, landing) / 1000),
            duracion: null,
            distancia: null,
            km: 0,
            points: arc(at, landing),
            routed: true,
          });
          stops.push({
            key: `${a.id}-llegada`,
            actividad: a,
            arrival: true,
            time: a.fin_at || a.inicio_at,
            leaves: a.fin_at || a.inicio_at,
            place: a.fin_nombre?.split(",")[0]?.trim() || "Llegada",
            at: landing,
            fotos: [],
            gasto: 0,
          });
        }
      });
      return {
        key: day.key,
        number: day.number,
        firstAt: day.actividades[0]?.inicio_at ?? `${day.key}T12:00:00`,
        stops,
        legs,
        km: day.km,
        fotos: day.fotos.length,
        gasto: day.gastoTotal,
      };
    });

  const steps: JourneyStep[] = [{ kind: "cover" }];
  days.forEach((day, d) => {
    steps.push({ kind: "day", day: d });
    day.stops.forEach((_, s) => {
      steps.push({ kind: "stop", day: d, stop: s });
      if (s < day.legs.length) steps.push({ kind: "leg", day: d, leg: s });
    });
  });
  steps.push({ kind: "final" });

  const noLeg: JourneyLeg = { transporte: null, long: false, longKm: 0, duracion: null, distancia: null, km: 0, points: null, routed: false };
  const trip: JourneyDay = {
    key: "trip",
    number: 0,
    firstAt: days[0]?.firstAt ?? album.plan.inicio_at,
    stops: days.flatMap((d) => d.stops),
    legs: days.flatMap((d, i) => (i < days.length - 1 ? [...d.legs, noLeg] : d.legs)),
    km: days.reduce((sum, d) => sum + d.km, 0),
    fotos: days.reduce((sum, d) => sum + d.fotos, 0),
    gasto: days.reduce((sum, d) => sum + d.gasto, 0),
  };

  return { model, days, trip, steps };
}

/** Where the group is: on which day, at which stop, and how far along the next leg (0–1). */
export type JourneyPosition = { day: number; stop: number; legT: number; started: boolean; finished: boolean };

export function positionAt(journey: Journey, stepIndex: number, t: number): JourneyPosition {
  const step = journey.steps.at(stepIndex) ?? { kind: "cover" as const };
  const lastDay = Math.max(0, journey.days.length - 1);
  switch (step.kind) {
    case "cover":
      return { day: 0, stop: 0, legT: 0, started: false, finished: false };
    case "day":
      return { day: step.day, stop: 0, legT: 0, started: false, finished: false };
    case "stop":
      return { day: step.day, stop: step.stop, legT: 0, started: true, finished: false };
    case "leg":
      return { day: step.day, stop: step.leg, legT: t, started: true, finished: false };
    case "final":
      // On the whole-trip map (journey.trip): parked at the very last stop.
      return { day: lastDay, stop: Math.max(0, journey.trip.stops.length - 1), legT: 0, started: true, finished: true };
  }
}

// ── Geometry along a leg ─────────────────────────────────────────────────────

/** Rough metres between two points (equirectangular): plenty for splitting a city route. */
function metres(a: LatLng, b: LatLng) {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dx = (b.lng - a.lng) * k;
  const dy = b.lat - a.lat;
  return Math.sqrt(dx * dx + dy * dy) * 111_320;
}

/** A gentle curve between two far points (not the real route): how flights and ferries are drawn. */
function arc(a: LatLng, b: LatLng, samples = 48): LatLng[] {
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  // Bend sideways by a fifth of the distance, always to the same side of the line.
  const control = { lat: mid.lat + (b.lng - a.lng) * 0.2, lng: mid.lng - (b.lat - a.lat) * 0.2 };
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    const u = 1 - t;
    return {
      lat: u * u * a.lat + 2 * u * t * control.lat + t * t * b.lat,
      lng: u * u * a.lng + 2 * u * t * control.lng + t * t * b.lng,
    };
  });
}

/** The first `t` (0–1) of a line, by distance: the trail already travelled. */
export function lineUpTo(points: LatLng[], t: number): LatLng[] {
  if (points.length < 2 || t <= 0) return points.slice(0, 1);
  if (t >= 1) return points;
  const lengths = points.slice(1).map((p, i) => metres(points.at(i) ?? p, p));
  const target = lengths.reduce((a, b) => a + b, 0) * t;
  const out: LatLng[] = [points[0]];
  let walked = 0;
  for (let i = 0; i < lengths.length; i++) {
    const seg = lengths.at(i) ?? 0;
    const a = points.at(i) as LatLng;
    const b = points.at(i + 1) as LatLng;
    if (walked + seg >= target) {
      const f = seg > 0 ? (target - walked) / seg : 0;
      out.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f });
      return out;
    }
    walked += seg;
    out.push(b);
  }
  return out;
}

/** Where the group is on the map for a position: along the current leg, else at its stop. */
export function vehicleAt(day: JourneyDay | undefined, position: JourneyPosition): LatLng | null {
  if (!day) return null;
  const leg = day.legs.at(position.stop);
  if (!position.finished && position.legT > 0 && leg?.points) return lineUpTo(leg.points, position.legT).at(-1) ?? null;
  const stop = day.stops.at(position.stop);
  return stop?.at ?? day.stops.find((s) => s.at)?.at ?? null;
}

/** Transport shown on the vehicle: the leg being travelled, or the next one from this stop. */
export function vehicleTransport(day: JourneyDay | undefined, position: JourneyPosition): string | null {
  if (!day || position.finished) return null;
  return day.legs.at(position.stop)?.transporte ?? day.legs.at(position.stop - 1)?.transporte ?? null;
}

/** Bounding box [west, south, east, north] of a day: stops plus routes. */
export function dayBounds(day: JourneyDay | undefined, routesOnly = false): [number, number, number, number] | null {
  if (!day) return null;
  const routes = day.legs.flatMap((l) => l.points ?? []);
  // routesOnly (cover): frame where the group gets around at the destination, not the
  // flights there and back nor a lone far stop.
  const localRoutes = day.legs.flatMap((l) => (l.long ? [] : l.points ?? []));
  const points = routesOnly && localRoutes.length > 0 ? localRoutes : [...day.stops.flatMap((s) => (s.at ? [s.at] : [])), ...routes];
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

// ── Natural movement ─────────────────────────────────────────────────────────

/** Start slowly, cruise, slow down on arrival (ease in-out). */
export const travelEase = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 0.5 - Math.cos(Math.PI * t) / 2);

/**
 * The position as one number per day: stop index plus how far along the next leg (eased).
 * 2.5 = halfway from the third stop to the fourth. Smoothing this number makes the group glide.
 */
export function routeProgress(position: JourneyPosition): number {
  if (!position.started) return 0;
  return position.stop + travelEase(position.legT);
}

/** Back from the smoothed number to a position; close to a stop counts as being at it. */
export function positionFromProgress(base: JourneyPosition, progress: number): JourneyPosition {
  if (!base.started || base.finished) return base;
  const nearest = Math.round(progress);
  if (Math.abs(progress - nearest) < 0.004) return { ...base, stop: nearest, legT: 0 };
  const stop = Math.floor(progress);
  return { ...base, stop, legT: progress - stop };
}

// ── Dashboard and ambience ───────────────────────────────────────────────────

export type Ambient = "manana" | "tarde" | "atardecer" | "noche";

/** Part of the day for a local time: morning until 14:00, afternoon until 18:00, sunset until 20:30, then night. */
export function ambientAt(date: Date): Ambient {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 7 * 60) return "noche";
  if (minutes < 14 * 60) return "manana";
  if (minutes < 18 * 60) return "tarde";
  if (minutes < 20 * 60 + 30) return "atardecer";
  return "noche";
}

export type Dashboard = { time: Date; km: number; gasto: number; ambient: Ambient };

/**
 * What the dashboard shows for a position: the clock (at a stop, its start; along a leg, from
 * the previous stop's end to the next one's start), the day's km so far, and the day's spending
 * so far (it only changes on arrival).
 */
export function dashboardAt(day: JourneyDay | undefined, position: JourneyPosition): Dashboard | null {
  if (!day || !position.started) return null;
  const stops = position.finished ? day.stops : day.stops.slice(0, position.stop + 1);
  const legsDone = position.finished ? day.legs : day.legs.slice(0, position.stop);
  const current = position.finished ? undefined : day.legs.at(position.stop);
  const km = legsDone.reduce((sum, leg) => sum + leg.km, 0) + (current ? current.km * position.legT : 0);
  const gasto = stops.reduce((sum, stop) => sum + stop.gasto, 0);

  const here = day.stops.at(position.finished ? day.stops.length - 1 : position.stop);
  const next = day.stops.at(position.stop + 1);
  let time = new Date(here?.time ?? day.firstAt);
  if (!position.finished && position.legT > 0 && here && next) {
    const from = Date.parse(here.leaves);
    const to = Date.parse(next.time);
    time = new Date(from + Math.max(0, to - from) * position.legT);
  }
  return { time, km, gasto, ambient: ambientAt(time) };
}

/** Halfway point of a leg (by distance), where its transport icon sits on the map. */
export function legMidpoint(leg: JourneyLeg): LatLng | null {
  if (!leg.points || leg.points.length < 2) return null;
  return lineUpTo(leg.points, 0.5).at(-1) ?? null;
}

/** Legs still ahead (not travelled, not the one in progress): they show their transport icon. */
export function pendingLegs(day: JourneyDay, position: JourneyPosition): number[] {
  if (position.finished) return [];
  return day.legs.flatMap((leg, i) => (leg.transporte && (!position.started || i > position.stop) ? [i] : []));
}

// ── Camera ───────────────────────────────────────────────────────────────────

type Bounds = [number, number, number, number];

function boundsOf(points: LatLng[]): Bounds | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/**
 * What the camera frames for a position. Days with a flight are split into places (before and
 * after each flight): the camera frames the place the group is in, pulls out to both ends while
 * flying, and zooms back in on landing. `key` changes only when the framing must change.
 */
export function cameraFor(day: JourneyDay | undefined, position: JourneyPosition, routesOnly: boolean): { key: string; bounds: Bounds | null } {
  if (!day) return { key: "none", bounds: null };
  const leg = day.legs.at(position.stop);
  if (!position.finished && position.legT > 0 && leg?.long && leg.points) {
    return { key: `${day.key}|fly|${position.stop}`, bounds: boundsOf(leg.points) };
  }
  if (position.finished || routesOnly || !day.legs.some((l) => l.long)) {
    return { key: `${day.key}|all|${routesOnly}`, bounds: dayBounds(day, routesOnly) };
  }
  // Place index of each stop: it goes up after every flight.
  let place = 0;
  const placeOf = day.stops.map((_, i) => {
    if (i > 0 && day.legs.at(i - 1)?.long) place++;
    return place;
  });
  const here = placeOf.at(position.stop) ?? 0;
  const points = [
    ...day.stops.flatMap((s, i) => (placeOf.at(i) === here && s.at ? [s.at] : [])),
    ...day.legs.flatMap((l, i) => (!l.long && placeOf.at(i) === here ? l.points ?? [] : [])),
  ];
  return { key: `${day.key}|place|${here}`, bounds: boundsOf(points) };
}
