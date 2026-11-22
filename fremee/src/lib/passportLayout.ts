/**
 * Colocación de los sellos en una página (referencia del tablero de diseño).
 *
 * Las medidas están en px sobre una página de referencia de 358 × 590 (móvil). La página se divide en una
 * cabecera de 64 px y 3 franjas de 166 px; cada viaje ocupa una franja y uno con 3 o más países ocupa dos (con 2 caben en una).
 * Dentro de la franja los huecos alternan de lado para que la página no parezca una tabla.
 *
 * En escritorio la página mide 452 × 620: las posiciones se escalan por eje (x por ancho, y por alto) para llenar
 * la página, y el tamaño de los sellos con el menor de los dos factores, para que no se deformen ni se salgan.
 */

import type { Sello, Trip } from "@/lib/passport";

export const PAGE = { w: 358, h: 590, headerH: 64, bandH: 166, maxBands: 3 } as const;

/** Hueco: esquina superior izquierda del sello SIN girar, relativa al inicio de su franja. size = ancho. */
type Slot = { x: number; y: number; rot: number; size: number };
type BandSlots = { plan: Slot; country: Slot; hito: Slot };

/** Viaje de un solo país: un juego de huecos por franja (0, 1, 2). */
const BANDS: BandSlots[] = [
  { plan: { x: 14, y: 10, rot: -5, size: 150 }, country: { x: 200, y: -2, rot: 8, size: 104 }, hito: { x: 236, y: 106, rot: -6, size: 60 } },
  { country: { x: 24, y: 6, rot: -7, size: 104 }, plan: { x: 180, y: 16, rot: 4, size: 150 }, hito: { x: 46, y: 108, rot: 5, size: 60 } },
  { plan: { x: 18, y: 8, rot: 3, size: 150 }, country: { x: 210, y: 0, rot: -5, size: 100 }, hito: { x: 234, y: 104, rot: -4, size: 60 } },
];

/** Viaje con 3 o más países: ocupa dos franjas seguidas. */
const MULTI = {
  plan: { x: 12, y: 2, rot: -4, size: 150 },
  countries: [
    { x: 178, y: -14, rot: 8, size: 84 },
    { x: 262, y: 6, rot: -6, size: 80 },
    { x: 206, y: 82, rot: 5, size: 82 },
  ] as Slot[],
  /** Con más de 3 países: chip «+N» aquí; el resto va al índice. */
  more: { x: 292, y: 150 },
  hitos: [
    { x: 20, y: 112, rot: -3, size: 92 },
    { x: 112, y: 132, rot: 6, size: 84 },
  ] as Slot[],
};

/** Viaje con 2 países: caben en una franja. En la franja 1 el plan va a la derecha, así que los países van a la izquierda. */
const TWO: Slot[] = [
  { x: 178, y: -6, rot: 8, size: 86 },
  { x: 266, y: 14, rot: -6, size: 84 },
];
const TWO_MIRROR: Slot[] = [
  { x: 14, y: -6, rot: -7, size: 86 },
  { x: 100, y: 14, rot: 6, size: 84 },
];

/** Desplazamiento pequeño y estable (−2…+2°) para que dos sellos con el mismo hueco no sean idénticos. */
function jitter(id: string, range = 2): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % (range * 2 + 1)) - range;
}

export type Placed =
  | { key: string; kind: "plan" | "country" | "hito"; sello: Sello; x: number; y: number; size: number; rot: number }
  | { key: string; kind: "more"; label: string; x: number; y: number; size: number; rot: 0 };

export type FreeBand = { band: number; plan: { x: number; y: number; w: number; h: number }; country: { x: number; y: number; size: number } };

/** Cuántas franjas ocupa un viaje. */
export const bandsFor = (t: Trip) => (t.paises.length > 2 ? 2 : 1);

type Dims = { w: number; h: number };

function scales({ w, h }: Dims) {
  const sx = w / PAGE.w;
  const sy = h / PAGE.h;
  return { sx, sy, ss: Math.min(sx, sy) };
}

/** Coloca los sellos de los viajes de una página. */
export function layoutPage(trips: Trip[], dims: Dims): Placed[] {
  const { sx, sy, ss } = scales(dims);
  const out: Placed[] = [];
  let band = 0;

  const put = (kind: "plan" | "country" | "hito", sello: Sello, slot: Slot, y0: number) =>
    out.push({
      key: `${kind}-${sello.id}`,
      kind,
      sello,
      x: Math.round(slot.x * sx),
      y: Math.round((y0 + slot.y) * sy),
      size: Math.round(slot.size * ss),
      rot: slot.rot + jitter(String(sello.id)),
    });

  for (const t of trips) {
    const y0 = PAGE.headerH + band * PAGE.bandH;
    if (t.paises.length > 2) {
      if (t.plan) put("plan", t.plan, MULTI.plan, y0);
      t.paises.slice(0, 3).forEach((c, i) => put("country", c, MULTI.countries[i], y0));
      if (t.paises.length > 3) {
        out.push({
          key: `more-${t.planId}`,
          kind: "more",
          label: `+${t.paises.length - 3}`,
          x: Math.round(MULTI.more.x * sx),
          y: Math.round((y0 + MULTI.more.y) * sy),
          size: 44,
          rot: 0,
        });
      }
      t.hitos.slice(0, 2).forEach((h, i) => put("hito", h, MULTI.hitos[i], y0));
      band += 2;
    } else {
      const b = BANDS[band];
      if (!b) break;
      if (t.plan) put("plan", t.plan, b.plan, y0);
      if (t.paises.length === 2) {
        const two = band === 1 ? TWO_MIRROR : TWO;
        t.paises.forEach((c, i) => put("country", c, two[i], y0));
      } else if (t.paises[0]) put("country", t.paises[0], b.country, y0);
      if (t.hitos[0]) put("hito", t.hitos[0], b.hito, y0);
      band += 1;
    }
  }
  return out;
}

/** Franjas libres de una página y dónde caen su hueco de plan y de país, para «Aquí irá tu próximo sello». */
export function freeBands(trips: Trip[], dims: Dims): FreeBand[] {
  const { sx, sy, ss } = scales(dims);
  const used = trips.reduce((n, t) => n + bandsFor(t), 0);
  return Array.from({ length: Math.max(0, PAGE.maxBands - used) }, (_, i) => {
    const band = used + i;
    const b = BANDS[band];
    const y0 = PAGE.headerH + band * PAGE.bandH;
    return {
      band,
      plan: { x: Math.round(b.plan.x * sx), y: Math.round((y0 + b.plan.y) * sy), w: Math.round(b.plan.size * ss), h: Math.round(((b.plan.size * 96) / 140) * ss) },
      country: { x: Math.round(b.country.x * sx), y: Math.round((y0 + b.country.y) * sy), size: Math.round(b.country.size * ss) },
    };
  });
}
