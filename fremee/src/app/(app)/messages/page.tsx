"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client"; // usado en ChatConversation
import {
  listChats,
  getOrCreateDirectoChat,
  listMensajes,
  sendMensaje,
  markChatRead,
  resolveChatName,
  resolveChatAvatar,
  formatChatTime,
  type ChatListItem,
  type MensajeRow,
} from "@/services/api/repositories/chat.repository";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");

  // Nueva conversación
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friends, setFriends] = useState<PublicUserProfileRow[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  const openFriendPicker = async () => {
    setShowFriendPicker(true);
    setFriendsLoading(true);
    try {
      const data = await fetchActiveFriends();
      setFriends(data);
    } catch (e) {
      console.error("[messages] Error cargando amigos:", e);
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleStartChat = async (friendId: string) => {
    if (startingChatWith) return;
    setStartingChatWith(friendId);
    try {
      const chatId = await getOrCreateDirectoChat(friendId);
      setShowFriendPicker(false);
      await loadChats();
      setSelectedChatId(chatId);
    } catch (e) {
      console.error("[messages] Error iniciando chat:", e);
    } finally {
      setStartingChatWith(null);
    }
  };

  const loadChats = useCallback(async () => {
    try {
      const data = await listChats();
      setChats(data);
    } catch (e) {
      console.error("[messages] Error cargando chats:", e);
    } finally {
      setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadChats();
  }, [user, loadChats]);

  if (loading) return <LoadingScreen />;

  const selectedChat = chats.find((c) => c.chat_id === selectedChatId) ?? null;
  const trimmedSearch = searchValue.trim().toLowerCase();
  const filteredChats = trimmedSearch
    ? chats.filter((c) => {
        const name = resolveChatName(c, user?.id ?? "").toLowerCase();
        return name.includes(trimmedSearch) || (c.last_message ?? "").toLowerCase().includes(trimmedSearch);
      })
    : chats;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />
        <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
          <div className="mx-auto w-full max-w-[760px]">
            {selectedChat && user ? (
              <ChatConversation
                chat={selectedChat}
                currentUserId={user.id}
                onBack={() => { setSelectedChatId(null); void loadChats(); }}
              />
            ) : showFriendPicker ? (
              <>
                <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)]">
                  <button type="button" onClick={() => setShowFriendPicker(false)} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface" aria-label="Volver">
                    <BackIcon className="size-[18px]" />
                  </button>
                  <p className="text-body-sm font-[var(--fw-semibold)] text-app">Nueva conversación</p>
                </div>
                {friendsLoading ? (
                  <div className="py-[var(--space-8)] text-center text-body-sm text-muted">Cargando amigos...</div>
                ) : friends.length === 0 ? (
                  <div className="py-[var(--space-8)] text-center text-body-sm text-muted">No tienes amigos aún</div>
                ) : (
                  <div className="space-y-[1px]">
                    {friends.map((friend) => {
                      const avatarLabel = (friend.nombre.trim()[0] || "U").toUpperCase();
                      const isStarting = startingChatWith === friend.id;
                      return (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => void handleStartChat(friend.id)}
                          disabled={!!startingChatWith}
                          className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface disabled:opacity-50"
                        >
                          <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                            {friend.profile_image ? (
                              <img src={friend.profile_image} alt={friend.nombre} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : avatarLabel}
                          </div>
                          <p className="min-w-0 flex-1 truncate text-body-sm font-[var(--fw-medium)] text-app">{friend.nombre}</p>
                          {isStarting && <span className="shrink-0 text-[11px] text-muted">...</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)]">
                  <div className="relative flex-1">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-[16px] -translate-y-1/2 text-muted">
                      <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <input
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder="Buscar"
                      className="w-full rounded-full border border-app bg-surface py-[7px] pl-9 pr-8 text-body-sm text-app outline-none transition-colors focus:border-[var(--border-strong)] [&::-webkit-search-cancel-button]:hidden"
                    />
                    {searchValue && (
                      <button type="button" onClick={() => setSearchValue("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[14px]">
                          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void openFriendPicker()}
                    className="flex size-[36px] shrink-0 items-center justify-center rounded-full border border-app transition-colors hover:bg-surface"
                    aria-label="Nueva conversación"
                  >
                    <ComposeIcon className="size-[16px]" />
                  </button>
                </div>

                {chatsLoading ? (
                  <div className="py-[var(--space-8)] text-center text-body-sm text-muted">Cargando...</div>
                ) : filteredChats.length === 0 ? (
                  <div className="py-[var(--space-8)] text-center text-body-sm text-muted">No tienes conversaciones aún</div>
                ) : (
                  <div className="space-y-[1px]">
                    {filteredChats.map((chat) => {
                      const name = resolveChatName(chat, user?.id ?? "");
                      const avatar = resolveChatAvatar(chat, user?.id ?? "");
                      const hasUnread = chat.unread_count > 0;
                      return (
                        <button
                          key={chat.chat_id}
                          type="button"
                          onClick={() => setSelectedChatId(chat.chat_id)}
                          className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface"
                        >
                          <div className="relative shrink-0">
                            <div className="avatar-md flex items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                              {avatar ? (
                                <img src={avatar} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              ) : chat.tipo === "GRUPO" ? (
                                <GroupIcon className="size-[16px] text-muted" />
                              ) : (
                                (name[0] ?? "?").toUpperCase()
                              )}
                            </div>
                            {hasUnread && (
                              <span className="absolute -right-[2px] -top-[2px] size-[10px] rounded-full border-2 border-[var(--bg)] bg-[#ff6a3d]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-body-sm ${hasUnread ? "font-[var(--fw-semibold)]" : ""} text-app`}>{name}</p>
                            <p className={`truncate text-[12px] leading-[16px] ${hasUnread ? "font-[var(--fw-medium)] text-app" : "text-muted"}`}>
                              {chat.last_message ?? ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-[11px] text-muted">{formatChatTime(chat.last_message_at)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ChatConversation({
  chat,
  currentUserId,
  onBack,
}: {
  chat: ChatListItem;
  currentUserId: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<MensajeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const supabaseRef = useRef(createBrowserSupabaseClient());
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);

  const name = resolveChatName(chat, currentUserId);
  const avatar = resolveChatAvatar(chat, currentUserId);

  // Cargar mensajes iniciales
  useEffect(() => {
    void (async () => {
      try {
        const data = await listMensajes({ chatId: chat.chat_id });
        setMessages(data);
      } catch (e) {
        console.error("[chat] Error cargando mensajes:", e);
      } finally {
        setLoading(false);
      }
    })();

    void markChatRead(chat.chat_id);
  }, [chat.chat_id]);

  // Realtime — Broadcast: el emisor publica, todos los suscriptores reciben al instante
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`chat:${chat.chat_id}`)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload as MensajeRow;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        void markChatRead(chat.chat_id);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [chat.chat_id]);

  // Scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText("");
    setSending(true);
    try {
      const newId = await sendMensaje({ chatId: chat.chat_id, texto: trimmed });
      const me = chat.miembros.find((m) => m.id === currentUserId);
      const newMsg: MensajeRow = {
        id: newId,
        sender_id: currentUserId,
        sender_nombre: me?.nombre ?? "",
        sender_profile_image: me?.profile_image ?? null,
        texto: trimmed,
        created_at: new Date().toISOString(),
      };

      // Publicar al canal para que el receptor lo reciba al instante
      void channelRef.current?.send({
        type: "broadcast",
        event: "new_message",
        payload: newMsg,
      });

      // Añadir al estado local del emisor
      setMessages((prev) => {
        if (prev.some((m) => m.id === newId)) return prev;
        return [...prev, newMsg];
      });
    } catch (e) {
      console.error("[chat] Error enviando mensaje:", e);
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void onSend(); }
  };

  return (
    <div className="flex h-[calc(100dvh-var(--space-20)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-var(--space-16))]">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)] border-b border-app pb-[var(--space-3)]">
        <button type="button" onClick={onBack} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface" aria-label="Volver">
          <BackIcon className="size-[18px]" />
        </button>
        <div className="avatar-md flex items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
          {avatar ? (
            <img src={avatar} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : chat.tipo === "GRUPO" ? (
            <GroupIcon className="size-[16px] text-muted" />
          ) : (
            (name[0] ?? "?").toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{name}</p>
          {chat.tipo === "GRUPO" && <p className="text-[11px] text-muted">{chat.miembros.length} miembros</p>}
        </div>
      </div>

      {/* Mensajes */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto py-[var(--space-4)]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-body-sm text-muted">Cargando...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-body-sm text-muted">Sé el primero en escribir</div>
        ) : (
          <div className="space-y-[1px]">
            {messages.map((msg, idx) => {
              const isMe = msg.sender_id === currentUserId;
              const prevMsg = messages[idx - 1];
              const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
              const time = formatChatTime(msg.created_at);

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-[var(--space-3)]" : "mt-[2px]"}`}>
                  {!isMe && chat.tipo === "GRUPO" && (
                    <div className="mr-[var(--space-2)] w-[24px] shrink-0">
                      {isFirstInGroup && (
                        <div className="flex size-[24px] items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-[10px] font-[var(--fw-semibold)] text-app">
                          {msg.sender_profile_image ? (
                            <img src={msg.sender_profile_image} alt={msg.sender_nombre} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            (msg.sender_nombre[0] ?? "?").toUpperCase()
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-[16px] px-3 py-2 ${isMe ? "bg-[var(--text-primary)] text-contrast-token" : "bg-surface-inset"}`}>
                    {!isMe && chat.tipo === "GRUPO" && isFirstInGroup && (
                      <p className="mb-[2px] text-[11px] font-[var(--fw-semibold)] text-muted">{msg.sender_nombre}</p>
                    )}
                    <p className="text-body-sm">{msg.texto}</p>
                    <p className={`mt-[2px] text-right text-[10px] ${isMe ? "text-contrast-token/60" : "text-muted"}`}>{time}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-[var(--space-2)] border-t border-app pt-[var(--space-3)]">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe un mensaje..."
          className="min-w-0 flex-1 rounded-full border border-app bg-surface px-4 py-[8px] text-body-sm text-app outline-none transition-colors focus:border-[var(--border-strong)]"
        />
        <button
          type="button"
          onClick={() => void onSend()}
          disabled={!text.trim() || sending}
          className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-30"
          aria-label="Enviar"
        >
          <SendMsgIcon className="size-[16px]" />
        </button>
      </div>
    </div>
  );
}

function ComposeIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L12 14l-4 1 1-4 7.5-7.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GroupIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 19c1-3 3.5-4.5 7-4.5s6 1.5 7 4.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M18.5 14.5c1.5.8 2.8 2 3.5 4.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function SendMsgIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
