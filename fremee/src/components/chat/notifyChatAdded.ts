import { createBrowserSupabaseClient } from "@/services/supabase/client";

/**
 * Tells each person their chat list changed: Messages listens on `user-join:<id>` and reloads.
 * Used when someone is added to a chat and when a new 1 a 1 chat or group is created.
 */
export function notifyChatAdded(userIds: string[], chatId: string) {
  const supabase = createBrowserSupabaseClient();
  for (const uid of userIds) {
    const ch = supabase.channel(`user-join:${uid}`);
    ch.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      void ch.send({ type: "broadcast", event: "chat_added", payload: { chat_id: chatId } });
      setTimeout(() => void supabase.removeChannel(ch), 2000);
    });
  }
}
