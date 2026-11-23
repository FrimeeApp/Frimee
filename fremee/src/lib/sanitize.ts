const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(CONTROL_CHAR_RE, "").slice(0, maxLength).trim();
  return cleaned || null;
}

export function sanitizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t)) return null;
  return t;
}

// Numeric plan IDs (positive integers as strings)
export function sanitizePlanId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!/^\d{1,20}$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n <= 0) return null;
  return t;
}

export function sanitizeIata(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const u = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(u)) return null;
  return u;
}

export function sanitizeCallsign(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const u = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,8}$/.test(u)) return null;
  return u;
}

export function sanitizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(t)) return null;
  if (isNaN(new Date(t).getTime())) return null;
  return t;
}

// LiveKit room names: alphanumeric, dashes, underscores — max 128 chars
export function sanitizeRoomName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(t)) return null;
  return t;
}

export function sanitizeLatLng(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;
  const lat = typeof obj.lat === "number" ? obj.lat : null;
  const lng = typeof obj.lng === "number" ? obj.lng : null;
  if (lat === null || lng === null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateUploadFile(
  file: File | null,
): { ok: true; file: File } | { ok: false; error: string } {
  if (!file) return { ok: false, error: "Archivo requerido" };
  if (file.size > MAX_UPLOAD_BYTES)
    return { ok: false, error: "El archivo supera el límite de 10 MB" };
  if (!ALLOWED_UPLOAD_TYPES.has(file.type))
    return { ok: false, error: "Tipo de archivo no permitido. Usa JPG, PNG, WebP o PDF" };
  return { ok: true, file };
}

/** Tipo real del archivo según sus primeros bytes (el tipo que declara el navegador no es de fiar). */
export function sniffUploadType(buf: Uint8Array): { mime: string; ext: string } | null {
  const is = (...b: number[]) => b.every((v, i) => buf[i] === v);
  if (is(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (is(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", ext: "png" };
  if (is(0x52, 0x49, 0x46, 0x46) && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { mime: "image/webp", ext: "webp" };
  if (is(0x25, 0x50, 0x44, 0x46)) return { mime: "application/pdf", ext: "pdf" };
  return null;
}
