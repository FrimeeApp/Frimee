// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" in local time */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Numeric input helpers ─────────────────────────────────────────────────────

/** Truncates a numeric string to at most `decimals` decimal places */
export function limitDecimals(value: string, decimals = 2): string {
  const dot = value.indexOf(".");
  if (dot === -1) return value;
  return value.slice(0, dot + 1 + decimals);
}

/** Clamps a number within optional min/max bounds */
export function clampNumber(value: number, min?: number, max?: number): number {
  if (typeof min === "number" && value < min) return min;
  if (typeof max === "number" && value > max) return max;
  return value;
}

/**
 * Adds `delta` to the numeric string `current`, clamps within bounds,
 * and returns the result as a string (fixed decimals when `decimals > 0`).
 */
export function adjustNumericString(
  current: string,
  delta: number,
  { min, max, decimals = 0 }: { min?: number; max?: number; decimals?: number } = {},
): string {
  const base = Number.parseFloat(current || "0");
  const next = clampNumber((Number.isFinite(base) ? base : 0) + delta, min, max);
  return decimals > 0 ? next.toFixed(decimals) : String(next);
}
