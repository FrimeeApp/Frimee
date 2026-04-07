import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type TipoSubplan =
  | "VUELO" | "TREN" | "BUS" | "BARCO" | "COCHE"
  | "HOTEL" | "RESTAURANTE" | "ACTIVIDAD" | "OTRO";

export const TIPOS_TRANSPORTE: TipoSubplan[] = ["VUELO", "BARCO"];

export type SubplanRow = {
  id: number;
  plan_id: number;
  parent_subplan_id: number | null;
  titulo: string;
  descripcion: string;
  inicio_at: string;
  fin_at: string;
  all_day: boolean;
  ubicacion_nombre: string;
  ubicacion_direccion: string | null;
  tipo: TipoSubplan;
  ubicacion_fin_nombre: string | null;
  ubicacion_fin_direccion: string | null;
  ubicacion_lat: number | null;
  ubicacion_lng: number | null;
  ubicacion_fin_lat: number | null;
  ubicacion_fin_lng: number | null;
  transporte_llegada: string | null;
  duracion_viaje: string | null;
  distancia_viaje: string | null;
  ruta_polyline: string | null;
  orden: number;
  estado: string;
  creado_por_user_id: string;
  created_at: string;
};

export async function fetchSubplanes(planId: number): Promise<SubplanRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_subplan_list", { p_plan_id: planId });
  if (error) throw error;
  return (data ?? []) as SubplanRow[];
}

export type CreateSubplanParams = {
  planId: number;
  titulo: string;
  descripcion: string;
  inicioAt: string;
  finAt: string;
  allDay?: boolean;
  tipo?: TipoSubplan;
  ubicacionNombre?: string;
  ubicacionDireccion?: string | null;
  ubicacionFinNombre?: string | null;
  ubicacionFinDireccion?: string | null;
  ubicacionLat?: number | null;
  ubicacionLng?: number | null;
  ubicacionFinLat?: number | null;
  ubicacionFinLng?: number | null;
  transporteLlegada?: string | null;
  parentSubplanId?: number | null;
};

export async function createSubplan(params: CreateSubplanParams): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_subplan_create", {
    p_plan_id:                  params.planId,
    p_titulo:                   params.titulo,
    p_descripcion:              params.descripcion,
    p_inicio_at:                params.inicioAt,
    p_fin_at:                   params.finAt,
    p_all_day:                  params.allDay ?? false,
    p_tipo:                     params.tipo ?? "ACTIVIDAD",
    p_ubicacion_nombre:         params.ubicacionNombre ?? "",
    p_ubicacion_direccion:      params.ubicacionDireccion ?? null,
    p_ubicacion_fin_nombre:     params.ubicacionFinNombre ?? null,
    p_ubicacion_fin_direccion:  params.ubicacionFinDireccion ?? null,
    p_ubicacion_lat:            params.ubicacionLat ?? null,
    p_ubicacion_lng:            params.ubicacionLng ?? null,
    p_ubicacion_fin_lat:        params.ubicacionFinLat ?? null,
    p_ubicacion_fin_lng:        params.ubicacionFinLng ?? null,
    p_transporte_llegada:       params.transporteLlegada ?? null,
    p_parent_subplan_id:        params.parentSubplanId ?? null,
  });
  if (error) throw error;
  return data as number;
}

export type UpdateSubplanParams = {
  subplanId: number;
  titulo: string;
  descripcion: string;
  inicioAt: string;
  finAt: string;
  allDay?: boolean;
  tipo?: TipoSubplan;
  ubicacionNombre?: string;
  ubicacionDireccion?: string | null;
  ubicacionFinNombre?: string | null;
  ubicacionFinDireccion?: string | null;
  ubicacionLat?: number | null;
  ubicacionLng?: number | null;
  ubicacionFinLat?: number | null;
  ubicacionFinLng?: number | null;
  transporteLlegada?: string | null;
};

export async function updateSubplan(params: UpdateSubplanParams): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_subplan_update", {
    p_subplan_id:           params.subplanId,
    p_titulo:               params.titulo,
    p_descripcion:          params.descripcion,
    p_inicio_at:            params.inicioAt,
    p_fin_at:               params.finAt,
    p_all_day:              params.allDay ?? false,
    p_tipo:                 params.tipo ?? "ACTIVIDAD",
    p_ubicacion_nombre:     params.ubicacionNombre ?? "",
    p_ubicacion_fin_nombre: params.ubicacionFinNombre ?? null,
    p_ubicacion_lat:        params.ubicacionLat ?? null,
    p_ubicacion_lng:        params.ubicacionLng ?? null,
    p_ubicacion_fin_lat:    params.ubicacionFinLat ?? null,
    p_ubicacion_fin_lng:    params.ubicacionFinLng ?? null,
    p_transporte_llegada:   params.transporteLlegada ?? null,
  });
  if (error) { console.error("[updateSubplan] full error:", JSON.stringify(error, null, 2)); throw error; }
}

export async function updateSubplanTransporte(subplanId: number, transporte: string | null): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_subplan_save_transporte", {
    p_subplan_id: subplanId,
    p_transporte: transporte,
  });
  if (error) throw error;
}

export async function updateSubplanViaje(subplanId: number, duracion: string, distancia: string, polyline: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_subplan_save_viaje", {
    p_subplan_id: subplanId,
    p_duracion:   duracion,
    p_distancia:  distancia,
    p_polyline:   polyline,
  });
  if (error) throw error;
}

export async function deleteSubplan(subplanId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_subplan_delete", { p_subplan_id: subplanId });
  if (error) throw error;
}
