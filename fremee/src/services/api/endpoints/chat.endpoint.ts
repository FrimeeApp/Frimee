import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type ChatListItem = {
  chat_id: string;
  tipo: "DIRECTO" | "GRUPO";
  nombre: string | null;
  foto: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  miembros: Array<{ id: string; nombre: string; profile_image: string | null }>;
};

export type MensajeRow = {
  id: number;
  sender_id: string;
  sender_nombre: string;
  sender_profile_image: string | null;
  texto: string;
  created_at: string;
};

export type ChatMiembro = {
  user_id: string;
  nombre: string;
  profile_image: string | null;
  joined_at: string;
};

export async function listChatsEndpoint(): Promise<ChatListItem[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chats_list");
  if (error) throw error;
  return (data ?? []) as ChatListItem[];
}

export async function getOrCreateDirectoChatEndpoint(otherUserId: string): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_get_or_create_directo", {
    p_other_user_id: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function createGrupoChatEndpoint(params: {
  nombre: string;
  foto?: string | null;
  miembros: string[];
}): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_create_grupo", {
    p_nombre: params.nombre,
    p_foto: params.foto ?? null,
    p_miembros: params.miembros,
  });
  if (error) throw error;
  return data as string;
}

export async function listMensajesEndpoint(params: {
  chatId: string;
  limit?: number;
  cursorId?: number | null;
}): Promise<MensajeRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_mensajes_list", {
    p_chat_id: params.chatId,
    p_limit: params.limit ?? 30,
    p_cursor_id: params.cursorId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as MensajeRow[];
}

export async function sendMensajeEndpoint(params: {
  chatId: string;
  texto: string;
}): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_mensaje_send", {
    p_chat_id: params.chatId,
    p_texto: params.texto,
  });
  if (error) throw error;
  return data as number;
}

export async function markChatReadEndpoint(chatId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_chat_mark_read", { p_chat_id: chatId });
  if (error) throw error;
}

export async function getChatMiembrosEndpoint(chatId: string): Promise<ChatMiembro[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_get_miembros", { p_chat_id: chatId });
  if (error) throw error;
  return (data ?? []) as ChatMiembro[];
}

export async function leaveChatEndpoint(chatId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_chat_leave", { p_chat_id: chatId });
  if (error) throw error;
}
