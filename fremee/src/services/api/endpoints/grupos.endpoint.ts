import { createBrowserSupabaseClient } from "@/services/supabase/client";

export async function createGrupoEndpoint(params: {
  nombre: string;
  visibilidad?: string;
  imagen?: string | null;
  miembros: string[];
}): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_grupo_create", {
    p_nombre:      params.nombre,
    p_visibilidad: params.visibilidad ?? "PRIVADO",
    p_imagen:      params.imagen ?? null,
    p_miembros:    params.miembros,
  });
  if (error) throw error;
  return data as number;
}

export async function addGrupoMemberEndpoint(params: {
  grupoId: number;
  userId: string;
}): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_grupo_add_member", {
    p_grupo_id: params.grupoId,
    p_user_id:  params.userId,
  });
  if (error) throw error;
}
