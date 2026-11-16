import { createBrowserSupabaseClient } from "@/services/supabase/client";

/** «miembro»: already in the plan · «pendiente»: invited, not answered yet. */
export type InviteEstado = "miembro" | "pendiente" | null;

export type InviteFriend = {
  id: string;
  nombre: string;
  username: string | null;
  profile_image: string | null;
  estado: InviteEstado;
  /** Has written to you in a shared chat in the last 30 days (they come first). */
  reciente: boolean;
};

export type InviteGroup = {
  chat_id: string;
  nombre: string | null;
  foto: string | null;
  miembros: { id: string; nombre: string; profile_image: string | null; estado: InviteEstado }[];
};

export type InviteList = { amigos: InviteFriend[]; grupos: InviteGroup[]; codigo: string | null };

function rpcError(error: { message?: string; code?: string }, fallback: string) {
  return new Error(error.message || error.code || fallback);
}

export async function fetchInviteList(planId: number): Promise<InviteList> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_invitar_lista", { p_plan_id: planId });
  if (error) throw rpcError(error, "Error cargando tus amigos");
  const d = (data ?? {}) as Partial<InviteList>;
  return { amigos: d.amigos ?? [], grupos: d.grupos ?? [], codigo: d.codigo ?? null };
}

/** Returns who was actually invited (friends or people from your groups, not blocked, not in yet). */
export async function invitePeople(planId: number, userIds: string[]): Promise<string[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_invitar", { p_plan_id: planId, p_users: userIds });
  if (error) throw rpcError(error, "Error enviando la invitación");
  return (data ?? []) as string[];
}

/** Invites whoever of the group is not in the plan yet. */
export async function inviteGroup(planId: number, chatId: string): Promise<string[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_invitar_grupo", { p_plan_id: planId, p_chat_id: chatId });
  if (error) throw rpcError(error, "Error invitando al grupo");
  return (data ?? []) as string[];
}

export async function cancelInvite(planId: number, userId: string): Promise<boolean> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_cancelar_invitacion", { p_plan_id: planId, p_user_id: userId });
  if (error) throw rpcError(error, "Error cancelando la invitación");
  return Boolean(data);
}

/** «7Q4KXM9P» → «7Q4K-XM9P» (easier to read out loud). */
export function formatPlanCode(codigo: string) {
  return codigo.length === 8 ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : codigo;
}
