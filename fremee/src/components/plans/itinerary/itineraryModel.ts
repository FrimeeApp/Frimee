import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";

/**
 * Itinerary rules from the it-* boards (it-sistema): which days show, which fold, and how an
 * activity that lasts several days (hotel, rental car) reads on each of them. Pure: no React.
 */

const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** Plans up to this many days list every day, even empty ones. */
export const SHORT_PLAN_MAX_DAYS = 4;

export const LODGING_TYPES = new Set(["HOTEL", "ALOJAMIENTO"]);

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** «2026-11-21», local. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function localDayKey(iso: string): string {
  return dayKey(new Date(iso));
}

function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function diffDays(fromKey: string, toKey: string): number {
  return Math.round((keyToDate(toKey).getTime() - keyToDate(fromKey).getTime()) / 86_400_000);
}

const cap = (s: string) => s.charAt(0).toLocaleUpperCase("es-ES") + s.slice(1);

/** «Sáb 21 nov» */
export function dayLabel(key: string): string {
  const d = keyToDate(key);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** «Lun 23 – mar 24 nov», «Lun 30 nov – mar 1 dic», or one day «Mar 24 nov». */
export function dayRangeLabel(fromKey: string, toKey: string): string {
  if (fromKey === toKey) return dayLabel(fromKey);
  const a = keyToDate(fromKey);
  const b = keyToDate(toKey);
  const right = `${WEEKDAYS_SHORT[b.getDay()].toLocaleLowerCase("es-ES")} ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
  const left = a.getMonth() === b.getMonth()
    ? `${WEEKDAYS_SHORT[a.getDay()]} ${a.getDate()}`
    : `${WEEKDAYS_SHORT[a.getDay()]} ${a.getDate()} ${MONTHS_SHORT[a.getMonth()]}`;
  return `${cap(left)} – ${right}`;
}

/** «Sáb 21, 15:00» */
export function dayTimeLabel(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}, ${hhmm(iso)}`;
}

export function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ── Activities that last several days ────────────────────────────────────────────────────

export type Span = {
  row: SubplanRow;
  startKey: string;
  endKey: string;
  lodging: boolean;
  /** Nights for lodging, days for the rest. */
  units: number;
};

/**
 * A stay or rental that ends on a later day. A dinner from 21:00 to 02:00 is not one: anything
 * that is not lodging needs to last 12 h or more.
 */
export function spanOf(row: SubplanRow): Span | null {
  const startKey = localDayKey(row.inicio_at);
  const endKey = localDayKey(row.fin_at);
  const days = diffDays(startKey, endKey);
  if (days < 1) return null;
  const lodging = LODGING_TYPES.has(row.tipo);
  if (!lodging) {
    const hours = (new Date(row.fin_at).getTime() - new Date(row.inicio_at).getTime()) / 3_600_000;
    if (hours < 12) return null;
  }
  return { row, startKey, endKey, lodging, units: lodging ? days : days + 1 };
}

/** «4 noches», «3 días» */
export function spanPill(span: Span): string {
  return span.lodging ? plural(span.units, "noche", "noches") : plural(span.units, "día", "días");
}

/** «Sáb 21, 15:00 → mié 25, 11:00»; all day: «Sáb 21 → mié 25». */
export function spanRangeText(span: Span): string {
  const { row } = span;
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const day = `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`;
    return row.all_day ? day : `${day}, ${hhmm(iso)}`;
  };
  return `${fmt(row.inicio_at)} → ${fmt(row.fin_at).toLocaleLowerCase("es-ES")}`;
}

export type Band = {
  span: Span;
  /** «mid»: a day in between. «end»: the day it finishes. */
  kind: "mid" | "end";
  /** 2 for the second night/day. */
  index: number;
};

export function bandText(band: Band): { lead: string; tail: string } {
  const { span } = band;
  if (band.kind === "end") {
    return {
      lead: span.row.all_day ? `Último día · ${span.row.titulo}` : `Hasta las ${hhmm(span.row.fin_at)} · ${span.row.titulo}`,
      tail: span.lodging ? "salida" : "fin",
    };
  }
  return {
    lead: `Sigue · ${span.row.titulo}`,
    tail: span.lodging ? `noche ${band.index} de ${span.units}` : `día ${band.index} de ${span.units}`,
  };
}

// ── Days ─────────────────────────────────────────────────────────────────────────────────

export type ItineraryDay = {
  key: string;
  /** 1 for the first day of the plan. */
  number: number;
  /** What starts that day, by start time. */
  starts: SubplanRow[];
  bands: Band[];
  past: boolean;
  today: boolean;
};

export type DayEntry = { kind: "day"; day: ItineraryDay };
/** Quiet days between others: nothing starts or ends («3 días libres» or «Hotel Alfama · sin más actividades»). */
export type FoldEntry = { kind: "fold"; id: string; days: ItineraryDay[]; covering: string[] };
/** Two or more days already lived, during the trip. */
export type PastEntry = { kind: "past"; id: string; days: ItineraryDay[] };
export type Entry = DayEntry | FoldEntry | PastEntry;

export type ItineraryModel = {
  keys: string[];
  days: Map<string, ItineraryDay>;
  short: boolean;
  /** Long plan with no activities: the «14 días por llenar» state. */
  emptyLong: boolean;
  during: boolean;
  todayKey: string;
  entries: Entry[];
  /** The day that opens first: today during the trip, else the first one with something. */
  defaultOpen: string | null;
  spans: Map<number, Span>;
};

export function planDayKeys(planStartIso: string, planEndIso: string, rows: SubplanRow[]): string[] {
  let from = localDayKey(planStartIso);
  let to = localDayKey(planEndIso);
  if (to < from) to = from;
  for (const r of rows) {
    const s = localDayKey(r.inicio_at);
    const e = spanOf(r) ? localDayKey(r.fin_at) : s;
    if (s < from) from = s;
    if (e > to) to = e;
  }
  const keys: string[] = [];
  for (let d = keyToDate(from); dayKey(d) <= to; d = addDays(d, 1)) keys.push(dayKey(d));
  return keys;
}

export function buildItinerary(opts: {
  planStartIso: string;
  planEndIso: string;
  rows: SubplanRow[];
  finished: boolean;
  now?: Date;
}): ItineraryModel {
  const { rows, finished } = opts;
  const now = opts.now ?? new Date();
  const todayKey = dayKey(now);
  const keys = planDayKeys(opts.planStartIso, opts.planEndIso, rows);
  const during = !finished && keys.length > 0 && keys[0] <= todayKey && todayKey <= keys[keys.length - 1];

  const spans = new Map<number, Span>();
  for (const r of rows) {
    const sp = spanOf(r);
    if (sp) spans.set(r.id, sp);
  }

  const days = new Map<string, ItineraryDay>();
  keys.forEach((key, i) => {
    days.set(key, { key, number: i + 1, starts: [], bands: [], past: during && key < todayKey, today: during && key === todayKey });
  });
  const sorted = [...rows].sort((a, b) => a.inicio_at.localeCompare(b.inicio_at) || a.orden - b.orden);
  for (const r of sorted) days.get(localDayKey(r.inicio_at))?.starts.push(r);
  for (const sp of spans.values()) {
    for (let d = addDays(keyToDate(sp.startKey), 1); dayKey(d) <= sp.endKey; d = addDays(d, 1)) {
      const k = dayKey(d);
      days.get(k)?.bands.push({ span: sp, kind: k === sp.endKey ? "end" : "mid", index: diffDays(sp.startKey, k) + 1 });
    }
  }

  const short = keys.length <= SHORT_PLAN_MAX_DAYS;
  const emptyLong = !short && rows.length === 0;
  const isActive = (d: ItineraryDay) => d.starts.length > 0 || d.bands.some((b) => b.kind === "end");

  const entries: Entry[] = [];
  let rest = keys;
  if (during) {
    const pastKeys = keys.filter((k) => k < todayKey);
    if (pastKeys.length >= 2) entries.push({ kind: "past", id: `past:${pastKeys[0]}`, days: pastKeys.map((k) => days.get(k)!) });
    else pastKeys.forEach((k) => entries.push({ kind: "day", day: days.get(k)! }));
    rest = keys.filter((k) => k >= todayKey);
  }

  if (!emptyLong) {
    let run: ItineraryDay[] = [];
    let runSig = "";
    const flush = () => {
      if (!run.length) return;
      const covering = run[0].bands.map((b) => b.span.row.titulo);
      entries.push({ kind: "fold", id: `fold:${run[0].key}`, days: run, covering });
      run = [];
    };
    for (const k of rest) {
      const d = days.get(k)!;
      if (short || d.today || isActive(d)) {
        flush();
        entries.push({ kind: "day", day: d });
        continue;
      }
      const sig = d.bands.map((b) => b.span.row.id).sort().join(",");
      if (run.length && sig !== runSig) flush();
      runSig = sig;
      run.push(d);
    }
    flush();
  }

  let defaultOpen: string | null = null;
  if (during) defaultOpen = todayKey;
  else if (!finished) defaultOpen = keys.find((k) => isActive(days.get(k)!)) ?? null;

  return { keys, days, short, emptyLong, during, todayKey, entries, defaultOpen, spans };
}

// ── Texts ────────────────────────────────────────────────────────────────────────────────

/** «2 actividades · 1 que sigue», «1 actividad · termina el hotel», «Sin actividades». */
export function dayCountText(day: ItineraryDay): string {
  const parts: string[] = [];
  parts.push(day.starts.length ? plural(day.starts.length, "actividad", "actividades") : "Sin actividades");
  const mids = day.bands.filter((b) => b.kind === "mid").length;
  if (mids) parts.push(`${mids} que ${mids === 1 ? "sigue" : "siguen"}`);
  for (const b of day.bands.filter((x) => x.kind === "end")) {
    parts.push(b.span.lodging ? "termina el hotel" : `termina ${b.span.row.titulo}`);
  }
  return parts.join(" · ");
}

export function foldText(entry: FoldEntry): { title: string; detail: string } {
  const first = entry.days[0].key;
  const last = entry.days[entry.days.length - 1].key;
  const title = dayRangeLabel(first, last);
  const detail = entry.covering.length
    ? `${entry.covering.join(", ")} · sin más actividades`
    : plural(entry.days.length, "día libre", "días libres");
  return { title, detail };
}

export function pastText(entry: PastEntry): { title: string; detail: string } {
  const first = entry.days[0];
  const last = entry.days[entry.days.length - 1];
  const count = entry.days.reduce((n, d) => n + d.starts.length, 0);
  return {
    title: dayRangeLabel(first.key, last.key),
    detail: `Días ${first.number} – ${last.number} · ${plural(count, "actividad", "actividades")}`,
  };
}

/** «día 3 de 5» during the trip, «5 días» otherwise. */
export function tripProgressText(model: ItineraryModel): string {
  const total = model.keys.length;
  if (model.during) return `día ${model.days.get(model.todayKey)?.number ?? 1} de ${total}`;
  return plural(total, "día", "días");
}

/** Today's activity states for the «Hecho» / «Empieza en 10 min» marks. */
export function activityDone(row: SubplanRow, now: Date): boolean {
  return new Date(row.fin_at).getTime() <= now.getTime();
}

export function startsInMinutes(row: SubplanRow, now: Date): number | null {
  const mins = Math.ceil((new Date(row.inicio_at).getTime() - now.getTime()) / 60_000);
  return mins > 0 && mins <= 60 ? mins : null;
}
