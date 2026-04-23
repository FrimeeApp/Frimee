import { createBrowserSupabaseClient } from "@/services/supabase/client";

export async function savePlan(planId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("planes_guardados")
    .insert({ user_id: user.id, plan_id: planId });
  if (error && error.code !== "23505") throw error;
}

export async function unsavePlan(planId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("planes_guardados")
    .delete()
    .eq("user_id", user.id)
    .eq("plan_id", planId);
  if (error) throw error;
}

export async function getSavedPlanIds(userId: string): Promise<number[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("planes_guardados")
    .select("plan_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: { plan_id: number }) => r.plan_id);
}

export async function getSavedStatuses(planIds: number[]): Promise<Record<number, boolean>> {
  if (planIds.length === 0) return {};
  const supabase = createBrowserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data, error } = await supabase
    .from("planes_guardados")
    .select("plan_id")
    .eq("user_id", user.id)
    .in("plan_id", planIds);
  if (error) throw error;
  const result: Record<number, boolean> = {};
  for (const id of planIds) result[id] = false;
  for (const row of (data ?? []) as { plan_id: number }[]) {
    result[row.plan_id] = true;
  }
  return result;
}
