import type { PasaporteLeido } from "@/lib/passport";

/**
 * Lo que el perfil ya leyó del pasaporte, para que la libreta se abra con datos al instante (sin esperar a la red)
 * y la tapa pueda viajar hasta su sitio. Solo vive en memoria y caduca enseguida; la libreta vuelve a leer igualmente.
 */
type Entry = { nombre: string; pasaporte: PasaporteLeido; at: number };

const MAX_AGE_MS = 60_000;
let entry: Entry | null = null;

export function setPassportCache(nombre: string, pasaporte: PasaporteLeido) {
  entry = { nombre, pasaporte, at: Date.now() };
}

export function readPassportCache(): { nombre: string; pasaporte: PasaporteLeido } | null {
  if (!entry || Date.now() - entry.at > MAX_AGE_MS) return null;
  return { nombre: entry.nombre, pasaporte: entry.pasaporte };
}
