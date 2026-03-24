"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import { useCallContext } from "@/providers/CallProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client"; // usado en ChatConversation
import {
  listChats,
  getOrCreateDirectoChat,
  createGrupoChat,
  leaveChat,
  updateChatFoto,
  addChatMember,
  editMensaje,
  deleteMensaje,
  listMensajes,
  sendMensaje,
  markChatRead,
  reactMensaje,
  getMyReacciones,
  pollVote,
  pollGetVotes,
  resolveChatName,
  resolveChatAvatar,
  formatChatTime,
  type ChatListItem,
  type MensajeRow,
} from "@/services/api/repositories/chat.repository";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";
import { createGrupoEndpoint } from "@/services/api/endpoints/grupos.endpoint";
import { uploadPlanCoverFile, uploadAudioBlob, uploadAudioFile, uploadDocumentFile, uploadMediaFile } from "@/services/firebase/upload";
import AudioPlayer from "@/components/common/AudioPlayer";

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
        <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
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

function ChatConversation({
  chat,
  currentUserId,
  onBack,
  onNewMessage,
  onStartCall,
  onJoinCall,
  inCall,
  onFotoUpdated,
  registerCallReload,
}: {
  chat: ChatListItem;
  currentUserId: string;
  onBack: () => void;
  onNewMessage: (msg: MensajeRow) => void;
  onStartCall?: (tipo: "audio" | "video") => void;
  onJoinCall?: (llamadaId: number, roomName: string, tipo: "audio" | "video") => void;
  inCall?: boolean;
  onFotoUpdated?: (foto: string) => void;
  registerCallReload?: (fn: () => void) => void;
}) {
  type LocalMsg = MensajeRow & { _key?: number };
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestIdRef = useRef<number | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ msg: MensajeRow; x: number; y: number; triggerTop: number } | null>(null);
  const [replyingTo, setReplyingTo] = useState<MensajeRow | null>(null);
  const [editingMsg, setEditingMsg] = useState<MensajeRow | null>(null);
  const [reactingToId, setReactingToId] = useState<number | null>(null);
  const [reactingPos, setReactingPos] = useState<{ x: number; y: number } | null>(null);
  const [localReactions, setLocalReactions] = useState<Record<number, string>>({});
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MensajeRow | null>(null);
  const [forwardChats, setForwardChats] = useState<ChatListItem[]>([]);
  const [forwardSending, setForwardSending] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const supabaseRef = useRef(createBrowserSupabaseClient());
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onNewMessageRef.current = onNewMessage; });

  const name = resolveChatName(chat, currentUserId);
  const avatar = resolveChatAvatar(chat, currentUserId);

  // Ongoing group call banner
  type OngoingCall = { id: number; room_name: string; tipo: "audio" | "video" };
  const [ongoingCall, setOngoingCall] = useState<OngoingCall | null>(null);
  useEffect(() => {
    if (chat.tipo !== "GRUPO") return;
    const sb = supabaseRef.current;
    // Initial query — show banner for both ringing (nobody joined yet) and active
    void sb.from("llamadas")
      .select("id, room_name, tipo, estado")
      .eq("chat_id", chat.chat_id)
      .in("estado", ["ringing", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setOngoingCall(data ? { id: (data as OngoingCall & { estado: string }).id, room_name: (data as OngoingCall & { estado: string }).room_name, tipo: (data as OngoingCall & { estado: string }).tipo } : null));
    // Realtime updates
    const ch = sb.channel(`llamadas-grupo-${chat.chat_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "llamadas", filter: `chat_id=eq.${chat.chat_id}` }, (payload) => {
        const row = payload.new as { id: number; room_name: string; tipo: "audio" | "video"; estado: string } | undefined;
        if (row?.estado === "ringing" || row?.estado === "active") {
          setOngoingCall({ id: row.id, room_name: row.room_name, tipo: row.tipo });
        } else if (row?.estado === "ended" || row?.estado === "missed") {
          setOngoingCall(null);
        }
      })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [chat.chat_id, chat.tipo]);

  // Register reload function for call records
  useEffect(() => {
    registerCallReload?.(() => {
      void listMensajes({ chatId: chat.chat_id, limit: 50 }).then((fresh) => {
        setMessages(fresh);
        if (fresh.length > 0) oldestIdRef.current = fresh[0].id;
        isNearBottomRef.current = true;
      });
    });
  }, [chat.chat_id, registerCallReload]);

  useEffect(() => {
    void (async () => {
      try {
        const [data, reacciones] = await Promise.all([
          listMensajes({ chatId: chat.chat_id, limit: 50 }),
          getMyReacciones(chat.chat_id),
        ]);
        setMessages(data);
        if (data.length > 0) oldestIdRef.current = data[0].id;
        setHasMore(data.length === 50);
        const reaccionesMap: Record<number, string> = {};
        for (const r of reacciones) {
          reaccionesMap[r.mensaje_id] = r.emoji;
        }
        setLocalReactions(reaccionesMap);
      } catch (e) {
        console.error("[chat] Error cargando mensajes:", e);
      } finally {
        setLoading(false);
      }
    })();
    void markChatRead(chat.chat_id);
  }, [chat.chat_id]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`msg:${chat.chat_id}`)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload as MensajeRow;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        onNewMessageRef.current(msg);
        void markChatRead(chat.chat_id);
      })
      .on("broadcast", { event: "edit_message" }, ({ payload }) => {
        const { id, texto } = payload as { id: number; texto: string };
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, texto } : m)));
      })
      .on("broadcast", { event: "delete_message" }, ({ payload }) => {
        const { id } = payload as { id: number };
        setMessages((prev) => prev.filter((m) => m.id !== id));
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes", filter: `chat_id=eq.${chat.chat_id}` },
        (payload) => {
          const msg = payload.new as MensajeRow;
          if (!msg.tipo?.startsWith("call_")) return; // solo registros de llamada
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            isNearBottomRef.current = true;
            return [...prev, msg];
          });
          onNewMessageRef.current(msg);
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [chat.chat_id]);

  const isNearBottomRef = useRef(true);
  const observerReadyRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!observerReadyRef.current) {
      // Primera carga: saltar al fondo instantáneamente
      const container = scrollContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
      // Activar observer después de un tick para que el scroll esté asentado
      setTimeout(() => { observerReadyRef.current = true; }, 100);
    } else if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  // Load more (older) messages when sentinel enters viewport
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore || !hasMore || !observerReadyRef.current) return;
      const oldestId = oldestIdRef.current;
      if (!oldestId) return;
      setLoadingMore(true);
      isNearBottomRef.current = false;
      try {
        const older = await listMensajes({ chatId: chat.chat_id, limit: 50, cursorId: oldestId });
        if (older.length === 0) { setHasMore(false); return; }
        const container = scrollContainerRef.current;
        const prevScrollHeight = container?.scrollHeight ?? 0;
        setMessages((prev) => [...older, ...prev]);
        oldestIdRef.current = older[0].id;
        if (older.length < 50) setHasMore(false);
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
        });
      } catch (e) {
        console.error("[chat] Error cargando más mensajes:", e);
      } finally {
        setLoadingMore(false);
      }
    }, { root: scrollContainerRef.current, threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.chat_id, loadingMore, hasMore, loading]);

  useEffect(() => {
    if (!forwardMsg) { setForwardChats([]); return; }
    void listChats().then(setForwardChats);
  }, [forwardMsg]);

  useEffect(() => {
    if (reactingToId === null) return;
    const close = () => { setReactingToId(null); setReactingPos(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [reactingToId]);

  const closeOverlays = () => { setContextMenu(null); setReactingToId(null); setReactingPos(null); setShowAttachMenu(false); };

  const scrollToMessage = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(msgId);
    setTimeout(() => setHighlightedId(null), 1500);
  };
  const cancelEdit = () => { setEditingMsg(null); setText(""); };
  const cancelReply = () => setReplyingTo(null);

  const onSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (editingMsg) {
      setText("");
      setSending(true);
      try {
        await editMensaje(editingMsg.id, trimmed);
        setMessages((prev) => prev.map((m) => (m.id === editingMsg.id ? { ...m, texto: trimmed } : m)));
        void channelRef.current?.send({ type: "broadcast", event: "edit_message", payload: { id: editingMsg.id, texto: trimmed } });
        setEditingMsg(null);
      } catch (e) {
        console.error("[chat] Error editando:", e);
        setText(trimmed);
      } finally {
        setSending(false);
      }
      return;
    }

    setText("");
    setSending(true);
    try {
      const newId = await sendMensaje({ chatId: chat.chat_id, texto: trimmed, replyToId: replyingTo?.id ?? null });
      const me = chat.miembros.find((m) => m.id === currentUserId);
      const newMsg: MensajeRow = {
        id: newId,
        sender_id: currentUserId,
        sender_nombre: me?.nombre ?? "",
        sender_profile_image: me?.profile_image ?? null,
        texto: trimmed,
        created_at: new Date().toISOString(),
        reply_to_id: replyingTo?.id ?? null,
        reply_texto: replyingTo?.texto ?? null,
        reply_sender_nombre: replyingTo?.sender_id === currentUserId ? "Tú" : (replyingTo?.sender_nombre ?? null),
      };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: newMsg });
      setMessages((prev) => {
        if (prev.some((m) => m.id === newId)) return prev;
        return [...prev, newMsg];
      });
      onNewMessageRef.current(newMsg);
      setReplyingTo(null);
    } catch (e) {
      console.error("[chat] Error enviando:", (e as { message?: string })?.message ?? String(e));
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMsg = async (msg: MensajeRow) => {
    try {
      await deleteMensaje(msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      void channelRef.current?.send({ type: "broadcast", event: "delete_message", payload: { id: msg.id } });
    } catch (e) {
      console.error("[chat] Error eliminando:", (e as { message?: string })?.message ?? String(e));
    }
  };

  const handleForward = async (targetChatId: string) => {
    if (!forwardMsg || forwardSending) return;
    setForwardSending(targetChatId);
    try {
      await sendMensaje({ chatId: targetChatId, texto: forwardMsg.texto });
      setForwardMsg(null);
    } catch (e) {
      console.error("[chat] Error reenviando:", e);
    } finally {
      setForwardSending(null);
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      console.error("[chat] No se pudo acceder al micrófono");
    }
  };

  const handleCancelRecording = () => {
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleSendRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.onstop = async () => {
      const chunks = [...audioChunksRef.current];
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunks, { type: mimeType });
      recorder.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordingSeconds(0);
      setAudioError(null);
      if (blob.size < 100) { setAudioError("Grabación demasiado corta"); return; }

      // UI optimista: mostrar el mensaje inmediatamente con URL local
      const localUrl = URL.createObjectURL(blob);
      const tempId = -Date.now();
      const me = chat.miembros.find((m) => m.id === currentUserId);
      const tempMsg: LocalMsg = {
        id: tempId,
        _key: tempId,
        sender_id: currentUserId,
        sender_nombre: me?.nombre ?? "",
        sender_profile_image: me?.profile_image ?? null,
        texto: "",
        created_at: new Date().toISOString(),
        audio_url: localUrl,
      };
      setMessages((prev) => [...prev, tempMsg]);

      try {
        const { downloadUrl } = await uploadAudioBlob({ blob, userId: currentUserId });
        const newId = await sendMensaje({ chatId: chat.chat_id, texto: "", replyToId: null, audioUrl: downloadUrl });
        const realMsg: MensajeRow = { ...tempMsg, id: newId, audio_url: downloadUrl };
        void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
        setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
        onNewMessageRef.current(realMsg);
        URL.revokeObjectURL(localUrl);
      } catch (e) {
        console.error("[chat] Error enviando nota de voz:", e);
        setAudioError("Error al enviar. Inténtalo de nuevo.");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        URL.revokeObjectURL(localUrl);
      }
    };
    recorder.stop();
  };

  const handleSendDocument = async (file: File) => {
    const tempId = -Date.now();
    const me = chat.miembros.find((m) => m.id === currentUserId);
    const tempMsg: LocalMsg = {
      id: tempId,
      _key: tempId,
      sender_id: currentUserId,
      sender_nombre: me?.nombre ?? "",
      sender_profile_image: me?.profile_image ?? null,
      texto: "",
      created_at: new Date().toISOString(),
      document_url: "__uploading__",
      document_name: file.name,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setShowAttachMenu(false);
    try {
      const { downloadUrl } = await uploadDocumentFile({ file, userId: currentUserId });
      const newId = await sendMensaje({ chatId: chat.chat_id, texto: "", replyToId: null, documentUrl: downloadUrl, documentName: file.name });
      const realMsg: MensajeRow = { ...tempMsg, id: newId, document_url: downloadUrl };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
    } catch (e) {
      console.error("[chat] Error enviando documento:", e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleSendMedia = async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    const tempId = -Date.now();
    const me = chat.miembros.find((m) => m.id === currentUserId);
    const tempMsg: LocalMsg = {
      id: tempId,
      _key: tempId,
      sender_id: currentUserId,
      sender_nombre: me?.nombre ?? "",
      sender_profile_image: me?.profile_image ?? null,
      texto: "",
      created_at: new Date().toISOString(),
      image_url: localUrl,
      image_type: file.type,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setShowAttachMenu(false);
    try {
      const { downloadUrl } = await uploadMediaFile({ file, userId: currentUserId });
      const newId = await sendMensaje({ chatId: chat.chat_id, texto: "", replyToId: null, imageUrl: downloadUrl, imageType: file.type });
      const realMsg: MensajeRow = { ...tempMsg, id: newId, image_url: downloadUrl };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
      URL.revokeObjectURL(localUrl);
    } catch (e) {
      console.error("[chat] Error enviando media:", e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleCreatePoll = async (question: string, options: string[]) => {
    const texto = JSON.stringify({ type: "poll", question, options });
    setShowPollCreator(false);
    const tempId = -Date.now();
    const me = chat.miembros.find((m) => m.id === currentUserId);
    const tempMsg: LocalMsg = {
      id: tempId,
      _key: tempId,
      sender_id: currentUserId,
      sender_nombre: me?.nombre ?? "",
      sender_profile_image: me?.profile_image ?? null,
      texto,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    try {
      const newId = await sendMensaje({ chatId: chat.chat_id, texto });
      const realMsg: MensajeRow = { ...tempMsg, id: newId };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
    } catch (e) {
      console.error("[chat] Error creando encuesta:", e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleSendAudioFile = async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    const tempId = -Date.now();
    const me = chat.miembros.find((m) => m.id === currentUserId);
    const tempMsg: LocalMsg = {
      id: tempId,
      _key: tempId,
      sender_id: currentUserId,
      sender_nombre: me?.nombre ?? "",
      sender_profile_image: me?.profile_image ?? null,
      texto: "",
      created_at: new Date().toISOString(),
      audio_url: localUrl,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setShowAttachMenu(false);
    try {
      const { downloadUrl } = await uploadAudioFile({ file, userId: currentUserId });
      const newId = await sendMensaje({ chatId: chat.chat_id, texto: "", replyToId: null, audioUrl: downloadUrl });
      const realMsg: MensajeRow = { ...tempMsg, id: newId, audio_url: downloadUrl };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
      URL.revokeObjectURL(localUrl);
    } catch (e) {
      console.error("[chat] Error enviando audio:", e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      URL.revokeObjectURL(localUrl);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void onSend(); }
    if (e.key === "Escape") { cancelEdit(); cancelReply(); closeOverlays(); }
  };

  if (showInfo) {
    return <ChatInfoPanel chat={chat} currentUserId={currentUserId} onBack={() => setShowInfo(false)} onLeave={onBack} channelRef={channelRef} onFotoUpdated={onFotoUpdated} />;
  }

  const pinnedMsg = pinnedId ? messages.find((m) => m.id === pinnedId) ?? null : null;

  return (
    <div className="flex h-[calc(100dvh-var(--space-20)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-var(--space-16))]">
      {/* Poll creator modal */}
      {showPollCreator && (
        <PollCreatorModal
          onClose={() => setShowPollCreator(false)}
          onCreate={(question, options) => void handleCreatePoll(question, options)}
        />
      )}

      {/* Camera modal */}
      {showCamera && (
        <CameraModal
          onCapture={(file) => { setShowCamera(false); void handleSendMedia(file); }}
          onClose={() => setShowCamera(false)}
        />
      )}
      {/* Context menu */}
      {contextMenu && (
        <MsgContextMenu
          msg={contextMenu.msg}
          x={contextMenu.x}
          y={contextMenu.y}
          isMe={contextMenu.msg.sender_id === currentUserId}
          isStarred={starredIds.has(contextMenu.msg.id)}
          isPinned={pinnedId === contextMenu.msg.id}
          onClose={closeOverlays}
          onEdit={() => { setEditingMsg(contextMenu.msg); setText(contextMenu.msg.texto); closeOverlays(); setTimeout(() => inputRef.current?.focus(), 50); }}
          onReply={() => { setReplyingTo(contextMenu.msg); closeOverlays(); setTimeout(() => inputRef.current?.focus(), 50); }}
          onCopy={() => { void navigator.clipboard.writeText(contextMenu.msg.texto); closeOverlays(); }}
          onReact={() => { setReactingToId(contextMenu.msg.id); setReactingPos({ x: contextMenu.x, y: contextMenu.triggerTop - 56 }); setContextMenu(null); }}
          onForward={() => { setForwardMsg(contextMenu.msg); closeOverlays(); }}
          onPin={() => { setPinnedId((p) => (p === contextMenu.msg.id ? null : contextMenu.msg.id)); closeOverlays(); }}
          onStar={() => { setStarredIds((p) => { const n = new Set(p); n.has(contextMenu.msg.id) ? n.delete(contextMenu.msg.id) : n.add(contextMenu.msg.id); return n; }); closeOverlays(); }}
          onDelete={() => { void handleDeleteMsg(contextMenu.msg); closeOverlays(); }}
        />
      )}

      {/* Emoji reaction picker */}
      {reactingToId !== null && reactingPos && (
        <div
          className="fixed z-[99] flex gap-[2px] rounded-full border border-app bg-app p-[6px] shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
          style={{
            left: Math.min(reactingPos.x - 120, (typeof window !== "undefined" ? window.innerWidth : 800) - 256),
            top: Math.max(reactingPos.y - 60, 8),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                const msgId = reactingToId;
                const newEmoji = localReactions[msgId] === emoji ? "" : emoji;
                setLocalReactions((prev) => ({ ...prev, [msgId]: newEmoji }));
                setReactingToId(null);
                setReactingPos(null);
                void reactMensaje(msgId, newEmoji).catch((e) =>
                  console.error("[chat] Error guardando reacción:", (e as { message?: string })?.message ?? String(e))
                );
              }}
              className="flex size-[38px] items-center justify-center rounded-full text-[20px] transition-transform hover:scale-125 hover:bg-surface"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && <Lightbox
        url={lightboxUrl}
        imageUrls={messages.filter((m) => m.image_url && !m.image_type?.startsWith("video/")).map((m) => m.image_url!)}
        onClose={() => setLightboxUrl(null)}
      />}

      {/* Forward modal */}
      {forwardMsg && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setForwardMsg(null)}>
          <div className="w-full max-w-[360px] rounded-t-[20px] bg-app p-[var(--space-5)] md:rounded-[16px]" onClick={(e) => e.stopPropagation()}>
            <p className="mb-[var(--space-3)] text-body-sm font-[var(--fw-semibold)] text-app">Reenviar a...</p>
            <div className="max-h-[280px] space-y-[1px] overflow-y-auto">
              {forwardChats.filter((c) => c.chat_id !== chat.chat_id).map((c) => {
                const cname = resolveChatName(c, currentUserId);
                const cavatar = resolveChatAvatar(c, currentUserId);
                return (
                  <button
                    key={c.chat_id}
                    type="button"
                    onClick={() => void handleForward(c.chat_id)}
                    disabled={!!forwardSending}
                    className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface disabled:opacity-50"
                  >
                    <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                      {cavatar ? <img src={cavatar} alt={cname} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : c.tipo === "GRUPO" ? <GroupIcon className="size-[14px] text-muted" /> : (cname[0] ?? "?").toUpperCase()}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-body-sm text-app">{cname}</p>
                    {forwardSending === c.chat_id && <span className="text-[11px] text-muted">...</span>}
                  </button>
                );
              })}
              {forwardChats.filter((c) => c.chat_id !== chat.chat_id).length === 0 && (
                <p className="py-[var(--space-4)] text-center text-body-sm text-muted">No hay otros chats</p>
              )}
            </div>
            <button type="button" onClick={() => setForwardMsg(null)} className="mt-[var(--space-3)] w-full rounded-full border border-app py-[10px] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)] border-b border-app pb-[var(--space-3)]">
        <button type="button" onClick={onBack} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface" aria-label="Volver">
          <BackIcon className="size-[18px]" />
        </button>
        <button type="button" onClick={() => setShowInfo(true)} className="flex min-w-0 flex-1 items-center gap-[var(--space-3)] rounded-[8px] px-1 py-1 text-left transition-colors hover:bg-surface">
          <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
            {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : chat.tipo === "GRUPO" ? <GroupIcon className="size-[16px] text-muted" /> : (name[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{name}</p>
            {chat.tipo === "GRUPO" && <p className="text-[11px] text-muted">{chat.miembros.length} miembros</p>}
          </div>
        </button>
        <button type="button" onClick={() => onStartCall?.("audio")} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface text-muted hover:text-app" aria-label="Llamada de voz">
          <PhoneCallIcon className="size-[18px]" />
        </button>
        <button type="button" onClick={() => onStartCall?.("video")} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface text-muted hover:text-app" aria-label="Llamada de vídeo">
          <VideoCallIcon className="size-[18px]" />
        </button>
      </div>

      {/* Ongoing group call banner — hide when already in the call */}
      {ongoingCall && !inCall && (
        <div className="flex items-center gap-[var(--space-3)] border-b border-app bg-surface px-[var(--space-3)] py-[10px]">
          <div className="flex size-8 items-center justify-center rounded-full bg-green-500/15 text-green-500">
            <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.59 16z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-[var(--fw-semibold)] text-app">Llamada en curso</p>
            <p className="text-[11px] text-muted">{ongoingCall.tipo === "video" ? "Videollamada" : "Llamada de voz"}</p>
          </div>
          <button
            type="button"
            onClick={() => onJoinCall?.(ongoingCall.id, ongoingCall.room_name, ongoingCall.tipo)}
            className="shrink-0 rounded-full bg-green-500 px-4 py-1.5 text-xs font-[var(--fw-semibold)] text-white transition-colors hover:bg-green-600"
          >
            Unirse
          </button>
        </div>
      )}

      {/* Pinned message banner */}
      {pinnedMsg && (
        <button
          type="button"
          onClick={() => setPinnedId(null)}
          className="flex items-center gap-[var(--space-2)] border-b border-app bg-surface px-[var(--space-3)] py-[8px] text-left"
        >
          <PinIcon className="size-[13px] shrink-0 text-muted" />
          <p className="min-w-0 flex-1 truncate text-[12px] text-muted">{pinnedMsg.texto}</p>
          <svg viewBox="0 0 24 24" fill="none" className="size-[14px] shrink-0 text-muted"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      )}

      {/* Messages */}
      <div ref={scrollContainerRef} className="scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-[var(--space-4)] pr-[var(--space-2)]" onClick={closeOverlays}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-body-sm text-muted">Cargando...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-body-sm text-muted">Sé el primero en escribir</div>
        ) : (
          <div className="space-y-[1px]">
            {/* Sentinel para infinite scroll hacia arriba */}
            <div ref={topSentinelRef} className="h-px" />
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="size-5 animate-spin rounded-full border-2 border-app border-t-transparent" />
              </div>
            )}
            {messages.map((msg, idx) => {
              const isMe = msg.sender_id === currentUserId;
              const prevMsg = messages[idx - 1];
              const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
              const time = formatChatTime(msg.created_at);
              const reaction = localReactions[msg.id];
              const isStarred = starredIds.has(msg.id);
              const openMsgMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setContextMenu({ msg, x: rect.left, y: rect.bottom + 4, triggerTop: rect.top });
                setReactingToId(null);
                setReactingPos(null);
              };
              return (
                <div id={`msg-${msg.id}`} key={(msg as LocalMsg)._key ?? msg.id} className={`group/msg flex ${isMe ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-[var(--space-3)]" : "mt-[2px]"} ${reaction ? "mb-[20px]" : ""} ${highlightedId === msg.id ? "rounded-[12px] bg-[var(--text-primary)]/10 transition-colors" : ""}`}>
                  {!isMe && chat.tipo === "GRUPO" && (
                    <div className="mr-[var(--space-2)] w-[24px] shrink-0">
                      {isFirstInGroup && (
                        <div className="flex size-[24px] items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-[10px] font-[var(--fw-semibold)] text-app">
                          {msg.sender_profile_image ? <img src={msg.sender_profile_image} alt={msg.sender_nombre} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (msg.sender_nombre[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="relative max-w-[75%]">
                    <div className={`break-all rounded-[16px] px-3 py-2 ${isMe ? "bg-[var(--text-primary)] text-contrast-token" : "bg-surface-inset"} ${contextMenu?.msg.id === msg.id ? "opacity-75" : ""}`}>
                      {!isMe && chat.tipo === "GRUPO" && isFirstInGroup && (
                        <p className="mb-[2px] text-[11px] font-[var(--fw-semibold)] text-muted">{msg.sender_nombre}</p>
                      )}
                      {msg.reply_texto && msg.reply_to_id && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.reply_to_id!); }}
                          className={`mb-[6px] w-full rounded-[8px] border-l-[3px] px-2 py-[4px] text-left transition-opacity hover:opacity-80 ${isMe ? "border-contrast-token/50 bg-black/20" : "border-[var(--text-primary)] bg-black/8"}`}
                        >
                          <p className={`truncate text-[11px] font-[var(--fw-semibold)] ${isMe ? "text-contrast-token/80" : "text-[var(--text-primary)]"}`}>
                            {msg.reply_sender_nombre ?? "Usuario"}
                          </p>
                          <p className={`truncate text-[12px] ${isMe ? "text-contrast-token/70" : "text-muted"}`}>
                            {msg.reply_texto}
                          </p>
                        </button>
                      )}
                      {msg.tipo?.startsWith("call_") ? (
                        <CallBubble tipo={msg.tipo} duracion={parseInt(msg.texto) || 0} />
                      ) : msg.audio_url ? (
                        <AudioPlayer src={msg.audio_url} isMe={isMe} sending={msg.id < 0} />
                      ) : msg.document_url ? (
                        <DocumentBubble url={msg.document_url} name={msg.document_name ?? "Documento"} sending={msg.id < 0} isMe={isMe} />
                      ) : msg.image_url ? (
                        <MediaBubble url={msg.image_url} type={msg.image_type ?? "image/jpeg"} sending={msg.id < 0} onOpenLightbox={!msg.image_type?.startsWith("video/") ? () => setLightboxUrl(msg.image_url!) : undefined} />
                      ) : isPollMessage(msg.texto) ? (
                        <PollBubble msg={msg} isMe={isMe} />
                      ) : (
                        <p className="text-body-sm">{msg.texto}</p>
                      )}
                      <div className={`mt-[2px] flex items-center justify-end gap-[4px] text-[10px] ${isMe ? "text-contrast-token/60" : "text-muted"}`}>
                        {isStarred && <span>★</span>}
                        <span>{time}</span>
                        <button
                          type="button"
                          onClick={openMsgMenu}
                          className="flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover/msg:opacity-100 hover:opacity-70"
                          aria-label="Opciones del mensaje"
                        >
                          <ChevronDownIcon className="size-[11px]" />
                        </button>
                      </div>
                    </div>
                    {reaction && (
                      <div className={`absolute -bottom-[18px] ${isMe ? "right-[8px]" : "left-[8px]"} rounded-full border border-app bg-app px-[6px] py-[2px] text-[14px] shadow-sm`}>
                        {reaction}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-app pt-[var(--space-3)]">
        {replyingTo && (
          <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] rounded-[10px] border-l-2 border-[var(--text-primary)] bg-surface px-3 py-[8px]">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-[var(--fw-semibold)] text-[var(--text-primary)]">{replyingTo.sender_nombre || "Tú"}</p>
              <p className="truncate text-[12px] text-muted">{replyingTo.texto}</p>
            </div>
            <button type="button" onClick={cancelReply} className="shrink-0 text-muted transition-colors hover:text-app">
              <svg viewBox="0 0 24 24" fill="none" className="size-[16px]"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
        {editingMsg && (
          <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] rounded-[10px] border-l-2 border-blue-500 bg-surface px-3 py-[8px]">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-[var(--fw-semibold)] text-blue-400">Editando mensaje</p>
              <p className="truncate text-[12px] text-muted">{editingMsg.texto}</p>
            </div>
            <button type="button" onClick={cancelEdit} className="shrink-0 text-muted transition-colors hover:text-app">
              <svg viewBox="0 0 24 24" fill="none" className="size-[16px]"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
        <div className="relative flex items-center gap-[var(--space-2)]">
          {/* Attachment menu */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowAttachMenu((v) => !v)}
              className="flex size-[36px] items-center justify-center rounded-full transition-colors hover:bg-surface"
              aria-label="Adjuntar"
            >
              <AttachPlusIcon className="size-[20px] text-muted" />
            </button>
            {/* Inputs ocultos */}
            <input ref={docInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSendDocument(f); e.target.value = ""; }} />
            <input ref={mediaInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSendMedia(f); e.target.value = ""; }} />
            <input ref={audioFileInputRef} type="file" className="hidden" accept="audio/*,.mp3,.m4a,.ogg,.wav,.aac,.flac" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSendAudioFile(f); e.target.value = ""; }} />
            {showAttachMenu && (
              <div className="absolute bottom-[44px] left-0 z-50 min-w-[180px] overflow-hidden rounded-[14px] border border-app bg-app shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
                {[
                  { icon: <DocIcon className="size-[18px]" />, label: "Documento", color: "text-purple-400", onClick: () => { setShowAttachMenu(false); docInputRef.current?.click(); } },
                  { icon: <PhotoVideoIcon className="size-[18px]" />, label: "Fotos y videos", color: "text-blue-400", onClick: () => { setShowAttachMenu(false); const i = mediaInputRef.current; if (!i) return; i.removeAttribute("capture"); i.click(); } },
                  { icon: <CameraIcon className="size-[18px]" />, label: "Cámara", color: "text-red-400", onClick: () => { setShowAttachMenu(false); setShowCamera(true); } },
                  { icon: <AudioFileIcon className="size-[18px]" />, label: "Audio", color: "text-orange-400", onClick: () => { setShowAttachMenu(false); audioFileInputRef.current?.click(); } },
                  { icon: <PollIcon className="size-[18px]" />, label: "Encuesta", color: "text-green-400", onClick: () => { setShowAttachMenu(false); setShowPollCreator(true); } },
                ].map(({ icon, label, color, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className="flex w-full items-center gap-[var(--space-3)] px-4 py-[11px] text-left transition-colors hover:bg-surface"
                  >
                    <span className={color}>{icon}</span>
                    <span className="text-body-sm text-app">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isRecording ? (
            <>
              <div className="flex min-w-0 flex-1 items-center gap-[var(--space-2)] rounded-full border border-red-500/50 bg-surface px-4 py-[8px]">
                <span className="size-[8px] shrink-0 animate-pulse rounded-full bg-red-500" />
                <span className="text-body-sm text-red-400">
                  {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                </span>
                <span className="text-body-sm text-muted">Grabando...</span>
              </div>
              <button
                type="button"
                onClick={handleCancelRecording}
                className="flex size-[36px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface"
                aria-label="Cancelar grabación"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-[16px] text-muted"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
              <button
                type="button"
                onClick={handleSendRecording}
                className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-contrast-token transition-opacity hover:opacity-80"
                aria-label="Enviar nota de voz"
              >
                <SendMsgIcon className="size-[16px]" />
              </button>
            </>
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={editingMsg ? "Editar mensaje..." : "Escribe un mensaje..."}
                className="min-w-0 flex-1 rounded-full border border-app bg-surface px-4 py-[8px] text-body-sm text-app outline-none transition-colors focus:border-[var(--border-strong)]"
              />
              <button
                type="button"
                onClick={() => void handleStartRecording()}
                className="flex size-[36px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface"
                aria-label="Nota de voz"
              >
                <MicIcon className="size-[18px] text-muted" />
              </button>
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={!text.trim() || sending}
                className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-30"
                aria-label="Enviar"
              >
                <SendMsgIcon className="size-[16px]" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MsgContextMenu({
  x, y, isMe, isStarred, isPinned,
  onClose, onEdit, onReply, onCopy, onReact, onForward, onPin, onStar, onDelete,
}: {
  msg: MensajeRow;
  x: number;
  y: number;
  isMe: boolean;
  isStarred: boolean;
  isPinned: boolean;
  onClose: () => void;
  onEdit: () => void;
  onReply: () => void;
  onCopy: () => void;
  onReact: () => void;
  onForward: () => void;
  onPin: () => void;
  onStar: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const menuW = 210;
  const itemH = 44;
  const itemCount = isMe ? 8 : 6;
  const menuH = itemCount * itemH + 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.min(x, vw - menuW - 8);
  const top = y + menuH > vh ? Math.max(y - menuH, 8) : y;

  const items: { label: string; icon: React.ReactNode; danger?: boolean; action: () => void }[] = [
    ...(isMe ? [{ label: "Editar", icon: <EditIcon />, action: onEdit }] : []),
    { label: "Responder", icon: <ReplyIcon />, action: onReply },
    { label: "Copiar", icon: <CopyIcon />, action: onCopy },
    { label: "Reaccionar", icon: <EmojiIcon />, action: onReact },
    { label: "Reenviar", icon: <ForwardIcon />, action: onForward },
    { label: isPinned ? "Desfijar" : "Fijar", icon: <PinIcon />, action: onPin },
    { label: isStarred ? "Quitar destacado" : "Destacar", icon: <StarIcon />, action: onStar },
    ...(isMe ? [{ label: "Eliminar", icon: <TrashIcon />, danger: true, action: onDelete }] : []),
  ];

  return (
    <div
      className="fixed z-[100] min-w-[210px] overflow-hidden rounded-[12px] border border-app bg-app py-[4px] shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.action}
          className={`flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-body-sm transition-colors hover:bg-surface ${item.danger ? "text-red-500" : "text-app"}`}
        >
          <span className="size-[18px] shrink-0">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ChatInfoPanel({
  chat,
  currentUserId,
  onBack,
  onLeave,
  channelRef,
  onFotoUpdated,
}: {
  chat: ChatListItem;
  currentUserId: string;
  onBack: () => void;
  onLeave: () => void;
  channelRef: React.RefObject<ReturnType<ReturnType<typeof createBrowserSupabaseClient>["channel"]> | null>;
  onFotoUpdated?: (foto: string) => void;
}) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [friends, setFriends] = useState<PublicUserProfileRow[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [localMembers, setLocalMembers] = useState(() => {
    const seen = new Set<string>();
    return chat.miembros.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  });
  const [localFoto, setLocalFoto] = useState(chat.foto);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isGrupo = chat.tipo === "GRUPO";
  const name = resolveChatName(chat, currentUserId);
  const displayAvatar = isGrupo ? localFoto : resolveChatAvatar(chat, currentUserId);
  const avatarLabel = (name[0] ?? "?").toUpperCase();

  // Escuchar eventos de miembros en tiempo real
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    const handler = ({ payload }: { payload: unknown }) => {
      const { user_id, nombre, profile_image } = payload as { user_id: string; nombre?: string; profile_image?: string | null };
      setLocalMembers((prev) => {
        if (prev.some((m) => m.id === user_id)) return prev;
        return [...prev, { id: user_id, nombre: nombre ?? "Usuario", profile_image: profile_image ?? null }];
      });
    };
    const leaveHandler = ({ payload }: { payload: unknown }) => {
      const { user_id } = payload as { user_id: string };
      setLocalMembers((prev) => prev.filter((m) => m.id !== user_id));
    };
    ch.on("broadcast", { event: "member_added" }, handler);
    ch.on("broadcast", { event: "member_left" }, leaveHandler);
  }, [channelRef]);

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await leaveChat(chat.chat_id);
      void channelRef.current?.send({ type: "broadcast", event: "member_left", payload: { user_id: currentUserId } });
      onLeave();
    } catch (e) {
      console.error("[chat] Error saliendo del chat:", e);
      setLeaving(false);
      setConfirmLeave(false);
    }
  };

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadingFoto) return;
    setUploadingFoto(true);
    try {
      const { downloadUrl } = await uploadPlanCoverFile({ file, userId: currentUserId });
      await updateChatFoto(chat.chat_id, downloadUrl);
      setLocalFoto(downloadUrl);
      onFotoUpdated?.(downloadUrl);
    } catch (err) {
      console.error("[chat] Error actualizando foto:", err);
    } finally {
      setUploadingFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openAddMembers = async () => {
    setShowAddMembers(true);
    setFriendsLoading(true);
    try {
      const all = await fetchActiveFriends();
      const memberIds = new Set(localMembers.map((m) => m.id));
      setFriends(all.filter((f) => !memberIds.has(f.id)));
    } catch (err) {
      console.error("[chat] Error cargando amigos:", err);
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleAddMember = async (friendId: string) => {
    if (addingId) return;
    setAddingId(friendId);
    try {
      await addChatMember(chat.chat_id, friendId);
      const added = friends.find((f) => f.id === friendId);
      if (added) {
        setLocalMembers((prev) => [...prev, { id: added.id, nombre: added.nombre, profile_image: added.profile_image }]);
        setFriends((prev) => prev.filter((f) => f.id !== friendId));
        void channelRef.current?.send({ type: "broadcast", event: "member_added", payload: { user_id: added.id, nombre: added.nombre, profile_image: added.profile_image } });
        // Notificar al usuario añadido para que actualice su lista de chats
        const supabase = createBrowserSupabaseClient();
        const notifChannel = supabase.channel(`user-join:${friendId}`);
        notifChannel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void notifChannel.send({ type: "broadcast", event: "chat_added", payload: { chat_id: chat.chat_id } });
            setTimeout(() => void supabase.removeChannel(notifChannel), 2000);
          }
        });
        setShowAddMembers(false);
      }
    } catch (err) {
      console.error("[chat] Error añadiendo miembro:", err);
    } finally {
      setAddingId(null);
    }
  };

  const visibleMembers = showAllMembers ? localMembers : localMembers.slice(0, 6);
  const hiddenCount = localMembers.length - 6;

  return (
    <div className="relative flex h-[calc(100dvh-var(--space-20)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-var(--space-16))]">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-2)] border-b border-app pb-[var(--space-3)]">
        <button type="button" onClick={onBack} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface" aria-label="Volver">
          <BackIcon className="size-[18px]" />
        </button>
        <p className="text-body-sm font-[var(--fw-semibold)] text-app">
          {isGrupo ? "Info. del grupo" : "Info. del contacto"}
        </p>
      </div>

      {/* Add members overlay */}
      {showAddMembers && (
        <div className="absolute inset-0 z-40 flex flex-col bg-app">
          <div className="flex items-center gap-[var(--space-2)] border-b border-app py-[var(--space-3)]">
            <button type="button" onClick={() => setShowAddMembers(false)} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface">
              <BackIcon className="size-[18px]" />
            </button>
            <p className="text-body-sm font-[var(--fw-semibold)] text-app">Añadir personas</p>
          </div>
          <div className="flex-1 overflow-y-auto p-[var(--space-2)]">
            {friendsLoading ? (
              <div className="py-[var(--space-8)] text-center text-body-sm text-muted">Cargando...</div>
            ) : friends.length === 0 ? (
              <div className="py-[var(--space-8)] text-center text-body-sm text-muted">No hay más amigos que añadir</div>
            ) : (
              <div className="space-y-[1px]">
                {friends.map((f) => {
                  const label = (f.nombre[0] ?? "?").toUpperCase();
                  const isAdding = addingId === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => void handleAddMember(f.id)}
                      disabled={!!addingId}
                      className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface disabled:opacity-50"
                    >
                      <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                        {f.profile_image ? <img src={f.profile_image} alt={f.nombre} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : label}
                      </div>
                      <p className="min-w-0 flex-1 truncate text-body-sm font-[var(--fw-medium)] text-app">{f.nombre}</p>
                      {isAdding ? (
                        <span className="shrink-0 text-[11px] text-muted">...</span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-app px-[10px] py-[4px] text-[12px] text-app">Añadir</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[520px]">
        {/* Hero: avatar + name */}
        <div className="flex flex-col items-center gap-[var(--space-3)] py-[var(--space-7)]">
          <div className="relative">
            <div className="flex size-[96px] items-center justify-center overflow-hidden rounded-full border-2 border-app bg-surface-inset text-[34px] font-[var(--fw-semibold)] text-app">
              {displayAvatar ? (
                <img src={displayAvatar} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : isGrupo ? (
                <GroupIcon className="size-[40px] text-muted" />
              ) : avatarLabel}
            </div>
            {isGrupo && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFoto}
                  className="absolute -bottom-[2px] -right-[2px] flex size-[28px] items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--surface)] shadow-sm transition-colors hover:bg-surface-inset"
                  aria-label="Cambiar foto"
                >
                  {uploadingFoto ? (
                    <span className="block size-[10px] animate-spin rounded-full border-2 border-muted border-t-transparent" />
                  ) : (
                    <CameraIcon className="size-[13px] text-app" />
                  )}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFotoChange(e)} />
              </>
            )}
          </div>
          <div className="text-center">
            <p className="text-[var(--font-h4)] font-[var(--fw-semibold)] text-app">{name}</p>
            <p className="mt-[3px] text-[12px] text-muted">
              {isGrupo ? `Grupo · ${localMembers.length} miembros` : "Contacto"}
            </p>
          </div>
        </div>

        {/* Members (groups only) */}
        {isGrupo && (
          <>
            <div className="flex items-center justify-between px-[var(--space-4)] pb-[var(--space-2)]">
              <p className="text-[11px] font-[var(--fw-semibold)] uppercase tracking-wide text-muted">
                {localMembers.length} miembros
              </p>
            </div>
            <div className="space-y-[1px] px-[var(--space-2)]">
              {/* Add member button */}
              <button
                type="button"
                onClick={() => void openAddMembers()}
                className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface"
              >
                <div className="avatar-md flex shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border-strong)] bg-surface-inset">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[16px] text-muted">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-body-sm font-[var(--fw-medium)] text-app">Añadir personas</p>
              </button>
              {visibleMembers.map((m) => {
                const label = (m.nombre[0] ?? "?").toUpperCase();
                const isMe = m.id === currentUserId;
                return (
                  <div key={m.id} className="flex items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px]">
                    <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                      {m.profile_image ? <img src={m.profile_image} alt={m.nombre} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : label}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-body-sm text-app">{m.nombre}</p>
                    {isMe && (
                      <span className="shrink-0 rounded-full bg-surface px-[8px] py-[3px] text-[11px] text-muted">Tú</span>
                    )}
                  </div>
                );
              })}
              {!showAllMembers && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllMembers(true)}
                  className="w-full rounded-[10px] px-2 py-[10px] text-left text-body-sm text-[var(--primary)] transition-colors hover:bg-surface"
                >
                  Ver todos ({hiddenCount} más)
                </button>
              )}
            </div>
          </>
        )}

        <div className="mx-[var(--space-4)] my-[var(--space-3)] border-t border-app" />

        {/* Actions */}
        <div className="px-[var(--space-2)] pb-[var(--space-8)]">
          <ActionRow icon={<TrashLightIcon />} label="Vaciar chat" onClick={() => {}} />
          {!isGrupo && (
            <>
              <ActionRow icon={<BlockIcon />} label={`Bloquear a ${name}`} danger onClick={() => {}} />
              <ActionRow icon={<ReportIcon />} label={`Reportar a ${name}`} danger onClick={() => {}} />
              <ActionRow icon={<TrashIcon />} label="Eliminar chat" danger onClick={() => setConfirmLeave(true)} />
            </>
          )}
          {isGrupo && (
            <>
              <ActionRow icon={<LeaveIcon />} label="Salir del grupo" danger onClick={() => setConfirmLeave(true)} />
              <ActionRow icon={<ReportIcon />} label="Reportar grupo" danger onClick={() => {}} />
            </>
          )}
        </div>
        </div>{/* /max-w wrapper */}
      </div>

      {/* Confirm modal */}
      {confirmLeave && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-[360px] rounded-t-[20px] bg-app p-[var(--space-5)] md:rounded-[16px]">
            <p className="text-center text-body-sm font-[var(--fw-semibold)] text-app">
              {isGrupo ? "¿Salir del grupo?" : "¿Eliminar esta conversación?"}
            </p>
            <p className="mt-[var(--space-1)] text-center text-body-sm text-muted">
              {isGrupo ? "Ya no podrás recibir mensajes de este grupo." : "Se eliminará el chat de tu lista."}
            </p>
            <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
              <button
                type="button"
                onClick={() => void handleLeave()}
                disabled={leaving}
                className="w-full rounded-full bg-red-500 py-[10px] text-body-sm font-[var(--fw-semibold)] text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {leaving ? "..." : isGrupo ? "Salir" : "Eliminar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="w-full rounded-full border border-app py-[10px] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionRow({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-3 py-[12px] text-left transition-colors hover:bg-surface ${danger ? "text-red-500" : "text-app"}`}
    >
      <span className="size-[20px] shrink-0">{icon}</span>
      <span className="text-body-sm font-[var(--fw-medium)]">{label}</span>
    </button>
  );
}

function TrashLightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BlockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.636 5.636l12.728 12.728" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function LeaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 19l-4-4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 15h7a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function EmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 13s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="9.5" r="1" fill="currentColor" />
      <circle cx="15" cy="9.5" r="1" fill="currentColor" />
    </svg>
  );
}
function ForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <path d="M15 17l5-5-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12H9a5 5 0 0 0-5 5v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PinIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 17v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 5l-.5 5-3 2 7 4 7-4-3-2-.5-5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
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

function CameraModal({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);     // foto: dataURL
  const [capturedVideo, setCapturedVideo] = useState<Blob | null>(null); // video: blob
  const [capturedVideoUrl, setCapturedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  const videoRefCallback = useCallback((el: HTMLVideoElement | null) => { setVideoEl(el); }, []);

  useEffect(() => {
    if (!videoEl) return;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        videoEl.srcObject = stream;
      })
      .catch((e: unknown) => setError(`No se pudo acceder a la cámara: ${(e as Error).message ?? String(e)}`));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [videoEl]);

  const handleCapturePhoto = () => {
    const video = videoEl;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
  };

  const handleStartVideo = () => {
    const stream = streamRef.current;
    if (!stream) return;
    videoChunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setCapturedVideo(blob);
      setCapturedVideoUrl(url);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setRecSeconds(0);
    recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
  };

  const handleStopVideo = () => {
    recorderRef.current?.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
  };

  const handleSendPhoto = () => {
    if (!captured) return;
    const byteString = atob(captured.split(",")[1]!);
    const buffer = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) buffer[i] = byteString.charCodeAt(i);
    onCapture(new File([buffer], `foto_${Date.now()}.jpg`, { type: "image/jpeg" }));
  };

  const handleSendVideo = () => {
    if (!capturedVideo) return;
    if (capturedVideoUrl) URL.revokeObjectURL(capturedVideoUrl);
    onCapture(new File([capturedVideo], `video_${Date.now()}.webm`, { type: "video/webm" }));
  };

  const handleRepeat = () => {
    if (capturedVideoUrl) { URL.revokeObjectURL(capturedVideoUrl); setCapturedVideoUrl(null); }
    setCaptured(null);
    setCapturedVideo(null);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const hasCapture = captured ?? capturedVideo;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Cerrar */}
      <button type="button" onClick={onClose} className="absolute right-[16px] top-[16px] z-10 flex size-[36px] items-center justify-center rounded-full bg-black/40 text-white">
        <svg viewBox="0 0 24 24" fill="none" className="size-[18px]"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>

      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="px-8 text-center text-white/80">{error}</p>
        </div>
      ) : hasCapture ? (
        /* Preview */
        <>
          <div className="relative flex-1 overflow-hidden">
            {captured ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={captured} alt="Captura" className="h-full w-full object-contain" />
            ) : (
              <video src={capturedVideoUrl ?? undefined} controls autoPlay className="h-full w-full object-contain" />
            )}
          </div>
          <div className="flex items-center justify-center gap-[16px] py-[28px]">
            <button type="button" onClick={handleRepeat} className="rounded-full border border-white/50 px-[24px] py-[10px] text-white">
              Repetir
            </button>
            <button type="button" onClick={captured ? handleSendPhoto : handleSendVideo} className="rounded-full bg-white px-[28px] py-[10px] font-semibold text-black">
              Enviar
            </button>
          </div>
        </>
      ) : (
        /* Visor */
        <>
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRefCallback} autoPlay playsInline muted onCanPlay={() => setReady(true)} className="h-full w-full object-cover" />
            {!ready && <div className="absolute inset-0 flex items-center justify-center"><span className="text-sm text-white/60">Iniciando cámara...</span></div>}
            {recording && (
              <div className="absolute left-[16px] top-[16px] flex items-center gap-[6px] rounded-full bg-black/50 px-[12px] py-[4px]">
                <span className="size-[8px] animate-pulse rounded-full bg-red-500" />
                <span className="text-[13px] text-white">{fmt(recSeconds)}</span>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {/* Controles */}
          <div className="flex items-center justify-center gap-[40px] py-[28px]">
            {/* Switch foto/video */}
            <div className="flex rounded-full bg-white/15 p-[3px]">
              <button type="button" onClick={() => setMode("photo")} className={`rounded-full px-[14px] py-[6px] text-[13px] font-medium transition-colors ${mode === "photo" ? "bg-white text-black" : "text-white"}`}>
                Foto
              </button>
              <button type="button" onClick={() => setMode("video")} className={`rounded-full px-[14px] py-[6px] text-[13px] font-medium transition-colors ${mode === "video" ? "bg-white text-black" : "text-white"}`}>
                Vídeo
              </button>
            </div>

            {/* Botón captura */}
            {mode === "photo" ? (
              <button type="button" onClick={handleCapturePhoto} disabled={!ready}
                className="flex size-[64px] items-center justify-center rounded-full border-[3px] border-white bg-white/20 transition-opacity disabled:opacity-40 hover:bg-white/30">
                <div className="size-[48px] rounded-full bg-white" />
              </button>
            ) : (
              <button type="button" onClick={recording ? handleStopVideo : handleStartVideo} disabled={!ready}
                className={`flex size-[64px] items-center justify-center rounded-full border-[3px] transition-all disabled:opacity-40 ${recording ? "border-red-500 bg-red-500/20" : "border-white bg-white/20 hover:bg-white/30"}`}>
                <div className={`rounded-full bg-red-500 transition-all ${recording ? "size-[24px] rounded-[6px]" : "size-[48px]"}`} />
              </button>
            )}

            {/* Placeholder para centrar */}
            <div className="w-[80px]" />
          </div>
        </>
      )}
    </div>
  );
}

function CallBubble({ tipo, duracion }: { tipo: string; duracion: number }) {
  const missed = tipo.includes("missed");
  const isVideo = tipo.includes("video");
  const label = missed
    ? isVideo ? "Videollamada perdida" : "Llamada perdida"
    : isVideo ? "Videollamada" : "Llamada de audio";
  const formatDur = (s: number) => {
    if (!s) return "";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m} min ${sec} s` : `${sec} s`;
  };
  return (
    <div className="flex items-center gap-[var(--space-2)]">
      <span className={`text-[20px] ${missed ? "opacity-60" : ""}`}>
        {isVideo ? "📹" : "📞"}
      </span>
      <div className="flex flex-col">
        <span className={`text-body-sm font-[var(--fw-medium)] ${missed ? "opacity-70" : ""}`}>{label}</span>
        {!missed && duracion > 0 && (
          <span className="text-[11px] opacity-60">{formatDur(duracion)}</span>
        )}
      </div>
    </div>
  );
}

function MediaBubble({ url, type, sending, onOpenLightbox }: { url: string; type: string; sending?: boolean; onOpenLightbox?: () => void }) {
  const isVideo = type.startsWith("video/");
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-[10px]" style={{ maxWidth: 220 }}>
      {isVideo ? (
        <video src={url} controls={!sending} playsInline className="w-full rounded-[10px]" style={{ maxHeight: 300 }} />
      ) : (
        <button type="button" onClick={!sending && onOpenLightbox ? onOpenLightbox : undefined} className="block w-full text-left cursor-pointer" tabIndex={sending ? -1 : 0}>
          {!loaded && <div className="feed-skeleton-shimmer rounded-[10px]" style={{ width: 220, height: 165 }} />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Imagen"
            className="w-full rounded-[10px] object-cover"
            style={{ maxHeight: 300, opacity: loaded ? 1 : 0, transition: "opacity 0.2s", ...(loaded ? {} : { position: "absolute", pointerEvents: "none" }) }}
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        </button>
      )}
      {sending && (
        <div className="absolute inset-0 rounded-[10px] overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 rounded-[10px]"
            style={{
              backgroundColor: "rgba(0,0,0,0.45)",
              transformOrigin: "right center",
              animation: "upload-fill 3s ease-out forwards",
            }}
          />
          <style>{`@keyframes upload-fill { from { transform: scaleX(1); } to { transform: scaleX(0.05); } }`}</style>
        </div>
      )}
    </div>
  );
}

function isPollMessage(texto: string): boolean {
  try { return JSON.parse(texto)?.type === "poll"; } catch { return false; }
}

function PollBubble({ msg, isMe }: { msg: MensajeRow; isMe: boolean }) {
  const poll = JSON.parse(msg.texto) as { question: string; options: string[] };
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [myVote, setMyVote] = useState<number | null>(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (msg.id < 0) { setFetched(true); return; }
    void (async () => {
      try {
        const data = await pollGetVotes(msg.id);
        const map: Record<number, number> = {};
        let my: number | null = null;
        for (const row of data) {
          map[row.option_index] = Number(row.vote_count);
          if (row.voted_by_me) my = row.option_index;
        }
        setVotes(map);
        setMyVote(my);
      } finally { setFetched(true); }
    })();
  }, [msg.id]);

  const handleVote = async (idx: number) => {
    if (msg.id < 0) return;
    const prevVote = myVote;
    const prevVotes = { ...votes };
    const newVotes = { ...votes };
    if (prevVote !== null) newVotes[prevVote] = Math.max(0, (newVotes[prevVote] ?? 0) - 1);
    newVotes[idx] = (newVotes[idx] ?? 0) + 1;
    setMyVote(idx);
    setVotes(newVotes);
    try {
      await pollVote(msg.id, idx);
    } catch {
      setMyVote(prevVote);
      setVotes(prevVotes);
    }
  };

  const total = Object.values(votes).reduce((a, b) => a + b, 0);

  return (
    <div className="w-[260px]">
      <div className="mb-[10px] flex items-center gap-[6px]">
        <PollIcon className="size-[14px] shrink-0 opacity-60" />
        <p className="text-body-sm font-[var(--fw-semibold)]">{poll.question}</p>
      </div>
      <div className="space-y-[6px]">
        {poll.options.map((opt, idx) => {
          const count = votes[idx] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const selected = myVote === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => void handleVote(idx)}
              disabled={!fetched || msg.id < 0}
              className="relative w-full overflow-hidden rounded-[8px] border px-[10px] py-[8px] text-left transition-all disabled:opacity-50"
              style={{ borderColor: selected ? (isMe ? "rgba(255,255,255,0.6)" : "var(--text-primary)") : (isMe ? "rgba(255,255,255,0.2)" : "var(--border-app, #e2e8f0)") }}
            >
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isMe
                    ? "rgba(255,255,255,0.5)"
                    : selected ? "rgba(99,102,241,0.65)" : "rgba(99,102,241,0.35)",
                }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-[6px]">
                  {selected && (
                    <svg viewBox="0 0 24 24" fill="none" className="size-[13px] shrink-0" style={{ color: isMe ? "rgba(255,255,255,0.9)" : "var(--text-primary)" }}>
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <span className="text-body-sm">{opt}</span>
                </div>
                <span className={`text-[11px] ${isMe ? "text-contrast-token/60" : "text-muted"}`}>{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className={`mt-[8px] text-[11px] ${isMe ? "text-contrast-token/60" : "text-muted"}`}>
        {total} {total === 1 ? "voto" : "votos"}
      </p>
    </div>
  );
}

function PollCreatorModal({ onClose, onCreate }: { onClose: () => void; onCreate: (question: string, options: string[]) => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const canCreate = question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-t-[20px] bg-app p-[var(--space-5)] md:rounded-[16px]" onClick={(e) => e.stopPropagation()}>
        <p className="mb-[var(--space-4)] text-body font-[var(--fw-semibold)] text-app">Nueva encuesta</p>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pregunta..."
          className="mb-[var(--space-3)] w-full rounded-[10px] border border-app bg-surface px-3 py-[10px] text-body-sm text-app outline-none focus:border-[var(--border-strong)]"
        />
        <div className="mb-[var(--space-3)] space-y-[8px]">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === idx ? e.target.value : o)))}
                placeholder={`Opción ${idx + 1}`}
                className="flex-1 rounded-[10px] border border-app bg-surface px-3 py-[8px] text-body-sm text-app outline-none focus:border-[var(--border-strong)]"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-muted transition-colors hover:text-red-400"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="size-[16px]"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 6 && (
          <button
            type="button"
            onClick={() => setOptions((prev) => [...prev, ""])}
            className="mb-[var(--space-4)] text-body-sm text-[var(--text-primary)] transition-opacity hover:opacity-70"
          >
            + Añadir opción
          </button>
        )}
        <div className="flex gap-[var(--space-2)]">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-app py-[10px] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => onCreate(question.trim(), options.filter((o) => o.trim()))}
            className="flex-1 rounded-full bg-[var(--text-primary)] py-[10px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentBubble({ url, name, sending, isMe }: { url: string; name: string; sending?: boolean; isMe: boolean }) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "DOC";
  const extColors: Record<string, string> = { PDF: "#E44", DOCX: "#2B7CD3", DOC: "#2B7CD3", XLSX: "#217346", XLS: "#217346", PPTX: "#D24726", PPT: "#D24726", TXT: "#888", CSV: "#217346", ZIP: "#F90", RAR: "#F90" };
  const color = extColors[ext] ?? "#888";

  return (
    <a
      href={sending ? undefined : url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex w-[220px] items-center gap-[10px] rounded-[10px] py-[2px] transition-opacity ${sending ? "pointer-events-none opacity-60" : "hover:opacity-80"}`}
    >
      {/* Icono con extensión */}
      <div className="flex size-[40px] shrink-0 flex-col items-center justify-center rounded-[8px] text-white" style={{ backgroundColor: color }}>
        <span className="text-[9px] font-bold leading-none">{ext.slice(0, 4)}</span>
      </div>
      {/* Nombre */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight">{name}</p>
        <p className="text-[11px] opacity-60">{sending ? "Subiendo..." : "Toca para abrir"}</p>
      </div>
      {/* Flecha descarga */}
      {!sending && (
        <svg viewBox="0 0 24 24" fill="none" className="size-[16px] shrink-0 opacity-50">
          <path d="M12 3v13M5 13l7 7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </a>
  );
}

function AttachPlusIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v10M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 19v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DocIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PhotoVideoIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="2" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 9l6-3v12l-6-3V9Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function AudioFileIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M9 18V6l12-2v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function PollIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="3" y="14" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="9" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="17" y="4" width="4" height="17" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PhoneCallIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.08 6.08l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VideoCallIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <polygon points="23 7 16 12 23 17 23 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function Lightbox({ url, imageUrls, onClose }: { url: string; imageUrls: string[]; onClose: () => void }) {
  const [current, setCurrent] = useState(url);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const idx = imageUrls.indexOf(current);
  const hasPrev = idx > 0;
  const hasNext = idx < imageUrls.length - 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) setCurrent(imageUrls[idx - 1]);
      if (e.key === "ArrowRight" && hasNext) setCurrent(imageUrls[idx + 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, hasPrev, hasNext, imageUrls, onClose]);

  useEffect(() => {
    const el = thumbsRef.current?.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ inline: "center", behavior: "smooth" });
  }, [idx]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black" onClick={onClose}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-end p-3" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-white hover:bg-white/10">
          <svg viewBox="0 0 24 24" fill="none" className="size-6"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Main image */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {hasPrev && (
          <button type="button" onClick={() => setCurrent(imageUrls[idx - 1])} className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <svg viewBox="0 0 24 24" fill="none" className="size-6"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt="Imagen" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
        {hasNext && (
          <button type="button" onClick={() => setCurrent(imageUrls[idx + 1])} className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <svg viewBox="0 0 24 24" fill="none" className="size-6"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {imageUrls.length > 1 && (
        <div ref={thumbsRef} className="flex shrink-0 gap-2 overflow-x-auto scrollbar-hide" style={{ padding: "12px calc(50% - 28px)" }} onClick={(e) => e.stopPropagation()}>
          {imageUrls.map((u, i) => (
            <button key={u} type="button" onClick={() => setCurrent(u)} className={`shrink-0 overflow-hidden rounded-[6px] border-2 transition-all ${u === current ? "border-white" : "border-transparent opacity-50 hover:opacity-80"}`} style={{ width: 56, height: 56 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Imagen ${i + 1}`} className="size-full object-cover" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
