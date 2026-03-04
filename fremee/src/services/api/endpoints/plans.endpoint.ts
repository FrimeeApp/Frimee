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
};

export type PublicCreatorRow = {
  id: string;
  nombre: string;
  profile_image: string | null;
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

export async function fetchPlansByIds(params: { planIds: number[] }) {
  const supabase = createBrowserSupabaseClient();

  if (params.planIds.length === 0) {
    return { plans: [] as PlanByIdRow[], creators: {} as Record<string, PublicCreatorRow> };
  }

  const { data: plansData, error: plansError } = await supabase
    .from("plan")
    .select("id,created_at,titulo,descripcion,visibilidad,inicio_at,fin_at,all_day,ubicacion_nombre,foto_portada,owner_user_id,creado_por_user_id")
    .in("id", params.planIds)
    .is("deleted_at", null)
    .eq("estado", "ACTIVO");

  if (plansError) throw plansError;

  const plans = (plansData ?? []) as PlanByIdRow[];
  const creatorIds = [...new Set(plans.map((p) => p.creado_por_user_id).filter(Boolean))];

  if (creatorIds.length === 0) {
    return { plans, creators: {} as Record<string, PublicCreatorRow> };
  }

  const { data: creatorsData, error: creatorsError } = await supabase
    .from("usuarios_public")
    .select("id,nombre,profile_image")
    .in("id", creatorIds);

  console.log("[plans] usuarios_public creators", {
    creatorIds,
    rows: creatorsData,
    error: creatorsError
      ? { message: creatorsError.message, code: creatorsError.code, details: creatorsError.details }
      : null,
  });

  if (creatorsError) throw creatorsError;

  const creators: Record<string, PublicCreatorRow> = {};
  for (const row of (creatorsData ?? []) as PublicCreatorRow[]) {
    creators[row.id] = row;
  }

  return { plans, creators };
}

export async function fetchUserRelatedPlans(params: { userId: string; limit?: number }) {
  const supabase = createBrowserSupabaseClient();

  const { data: plansData, error: plansError } = await supabase
    .from("plan")
    .select("id,created_at,titulo,descripcion,visibilidad,inicio_at,fin_at,all_day,ubicacion_nombre,foto_portada,owner_user_id,creado_por_user_id")
    .or(`creado_por_user_id.eq.${params.userId},owner_user_id.eq.${params.userId}`)
    .is("deleted_at", null)
    .eq("estado", "ACTIVO")
    .order("inicio_at", { ascending: true })
    .limit(params.limit ?? 300);

  if (plansError) throw plansError;

  const plans = (plansData ?? []) as PlanByIdRow[];
  const creatorIds = [...new Set(plans.map((p) => p.creado_por_user_id).filter(Boolean))];

  if (creatorIds.length === 0) {
    return { plans, creators: {} as Record<string, PublicCreatorRow> };
  }

  const { data: creatorsData, error: creatorsError } = await supabase
    .from("usuarios_public")
    .select("id,nombre,profile_image")
    .in("id", creatorIds);

  if (creatorsError) throw creatorsError;

  const creators: Record<string, PublicCreatorRow> = {};
  for (const row of (creatorsData ?? []) as PublicCreatorRow[]) {
    creators[row.id] = row;
  }

  return { plans, creators };
}
