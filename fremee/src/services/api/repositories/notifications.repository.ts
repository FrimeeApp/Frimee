import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type NotificacionDto = {
  id: number;
  tipo: string;
  actor_id: string | null;
  actor_nombre: string | null;
  actor_username: string | null;
  actor_foto: string | null;
  entity_id: string | null;
  entity_type: string | null;
  leida: boolean;
  created_at: string;
};

export async function listNotificaciones(
  limit = 30,
  cursor?: number
): Promise<NotificacionDto[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_notificaciones_list", {
    p_limit: limit,
    ...(cursor ? { p_cursor: cursor } : {}),
  });
  if (error) throw error;
  return (data ?? []) as NotificacionDto[];
}

export async function marcarNotificacionesLeidas(ids?: number[]): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_notificaciones_marcar_leidas", {
    p_ids: ids ?? null,
  });
  if (error) throw error;
}

export async function insertNotificacion(params: {
  userId: string;       // destinatario
  tipo: string;
  actorId: string;      // quien la genera
  entityId?: string;
  entityType?: string;
}): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("notificaciones").insert({
    user_id: params.userId,
    tipo: params.tipo,
    actor_id: params.actorId,
    entity_id: params.entityId ?? null,
    entity_type: params.entityType ?? null,
  });
  if (error) throw error;
}

export async function deleteNotificacionLike(params: {
  actorId: string;
  userId: string;
  entityId: string;
}): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  await supabase
    .from("notificaciones")
    .delete()
    .eq("tipo", "like")
    .eq("actor_id", params.actorId)
    .eq("user_id", params.userId)
    .eq("entity_id", params.entityId);
}

export async function acceptFriendRequest(requesterId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_friend_request_accept", { p_requester_user_id: requesterId });
  if (error) throw error;
}

export async function rejectFriendRequest(requesterId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_friend_request_reject", { p_requester_user_id: requesterId });
  if (error) throw error;
}

export async function acceptPlanInvite(planId: number, notifId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_accept_plan_invite", { p_plan_id: planId });
  if (error) {
    console.error("[acceptPlanInvite] error:", error.code, error.message, error.details);
    throw error;
  }
  await supabase.from("notificaciones").delete().eq("id", notifId);
}

export async function rejectPlanInvite(notifId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  await supabase.from("notificaciones").delete().eq("id", notifId);
}

export async function fetchPendingPlanInviteUserIds(planId: number): Promise<string[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_get_pending_plan_invite_user_ids", {
    p_plan_id: planId,
  });
  if (error) {
    console.error("[fetchPendingPlanInviteUserIds]", error);
    return [];
  }
  return (data ?? []) as string[];
}

export async function countNotificacionesNoLeidas(): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { count, error } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("leida", false);
  if (error) throw error;
  return count ?? 0;
}
