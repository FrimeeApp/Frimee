// The album tab as data: days → blocks (an activity, a leg between two activities, a stay that
// continues) → photos, and «Sin clasificar» at the end. Built from the placement of each photo
// (album-placement.ts); the tab only draws it.

import {
  colocarFotos,
  type Colocacion,
  type PlacementActivity,
  type PlacementPhoto,
  type SinClasificarMotivo,
} from "./album-placement.ts";

export type GroupActivity = PlacementActivity & { titulo: string; ubicacion_nombre: string | null };
export type GroupPhoto = PlacementPhoto & { created_at: string; url: string; user_id: string };

export type PlacedPhoto = { foto: GroupPhoto; colocacion: Colocacion };

export type ActivityBlock = {
  kind: "actividad";
  key: string;
  actividad: GroupActivity;
  /** Position of the activity in its day (a stay counts too); null for a stay that carries on from another day. */
  ordinal: number | null;
  /** Stay carried over from a previous day: «Noche 2 de 4», or the check-out day. */
  sigue: { noche: number; total: number; salida: boolean } | null;
  fotos: PlacedPhoto[];
};

export type LegBlock = {
  kind: "viaje";
  key: string;
  desde: GroupActivity | null;
  hasta: GroupActivity;
  fotos: PlacedPhoto[];
};

export type Block = ActivityBlock | LegBlock;

export type DayGroup = {
  key: string; // YYYY-MM-DD
  /** 1 for the first day of the plan. */
  numero: number;
  fotoCount: number;
  blocks: Block[];
};

export type UnclassifiedGroup = {
  /** «sin_hora» | «antes» | «despues» | «otro», or a day key when the section is split by date. */
  key: string;
  motivo: SinClasificarMotivo | null;
  dayKey: string | null;
  fotos: PlacedPhoto[];
};

export type AlbumGrouping = {
  days: DayGroup[];
  sinClasificar: { total: number; porFecha: boolean; grupos: UnclassifiedGroup[] };
  total: number;
};

/** From this many on, «Sin clasificar» is split by date instead of by reason. */
export const SIN_CLASIFICAR_POR_FECHA = 20;
const LODGING_TYPES = new Set(["HOTEL", "ALOJAMIENTO"]);

export function dayKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function keyToMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToMs(toKey) - keyToMs(fromKey)) / 86_400_000);
}

function byTime(a: PlacedPhoto, b: PlacedPhoto): number {
  const ta = a.foto.tomada_at ? Date.parse(a.foto.tomada_at) : Infinity;
  const tb = b.foto.tomada_at ? Date.parse(b.foto.tomada_at) : Infinity;
  return ta - tb || Date.parse(a.foto.created_at) - Date.parse(b.foto.created_at) || a.foto.id - b.foto.id;
}

/**
 * @param incluirVacios  list every activity even without photos (the empty album shows them as «Sin fotos»)
 */
export function agruparAlbum(opts: {
  planInicio: string;
  planFin: string;
  actividades: GroupActivity[];
  fotos: GroupPhoto[];
  incluirVacios?: boolean;
}): AlbumGrouping {
  const { actividades, fotos } = opts;
  const colocadas = colocarFotos(actividades, fotos);
  const porId = new Map(actividades.map((a) => [a.id, a]));

  // The day each activity belongs to, and the order inside the day.
  const startKey = (a: GroupActivity) => dayKeyOf(Date.parse(a.inicio_at));
  const delDia = new Map<string, GroupActivity[]>();
  for (const a of [...actividades].sort((x, y) => Date.parse(x.inicio_at) - Date.parse(y.inicio_at) || x.id - y.id)) {
    const k = startKey(a);
    (delDia.get(k) ?? delDia.set(k, []).get(k)!).push(a);
  }
  const ordinalDe = (a: GroupActivity) => (delDia.get(startKey(a)) ?? []).indexOf(a) + 1;

  const blocks = new Map<string, Map<string, Block>>(); // day → block key → block
  const sin: PlacedPhoto[] = [];

  const ensure = (day: string, key: string, make: () => Block): Block => {
    const d = blocks.get(day) ?? blocks.set(day, new Map()).get(day)!;
    return d.get(key) ?? d.set(key, make()).get(key)!;
  };

  const legDesde = (hasta: GroupActivity): GroupActivity | null => {
    const k = startKey(hasta);
    const hastaStart = Date.parse(hasta.inicio_at);
    let best: GroupActivity | null = null;
    for (const a of delDia.get(k) ?? []) {
      if (a.id === hasta.id || a.all_day || LODGING_TYPES.has(a.tipo)) continue;
      if (Date.parse(a.fin_at) <= hastaStart && (!best || Date.parse(a.fin_at) >= Date.parse(best.fin_at))) best = a;
    }
    return best;
  };

  for (const foto of fotos) {
    const colocacion = colocadas.get(foto.id)!;
    const placed: PlacedPhoto = { foto, colocacion };
    const d = colocacion.destino;
    if (d.kind === "sin_clasificar") {
      sin.push(placed);
      continue;
    }
    if (d.kind === "viaje") {
      const hasta = porId.get(d.hastaSubplanId);
      if (!hasta) {
        sin.push(placed);
        continue;
      }
      const day = startKey(hasta);
      const b = ensure(day, `viaje-${hasta.id}`, () => ({ kind: "viaje", key: `viaje-${hasta.id}`, desde: legDesde(hasta), hasta, fotos: [] })) as LegBlock;
      b.fotos.push(placed);
      continue;
    }
    const act = porId.get(d.subplanId);
    if (!act) {
      sin.push(placed);
      continue;
    }
    // A stay or long activity is shown on the day of the photo (so «Sigue · Hotel» appears day by day);
    // anything else on the day it starts.
    const inicio = startKey(act);
    const largo = dayKeyOf(Date.parse(act.fin_at)) !== inicio;
    const dia = largo && foto.tomada_at && !colocacion.manual ? dayKeyOf(Date.parse(foto.tomada_at)) : inicio;
    const b = ensure(dia, `act-${act.id}`, () => makeActivityBlock(act, dia, inicio, ordinalDe(act))) as ActivityBlock;
    b.fotos.push(placed);
  }

  if (opts.incluirVacios) {
    for (const a of actividades) {
      const k = startKey(a);
      ensure(k, `act-${a.id}`, () => makeActivityBlock(a, k, k, ordinalDe(a)));
    }
  }

  // Days: every day of the plan plus any day that has something.
  const planDays: string[] = [];
  const first = dayKeyOf(Date.parse(opts.planInicio));
  const last = dayKeyOf(Date.parse(opts.planFin));
  for (let k = first, n = 0; keyToMs(k) <= keyToMs(last) && n < 400; n++) {
    planDays.push(k);
    k = dayKeyOf(keyToMs(k) + 86_400_000 + 3_600_000); // +1 h: safe across the clock change
  }
  const allKeys = [...new Set([...planDays, ...blocks.keys()])].sort();
  const base = allKeys.length ? allKeys[0] : first;
  const days: DayGroup[] = allKeys.map((key) => {
    const bs = [...(blocks.get(key)?.values() ?? [])];
    for (const b of bs) b.fotos.sort(byTime);
    bs.sort((a, b) => blockStart(a) - blockStart(b));
    return { key, numero: daysBetween(planDays[0] ?? base, key) + 1, fotoCount: bs.reduce((n, b) => n + b.fotos.length, 0), blocks: bs };
  });

  sin.sort(byTime);
  const porFecha = sin.length >= SIN_CLASIFICAR_POR_FECHA;
  return {
    days,
    sinClasificar: { total: sin.length, porFecha, grupos: porFecha ? agruparPorFecha(sin) : agruparPorMotivo(sin) },
    total: fotos.length,
  };
}

function makeActivityBlock(act: GroupActivity, day: string, inicio: string, ordinal: number): ActivityBlock {
  const carries = day !== inicio;
  const nights = Math.max(1, daysBetween(inicio, dayKeyOf(Date.parse(act.fin_at))));
  return {
    kind: "actividad",
    key: `act-${act.id}`,
    actividad: act,
    ordinal: carries ? null : ordinal,
    sigue: carries ? { noche: daysBetween(inicio, day) + 1, total: nights, salida: day === dayKeyOf(Date.parse(act.fin_at)) } : null,
    fotos: [],
  };
}

function blockStart(b: Block): number {
  if (b.kind === "viaje") return (b.desde ? Date.parse(b.desde.fin_at) : Date.parse(b.hasta.inicio_at)) + 1; // right after the previous one
  if (b.sigue) return -Infinity; // a stay that carries on goes first in the day
  return Date.parse(b.actividad.inicio_at);
}

const MOTIVO_ORDEN: SinClasificarMotivo[] = ["antes", "despues", "sin_hora", "otro"];

function agruparPorMotivo(sin: PlacedPhoto[]): UnclassifiedGroup[] {
  return MOTIVO_ORDEN.map((motivo) => ({
    key: motivo,
    motivo,
    dayKey: null,
    fotos: sin.filter((p) => p.colocacion.destino.kind === "sin_clasificar" && p.colocacion.destino.motivo === motivo),
  })).filter((g) => g.fotos.length > 0);
}

function agruparPorFecha(sin: PlacedPhoto[]): UnclassifiedGroup[] {
  const map = new Map<string, PlacedPhoto[]>();
  for (const p of sin) {
    const k = p.foto.tomada_at ? dayKeyOf(Date.parse(p.foto.tomada_at)) : "sin-hora";
    (map.get(k) ?? map.set(k, []).get(k)!).push(p);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === "sin-hora" ? 1 : b === "sin-hora" ? -1 : a.localeCompare(b)))
    .map(([k, fotos]) => ({ key: k, motivo: k === "sin-hora" ? ("sin_hora" as const) : null, dayKey: k === "sin-hora" ? null : k, fotos }));
}
