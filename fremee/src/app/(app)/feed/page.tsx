"use client";

import NextImage from "next/image";
import Link from "next/link";
import PlaneIcon from "@/components/ui/PlaneIcon";
import { useFollow } from "@/hooks/useFollow";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import { getFeedPostsOnly, getFeedLikes } from "@/services/api/repositories/feed.repository";
import { countNotificacionesNoLeidas, insertNotificacion, deleteNotificacionLike } from "@/services/api/repositories/notifications.repository";
import NotificationsPanel from "@/components/notifications/NotificationsPanel";
import type { FeedItemDto } from "@/services/api/dtos/feed.dto";
import { togglePlanLike } from "@/services/api/repositories/likes.repository";
import {
  createComment,
  deleteComment,
  listCommentsForPlan,
  toggleCommentLike,
  type CommentDto,
} from "@/services/api/repositories/comments.repository";
import { getPublicUserProfile, searchUsers, type PublicUserProfileDto } from "@/services/api/repositories/users.repository";
import { fetchActiveFriends, getFollowStatuses } from "@/services/api/endpoints/users.endpoint";
import { savePlan, unsavePlan, getSavedStatuses } from "@/services/api/endpoints/saved.endpoint";
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

const RECENTS_KEY = "fremee:search-recents";
const RECENTS_MAX = 10;

type RecentProfile = { id: string; nombre: string; profile_image: string | null };

function readRecents(): RecentProfile[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as RecentProfile[]) : [];
  } catch { return []; }
}

function addRecent(profile: RecentProfile) {
  try {
    const list = readRecents().filter((r) => r.id !== profile.id);
    list.unshift(profile);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, RECENTS_MAX)));
  } catch { /* ignore */ }
}

function removeRecent(id: string) {
  try {
    const list = readRecents().filter((r) => r.id !== id);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

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
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [savedPlanIds, setSavedPlanIds] = useState<Set<number>>(new Set());
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchValue, setMobileSearchValue] = useState("");
  const [mobileSearchResults, setMobileSearchResults] = useState<PublicUserProfileDto[]>([]);
  const [mobileSearchLoading, setMobileSearchLoading] = useState(false);
  const [suggestedProfiles, setSuggestedProfiles] = useState<PublicUserProfileDto[]>([]);
  const [recentProfiles, setRecentProfiles] = useState<RecentProfile[]>([]);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

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
        const [feedResult, friends] = await Promise.all([
          getFeedPostsOnly({ limit: 20 }),
          fetchActiveFriends(),
        ]);
        const posts = feedResult.posts;
        if (cancelled) return;

        const newFriendIds = new Set(friends.map((f) => f.id));
        setFriendIds(newFriendIds);
        setSuggestedProfiles(friends.slice(0, 12));
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
        const ownerIds = [...new Set(posts.map((p) => p.plan.ownerUserId).filter((id): id is string => Boolean(id) && id !== currentUserId))];

        const [likesResult, followStatuses, savedStatuses] = await Promise.all([
          planIds.length > 0 ? getFeedLikes({ userId: currentUserId, planIds }) : Promise.resolve(null),
          ownerIds.length > 0 ? getFollowStatuses(ownerIds) : Promise.resolve({} as Record<string, boolean>),
          planIds.length > 0 ? getSavedStatuses(planIds) : Promise.resolve({} as Record<number, boolean>),
        ]);
        if (cancelled) return;

        if (likesResult) {
          const { likedSet, counts } = likesResult;
          setUiPosts((prev) =>
            prev.map((p) => ({
              ...p,
              initiallyLiked: likedSet.has(p.plan.id),
              initialLikeCount: counts[p.plan.id] ?? 0,
            }))
          );
        }

        setFollowedIds(new Set(Object.entries(followStatuses).filter(([, v]) => v).map(([k]) => k)));
        setSavedPlanIds(new Set(Object.entries(savedStatuses).filter(([, v]) => v).map(([k]) => Number(k))));
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

  // Mobile search: load recents + auto-focus input when opened
  useEffect(() => {
    if (!mobileSearchOpen) return;
    setRecentProfiles(readRecents());
    const frame = window.requestAnimationFrame(() => mobileSearchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [mobileSearchOpen]);

  // Mobile search: close on Escape
  useEffect(() => {
    if (!mobileSearchOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileSearchOpen(false);
        setMobileSearchValue("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileSearchOpen]);

  // Mobile search: debounced search
  useEffect(() => {
    const trimmed = mobileSearchValue.trim();

    if (!mobileSearchOpen || trimmed.length < 2) {
      setMobileSearchResults([]);
      setMobileSearchLoading(false);
      return;
    }

    let cancelled = false;
    setMobileSearchLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchUsers({ query: trimmed, limit: 10, excludeUserId: currentUserId ?? undefined });
        if (!cancelled) setMobileSearchResults(results);
      } catch {
        if (!cancelled) setMobileSearchResults([]);
      } finally {
        if (!cancelled) setMobileSearchLoading(false);
      }
    }, 250);

    return () => { cancelled = true; window.clearTimeout(timeoutId); };
  }, [mobileSearchOpen, mobileSearchValue, currentUserId]);

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    setMobileSearchValue("");
    setMobileSearchResults([]);
  };

  const handleSearchProfileClick = (u: { id: string; nombre: string; profile_image: string | null }) => {
    addRecent({ id: u.id, nombre: u.nombre, profile_image: u.profile_image });
    closeMobileSearch();
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main
          className={`pt-0 pb-0 md:px-safe md:pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] md:py-[var(--space-8)] md:pr-[var(--space-14)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)]`}
        >
          <div className="mx-auto max-w-[1160px]">
            <div className="md:border-b md:border-[#262626]">
              <div className="mx-auto w-full max-w-[760px] xl:mx-0">
              <div className="sticky top-0 z-[100] bg-app flex items-center gap-[var(--space-3)] py-[var(--space-2)] pl-[max(var(--page-margin-x),env(safe-area-inset-left))] pr-[max(var(--page-margin-x),env(safe-area-inset-right))] md:hidden">
                <button
                  type="button"
                  onClick={() => setActiveFeedTab((prev) => (prev === "explore" ? "following" : "explore"))}
                  className="flex h-[44px] items-center gap-[8px] px-[4px] text-body-sm font-[700] text-app"
                >
                  <span>{activeFeedTab === "explore" ? "Explorar" : "Siguiendo"}</span>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px]">
                    <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(true)}
                  aria-label="Buscar"
                  className="flex h-[44px] min-w-0 flex-1 items-center gap-[10px] rounded-[8px] bg-[var(--search-field-bg)] px-[14px] text-muted transition-opacity hover:opacity-80"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[22px] shrink-0">
                    <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <span className="truncate text-[15px]">Buscar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNotifPanelOpen(true)}
                  aria-label="Notificaciones"
                  className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center text-app transition-opacity hover:opacity-70"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[28px]">
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
                    <span className="absolute right-0 top-0 flex size-[14px] items-center justify-center rounded-full bg-blue-500 text-white text-[9px] font-[var(--fw-semibold)] leading-none">
                      {unreadNotifs > 9 ? "9+" : unreadNotifs}
                    </span>
                  )}
                </button>

                <Link
                  href={currentUserId ? `/profile/${currentUserId}` : "/settings"}
                  aria-label="Perfil"
                  className="flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset transition-opacity hover:opacity-80"
                >
                  {profile?.profile_image ? (
                    <NextImage src={profile.profile_image} alt="Foto de perfil" width={44} height={44} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[14px] font-[var(--fw-semibold)] text-app">
                      {(profile?.nombre?.trim()[0] ?? "P").toUpperCase()}
                    </span>
                  )}
                </Link>

              </div>

              {/* Fullscreen mobile search panel — fade in/out, above bottom nav */}
              <div
                className={`fixed inset-0 z-[1030] flex flex-col bg-app transition-opacity duration-200 ease-out md:hidden ${
                  mobileSearchOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {/* Search bar at the top */}
                <div className="flex items-center gap-[8px] px-[var(--space-4)] pt-[var(--space-4)]">
                  <button
                    type="button"
                    onClick={closeMobileSearch}
                    aria-label="Cerrar búsqueda"
                    className="flex h-[44px] w-[36px] shrink-0 items-center justify-center text-app transition-opacity hover:opacity-70"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[20px]">
                      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className="flex h-[44px] min-w-0 flex-1 items-center gap-[10px] rounded-[8px] bg-[var(--search-field-bg)] px-[14px]">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[20px] shrink-0 text-muted">
                      <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <input
                      ref={mobileSearchInputRef}
                      type="search"
                      value={mobileSearchValue}
                      onChange={(e) => setMobileSearchValue(e.target.value)}
                      placeholder="Buscar"
                      className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-app shadow-none outline-none ring-0 focus:border-none focus:shadow-none focus:outline-none focus:ring-0 placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
                    />
                    {mobileSearchValue && (
                      <button
                        type="button"
                        onClick={() => setMobileSearchValue("")}
                        aria-label="Limpiar"
                        className="shrink-0 text-muted transition-opacity hover:opacity-70"
                      >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px]">
                          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain px-[var(--space-4)]">
                  {mobileSearchValue.trim().length >= 2 ? (
                    // Search results
                    mobileSearchLoading ? (
                      <div className="flex justify-center py-16">
                        <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
                      </div>
                    ) : mobileSearchResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-12 opacity-20">
                          <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
                          <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        <p className="text-body-sm text-muted">No se han encontrado resultados.</p>
                      </div>
                    ) : (
                      <div className="py-2">
                        {mobileSearchResults.map((u) => (
                          <Link
                            key={u.id}
                            href={`/profile/${u.id}`}
                            onClick={() => handleSearchProfileClick(u)}
                            className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors active:bg-surface"
                          >
                            {u.profile_image ? (
                              <NextImage src={u.profile_image} alt={u.nombre} width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" unoptimized referrerPolicy="no-referrer" />
                            ) : (
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-body-sm font-[var(--fw-semibold)] text-app">
                                {(u.nombre.trim()[0] || "U").toUpperCase()}
                              </div>
                            )}
                            <span className="min-w-0 truncate text-body font-[var(--fw-semibold)] text-app">{u.nombre}</span>
                          </Link>
                        ))}
                      </div>
                    )
                  ) : (
                    <>
                      {/* Sugerencias (max 3) */}
                      {suggestedProfiles.length > 0 && (
                        <div className="py-2">
                          <p className="px-2 pb-3 pt-4 text-body font-[var(--fw-semibold)] text-app">Sugerencias</p>
                          {suggestedProfiles.slice(0, 3).map((u) => (
                            <Link
                              key={u.id}
                              href={`/profile/${u.id}`}
                              onClick={() => handleSearchProfileClick(u)}
                              className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors active:bg-surface"
                            >
                              {u.profile_image ? (
                                <NextImage src={u.profile_image} alt={u.nombre} width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" unoptimized referrerPolicy="no-referrer" />
                              ) : (
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-body-sm font-[var(--fw-semibold)] text-app">
                                  {(u.nombre.trim()[0] || "U").toUpperCase()}
                                </div>
                              )}
                              <span className="min-w-0 truncate text-body font-[var(--fw-semibold)] text-app">{u.nombre}</span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Recientes */}
                      {recentProfiles.length > 0 && (
                        <div className="py-2">
                          <p className="px-2 pb-3 pt-4 text-body font-[var(--fw-semibold)] text-app">Recientes</p>
                          {recentProfiles.map((u) => (
                            <div key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors active:bg-surface">
                              <Link
                                href={`/profile/${u.id}`}
                                onClick={() => handleSearchProfileClick(u)}
                                className="flex min-w-0 flex-1 items-center gap-3"
                              >
                                {u.profile_image ? (
                                  <NextImage src={u.profile_image} alt={u.nombre} width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" unoptimized referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-body-sm font-[var(--fw-semibold)] text-app">
                                    {(u.nombre.trim()[0] || "U").toUpperCase()}
                                  </div>
                                )}
                                <span className="min-w-0 truncate text-body font-[var(--fw-semibold)] text-app">{u.nombre}</span>
                              </Link>
                              <button
                                type="button"
                                aria-label="Eliminar reciente"
                                onClick={() => { removeRecent(u.id); setRecentProfiles((prev) => prev.filter((r) => r.id !== u.id)); }}
                                className="shrink-0 p-1 text-muted transition-opacity hover:opacity-70"
                              >
                                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[16px]">
                                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div
                ref={tabRowRef}
                className="relative hidden w-full gap-[var(--space-4)] pb-[var(--space-2)] text-body text-muted md:flex"
              >
                <button
                  ref={exploreTabRef}
                  type="button"
                  onClick={() => setActiveFeedTab("explore")}
                  className={`-mb-[2px] pb-0 font-[700] transition-colors duration-[var(--duration-base)] ${
                    activeFeedTab === "explore" ? "text-app" : "hover:text-app"
                  }`}
                >
                  Explorar
                </button>
                <button
                  ref={followingTabRef}
                  type="button"
                  onClick={() => setActiveFeedTab("following")}
                  className={`-mb-[2px] pb-0 font-[700] transition-colors duration-[var(--duration-base)] ${
                    activeFeedTab === "following" ? "text-app" : "hover:text-app"
                  }`}
                >
                  Siguiendo
                </button>
                <Link
                  href="/search"
                  aria-label="Buscar"
                  className="ml-auto pb-[var(--space-2)] text-app transition-opacity duration-[var(--duration-base)] hover:opacity-70 md:hidden"
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
                  className="relative pb-[var(--space-2)] text-app transition-opacity duration-[var(--duration-base)] hover:opacity-70 md:hidden"
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
              </div>
            </div>

            <div className="md:mt-[var(--space-5)] grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-[var(--space-6)]">
            <section className="w-full">
              <div className="md:ml-[72px] xl:ml-[72px]">
                {loadingFeed || !firstImageReady ? (
                  <>
                    <FeedSkeleton />
                    {!loadingFeed && uiPosts.length > 0 && (
                      <div className="sr-only" aria-hidden="true">
                        {uiPosts.filter((p) => p.coverImage).slice(0, 1).map((post) => (
                          <NextImage key={post.id} src={post.coverImage!} alt="" width={1200} height={900} className="h-auto w-full" unoptimized onLoad={() => setFirstImageReady(true)} onError={() => setFirstImageReady(true)} />
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
                    <div className="overflow-y-scroll snap-y snap-mandatory scrollbar-hide h-[calc(100svh-60px)] md:h-[calc(100dvh-100px)]">
                      {visiblePosts.map((post, idx) => (
                        <div key={post.id} className="snap-start h-full">
                          <FeedCard post={post} currentUserId={currentUserId} currentUserName={profile?.nombre ?? null} currentUserProfileImage={profile?.profile_image ?? null} nextPostHasImage={visiblePosts[idx + 1]?.hasImage ?? true} initialFollowing={followedIds.has(post.plan.ownerUserId ?? "")} initialSaved={savedPlanIds.has(post.plan.id)} />
                        </div>
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
          <div className="flex size-[32px] items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-[14px] font-[var(--fw-semibold)] text-app">
            {chatAvatar ? <NextImage src={chatAvatar} alt={chatName} width={32} height={32} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" /> : (chatName[0] ?? "?").toUpperCase()}
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
                              ? <NextImage src={msg.sender_profile_image} alt={msg.sender_nombre} width={20} height={20} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                              : (msg.sender_nombre[0] ?? "?").toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-[14px] px-3 py-[6px] ${isMe ? "bg-[var(--text-primary)] text-contrast-token" : "bg-surface-inset"}`}>
                      {!isMe && openChat.tipo === "GRUPO" && isFirstInGroup && (
                        <p className="mb-[2px] text-[14px] font-[var(--fw-semibold)] text-muted">{msg.sender_nombre}</p>
                      )}
                      {msg.audio_url ? (
                        <AudioPlayer src={msg.audio_url} />
                      ) : msg.document_url ? (
                        <div className="flex items-center gap-[8px] py-[2px] opacity-80">
                          <span className="text-[18px]">📄</span>
                          <span className="truncate text-[14px]">{msg.document_name ?? "Documento"}</span>
                        </div>
                      ) : msg.image_url ? (
                        msg.image_type?.startsWith("video/") ? (
                          <video src={msg.image_url} controls playsInline className="max-w-[200px] rounded-card" style={{ maxHeight: 200 }} />
                        ) : (
                          <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <NextImage src={msg.image_url} alt="Imagen" width={200} height={200} className="max-w-[200px] rounded-card object-cover" style={{ maxHeight: 200 }} unoptimized referrerPolicy="no-referrer" />
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
                                <p className="text-[14px] font-[var(--fw-medium)]">{label}</p>
                                {!missed && duracion > 0 && <p className="text-[14px] opacity-70">{mins}:{String(secs).padStart(2, "0")}</p>}
                              </div>
                            </div>
                          );
                        })()
                      : (() => { try { const p = JSON.parse(msg.texto); if (p?.type === "poll") return <div className="flex items-center gap-[6px] py-[2px] opacity-80"><span className="text-[16px]">📊</span><span className="text-[14px]">{p.question as string}</span></div>; } catch { /* noop */ } return <p className="break-all text-body-sm">{msg.texto}</p>; })()}
                      <p className={`mt-[2px] text-right text-[14px] ${isMe ? "text-contrast-token/60" : "text-muted"}`}>{formatChatTime(msg.created_at)}</p>
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
        <h3 className="text-[20px] font-[var(--fw-medium)] tracking-[0.03em] leading-[1.3]">Chats recientes</h3>
        <Link href="/messages" className="text-[14px] text-muted transition-opacity hover:opacity-70">Ver todos</Link>
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
                  <div className="flex size-[42px] items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                    {avatar ? <NextImage src={avatar} alt={name} width={42} height={42} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                      : chat.tipo === "GRUPO" ? <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[16px] text-muted"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" /><path d="M2 19c1-3 3.5-4.5 7-4.5s6 1.5 7 4.5" stroke="currentColor" strokeWidth="1.6" /></svg>
                      : (name[0] ?? "?").toUpperCase()}
                  </div>
                  {hasUnread && <span className="absolute -right-[2px] -top-[2px] size-[10px] rounded-full border-2 border-[var(--bg)] bg-[#ff6a3d]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-body-sm ${hasUnread ? "font-[var(--fw-semibold)]" : ""} text-app`}>{name}</p>
                  <p className={`truncate text-[14px] leading-[16px] ${hasUnread ? "font-[var(--fw-medium)] text-app" : "text-muted"}`}>{(() => { const m = chat.last_message ?? ""; try { return JSON.parse(m)?.type === "poll" ? "📊 Encuesta" : m; } catch { return m; } })()}</p>
                </div>
                <span className="shrink-0 text-[14px] text-muted">{formatChatTime(chat.last_message_at)}</span>
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
            <div className="skeleton-shimmer aspect-[4/3] w-full" />
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
            <div className="skeleton-shimmer h-[24px] w-[24px] rounded-full" />
            <div className="skeleton-shimmer h-3 w-[120px] rounded-full" />
          </div>
        </article>
      ))}
      {/* Text-only post skeleton (Twitter style) */}
      <article className="pb-[var(--space-2)]">
        <div className="flex gap-[var(--space-2)] px-[var(--space-1)]">
          <div className="skeleton-shimmer size-[32px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="skeleton-shimmer h-3 w-[90px] rounded-full" />
            <div className="skeleton-shimmer mt-[6px] h-3 w-[85%] rounded-full" />
            <div className="skeleton-shimmer mt-[4px] h-3 w-[60%] rounded-full" />
            <div className="mt-[var(--space-3)] flex items-center gap-[10px]">
              <div className="skeleton-shimmer h-[24px] w-[24px] rounded-full" />
              <div className="skeleton-shimmer h-[24px] w-[24px] rounded-full" />
              <div className="skeleton-shimmer h-[24px] w-[24px] rounded-full" />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function FeedCard({ post, currentUserId, currentUserName, currentUserProfileImage, nextPostHasImage, initialFollowing, initialSaved }: { post: FeedItemDto; currentUserId: string | null; currentUserName: string | null; currentUserProfileImage: string | null; nextPostHasImage: boolean; initialFollowing: boolean; initialSaved: boolean }) {
  const [liked, setLiked] = useState(post.initiallyLiked);
  const [likeCount, setLikeCount] = useState(post.initialLikeCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentsSection, setCommentsSection] = useState<CommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [authorAvatars, setAuthorAvatars] = useState<Record<string, string | null>>({});
  const [imgLoaded, setImgLoaded] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; userName: string } | null>(null);
  const [saved, setSaved] = useState(initialSaved);
  const isOwnPost = post.plan.ownerUserId === currentUserId;

  // ── Slides (swipeable stories) ────────────────────────────────────────────
  const [slideIndex, setSlideIndex] = useState(0);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const swipeActive = useRef<boolean>(false);

  type SlideData = { type: "cover" } | { type: "photo"; url: string } | { type: "summary" };
  const slides: SlideData[] = [{ type: "cover" }];
  if (post.photosSnapshot?.length) {
    post.photosSnapshot.forEach((p) => slides.push({ type: "photo", url: p.url }));
  }
  if (post.itinerarySnapshot?.length || post.expensesSnapshot) {
    slides.push({ type: "summary" });
  }
  const slidesLen = slides.length;
  const clampedIndex = Math.min(slideIndex, slidesLen - 1);
  const currentSlide = slides[clampedIndex];

  const goNext = useCallback(() => setSlideIndex((p) => Math.min(p + 1, slidesLen - 1)), [slidesLen]);
  const goPrev = useCallback(() => setSlideIndex((p) => Math.max(p - 1, 0)), []);

  // Imperative touch listeners so we can call preventDefault on horizontal swipes
  useEffect(() => {
    const el = slideContainerRef.current;
    if (!el || slidesLen <= 1) return;

    function onStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      swipeActive.current = false;
    }

    function onMove(e: TouchEvent) {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (!swipeActive.current && (dx > 6 || dy > 6)) {
        swipeActive.current = dx > dy;
      }
      if (swipeActive.current) e.preventDefault();
    }

    function onEnd(e: TouchEvent) {
      if (!swipeActive.current) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) < 35) return;
      if (dx < 0) setSlideIndex((p) => Math.min(p + 1, slidesLen - 1));
      else setSlideIndex((p) => Math.max(p - 1, 0));
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [slidesLen]);

  function getSlideActivityEmoji(tipo: string): string {
    const m: Record<string, string> = { VUELO: "✈️", BARCO: "🚢", TREN: "🚆", BUS: "🚌", COCHE: "🚗", HOTEL: "🏨", RESTAURANTE: "🍽️", ACTIVIDAD: "🎯", OTRO: "📌" };
    return m[tipo] ?? "📌";
  }

  function fmtSlideTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => { setSaved(initialSaved); }, [initialSaved]);

  const handleToggleSave = async () => {
    if (!currentUserId) return;
    const next = !saved;
    setSaved(next); // optimistic
    try {
      if (next) await savePlan(post.plan.id);
      else await unsavePlan(post.plan.id);
    } catch {
      setSaved(!next); // revert
    }
  };

  const { following, showUnfollowDialog, setShowUnfollowDialog, onPress: onFollowPress, handleUnfollow } = useFollow(
    post.plan.ownerUserId,
    currentUserId,
    initialFollowing
  );
  const [expandedReplies, setExpandedReplies] = useState<Record<string, number>>({});
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
  }, [authorAvatars, commentsSection, currentUserId, currentUserName, post.avatarImage]);

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

  useEffect(() => {
    if (!commentsModalOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setCommentsModalOpen(false);
        setEmojiPickerOpen(false);
      }
    };
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", handler);
    const frame = window.requestAnimationFrame(() => commentInputRef.current?.focus());
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.removeEventListener("keydown", handler);
      window.cancelAnimationFrame(frame);
    };
  }, [commentsModalOpen]);

  const insertEmoji = (emoji: string) => {
    setCommentText((prev) => prev + emoji);
    setEmojiPickerOpen(false);
    commentInputRef.current?.focus();
  };

  const openCommentsModal = () => {
    setCommentsModalOpen(true);
    setEmojiPickerOpen(false);
  };


  const onLikeToggle = async () => {
    if (!currentUserId || likeLoading) return;

    // Optimistic update
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c) => newLiked ? c + 1 : Math.max(0, c - 1));
    setLikeAnimating(true);

    setLikeLoading(true);
    try {
      const result = await togglePlanLike({
        userId: currentUserId,
        planId: post.plan.id,
      });
      // Sync with server result
      setLiked(result.liked);
      setLikeCount(result.likeCount);

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
      // Revert on error
      setLiked(liked);
      setLikeCount((c) => newLiked ? Math.max(0, c - 1) : c + 1);
      console.error("[feed] Error toggling like:", e);
    } finally {
      setLikeLoading(false);
    }
  };

  const onToggleCommentLike = async (commentId: string) => {
    if (!currentUserId) return;
    // Optimistic update
    setCommentsSection((prev) => prev.map((c) => {
      if (c.commentId !== commentId) return c;
      const liked = !c.likedByMe;
      return { ...c, likedByMe: liked, likeCount: liked ? c.likeCount + 1 : Math.max(0, c.likeCount - 1) };
    }));
    try {
      await toggleCommentLike({ planId: post.plan.id, commentId, userId: currentUserId });
    } catch {
      // Revert on error
      setCommentsSection((prev) => prev.map((c) => {
        if (c.commentId !== commentId) return c;
        const liked = !c.likedByMe;
        return { ...c, likedByMe: liked, likeCount: liked ? c.likeCount + 1 : Math.max(0, c.likeCount - 1) };
      }));
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
        parentId: replyingTo?.commentId ?? null,
      });
      setCommentText("");
      setReplyingTo(null);
      // Auto-expand replies for the parent so the new reply is visible
      if (replyingTo) {
        setExpandedReplies((prev) => ({ ...prev, [replyingTo.commentId]: (prev[replyingTo.commentId] ?? 0) + 2 }));
      }
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

  const formatRelativeTime = (iso: string | null) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} sem`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} mes`;
    const years = Math.floor(days / 365);
    return `${years} a`;
  };

  const renderComment = (comment: CommentDto, isReply = false) => {
    const avatarImg = authorAvatars[comment.userId] ?? null;
    const initial = (getCommentAuthorName(comment)[0] || "U").toUpperCase();
    return (
      <div key={comment.commentId} className="flex items-start gap-3">
        <div className={`-mt-[4px] flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset ${isReply ? "size-[28px]" : "size-[36px]"}`}>
          {avatarImg ? (
            <NextImage src={avatarImg} alt="" width={36} height={36} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
          ) : (
            <span className={`font-[var(--fw-semibold)] text-app ${isReply ? "text-[14px]" : "text-[14px]"}`}>{initial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <p className="min-w-0 flex-1 text-[15px] leading-[1.35] text-app">
              <Link href={`/profile/${comment.userId}`} className="font-[800] tracking-[0.01em]">{getCommentAuthorName(comment)}</Link>{" "}
              {comment.content}
            </p>
            <button
              type="button"
              className="mt-0.5 shrink-0 transition-opacity hover:opacity-70"
              aria-label="Me gusta"
              onClick={() => onToggleCommentLike(comment.commentId)}
            >
              <PlaneIcon liked={comment.likedByMe} size={18} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[14px] font-[var(--fw-semibold)] text-muted">
            <span>{formatRelativeTime(comment.createdAt)}</span>
            {comment.likeCount > 0 ? <span>{comment.likeCount} Me gusta</span> : null}
            {!isReply && (
              <button
                type="button"
                className="transition-opacity hover:opacity-70"
                onClick={() => {
                  const name = getCommentAuthorName(comment);
                  setReplyingTo({ commentId: comment.commentId, userName: name });
                  const val = `@${name} `;
                  setCommentText(val);
                  setTimeout(() => {
                    const input = commentInputRef.current;
                    if (!input) return;
                    input.focus();
                    input.setSelectionRange(val.length, val.length);
                  }, 50);
                }}
              >
                Responder
              </button>
            )}
            {(comment.userId === currentUserId || post.plan.ownerUserId === currentUserId) && (
              <button type="button" className="text-muted opacity-50 transition-opacity hover:opacity-100" aria-label="Eliminar comentario" onClick={() => setConfirmDeleteId(comment.commentId)}>
                <TrashIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCommentsList = () => {
    if (commentsLoading) {
      return <p className="py-6 text-center text-body-sm text-muted">Cargando comentarios...</p>;
    }

    if (commentsSection.length === 0) {
      return <p className="py-6 text-center text-body-sm text-muted">Todavía no hay comentarios.</p>;
    }

    const topLevel = commentsSection.filter((c) => !c.parentId);
    const repliesByParent = commentsSection.reduce<Record<string, CommentDto[]>>((acc, c) => {
      if (!c.parentId) return acc;
      (acc[c.parentId] ??= []).push(c);
      return acc;
    }, {});

    return (
      <div className="space-y-[var(--space-4)]">
        {topLevel.map((comment) => {
          const replies = repliesByParent[comment.commentId] ?? [];
          const visibleCount = expandedReplies[comment.commentId] ?? 0;
          const visibleReplies = replies.slice(0, visibleCount);
          const hiddenCount = replies.length - visibleCount;

          return (
            <div key={comment.commentId}>
              {renderComment(comment)}
              {replies.length > 0 && (
                <div className="ml-[48px] mt-[var(--space-2)] space-y-[var(--space-3)]">
                  {visibleReplies.map((reply) => renderComment(reply, true))}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      className="flex items-center gap-2 text-[14px] font-[var(--fw-semibold)] text-muted"
                      onClick={() => setExpandedReplies((prev) => ({ ...prev, [comment.commentId]: (prev[comment.commentId] ?? 0) + 2 }))}
                    >
                      <span className="h-px w-6 bg-muted/40" />
                      Ver respuestas ({hiddenCount})
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <article className={`relative h-full overflow-hidden md:overflow-visible ${post.hasImage && !nextPostHasImage ? "" : ""}`}>

      {/* ── MOBILE: full-screen snap card ── */}
      <div
        ref={slideContainerRef}
        className="absolute inset-0 md:hidden"
        onClick={(e) => {
          if (slidesLen <= 1) return;
          if ((e.target as HTMLElement).closest("button, a")) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const third = rect.width / 3;
          if (x < third) goPrev();
          else if (x > third * 2) goNext();
        }}
      >
        {/* Progress bars */}
        {slides.length > 1 && (
          <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-[3px] px-3 pt-[max(8px,env(safe-area-inset-top))]">
            {slides.map((_, i) => (
              <div
                key={i}
                className="h-[2.5px] rounded-full transition-all duration-300"
                style={{
                  flex: 1,
                  background: i === clampedIndex ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.28)",
                }}
              />
            ))}
          </div>
        )}

        {/* Backgrounds — all rendered at once so images preload in parallel */}
        {slides.map((slide, i) => {
          const active = i === clampedIndex;
          const base = "absolute inset-0 transition-opacity duration-150 " + (active ? "opacity-100 z-[1]" : "opacity-0 z-0");
          if (slide.type === "cover") {
            return post.hasImage && post.coverImage ? (
              <div key="cover" className={`${base} bg-app`}>
                {!imgLoaded && active && <div className="skeleton-shimmer absolute inset-0" aria-hidden="true" />}
                <NextImage
                  src={post.coverImage}
                  alt="Imagen del plan"
                  fill
                  className="object-contain"
                  style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.2s" }}
                  unoptimized
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgLoaded(true)}
                />
              </div>
            ) : (
              <div key="cover" className={`${base} bg-app`} />
            );
          }
          if (slide.type === "photo") {
            return (
              <div key={`photo-${i}`} className={`${base} bg-[#0a0a0a]`}>
                <NextImage src={slide.url} alt="" fill className="object-contain" unoptimized />
              </div>
            );
          }
          if (slide.type === "summary") {
            return (
              <div key="summary" className={`${base} bg-[#0d0e12]`}>
                {post.coverImage && (
                  <NextImage src={post.coverImage} alt="" fill className="object-cover opacity-15 scale-110 blur-xl" unoptimized />
                )}
                <div className="absolute inset-0 bg-black/50" />
              </div>
            );
          }
          return null;
        })}

        {/* Text content (only for text-only posts) — same layout as desktop */}
        {!post.hasImage && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-[max(var(--page-margin-x),env(safe-area-inset-left))]">
            <div className="w-full max-w-[420px] rounded-2xl border border-[var(--border)] p-6">
              <div className="flex items-center gap-3 mb-5">
                <Link href={`/profile/${post.plan.ownerUserId}`} onClick={(e) => e.stopPropagation()}>
                  <div className="flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)]">
                    {post.avatarImage ? (
                      <NextImage src={post.avatarImage} alt={post.avatarLabel} width={40} height={40} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[14px] font-[700] text-[var(--text-primary)]">{post.avatarLabel}</span>
                    )}
                  </div>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${post.plan.ownerUserId}`} onClick={(e) => e.stopPropagation()} className="text-[15px] font-[800] text-[var(--text-primary)]">{post.userName}</Link>
                  {post.plan.locationName && (
                    <p className="text-[14px] text-[var(--text-tertiary)] mt-[1px]">{post.plan.locationName}</p>
                  )}
                </div>
                {!isOwnPost && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onFollowPress(); }}
                    className={`shrink-0 text-[14px] font-[700] transition-opacity hover:opacity-70 ${following ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"}`}
                  >
                    {following ? "Siguiendo" : "Seguir"}
                  </button>
                )}
              </div>
              {post.plan.title && (
                <p className="text-[20px] font-[800] leading-tight text-[var(--text-primary)]">{post.plan.title}</p>
              )}
              {post.text && (
                <p className="mt-3 text-[17px] leading-[1.55] text-[var(--text-primary)]">{post.text}</p>
              )}
              <p className="mt-3 text-[14px] font-[600] text-[var(--text-tertiary)]">
                {formatDate(post.plan.startsAt) === formatDate(post.plan.endsAt)
                  ? formatDate(post.plan.startsAt)
                  : `${formatDate(post.plan.startsAt)} – ${formatDate(post.plan.endsAt)}`}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[var(--text-secondary)] disabled:opacity-40 transition-opacity hover:opacity-70"
                  onClick={(e) => { e.stopPropagation(); onLikeToggle(); }}
                  disabled={!currentUserId || likeLoading}
                  aria-label={liked ? "Quitar like" : "Dar like"}
                >
                  <PlaneIcon liked={liked} animating={likeAnimating} size={24} className={liked ? "text-primary-token" : ""} />
                  <span className={`text-[14px] font-[700] ${likeCount > 0 ? "" : "invisible"}`}>{likeCount || 0}</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[var(--text-secondary)] transition-opacity hover:opacity-70"
                  onClick={(e) => { e.stopPropagation(); openCommentsModal(); }}
                  aria-label="Comentarios"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-[24px]" aria-hidden="true">
                    <path d="M12 4C7.582 4 4 6.91 4 10.5C4 12.31 4.913 13.947 6.39 15.109C6.272 16.213 5.79 17.343 4.98 18.316C4.787 18.549 5.02 18.88 5.315 18.785C7.005 18.243 8.357 17.471 9.235 16.86C10.115 17.113 11.04 17.25 12 17.25C16.418 17.25 20 14.34 20 10.75C20 7.16 16.418 4 12 4Z" />
                  </svg>
                  <span className={`text-[14px] font-[700] ${commentsSection.length > 0 ? "" : "invisible"}`}>{commentsSection.length || 0}</span>
                </button>
                <button
                  type="button"
                  className={`transition-opacity hover:opacity-70 ${saved ? "text-primary-token" : "text-[var(--text-secondary)]"}`}
                  onClick={(e) => { e.stopPropagation(); handleToggleSave(); }}
                  aria-label={saved ? "Quitar guardado" : "Guardar"}
                >
                  <BookmarkIcon size={24} />
                </button>
                <Link
                  href={`/plan/${post.plan.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto flex items-center gap-1 text-[14px] font-[700] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Ver plan
                  <svg viewBox="0 0 24 24" fill="none" className="size-[12px]" aria-hidden="true">
                    <path d="M13 3L21 12M21 12L13 21M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Top: avatar + name + follow (image posts only) */}
        {post.hasImage && <div className={`absolute inset-x-0 top-0 z-20 flex items-center gap-2.5 px-4 ${slides.length > 1 ? "pt-7" : "pt-4"}`} style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.45))" }}>
          <Link
            href={`/profile/${post.plan.ownerUserId}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 min-w-0"
          >
            <div className="flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)]">
              {post.avatarImage ? (
                <NextImage src={post.avatarImage} alt={post.avatarLabel} width={34} height={34} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[14px] font-[700] text-white">{post.avatarLabel}</span>
              )}
            </div>
            <span className="text-[15px] font-[800] text-white truncate">{post.userName}</span>
          </Link>
          {!isOwnPost && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFollowPress(); }}
              className={`ml-1 shrink-0 text-[14px] font-[700] transition-opacity ${following ? "text-white/50" : "text-white"}`}
            >
              {following ? "· Siguiendo" : "· Seguir"}
            </button>
          )}
          <Link
            href={`/plan/${post.plan.id}`}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto shrink-0 flex items-center gap-1 text-[14px] font-[700] text-white transition-opacity hover:opacity-70"
          >
            Ver plan
            <svg viewBox="0 0 24 24" fill="none" className="size-[11px]" aria-hidden="true">
              <path d="M13 3L21 12M21 12L13 21M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>}

        {/* Right: actions (image posts only) */}
        {post.hasImage && <div
          className="absolute right-4 bottom-0 z-20 flex flex-col items-center gap-6"
          style={{ paddingBottom: `max(96px, calc(96px + env(safe-area-inset-bottom)))`, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))" }}
        >
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-white disabled:opacity-40 active:scale-90 transition-transform"
            onClick={(e) => { e.stopPropagation(); onLikeToggle(); }}
            disabled={!currentUserId || likeLoading}
            aria-label={liked ? "Quitar like" : "Dar like"}
          >
            <PlaneIcon liked={liked} animating={likeAnimating} size={34} className={liked ? "text-primary-token" : "text-white"} />
            <span className={`text-[13px] font-[700] leading-none ${likeCount > 0 ? "text-white" : "invisible"}`}>{likeCount || 0}</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-white active:scale-90 transition-transform"
            onClick={(e) => { e.stopPropagation(); openCommentsModal(); }}
            aria-label="Comentarios"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-[34px]" aria-hidden="true">
              <path d="M12 4C7.582 4 4 6.91 4 10.5C4 12.31 4.913 13.947 6.39 15.109C6.272 16.213 5.79 17.343 4.98 18.316C4.787 18.549 5.02 18.88 5.315 18.785C7.005 18.243 8.357 17.471 9.235 16.86C10.115 17.113 11.04 17.25 12 17.25C16.418 17.25 20 14.34 20 10.75C20 7.16 16.418 4 12 4Z" />
            </svg>
            <span className={`text-[13px] font-[700] leading-none ${commentsSection.length > 0 ? "text-white" : "invisible"}`}>{commentsSection.length || 0}</span>
          </button>
          {!isOwnPost && (
            <button
              type="button"
              className="flex flex-col items-center gap-1 text-white active:scale-90 transition-transform"
              onClick={(e) => { e.stopPropagation(); handleToggleSave(); }}
              aria-label={saved ? "Quitar guardado" : "Guardar"}
            >
              <svg width={34} height={34} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={saved ? "text-primary-token" : "text-white"}>
                <path d="M7 4.5H17C17.55 4.5 18 4.95 18 5.5V20L12 16.2L6 20V5.5C6 4.95 6.45 4.5 7 4.5Z" />
              </svg>
              <span className="invisible text-[13px] font-[700] leading-none">0</span>
            </button>
          )}
        </div>}

        {/* Bottom: info (image posts only) */}
        {post.hasImage && <div
          className="absolute inset-x-0 bottom-0 z-20 px-4 pr-[76px]"
          style={{ paddingBottom: `max(88px, calc(88px + env(safe-area-inset-bottom)))`, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.45))" }}
        >
          {currentSlide.type === "summary" ? (
            /* Summary slide: mini itinerary + expenses (sombra en contenedor padre) */
            <div className="space-y-4">
              {post.itinerarySnapshot && post.itinerarySnapshot.length > 0 && (() => {
                const items = post.itinerarySnapshot.slice(0, 4);
                const hasMore = post.itinerarySnapshot.length > 4;
                return (
                  <div>
                    <p className="text-[10px] font-[700] text-white/45 uppercase tracking-[0.14em] mb-2.5">
                      {post.itinerarySnapshot.length} {post.itinerarySnapshot.length === 1 ? "actividad" : "actividades"}
                    </p>
                    <div className="relative pl-6">
                      {/* vertical line */}
                      <div className="absolute left-[8px] top-1 bottom-1 w-px bg-white/15" />
                      <div className="space-y-2.5">
                        {items.map((item, i) => (
                          <div key={i} className="relative flex items-start gap-2.5">
                            {/* node */}
                            <div
                              className="absolute -left-6 top-[3px] size-[17px] rounded-full flex items-center justify-center text-[9px] leading-none border border-white/15"
                              style={{ background: "rgba(255,255,255,0.08)" }}
                            >
                              {getSlideActivityEmoji(item.tipo)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-[700] text-white leading-snug truncate">{item.titulo}</p>
                              {item.ubicacion_nombre && (
                                <p className="text-[11px] text-white/45 truncate mt-0.5">{item.ubicacion_nombre}</p>
                              )}
                            </div>
                            <span className="text-[11px] text-white/40 shrink-0 tabular-nums mt-0.5 font-[500]">{fmtSlideTime(item.inicio_at)}</span>
                          </div>
                        ))}
                        {hasMore && (
                          <div className="relative flex items-center gap-2">
                            <div className="absolute -left-6 size-[17px] flex items-center justify-center">
                              <div className="flex flex-col gap-[3px] items-center">
                                <div className="size-[3px] rounded-full bg-white/25" />
                                <div className="size-[3px] rounded-full bg-white/25" />
                                <div className="size-[3px] rounded-full bg-white/25" />
                              </div>
                            </div>
                            <p className="text-[12px] text-white/35 font-[500]">+{post.itinerarySnapshot.length - 4} más</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {post.expensesSnapshot && (
                <div className="flex items-baseline gap-2">
                  <p className="text-[11px] font-[600] text-white/45 uppercase tracking-[0.1em]">Total</p>
                  <p className="text-[22px] font-[800] text-white tracking-tight leading-none">
                    {post.expensesSnapshot.currency} {Math.round(post.expensesSnapshot.total).toLocaleString("es-ES")}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Cover / photo slides: title + location */
            <div className="min-w-0">
              {post.plan.title && (
                <p className="text-[18px] font-[800] leading-tight text-white">{post.plan.title}</p>
              )}
              <p className="mt-[2px] text-[14px] font-[600] text-white/80">
                {[
                  post.plan.locationName,
                  formatDate(post.plan.startsAt) === formatDate(post.plan.endsAt)
                    ? formatDate(post.plan.startsAt)
                    : `${formatDate(post.plan.startsAt)} – ${formatDate(post.plan.endsAt)}`
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
          )}
        </div>}
      </div>

      {/* ── DESKTOP: TikTok-style full-screen ── */}
      <div className="hidden md:flex h-full items-center justify-center overflow-hidden">

        {/* Content: image centered, no side column */}
        <div className="flex h-full w-full items-center justify-center px-8 py-8">

          {post.hasImage && post.coverImage ? (
            <div className="flex items-center gap-5">
              {/* Image */}
              <div
                className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl"
                style={{
                  width: "min(50dvw, 620px)",
                  height: "min(calc(100dvh - 160px), 820px)",
                  minWidth: "340px",
                  minHeight: "420px",
                }}
              >
                {!imgLoaded && <div className="skeleton-shimmer absolute inset-0 rounded-2xl" aria-hidden="true" />}
                <NextImage
                  src={post.coverImage}
                  alt="Imagen del plan"
                  width={1600}
                  height={1600}
                  className="block max-h-full max-w-full rounded-2xl object-contain transition-opacity duration-300"
                  style={{ opacity: imgLoaded ? 1 : 0 }}
                  unoptimized
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgLoaded(true)}
                />

                {/* Top overlay: avatar + name + follow */}
                <div className="absolute inset-x-0 top-0 px-4 pb-8 pt-4" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.45))" }}>
                  <div className="flex items-center gap-2.5">
                    <Link href={`/profile/${post.plan.ownerUserId}`} className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/10">
                        {post.avatarImage ? (
                          <NextImage src={post.avatarImage} alt={post.avatarLabel} width={34} height={34} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-[14px] font-[700] text-white">{post.avatarLabel}</span>
                        )}
                      </div>
                      <span className="text-[14px] font-[800] text-white truncate">{post.userName}</span>
                    </Link>
                    {!isOwnPost && (
                      <button
                        type="button"
                        onClick={onFollowPress}
                        className={`ml-1 shrink-0 text-[14px] font-[700] transition-opacity hover:opacity-70 ${following ? "text-white/45" : "text-white/80"}`}
                      >
                        {following ? "Siguiendo" : "· Seguir"}
                      </button>
                    )}
                    <Link
                      href={`/plan/${post.plan.id}`}
                      className="ml-auto shrink-0 flex items-center gap-1 text-[14px] font-[700] text-white transition-opacity hover:opacity-70"
                    >
                      Ver plan
                      <svg viewBox="0 0 24 24" fill="none" className="size-[11px]" aria-hidden="true">
                        <path d="M13 3L21 12M21 12L13 21M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </div>
                </div>

                {/* Bottom: title + location */}
                <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-6" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.45))" }}>
                  <div className="min-w-0">
                    {post.plan.title && (
                      <p className="text-[16px] font-[800] leading-tight text-white">{post.plan.title}</p>
                    )}
                    <p className="mt-[2px] text-[14px] font-[600] text-white/85">
                      {[
                        post.plan.locationName,
                        formatDate(post.plan.startsAt) === formatDate(post.plan.endsAt)
                          ? formatDate(post.plan.startsAt)
                          : `${formatDate(post.plan.startsAt)} – ${formatDate(post.plan.endsAt)}`
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions column — lateral derecho, centrado verticalmente */}
              <div className="flex shrink-0 flex-col items-center justify-center gap-6" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))" }}>
                <button
                  type="button"
                  className="flex flex-col items-center gap-1 disabled:opacity-40 active:scale-90 transition-transform"
                  onClick={onLikeToggle}
                  disabled={!currentUserId || likeLoading}
                  aria-label={liked ? "Quitar like" : "Dar like"}
                >
                  <PlaneIcon liked={liked} animating={likeAnimating} size={34} className={liked ? "text-primary-token" : "text-white"} />
                  <span className={`text-[13px] font-[700] leading-none text-white ${likeCount > 0 ? "" : "invisible"}`}>{likeCount || 0}</span>
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center gap-1 text-white active:scale-90 transition-transform"
                  onClick={openCommentsModal}
                  aria-label="Comentarios"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-[34px]" aria-hidden="true">
                    <path d="M12 4C7.582 4 4 6.91 4 10.5C4 12.31 4.913 13.947 6.39 15.109C6.272 16.213 5.79 17.343 4.98 18.316C4.787 18.549 5.02 18.88 5.315 18.785C7.005 18.243 8.357 17.471 9.235 16.86C10.115 17.113 11.04 17.25 12 17.25C16.418 17.25 20 14.34 20 10.75C20 7.16 16.418 4 12 4Z" />
                  </svg>
                  <span className={`text-[13px] font-[700] leading-none text-white ${commentsSection.length > 0 ? "" : "invisible"}`}>{commentsSection.length || 0}</span>
                </button>
                {!isOwnPost && (
                  <button
                    type="button"
                    className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                    onClick={handleToggleSave}
                    aria-label={saved ? "Quitar guardado" : "Guardar"}
                  >
                    <svg width={34} height={34} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={saved ? "text-primary-token" : "text-white"}>
                      <path d="M7 4.5H17C17.55 4.5 18 4.95 18 5.5V20L12 16.2L6 20V5.5C6 4.95 6.45 4.5 7 4.5Z" />
                    </svg>
                    <span className="invisible text-[13px] font-[700] leading-none">0</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Text-only post */
            <div className="w-full max-w-[500px] rounded-2xl border border-[var(--border)] p-8">
              <div className="flex items-center gap-3 mb-5">
                <Link href={`/profile/${post.plan.ownerUserId}`}>
                  <div className="flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)] transition-opacity hover:opacity-80">
                    {post.avatarImage ? (
                      <NextImage src={post.avatarImage} alt={post.avatarLabel} width={40} height={40} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[14px] font-[700] text-[var(--text-primary)]">{post.avatarLabel}</span>
                    )}
                  </div>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${post.plan.ownerUserId}`} className="text-[15px] font-[800] text-[var(--text-primary)]">{post.userName}</Link>
                  {post.plan.locationName && (
                    <p className="text-[14px] text-[var(--text-tertiary)] mt-[1px]">{post.plan.locationName}</p>
                  )}
                </div>
                {!isOwnPost && (
                  <button
                    type="button"
                    onClick={onFollowPress}
                    className={`shrink-0 text-[14px] font-[700] transition-opacity hover:opacity-70 ${following ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"}`}
                  >
                    {following ? "Siguiendo" : "Seguir"}
                  </button>
                )}
              </div>
              {post.text && (
                <p className="text-[17px] leading-[1.55] text-[var(--text-primary)]">{post.text}</p>
              )}
              <p className="mt-4 text-[14px] font-[600] text-[var(--text-tertiary)]">
                {formatDate(post.plan.startsAt) === formatDate(post.plan.endsAt)
                  ? formatDate(post.plan.startsAt)
                  : `${formatDate(post.plan.startsAt)} – ${formatDate(post.plan.endsAt)}`}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[var(--text-secondary)] disabled:opacity-40 transition-opacity hover:opacity-70"
                  onClick={onLikeToggle}
                  disabled={!currentUserId || likeLoading}
                  aria-label={liked ? "Quitar like" : "Dar like"}
                >
                  <PlaneIcon liked={liked} animating={likeAnimating} size={24} className={liked ? "text-primary-token" : ""} />
                  <span className={`text-[14px] font-[700] ${likeCount > 0 ? "" : "invisible"}`}>{likeCount || 0}</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[var(--text-secondary)] transition-opacity hover:opacity-70"
                  onClick={openCommentsModal}
                  aria-label="Comentarios"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-[24px]" aria-hidden="true">
                    <path d="M12 4C7.582 4 4 6.91 4 10.5C4 12.31 4.913 13.947 6.39 15.109C6.272 16.213 5.79 17.343 4.98 18.316C4.787 18.549 5.02 18.88 5.315 18.785C7.005 18.243 8.357 17.471 9.235 16.86C10.115 17.113 11.04 17.25 12 17.25C16.418 17.25 20 14.34 20 10.75C20 7.16 16.418 4 12 4Z" />
                  </svg>
                  <span className={`text-[14px] font-[700] ${commentsSection.length > 0 ? "" : "invisible"}`}>{commentsSection.length || 0}</span>
                </button>
                <button
                  type="button"
                  className={`transition-opacity hover:opacity-70 ${saved ? "text-primary-token" : "text-[var(--text-secondary)]"}`}
                  onClick={handleToggleSave}
                  aria-label={saved ? "Quitar guardado" : "Guardar"}
                >
                  <BookmarkIcon size={24} />
                </button>
                <Link
                  href={`/plan/${post.plan.id}`}
                  className="ml-auto flex items-center gap-1 text-[14px] font-[700] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Ver plan
                  <svg viewBox="0 0 24 24" fill="none" className="size-[12px]" aria-hidden="true">
                    <path d="M13 3L21 12M21 12L13 21M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>{/* end desktop wrapper */}

      {commentsModalOpen && (
        <div className="comments-modal-overlay fixed inset-0 z-[1100] flex items-end justify-center bg-black/65 md:items-center md:p-[var(--space-6)]" onClick={() => { setCommentsModalOpen(false); setEmojiPickerOpen(false); }}>
          <div className="comments-modal-panel grid h-dvh w-full overflow-hidden bg-app shadow-elev-4 md:h-[min(88dvh,760px)] md:max-w-[1120px] md:rounded-[6px] md:grid-cols-[minmax(0,1fr)_420px]" onClick={(e) => e.stopPropagation()}>
            <div className="relative hidden min-h-0 bg-[#111] md:block">
              {post.hasImage && post.coverImage ? (
                <NextImage src={post.coverImage} alt="Imagen del plan" width={1200} height={900} className="h-full w-full object-contain" unoptimized referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full flex-col justify-end bg-[radial-gradient(circle_at_top,#2a2a2a,transparent_55%),linear-gradient(180deg,#171717,#0d0d0d)] p-[var(--space-6)]">
                  <p className="text-[28px] font-[800] leading-tight text-white">{post.userName}</p>
                  {post.text ? <p className="mt-[var(--space-3)] max-w-[460px] text-body text-white/75">{post.text}</p> : null}
                  {post.plan.locationName ? <p className="mt-[var(--space-5)] text-body-sm font-[var(--fw-semibold)] text-white/80">{post.plan.locationName}</p> : null}
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-[var(--space-6)] pb-[var(--space-6)] pt-[var(--space-12)]">
                <div className="pointer-events-auto flex items-center gap-3">
                  <div className="flex size-[42px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10">
                    {post.avatarImage ? (
                      <NextImage src={post.avatarImage} alt={post.userName} width={42} height={42} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[15px] font-[var(--fw-semibold)] text-white">{post.avatarLabel}</span>
                    )}
                  </div>
                  <div className="min-w-0 text-[15px]">
                    <Link href={`/profile/${post.plan.ownerUserId}`} className="truncate font-[800] text-white">{post.userName}</Link>
                    <span className="px-2 text-white/50">•</span>
                    {!isOwnPost && (
                      <button type="button" onClick={onFollowPress} className={`font-[700] transition-opacity hover:opacity-80 ${following ? "text-muted" : "text-primary-token"}`}>
                        {following ? "Siguiendo" : "Seguir"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col bg-app">
              <div className="flex items-center justify-between border-b px-[22px] py-[18px]">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-[42px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset">
                    {post.avatarImage ? (
                      <NextImage src={post.avatarImage} alt={post.userName} width={42} height={42} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[15px] font-[var(--fw-semibold)] text-app">{post.avatarLabel}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link href={`/profile/${post.plan.ownerUserId}`} className="truncate text-[15px] font-[800] text-app">{post.userName}</Link>
                      {!isOwnPost && (
                        <button type="button" onClick={onFollowPress} className={`shrink-0 text-[13px] font-[700] transition-opacity hover:opacity-80 ${following ? "text-muted" : "text-primary-token"}`}>
                          {following ? "Siguiendo" : "· Seguir"}
                        </button>
                      )}
                    </div>
                    {(post.plan.title || post.plan.startsAt) && (
                      <p className="mt-[2px] flex items-center gap-1.5 truncate text-[13px] text-muted">
                        {post.plan.title && <span className="truncate font-[600]">{post.plan.title}</span>}
                        {post.plan.title && post.plan.startsAt && <span className="shrink-0">·</span>}
                        {post.plan.startsAt && (
                          <span className="shrink-0">
                            {formatDate(post.plan.startsAt) === formatDate(post.plan.endsAt)
                              ? formatDate(post.plan.startsAt)
                              : `${formatDate(post.plan.startsAt)} – ${formatDate(post.plan.endsAt)}`}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => { setCommentsModalOpen(false); setEmojiPickerOpen(false); }} aria-label="Cerrar comentarios" className="text-muted transition-opacity hover:opacity-70">
                  <CloseIcon />
                </button>
              </div>

              <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain px-[22px] py-[22px]">
                {renderCommentsList()}
              </div>

              <div className="px-[22px] py-[14px]">
                <div className="flex items-center gap-4 text-app">
                  <button type="button" className="flex items-center gap-[6px] transition-opacity hover:opacity-70" aria-label="Me gusta" onClick={onLikeToggle} disabled={!currentUserId}>
                    <PlaneIcon liked={liked} animating={likeAnimating} size={28} />
                    {likeCount > 0 ? <span className="text-[14px] font-[700] text-app">{likeCount}</span> : null}
                  </button>
                  <button type="button" className="flex items-center gap-[6px] transition-opacity hover:opacity-70" aria-label="Comentarios">
                    <CommentIcon />
                    {commentsSection.length > 0 ? <span className="text-[14px] font-[700] text-app">{commentsSection.length}</span> : null}
                  </button>
                  <button type="button" className="transition-opacity hover:opacity-70" aria-label="Compartir">
                    <ShareIcon />
                  </button>
                  {!isOwnPost && (
                    <button type="button" onClick={handleToggleSave} className={`ml-auto transition-opacity hover:opacity-70 ${saved ? "text-primary-token" : ""}`} aria-label="Guardar">
                      <BookmarkIcon />
                    </button>
                  )}
                </div>
              </div>

              <div ref={emojiPickerRef} className="relative px-[22px] py-[14px]">
                {emojiPickerOpen && (
                  <div className="absolute bottom-[calc(100%+8px)] left-[22px] z-[70] w-[256px] rounded-[10px] border border-app bg-[var(--surface-raised)] p-2 shadow-lg backdrop-blur-md">
                    <div className="scrollbar-thin grid max-h-[180px] grid-cols-8 gap-0.5 overflow-x-hidden overflow-y-auto overscroll-contain">
                      {EMOJI_LIST.map((emoji) => (
                        <button key={emoji} type="button" className="flex size-[30px] items-center justify-center rounded-[6px] text-[18px] transition-colors hover:bg-[var(--interactive-hover-surface)]" onClick={() => insertEmoji(emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {replyingTo && (
                  <div className="flex items-center justify-between px-[2px] pb-[4px] text-[14px] text-muted">
                    <span>Respondiendo a <span className="font-[700] text-app">@{replyingTo.userName}</span></span>
                    <button type="button" onClick={() => { setReplyingTo(null); setCommentText(""); }} className="text-muted hover:opacity-70">✕</button>
                  </div>
                )}
                <div className="flex items-center gap-[var(--space-2)]">
                  <button type="button" className="flex items-center justify-center text-muted" aria-label="Emoticonos" onClick={() => setEmojiPickerOpen((prev) => !prev)}>
                    <SmileyIcon />
                  </button>
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={onCommentKeyDown}
                    placeholder={replyingTo ? `Responder a @${replyingTo.userName}...` : "Añade un comentario..."}
                    className="min-w-0 flex-1 bg-transparent py-[4px] text-[15px] text-app outline-none ring-0 focus:outline-none focus:ring-0 focus:border-transparent placeholder:text-muted"
                    disabled={!currentUserId || commentSubmitting}
                  />
                  {commentText.trim() && (
                    <button type="button" onClick={onSubmitComment} disabled={!currentUserId || commentSubmitting} className="text-[15px] font-[700] text-[#bfc2ca] disabled:opacity-40">
                      Publicar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete comment confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center pb-[max(var(--space-6),env(safe-area-inset-bottom))] sm:items-center" onClick={() => setConfirmDeleteId(null)}>
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
      {showUnfollowDialog && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center pb-[max(var(--space-6),env(safe-area-inset-bottom))] sm:items-center" onClick={() => setShowUnfollowDialog(false)}>
          <div className="w-full max-w-[340px] rounded-modal border border-app bg-surface p-[var(--space-5)] shadow-elev-2 mx-[var(--space-4)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-body font-[var(--fw-semibold)] text-app">¿Dejar de seguir a {post.userName}?</p>
            <p className="mt-[var(--space-1)] text-body-sm text-muted">Dejará de aparecer en tu feed.</p>
            <div className="mt-[var(--space-4)] flex gap-[var(--space-2)]">
              <button type="button" onClick={() => setShowUnfollowDialog(false)} className="flex-1 rounded-button border border-app py-[10px] text-body-sm font-[var(--fw-medium)] text-app transition-colors hover:bg-[var(--interactive-hover-surface)]">
                Cancelar
              </button>
              <button type="button" onClick={handleUnfollow} className="flex-1 rounded-button bg-[var(--error-token,#ef4444)] py-[10px] text-body-sm font-[var(--fw-medium)] text-white transition-opacity hover:opacity-80">
                Dejar de seguir
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}


function CommentIcon() {
  return (
    <svg width="31" height="31" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4C7.582 4 4 6.91 4 10.5C4 12.31 4.913 13.947 6.39 15.109C6.272 16.213 5.79 17.343 4.98 18.316C4.787 18.549 5.02 18.88 5.315 18.785C7.005 18.243 8.357 17.471 9.235 16.86C10.115 17.113 11.04 17.25 12 17.25C16.418 17.25 20 14.34 20 10.75C20 7.16 16.418 4 12 4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function ShareIcon() {
  return (
    <svg width="31" height="31" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 5L10.25 13.75" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M19 5L13.5 19L10.25 13.75L5 10.5L19 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function BookmarkIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5H17C17.55 4.5 18 4.95 18 5.5V20L12 16.2L6 20V5.5C6 4.95 6.45 4.5 7 4.5Z" />
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

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
