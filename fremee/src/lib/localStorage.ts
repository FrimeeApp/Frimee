/** Safe localStorage primitives — all operations are no-ops on SSR and swallow storage errors. */

function isAvailable(): boolean {
  return typeof window !== "undefined";
}

export function lsGet<T>(key: string): T | null {
  if (!isAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function lsSet<T>(key: string, value: T): void {
  if (!isAvailable()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full or private mode */ }
}

export function lsRemove(key: string): void {
  if (!isAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch { /* ignore */ }
}

/** Read a timestamped entry, returning null if expired or missing. */
export function lsGetTimed<T>(key: string, ttlMs: number): T | null {
  const entry = lsGet<{ value: T; savedAt: number }>(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > ttlMs) return null;
  return entry.value;
}

/** Write a value wrapped with a `savedAt` timestamp for TTL checks. */
export function lsSetTimed<T>(key: string, value: T): void {
  lsSet(key, { value, savedAt: Date.now() });
}
