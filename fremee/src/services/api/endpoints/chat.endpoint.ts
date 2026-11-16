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
  /** Silenced by me (fn_chats_list, 2.29). */
  silenciado?: boolean;
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

export type MensajeEncontrado = {
  mensaje_id: number;
  chat_id: string;
  texto: string;
  created_at: string;
  sender_id: string | null;
  sender_nombre: string | null;
};

/** The «Mensajes» block of the Messages search: text written by people in my chats (2+ letters). */
export async function buscarMensajesEndpoint(query: string, limit = 20): Promise<MensajeEncontrado[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_buscar_mensajes", { p_q: query, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as MensajeEncontrado[];
}

/** «Amigos con los que hablar»: friends without a 1 a 1 chat, those I share most plans/groups with first. */
export async function amigosSugeridosEndpoint(limit = 5): Promise<Array<{ id: string; nombre: string; username: string | null; profile_image: string | null }>> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_amigos_sugeridos", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; nombre: string; username: string | null; profile_image: string | null }>;
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
  /** Bytes of a document («184 KB» in «En el chat → Archivos»). */
  documentSize?: number | null;
}): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_mensaje_send", {
    // Only when there is one: the named argument has to exist in the database (migration 0007).
    ...(params.documentSize ? { p_document_size: params.documentSize } : {}),
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

/**
 * A notice the database wrote in the chat (renamed, added, removed, left): `mensajes` has no realtime,
 * so whoever did it shares it by broadcast. Null when nothing changed.
 */
export type ChatNotice = { mensaje_id: number; texto: string } | null;

export async function leaveChatEndpoint(chatId: string): Promise<ChatNotice> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_leave", { p_chat_id: chatId });
  if (error) throw error;
  return (data ?? null) as ChatNotice;
}

export async function updateChatFotoEndpoint(chatId: string, foto: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_chat_update_foto", {
    p_chat_id: chatId,
    p_foto: foto,
  });
  if (error) throw error;
}

export async function addChatMemberEndpoint(chatId: string, userId: string): Promise<ChatNotice> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_add_miembro", {
    p_chat_id: chatId,
    p_user_id: userId,
  });
  if (error) throw error;
  return (data ?? null) as ChatNotice;
}

/** What closing or deciding a poll leaves: the poll's new texto and the hidden «poll_cerrada». */
export type PollCierre = { poll_texto: string; aviso_id?: number; aviso_texto?: string; ya_cerrada?: boolean };

export async function closePollEndpoint(mensajeId: number): Promise<PollCierre> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_poll_close", { p_mensaje_id: mensajeId });
  if (error) throw error;
  return data as PollCierre;
}

export async function pollDecidirEndpoint(mensajeId: number, optionIndex: number): Promise<PollCierre> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_poll_decidir", { p_mensaje_id: mensajeId, p_option_index: optionIndex });
  if (error) throw error;
  return data as PollCierre;
}

/** «Reabrir para…» a tie while people are missing: votes kept, they get a notification. */
export async function pollReabrirEndpoint(mensajeId: number): Promise<PollCierre> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_poll_reabrir", { p_mensaje_id: mensajeId });
  if (error) throw error;
  return data as PollCierre;
}

/** «Sortear» a tie once everybody voted: the server draws, once, for everybody. */
export async function pollSortearEndpoint(mensajeId: number): Promise<PollCierre> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_poll_sortear", { p_mensaje_id: mensajeId });
  if (error) throw error;
  return data as PollCierre;
}

/** «Desempatar»: the new poll (or the one that already existed) and the tied poll's new texto. */
export type PollDesempate = { mensaje_id: number; texto: string; poll_texto: string; ya_existia: boolean };

export async function pollDesempatarEndpoint(mensajeId: number): Promise<PollDesempate> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_poll_desempatar", { p_mensaje_id: mensajeId });
  if (error) throw error;
  return data as PollDesempate;
}

export type PollVoto = { user_id: string; nombre: string; option_index: number };

export async function pollVotosEndpoint(mensajeId: number): Promise<PollVoto[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_poll_votos", { p_mensaje_id: mensajeId });
  if (error) throw error;
  return (data ?? []) as PollVoto[];
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

/** Voting can close the poll (everybody voted): then it brings what closing leaves. */
export type PollVoteResult = { cerrada: boolean } & Partial<PollCierre>;

export async function pollVoteEndpoint(mensajeId: number, optionIndex: number): Promise<PollVoteResult> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_poll_vote", {
    p_mensaje_id: mensajeId,
    p_option_index: optionIndex,
  });
  if (error) throw error;
  return (data ?? { cerrada: false }) as PollVoteResult;
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

export type PlanCompletado = { titulo: string; fecha: string; hora: string; hora_fin: string; lugar: string; tipo: string };

/**
 * «Añadir al plan» opened on a message: @frimee reads it again with the conversation around it
 * (chat-sugerencias, `completar`), so a time in one message and the place in the next end up
 * together, and a debated time takes the last agreed one (or stays empty). Null: nothing found.
 */
export async function completarSugerenciaEndpoint(chatId: string, mensajeId: number): Promise<PlanCompletado | null> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("chat-sugerencias", { body: { chat_id: chatId, completar: mensajeId } });
  if (error) throw new Error(error.message || "Error leyendo la conversación");
  return ((data as { plan?: PlanCompletado | null })?.plan) ?? null;
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

/** How many messages a plan made from this chat would start with (all, or from one message). */
export async function copiaRecuentoEndpoint(chatId: string, desdeId: number | null = null): Promise<{ total: number; desde_at: string | null; primer_id: number | null }> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_copia_recuento", { p_chat_id: chatId, p_desde_id: desdeId });
  if (error) throw new Error(error.message || error.code || "Error contando mensajes");
  return data as { total: number; desde_at: string | null; primer_id: number | null };
}

/**
 * Creates a plan from this chat: the plan, its chat (starting with a copy of this conversation), its
 * members and the «Plan creado» mark in both chats, in one transaction. Same clientId twice → same plan.
 */
export async function planDesdeChatEndpoint(params: {
  clientId: string;
  chatId: string;
  titulo: string;
  inicioAt: string;
  finAt: string;
  ubicacion: string;
  miembros: string[];
  desdeId: number | null;
  /** false: «Nada, empezar de cero» (the plan's chat starts empty). */
  copiar?: boolean;
  /** The message whose diamond opened the sheet: it loses its diamond for everyone. */
  origenId?: number | null;
}): Promise<PlanDesdeChatResult> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_desde_chat", {
    p_client_id: params.clientId,
    p_chat_id: params.chatId,
    p_titulo: params.titulo,
    p_inicio_at: params.inicioAt,
    p_fin_at: params.finAt,
    p_ubicacion: params.ubicacion,
    p_miembros: params.miembros,
    p_desde_id: params.desdeId,
    p_copiar: params.copiar ?? true,
    p_origen_id: params.origenId ?? null,
  });
  if (error) throw new Error(error.message || error.code || "Error creando el plan");
  return data as PlanDesdeChatResult;
}

export type PlanDesdeChatResult = {
  plan_id: number;
  chat_id: string;
  copiados: number;
  /** The «Plan creado» mark in the original chat, to send to whoever has it open. */
  hito_id: number;
  hito_texto: string;
  /** Who was added (besides you). */
  miembros: string[];
};

export type PlanNuevoSugerido = { titulo: string; destino: string; fecha_inicio: string; fecha_fin: string; primer_id: number };

/** «Crear plan» from a chat: @frimee reads the latest conversation and suggests name, place and dates. */
export async function sugerirPlanNuevoEndpoint(chatId: string): Promise<PlanNuevoSugerido | null> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("chat-sugerencias", { body: { chat_id: chatId, plan_nuevo: true } });
  if (error) throw new Error(error.message || "Error leyendo la conversación");
  return ((data as { plan?: PlanNuevoSugerido | null })?.plan) ?? null;
}

/**
 * Whether you are in a chat (RLS on chat only returns it to its members). «Ir al chat original» in a
 * plan made from a chat is only shown to who is still in that chat. Remembered per chat.
 */
const veChatCache = new Map<string, Promise<boolean>>();
export function puedoVerChatEndpoint(chatId: string): Promise<boolean> {
  let p = veChatCache.get(chatId);
  if (!p) {
    p = (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.from("chat").select("id").eq("id", chatId).maybeSingle();
      if (error) throw new Error(error.message || "Error comprobando el chat");
      return Boolean(data);
    })();
    // A failure is not remembered: the next mark asks again.
    p.catch(() => veChatCache.delete(chatId));
    veChatCache.set(chatId, p);
  }
  return p;
}

/** «Pedir unirme» on the «Plan creado» mark: the plan's admins get a request. */
export async function pedirUnirmeEndpoint(planId: number, chatId: string): Promise<"ok" | "ya_miembro" | "ya_pedido"> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_pedir_unirme", { p_plan_id: planId, p_chat_id: chatId });
  if (error) throw new Error(error.message || error.code || "Error pidiendo unirse");
  return data as "ok" | "ya_miembro" | "ya_pedido";
}

/** An admin answers a request to join (it goes away for every admin). */
export async function responderSolicitudEndpoint(planId: number, userId: string, aceptar: boolean): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_responder_solicitud", { p_plan_id: planId, p_user_id: userId, p_aceptar: aceptar });
  if (error) throw new Error(error.message || error.code || "Error respondiendo la solicitud");
  return data as string;
}

/* ── Información del chat (tableros gi-*, migración 2.29) ── */

export type ChatInfoPlan = { id: number; titulo: string; inicio_at: string; fin_at: string; soy_miembro?: boolean };
export type ChatInfo = {
  tipo: "DIRECTO" | "GRUPO" | "PLAN";
  silenciado: boolean;
  creador_id: string | null;
  admins: string[];
  /** fotos = photos and videos; archivos = documents. */
  /** destacados: only mine (stars are per person). */
  recuentos: { fotos: number; archivos: number; sitios: number; enlaces: number; decisiones: number; destacados: number };
  /** Plans made from this chat («Planes de este grupo»). */
  planes: ChatInfoPlan[];
  /** 1 a 1: plans you are both in («Planes en común»). */
  comun: ChatInfoPlan[];
  /** 1 a 1: since when you are friends. */
  amigos_desde: string | null;
};

export async function getChatInfoEndpoint(chatId: string): Promise<ChatInfo> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_info", { p_chat_id: chatId });
  if (error) throw error;
  const d = (data ?? {}) as Partial<ChatInfo>;
  return {
    tipo: d.tipo ?? "GRUPO",
    silenciado: Boolean(d.silenciado),
    creador_id: d.creador_id ?? null,
    admins: d.admins ?? [],
    recuentos: { fotos: 0, archivos: 0, sitios: 0, enlaces: 0, decisiones: 0, destacados: 0, ...d.recuentos },
    planes: d.planes ?? [],
    comun: d.comun ?? [],
    amigos_desde: d.amigos_desde ?? null,
  };
}

export async function renombrarChatEndpoint(chatId: string, nombre: string): Promise<ChatNotice> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_renombrar", { p_chat_id: chatId, p_nombre: nombre });
  if (error) throw error;
  return (data ?? null) as ChatNotice;
}

export async function quitarMiembroEndpoint(chatId: string, userId: string): Promise<ChatNotice> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_quitar_miembro", { p_chat_id: chatId, p_user_id: userId });
  if (error) throw error;
  return (data ?? null) as ChatNotice;
}

export async function silenciarChatEndpoint(chatId: string, silenciado: boolean): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_chat_silenciar", { p_chat_id: chatId, p_silenciado: silenciado });
  if (error) throw error;
}

/** «Vaciar el chat»: only for me; the others keep everything. */
export async function vaciarChatEndpoint(chatId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_chat_vaciar", { p_chat_id: chatId });
  if (error) throw error;
}

/** «Eliminar chat» (1 a 1 only): empties it and hides it from my list until a new message arrives. */
export async function eliminarChatEndpoint(chatId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_chat_eliminar", { p_chat_id: chatId });
  if (error) throw error;
}

/** «Eliminar para mí» (paraTodos false) or «Eliminar para todos» (mine, or an admin with anyone's). */
export async function eliminarMensajeEndpoint(mensajeId: number, paraTodos: boolean): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_mensaje_eliminar", { p_mensaje_id: mensajeId, p_para_todos: paraTodos });
  if (error) throw error;
}

export type ContenidoTipo = "fotos" | "archivos" | "sitios" | "enlaces" | "decisiones" | "destacados";
export type ContenidoRow = {
  id: number;
  created_at: string;
  sender_id: string | null;
  sender_nombre: string;
  texto: string;
  image_url: string | null;
  image_type: string | null;
  document_url: string | null;
  document_name: string | null;
  document_size: number | null;
};

/** The lists of «En el chat», newest first, by pages (antesId = the last id of the previous page). */
export async function contenidoChatEndpoint(chatId: string, tipo: ContenidoTipo, antesId: number | null = null, limit = 30): Promise<ContenidoRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_chat_contenido", { p_chat_id: chatId, p_tipo: tipo, p_antes_id: antesId, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as ContenidoRow[];
}
