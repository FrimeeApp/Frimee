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
  // The number of an activity in its day; stays carry a bed instead and are not counted.
  const ordinalDe = (a: GroupActivity) => (delDia.get(startKey(a)) ?? []).filter((x) => !LODGING_TYPES.has(x.tipo)).indexOf(a) + 1;

  const blocks = new Map<string, Map<string, Block>>(); // day → block key → block
  const sin: PlacedPhoto[] = [];

  const ensure = (day: string, key: string, make: () => Block): Block => {
    const d = blocks.get(day) ?? blocks.set(day, new Map()).get(day)!;
    return d.get(key) ?? d.set(key, make()).get(key)!;
  };

  const legDesde = (hasta: GroupActivity) => legDesdeDe(delDia.get(startKey(hasta)) ?? [], hasta);

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
    const enRango = foto.tomada_at !== null && Date.parse(foto.tomada_at) >= Date.parse(act.inicio_at) && Date.parse(foto.tomada_at) <= Date.parse(act.fin_at);
    const dia = largo && enRango ? dayKeyOf(Date.parse(foto.tomada_at as string)) : inicio;
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

/** The activity a leg to `hasta` comes from: the timed one of that day that ended last before it starts. */
export function legDesdeDe(delMismoDia: GroupActivity[], hasta: GroupActivity): GroupActivity | null {
  const hastaStart = Date.parse(hasta.inicio_at);
  let best: GroupActivity | null = null;
  for (const a of delMismoDia) {
    if (a.id === hasta.id || a.all_day || LODGING_TYPES.has(a.tipo)) continue;
    if (Date.parse(a.fin_at) <= hastaStart && (!best || Date.parse(a.fin_at) >= Date.parse(best.fin_at))) best = a;
  }
  // A stay that checked in after it ends takes the photos from there: no leg from it past the stay.
  if (best && delMismoDia.some((a) => a.id !== hasta.id && LODGING_TYPES.has(a.tipo) && Date.parse(a.inicio_at) >= Date.parse(best.fin_at) && Date.parse(a.inicio_at) < hastaStart)) return null;
  return best;
}

/** «Sáb 21 nov» */
export function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  const clean = text.replace(/[.,]/g, "").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// ── «Mover a…»: every place a photo can be sent to ────────────────────────────────────────

export type MoverOption = {
  id: string;
  kind: "actividad" | "viaje" | "sigue";
  colocacion: "actividad" | "viaje";
  subplanId: number;
  dayKey: string;
  ordinal: number | null;
  titulo: string;
  /** «desde 15:00», «10:00», «noche 2», «Todo el día»; empty for a leg. */
  detalle: string;
  /** Photos there now. */
  count: number;
  /** Lower-case text the search looks in. */
  busqueda: string;
};

export type MoverDay = { key: string; numero: number; options: MoverOption[] };

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });

/** The days with all their activities, legs and stays, even the empty ones; «Sin clasificar» is added by the caller. */
export function opcionesMover(actividades: GroupActivity[], grouping: AlbumGrouping): MoverDay[] {
  const cuenta = new Map<string, number>();
  for (const d of grouping.days) for (const b of d.blocks) cuenta.set(`${d.key}|${b.key}`, b.fotos.length);

  const startKey = (a: GroupActivity) => dayKeyOf(Date.parse(a.inicio_at));
  const ordenadas = [...actividades].sort((x, y) => Date.parse(x.inicio_at) - Date.parse(y.inicio_at) || x.id - y.id);
  const delDia = new Map<string, GroupActivity[]>();
  for (const a of ordenadas) (delDia.get(startKey(a)) ?? delDia.set(startKey(a), []).get(startKey(a))!).push(a);

  return grouping.days.map((day) => {
    const options: MoverOption[] = [];
    // Stays that carry on into this day.
    for (const a of ordenadas) {
      const inicio = startKey(a);
      const fin = dayKeyOf(Date.parse(a.fin_at));
      if (inicio < day.key && day.key <= fin && fin !== inicio) {
        const noche = Math.round((new Date(day.key).getTime() - new Date(inicio).getTime()) / 86_400_000) + 1;
        options.push({
          id: `sigue-${a.id}-${day.key}`, kind: "sigue", colocacion: "actividad", subplanId: a.id, dayKey: day.key, ordinal: null,
          titulo: `Sigue · ${a.titulo}`, detalle: day.key === fin ? "salida" : `noche ${noche}`,
          count: cuenta.get(`${day.key}|act-${a.id}`) ?? 0, busqueda: `sigue ${a.titulo}`.toLowerCase(),
        });
      }
    }
    const hoy = delDia.get(day.key) ?? [];
    const sinEstancias = hoy.filter((x) => !LODGING_TYPES.has(x.tipo));
    hoy.forEach((a) => {
      const leg = legDesdeDe(hoy, a);
      if (leg) {
        options.push({
          id: `viaje-${a.id}`, kind: "viaje", colocacion: "viaje", subplanId: a.id, dayKey: day.key, ordinal: null,
          titulo: `${leg.titulo} → ${a.titulo}`, detalle: "", count: cuenta.get(`${day.key}|viaje-${a.id}`) ?? 0,
          busqueda: `viaje ${leg.titulo} ${a.titulo}`.toLowerCase(),
        });
      }
      const stay = LODGING_TYPES.has(a.tipo);
      options.push({
        id: `act-${a.id}`, kind: "actividad", colocacion: "actividad", subplanId: a.id, dayKey: day.key, ordinal: stay ? null : sinEstancias.indexOf(a) + 1,
        titulo: a.titulo, detalle: a.all_day ? "Todo el día" : stay ? `desde ${hhmm(a.inicio_at)}` : hhmm(a.inicio_at),
        count: cuenta.get(`${day.key}|act-${a.id}`) ?? 0, busqueda: a.titulo.toLowerCase(),
      });
    });
    return { key: day.key, numero: day.numero, options };
  });
}
