import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type TareaRow = {
  id: number;
  titulo: string;
  categoria: string;
  estado: string;
};

export type TareaConAsignadoRow = TareaRow & {
  asignado_user_id: string | null;
  asignado_nombre: string;
};

export async function crearTareaEndpoint(params: {
  planId: number;
  titulo: string;
  asignadoUserId: string;
  categoria: string;
}): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_tarea_create", {
    p_plan_id: params.planId,
    p_titulo: params.titulo,
    p_asignado_user_id: params.asignadoUserId,
    p_categoria: params.categoria,
  });
  if (error) throw error;
  return data as number;
}

export async function misTareasEndpoint(planId: number): Promise<TareaRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_mis_tareas", { p_plan_id: planId });
  if (error) throw error;
  return (data ?? []) as TareaRow[];
}

export async function todasTareasEndpoint(planId: number): Promise<TareaConAsignadoRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_todas_tareas", { p_plan_id: planId });
  if (error) throw error;
  return (data ?? []) as TareaConAsignadoRow[];
}

export async function recordarEndpoint(params: {
  planId: number;
  fromUserId: string;
  toUserId: string;
}): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_recordar", {
    p_plan_id: params.planId,
    p_from_user_id: params.fromUserId,
    p_to_user_id: params.toUserId,
  });
  if (error) throw error;
  return data as number;
}

export async function updateEstadoTareaEndpoint(tareaId: number, estado: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_tarea_update_estado", {
    p_tarea_id: tareaId,
    p_estado: estado,
  });
  if (error) throw error;
}
