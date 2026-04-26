// ── Money ─────────────────────────────────────────────────────────────────────

export function formatMoney(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ── Dates ─────────────────────────────────────────────────────────────────────

/** "03 ene" — used in list rows */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

/** "03 enero 2024" — used in expense detail (date only) */
export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** "03 de enero de 2024, 14:30" — used in gasto detail (date + time) */
export function formatLongDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "03 ene · 14:30" — used in expense rows inside a plan */
export function formatExpenseDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(",", " ·");
}

// ── Date ranges & headers ─────────────────────────────────────────────────────

import { ES_MONTHS_SHORT, ES_WEEK_DAYS_SHORT } from "@/lib/date-labels";

/**
 * "15 Ene", "15 – 20 Ene", "15 Ene – 3 Feb"
 * Handles same-day, same-month, and cross-month ranges.
 */
export function formatDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) return `${start.getDate()} ${ES_MONTHS_SHORT[start.getMonth()]}`;
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} – ${end.getDate()} ${ES_MONTHS_SHORT[start.getMonth()]}`;
  }
  return `${start.getDate()} ${ES_MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${ES_MONTHS_SHORT[end.getMonth()]}`;
}

/** "14:30 - 16:00" from two ISO strings */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  return `${fmt(startsAt)} - ${fmt(endsAt)}`;
}

/** "15 de enero de 2024" — full long date heading */
export function formatDayHeading(date: Date): string {
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

/** "14:30" from ISO string */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Lun 15 Ene" — weekday + day + short month */
export function fmtDayHeader(iso: string): string {
  const d = new Date(iso);
  return `${ES_WEEK_DAYS_SHORT[d.getDay()]} ${d.getDate()} ${ES_MONTHS_SHORT[d.getMonth()]}`;
}

// ── Strings ───────────────────────────────────────────────────────────────────

/** First letter uppercase, falls back to "U" */
export function getInitial(value: string | null | undefined): string {
  return (value?.trim()[0] || "U").toUpperCase();
}
