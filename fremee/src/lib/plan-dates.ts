/**
 * Plans are picked by day (no time): the forms store the last day at 18:00 or 23:59.
 * So a plan is still on until its last day is over, whatever hour fin_at carries.
 */
export function planEndsAt(finAt: string): Date {
  const d = new Date(finAt);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

export function isPlanFinished(finAt: string, now: Date = new Date()): boolean {
  return planEndsAt(finAt).getTime() <= now.getTime();
}

/** «2026-11-16» from a date field → that day at `hour` local time, as ISO. */
export function dateInputToIso(dateInput: string, hour = 12): string {
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hour, 0, 0).toISOString();
}

/** ISO instant → «2026-11-16» in local time, for a date field. */
export function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
