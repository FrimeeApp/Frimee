import exifr from "exifr";

/** Where the time of a photo came from, best first. The album uses it to decide how much to trust it. */
export type FuenteHora = "exif" | "gps" | "xmp" | "nombre" | "archivo";

export type HoraFoto = { at: string; fuente: FuenteHora };

type Datos = Record<string, unknown>;

type Candidatos = {
  /** EXIF + GPS tags (xmp off, so the same tag name never mixes sources). */
  exif?: Datos | null;
  /** XMP tags only. */
  xmp?: Datos | null;
  nombre: string;
  lastModified: number;
};

const MIN_MS = Date.UTC(2000, 0, 1);
const MARGEN_FUTURO_MS = 5 * 60_000;

const esOffset = (v: unknown): v is string => typeof v === "string" && /^[+-]\d{2}:\d{2}$/.test(v);

/** Local wall-clock parts → ms, in the zone of this device (no zone info available). */
function localMs(y: number, mo: number, d: number, h: number, mi: number, s: number): number {
  const date = new Date(y, mo - 1, d, h, mi, s);
  // new Date() rolls impossible values over (month 13 → next year): reject those.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return NaN;
  return date.getTime();
}

/** EXIF "2026:11:08 17:42:10" (+ optional "+01:00") → ms, or NaN. */
function exifMs(raw: unknown, offset?: unknown): number {
  if (typeof raw !== "string") return NaN;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return NaN;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  if (y === 0) return NaN;
  if (esOffset(offset)) return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset}`);
  return localMs(y, mo, d, h, mi, s);
}

/** XMP ISO date, with or without zone → ms, or NaN. */
function xmpMs(raw: unknown): number {
  if (typeof raw !== "string") return NaN;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!m) return NaN;
  if (m[7]) return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7]}`);
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  return localMs(y, mo, d, h, mi, s);
}

/** GPS date + time are UTC: the only source that is exact without guessing a zone. */
function gpsMs(data: Datos | null | undefined): number {
  const date = data?.GPSDateStamp;
  const time = data?.GPSTimeStamp;
  if (typeof date !== "string" || !Array.isArray(time) || time.length < 3) return NaN;
  const m = date.match(/^(\d{4}):(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  const [h, mi, s] = time.map(Number);
  if (![h, mi, s].every(Number.isFinite)) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, mi, Math.floor(s));
}

/**
 * Time inside a file name: IMG_20261014_183122.jpg, Screenshot_20261014-183122.png, VID_…, 20261014_183122.jpg.
 * Pixel names (PXL_…, with milliseconds) are in UTC; the rest are local. WhatsApp's IMG-20261014-WA0001 has no time: ignored.
 */
function nombreMs(nombre: string): number {
  const m = nombre.match(/(?<!\d)(20\d{2})(\d{2})(\d{2})[_\-T ]?(\d{2})(\d{2})(\d{2})(?:\d{3})?(?!\d)/);
  if (!m) return NaN;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  if (h > 23 || mi > 59 || s > 59) return NaN;
  if (/^PXL_/i.test(nombre)) return Date.UTC(y, mo - 1, d, h, mi, s);
  return localMs(y, mo, d, h, mi, s);
}

/**
 * Picks the best time among everything a file offers. Order (a source that gives an impossible
 * value, such as the future, 1970 or 0000:00:00, is skipped):
 *  1. EXIF capture time with its zone offset
 *  2. GPS time (UTC)
 *  3. EXIF capture time without zone (read in this device's zone)
 *  4. XMP
 *  5. Date written in the file name
 *  6. The file's modified date (Android keeps the capture time there; WhatsApp resets it to the day received)
 * Whether the time fits the trip is decided later, when photos are placed in the itinerary.
 */
export function resolverHora(c: Candidatos, ahora: number = Date.now()): HoraFoto | null {
  const ok = (ms: number) => Number.isFinite(ms) && ms >= MIN_MS && ms <= ahora + MARGEN_FUTURO_MS;
  const res = (ms: number, fuente: FuenteHora): HoraFoto => ({ at: new Date(ms).toISOString(), fuente });

  const exif = c.exif ?? null;
  const original = exif?.DateTimeOriginal ?? null;
  const campoExif = original ?? exif?.CreateDate ?? null;
  const offset = original ? (exif?.OffsetTimeOriginal ?? exif?.OffsetTime) : (exif?.OffsetTimeDigitized ?? exif?.OffsetTime);
  const exifConZona = esOffset(offset) ? exifMs(campoExif, offset) : NaN;
  if (ok(exifConZona)) return res(exifConZona, "exif");

  const gps = gpsMs(exif);
  if (ok(gps)) return res(gps, "gps");

  const exifLocal = exifMs(campoExif);
  if (ok(exifLocal)) return res(exifLocal, "exif");

  for (const key of ["DateTimeOriginal", "DateCreated", "CreateDate"]) {
    const ms = xmpMs(c.xmp?.[key]);
    if (ok(ms)) return res(ms, "xmp");
  }

  const nombre = nombreMs(c.nombre);
  if (ok(nombre)) return res(nombre, "nombre");

  if (ok(c.lastModified)) return res(c.lastModified, "archivo");
  return null;
}

/** Reads the metadata of a file's first bytes and resolves its time. Pure over bytes: easy to test. */
export async function leerHoraDeBytes(bytes: Uint8Array, nombre: string, lastModified: number): Promise<HoraFoto | null> {
  let exif: Datos | null = null;
  let xmp: Datos | null = null;
  try {
    exif = (await exifr.parse(bytes, {
      xmp: false,
      pick: ["DateTimeOriginal", "CreateDate", "OffsetTimeOriginal", "OffsetTimeDigitized", "OffsetTime", "GPSDateStamp", "GPSTimeStamp"],
      reviveValues: false,
    })) as Datos | null;
  } catch {
    // no EXIF: the other sources can still answer
  }
  try {
    xmp = (await exifr.parse(bytes, { xmp: true, tiff: false, exif: false, gps: false, interop: false, ifd1: false })) as Datos | null;
  } catch {
    // no XMP
  }
  return resolverHora({ exif, xmp, nombre, lastModified });
}

/**
 * Moment a photo was taken. Must run on the ORIGINAL file: the upload converts to WebP and that
 * drops the metadata. Metadata (EXIF, GPS, XMP) lives in the first bytes, so only those are read.
 */
export async function leerHoraFoto(file: File): Promise<HoraFoto | null> {
  const bytes = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer());
  return leerHoraDeBytes(bytes, file.name, file.lastModified);
}
