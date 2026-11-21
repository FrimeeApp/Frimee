import type { JourneyLeg, JourneyStop } from "@/lib/album-journey";

// How long a leg takes to play once it is on screen: longer trips take longer, on a log scale
// so it never drags (5 min ≈ 2.1 s, 1 h ≈ 3.6 s, 8 h ≈ 4.9 s, at most 5.5 s). Flights get at
// least enough for the camera to pull back and return. Same leg, same time, every time.
const PLAY_MIN_MS = 1500;
const PLAY_MAX_MS = 5500;
const FLIGHT_MIN_MS = 3400;
// Photos taken on the way show up in the leg card one by one: each one adds time so it can be seen
// (up to LEG_PHOTOS_SHOWN of them; the rest hide behind «+N»), within a hard ceiling.
export const LEG_PHOTOS_SHOWN = 3;
const PHOTO_MS = 1200;
const PLAY_MAX_WITH_PHOTOS_MS = 9000;
export function legPlayMs(leg: JourneyLeg | undefined, from: JourneyStop | undefined, to: JourneyStop | undefined) {
  const minutes = parseMinutes(leg?.duracion)
    || (from && to ? Math.max(0, Math.round((Date.parse(to.time) - Date.parse(from.leaves)) / 60000)) : 0);
  const ms = Math.min(PLAY_MAX_MS, Math.max(PLAY_MIN_MS, 900 + 1500 * Math.log10(1 + minutes)));
  const base = leg?.long ? Math.max(FLIGHT_MIN_MS, ms) : ms;
  const photos = Math.min(leg?.fotos.length ?? 0, LEG_PHOTOS_SHOWN);
  return photos > 0 ? Math.min(PLAY_MAX_WITH_PHOTOS_MS, base + photos * PHOTO_MS) : base;
}

/** "24 min" / "1 h 46 min" → minutes (0 when unknown). */
export function parseMinutes(value: string | null | undefined) {
  if (!value) return 0;
  const hours = Number(/(\d+)\s*h/.exec(value)?.[1] ?? 0);
  const minutes = Number(/(\d+)\s*min/.exec(value)?.[1] ?? 0);
  return hours * 60 + minutes;
}
