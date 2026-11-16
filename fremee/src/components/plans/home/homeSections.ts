import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";

/**
 * What the «Mis planes» home shows and in which order (board s-componentes · «Qué enseña la pantalla»).
 * Pure: mobile and desktop paint the same sections from here.
 */

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days from a to b (local time), DST-safe. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** «12–16 nov», «30 dic – 2 ene», «28 nov» (one day), adds the year when it is not the current one. */
export function formatPlanRange(startsAt: string, endsAt: string, now = new Date()): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const yearSuffix = (d: Date) => (d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : "");
  if (daysBetween(s, e) <= 0) return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]}${yearSuffix(s)}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[s.getMonth()]}${yearSuffix(s)}`;
  }
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]}${sameYear ? "" : yearSuffix(s)} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}${yearSuffix(e)}`;
}

export function todayLabel(now = new Date()): string {
  return `Hoy · ${WEEKDAYS[now.getDay()]} ${now.getDate()}`;
}

export type PlanTiming =
  | { kind: "ongoing"; day: number; total: number }
  | { kind: "upcoming"; days: number }
  | { kind: "finished" };

export function planTiming(plan: Pick<FeedPlanItemDto, "startsAt" | "endsAt">, now = new Date()): PlanTiming {
  const start = new Date(plan.startsAt);
  const end = new Date(plan.endsAt);
  const toStart = daysBetween(now, start);
  if (toStart > 0) return { kind: "upcoming", days: toStart };
  if (daysBetween(now, end) < 0) return { kind: "finished" };
  return { kind: "ongoing", day: daysBetween(start, now) + 1, total: daysBetween(start, end) + 1 };
}

/** Countdown texts (s-componentes · «Cuenta atrás: textos»). */
export function countdownText(plan: Pick<FeedPlanItemDto, "startsAt" | "endsAt">, now = new Date()): string | null {
  const t = planTiming(plan, now);
  if (t.kind === "finished") return null;
  if (t.kind === "ongoing") {
    if (t.day === 1 && t.total > 1) return "Empieza hoy";
    if (t.day === t.total && t.total > 1) return "Último día";
    if (t.total === 1) return "Hoy";
    return `Día ${t.day} de ${t.total}`;
  }
  if (t.days === 1) return "Mañana";
  if (t.days <= 30) return `Faltan ${t.days} días`;
  if (t.days <= 90) return `En ${Math.floor(t.days / 7)} semanas`;
  const start = new Date(plan.startsAt);
  const month = MONTHS[start.getMonth()];
  return start.getFullYear() === now.getFullYear() ? `En ${month}` : `En ${month} de ${start.getFullYear()}`;
}

export type MonthChapter = {
  key: string;
  title: string;
  hint: string;
  plans: FeedPlanItemDto[];
};

function chapterHint(first: Date, now: Date): string {
  const monthDiff = (first.getFullYear() - now.getFullYear()) * 12 + first.getMonth() - now.getMonth();
  if (monthDiff <= 0) return "este mes";
  const monthStart = new Date(first.getFullYear(), first.getMonth(), 1);
  const days = daysBetween(now, monthStart);
  if (days < 7) return "en unos días";
  if (days < 14) return "en 1 semana";
  if (days <= 31) return `en ${Math.floor(days / 7)} semanas`;
  return monthDiff === 1 ? "en 1 mes" : `en ${monthDiff} meses`;
}

export type HomeSections = {
  /** In progress today. */
  now: FeedPlanItemDto | null;
  /** With nothing in progress: the big «Tu próximo viaje» block. */
  hero: FeedPlanItemDto | null;
  /** With something in progress: the compact «Siguiente» card. */
  next: FeedPlanItemDto | null;
  pinned: FeedPlanItemDto[];
  later: MonthChapter[];
  finished: FeedPlanItemDto[];
  activeCount: number;
};

/** At most this many plans pinned at once (only active plans count). */
export const MAX_PINNED_PLANS = 5;

export function buildHomeSections(plans: FeedPlanItemDto[], pinnedIds: number[], now = new Date()): HomeSections {
  const byStart = (a: FeedPlanItemDto, b: FeedPlanItemDto) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  const active = plans.filter((p) => planTiming(p, now).kind !== "finished").sort(byStart);
  const finished = plans
    .filter((p) => planTiming(p, now).kind === "finished")
    .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime());

  const ongoing = active
    .filter((p) => planTiming(p, now).kind === "ongoing")
    .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
  const nowPlan = ongoing[0] ?? null;

  const rest = active.filter((p) => p.id !== nowPlan?.id);
  const upcoming = rest.filter((p) => planTiming(p, now).kind === "upcoming");
  const first = upcoming[0] ?? null;
  const hero = nowPlan ? null : first;
  const next = nowPlan ? first : null;

  const shown = new Set([nowPlan?.id, hero?.id, next?.id].filter((id): id is number => id != null));
  const activeById = new Map(active.map((p) => [p.id, p]));
  const pinned = pinnedIds
    .map((id) => activeById.get(id))
    .filter((p): p is FeedPlanItemDto => Boolean(p) && !shown.has(p!.id))
    .sort(byStart);
  pinned.forEach((p) => shown.add(p.id));

  const later: MonthChapter[] = [];
  for (const plan of rest) {
    if (shown.has(plan.id)) continue;
    const start = new Date(plan.startsAt);
    const key = `${start.getFullYear()}-${start.getMonth()}`;
    let chapter = later.find((c) => c.key === key);
    if (!chapter) {
      const month = capitalize(MONTHS[start.getMonth()]);
      chapter = {
        key,
        title: start.getFullYear() === now.getFullYear() ? month : `${month} de ${start.getFullYear()}`,
        hint: chapterHint(start, now),
        plans: [],
      };
      later.push(chapter);
    }
    chapter.plans.push(plan);
  }

  return { now: nowPlan, hero, next, pinned, later, finished, activeCount: active.length };
}

/** «Tú, Ana, Marcos y Lucía» — the current user is always «Tú» and goes first. */
export function peopleSentence(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** «en 4 h», «en 25 min», «Ahora» for an activity today. */
export function activityWhen(inicioAt: string, finAt: string, now = new Date()): string | null {
  const s = new Date(inicioAt).getTime();
  const e = new Date(finAt).getTime();
  const t = now.getTime();
  if (t >= s && t <= e) return "Ahora";
  if (s <= t) return null;
  const min = Math.round((s - t) / 60_000);
  if (min < 60) return `en ${min} min`;
  return `en ${Math.round(min / 60)} h`;
}
