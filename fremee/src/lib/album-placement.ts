// Where each photo of the album goes: an activity, a leg between two activities, or «Sin clasificar».
// Pure and cheap (a few thousand comparisons), so the app runs it every time the tab opens and the
// photos follow the itinerary when it changes. Only what someone moved by hand is stored.
//
// Order of the rules (agreed with the design, board «decisiones»):
//   1. A timed activity that contains the moment. If several overlap, the one that started last.
//   2. A leg («Viaje»): the gap between two timed activities of the SAME day. Leaving a day's last
//      activity until the next day's first one is not a leg (that is the night).
//   3. A stay or long activity (hotel, car rental…) that covers the moment: the nights.
//   4. An all-day activity of that day (activities without a time count as all-day), but only if
//      there is exactly one: with several there is no way to choose.
//   5. «Sin clasificar», with the reason.

/** What the placement needs from an activity. */
export type PlacementActivity = {
  id: number;
  tipo: string;
  inicio_at: string;
  fin_at: string;
  all_day: boolean;
};

/** What the placement needs from a photo. */
export type PlacementPhoto = {
  id: number;
  tomada_at: string | null;
  tomada_fuente: string | null;
  colocacion: "actividad" | "viaje" | "sin_clasificar" | null;
  subplan_id: number | null;
};

export type SinClasificarMotivo = "sin_hora" | "antes" | "despues" | "otro";

export type Destino =
  | { kind: "actividad"; subplanId: number }
  /** The leg that arrives at this activity. */
  | { kind: "viaje"; hastaSubplanId: number }
  | { kind: "sin_clasificar"; motivo: SinClasificarMotivo };

export type Colocacion = {
  /** Where it is shown now (the manual one if there is a valid one, else `auto`). */
  destino: Destino;
  /** Where its time puts it. */
  auto: Destino;
  /** Someone moved it by hand. */
  manual: boolean;
  /** The time comes from the file name or the file date, so it may be wrong. */
  aprox: boolean;
  /** Moved by hand to somewhere its time does not point to. */
  noCoincide: boolean;
};

/** Same list as the itinerary: these types are stays. */
const LODGING_TYPES = new Set(["HOTEL", "ALOJAMIENTO"]);
const APROX_FUENTES = new Set(["nombre", "archivo"]);

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

type Timed = { id: number; start: number; end: number };
type Long = { id: number; start: number; end: number };
type AllDay = { id: number; firstDay: number; lastDay: number };

export type PlacementIndex = {
  timed: Timed[]; // by start
  long: Long[];
  allDay: AllDay[];
  /** Start of the first activity and end of the last one, of the whole plan. */
  first: number;
  last: number;
  /** Ids of the activities, to ignore a manual placement whose activity is gone. */
  ids: Set<number>;
  /** The plan has no activities at all. */
  none: boolean;
};

/** Sorts the activities into timed, long (stays and the like) and all-day. */
export function buildPlacementIndex(activities: PlacementActivity[]): PlacementIndex {
  const timed: Timed[] = [];
  const long: Long[] = [];
  const allDay: AllDay[] = [];
  let first = Infinity;
  let last = -Infinity;
  for (const a of activities) {
    const start = Date.parse(a.inicio_at);
    let end = Date.parse(a.fin_at);
    if (!Number.isFinite(start)) continue;
    if (!Number.isFinite(end) || end < start) end = start;
    if (a.all_day) {
      // An all-day end at 00:00 sharp belongs to the day before.
      const endDay = end > start && end === startOfDay(end) ? end - 1 : end;
      allDay.push({ id: a.id, firstDay: startOfDay(start), lastDay: startOfDay(endDay) });
      first = Math.min(first, startOfDay(start));
      last = Math.max(last, startOfDay(endDay) + 86_400_000 - 1);
      continue;
    }
    first = Math.min(first, start);
    last = Math.max(last, end);
    const days = Math.round((startOfDay(end) - startOfDay(start)) / 86_400_000);
    const lodging = LODGING_TYPES.has(a.tipo);
    // A dinner from 21:00 to 02:00 is not long: apart from stays, it needs 12 h or more.
    const isLong = days >= 1 && (lodging || (end - start) / 3_600_000 >= 12);
    if (isLong) long.push({ id: a.id, start, end });
    else timed.push({ id: a.id, start, end });
  }
  timed.sort((x, y) => x.start - y.start || x.id - y.id);
  return { timed, long, allDay, first, last, ids: new Set(activities.map((a) => a.id)), none: activities.length === 0 };
}

/** Where its time puts a moment (ms). Without a moment: «sin hora». */
export function destinoPorHora(index: PlacementIndex, at: number | null): Destino {
  if (at === null || !Number.isFinite(at)) return { kind: "sin_clasificar", motivo: "sin_hora" };

  // 1. Inside a timed activity; the one that started last.
  let dentro: Timed | null = null;
  for (const t of index.timed) {
    if (t.start > at) break;
    if (at <= t.end && (!dentro || t.start >= dentro.start)) dentro = t;
  }
  if (dentro) return { kind: "actividad", subplanId: dentro.id };

  // A stay or long activity that covers it; the one that started last.
  let cubre: Long | null = null;
  for (const l of index.long) {
    if (l.start <= at && at <= l.end && (!cubre || l.start >= cubre.start)) cubre = l;
  }

  // 2. A leg: between the latest end of the timed activities so far and the next start (a stay's
  //    check-in counts as a start), on the same day. Not when a stay began after that end: from its
  //    check-in the photo is the stay's (a stay never starts a leg).
  let prevEnd = -Infinity;
  for (const t of index.timed) if (t.start <= at) prevEnd = Math.max(prevEnd, t.end);
  let next: { id: number; start: number } | null = null;
  for (const c of [...index.timed, ...index.long]) {
    if (c.start > at && (!next || c.start < next.start)) next = c;
  }
  const estanciaDespues = cubre !== null && cubre.start > prevEnd;
  if (next && Number.isFinite(prevEnd) && !estanciaDespues && dayKey(prevEnd) === dayKey(next.start) && dayKey(at) === dayKey(next.start)) {
    return { kind: "viaje", hastaSubplanId: next.id };
  }

  // 3. The stay or long activity that covers it: the nights.
  if (cubre) return { kind: "actividad", subplanId: cubre.id };

  // 4. An all-day activity of that day, if there is just one.
  const day = startOfDay(at);
  const delDia = index.allDay.filter((a) => a.firstDay <= day && day <= a.lastDay);
  if (delDia.length === 1) return { kind: "actividad", subplanId: delDia[0].id };

  // 5. Nowhere.
  if (index.none) return { kind: "sin_clasificar", motivo: "otro" };
  if (at < index.first) return { kind: "sin_clasificar", motivo: "antes" };
  if (at > index.last) return { kind: "sin_clasificar", motivo: "despues" };
  return { kind: "sin_clasificar", motivo: "otro" };
}

function mismoDestino(a: Destino, b: Destino): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "actividad" && b.kind === "actividad") return a.subplanId === b.subplanId;
  if (a.kind === "viaje" && b.kind === "viaje") return a.hastaSubplanId === b.hastaSubplanId;
  return true; // two «sin clasificar», whatever the reason
}

/** A manual placement counts only while its activity still exists; otherwise the photo goes by its time. */
function destinoManual(index: PlacementIndex, p: PlacementPhoto): Destino | null {
  if (p.colocacion === "sin_clasificar") return { kind: "sin_clasificar", motivo: "otro" };
  if (p.subplan_id === null || !index.ids.has(p.subplan_id)) return null;
  if (p.colocacion === "actividad") return { kind: "actividad", subplanId: p.subplan_id };
  if (p.colocacion === "viaje") return { kind: "viaje", hastaSubplanId: p.subplan_id };
  return null;
}

export function colocarFoto(index: PlacementIndex, photo: PlacementPhoto): Colocacion {
  const at = photo.tomada_at ? Date.parse(photo.tomada_at) : null;
  const auto = destinoPorHora(index, at);
  const aprox = at !== null && photo.tomada_fuente !== null && APROX_FUENTES.has(photo.tomada_fuente);
  const manual = destinoManual(index, photo);
  if (!manual) return { destino: auto, auto, manual: false, aprox, noCoincide: false };
  return { destino: manual, auto, manual: true, aprox, noCoincide: !mismoDestino(manual, auto) };
}

/** Every photo placed, by id. */
export function colocarFotos(activities: PlacementActivity[], photos: PlacementPhoto[]): Map<number, Colocacion> {
  const index = buildPlacementIndex(activities);
  const out = new Map<number, Colocacion>();
  for (const p of photos) out.set(p.id, colocarFoto(index, p));
  return out;
}
