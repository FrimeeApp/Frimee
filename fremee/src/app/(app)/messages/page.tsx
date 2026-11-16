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
  sendMensaje,
  resolveChatName,
  resolveChatAvatar,
  type ChatListItem,
} from "@/services/api/repositories/chat.repository";
import { useToast } from "@/components/ui/Toaster";
import { ChatConversation, GroupIcon } from "@/components/chat/ChatConversation";
import { momentPreview } from "@/components/chat/bitacora/moments";
import { ChatSearch } from "@/components/chat/nuevo/ChatSearch";
import { DraftDirectChat } from "@/components/chat/nuevo/DraftDirectChat";
import { NewGroupPicker, NewGroupPreview, useNewGroup } from "@/components/chat/nuevo/NewGroup";
import { useFriends, type Friend } from "@/components/chat/nuevo/people";
import { notifyChatAdded } from "@/components/chat/notifyChatAdded";
import { UserPlus } from "lucide-react";
import { ChatList, ChatListSkeleton, type ChatFilter } from "@/components/chat/lista/ChatList";
import { fetchPlanUserRol } from "@/services/api/endpoints/plans.endpoint";

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
  /** A search result in the middle of a chat: open it at that message. */
  const [jumpTo, setJumpTo] = useState<{ chatId: string; mensajeId: number } | null>(null);
  const feedSupabaseRef = useRef(createBrowserSupabaseClient());

  // Buscador, chat 1 a 1 que aún no existe y «Nuevo grupo» (tableros nc-*).
  const [searchActive, setSearchActive] = useState(false);
  const [listFilter, setListFilter] = useState<ChatFilter>("todos");
  const [draftFriend, setDraftFriend] = useState<Friend | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const { state: friends, load: loadFriends } = useFriends();
  const newGroup = useNewGroup();
  const creatingGroupRef = useRef(false);

  const openChat = (chatId: string, mensajeId?: number) => {
    setDraftFriend(null);
    setJumpTo(mensajeId ? { chatId, mensajeId } : null);
    setSelectedChatId(chatId);
    setChats((prev) => prev.map((c) => (c.chat_id !== chatId ? c : { ...c, unread_count: 0 })));
  };

  const openNewGroup = () => {
    newGroup.reset();
    setSearchActive(false);
    setDraftFriend(null);
    setSelectedChatId(null);
    setNewGroupOpen(true);
    void loadFriends();
  };

  /** A friend from the search: their chat if it exists, else an empty one that is created on the first message. */
  const startChatWith = (friend: Friend) => {
    const existing = chats.find((c) => c.tipo === "DIRECTO" && c.miembros.some((m) => m.id === friend.id));
    if (existing) { openChat(existing.chat_id); return; }
    setSelectedChatId(null);
    setJumpTo(null);
    setDraftFriend(friend);
  };

  const sendFirstMessage = async (friend: Friend, texto: string) => {
    try {
      const chatId = await getOrCreateDirectoChat(friend.id);
      await sendMensaje({ chatId, texto });
      notifyChatAdded([friend.id], chatId);
      await loadChats();
      setDraftFriend(null);
      setJumpTo(null);
      setSelectedChatId(chatId);
    } catch (e) {
      console.error("[mensajes] Error empezando el chat:", (e as { message?: string })?.message ?? String(e));
      // Said by the composer, in one line above the box; the text stays there to retry.
      throw new Error(failMessage(e, "El mensaje no se ha enviado"));
    }
  };

  /** Chat + group + members in one go (fn_chat_create_grupo); then the first message, if any. */
  const createGroup = async (primerMensaje?: string) => {
    if (creatingGroupRef.current || !newGroup.valid) return;
    creatingGroupRef.current = true;
    newGroup.setCreating(true);
    const miembros = newGroup.selected.map((p) => p.id);
    try {
      const chatId = await createGrupoChat({ nombre: newGroup.nombre.trim(), miembros });
      if (primerMensaje) {
        try {
          await sendMensaje({ chatId, texto: primerMensaje });
        } catch (e) {
          console.error("[mensajes] Error enviando el primer mensaje del grupo:", (e as { message?: string })?.message ?? String(e));
          toastError("El grupo se ha creado, pero el mensaje no se pudo enviar.");
        }
      }
      notifyChatAdded(miembros, chatId);
      await loadChats();
      setNewGroupOpen(false);
      newGroup.reset();
      openChat(chatId);
    } catch (e) {
      console.error("[mensajes] Error creando el grupo:", (e as { message?: string })?.message ?? String(e));
      // Next to the create button; the composer (if it came from there) keeps its text quietly.
      newGroup.setError(failMessage(e, "No se ha creado el grupo"));
      newGroup.setCreating(false);
      throw new Error("");
    } finally {
      creatingGroupRef.current = false;
    }
  };

  const loadChats = useCallback(async () => {
    try {
      const data = await listChats();
      setChats(data);
    } catch (e) {
      console.error("[messages] Error cargando chats:", (e as { message?: string })?.message || String(e));
    } finally {
      setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadChats();
  }, [user, loadChats]);

  // /messages?chat=<id>[&m=<mensaje>] (a plan made from a chat, the link back to the original, a
  // reopened poll from a notification): open it once, at that message if there is one.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("chat");
    if (!id) return;
    const m = Number(q.get("m"));
    if (Number.isFinite(m) && m > 0) setJumpTo({ chatId: id, mensajeId: m });
    setSelectedChatId(id);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

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

  // A plan's chat opened from here needs the role too: @frimee proposals and /tarea depend on it.
  const selectedPlanId = chats.find((c) => c.chat_id === selectedChatId)?.plan_id ?? null;
  const [planAdminFor, setPlanAdminFor] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedPlanId || !user) return;
    let cancelled = false;
    fetchPlanUserRol(selectedPlanId, user.id)
      .then((rol) => { if (!cancelled) setPlanAdminFor(rol === "ADMIN" ? selectedPlanId : null); })
      .catch((e) => console.error("[mensajes] Error leyendo el rol en el plan:", (e as { message?: string })?.message ?? String(e)));
    return () => { cancelled = true; };
  }, [selectedPlanId, user]);

  // «Nuevo grupo» on desktop: Escape goes back to Messages without creating anything.
  useEffect(() => {
    if (!newGroupOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) setNewGroupOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newGroupOpen]);

  if (loading) return <LoadingScreen />;

  const selectedChat = chats.find((c) => c.chat_id === selectedChatId) ?? null;

  const isInChat = !!((selectedChat || draftFriend) && user);
  // Searching on a phone: no bottom bar nor bell (it would sit over «Cancelar»).
  const hideMobileChrome = isInChat || newGroupOpen || searchActive;

  /* ── Shared chat list panel content (used in both mobile & desktop) ── */
  const chatListContent = newGroupOpen && user ? (
    <NewGroupPicker
      g={newGroup}
      friends={friends}
      onLoadFriends={(force) => void loadFriends(force)}
      chats={chats}
      userId={user.id}
      onBack={() => setNewGroupOpen(false)}
      onCreate={() => void createGroup().catch(() => {})}
    />
  ) : (
    <div className="flex h-full flex-col">
      {/* Header: «Mensajes» and the «Nuevo grupo» button (on phones the search takes the top while open) */}
      {/* Phones: the bell is fixed at the top right (AppSidebar, --page-margin-x + 44 px), so the header leaves it that room. */}
      <div className={`items-center justify-between gap-[var(--space-2)] pb-[var(--space-6)] pl-[var(--space-4)] pr-[calc(var(--page-margin-x)+48px)] pt-mobile-safe-top md:flex md:pr-[var(--space-2)] md:pt-[var(--space-3)] ${searchActive ? "hidden" : "flex"}`}>
        <h1 className="text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">Mensajes</h1>
        <button
          type="button"
          onClick={openNewGroup}
          aria-label="Nuevo grupo"
          title="Nuevo grupo"
          className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-app transition-colors hover:bg-[var(--chat-surface)]"
        >
          <UserPlus className="size-[22px]" aria-hidden />
        </button>
      </div>
      {searchActive && <div className="pt-mobile-safe-top md:hidden" />}

      {user && (
        <ChatSearch
          active={searchActive}
          onActiveChange={setSearchActive}
          chats={chats}
          userId={user.id}
          friends={friends}
          onLoadFriends={(force) => void loadFriends(force)}
          onOpenChat={openChat}
          onStartChat={startChatWith}
        />
      )}

      {/* Chat list (boards li-*): filters, 3 trips on top in «Todos» */}
      {!searchActive && (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {chatsLoading ? (
            <ChatListSkeleton />
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-[var(--space-3)] px-[var(--space-6)] py-[var(--space-12)] text-center">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-12 opacity-20">
                <path d="M21 3L10 14" stroke="currentColor" strokeWidth="1.8" />
                <path d="M21 3L14.5 21L10 14L3 9.5L21 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
              <p className="text-body-sm text-muted">No tienes conversaciones aún. Busca a un amigo arriba para escribirle.</p>
            </div>
          ) : (
            <ChatList
              chats={chats}
              userId={user?.id ?? ""}
              selectedChatId={selectedChatId}
              filter={listFilter}
              onFilter={setListFilter}
              onOpen={openChat}
            />
          )}
        </div>
      )}
    </div>
  );

  /* ── Chat conversation panel (shared) ── */
  const chatPanel = selectedChat && user ? (
    <ChatConversation
      key={`${selectedChat.chat_id}:${jumpTo?.chatId === selectedChat.chat_id ? jumpTo.mensajeId : ""}`}
      chat={selectedChat}
      initialMessageId={jumpTo?.chatId === selectedChat.chat_id ? jumpTo.mensajeId : undefined}
      currentUserId={user.id}
      planId={selectedChat.plan_id ?? undefined}
      isAdmin={Boolean(selectedChat.plan_id) && planAdminFor === selectedChat.plan_id}
      planInfo={selectedChat.plan_id && selectedChat.plan_inicio_at && selectedChat.plan_fin_at ? {
        titulo: selectedChat.plan_titulo ?? "",
        inicio_at: selectedChat.plan_inicio_at,
        fin_at: selectedChat.plan_fin_at,
        ubicacion_nombre: selectedChat.plan_ubicacion ?? "",
      } : undefined}
      containerClassName="flex h-full flex-col pt-[var(--space-2)]"
      onBack={() => { setSelectedChatId(null); setJumpTo(null); void loadChats(); }}
      backOnPhoneOnly
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
        const preview = msg.audio_url ? "🎤 Nota de voz" : msg.document_url ? `📄 ${msg.document_name ?? "Documento"}` : msg.image_url ? (msg.image_type?.startsWith("video/") ? "🎥 Vídeo" : "📷 Foto") : (momentPreview(msg.texto) ?? msg.texto);
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
      onOpenChat={(id) => { void loadChats().then(() => openChat(id)); }}
      onChatChanged={() => { void loadChats(); }}
      onRenamed={(nombre) => {
        setChats((prev) => prev.map((c) => (c.chat_id !== selectedChatId ? c : { ...c, nombre })));
      }}
      onWriteTo={(person) => startChatWith(person)}
    />
  ) : draftFriend && user ? (
    <DraftDirectChat
      key={draftFriend.id}
      friend={draftFriend}
      onBack={() => setDraftFriend(null)}
      onSend={(texto) => sendFirstMessage(draftFriend, texto)}
    />
  ) : null;

  return (
    <div className="h-dvh bg-app text-app">
      <div className="relative h-full">
        <AppSidebar hideMobileNav={hideMobileChrome} onCreateGroup={openNewGroup} />

        {/* Sliding two-panel layout */}
        <div className="h-full overflow-hidden md:ml-[102px]">
          {/* Inner track: 200% wide on mobile so each panel = viewport width; slides left when chat is open */}
          <div
            className={`flex h-full w-[200%] md:w-full transition-transform duration-300 [transition-timing-function:var(--ease-standard)] ${
              isInChat ? "-translate-x-1/2 md:translate-x-0" : "translate-x-0"
            }`}
          >
            {/* Left panel – chat list */}
            <div className={`h-full w-1/2 shrink-0 overflow-hidden md:w-[340px] md:border-r md:border-app md:pb-0 lg:w-[380px] ${newGroupOpen || searchActive ? "pb-0" : "pb-[calc(var(--space-20)+env(safe-area-inset-bottom))]"}`}>
              {chatListContent}
            </div>

            {/* Right panel – conversation */}
            <div className="h-full w-1/2 shrink-0 overflow-hidden md:w-0 md:shrink md:flex-1 md:min-w-0">
              {newGroupOpen ? (
                <div className="hidden h-full md:block">
                  <NewGroupPreview g={newGroup} onCreate={createGroup} />
                </div>
              ) : chatPanel ?? (
                <div className="flex h-full flex-col items-center justify-center gap-[var(--space-2)] px-[var(--space-6)] text-center">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-16 opacity-[0.12]">
                    <path d="M21 3L10 14" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M21 3L14.5 21L10 14L3 9.5L21 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                  <p className="[font-family:var(--font-display-face)] text-[24px] text-app">Elige un chat</p>
                  <p className="max-w-[300px] text-body-sm text-muted">Para escribir a un amigo, búscalo arriba. Para varios, crea un grupo.</p>
                  <button
                    type="button"
                    onClick={openNewGroup}
                    className="mt-[var(--space-2)] inline-flex min-h-[44px] items-center gap-[8px] rounded-[8px] border border-app px-[16px] text-[15px] font-[var(--fw-semibold)] text-app hover:bg-[var(--chat-surface)]"
                  >
                    <GroupIcon className="size-[18px]" />
                    Nuevo grupo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** What fn_chat_create_grupo / fn_chat_get_or_create_directo refuse on purpose, said as they say it. */
const DB_MESSAGES = [
  "El grupo necesita un nombre",
  "El nombre del grupo es demasiado largo",
  "Elige al menos 2 personas",
  "Solo puedes añadir a tus amigos",
  "Solo puedes escribir a tus amigos",
];
function dbMessage(e: unknown): string | null {
  const msg = (e as { message?: string } | null)?.message ?? "";
  return DB_MESSAGES.find((m) => msg.includes(m)) ?? null;
}

/** One short line for a failed send or create: the database's reason, no connection, or retry. */
function failMessage(e: unknown, what: string): string {
  const db = dbMessage(e);
  if (db) return `${db}.`;
  if (typeof navigator !== "undefined" && !navigator.onLine) return `Sin conexión. ${what}.`;
  return `${what}. Inténtalo de nuevo.`;
}
