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
