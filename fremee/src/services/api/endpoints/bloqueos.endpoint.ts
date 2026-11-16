import { createBrowserSupabaseClient } from "@/services/supabase/client";

/** Block someone: nothing of theirs reaches you any more (fn_bloquear). Nothing is deleted. */
export async function bloquearEndpoint(userId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_bloquear", { p_user_id: userId });
  if (error) throw error;
}

export async function desbloquearEndpoint(userId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_desbloquear", { p_user_id: userId });
  if (error) throw error;
}

/** Only who I have blocked (never who blocked me). */
export async function misBloqueadosEndpoint(): Promise<string[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_mis_bloqueados");
  if (error) throw error;
  return (data ?? []) as string[];
}
