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

/**
 * When a plan happens, as the «Nuevo plan» form holds it: whole days, or with a start time on the
 * first day and an end time on the last one. `endNextDay`: a one-day plan that ends after midnight
 * (the «+1» of the end time, e.g. a party from 23:00 to 01:00).
 */
export type PlanWhen = {
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  endNextDay: boolean;
};

const at = (date: string, time: string, plusDays = 0) => {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, (d ?? 1) + plusDays, h ?? 0, min ?? 0, 0);
};

/** PlanWhen → the instants stored in plan.inicio_at / fin_at. Whole days keep the 10:00 / 18:00 convention. */
export function planWhenToIso(w: PlanWhen): { inicioAt: string; finAt: string } {
  if (w.allDay) return { inicioAt: dateInputToIso(w.startDate, 10), finAt: dateInputToIso(w.endDate, 18) };
  return {
    inicioAt: at(w.startDate, w.startTime).toISOString(),
    finAt: at(w.endDate, w.endTime, w.endNextDay ? 1 : 0).toISOString(),
  };
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** A stored plan → PlanWhen (to edit it). A timed plan ending the next day before its start hour is a «+1». */
export function isoToPlanWhen(inicioAt: string, finAt: string, allDay: boolean): PlanWhen {
  const startDate = isoToDateInput(inicioAt);
  let endDate = isoToDateInput(finAt);
  if (allDay) return { startDate, endDate, allDay, startTime: "", endTime: "", endNextDay: false };
  const startTime = hhmm(new Date(inicioAt));
  const endTime = hhmm(new Date(finAt));
  const dayAfter = isoToDateInput(at(startDate, "12:00", 1).toISOString());
  const endNextDay = endDate === dayAfter && endTime <= startTime;
  if (endNextDay) endDate = startDate;
  return { startDate, endDate, allDay, startTime, endTime, endNextDay };
}
