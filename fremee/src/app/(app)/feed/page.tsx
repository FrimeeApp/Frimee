"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import { getFeedPage } from "@/services/api/repositories/feed.repository";
import type { FeedItemDto } from "@/services/api/dtos/feed.dto";
import { publishPlanAsPost } from "@/services/api/repositories/post.repository";
import { togglePlanLike } from "@/services/api/repositories/likes.repository";
import {
  createComment,
  listCommentsForPlan,
  type CommentDto,
} from "@/services/api/repositories/comments.repository";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";

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

function preloadImages(urls: string[], timeoutMs = 2500) {
  if (typeof window === "undefined" || urls.length === 0) {
    return Promise.resolve();
  }

  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  if (uniqueUrls.length === 0) return Promise.resolve();

  const loadAll = Promise.allSettled(
    uniqueUrls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  ).then(() => undefined);

  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });

  return Promise.race([loadAll, timeout]);
}

export default function FeedPage() {
  const { user, loading } = useAuth();
  const currentUserId = user?.id ?? null;
  const [activeFeedTab, setActiveFeedTab] = useState<"following" | "explore">("following");
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [uiPosts, setUiPosts] = useState<FeedItemDto[]>([]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const lastProfileUpdatedAtRef = useRef<string | null>(null);
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const followingTabRef = useRef<HTMLButtonElement | null>(null);
  const exploreTabRef = useRef<HTMLButtonElement | null>(null);
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, ready: false });

  useEffect(() => {
    if (!currentUserId) {
      setUiPosts([]);
      setLoadingFeed(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoadingFeed(true);
      try {
        const items = await getFeedPage({ userId: currentUserId, limit: 20 });
        if (cancelled) return;

        const imageUrlsToPreload = items.flatMap((post) => {
          const urls: string[] = [];
          if (post.coverImage) urls.push(post.coverImage);
          if (post.avatarImage) urls.push(post.avatarImage);
          return urls;
        });

        await preloadImages(imageUrlsToPreload);
        if (cancelled) return;

        setUiPosts(items);
      } catch (e) {
        console.error("[feed] load error", e);
        setUiPosts([]);
      } finally {
        if (!cancelled) setLoadingFeed(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
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
                <span
                  className={`pointer-events-none absolute bottom-0 h-[2px] bg-black transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] dark:bg-white ${
                    tabIndicator.ready ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ left: tabIndicator.left, width: tabIndicator.width }}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-[var(--space-5)]">
                {loadingFeed ? (
                  <FeedSkeleton />
                ) : uiPosts.length === 0 ? (
                  <div className="rounded-modal border border-app bg-surface p-[var(--space-5)] text-body text-muted shadow-elev-1">
                    Aun no hay publicaciones para mostrar.
                  </div>
                ) : (
                  <div className="space-y-[var(--space-3)]">
                    {uiPosts.map((post, idx) => (
                      <FeedCard key={post.id} post={post} currentUserId={currentUserId} nextPostHasImage={uiPosts[idx + 1]?.hasImage ?? true} />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <aside className="hidden xl:block">
              <div className="sticky top-[var(--space-8)]">
                <FeedChatPanel />
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

// Mock chats — will be replaced with real data later
const MOCK_CHATS = [
  { id: "1", name: "Ana García", avatar: null, lastMessage: "Nos vemos mañana!", time: "14:32", unread: true, isGroup: false },
  { id: "2", name: "Plan Roma 🇮🇹", avatar: null, lastMessage: "He reservado el hotel", time: "12:05", unread: true, isGroup: true },
  { id: "3", name: "Carlos López", avatar: null, lastMessage: "Genial, gracias!", time: "Ayer", unread: false, isGroup: false },
  { id: "4", name: "María Ruiz", avatar: null, lastMessage: "¿Quedamos el viernes?", time: "Ayer", unread: false, isGroup: false },
  { id: "5", name: "Plan Barcelona", avatar: null, lastMessage: "Yo llego el sábado", time: "Lun", unread: false, isGroup: true },
  { id: "6", name: "Pedro Sánchez", avatar: null, lastMessage: "Perfecto 👍", time: "Lun", unread: false, isGroup: false },
];

type FeedChatMessage = { id: string; senderId: string; senderName: string; text: string; time: string };

function getFeedChatMessages(chat: typeof MOCK_CHATS[number]): FeedChatMessage[] {
  if (chat.isGroup) {
    return [
      { id: "m1", senderId: "u1", senderName: "Ana García", text: "Hola!", time: "10:02" },
      { id: "m2", senderId: "u1", senderName: "Ana García", text: "Alguien mira vuelos?", time: "10:03" },
      { id: "m3", senderId: "me", senderName: "", text: "Sí, los vi ayer", time: "10:05" },
      { id: "m4", senderId: "u2", senderName: "Carlos", text: chat.lastMessage, time: chat.time },
    ];
  }
  return [
    { id: "m1", senderId: "other", senderName: chat.name, text: "Hola! Qué tal?", time: "10:02" },
    { id: "m2", senderId: "me", senderName: "", text: "Hey! Todo bien", time: "10:05" },
    { id: "m3", senderId: "other", senderName: chat.name, text: chat.lastMessage, time: chat.time },
  ];
}

function FeedChatPanel() {
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const openChat = MOCK_CHATS.find((c) => c.id === openChatId);

  if (openChat) {
    return (
      <div className="pt-[var(--space-10)]">
        {/* Chat header */}
        <div className="flex items-center gap-[var(--space-2)]">
          <button
            type="button"
            onClick={() => { setOpenChatId(null); setMessage(""); }}
            className="flex size-[28px] items-center justify-center rounded-full transition-colors hover:bg-surface"
            aria-label="Volver"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[16px]">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex avatar-sm items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-[11px] font-[var(--fw-semibold)] text-app">
            {openChat.name[0].toUpperCase()}
          </div>
          <span className="min-w-0 truncate text-body-sm font-[var(--fw-semibold)]">{openChat.name}</span>
        </div>

        {/* Messages */}
        <div className="mt-[var(--space-4)] flex max-h-[340px] flex-col justify-end overflow-y-auto overscroll-contain">
          <div className="space-y-[1px]">
            {getFeedChatMessages(openChat).map((msg, idx, arr) => {
              const isMe = msg.senderId === "me";
              const prevMsg = arr[idx - 1];
              const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-[var(--space-2)]" : "mt-[2px]"}`}>
                  {!isMe && openChat.isGroup && (
                    <div className="mr-[6px] w-[20px] shrink-0">
                      {isFirstInGroup && (
                        <div className="flex size-[20px] items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-[9px] font-[var(--fw-semibold)] text-app">
                          {msg.senderName[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-[14px] px-3 py-[6px] ${
                    isMe
                      ? "bg-[var(--text-primary)] text-contrast-token"
                      : "bg-surface-inset"
                  }`}>
                    {!isMe && openChat.isGroup && isFirstInGroup && (
                      <p className="mb-[2px] text-[10px] font-[var(--fw-semibold)] text-muted">{msg.senderName}</p>
                    )}
                    <p className="text-body-sm">{msg.text}</p>
                    <p className={`mt-[2px] text-right text-[10px] ${isMe ? "text-contrast-token/60" : "text-muted"}`}>{msg.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <div className="mt-[var(--space-3)] flex items-center gap-[var(--space-2)]">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="min-w-0 flex-1 rounded-full border border-app bg-surface px-3 py-[6px] text-body-sm text-app outline-none transition-colors focus:border-[var(--border-strong)]"
          />
          <button
            type="button"
            disabled={!message.trim()}
            className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-30"
            aria-label="Enviar"
          >
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
        {MOCK_CHATS.slice(0, 4).map((chat) => (
          <button
            key={chat.id}
            type="button"
            onClick={() => setOpenChatId(chat.id)}
            className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface"
          >
            <div className="relative shrink-0">
              <div className="flex avatar-md items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                {chat.avatar ? (
                  <img src={chat.avatar} alt={chat.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  chat.name[0].toUpperCase()
                )}
              </div>
              {chat.unread && (
                <span className="absolute -right-[2px] -top-[2px] size-[10px] rounded-full border-2 border-[var(--bg)] bg-[#ff6a3d]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-body-sm ${chat.unread ? "font-[var(--fw-semibold)] text-app" : "text-app"}`}>{chat.name}</p>
              <p className={`truncate text-[12px] leading-[16px] ${chat.unread ? "font-[var(--fw-medium)] text-app" : "text-muted"}`}>{chat.lastMessage}</p>
            </div>
            <span className="shrink-0 text-[11px] text-muted">{chat.time}</span>
          </button>
        ))}
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

function FeedCard({ post, currentUserId, nextPostHasImage }: { post: FeedItemDto; currentUserId: string | null; nextPostHasImage: boolean }) {
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
      await Promise.all(
        missing.map(async (uid) => {
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
      await publishPlanAsPost(post.plan);
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
      const cachedCurrentUser = commentAuthorCache.get(currentUserId);
      let currentUserName =
        cachedCurrentUser && Date.now() - cachedCurrentUser.cachedAt < COMMENT_AUTHOR_CACHE_TTL_MS
          ? cachedCurrentUser.name
          : "";
      if (!currentUserName) {
        const profile = await getPublicUserProfile(currentUserId);
        currentUserName = profile?.nombre?.trim() || "Usuario";
        commentAuthorCache.set(currentUserId, {
          name: currentUserName,
          profileImage: profile?.profile_image ?? null,
          cachedAt: Date.now(),
        });
      }

      await createComment({
        planId: post.plan.id,
        userId: currentUserId,
        userName: currentUserName,
        content,
      });
      setCommentText("");
      await reloadComments();
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

  const getCommentAuthorName = (comment: CommentDto) => {
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
        <div className="feed-image-container relative overflow-hidden">
          <img
            src={post.coverImage ?? undefined}
            alt="Imagen del plan"
            className="feed-image-responsive"
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
            <span className="text-body-sm font-[var(--fw-semibold)] text-white drop-shadow-sm">{post.userName}</span>
          </div>

          {/* Bottom overlay — location + dates */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-[var(--space-4)] pb-[var(--space-3)] pt-[var(--space-10)]">
            {post.plan.locationName && (
              <p className="text-body font-[var(--fw-semibold)] leading-tight text-white drop-shadow-sm">
                {post.plan.locationName}
              </p>
            )}
            <p className="mt-[2px] text-body-sm text-white/70">
              {formatDate(post.plan.startsAt)} - {formatDate(post.plan.endsAt)}
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
            <span className="text-body-sm font-[var(--fw-semibold)]">{post.userName}</span>
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
              <div className="mt-[var(--space-2)] max-h-[120px] space-y-[var(--space-2)] overflow-y-auto overscroll-contain">
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
                        <span className="font-[var(--fw-semibold)]">{getCommentAuthorName(comment)}</span>{" "}
                        {comment.content}
                      </p>
                      {comment.userId === currentUserId && (
                        <button type="button" className="mt-0.5 shrink-0 p-0.5 text-muted opacity-50" aria-label="Eliminar comentario">
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
                  <div className="grid max-h-[180px] grid-cols-8 gap-0.5 overflow-y-auto overscroll-contain">
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
              <span className="font-[var(--fw-semibold)]">{post.userName}</span>{" "}
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
            <div className="mt-[var(--space-2)] max-h-[120px] space-y-[var(--space-2)] overflow-y-auto overscroll-contain px-[var(--space-1)]">
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
                      <span className="font-[var(--fw-semibold)]">{getCommentAuthorName(comment)}</span>{" "}
                      {comment.content}
                    </p>
                    {comment.userId === currentUserId && (
                      <button type="button" className="mt-0.5 shrink-0 p-0.5 text-muted opacity-50" aria-label="Eliminar comentario">
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
                <div className="grid max-h-[180px] grid-cols-8 gap-0.5 overflow-y-auto overscroll-contain">
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

