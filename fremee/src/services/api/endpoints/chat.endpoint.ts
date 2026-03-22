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
  reply_to_id?: number | null;
  reply_texto?: string | null;
  reply_sender_nombre?: string | null;
  audio_url?: string | null;
  document_url?: string | null;
  document_name?: string | null;
  image_url?: string | null;
  image_type?: string | null;
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
  replyToId?: number | null;
  audioUrl?: string | null;
  documentUrl?: string | null;
  documentName?: string | null;
  imageUrl?: string | null;
  imageType?: string | null;
}): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_mensaje_send", {
    p_chat_id: params.chatId,
    p_texto: params.texto,
    p_reply_to_id: params.replyToId ?? null,
    p_audio_url: params.audioUrl ?? null,
    p_document_url: params.documentUrl ?? null,
    p_document_name: params.documentName ?? null,
    p_image_url: params.imageUrl ?? null,
    p_image_type: params.imageType ?? null,
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

export async function updateChatFotoEndpoint(chatId: string, foto: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_chat_update_foto", {
    p_chat_id: chatId,
    p_foto: foto,
  });
  if (error) throw error;
}

export async function addChatMemberEndpoint(chatId: string, userId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_chat_add_member", {
    p_chat_id: chatId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function editMensajeEndpoint(mensajeId: number, texto: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_mensaje_edit", {
    p_mensaje_id: mensajeId,
    p_texto: texto,
  });
  if (error) throw error;
}

export async function deleteMensajeEndpoint(mensajeId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_mensaje_delete", {
    p_mensaje_id: mensajeId,
  });
  if (error) throw error;
}

export async function reactMensajeEndpoint(mensajeId: number, emoji: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_mensaje_react", {
    p_mensaje_id: mensajeId,
    p_emoji: emoji,
  });
  if (error) throw error;
}

export async function getMyReaccionesEndpoint(
  chatId: string
): Promise<Array<{ mensaje_id: number; emoji: string }>> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_mis_reacciones", {
    p_chat_id: chatId,
  });
  if (error) throw error;
  return (data ?? []) as Array<{ mensaje_id: number; emoji: string }>;
}

export async function pollVoteEndpoint(mensajeId: number, optionIndex: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_poll_vote", {
    p_mensaje_id: mensajeId,
    p_option_index: optionIndex,
  });
  if (error) throw error;
}

export async function pollGetVotesEndpoint(
  mensajeId: number
): Promise<Array<{ option_index: number; vote_count: number; voted_by_me: boolean }>> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_poll_get_votes", {
    p_mensaje_id: mensajeId,
  });
  if (error) throw error;
  return (data ?? []) as Array<{ option_index: number; vote_count: number; voted_by_me: boolean }>;
}
