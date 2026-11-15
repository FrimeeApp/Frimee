import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type ChatListItem = {
  chat_id: string;
  tipo: "DIRECTO" | "GRUPO" | "PLAN";
  nombre: string | null;
  foto: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  miembros: Array<{ id: string; nombre: string; username: string | null; profile_image: string | null }>;
  /** Set for a plan's chat (fn_chats_list joins its plan). */
  plan_id?: number | null;
  plan_titulo?: string | null;
  plan_inicio_at?: string | null;
  plan_fin_at?: string | null;
  plan_ubicacion?: string | null;
  plan_foto?: string | null;
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
  tipo?: string | null;
};

export type ChatMiembro = {
  user_id: string;
  nombre: string;
  username: string | null;
  profile_image: string | null;
  joined_at: string;
};

export async function listChatsEndpoint(): Promise<ChatListItem[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chats_list");
  if (error) throw error;
  // Plan chats are listed too (with their trip); a plan's chat whose plan is gone is not.
  return ((data ?? []) as ChatListItem[]).filter((c) => c.tipo !== "PLAN" || c.plan_id != null);
}

export async function fetchPlanChatItem(planId: number): Promise<ChatListItem | null> {
  const supabase = createBrowserSupabaseClient();
  const { data: chatId } = await supabase.rpc("fn_get_or_create_plan_chat", { p_plan_id: planId });
  if (!chatId) return null;
  const { data } = await supabase.rpc("fn_chats_list");
  if (!data) return null;
  return ((data as ChatListItem[]).find((c) => c.chat_id === chatId)) ?? null;
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
  const base = { p_chat_id: params.chatId, p_limit: params.limit ?? 30 };
  const rpcParams = params.cursorId != null ? { ...base, p_cursor_id: params.cursorId } : base;
  const { data, error } = await supabase.rpc("fn_mensajes_list", rpcParams);
  if (error) throw new Error(error.message || error.code || "Error cargando mensajes");
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

export async function sendBotMensajeEndpoint(chatId: string, texto: string): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_bot_message_insert", {
    p_chat_id: chatId,
    p_texto: texto,
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

export async function closePollEndpoint(mensajeId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_poll_close", { p_mensaje_id: mensajeId });
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

// ── Bitácora, phase 2: pin, star, everyone's reactions, @frimee proposals ────────────────────

export type ReaccionResumen = { mensaje_id: number; emoji: string; total: number; mia: boolean };

export async function getReaccionesEndpoint(chatId: string): Promise<ReaccionResumen[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_reacciones", { p_chat_id: chatId });
  if (error) throw error;
  return ((data ?? []) as Array<{ mensaje_id: number; emoji: string; total: number | string; mia: boolean }>)
    .map((r) => ({ ...r, total: Number(r.total) }));
}

/** mensajeId null unpins. */
export async function pinMensajeEndpoint(chatId: string, mensajeId: number | null): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_chat_pin", { p_chat_id: chatId, p_mensaje_id: mensajeId });
  if (error) throw error;
}

export async function getPinnedEndpoint(chatId: string): Promise<number | null> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_pinned", { p_chat_id: chatId });
  if (error) throw error;
  const row = (data as Array<{ mensaje_id: number }> | null)?.[0];
  return row?.mensaje_id ?? null;
}

/** Toggles the star; returns the new state. */
export async function destacarMensajeEndpoint(mensajeId: number): Promise<boolean> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_mensaje_destacar", { p_mensaje_id: mensajeId });
  if (error) throw error;
  return Boolean(data);
}

export async function getMisDestacadosEndpoint(chatId: string): Promise<number[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_mis_destacados", { p_chat_id: chatId });
  if (error) throw error;
  return ((data ?? []) as Array<{ mensaje_id: number }>).map((r) => r.mensaje_id);
}

/** Claims a pending proposal (true) or finds it already resolved by someone else (false). */
export async function resolverPropuestaEndpoint(
  mensajeId: number,
  estado: "aceptada" | "descartada" | "pendiente",
  resultado?: string,
): Promise<boolean> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_propuesta_resolver", {
    p_mensaje_id: mensajeId,
    p_estado: estado,
    p_resultado: resultado ?? null,
  });
  if (error) throw error;
  return Boolean(data);
}

/** The light index of a chat for the ruler (fn_chat_indice): positions are the order among all messages. */
export type ChatIndice = {
  total: number;
  /** Last message in the index: anything newer arrived later (realtime) and is added on the client. */
  max_id: number | null;
  dias: Array<{ dia: string; primer_id: number; desde: number; n: number }>;
  hitos: Array<{ id: number; ord: number; created_at: string; tipo: "poll" | "propuesta"; titulo: string | null; estado: "decidido" | "abierto" }>;
  primer_no_leido: { id: number; ord: number } | null;
};

export async function getChatIndiceEndpoint(chatId: string): Promise<ChatIndice> {
  const supabase = createBrowserSupabaseClient();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await supabase.rpc("fn_chat_indice", { p_chat_id: chatId, p_tz: tz });
  if (error) throw new Error(error.message || error.code || "Error leyendo el índice del chat");
  return data as ChatIndice;
}

/** The messages around one (a jump to an old milestone), oldest first, each with its position. */
export async function listMensajesTramoEndpoint(chatId: string, mensajeId: number, antes = 25, despues = 25): Promise<Array<MensajeRow & { orden: number }>> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_mensajes_tramo", { p_chat_id: chatId, p_mensaje_id: mensajeId, p_antes: antes, p_despues: despues });
  if (error) throw new Error(error.message || error.code || "Error cargando el tramo del chat");
  return (data ?? []) as Array<MensajeRow & { orden: number }>;
}

/** Newer messages after a cursor, oldest first (scrolling down from an old stretch). */
export async function listMensajesDespuesEndpoint(chatId: string, cursorId: number, limit = 50): Promise<MensajeRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_mensajes_list_despues", { p_chat_id: chatId, p_cursor_id: cursorId, p_limit: limit });
  if (error) throw new Error(error.message || error.code || "Error cargando mensajes");
  return (data ?? []) as MensajeRow[];
}

/** How far the other members of a chat have read (fn_chat_lecturas): for the «visto» checks. */
export async function getChatLecturasEndpoint(chatId: string): Promise<Array<{ user_id: string; last_read_at: string | null }>> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_lecturas", { p_chat_id: chatId });
  if (error) throw new Error(error.message || error.code || "Error leyendo las lecturas del chat");
  return (data ?? []) as Array<{ user_id: string; last_read_at: string | null }>;
}

/** What @frimee saw in a message (mensaje_sugerencias): an activity for the plan and/or an expense. */
export type Sugerencia = {
  mensaje_id: number;
  plan: { es_plan: boolean; titulo?: string; fecha?: string; hora?: string; lugar?: string; tipo?: string };
  gasto: { es_gasto: boolean; concepto?: string; importe?: number };
};

/**
 * Suggestions for some messages: the stored ones are read directly (RLS: members); only the missing
 * ones go to the chat-sugerencias function, which asks Claude and stores them for everybody.
 */
export async function getSugerenciasEndpoint(chatId: string, ids: number[], onAskingAI?: (ids: number[]) => void): Promise<Sugerencia[]> {
  if (ids.length === 0) return [];
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("mensaje_sugerencias").select("mensaje_id, plan, gasto").in("mensaje_id", ids);
  if (error) throw new Error(error.message || "Error leyendo sugerencias");
  const stored = (data ?? []) as Sugerencia[];
  const have = new Set(stored.map((r) => r.mensaje_id));
  const missing = ids.filter((id) => !have.has(id)).slice(0, 60);
  if (missing.length === 0) return stored;
  // Only now the model is involved (seconds, more on a cold start): let the chat say so.
  onAskingAI?.(missing);
  const { data: fn, error: fnError } = await supabase.functions.invoke("chat-sugerencias", { body: { chat_id: chatId, mensaje_ids: missing } });
  if (fnError) throw new Error(fnError.message || "Error pidiendo sugerencias");
  return [...stored, ...(((fn as { sugerencias?: Sugerencia[] })?.sugerencias) ?? [])];
}

/**
 * An expense AND its message in the chat, in one transaction (fn_chat_registrar_gasto): never one
 * without the other. `clientId` is made when the sheet opens: the same request again (a retry after
 * a dropped connection) returns the first result instead of creating the expense twice.
 */
export async function registrarGastoChatEndpoint(params: {
  clientId: string;
  chatId: string;
  planId: number;
  titulo: string;
  total: number;
  pagadoPor: string;
  participantes: string[];
  /** The message to send instead of the expense card (e.g. @frimee's confirmation text). */
  texto?: string;
}): Promise<{ gasto_id: number; mensaje_id: number; texto: string }> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_registrar_gasto", {
    p_client_id: params.clientId,
    p_chat_id: params.chatId,
    p_plan_id: params.planId,
    p_titulo: params.titulo,
    p_total: params.total,
    p_pagado_por: params.pagadoPor,
    p_participantes: params.participantes,
    p_texto: params.texto ?? null,
  });
  if (error) throw new Error(error.message || error.code || "Error registrando el gasto");
  return data as { gasto_id: number; mensaje_id: number; texto: string };
}

/**
 * Accept a proposal of @frimee AND do what it proposes, in one transaction (fn_propuesta_aceptar).
 * claimed false: someone accepted or dismissed it first (texto is how it is now).
 */
export async function aceptarPropuestaEndpoint(mensajeId: number, resultado?: string | null): Promise<{
  claimed: boolean; texto: string; poll_id: number | null; poll_texto: string | null;
}> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_propuesta_aceptar", { p_mensaje_id: mensajeId, p_resultado: resultado ?? null });
  if (error) throw new Error(error.message || error.code || "Error aceptando la propuesta");
  return data as { claimed: boolean; texto: string; poll_id: number | null; poll_texto: string | null };
}

/**
 * Add an activity to a plan from the chat: the activity AND its mark on the spine, in one
 * transaction (fn_chat_anadir_al_plan). clientId, one per opened panel: never added twice.
 */
export async function anadirAlPlanEndpoint(params: {
  clientId: string;
  chatId: string;
  planId: number;
  titulo: string;
  tipo: string;
  inicio: string;
  fin: string;
  ubicacionNombre?: string;
  lat?: number | null;
  lng?: number | null;
  origenId?: number | null;
}): Promise<{ subplan_id: number; mensaje_id: number; texto: string }> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_anadir_al_plan", {
    p_client_id: params.clientId,
    p_chat_id: params.chatId,
    p_plan_id: params.planId,
    p_titulo: params.titulo,
    p_tipo: params.tipo,
    p_inicio: params.inicio,
    p_fin: params.fin,
    p_ubicacion_nombre: params.ubicacionNombre ?? "",
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_origen_id: params.origenId ?? null,
  });
  if (error) throw new Error(error.message || error.code || "Error añadiendo al plan");
  return data as { subplan_id: number; mensaje_id: number; texto: string };
}

/** «Deshacer» right after adding: removes the activity and its mark (only who added it, minutes after). */
export async function deshacerAnadirEndpoint(mensajeId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_chat_deshacer_anadir", { p_mensaje_id: mensajeId });
  if (error) throw new Error(error.message || error.code || "Error deshaciendo");
}
