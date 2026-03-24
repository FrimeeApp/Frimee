"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import { getFeedPostsOnly, getFeedLikes } from "@/services/api/repositories/feed.repository";
import { countNotificacionesNoLeidas, insertNotificacion, deleteNotificacionLike } from "@/services/api/repositories/notifications.repository";
import NotificationsPanel from "@/components/notifications/NotificationsPanel";
import type { FeedItemDto } from "@/services/api/dtos/feed.dto";
import { publishPlanAsPost } from "@/services/api/repositories/post.repository";
import { togglePlanLike } from "@/services/api/repositories/likes.repository";
import {
  createComment,
  deleteComment,
  listCommentsForPlan,
  type CommentDto,
} from "@/services/api/repositories/comments.repository";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";
import { fetchActiveFriends } from "@/services/api/endpoints/users.endpoint";
import {
  listChats,
  listMensajes,
  sendMensaje,
  markChatRead,
  resolveChatName,
  resolveChatAvatar,
  formatChatTime,
} from "@/services/api/repositories/chat.repository";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import AudioPlayer from "@/components/common/AudioPlayer";

const EMOJI_LIST = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊",
  "😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋",
  "😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🤫","🤔",
  "😐","😑","😶","🫡","😏","😒","🙄","😬","😮‍💨","🤥",
  "😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮",
  "🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
  "❤️‍🔥","💕","💞","💓","💗","💖","💘","💝","💟","♥️",
  "👍","👎","👏","🙌","🤝","🤜","🤛","✊","👊","🫶",
  "🤞","✌️","🤟","🤘","👌","🤌","👋","🤚","✋","🖖",
  "🔥","✨","🌟","💫","⭐","🎉","🎊","🎈","🎁","🏆",
  "✈️","🌍","🌎","🌏","🗺️","🏖️","🏔️","🌅","🌄","🌠",
  "🍕","🍔","🍟","🌮","🍣","🍩","🍪","🎂","🍰","☕",
  "💪","🦾","👀","👁️","🫣","😈","👿","💀","☠️","👻",
];
const COMMENT_AUTHOR_CACHE_TTL_MS = 60_000;
const commentAuthorCache = new Map<string, { name: string; profileImage: string | null; cachedAt: number }>();

const FEED_CACHE_KEY = "fremee:feed:v2";
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;
const FRIENDS_CACHE_KEY = "fremee:friends:v1";
const FRIENDS_CACHE_TTL_MS = 2 * 60 * 1000;

function readFeedCache(userId: string): FeedItemDto[] | null {
  try {
    const raw = localStorage.getItem(`${FEED_CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items: FeedItemDto[]; savedAt: number };
    if (Date.now() - parsed.savedAt > FEED_CACHE_TTL_MS) return null;
    return parsed.items;
  } catch { return null; }
}

function writeFeedCache(userId: string, items: FeedItemDto[]) {
  try {
    localStorage.setItem(`${FEED_CACHE_KEY}:${userId}`, JSON.stringify({ items, savedAt: Date.now() }));
  } catch { /* ignorar errores de storage */ }
}

function readFriendsCache(userId: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(`${FRIENDS_CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ids: string[]; savedAt: number };
    if (Date.now() - parsed.savedAt > FRIENDS_CACHE_TTL_MS) return null;
    return new Set(parsed.ids);
  } catch { return null; }
}

function writeFriendsCache(userId: string, ids: string[]) {
  try {
    localStorage.setItem(`${FRIENDS_CACHE_KEY}:${userId}`, JSON.stringify({ ids, savedAt: Date.now() }));
  } catch { /* ignorar errores de storage */ }
}

function preloadImagesBackground(urls: string[]) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  uniqueUrls.forEach((url) => {
    const img = new Image();
    img.src = url;
  });
}

export default function FeedPage() {
  const { user, loading, profile } = useAuth();
  const currentUserId = user?.id ?? null;
  const [activeFeedTab, setActiveFeedTab] = useState<"following" | "explore">("explore");
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [firstImageReady, setFirstImageReady] = useState(false);
  const [uiPosts, setUiPosts] = useState<FeedItemDto[]>([]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const lastProfileUpdatedAtRef = useRef<string | null>(null);
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const followingTabRef = useRef<HTMLButtonElement | null>(null);
  const exploreTabRef = useRef<HTMLButtonElement | null>(null);
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, ready: false });
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [friendIds, setFriendIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    return new Set();
  });

  useEffect(() => {
    if (!currentUserId) {
      setUiPosts([]);
      setLoadingFeed(false);
      return;
    }

    // Cargar caché de amigos inmediatamente
    const cachedFriends = readFriendsCache(currentUserId);
    if (cachedFriends) setFriendIds(cachedFriends);

    let cancelled = false;

    const load = async () => {
      // 1. Mostrar caché inmediatamente — sin skeleton si hay datos previos
      const cached = readFeedCache(currentUserId);
      if (cached && cached.length > 0) {
        setUiPosts(cached);
        setLoadingFeed(false);
        setFirstImageReady(true);
      } else {
        setLoadingFeed(true);
      }

      try {
        // 2. Posts + amigos en paralelo — ninguno bloquea al otro
        const [posts, friends] = await Promise.all([
          getFeedPostsOnly({ limit: 20 }),
          fetchActiveFriends(),
        ]);
        if (cancelled) return;

        const newFriendIds = new Set(friends.map((f) => f.id));
        setFriendIds(newFriendIds);
        writeFriendsCache(currentUserId, [...newFriendIds]);

        const firstWithImage = posts.find((p) => p.coverImage);
        if (!firstWithImage) setFirstImageReady(true);
        setUiPosts(posts);
        setLoadingFeed(false);
        writeFeedCache(currentUserId, posts);

        // 3. Precargar imágenes en background — no bloquea nada
        const imageUrls = posts.flatMap((p) =>
          [p.coverImage, p.avatarImage].filter((u): u is string => Boolean(u))
        );
        preloadImagesBackground(imageUrls);

        // 4. Fetch likes en background — actualiza sin re-renderizar todo
        const planIds = posts.map((p) => p.plan.id);
        if (planIds.length > 0) {
          const { likedSet, counts } = await getFeedLikes({ userId: currentUserId, planIds });
          if (cancelled) return;
          setUiPosts((prev) =>
            prev.map((p) => ({
              ...p,
              initiallyLiked: likedSet.has(p.plan.id),
              initialLikeCount: counts[p.plan.id] ?? 0,
            }))
          );
        }
      } catch (e) {
        console.error("[feed] load error", e);
        if (!cached || cached.length === 0) setUiPosts([]);
        if (!cancelled) setLoadingFeed(false);
      }
    };

    void load();

    return () => { cancelled = true; };
  }, [currentUserId, reloadNonce]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkProfileUpdate = () => {
      const marker = window.localStorage.getItem("fremee.profile.updated_at");
      if (!marker || marker === lastProfileUpdatedAtRef.current) return;

      lastProfileUpdatedAtRef.current = marker;
      commentAuthorCache.clear();
      setReloadNonce((prev) => prev + 1);
    };

    checkProfileUpdate();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        checkProfileUpdate();
      }
    };

    window.addEventListener("focus", checkProfileUpdate);
    window.addEventListener("pageshow", checkProfileUpdate);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", checkProfileUpdate);
      window.removeEventListener("pageshow", checkProfileUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const updateIndicator = () => {
      const row = tabRowRef.current;
      const target = activeFeedTab === "following" ? followingTabRef.current : exploreTabRef.current;
      if (!row || !target) return;

      const rowRect = row.getBoundingClientRect();
      const tabRect = target.getBoundingClientRect();
      setTabIndicator({
        left: tabRect.left - rowRect.left,
        width: tabRect.width,
        ready: true,
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeFeedTab]);

  // Unread notifications badge
  useEffect(() => {
    if (!currentUserId) return;
    const refresh = () => void countNotificacionesNoLeidas().then(setUnreadNotifs);
    refresh();

    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`notif-badge-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones", filter: `user_id=eq.${currentUserId}` },
        () => setUnreadNotifs((prev) => prev + 1)
      )
      .subscribe();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main
          className={`px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] md:py-[var(--space-8)] md:pr-[var(--space-14)]`}
        >
          <div className="mx-auto grid max-w-[1160px] grid-cols-1 gap-[var(--space-8)] xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-[var(--space-10)]">
            <section className="mx-auto w-full max-w-[760px]">
              <div
                ref={tabRowRef}
                className="relative flex gap-[var(--space-10)] border-b border-app pb-[var(--space-2)] text-body text-muted"
              >
                <button
                  ref={followingTabRef}
                  type="button"
                  onClick={() => setActiveFeedTab("following")}
                  className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                    activeFeedTab === "following" ? "text-app" : "hover:text-app"
                  }`}
                >
                  Siguiendo
                </button>
                <button
                  ref={exploreTabRef}
                  type="button"
                  onClick={() => setActiveFeedTab("explore")}
                  className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                    activeFeedTab === "explore" ? "text-app" : "hover:text-app"
                  }`}
                >
                  Explorar
                </button>
                <Link
                  href="/search"
                  aria-label="Buscar"
                  className="ml-auto pb-[var(--space-2)] text-app transition-opacity duration-[var(--duration-base)] hover:opacity-70"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[20px]">
                    <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </Link>
                <button
                  type="button"
                  onClick={() => setNotifPanelOpen(true)}
                  aria-label="Notificaciones"
                  className="relative pb-[var(--space-2)] text-app transition-opacity duration-[var(--duration-base)] hover:opacity-70"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[20px]">
                    <path
                      d="M6 10.5C6 7.46 8.24 5 12 5s6 2.46 6 5.5v3l1.5 2.5H4.5L6 13.5v-3Z"
                      stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
                    />
                    <path
                      d="M10 17.5a2 2 0 0 0 4 0"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                    />
                  </svg>
                  {unreadNotifs > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-[14px] items-center justify-center rounded-full bg-blue-500 text-white text-[9px] font-[var(--fw-semibold)] leading-none">
                      {unreadNotifs > 9 ? "9+" : unreadNotifs}
                    </span>
                  )}
                </button>
                <span
                  className={`pointer-events-none absolute bottom-0 h-[2px] bg-black transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] dark:bg-white ${
                    tabIndicator.ready ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ left: tabIndicator.left, width: tabIndicator.width }}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-[var(--space-5)]">
                {loadingFeed || !firstImageReady ? (
                  <>
                    <FeedSkeleton />
                    {!loadingFeed && uiPosts.length > 0 && (
                      <div className="sr-only" aria-hidden="true">
                        {uiPosts.filter((p) => p.coverImage).slice(0, 1).map((post) => (
                          <img key={post.id} src={post.coverImage!} onLoad={() => setFirstImageReady(true)} onError={() => setFirstImageReady(true)} alt="" />
                        ))}
                      </div>
                    )}
                  </>
                ) : (() => {
                  const visiblePosts = activeFeedTab === "following"
                    ? uiPosts.filter((p) => p.plan.ownerUserId && friendIds.has(p.plan.ownerUserId))
                    : uiPosts;
                  return visiblePosts.length === 0 ? (
                    <div className="rounded-modal border border-app bg-surface p-[var(--space-5)] text-body text-muted shadow-elev-1">
                      {activeFeedTab === "following"
                        ? "Aún no hay publicaciones de tus amigos."
                        : "Aun no hay publicaciones para mostrar."}
                    </div>
                  ) : (
                    <div className="space-y-[var(--space-3)]">
                      {visiblePosts.map((post, idx) => (
                        <FeedCard key={post.id} post={post} currentUserId={currentUserId} currentUserName={profile?.nombre ?? null} currentUserProfileImage={profile?.profile_image ?? null} nextPostHasImage={visiblePosts[idx + 1]?.hasImage ?? true} />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </section>

            <aside className="hidden xl:block">
              <div className="sticky top-[var(--space-8)]">
                <FeedChatPanel currentUserId={currentUserId} />
              </div>
            </aside>
          </div>
        </main>
      </div>

      <NotificationsPanel
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        onRead={() => setUnreadNotifs(0)}
      />
    </div>
  );
}

function FeedChatPanel({ currentUserId }: { currentUserId: string | null }) {
  const supabase = createBrowserSupabaseClient();
  const [chats, setChats] = useState<import("@/services/api/repositories/chat.repository").ChatListItem[]>([]);
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<import("@/services/api/repositories/chat.repository").MensajeRow[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const channelsMapRef = useRef(new Map<string, ReturnType<typeof supabase.channel>>());
  const openChatIdRef = useRef<string | null>(null);
  openChatIdRef.current = openChatId;

  const openChat = chats.find((c) => c.chat_id === openChatId) ?? null;

  useEffect(() => {
    if (!currentUserId) return;
    void listChats().then(setChats).catch(console.error);
  }, [currentUserId]);

  // Detectar cuando el usuario es añadido a un nuevo chat
  useEffect(() => {
    if (!currentUserId) return;
    const ch = supabase
      .channel(`user-join:${currentUserId}`)
      .on("broadcast", { event: "chat_added" }, () => {
        void listChats().then(setChats).catch(console.error);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [currentUserId, supabase]);

  // Un canal msg:${chatId} por chat — actualiza preview siempre y mensajes si está abierto
  const chatIdsKey = chats.map((c) => c.chat_id).join(",");
  useEffect(() => {
    if (chats.length === 0) return;
    const map = new Map<string, ReturnType<typeof supabase.channel>>();
    chats.forEach((c) => {
      const ch = supabase
        .channel(`msg:${c.chat_id}`)
        .on("broadcast", { event: "new_message" }, ({ payload }) => {
          const msg = payload as import("@/services/api/repositories/chat.repository").MensajeRow;
          const isOpen = openChatIdRef.current === c.chat_id;
          const preview = msg.tipo?.startsWith("call_")
            ? (msg.tipo.includes("missed") ? (msg.tipo.includes("video") ? "📵 Videollamada perdida" : "📵 Llamada perdida") : (msg.tipo.includes("video") ? "📹 Videollamada" : "📞 Llamada de audio"))
            : msg.audio_url ? "🎤 Nota de voz"
            : msg.document_url ? `📄 ${msg.document_name ?? "Documento"}`
            : msg.image_url ? (msg.image_type?.startsWith("video/") ? "🎥 Vídeo" : "📷 Foto")
            : msg.texto;
          setChats((prev) => {
            const updated = prev.map((chat) =>
              chat.chat_id !== c.chat_id ? chat : {
                ...chat,
                last_message: preview,
                last_message_at: msg.created_at,
                unread_count: (isOpen || msg.sender_id === currentUserId) ? chat.unread_count : chat.unread_count + 1,
              }
            );
            return [...updated].sort((a, b) =>
              new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
            );
          });
          if (isOpen) {
            setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
            void markChatRead(c.chat_id);
          }
        })
        .subscribe();
      map.set(c.chat_id, ch);
    });
    channelsMapRef.current = map;
    return () => {
      map.forEach((ch) => void supabase.removeChannel(ch));
      channelsMapRef.current = new Map();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdsKey]);

  // Cargar mensajes al abrir chat
  useEffect(() => {
    if (!openChatId) return;
    setMsgLoading(true);
    void listMensajes({ chatId: openChatId })
      .then(setMessages)
      .catch(console.error)
      .finally(() => setMsgLoading(false));
    void markChatRead(openChatId);
    setChats((prev) => prev.map((c) =>
      c.chat_id !== openChatId ? c : { ...c, unread_count: 0 }
    ));
  }, [openChatId]);

  // Scroll al último mensaje dentro del contenedor
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !openChatId || !openChat) return;
    setText("");
    setSending(true);
    try {
      const newId = await sendMensaje({ chatId: openChatId, texto: trimmed });
      const me = openChat.miembros.find((m) => m.id === currentUserId);
      const newMsg: import("@/services/api/repositories/chat.repository").MensajeRow = {
        id: newId,
        sender_id: currentUserId ?? "",
        sender_nombre: me?.nombre ?? "",
        sender_profile_image: me?.profile_image ?? null,
        texto: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => prev.some((m) => m.id === newId) ? prev : [...prev, newMsg]);
      setChats((prev) => prev.map((c) =>
        c.chat_id !== openChatId ? c : { ...c, last_message: trimmed, last_message_at: newMsg.created_at }
      ));
      void channelsMapRef.current.get(openChatId)?.send({ type: "broadcast", event: "new_message", payload: newMsg });
    } catch (e) {
      console.error("[feed-chat] Error enviando:", e);
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  if (openChat && currentUserId) {
    const chatName = resolveChatName(openChat, currentUserId);
    const chatAvatar = resolveChatAvatar(openChat, currentUserId);

    return (
      <div className="pt-[var(--space-10)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <button type="button" onClick={() => { setOpenChatId(null); setText(""); void listChats().then(setChats); }}
            className="flex size-[28px] items-center justify-center rounded-full transition-colors hover:bg-surface" aria-label="Volver">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[16px]">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="avatar-sm flex items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-[11px] font-[var(--fw-semibold)] text-app">
            {chatAvatar ? <img src={chatAvatar} alt={chatName} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (chatName[0] ?? "?").toUpperCase()}
          </div>
          <span className="min-w-0 truncate text-body-sm font-[var(--fw-semibold)]">{chatName}</span>
        </div>

        <div ref={scrollContainerRef} className="scrollbar-thin mt-[var(--space-4)] max-h-[340px] overflow-x-hidden overflow-y-auto overscroll-contain">
          {msgLoading ? (
            <p className="py-4 text-center text-body-sm text-muted">Cargando...</p>
          ) : (
            <div className="space-y-[1px]">
              {messages.map((msg, idx, arr) => {
                const isMe = msg.sender_id === currentUserId;
                const prevMsg = arr[idx - 1];
                const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-[var(--space-2)]" : "mt-[2px]"}`}>
                    {!isMe && openChat.tipo === "GRUPO" && (
                      <div className="mr-[6px] w-[20px] shrink-0">
                        {isFirstInGroup && (
                          <div className="flex size-[20px] items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-[9px] font-[var(--fw-semibold)] text-app">
                            {msg.sender_profile_image
                              ? <img src={msg.sender_profile_image} alt={msg.sender_nombre} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              : (msg.sender_nombre[0] ?? "?").toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-[14px] px-3 py-[6px] ${isMe ? "bg-[var(--text-primary)] text-contrast-token" : "bg-surface-inset"}`}>
                      {!isMe && openChat.tipo === "GRUPO" && isFirstInGroup && (
                        <p className="mb-[2px] text-[10px] font-[var(--fw-semibold)] text-muted">{msg.sender_nombre}</p>
                      )}
                      {msg.audio_url ? (
                        <AudioPlayer src={msg.audio_url} isMe={isMe} />
                      ) : msg.document_url ? (
                        <div className="flex items-center gap-[8px] py-[2px] opacity-80">
                          <span className="text-[18px]">📄</span>
                          <span className="truncate text-[13px]">{msg.document_name ?? "Documento"}</span>
                        </div>
                      ) : msg.image_url ? (
                        msg.image_type?.startsWith("video/") ? (
                          <video src={msg.image_url} controls playsInline className="max-w-[200px] rounded-[8px]" style={{ maxHeight: 200 }} />
                        ) : (
                          <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={msg.image_url} alt="Imagen" className="max-w-[200px] rounded-[8px] object-cover" style={{ maxHeight: 200 }} referrerPolicy="no-referrer" />
                          </a>
                        )
                      ) : msg.tipo?.startsWith("call_") ? (() => {
                          const missed = msg.tipo.includes("missed");
                          const isVideo = msg.tipo.includes("video");
                          const label = missed ? (isVideo ? "Videollamada perdida" : "Llamada perdida") : (isVideo ? "Videollamada" : "Llamada de audio");
                          const duracion = parseInt(msg.texto) || 0;
                          const mins = Math.floor(duracion / 60);
                          const secs = duracion % 60;
                          return (
                            <div className={`flex items-center gap-[8px] py-[2px] ${missed ? "opacity-60" : ""}`}>
                              <span className="text-[18px]">{missed ? "📵" : (isVideo ? "📹" : "📞")}</span>
                              <div>
                                <p className="text-[13px] font-[var(--fw-medium)]">{label}</p>
                                {!missed && duracion > 0 && <p className="text-[11px] opacity-70">{mins}:{String(secs).padStart(2, "0")}</p>}
                              </div>
                            </div>
                          );
                        })()
                      : (() => { try { const p = JSON.parse(msg.texto); if (p?.type === "poll") return <div className="flex items-center gap-[6px] py-[2px] opacity-80"><span className="text-[16px]">📊</span><span className="text-[13px]">{p.question as string}</span></div>; } catch { /* noop */ } return <p className="break-all text-body-sm">{msg.texto}</p>; })()}
                      <p className={`mt-[2px] text-right text-[10px] ${isMe ? "text-contrast-token/60" : "text-muted"}`}>{formatChatTime(msg.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="mt-[var(--space-3)] flex items-center gap-[var(--space-2)]">
          <input type="text" value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void onSend(); } }}
            placeholder="Escribe un mensaje..."
            className="min-w-0 flex-1 rounded-full border border-app bg-surface px-3 py-[6px] text-body-sm text-app outline-none transition-colors focus:border-[var(--border-strong)]" />
          <button type="button" onClick={() => void onSend()} disabled={!text.trim() || sending}
            className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-30" aria-label="Enviar">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[14px]">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[var(--space-10)]">
      <div className="flex items-center justify-between">
        <h3 className="text-[var(--font-h5)] font-[var(--fw-semibold)] leading-[var(--lh-h5)]">Mensajes</h3>
        <Link href="/messages" className="text-body-sm text-muted transition-opacity hover:opacity-70">Ver todos</Link>
      </div>
      <div className="mt-[var(--space-4)] space-y-[2px]">
        {chats.length === 0 ? (
          <p className="text-body-sm text-muted">No tienes conversaciones aún</p>
        ) : (
          chats.slice(0, 4).map((chat) => {
            const name = resolveChatName(chat, currentUserId ?? "");
            const avatar = resolveChatAvatar(chat, currentUserId ?? "");
            const hasUnread = chat.unread_count > 0;
            return (
              <button key={chat.chat_id} type="button" onClick={() => setOpenChatId(chat.chat_id)}
                className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface">
                <div className="relative shrink-0">
                  <div className="avatar-md flex items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                    {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      : chat.tipo === "GRUPO" ? <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[16px] text-muted"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" /><path d="M2 19c1-3 3.5-4.5 7-4.5s6 1.5 7 4.5" stroke="currentColor" strokeWidth="1.6" /></svg>
                      : (name[0] ?? "?").toUpperCase()}
                  </div>
                  {hasUnread && <span className="absolute -right-[2px] -top-[2px] size-[10px] rounded-full border-2 border-[var(--bg)] bg-[#ff6a3d]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-body-sm ${hasUnread ? "font-[var(--fw-semibold)]" : ""} text-app`}>{name}</p>
                  <p className={`truncate text-[12px] leading-[16px] ${hasUnread ? "font-[var(--fw-medium)] text-app" : "text-muted"}`}>{(() => { const m = chat.last_message ?? ""; try { return JSON.parse(m)?.type === "poll" ? "📊 Encuesta" : m; } catch { return m; } })()}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted">{formatChatTime(chat.last_message_at)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-[var(--space-3)]" aria-label="Cargando publicaciones" role="status">
      {/* Image post skeleton */}
      {[0, 1].map((i) => (
        <article key={`img-${i}`} className="pb-[var(--space-2)]">
          <div className="feed-image-container relative overflow-hidden">
            <div className="feed-skeleton-shimmer aspect-[4/3] w-full" />
            {/* Top overlay shimmer — avatar + name */}
            <div className="absolute inset-x-0 top-0 flex items-center gap-[var(--space-2)] px-[var(--space-4)] pt-[var(--space-3)]">
              <div className="size-[32px] rounded-full bg-white/20" />
              <div className="h-3 w-[80px] rounded-full bg-white/20" />
            </div>
            {/* Bottom overlay shimmer — location + date */}
            <div className="absolute inset-x-0 bottom-0 px-[var(--space-4)] pb-[var(--space-3)]">
              <div className="h-4 w-[140px] rounded-full bg-white/20" />
              <div className="mt-[6px] h-3 w-[100px] rounded-full bg-white/20" />
            </div>
          </div>
          {/* Actions + text shimmer */}
          <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)] px-[var(--space-1)]">
            <div className="feed-skeleton-shimmer h-[24px] w-[24px] rounded-full" />
            <div className="feed-skeleton-shimmer h-3 w-[120px] rounded-full" />
          </div>
        </article>
      ))}
      {/* Text-only post skeleton (Twitter style) */}
      <article className="pb-[var(--space-2)]">
        <div className="flex gap-[var(--space-2)] px-[var(--space-1)]">
          <div className="feed-skeleton-shimmer size-[32px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="feed-skeleton-shimmer h-3 w-[90px] rounded-full" />
            <div className="feed-skeleton-shimmer mt-[6px] h-3 w-[85%] rounded-full" />
            <div className="feed-skeleton-shimmer mt-[4px] h-3 w-[60%] rounded-full" />
            <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-4)]">
              <div className="feed-skeleton-shimmer h-[24px] w-[24px] rounded-full" />
              <div className="feed-skeleton-shimmer h-[24px] w-[24px] rounded-full" />
              <div className="feed-skeleton-shimmer h-[24px] w-[24px] rounded-full" />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function FeedCard({ post, currentUserId, currentUserName, currentUserProfileImage, nextPostHasImage }: { post: FeedItemDto; currentUserId: string | null; currentUserName: string | null; currentUserProfileImage: string | null; nextPostHasImage: boolean }) {
  const [publishing, setPublishing] = useState(false);
  const [liked, setLiked] = useState(post.initiallyLiked);
  const [likeCount, setLikeCount] = useState(post.initialLikeCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentsSection, setCommentsSection] = useState<CommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [authorAvatars, setAuthorAvatars] = useState<Record<string, string | null>>({});
  const [imgLoaded, setImgLoaded] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLiked(post.initiallyLiked);
  }, [post.initiallyLiked]);

  useEffect(() => {
    setLikeCount(post.initialLikeCount);
  }, [post.initialLikeCount]);

  useEffect(() => {
    if (!likeAnimating) return;
    const timeoutId = window.setTimeout(() => setLikeAnimating(false), 180);
    return () => window.clearTimeout(timeoutId);
  }, [likeAnimating]);

  // Load comments on mount
  useEffect(() => {
    if (!post.plan.id) return;
    let cancelled = false;
    const load = async () => {
      setCommentsLoading(true);
      try {
        const allComments = await listCommentsForPlan({
          planId: post.plan.id,
          userId: currentUserId ?? undefined,
          limit: 50,
        });
        if (!cancelled) setCommentsSection(allComments);
      } catch (error) {
        console.error("[feed] Error loading comments:", error);
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [post.plan.id, currentUserId]);

  // Fetch avatars for comment authors
  useEffect(() => {
    if (commentsSection.length === 0) return;
    const userIds = [...new Set(commentsSection.map((c) => c.userId))];
    const missing = userIds.filter((uid) => !(uid in authorAvatars));
    if (missing.length === 0) return;

    const fetchAvatars = async () => {
      const results: Record<string, string | null> = {};

      // Inyectar datos del usuario logueado directamente (evita RLS)
      if (currentUserId && missing.includes(currentUserId)) {
        const currentUserProfileImage = post.avatarImage ?? null;
        results[currentUserId] = currentUserProfileImage;
        commentAuthorCache.set(currentUserId, {
          name: currentUserName ?? "Usuario",
          profileImage: currentUserProfileImage,
          cachedAt: Date.now(),
        });
      }

      await Promise.all(
        missing.filter((uid) => uid !== currentUserId).map(async (uid) => {
          const cached = commentAuthorCache.get(uid);
          if (cached && Date.now() - cached.cachedAt < COMMENT_AUTHOR_CACHE_TTL_MS) {
            results[uid] = cached.profileImage;
            return;
          }
          try {
            const profile = await getPublicUserProfile(uid);
            results[uid] = profile?.profile_image ?? null;
            commentAuthorCache.set(uid, {
              name: profile?.nombre ?? "Usuario",
              profileImage: profile?.profile_image ?? null,
              cachedAt: Date.now(),
            });
          } catch {
            results[uid] = null;
          }
        }),
      );
      setAuthorAvatars((prev) => ({ ...prev, ...results }));
    };
    void fetchAvatars();
  }, [commentsSection]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiPickerOpen]);

  const insertEmoji = (emoji: string) => {
    setCommentText((prev) => prev + emoji);
    setEmojiPickerOpen(false);
    commentInputRef.current?.focus();
  };

  const onPublish = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      await publishPlanAsPost({ ...post.plan, allDay: post.plan.allDay ?? false, ownerUserId: post.plan.ownerUserId ?? "" });
      console.log("Publicado en Firebase:", post.plan.id);
    } catch (e) {
      console.error("Error publicando:", e);
    } finally {
      setPublishing(false);
    }
  };

  const onLikeToggle = async () => {
    if (!currentUserId || likeLoading) return;

    setLikeLoading(true);
    try {
      const result = await togglePlanLike({
        userId: currentUserId,
        planId: post.plan.id,
      });
      setLiked(result.liked);
      setLikeCount(result.likeCount);
      setLikeAnimating(true);

      if (post.plan.ownerUserId && post.plan.ownerUserId !== currentUserId) {
        if (result.liked) {
          void insertNotificacion({
            userId: post.plan.ownerUserId,
            tipo: "like",
            actorId: currentUserId,
            entityId: String(post.plan.id),
            entityType: "plan",
          });
        } else {
          void deleteNotificacionLike({
            actorId: currentUserId,
            userId: post.plan.ownerUserId,
            entityId: String(post.plan.id),
          });
        }
      }
    } catch (e) {
      console.error("[feed] Error toggling like:", e);
    } finally {
      setLikeLoading(false);
    }
  };

  const reloadComments = async () => {
    try {
      const allComments = await listCommentsForPlan({
        planId: post.plan.id,
        userId: currentUserId ?? undefined,
        limit: 50,
      });
      setCommentsSection(allComments);
    } catch (error) {
      console.error("[feed] Error loading comments:", error);
    }
  };

  const onSubmitComment = async () => {
    if (!currentUserId || commentSubmitting) return;
    const content = commentText.trim();
    if (!content) return;

    setCommentSubmitting(true);
    try {
      const nameToStore = currentUserName?.trim() || "Usuario";

      const result = await createComment({
        planId: post.plan.id,
        userId: currentUserId,
        userName: nameToStore,
        userProfileImage: currentUserProfileImage,
        content,
      });
      setCommentText("");
      await reloadComments();

      // Moderation: async — delete silently if toxic
      const commentId = result.comment_id;
      void fetch("/api/moderate-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      })
        .then((r) => r.json())
        .then((data: { toxic: boolean }) => {
          if (data.toxic) {
            void deleteComment({ planId: post.plan.id, commentId });
            setCommentsSection((prev) => prev.filter((c) => c.commentId !== commentId));
          }
        })
        .catch(() => { /* never block on moderation error */ });

      // Notificar al dueño del plan (no a uno mismo)
      if (post.plan.ownerUserId && post.plan.ownerUserId !== currentUserId) {
        void insertNotificacion({
          userId: post.plan.ownerUserId,
          tipo: "comment",
          actorId: currentUserId,
          entityId: String(post.plan.id),
          entityType: "plan",
        });
      }
    } catch (e) {
      console.error("[feed] Error creating comment:", e);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const onCommentKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    await onSubmitComment();
  };

  const onDeleteComment = async (commentId: string) => {
    setConfirmDeleteId(null);
    setCommentsSection((prev) => prev.filter((c) => c.commentId !== commentId));
    try {
      await deleteComment({ planId: post.plan.id, commentId });
    } catch {
      const refreshed = await listCommentsForPlan({ planId: post.plan.id, userId: currentUserId ?? undefined });
      setCommentsSection(refreshed);
    }
  };

  const getCommentAuthorName = (comment: CommentDto) => {
    if (comment.userId === currentUserId && currentUserName) return currentUserName;
    const cached = commentAuthorCache.get(comment.userId);
    if (cached && Date.now() - cached.cachedAt < COMMENT_AUTHOR_CACHE_TTL_MS && cached.name && cached.name !== "Usuario") {
      return cached.name;
    }
    return comment.userName?.trim() || "Usuario";
  };


  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const day = d.getDate();
    const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${day} ${months[d.getMonth()]}`;
  };

  return (
    <article className="pb-[var(--space-2)]">
      {/* Image with overlays */}
      {post.hasImage && (
        <div
          className="feed-image-container relative overflow-hidden"
          style={!imgLoaded ? { aspectRatio: "4/3" } : undefined}
        >
          {/* Shimmer mientras la imagen carga */}
          {!imgLoaded && (
            <div className="feed-skeleton-shimmer absolute inset-0" aria-hidden="true" />
          )}
          <img
            src={post.coverImage ?? undefined}
            alt="Imagen del plan"
            className="feed-image-responsive transition-opacity duration-300"
            style={{ opacity: imgLoaded ? 1 : 0 }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
          />

          {/* Top overlay — avatar + username */}
          <div className="absolute inset-x-0 top-0 flex items-center gap-[var(--space-2)] bg-gradient-to-b from-black/50 to-transparent px-[var(--space-4)] pb-[var(--space-8)] pt-[var(--space-3)]">
            <div className="flex size-[32px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/20">
              {post.avatarImage ? (
                <img src={post.avatarImage} alt={post.avatarLabel} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[13px] font-[var(--fw-semibold)] text-white">{post.avatarLabel}</span>
              )}
            </div>
            <Link href={`/profile/${post.plan.ownerUserId}`} className="text-body-sm font-[var(--fw-semibold)] text-white drop-shadow-sm">{post.userName}</Link>
          </div>

          {/* Bottom overlay — location + dates */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-[var(--space-4)] pb-[var(--space-3)] pt-[var(--space-10)]">
            {post.plan.locationName && (
              <p className="text-body font-[var(--fw-semibold)] leading-tight text-white drop-shadow-sm">
                {post.plan.locationName}
              </p>
            )}
            <p className="mt-[2px] text-body-sm text-white/70">
              {formatDate(post.plan.startsAt) === formatDate(post.plan.endsAt)
                ? formatDate(post.plan.startsAt)
                : `${formatDate(post.plan.startsAt)} - ${formatDate(post.plan.endsAt)}`}
            </p>
          </div>
        </div>
      )}

      {/* No-image layout: avatar left, content right (Twitter style) */}
      {!post.hasImage && (
        <div className="flex gap-[var(--space-2)] px-[var(--space-1)]">
          <div className="flex size-[32px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset">
            {post.avatarImage ? (
              <img src={post.avatarImage} alt={post.avatarLabel} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-[13px] font-[var(--fw-semibold)] text-app">{post.avatarLabel}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/profile/${post.plan.ownerUserId}`} className="text-body-sm font-[var(--fw-semibold)]">{post.userName}</Link>
            {post.text && (
              <p className="mt-[2px] text-body-sm leading-[1.45]">{post.text}</p>
            )}
            {/* Actions */}
            <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-4)]">
              <button type="button" className="flex items-center gap-[6px] disabled:opacity-50" aria-label={liked ? "Quitar like" : "Dar like"} onClick={onLikeToggle} disabled={!currentUserId || likeLoading}>
                <PlaneIcon liked={liked} animating={likeAnimating} />
                {likeCount > 0 && <span className="text-body-sm font-[var(--fw-semibold)]">{likeCount}</span>}
              </button>
              <button type="button" className="flex items-center gap-[6px]" onClick={() => setCommentsExpanded((prev) => !prev)}>
                <CommentIcon />
                {commentsSection.length > 0 && <span className="text-body-sm font-[var(--fw-semibold)]">{commentsSection.length}</span>}
              </button>
              <button type="button" className="disabled:opacity-50" aria-label="Compartir" onClick={onPublish} disabled={publishing}>
                <ShareIcon />
              </button>
              <button type="button" className="ml-auto text-body-sm font-[var(--fw-semibold)] text-[var(--primary)] transition-opacity hover:opacity-70">
                Ver plan
              </button>
            </div>
            {/* View comments link */}
            {commentsSection.length > 0 && !commentsExpanded && (
              <button type="button" onClick={() => setCommentsExpanded(true)} className="mt-[var(--space-1)] text-body-sm text-muted">
                Ver los {commentsSection.length} comentarios
              </button>
            )}
            {/* Expanded comments */}
            {commentsExpanded && commentsSection.length > 0 && (
              <div className="scrollbar-thin mt-[var(--space-2)] max-h-[120px] space-y-[var(--space-2)] overflow-y-auto overscroll-contain">
                {commentsSection.map((comment) => {
                  const avatarImg = authorAvatars[comment.userId] ?? null;
                  const initial = (getCommentAuthorName(comment)[0] || "U").toUpperCase();
                  return (
                    <div key={comment.commentId} className="flex items-start gap-[var(--space-2)]">
                      <div className="flex size-[24px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset">
                        {avatarImg ? (
                          <img src={avatarImg} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-[10px] font-[var(--fw-semibold)] text-app">{initial}</span>
                        )}
                      </div>
                      <p className="min-w-0 flex-1 text-body-sm leading-[1.4]">
                        <Link href={`/profile/${comment.userId}`} className="font-[var(--fw-semibold)]">{getCommentAuthorName(comment)}</Link>{" "}
                        {comment.content}
                      </p>
                      {comment.userId === currentUserId && (
                        <button type="button" className="mt-0.5 shrink-0 p-0.5 text-muted opacity-50" aria-label="Eliminar comentario" onClick={() => setConfirmDeleteId(comment.commentId)}>
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Comment input */}
            <div ref={emojiPickerRef} className="relative mt-[var(--space-2)] flex items-center gap-[var(--space-2)]">
              <button type="button" className="flex items-center justify-center text-muted" aria-label="Emoticonos" onClick={() => setEmojiPickerOpen((prev) => !prev)}>
                <SmileyIcon />
              </button>
              {emojiPickerOpen && (
                <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[256px] rounded-[10px] bg-[#1a1a1a]/95 p-2 shadow-lg backdrop-blur-md">
                  <div className="scrollbar-thin grid max-h-[180px] grid-cols-8 gap-0.5 overflow-x-hidden overflow-y-auto overscroll-contain">
                    {EMOJI_LIST.map((emoji) => (
                      <button key={emoji} type="button" className="flex size-[30px] items-center justify-center rounded-[6px] text-[18px] transition-colors hover:bg-white/15" onClick={() => insertEmoji(emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={onCommentKeyDown}
                placeholder="Añade un comentario..."
                className="min-w-0 flex-1 bg-transparent py-[4px] text-body-sm text-app outline-none placeholder:text-muted"
                disabled={!currentUserId || commentSubmitting}
              />
              {commentText.trim() && (
                <button type="button" onClick={onSubmitComment} disabled={!currentUserId || commentSubmitting} className="text-body-sm font-[var(--fw-semibold)] text-[var(--primary)] disabled:opacity-40">
                  Publicar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image layout: actions + comments below image */}
      {post.hasImage && (
        <>
          {/* Actions row */}
          <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-4)] px-[var(--space-1)]">
            <button type="button" className="flex items-center gap-[6px] disabled:opacity-50" aria-label={liked ? "Quitar like" : "Dar like"} onClick={onLikeToggle} disabled={!currentUserId || likeLoading}>
              <PlaneIcon liked={liked} animating={likeAnimating} />
              {likeCount > 0 && <span className="text-body-sm font-[var(--fw-semibold)]">{likeCount}</span>}
            </button>
            <button type="button" className="flex items-center gap-[6px]" onClick={() => setCommentsExpanded((prev) => !prev)}>
              <CommentIcon />
              {commentsSection.length > 0 && <span className="text-body-sm font-[var(--fw-semibold)]">{commentsSection.length}</span>}
            </button>
            <button type="button" className="disabled:opacity-50" aria-label="Compartir" onClick={onPublish} disabled={publishing}>
              <ShareIcon />
            </button>
            <button type="button" className="ml-auto text-body-sm font-[var(--fw-semibold)] text-[var(--primary)] transition-opacity hover:opacity-70">
              Ver plan
            </button>
          </div>

          {/* Username + description */}
          {post.text && (
            <p className="mt-[var(--space-3)] px-[var(--space-1)] text-body-sm leading-[1.45]">
              <Link href={`/profile/${post.plan.ownerUserId}`} className="font-[var(--fw-semibold)]">{post.userName}</Link>{" "}
              {post.text}
            </p>
          )}

          {/* View comments link */}
          {commentsSection.length > 0 && !commentsExpanded && (
            <button type="button" onClick={() => setCommentsExpanded(true)} className="mt-[var(--space-1)] px-[var(--space-1)] text-body-sm text-muted">
              Ver los {commentsSection.length} comentarios
            </button>
          )}

          {/* Expanded comments */}
          {commentsExpanded && commentsSection.length > 0 && (
            <div className="scrollbar-thin mt-[var(--space-2)] max-h-[120px] space-y-[var(--space-2)] overflow-y-auto overscroll-contain px-[var(--space-1)]">
              {commentsSection.map((comment) => {
                const avatarImg = authorAvatars[comment.userId] ?? null;
                const initial = (getCommentAuthorName(comment)[0] || "U").toUpperCase();
                return (
                  <div key={comment.commentId} className="flex items-start gap-[var(--space-2)]">
                    <div className="flex size-[24px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset">
                      {avatarImg ? (
                        <img src={avatarImg} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-[10px] font-[var(--fw-semibold)] text-app">{initial}</span>
                      )}
                    </div>
                    <p className="min-w-0 flex-1 text-body-sm leading-[1.4]">
                      <Link href={`/profile/${comment.userId}`} className="font-[var(--fw-semibold)]">{getCommentAuthorName(comment)}</Link>{" "}
                      {comment.content}
                    </p>
                    {comment.userId === currentUserId && (
                      <button type="button" className="mt-0.5 shrink-0 p-0.5 text-muted opacity-50" aria-label="Eliminar comentario" onClick={() => setConfirmDeleteId(comment.commentId)}>
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment input */}
          <div ref={emojiPickerRef} className="relative mt-[var(--space-2)] flex items-center gap-[var(--space-2)] px-[var(--space-1)]">
            <button type="button" className="flex items-center justify-center text-muted" aria-label="Emoticonos" onClick={() => setEmojiPickerOpen((prev) => !prev)}>
              <SmileyIcon />
            </button>
            {emojiPickerOpen && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[256px] rounded-[10px] bg-[#1a1a1a]/95 p-2 shadow-lg backdrop-blur-md">
                <div className="scrollbar-thin grid max-h-[180px] grid-cols-8 gap-0.5 overflow-x-hidden overflow-y-auto overscroll-contain">
                  {EMOJI_LIST.map((emoji) => (
                    <button key={emoji} type="button" className="flex size-[30px] items-center justify-center rounded-[6px] text-[18px] transition-colors hover:bg-white/15" onClick={() => insertEmoji(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input
              ref={commentInputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={onCommentKeyDown}
              placeholder="Añade un comentario..."
              className="min-w-0 flex-1 bg-transparent py-[4px] text-body-sm text-app outline-none placeholder:text-muted"
              disabled={!currentUserId || commentSubmitting}
            />
            {commentText.trim() && (
              <button type="button" onClick={onSubmitComment} disabled={!currentUserId || commentSubmitting} className="text-body-sm font-[var(--fw-semibold)] text-[var(--primary)] disabled:opacity-40">
                Publicar
              </button>
            )}
          </div>
        </>
      )}

      {/* Divider — only between image post followed by no-image post */}
      {post.hasImage && !nextPostHasImage && (
        <div className="feed-divider mt-[var(--space-2)] border-t border-app" />
      )}

      {/* Delete comment confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-[max(var(--space-6),env(safe-area-inset-bottom))] sm:items-center" onClick={() => setConfirmDeleteId(null)}>
          <div className="w-full max-w-[340px] rounded-modal border border-app bg-surface p-[var(--space-5)] shadow-elev-2 mx-[var(--space-4)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-body font-[var(--fw-semibold)] text-app">¿Eliminar comentario?</p>
            <p className="mt-[var(--space-1)] text-body-sm text-muted">Esta acción no se puede deshacer.</p>
            <div className="mt-[var(--space-4)] flex gap-[var(--space-2)]">
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="flex-1 rounded-button border border-app py-[10px] text-body-sm font-[var(--fw-medium)] text-app transition-colors hover:bg-[var(--interactive-hover-surface)]">
                Cancelar
              </button>
              <button type="button" onClick={() => onDeleteComment(confirmDeleteId)} className="flex-1 rounded-button bg-[var(--error-token,#ef4444)] py-[10px] text-body-sm font-[var(--fw-medium)] text-white transition-opacity hover:opacity-80">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function PlaneIcon({ liked, animating }: { liked: boolean; animating: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={liked ? "currentColor" : "none"}
      aria-hidden="true"
      className={`transition-all duration-150 ${liked ? "text-primary-token" : "text-app"} ${animating ? "scale-[1.2]" : "scale-100"}`}
    >
      <path
        d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H18.5A1.5 1.5 0 0 1 20 5.5V14.5A1.5 1.5 0 0 1 18.5 16H9L4 20V5.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12V20C4 20.55 4.45 21 5 21H19C19.55 21 20 20.55 20 20V12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 3V15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 7L12 3L16 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6H5H21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 6V4C8 3.45 8.45 3 9 3H15C15.55 3 16 3.45 16 4V6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6 6V20C6 20.55 6.45 21 7 21H17C17.55 21 18 20.55 18 20V6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10 10V17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14 10V17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SmileyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15" cy="10" r="1.2" fill="currentColor" />
      <path d="M8.5 14.5C9.2 16 10.5 17 12 17C13.5 17 14.8 16 15.5 14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

