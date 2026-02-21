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