"use client";

import Image from "next/image";
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
} from "@/services/api/repositories/chat.repository";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";
import { useToast } from "@/components/ui/Toaster";
import { createGrupoEndpoint } from "@/services/api/endpoints/grupos.endpoint";
import { ChatConversation, BackIcon, GroupIcon } from "@/components/chat/ChatConversation";
import { SearchInput } from "@/components/ui/SearchInput";
import { Phone, Video } from "lucide-react";

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const { toastError } = useToast();
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
      toastError("No se pudieron cargar tus amigos.");
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
      toastError("No se pudo iniciar la conversación.");
    } finally {
      setStartingChatWith(null);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      toastError("No se pudo crear el grupo.");
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

  const isInChat = !!(selectedChat && user);

  /* ── Shared chat list panel content (used in both mobile & desktop) ── */
  const chatListContent = showFriendPicker ? (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)] px-[var(--space-4)] pb-[var(--space-3)] pt-mobile-safe-top md:py-[var(--space-3)]">
        <button
          type="button"
          onClick={() => {
            if (showGroupCreator) setShowGroupCreator(false);
            else setShowFriendPicker(false);
          }}
          className="flex size-[36px] items-center justify-center rounded-full transition-colors hover:bg-surface"
          aria-label="Volver"
        >
          <BackIcon className="size-[18px]" />
        </button>
        <h1 className="text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">
          {showGroupCreator ? "Nuevo grupo" : "Nueva conversación"}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-[var(--space-3)]">
        {friendsLoading ? (
          <div className="flex justify-center py-[var(--space-12)]">
            <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
          </div>
        ) : showGroupCreator ? (
          /* ── Creador de grupo ── */
          <div className="space-y-[var(--space-4)]">
            <div>
              <label className="mb-[var(--space-2)] block text-[14px] font-[var(--fw-semibold)] uppercase tracking-wide text-muted">Nombre del grupo</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ej: Viaje a Roma"
                className="h-[44px] w-full rounded-[12px] border border-app bg-surface-inset px-[14px] text-[15px] text-app outline-none transition-colors focus:border-[var(--border-strong)] placeholder:text-muted"
                autoFocus
              />
            </div>

            {selectedMemberIds.size > 0 && (
              <div className="flex flex-wrap gap-[6px]">
                {friends
                  .filter((f) => selectedMemberIds.has(f.id))
                  .map((friend) => (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => toggleMember(friend.id)}
                      className="flex items-center gap-[6px] rounded-full border border-app bg-surface px-[10px] py-[5px] text-[14px] font-[var(--fw-medium)] text-app transition-colors hover:bg-surface-inset"
                    >
                      <span>{friend.nombre.split(" ")[0]}</span>
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[12px] text-muted">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  ))}
              </div>
            )}

            <div>
              <p className="mb-[var(--space-2)] text-[14px] font-[var(--fw-semibold)] uppercase tracking-wide text-muted">Añadir miembros</p>
              {friends.length === 0 ? (
                <p className="py-[var(--space-6)] text-center text-body-sm text-muted">No tienes amigos aún</p>
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
                        className={`flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-[10px] py-[10px] text-left transition-colors hover:bg-surface ${selected ? "bg-surface" : ""}`}
                      >
                        <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                          {friend.profile_image ? (
                            <Image src={friend.profile_image} alt={friend.nombre} width={34} height={34} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                          ) : avatarLabel}
                        </div>
                        <p className="min-w-0 flex-1 truncate text-body-sm font-[var(--fw-medium)] text-app">{friend.nombre}</p>
                        <div className={`flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors ${selected ? "border-[var(--text-primary)] bg-[var(--text-primary)]" : "border-[var(--border-strong)]"}`}>
                          {selected && (
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[13px] text-contrast-token">
                              <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-app pb-[var(--space-3)] pt-[var(--space-2)]">
              <button
                type="button"
                onClick={() => void handleCreateGroup()}
                disabled={!groupName.trim() || selectedMemberIds.size === 0 || creatingGroup}
                className="w-full rounded-full bg-[var(--text-primary)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {creatingGroup ? "Creando..." : `Crear grupo${selectedMemberIds.size > 0 ? ` (${selectedMemberIds.size})` : ""}`}
              </button>
            </div>
          </div>
        ) : friends.length === 0 ? (
          <div className="py-[var(--space-8)] text-center text-body-sm text-muted">No tienes amigos aún</div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setShowGroupCreator(true)}
              className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-[10px] py-[12px] text-left transition-colors hover:bg-surface"
            >
              <div className="avatar-md flex shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)]">
                <GroupIcon className="size-[16px] text-contrast-token" />
              </div>
              <div>
                <p className="text-body-sm font-[var(--fw-semibold)] text-app">Nuevo grupo</p>
                <p className="text-[14px] leading-[16px] text-muted">Crea un chat con varios amigos</p>
              </div>
            </button>

            <div className="my-[var(--space-2)] border-t border-app" />

            <p className="mb-[var(--space-1)] px-[10px] pt-[var(--space-1)] text-[14px] font-[var(--fw-semibold)] uppercase tracking-wide text-muted">Amigos</p>

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
                    className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-[10px] py-[10px] text-left transition-colors hover:bg-surface disabled:opacity-50"
                  >
                    <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                      {friend.profile_image ? (
                        <Image src={friend.profile_image} alt={friend.nombre} width={34} height={34} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                      ) : avatarLabel}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-body-sm font-[var(--fw-medium)] text-app">{friend.nombre}</p>
                    {isStarting && (
                      <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-[var(--space-4)] pb-[var(--space-8)] pt-mobile-safe-top md:pb-[var(--space-8)] md:pt-[var(--space-3)]">
        <h1 className="text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">Mensajes</h1>
      </div>

      {/* Search bar */}
      <div className="px-[var(--space-4)] pb-[var(--space-3)]">
        <SearchInput
          value={searchValue}
          onChange={setSearchValue}
          className="h-[40px] w-full"
        />
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {chatsLoading ? (
          <ChatListSkeleton />
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-[var(--space-3)] py-[var(--space-12)] text-center">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-12 opacity-20">
              <path d="M21 3L10 14" stroke="currentColor" strokeWidth="1.8" />
              <path d="M21 3L14.5 21L10 14L3 9.5L21 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
            <p className="text-body-sm text-muted">
              {searchValue.trim() ? "No se encontraron conversaciones" : "No tienes conversaciones aún"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col px-2">
            {filteredChats.map((chat) => {
              const name = resolveChatName(chat, user?.id ?? "");
              const avatar = resolveChatAvatar(chat, user?.id ?? "");
              const hasUnread = chat.unread_count > 0;
              const isSelected = chat.chat_id === selectedChatId;
              const lastMsgRaw = (() => { const m = chat.last_message ?? ""; try { return JSON.parse(m)?.type === "poll" ? "📊 Encuesta" : m; } catch { return m; } })();
              const callPreview = (() => {
                if (!lastMsgRaw.includes("Llamada") && !lastMsgRaw.includes("Videollamada")) return null;
                const missed = lastMsgRaw.includes("perdida");
                const isVideo = lastMsgRaw.includes("Video");
                const label = missed ? (isVideo ? "Videollamada perdida" : "Llamada perdida") : (isVideo ? "Videollamada" : "Llamada de audio");
                return { isVideo, missed, label };
              })();
              return (
                <button
                  key={chat.chat_id}
                  type="button"
                  onClick={() => {
                    setSelectedChatId(chat.chat_id);
                    setChats((prev) => prev.map((c) => c.chat_id !== chat.chat_id ? c : { ...c, unread_count: 0 }));
                  }}
                  className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-[10px] text-left transition-colors focus:outline-none ${isSelected ? "bg-surface" : "hover:bg-surface"}`}
                >
                  <div className="relative shrink-0 self-start mt-[1px]">
                    <ChatPreviewAvatar name={name} image={avatar} isGroup={chat.tipo === "GRUPO"} />
                    {hasUnread && (
                      <span className="absolute -right-[3px] -top-[3px] flex min-w-[18px] h-[18px] items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--primary)] px-[3px] text-[10px] font-[700] text-white leading-none">
                        {chat.unread_count > 9 ? "9+" : chat.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-[2px]">
                      <p className={`truncate text-[15px] ${hasUnread ? "font-[700]" : "font-[600]"} text-app`}>{name}</p>
                      <span className="shrink-0 text-[12px] text-muted tabular-nums">{formatChatTime(chat.last_message_at)}</span>
                    </div>
                    <p className={`truncate text-[13px] leading-[1.4] ${hasUnread ? "font-[600] text-app" : "text-muted"}`}>
                      {callPreview ? (
                        <span className={`flex items-center gap-1 ${callPreview.missed ? "text-red-700 dark:text-red-800" : ""}`}>
                          {callPreview.isVideo ? <Video className="size-3 shrink-0" /> : <Phone className="size-3 shrink-0" />}
                          <span className="truncate">{callPreview.label}</span>
                        </span>
                      ) : lastMsgRaw}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  /* ── Chat conversation panel (shared) ── */
  const chatPanel = selectedChat && user ? (
    <ChatConversation
      chat={selectedChat}
      currentUserId={user.id}
      containerClassName="flex h-full flex-col pt-[var(--space-2)]"
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
  ) : null;

  return (
    <div className="h-dvh bg-app text-app">
      <div className="relative h-full">
        <AppSidebar hideMobileNav={isInChat} onCreateConversation={() => void openFriendPicker()} />

        {/* Sliding two-panel layout */}
        <div className="h-full overflow-hidden md:ml-[102px]">
          {/* Inner track: 200% wide on mobile so each panel = viewport width; slides left when chat is open */}
          <div
            className={`flex h-full w-[200%] md:w-full transition-transform duration-300 [transition-timing-function:var(--ease-standard)] ${
              isInChat ? "-translate-x-1/2 md:translate-x-0" : "translate-x-0"
            }`}
          >
            {/* Left panel – chat list */}
            <div className="h-full w-1/2 shrink-0 overflow-hidden pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] md:w-[340px] md:border-r md:border-app md:pb-0 lg:w-[380px]">
              {chatListContent}
            </div>

            {/* Right panel – conversation */}
            <div className="h-full w-1/2 shrink-0 overflow-hidden md:w-0 md:shrink md:flex-1 md:min-w-0">
              {chatPanel ?? (
                <div className="flex h-full flex-col items-center justify-center gap-[var(--space-3)] text-center">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-16 opacity-[0.12]">
                    <path d="M21 3L10 14" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M21 3L14.5 21L10 14L3 9.5L21 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                  <p className="text-body-sm text-muted">Selecciona una conversación</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatListSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-3)]" aria-label="Cargando conversaciones" role="status">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-[var(--space-3)]">
          <div className="skeleton-shimmer size-12 shrink-0 rounded-full" />
          <div className="skeleton-shimmer h-[14px] w-[148px] rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ChatPreviewAvatar({ name, image, isGroup }: { name: string; image: string | null; isGroup: boolean }) {
  if (image) {
    return (
      <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-app">
        <Image src={image} alt={name} fill sizes="48px" className="object-cover" unoptimized referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-app bg-surface-2 text-[15px] font-[700] text-muted">
      {isGroup ? <GroupIcon className="size-[20px] text-muted" /> : (name.trim()[0] || "U").toUpperCase()}
    </div>
  );
}
