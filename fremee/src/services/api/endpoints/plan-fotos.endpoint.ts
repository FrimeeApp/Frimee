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

export async function deletePlanFoto(params: { id: number; userId: string }): Promise<void> {
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase
    .from("plan_fotos")
    .delete()
    .eq("id", params.id)
    .eq("user_id", params.userId);

  if (error) throw error;
}
