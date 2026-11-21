import type { AlbumActividad, AlbumFoto, AlbumGasto, PlanAlbum } from "@/services/api/endpoints/album.endpoint";
import { colocarFotos } from "./album-placement";

export type AlbumDay = {
  /** Local date, YYYY-MM-DD. */
  key: string;
  /** 1 = first day of the trip. */
  number: number;
  actividades: AlbumActividad[];
  gastos: AlbumGasto[];
  fotos: AlbumFoto[];
  gastoTotal: number;
  /** Sum of the day's legs, in km. */
  km: number;
  kmAPie: number;
};

export type AlbumStats = {
  dias: number;
  sitios: number;
  km: number;
  kmAPie: number;
  gastoTotal: number;
  gastoPorPersona: number;
  moneda: string;
  categoriaTop: { nombre: string; total: number } | null;
  fotos: number;
  fotografoTop: { userId: string; fotos: number } | null;
};

export type AlbumModel = {
  days: AlbumDay[];
  /** Photos that fit no activity (before or after the trip, or with no time). */
  fotosSueltas: AlbumFoto[];
  /** The activity each placed photo belongs to (photo id → activity id). */
  fotoActividad: Map<number, number>;
  /** Photos taken on the way between two activities of the same day (photo id → the activity the leg arrives at). */
  fotoTramo: Map<number, number>;
  stats: AlbumStats;
};

/** Local calendar day of an ISO timestamp, as YYYY-MM-DD (sv-SE prints ISO order). */
export function localDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE");
}

function dayDiff(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 864e5);
}

/** "7,6 km" → 7.6 · "850 m" → 0.85 · anything else → 0. */
export function parseKm(value: string | null | undefined): number {
  const match = value?.trim().match(/^(\d+(?:[.,]\d+)?)\s*(km|m)\b/i);
  if (!match) return 0;
  const amount = Number(match[1].replace(",", "."));
  return match[2].toLowerCase() === "km" ? amount : amount / 1000;
}

function topBy<T>(items: T[], key: (item: T) => string, weight: (item: T) => number) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(key(item), (totals.get(key(item)) ?? 0) + weight(item));
  let best: [string, number] | null = null;
  for (const entry of totals) if (!best || entry[1] > best[1]) best = entry;
  return best;
}

/** Groups the album by local day and computes the closing figures. */
export function buildAlbumModel(fullAlbum: PlanAlbum): AlbumModel {
  // The journey tells the trip with photos: videos live in the album tab only.
  const album: PlanAlbum = { ...fullAlbum, fotos: fullAlbum.fotos.filter((f) => f.tipo !== "video") };
  const startKey = localDayKey(album.plan.inicio_at);
  const endKey = localDayKey(album.plan.fin_at);
  const days = new Map<string, AlbumDay>();
  const dayFor = (key: string) => {
    let day = days.get(key);
    if (!day) {
      day = { key, number: dayDiff(startKey, key) + 1, actividades: [], gastos: [], fotos: [], gastoTotal: 0, km: 0, kmAPie: 0 };
      days.set(key, day);
    }
    return day;
  };

  for (const actividad of album.actividades) {
    const day = dayFor(localDayKey(actividad.inicio_at));
    day.actividades.push(actividad);
    const km = parseKm(actividad.distancia_viaje);
    day.km += km;
    if (actividad.transporte_llegada === "APIE") day.kmAPie += km;
  }

  for (const gasto of album.gastos) {
    const day = dayFor(localDayKey(gasto.fecha_gasto));
    day.gastos.push(gasto);
    day.gastoTotal += gasto.total;
  }

  // Each photo goes where the album tab puts it: by the time it was taken, or where someone moved it.
  // A photo taken on the way stays with the stop it left; one with no place is «suelta».
  const colocadas = colocarFotos(album.actividades, album.fotos);
  const fotosSueltas: AlbumFoto[] = [];
  const fotoActividad = new Map<number, number>();
  const fotoTramo = new Map<number, number>();
  for (const foto of album.fotos) {
    const destino = colocadas.get(foto.id)?.destino;
    let actividad: AlbumActividad | undefined;
    if (destino?.kind === "actividad") {
      actividad = album.actividades.find((a) => a.id === destino.subplanId);
    } else if (destino?.kind === "viaje") {
      const i = album.actividades.findIndex((a) => a.id === destino.hastaSubplanId);
      const anterior = i > 0 ? album.actividades[i - 1] : undefined;
      const llegada = i >= 0 ? album.actividades[i] : undefined;
      const enTramo = anterior && llegada && localDayKey(anterior.inicio_at) === localDayKey(llegada.inicio_at);
      actividad = enTramo ? anterior : llegada;
      if (enTramo && llegada) fotoTramo.set(foto.id, llegada.id);
    }
    if (!actividad) {
      fotosSueltas.push(foto);
      continue;
    }
    fotoActividad.set(foto.id, actividad.id);
    dayFor(localDayKey(actividad.inicio_at)).fotos.push(foto);
  }

  const sortedDays = [...days.values()]
    .filter((day) => day.actividades.length > 0 || day.fotos.length > 0)
    .sort((a, b) => a.key.localeCompare(b.key));

  const gastoTotal = album.gastos.reduce((sum, gasto) => sum + gasto.total, 0);
  const categoria = topBy(album.gastos, (gasto) => gasto.categoria ?? "Otros", (gasto) => gasto.total);
  const fotografo = topBy(album.fotos, (foto) => foto.user_id, () => 1);

  return {
    days: sortedDays,
    fotosSueltas,
    fotoActividad,
    fotoTramo,
    stats: {
      // Days with activities: the plan's end date can fall on the next day in the viewer's
      // time zone (23:59 in Lisbon is 00:59 in Madrid) and would count one day too many.
      dias: sortedDays.filter((day) => day.actividades.length > 0).length || dayDiff(startKey, endKey) + 1,
      sitios: new Set(album.actividades.map((a) => a.ubicacion_nombre).filter(Boolean)).size,
      km: sortedDays.reduce((sum, day) => sum + day.km, 0),
      kmAPie: sortedDays.reduce((sum, day) => sum + day.kmAPie, 0),
      gastoTotal,
      gastoPorPersona: album.miembros.length > 0 ? gastoTotal / album.miembros.length : gastoTotal,
      moneda: album.gastos[0]?.moneda ?? "EUR",
      categoriaTop: categoria ? { nombre: categoria[0], total: categoria[1] } : null,
      fotos: album.fotos.length,
      fotografoTop: fotografo ? { userId: fotografo[0], fotos: fotografo[1] } : null,
    },
  };
}

/** "7,6 km" / "850 m" for a number of km. */
export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString("es-ES", { maximumFractionDigits: 1 })} km`;
}
