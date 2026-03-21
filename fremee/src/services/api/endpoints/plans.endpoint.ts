import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type FeedExploreRow = {
  plan_id: number;
  created_at: string;
  titulo: string;
  descripcion: string;
  visibilidad: string;
  inicio_at: string;
  fin_at: string;
  ubicacion_nombre: string;
  foto_portada: string | null;
  creador_id: string;
  creador_nombre: string;
  creador_profile_image: string | null;
};

export type PlanByIdRow = {
  id: number;
  created_at: string;
  titulo: string;
  descripcion: string;
  visibilidad: string;
  inicio_at: string;
  fin_at: string;
  all_day: boolean;
  ubicacion_nombre: string;
  foto_portada: string | null;
  owner_user_id: string;
  creado_por_user_id: string;
  creador_nombre: string | null;
  creador_profile_image: string | null;
};

export async function fetchExplorePlansRpc(params: {
  limit: number;
  cursorCreatedAt: string | null;
  cursorPlanId: number | null;
}) {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.rpc("feed_explore", {
    p_limit: params.limit,
    p_cursor_created_at: params.cursorCreatedAt,
    p_cursor_plan_id: params.cursorPlanId,
  });

  if (error) throw error;
  return (data ?? []) as FeedExploreRow[];
}

export type CreatePlanParams = {
  titulo: string;
  descripcion: string;
  inicioAt: string;
  finAt: string;
  ubicacionNombre: string;
  ubicacionDireccion?: string | null;
  fotoPortada?: string | null;
  allDay?: boolean;
  visibilidad?: "PUBLICO" | "SOLO_GRUPO" | "SOLO_AMIGOS" | "SOLO_FOLLOW";
  ownerUserId: string;
  creadoPorUserId: string;
};

export async function createPlanEndpoint(params: CreatePlanParams): Promise<{ id: number }> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.rpc("fn_plan_create", {
    p_titulo: params.titulo,
    p_descripcion: params.descripcion,
    p_inicio_at: params.inicioAt,
    p_fin_at: params.finAt,
    p_ubicacion_nombre: params.ubicacionNombre,
    p_owner_user_id: params.ownerUserId,
    p_creado_por_user_id: params.creadoPorUserId,
    p_all_day: params.allDay ?? false,
    p_visibilidad: params.visibilidad ?? "SOLO_GRUPO",
    p_ubicacion_direccion: params.ubicacionDireccion ?? null,
    p_foto_portada: params.fotoPortada ?? null,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as { id?: number | string } | null;
  if (!row?.id) {
    throw new Error("fn_plan_create no devolvio un id de plan.");
  }

  return { id: Number(row.id) };
}

export async function fetchPlansByIds(params: { planIds: number[] }): Promise<PlanByIdRow[]> {
  const supabase = createBrowserSupabaseClient();

  if (params.planIds.length === 0) return [];

  const { data, error } = await supabase.rpc("fn_plans_get_by_ids", {
    p_plan_ids: params.planIds,
  });

  if (error) throw error;
  return (data ?? []) as PlanByIdRow[];
}

export async function fetchUserRelatedPlans(params: { userId: string; limit?: number }): Promise<PlanByIdRow[]> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.rpc("fn_plans_get_for_user", {
    p_user_id: params.userId,
    p_limit: params.limit ?? 300,
  });

  if (error) throw error;
  return (data ?? []) as PlanByIdRow[];
}
