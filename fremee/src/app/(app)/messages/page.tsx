"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import { useCallContext } from "@/providers/CallProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import {
  listChats,
  getOrCreateDirectoChat,
  createGrupoChat,
  resolveChatName,
  resolveChatAvatar,
  formatChatTime,
  type ChatListItem,
  type MensajeRow,
} from "@/services/api/repositories/chat.repository";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";
import { createGrupoEndpoint } from "@/services/api/endpoints/grupos.endpoint";
import { ChatConversation, BackIcon, GroupIcon, ComposeIcon } from "@/components/chat/ChatConversation";

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const { startCall, joinCall, callState } = useCallContext();
  const prevCallStatusRef = useRef(callState.status);
  const reloadCallMessagesRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const wasInCall = prevCallStatusRef.current !== "idle";
    prevCallStatusRef.current = callState.status;
    if (wasInCall && callState.status === "idle") {
      setTimeout(() => { reloadCallMessagesRef.current?.(); }, 1000);
    }
  }, [callState.status]);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const feedSupabaseRef = useRef(createBrowserSupabaseClient());

  // Nueva conversación
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friends, setFriends] = useState<PublicUserProfileRow[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  // Crear grupo
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);

  const openFriendPicker = async () => {
    setShowFriendPicker(true);
    setShowGroupCreator(false);
    setGroupName("");
    setSelectedMemberIds(new Set());
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

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreateGroup = async () => {
    const nombre = groupName.trim();
    if (!nombre || selectedMemberIds.size === 0 || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const miembros = Array.from(selectedMemberIds);

      // Crear chat de grupo y registro social en paralelo
      const [chatId] = await Promise.all([
        createGrupoChat({ nombre, miembros }),
        createGrupoEndpoint({ nombre, miembros }),
      ]);

      setShowFriendPicker(false);
      setShowGroupCreator(false);
      setGroupName("");
      setSelectedMemberIds(new Set());
      await loadChats();
      setSelectedChatId(chatId);
    } catch (e) {
      console.error("[messages] Error creando grupo:", e);
    } finally {
      setCreatingGroup(false);
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

  // Detectar cuando el usuario es añadido a un nuevo chat
  useEffect(() => {
    if (!user) return;
    const supabase = feedSupabaseRef.current;
    const ch = supabase
      .channel(`user-join:${user.id}`)
      .on("broadcast", { event: "chat_added" }, () => {
        void loadChats();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
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
        <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-6)] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
          <div className="mx-auto w-full max-w-[760px]">
            {selectedChat && user ? (
              <ChatConversation
                chat={selectedChat}
                currentUserId={user.id}
                onBack={() => { setSelectedChatId(null); void loadChats(); }}
                onStartCall={(tipo) => {
                  const nombre = resolveChatName(selectedChat, user.id);
                  const foto = resolveChatAvatar(selectedChat, user.id) ?? undefined;
                  const miembros = selectedChat.miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));
                  void startCall(String(selectedChat.chat_id), tipo, nombre, foto, miembros);
                }}
                onJoinCall={(llamadaId, roomName, tipo) => {
                  const nombre = resolveChatName(selectedChat, user.id);
                  const foto = resolveChatAvatar(selectedChat, user.id) ?? undefined;
                  const miembros = selectedChat.miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));
                  void joinCall(llamadaId, roomName, String(selectedChat.chat_id), tipo, nombre, foto, miembros);
                }}
                inCall={callState.status !== "idle"}
                onNewMessage={(msg) => {
                  const preview = msg.audio_url ? "🎤 Nota de voz" : msg.document_url ? `📄 ${msg.document_name ?? "Documento"}` : msg.image_url ? (msg.image_type?.startsWith("video/") ? "🎥 Vídeo" : "📷 Foto") : (() => { try { return JSON.parse(msg.texto)?.type === "poll" ? "📊 Encuesta" : msg.texto; } catch { return msg.texto; } })();
                  setChats((prev) => prev.map((c) =>
                    c.chat_id !== selectedChatId ? c : { ...c, last_message: preview, last_message_at: msg.created_at }
                  ));
                }}
                onFotoUpdated={(foto) => {
                  setChats((prev) => prev.map((c) =>
                    c.chat_id !== selectedChatId ? c : { ...c, foto }
                  ));
                }}
                registerCallReload={(fn) => { reloadCallMessagesRef.current = fn; }}
              />
            ) : showFriendPicker ? (
              <>
                {/* Header */}
                <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)]">
                  <button
                    type="button"
                    onClick={() => {
                      if (showGroupCreator) setShowGroupCreator(false);
                      else setShowFriendPicker(false);
                    }}
                    className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface"
                    aria-label="Volver"
                  >
                    <BackIcon className="size-[18px]" />
                  </button>
                  <p className="text-body-sm font-[var(--fw-semibold)] text-app">
                    {showGroupCreator ? "Nuevo grupo" : "Nueva conversación"}
                  </p>
                </div>

                {friendsLoading ? (
                  <div className="py-[var(--space-8)] text-center text-body-sm text-muted">Cargando amigos...</div>
                ) : showGroupCreator ? (
                  /* ── Creador de grupo ── */
                  <div className="space-y-[var(--space-4)]">
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Nombre del grupo"
                      className="w-full rounded-card border border-app bg-surface px-4 py-[10px] text-body-sm text-app outline-none transition-colors focus:border-[var(--border-strong)]"
                      autoFocus
                    />
                    <p className="px-1 text-[11px] font-[var(--fw-semibold)] uppercase tracking-wide text-muted">Añadir miembros</p>
                    {friends.length === 0 ? (
                      <p className="py-[var(--space-4)] text-center text-body-sm text-muted">No tienes amigos aún</p>
                    ) : (
                      <div className="space-y-[1px]">
                        {friends.map((friend) => {
                          const avatarLabel = (friend.nombre.trim()[0] || "U").toUpperCase();
                          const selected = selectedMemberIds.has(friend.id);
                          return (
                            <button
                              key={friend.id}
                              type="button"
                              onClick={() => toggleMember(friend.id)}
                              className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface"
                            >
                              <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                                {friend.profile_image ? (
                                  <img src={friend.profile_image} alt={friend.nombre} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                ) : avatarLabel}
                              </div>
                              <p className="min-w-0 flex-1 truncate text-body-sm font-[var(--fw-medium)] text-app">{friend.nombre}</p>
                              <div className={`flex size-[20px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${selected ? "border-[var(--text-primary)] bg-[var(--text-primary)]" : "border-app"}`}>
                                {selected && (
                                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[12px] text-contrast-token">
                                    <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleCreateGroup()}
                      disabled={!groupName.trim() || selectedMemberIds.size === 0 || creatingGroup}
                      className="w-full rounded-full bg-[var(--text-primary)] py-[10px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      {creatingGroup ? "Creando..." : `Crear grupo${selectedMemberIds.size > 0 ? ` (${selectedMemberIds.size})` : ""}`}
                    </button>
                  </div>
                ) : friends.length === 0 ? (
                  <div className="py-[var(--space-8)] text-center text-body-sm text-muted">No tienes amigos aún</div>
                ) : (
                  /* ── Lista: crear grupo + amigos ── */
                  <div className="space-y-[1px]">
                    <button
                      type="button"
                      onClick={() => setShowGroupCreator(true)}
                      className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface"
                    >
                      <div className="avatar-md flex shrink-0 items-center justify-center rounded-full border border-app bg-surface-inset">
                        <GroupIcon className="size-[16px] text-muted" />
                      </div>
                      <p className="text-body-sm font-[var(--fw-medium)] text-app">Crear grupo</p>
                    </button>
                    <div className="px-2 py-[var(--space-1)]"><div className="border-t border-app" /></div>
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
                              {(() => { const m = chat.last_message ?? ""; try { return JSON.parse(m)?.type === "poll" ? "📊 Encuesta" : m; } catch { return m; } })()}
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
