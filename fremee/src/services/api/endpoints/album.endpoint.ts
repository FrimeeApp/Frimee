import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type AlbumPlan = {
  id: number;
  titulo: string;
  descripcion: string | null;
  inicio_at: string;
  fin_at: string;
  ubicacion_nombre: string | null;
  foto_portada: string | null;
};

export type AlbumMiembro = {
  id: string;
  nombre: string;
  username: string | null;
  foto: string | null;
};

export type AlbumActividad = {
  id: number;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  inicio_at: string;
  fin_at: string;
  all_day: boolean;
  ubicacion_nombre: string | null;
  lat: number | null;
  lng: number | null;
  fin_nombre: string | null;
  fin_lat: number | null;
  fin_lng: number | null;
  /** How you get here from the previous activity of the day. */
  transporte_llegada: string | null;
  duracion_viaje: string | null;
  distancia_viaje: string | null;
  ruta_polyline: string | null;
};

export type AlbumGasto = {
  id: number;
  titulo: string;
  total: number;
  moneda: string;
  fecha_gasto: string;
  categoria: string | null;
  subplan_id: number | null;
  pagado_por_user_id: string;
};

export type AlbumFoto = {
  id: number;
  url: string;
  user_id: string;
  created_at: string;
  /** When it was taken (EXIF); null when the file did not say. */
  tomada_at: string | null;
  /** exif, gps, xmp, nombre or archivo; the album trusts the first three most. */
  tomada_fuente: string | null;
  /** Placed by hand: actividad, viaje (subplan_id = the activity it arrives at) or sin_clasificar. Null = by its time. */
  colocacion: "actividad" | "viaje" | "sin_clasificar" | null;
  subplan_id: number | null;
  /** A photo or a video (older answers have no type: a photo). */
  tipo?: "foto" | "video";
};

export type PlanAlbum = {
  plan: AlbumPlan;
  miembros: AlbumMiembro[];
  actividades: AlbumActividad[];
  gastos: AlbumGasto[];
  fotos: AlbumFoto[];
};

/** Everything the trip album shows, in one call. Fails with 42501 when you are not a member. */
export async function fetchPlanAlbum(planId: number): Promise<PlanAlbum> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_album", { p_plan_id: planId });
  if (error) throw error;
  const album = data as PlanAlbum | null;
  if (!album?.plan) throw new Error("Plan no encontrado");
  return album;
}

export type FotoColocacion = { colocacion: "actividad" | "viaje" | "sin_clasificar" | null; subplanId: number | null };

/** Moves photos by hand (who uploaded each one or a plan admin). `colocacion: null` puts them back to their time. */
export async function moverFotosAlbum(planId: number, fotoIds: number[], destino: FotoColocacion): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_fotos_mover", {
    p_plan_id: planId,
    p_foto_ids: fotoIds,
    p_colocacion: destino.colocacion,
    p_subplan_id: destino.subplanId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** «Todo bien»: the approximate time of these photos is right. Who uploaded each one or an admin. */
export async function confirmarHoraFotos(planId: number, fotoIds: number[]): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_fotos_confirmar_hora", { p_plan_id: planId, p_foto_ids: fotoIds });
  if (error) throw error;
  return Number(data ?? 0);
}
