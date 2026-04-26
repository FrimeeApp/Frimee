import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import type { GastoRow } from "@/services/api/endpoints/gastos.endpoint";

export function isoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function groupByDay(subplanes: SubplanRow[]): [string, SubplanRow[]][] {
  const map = new Map<string, SubplanRow[]>();
  for (const s of subplanes) {
    const key = isoDateOnly(s.inicio_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function normalizeDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return isoDateOnly(new Date(value).toISOString());
}

export function summarizeRecipients(
  parts: GastoRow["partes"],
  excludeUserId?: string | null,
): string {
  const filtered = (parts ?? []).filter((part) => part.user_id !== excludeUserId);
  if (!filtered.length) return "Sin reparto";
  if (filtered.length === 1) return filtered[0].nombre ?? "1 persona";
  if (filtered.length === 2) {
    return `${filtered[0].nombre ?? "Persona"} y ${filtered[1].nombre ?? "persona"}`;
  }
  return `${filtered[0].nombre ?? "Persona"} y ${filtered.length - 1} más`;
}

export type Interval = { from: number; to: number };

export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.from - b.from);
  const merged: Interval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]!;
    if (sorted[i]!.from < last.to) last.to = Math.max(last.to, sorted[i]!.to);
    else merged.push({ ...sorted[i]! });
  }
  return merged;
}

export function getOccupiedIntervals(subplanes: SubplanRow[], fecha: string): Interval[] {
  const toLocalHHMM = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const toLocalDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const daySubplanes = subplanes
    .filter((s) => toLocalDate(s.inicio_at) === fecha)
    .sort((a, b) => new Date(a.inicio_at).getTime() - new Date(b.inicio_at).getTime());

  const intervals: Interval[] = daySubplanes.map((s) => ({
    from: timeToMin(toLocalHHMM(s.inicio_at)),
    to: timeToMin(toLocalHHMM(s.fin_at)),
  }));

  return mergeIntervals(intervals);
}
