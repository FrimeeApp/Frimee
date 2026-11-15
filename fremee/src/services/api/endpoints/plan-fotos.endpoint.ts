import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type PlanFotoRow = {
  id: number;
  plan_id: number;
  user_id: string;
  url: string;
  storage_path: string;
  created_at: string;
};

export async function fetchPlanFotos(params: { planId: number }): Promise<PlanFotoRow[]> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("plan_fotos")
    .select("*")
    .eq("plan_id", params.planId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PlanFotoRow[];
}

export async function insertPlanFoto(params: {
  planId: number;
  userId: string;
  url: string;
  storagePath: string;
}): Promise<PlanFotoRow> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("plan_fotos")
    .insert({
      plan_id: params.planId,
      user_id: params.userId,
      url: params.url,
      storage_path: params.storagePath,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PlanFotoRow;
}

/**
 * «Guardar en el álbum del viaje» from the chat: the album row points at the same file (removing it
 * from the album never deletes the file). Already there → "ya_estaba", nothing is added.
 */
export async function savePlanFotoFromChat(params: { planId: number; userId: string; url: string }): Promise<"guardada" | "ya_estaba"> {
  const supabase = createBrowserSupabaseClient();
  const { data: found, error: findError } = await supabase
    .from("plan_fotos")
    .select("id")
    .eq("plan_id", params.planId)
    .eq("url", params.url)
    .limit(1);
  if (findError) throw findError;
  if (found && found.length > 0) return "ya_estaba";
  // Firebase download URLs carry the object path after /o/.
  const path = params.url.match(/\/o\/([^?]+)/)?.[1];
  await insertPlanFoto({ planId: params.planId, userId: params.userId, url: params.url, storagePath: path ? decodeURIComponent(path) : params.url });
  return "guardada";
}

export async function deletePlanFoto(params: { id: number; userId: string }): Promise<void> {
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase
    .from("plan_fotos")
    .delete()
    .eq("id", params.id)
    .eq("user_id", params.userId);

  if (error) throw error;
}
