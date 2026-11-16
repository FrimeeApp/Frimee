import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { capitalize, daysBetween, planTiming, startOfDay } from "../home/homeSections";

/**
 * Pure helpers for the calendar (boards m-cal-* / d-cal-* of «Frimee · Mis planes»).
 * Weeks start on Monday; everything works in local days.
 */

export type CalMode = "ano" | "mes" | "semana" | "dia";

export const MODES: Array<{ value: CalMode; label: string }> = [
  { value: "ano", label: "Año" },
  { value: "mes", label: "Mes" },
  { value: "semana", label: "Semana" },
  { value: "dia", label: "Día" },
];

export function isCalMode(v: string | null): v is CalMode {
  return v === "ano" || v === "mes" || v === "semana" || v === "dia";
}

export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
/** Monday first: [short, long]. */
export const WEEKDAYS: Array<[string, string]> = [
  ["lu", "lunes"], ["ma", "martes"], ["mi", "miércoles"], ["ju", "jueves"], ["vi", "viernes"], ["sá", "sábado"], ["do", "domingo"],
];
const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function weekdayName(d: Date) {
  return WEEKDAY_NAMES[d.getDay()];
}

export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function startOfWeek(d: Date) {
  return addDays(startOfDay(d), -((d.getDay() + 6) % 7));
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** «2026-11-14» (local), for the URL. */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDayKey(s: string | null): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** First and last day (inclusive) that a mode shows around a date. */
export function periodOf(mode: CalMode, d: Date): { from: Date; to: Date } {
  if (mode === "ano") return { from: new Date(d.getFullYear(), 0, 1), to: new Date(d.getFullYear(), 11, 31) };
  if (mode === "mes") return { from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 0) };
  if (mode === "semana") {
    const from = startOfWeek(d);
    return { from, to: addDays(from, 6) };
  }
  return { from: startOfDay(d), to: startOfDay(d) };
}

export function shiftPeriod(mode: CalMode, d: Date, dir: 1 | -1): Date {
  if (mode === "ano") return new Date(d.getFullYear() + dir, d.getMonth(), 1);
  if (mode === "mes") return new Date(d.getFullYear(), d.getMonth() + dir, 1);
  return addDays(d, mode === "semana" ? 7 * dir : dir);
}

/** Heading of the period: «2026», «Noviembre 2026», «9 – 15 nov», «Sábado 14 nov» / «Sábado 14 de noviembre». */
export function periodLabel(mode: CalMode, d: Date, long: boolean, now = new Date()): string {
  const year = (x: Date) => (x.getFullYear() !== now.getFullYear() ? ` ${x.getFullYear()}` : "");
  if (mode === "ano") return String(d.getFullYear());
  if (mode === "mes") return `${capitalize(MONTHS[d.getMonth()])} ${d.getFullYear()}`;
  if (mode === "semana") {
    const { from, to } = periodOf("semana", d);
    if (from.getMonth() === to.getMonth()) return `${from.getDate()} – ${to.getDate()} ${MONTHS_SHORT[to.getMonth()]}${year(to)}`;
    return `${from.getDate()} ${MONTHS_SHORT[from.getMonth()]} – ${to.getDate()} ${MONTHS_SHORT[to.getMonth()]}${year(to)}`;
  }
  const month = long ? `de ${MONTHS[d.getMonth()]}` : MONTHS_SHORT[d.getMonth()];
  return `${capitalize(weekdayName(d))} ${d.getDate()} ${month}${year(d)}`;
}

/** «sábado 14 de noviembre», for screen readers. */
export function dayAria(d: Date) {
  return `${weekdayName(d)} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** Weeks (Monday to Sunday) that cover a month: 4 to 6. */
export function monthWeeks(month: Date): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const out: Date[][] = [];
  for (let start = startOfWeek(first); start <= last; start = addDays(start, 7)) {
    out.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return out;
}

/* ───────────── Plans ───────────── */

export type Kind = "ongoing" | "upcoming" | "finished";

export function kindOf(plan: Pick<FeedPlanItemDto, "startsAt" | "endsAt">, now = new Date()): Kind {
  return planTiming(plan, now).kind;
}

const KIND_ORDER: Record<Kind, number> = { ongoing: 0, upcoming: 1, finished: 2 };

/** In progress first, then upcoming by start, then finished. */
export function byPriority(a: FeedPlanItemDto, b: FeedPlanItemDto) {
  return KIND_ORDER[kindOf(a)] - KIND_ORDER[kindOf(b)] || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

/** For lists: in progress, upcoming by start, finished most recent first. */
export function byListOrder(a: FeedPlanItemDto, b: FeedPlanItemDto) {
  const ka = kindOf(a);
  const kb = kindOf(b);
  if (ka !== kb) return KIND_ORDER[ka] - KIND_ORDER[kb];
  const diff = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  return ka === "finished" ? -diff : diff;
}

export function planStart(p: Pick<FeedPlanItemDto, "startsAt">) {
  return startOfDay(new Date(p.startsAt));
}

export function planEnd(p: Pick<FeedPlanItemDto, "endsAt">) {
  return startOfDay(new Date(p.endsAt));
}

export function covers(p: FeedPlanItemDto, day: Date) {
  return planStart(p) <= day && planEnd(p) >= day;
}

/** Plans with at least one day between from and to (inclusive), by priority. */
export function plansBetween(plans: FeedPlanItemDto[], from: Date, to: Date) {
  return plans.filter((p) => planStart(p) <= to && planEnd(p) >= from).sort(byPriority);
}

/** «Día 3 de 5» of a plan on a given day. */
export function dayOfPlan(p: FeedPlanItemDto, day: Date) {
  return { day: daysBetween(planStart(p), day) + 1, total: daysBetween(planStart(p), planEnd(p)) + 1 };
}

/** Right-hand status of a plan in lists: «En curso», «Mañana», «En 14 días», «12 dic», «Finalizado». */
export function statusText(p: FeedPlanItemDto, now = new Date()): string {
  const t = planTiming(p, now);
  if (t.kind === "ongoing") return "En curso";
  if (t.kind === "finished") return "Finalizado";
  if (t.days === 1) return "Mañana";
  if (t.days <= 30) return `En ${t.days} días`;
  const s = new Date(p.startsAt);
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]}`;
}

export type LaneSegment = { plan: FeedPlanItemDto; from: number; to: number; roundLeft: boolean; roundRight: boolean };

/**
 * One lane per week, only on days of the shown month (mobile month and the home mini-month).
 * Each day shows its first plan by priority; consecutive days of the same plan join into one bar.
 * Days with more than one plan get a dot.
 */
export function weekLane(plans: FeedPlanItemDto[], days: Date[], month: Date) {
  const segments: LaneSegment[] = [];
  const dots: number[] = [];
  let current: LaneSegment | null = null;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const covering = d.getMonth() === month.getMonth() ? plans.filter((p) => covers(p, d)) : [];
    if (covering.length > 1) dots.push(i);
    const top = covering[0];
    if (current && top && current.plan.id === top.id && current.to === i - 1) {
      current.to = i;
      continue;
    }
    if (current) segments.push(current);
    current = top ? { plan: top, from: i, to: i, roundLeft: false, roundRight: false } : null;
  }
  if (current) segments.push(current);
  for (const seg of segments) {
    seg.roundLeft = planStart(seg.plan).getTime() === days[seg.from].getTime();
    seg.roundRight = planEnd(seg.plan).getTime() === days[seg.to].getTime();
  }
  return { segments, dots };
}

export type Bar = { plan: FeedPlanItemDto; from: number; to: number; lane: number; startsHere: boolean; endsHere: boolean };

/**
 * Bars of a week in lanes (desktop month and week): each plan takes the first lane where it fits.
 * Plans that do not fit in maxLanes are counted in hidden.
 */
export function weekBars(plans: FeedPlanItemDto[], days: Date[], maxLanes: number) {
  const first = days[0];
  const last = days[days.length - 1];
  const lanes: Array<Array<[number, number]>> = [];
  const bars: Bar[] = [];
  let hidden = 0;
  for (const plan of plansBetween(plans, first, last)) {
    const s = planStart(plan);
    const e = planEnd(plan);
    const from = s < first ? 0 : daysBetween(first, s);
    const to = e > last ? days.length - 1 : daysBetween(first, e);
    let lane = lanes.findIndex((taken) => taken.every(([a, b]) => to < a || from > b));
    if (lane === -1) {
      if (lanes.length >= maxLanes) {
        hidden++;
        continue;
      }
      lanes.push([]);
      lane = lanes.length - 1;
    }
    lanes[lane].push([from, to]);
    bars.push({ plan, from, to, lane, startsHere: s >= first, endsHere: e <= last });
  }
  return { bars, lanes: lanes.length, hidden };
}

/* ───────────── Activities ───────────── */

export type ActivityState = "done" | "now" | "next";

/** Activities that belong to a day: the ones that start on it, plus all-day ones that cover it. */
export function activitiesOfDay(rows: SubplanRow[], day: Date) {
  return rows
    .filter((r) => {
      const s = startOfDay(new Date(r.inicio_at));
      if (r.all_day) return s <= day && startOfDay(new Date(r.fin_at)) >= day;
      return s.getTime() === day.getTime();
    })
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || new Date(a.inicio_at).getTime() - new Date(b.inicio_at).getTime());
}

export function activityState(r: SubplanRow, day: Date, now = new Date()): ActivityState {
  const today = startOfDay(now);
  if (day < today) return "done";
  if (day > today) return "next";
  if (r.all_day) return "now";
  const s = new Date(r.inicio_at).getTime();
  const e = new Date(r.fin_at).getTime();
  const t = now.getTime();
  if (t > e) return "done";
  return t >= s ? "now" : "next";
}

export function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
