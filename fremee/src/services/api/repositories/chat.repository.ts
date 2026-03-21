import {
  listChatsEndpoint,
  getOrCreateDirectoChatEndpoint,
  createGrupoChatEndpoint,
  listMensajesEndpoint,
  sendMensajeEndpoint,
  markChatReadEndpoint,
  getChatMiembrosEndpoint,
  leaveChatEndpoint,
  type ChatListItem,
  type MensajeRow,
  type ChatMiembro,
} from "@/services/api/endpoints/chat.endpoint";

export type { ChatListItem, MensajeRow, ChatMiembro };

export async function listChats(): Promise<ChatListItem[]> {
  return listChatsEndpoint();
}

export async function getOrCreateDirectoChat(otherUserId: string): Promise<string> {
  return getOrCreateDirectoChatEndpoint(otherUserId);
}

export async function createGrupoChat(params: {
  nombre: string;
  foto?: string | null;
  miembros: string[];
}): Promise<string> {
  return createGrupoChatEndpoint(params);
}

export async function listMensajes(params: {
  chatId: string;
  limit?: number;
  cursorId?: number | null;
}): Promise<MensajeRow[]> {
  // La función devuelve los más recientes primero — invertimos para mostrar cronológico
  const rows = await listMensajesEndpoint(params);
  return rows.reverse();
}

export async function sendMensaje(params: {
  chatId: string;
  texto: string;
}): Promise<number> {
  return sendMensajeEndpoint(params);
}

export async function markChatRead(chatId: string): Promise<void> {
  return markChatReadEndpoint(chatId);
}

export async function getChatMiembros(chatId: string): Promise<ChatMiembro[]> {
  return getChatMiembrosEndpoint(chatId);
}

export async function leaveChat(chatId: string): Promise<void> {
  return leaveChatEndpoint(chatId);
}

// Devuelve el nombre a mostrar para un chat
// - DIRECTO: nombre del otro usuario
// - GRUPO: nombre del grupo
export function resolveChatName(chat: ChatListItem, currentUserId: string): string {
  if (chat.tipo === "GRUPO") return chat.nombre ?? "Grupo";
  const other = chat.miembros.find((m) => m.id !== currentUserId);
  return other?.nombre ?? "Usuario";
}

export function resolveChatAvatar(chat: ChatListItem, currentUserId: string): string | null {
  if (chat.tipo === "GRUPO") return chat.foto ?? null;
  const other = chat.miembros.find((m) => m.id !== currentUserId);
  return other?.profile_image ?? null;
}

export function formatChatTime(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return date.toLocaleDateString("es-ES", { weekday: "short" });
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
