/**
 * Which chat is open on screen right now (null if none). The app-wide notification listener uses it
 * not to show «Ana ha lanzado un sorteo · Ver» to someone who is already watching that chat.
 */
let openChatId: string | null = null;

export function setOpenChat(chatId: string | null): void {
  openChatId = chatId;
}

export function getOpenChat(): string | null {
  return openChatId;
}
