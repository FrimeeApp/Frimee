"use client";

import dynamic from "next/dynamic";
import NextImage from "next/image";
const EmojiMartPicker = dynamic(() => import("@emoji-mart/react"), { ssr: false });
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import PlaneIcon from "@/components/ui/PlaneIcon";
import { useFollow } from "@/hooks/useFollow";
import { useToast } from "@/components/ui/Toaster";
import { buildInternalApiUrl } from "@/config/external";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CSSProperties } from "react";
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
import { listActiveFriendFlightsEndpoint } from "@/services/api/endpoints/wallet.endpoint";
import { Phone, Video } from "lucide-react";
import type { PlanTicket } from "@/services/api/endpoints/wallet.endpoint";
import FeedFlightCarousel from "@/components/feed/FeedFlightCarousel";
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
import { STORAGE_KEYS, STORAGE_TTLS } from "@/config/storage";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { CloseX } from "@/components/ui/CloseX";
import { SearchInput } from "@/components/ui/SearchInput";

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
const COMMENT_AUTHOR_CACHE_TTL_MS = STORAGE_TTLS.commentAuthorCacheMs;
const commentAuthorCache = new Map<string, { name: string; profileImage: string | null; cachedAt: number }>();

const RECENTS_KEY = STORAGE_KEYS.feedSearchRecents;
const RECENTS_MAX = 10;

type RecentProfile = { id: string; nombre: string; profile_image: string | null };
type MobileFeedViewportStyle = CSSProperties & { "--mobile-feed-viewport-height": string };
type FeedMobileImageVars = CSSProperties & {
  "--feed-mobile-side-inset": string;
  "--feed-mobile-header-top": string;
  "--feed-mobile-actions-gap": string;
  "--feed-mobile-actions-bottom": string;
  "--feed-mobile-footer-bottom": string;
  "--feed-mobile-avatar-size": string;
  "--feed-mobile-icon-size": string;
  "--feed-mobile-title-size": string;
  "--feed-mobile-meta-size": string;
};

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

const FEED_CACHE_KEY = STORAGE_KEYS.feedCache;
const FEED_CACHE_TTL_MS = STORAGE_TTLS.feedCacheMs;
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
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [savedPlanIds, setSavedPlanIds] = useState<Set<number>>(new Set());
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchValue, setMobileSearchValue] = useState("");
  const [mobileSearchResults, setMobileSearchResults] = useState<PublicUserProfileDto[]>([]);
  const [mobileSearchLoading, setMobileSearchLoading] = useState(false);
  const [createPlanModalOpen, setCreatePlanModalOpen] = useState(false);
  const [suggestedProfiles, setSuggestedProfiles] = useState<PublicUserProfileDto[]>([]);
  const [friendFlights, setFriendFlights] = useState<PlanTicket[]>([]);
  const [recentProfiles, setRecentProfiles] = useState<RecentProfile[]>([]);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(60);

  useEffect(() => {
    if (!currentUserId) {
      setUiPosts([]);
      setLoadingFeed(false);
      return;
    }

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
        listActiveFriendFlightsEndpoint().then(data => { if (!cancelled) setFriendFlights(data); }).catch(() => {});
        const [feedResult, friends] = await Promise.all([
          getFeedPostsOnly({ limit: 20 }),
          fetchActiveFriends(),
        ]);
        const posts = feedResult.posts;
        if (cancelled) return;

        setSuggestedProfiles(friends.slice(0, 12));

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
      const marker = window.localStorage.getItem(STORAGE_KEYS.profileUpdatedAt);
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
    const syncCreatePlanOpen = () => {
      setCreatePlanModalOpen(document.body.hasAttribute("data-create-plan-open"));
    };

    syncCreatePlanOpen();
    const observer = new MutationObserver(syncCreatePlanOpen);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-create-plan-open"] });
    return () => observer.disconnect();
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

  useEffect(() => {
    const header = mobileHeaderRef.current;
    if (!header || typeof window === "undefined") return;

    const measure = () => {
      const nextHeight = Math.ceil(header.getBoundingClientRect().height);
      setMobileHeaderHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

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

  const mobileBottomNavBaseHeight = "clamp(56px, 8dvh, 64px)";
  const mobileFeedViewportHeight = `calc(100dvh - ${mobileHeaderHeight}px - ${mobileBottomNavBaseHeight} - env(safe-area-inset-bottom))`;

  if (loading) return <LoadingScreen />;

  return (
    <div className="h-dvh overflow-hidden bg-app text-app">
      <div className="relative mx-auto h-dvh max-w-[1440px] overflow-hidden">
        <AppSidebar />

        <main
          className={`pt-0 pb-0 md:px-safe md:pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] md:py-[var(--space-8)] md:pl-[102px] md:pr-[var(--space-14)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)]`}
        >
          <div className="mx-auto max-w-[1160px]">
            <div className="md:border-b md:border-[#262626]">
              <div className="mx-auto w-full max-w-[760px] md:ml-[72px] xl:mx-0 xl:ml-[72px]">
              <div
                ref={mobileHeaderRef}
                className={`sticky top-0 z-[100] bg-app pb-[clamp(6px,1.6dvh,var(--space-2))] pt-mobile-safe-top pl-[max(var(--page-margin-x),env(safe-area-inset-left))] pr-[max(var(--page-margin-x),env(safe-area-inset-right))] md:hidden ${createPlanModalOpen ? "hidden" : ""}`}
              >
                <div className="relative flex flex-col items-center gap-[10px]">
                  <div className="relative h-[40px] w-full">
                    <button
                      type="button"
                      onClick={() => setMobileSearchOpen(true)}
                      aria-label="Buscar"
                      className="absolute left-0 right-[44px] top-0 flex h-[40px] items-center gap-[10px] rounded-full border border-app bg-[var(--search-field-bg)] px-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[opacity,background-color] duration-200 ease-out hover:opacity-90 active:scale-[0.98]"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px] shrink-0 text-muted">
                        <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      <span className="truncate text-body-sm font-[400] text-muted">Buscar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNotifPanelOpen(true)}
                      aria-label="Notificaciones"
                      className="absolute right-0 top-1/2 flex size-[34px] -translate-y-1/2 items-center justify-center text-app transition-opacity hover:opacity-70"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[23px]">
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
                  </div>

                  <div className="relative flex min-h-[28px] w-full items-center justify-center">
                    <div className="flex items-center justify-center gap-[10px] text-[13px] font-[700] leading-none">
                      <button
                        type="button"
                        onClick={() => setActiveFeedTab("following")}
                        className={`py-2 transition-colors ${activeFeedTab === "following" ? "text-app" : "text-muted"}`}
                      >
                        Siguiendo
                      </button>
                      <span className="h-[14px] w-px bg-muted/35" aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => setActiveFeedTab("explore")}
                        className={`py-2 transition-colors ${activeFeedTab === "explore" ? "text-app" : "text-muted"}`}
                      >
                        Explorar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fullscreen mobile search panel — fade in/out, above bottom nav */}
              <div
                className={`fixed inset-0 z-[1030] flex flex-col bg-app transition-opacity duration-200 ease-out md:hidden ${
                  mobileSearchOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {/* Search bar at the top */}
                <div className="flex items-center gap-2 pb-[var(--space-4)] pl-[max(var(--space-2),env(safe-area-inset-left))] pr-[max(var(--space-4),env(safe-area-inset-right))] pt-[calc(env(safe-area-inset-top)+var(--space-4))]">
                  <button
                    type="button"
                    onClick={closeMobileSearch}
                    aria-label="Cerrar búsqueda"
                    className="flex h-[40px] w-[36px] shrink-0 items-center justify-center text-app transition-opacity hover:opacity-70"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[20px]">
                      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <SearchInput
                    ref={mobileSearchInputRef}
                    value={mobileSearchValue}
                    onChange={setMobileSearchValue}
                    className="mobile-search-expand-field h-[40px] flex-1"
                  />
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

              <style jsx>{`
                @keyframes mobile-search-expand {
                  from {
                    width: min(66vw, 300px);
                    transform: translateX(-22px) scale(0.98);
                    opacity: 0.92;
                  }
                  to {
                    width: calc(100% - 44px);
                    transform: translateX(0) scale(1);
                    opacity: 1;
                  }
                }

                .mobile-search-expand-field {
                  width: calc(100% - 44px);
                  animation: mobile-search-expand 260ms var(--ease-decelerate) both;
                  transform-origin: center center;
                }

                @media (prefers-reduced-motion: reduce) {
                  .mobile-search-expand-field {
                    animation: none;
                  }
                }
              `}</style>

              <div
                ref={tabRowRef}
                className="relative hidden w-full gap-[var(--space-4)] pb-[var(--space-2)] text-body text-muted md:flex"
              >
                <button
                  ref={exploreTabRef}
                  type="button"
                  onClick={() => setActiveFeedTab("explore")}
                  className={`-mb-[2px] shrink-0 whitespace-nowrap pb-0 font-[700] transition-colors duration-[var(--duration-base)] ${
                    activeFeedTab === "explore" ? "text-app" : "hover:text-app"
                  }`}
                >
                  Explorar
                </button>
                <button
                  ref={followingTabRef}
                  type="button"
                  onClick={() => setActiveFeedTab("following")}
                  className={`-mb-[2px] shrink-0 whitespace-nowrap pb-0 font-[700] transition-colors duration-[var(--duration-base)] ${
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
                {activeFeedTab === "following" && <FeedFlightCarousel flights={friendFlights} />}
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
                    ? uiPosts.filter((p) => p.plan.ownerUserId && followedIds.has(p.plan.ownerUserId))
                    : uiPosts;
                  const mobileViewportStyle: MobileFeedViewportStyle = {
                    "--mobile-feed-viewport-height": mobileFeedViewportHeight,
                  };
                  return visiblePosts.length === 0 ? (
                      <div className="rounded-modal border border-app bg-surface p-[var(--space-5)] text-body text-muted shadow-elev-1">
                      {activeFeedTab === "following"
                        ? "Aún no hay publicaciones de las personas que sigues."
                        : "Aun no hay publicaciones para mostrar."}
                    </div>
                  ) : (
                    <div
                      className="overflow-y-scroll snap-y snap-mandatory scrollbar-hide h-[var(--mobile-feed-viewport-height)] md:h-[calc(100dvh-100px)]"
                      style={mobileViewportStyle}
                    >
                      {visiblePosts.map((post, idx) => (
                        <div
                          key={post.id}
                          className="h-[var(--mobile-feed-viewport-height)] snap-start snap-always md:h-full"
                          style={mobileViewportStyle}
                        >
                          <FeedCard
                            post={post}
                            currentUserId={currentUserId}
                            currentUserName={profile?.nombre ?? null}
                            currentUserProfileImage={profile?.profile_image ?? null}
                            nextPostHasImage={visiblePosts[idx + 1]?.hasImage ?? true}
                            initialFollowing={followedIds.has(post.plan.ownerUserId ?? "")}
                            initialSaved={savedPlanIds.has(post.plan.id)}
                            onFollowingChange={(ownerUserId, nextFollowing) => {
                              setFollowedIds((prev) => {
                                const next = new Set(prev);
                                if (nextFollowing) next.add(ownerUserId);
                                else next.delete(ownerUserId);
                                return next;
                              });
                            }}
                          />
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
      <div className="pt-[var(--space-8)]">
        {/* Header conversación */}
        <div className="flex items-center gap-2 pb-3 border-b border-app">
          <button
            type="button"
            onClick={() => { setOpenChatId(null); setText(""); void listChats().then(setChats); }}
            className="flex size-[30px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface"
            aria-label="Volver"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[16px]">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex size-[36px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-[14px] font-[var(--fw-semibold)] text-app">
            {chatAvatar
              ? <NextImage src={chatAvatar} alt={chatName} width={36} height={36} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
              : (chatName[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-[700] text-app leading-tight">{chatName}</p>
            {openChat.tipo === "GRUPO" && (
              <p className="text-[12px] text-muted">{openChat.miembros.length} miembros</p>
            )}
          </div>
          <Link href="/messages" className="shrink-0 flex size-[28px] items-center justify-center rounded-full text-muted transition-colors hover:bg-surface" aria-label="Abrir en mensajes">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[14px]">
              <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div ref={scrollContainerRef} className="scrollbar-thin mt-3 max-h-[320px] overflow-x-hidden overflow-y-auto overscroll-contain">
          {msgLoading ? (
            <p className="py-4 text-center text-[13px] text-muted">Cargando...</p>
          ) : (
            <div className="space-y-[2px] py-1">
              {messages.map((msg, idx, arr) => {
                const isMe = msg.sender_id === currentUserId;
                const prevMsg = arr[idx - 1];
                const nextMsg = arr[idx + 1];
                const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id;
                const br = isMe
                  ? `${isFirstInGroup ? "20px" : "8px"} 20px 4px ${isLastInGroup ? "20px" : "8px"}`
                  : `20px ${isFirstInGroup ? "20px" : "8px"} ${isLastInGroup ? "20px" : "8px"} 4px`;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-3" : "mt-[2px]"}`}>
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
                    <div
                      className={`max-w-[85%] px-3 py-[6px] ${isMe ? "bg-[var(--primary)] text-white" : "bg-surface-inset text-app"}`}
                      style={{ borderRadius: br }}
                    >
                      {!isMe && openChat.tipo === "GRUPO" && isFirstInGroup && (
                        <p className="mb-[2px] text-[11px] font-[600] text-muted">{msg.sender_nombre}</p>
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
                            { }
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
                            <div className={`flex items-start gap-[8px] py-[2px] ${missed ? "text-red-700 dark:text-red-800" : ""}`}>
                              {isVideo ? <Video className="mt-[2px] size-[15px] shrink-0" /> : <Phone className="mt-[2px] size-[15px] shrink-0" />}
                              <div>
                                <p className="text-[14px] font-[var(--fw-medium)]">{label}</p>
                                {!missed && duracion > 0 && <p className="text-[14px] opacity-70">{mins}:{String(secs).padStart(2, "0")}</p>}
                              </div>
                            </div>
                          );
                        })()
                      : (() => { try { const p = JSON.parse(msg.texto); if (p?.type === "poll") return <div className="flex items-center gap-[6px] py-[2px] opacity-80"><span className="text-[16px]">📊</span><span className="text-[14px]">{p.question as string}</span></div>; } catch { /* noop */ } return <p className="break-all text-body-sm">{msg.texto}</p>; })()}
                      {isLastInGroup && (
                        <p className={`mt-[2px] text-right text-[11px] ${isMe ? "text-white/55" : "text-muted"}`}>{formatChatTime(msg.created_at)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void onSend(); } }}
            placeholder="Escribe un mensaje..."
            className="min-w-0 flex-1 rounded-full border border-app bg-surface-inset px-4 py-[8px] text-[13px] text-app outline-none transition-colors focus:border-[var(--border-strong)] placeholder:text-muted"
          />
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={!text.trim() || sending}
            className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white transition-all hover:opacity-85 disabled:opacity-30 active:scale-90"
            aria-label="Enviar"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[15px] translate-x-[1px]">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[var(--space-8)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[17px] font-[800] tracking-[-0.01em] text-app">Mensajes</h3>
        <Link
          href="/messages"
          className="flex items-center gap-1 text-[13px] font-[600] text-muted transition-all hover:text-app"
        >
          Ver todos
          <svg viewBox="0 0 24 24" fill="none" className="size-[11px]" aria-hidden="true">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      <div className="space-y-[1px]">
        {chats.length === 0 ? (
          <p className="py-3 text-[13px] text-muted">No tienes conversaciones aún</p>
        ) : (
          chats.slice(0, 4).map((chat) => {
            const name = resolveChatName(chat, currentUserId ?? "");
            const avatar = resolveChatAvatar(chat, currentUserId ?? "");
            const hasUnread = chat.unread_count > 0;
            const lastMsg = (() => { const m = chat.last_message ?? ""; try { return JSON.parse(m)?.type === "poll" ? "📊 Encuesta" : m; } catch { return m; } })();
            return (
              <button
                key={chat.chat_id}
                type="button"
                onClick={() => setOpenChatId(chat.chat_id)}
                className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-[9px] text-left transition-colors hover:bg-surface"
              >
                <div className="relative shrink-0">
                  <div className="flex size-[44px] items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-[15px] font-[700] text-app">
                    {avatar
                      ? <NextImage src={avatar} alt={name} width={44} height={44} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                      : chat.tipo === "GRUPO"
                        ? <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px] text-muted"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" /><path d="M2 19c1-3 3.5-4.5 7-4.5s6 1.5 7 4.5" stroke="currentColor" strokeWidth="1.6" /></svg>
                        : (name[0] ?? "?").toUpperCase()}
                  </div>
                  {hasUnread && (
                    <span className="absolute -right-[3px] -top-[3px] flex min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--primary)] px-[3px] text-[10px] font-[700] text-white leading-none h-[18px]">
                      {chat.unread_count > 9 ? "9+" : chat.unread_count}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-[14px] ${hasUnread ? "font-[700]" : "font-[600]"} text-app`}>{name}</p>
                    <span className="shrink-0 text-[11px] text-muted">{formatChatTime(chat.last_message_at)}</span>
                  </div>
                  <p className={`truncate text-[13px] leading-[18px] ${hasUnread ? "font-[600] text-app" : "text-muted"}`}>{lastMsg}</p>
                </div>
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
    <div className="flex min-h-[min(620px,calc(100dvh-140px))] items-center px-[max(12px,env(safe-area-inset-left))] py-4 md:px-0" aria-label="Cargando publicaciones" role="status">
      <article className="mx-auto flex w-full max-w-[560px] items-start gap-3 md:max-w-[520px]">
        <div className="skeleton-shimmer size-10 shrink-0 rounded-full" />
        <div className="skeleton-shimmer aspect-[4/5] min-w-0 flex-1 rounded-[18px]" />
      </article>
    </div>
  );
}

function FeedCard({
  post,
  currentUserId,
  currentUserName,
  currentUserProfileImage,
  nextPostHasImage,
  initialFollowing,
  initialSaved,
  onFollowingChange,
}: {
  post: FeedItemDto;
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserProfileImage: string | null;
  nextPostHasImage: boolean;
  initialFollowing: boolean;
  initialSaved: boolean;
  onFollowingChange?: (ownerUserId: string, nextFollowing: boolean) => void;
}) {
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
  const [coverAspect, setCoverAspect] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { isClosing: commentsClosing, requestClose: closeCommentsModal } = useModalCloseAnimation(() => {
    setCommentsModalOpen(false);
    setEmojiPickerOpen(false);
  }, commentsModalOpen);
  const { isClosing: deleteClosing, requestClose: closeDeleteConfirm } = useModalCloseAnimation(() => setConfirmDeleteId(null), !!confirmDeleteId);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; userName: string } | null>(null);
  const [modalHeight, setModalHeight] = useState<number | null>(null);
  const [saved, setSaved] = useState(initialSaved);
  const { toastError } = useToast();
  const isOwnPost = post.plan.ownerUserId === currentUserId;
  const mobileImagePostVars: FeedMobileImageVars | undefined = post.hasImage
    ? ({
        "--feed-mobile-side-inset": "clamp(12px, 4vw, 16px)",
        "--feed-mobile-header-top": "clamp(12px, 2.2dvh, 18px)",
        "--feed-mobile-actions-gap": "clamp(12px, 2dvh, 16px)",
        "--feed-mobile-actions-bottom": "clamp(72px, 10dvh, 92px)",
        "--feed-mobile-footer-bottom": "clamp(16px, calc(env(safe-area-inset-bottom) + 8px), 28px)",
        "--feed-mobile-avatar-size": "clamp(30px, 8.6vw, 34px)",
        "--feed-mobile-icon-size": "clamp(30px, 9vw, 34px)",
        "--feed-mobile-title-size": "clamp(16px, 4.8vw, 18px)",
        "--feed-mobile-meta-size": "clamp(12px, 3.7vw, 14px)",
      })
    : undefined;

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

  function renderImageSlide(imageUrl: string, alt: string, active: boolean, key: string) {
    const base = "absolute inset-0 transition-opacity duration-200 ease-out will-change-[opacity] " + (active ? "opacity-100 z-[1]" : "opacity-0 z-0");
    return (
      <div key={key} className={`${base} bg-black`}>
        <NextImage
          src={imageUrl}
          alt={alt}
          fill
          className="object-contain object-center"
          unoptimized
        />
      </div>
    );
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
    initialFollowing,
    (nextFollowing) => {
      const ownerUserId = post.plan.ownerUserId;
      if (!ownerUserId) return;
      onFollowingChange?.(ownerUserId, nextFollowing);
    }
  );
  const [unfollowDialogClosing, setUnfollowDialogClosing] = useState(false);
  const unfollowCloseTimeoutRef = useRef<number | null>(null);
  const unfollowDialogVisible = showUnfollowDialog || unfollowDialogClosing;

  const closeUnfollowDialog = useCallback(() => {
    if (unfollowDialogClosing) return;
    setUnfollowDialogClosing(true);
    unfollowCloseTimeoutRef.current = window.setTimeout(() => {
      setShowUnfollowDialog(false);
      setUnfollowDialogClosing(false);
      unfollowCloseTimeoutRef.current = null;
    }, 140);
  }, [setShowUnfollowDialog, unfollowDialogClosing]);

  const confirmUnfollow = useCallback(() => {
    if (unfollowDialogClosing) return;
    setUnfollowDialogClosing(true);
    unfollowCloseTimeoutRef.current = window.setTimeout(() => {
      void handleUnfollow();
      setUnfollowDialogClosing(false);
      unfollowCloseTimeoutRef.current = null;
    }, 140);
  }, [handleUnfollow, unfollowDialogClosing]);

  useEffect(() => {
    if (showUnfollowDialog) setUnfollowDialogClosing(false);
  }, [showUnfollowDialog]);

  useEffect(() => {
    return () => {
      if (unfollowCloseTimeoutRef.current !== null) {
        window.clearTimeout(unfollowCloseTimeoutRef.current);
      }
    };
  }, []);
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
        closeCommentsModal();
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
  }, [closeCommentsModal, commentsModalOpen]);

  useEffect(() => {
    if (!commentsModalOpen) { setModalHeight(null); return; }
    const update = () => setModalHeight(window.visualViewport?.height ?? window.innerHeight);
    update();
    window.visualViewport?.addEventListener("resize", update);
    return () => window.visualViewport?.removeEventListener("resize", update);
  }, [commentsModalOpen]);

  const insertEmoji = (emoji: { native: string }) => {
    const input = commentInputRef.current;
    if (!input) { setCommentText((prev) => (prev + emoji.native).slice(0, 300)); setEmojiPickerOpen(false); return; }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const newText = (input.value.slice(0, start) + emoji.native + input.value.slice(end)).slice(0, 300);
    setCommentText(newText);
    setEmojiPickerOpen(false);
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + emoji.native.length;
      input.setSelectionRange(pos, pos);
    });
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
      toastError("No se pudo actualizar el like. Inténtalo de nuevo.");
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
      void createBrowserSupabaseClient().auth.getSession().then(({ data: { session } }) =>
        fetch(buildInternalApiUrl("/api/moderate-comment"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ text: content }),
        })
      )
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
      toastError("No se pudo enviar el comentario. Inténtalo de nuevo.");
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

  const formatMobileDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const getLocationFirstPart = (location: string | null | undefined) => {
    return location?.split(",")[0]?.trim() ?? "";
  };

  const desktopDateLabel = formatDate(post.plan.startsAt) === formatDate(post.plan.endsAt)
    ? formatDate(post.plan.startsAt)
    : `${formatDate(post.plan.startsAt)} – ${formatDate(post.plan.endsAt)}`;
  const mobileDateLabel = formatMobileDate(post.plan.startsAt) === formatMobileDate(post.plan.endsAt)
    ? formatMobileDate(post.plan.startsAt)
    : `${formatMobileDate(post.plan.startsAt)}-${formatMobileDate(post.plan.endsAt)}`;
  const mobileLocationLabel = getLocationFirstPart(post.plan.locationName);
  const mobileActionButtonClass = "flex min-w-[52px] items-center gap-1.5 text-muted transition-colors hover:text-primary-token disabled:opacity-40";
  const mobileSaveButtonClass = "flex min-w-[52px] items-center gap-1.5 text-muted transition-colors hover:text-primary-token";

  const renderMobileFollowButton = () => {
    if (isOwnPost) return null;

    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onFollowPress(); }}
        className="ml-auto flex size-[28px] shrink-0 items-center justify-center rounded-full text-primary-token transition-colors hover:text-primary-token"
        aria-label={following ? "Siguiendo" : "Seguir"}
      >
        {following ? (
          <svg viewBox="0 0 24 24" fill="none" className="size-[19px]" aria-hidden="true">
            <path d="M9 11.5L11.2 13.7L15.5 9.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="size-[19px]" aria-hidden="true">
            <circle cx="10" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4.5 19C5.25 15.8 7.25 14.2 10 14.2C12.75 14.2 14.75 15.8 15.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M18 8V14M15 11H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>
    );
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
    <article className={`relative h-full overflow-hidden md:overflow-visible ${post.hasImage && !nextPostHasImage ? "" : ""}`} style={mobileImagePostVars}>

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
        {/* Progress bars — rendered below the header row, see header section below */}

        {/* Backgrounds for text-only posts */}
        {!post.hasImage && slides.map((slide, i) => {
          const active = i === clampedIndex;
          if (slide.type === "cover") {
            return post.hasImage && post.coverImage ? (
              <div key="cover" className="absolute inset-0 bg-black">
                {renderImageSlide(post.coverImage, "Imagen del plan", active, "cover-image")}
                {!imgLoaded && active && <div className="skeleton-shimmer absolute inset-0 z-[2]" aria-hidden="true" />}
                <NextImage
                  src={post.coverImage}
                  alt=""
                  width={1}
                  height={1}
                  className="hidden"
                  unoptimized
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgLoaded(true)}
                />
              </div>
            ) : (
              <div
                key="cover"
                className={`absolute inset-0 transition-opacity duration-200 ease-out will-change-[opacity] ${active ? "opacity-100 z-[1]" : "opacity-0 z-0"} bg-app`}
              />
            );
          }
          if (slide.type === "photo") {
            return renderImageSlide(slide.url, "", active, `photo-${i}`);
          }
          if (slide.type === "summary") {
            const base = "absolute inset-0 transition-opacity duration-200 ease-out will-change-[opacity] " + (active ? "opacity-100 z-[1]" : "opacity-0 z-0");
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

        {/* Text content (only for text-only posts) */}
        {!post.hasImage && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-[max(12px,env(safe-area-inset-left))]">
            <div className="w-full max-w-[560px] px-4 py-3 text-app">
              <div className="flex items-start gap-3">
                <Link href={`/profile/${post.plan.ownerUserId}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <div className="flex size-[42px] items-center justify-center overflow-hidden rounded-full border border-app">
                  {post.avatarImage ? (
                    <NextImage src={post.avatarImage} alt={post.avatarLabel} width={42} height={42} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[15px] font-[800] text-app">{post.avatarLabel}</span>
                  )}
                  </div>
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <Link href={`/profile/${post.plan.ownerUserId}`} onClick={(e) => e.stopPropagation()} className="truncate text-[15px] font-[800] leading-tight text-app">{post.userName}</Link>
                      {[mobileLocationLabel, mobileDateLabel].filter(Boolean).map((meta) => (
                        <span key={meta} className="min-w-0 truncate text-[14px] text-muted">
                          <span className="px-1.5">·</span>{meta}
                        </span>
                      ))}
                    </div>
                    {renderMobileFollowButton()}
                  </div>

                  {post.plan.title && (
                    <p className="mt-1 text-[15px] font-[700] leading-snug text-app">{post.plan.title}</p>
                  )}
                  {post.text && (
                    <p className="mt-0.5 text-[15px] leading-snug text-app">{post.text}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-3 text-muted">
                    <button
                      type="button"
                      className={mobileActionButtonClass}
                      onClick={(e) => { e.stopPropagation(); onLikeToggle(); }}
                      disabled={!currentUserId || likeLoading}
                      aria-label={liked ? "Quitar like" : "Dar like"}
                    >
                      <PlaneIcon liked={liked} animating={likeAnimating} size={18} className={liked ? "text-primary-token" : ""} />
                      <span className={`text-[13px] ${likeCount > 0 ? "" : "invisible"}`}>{likeCount || 0}</span>
                    </button>
                    <button
                      type="button"
                      className={mobileActionButtonClass}
                      onClick={(e) => { e.stopPropagation(); openCommentsModal(); }}
                      aria-label="Comentarios"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden="true">
                        <path d="M12 4C7.582 4 4 6.91 4 10.5C4 12.31 4.913 13.947 6.39 15.109C6.272 16.213 5.79 17.343 4.98 18.316C4.787 18.549 5.02 18.88 5.315 18.785C7.005 18.243 8.357 17.471 9.235 16.86C10.115 17.113 11.04 17.25 12 17.25C16.418 17.25 20 14.34 20 10.75C20 7.16 16.418 4 12 4Z" />
                      </svg>
                      <span className={`text-[13px] ${commentsSection.length > 0 ? "" : "invisible"}`}>{commentsSection.length || 0}</span>
                    </button>
                    <button
                      type="button"
                      className={`${mobileSaveButtonClass} ${saved ? "text-primary-token" : ""}`}
                      onClick={(e) => { e.stopPropagation(); void handleToggleSave(); }}
                      disabled={!currentUserId}
                      aria-label={saved ? "Quitar guardado" : "Guardar"}
                    >
                      <BookmarkIcon size={18} />
                    </button>
                    <Link
                      href={Capacitor.isNativePlatform() ? `/plan/static?id=${post.plan.id}` : `/plan/${post.plan.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-[13px] font-[700] text-muted transition-colors hover:text-primary-token"
                    >
                      Ver plan
                      <svg viewBox="0 0 24 24" fill="none" className="size-[11px]" aria-hidden="true">
                        <path d="M13 3L21 12M21 12L13 21M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image post in Twitter-like mobile layout */}
        {post.hasImage && post.coverImage && (
          <>
          <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-app px-[max(12px,env(safe-area-inset-left))] py-4">
            <div className="w-full max-w-[560px] text-app">
              <div className="flex items-start gap-3">
                <Link href={`/profile/${post.plan.ownerUserId}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <div className="flex size-[42px] items-center justify-center overflow-hidden rounded-full border border-app">
                    {post.avatarImage ? (
                      <NextImage src={post.avatarImage} alt={post.avatarLabel} width={42} height={42} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[15px] font-[800] text-app">{post.avatarLabel}</span>
                    )}
                  </div>
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <Link href={`/profile/${post.plan.ownerUserId}`} onClick={(e) => e.stopPropagation()} className="truncate text-[15px] font-[800] leading-tight text-app">{post.userName}</Link>
                      {[mobileLocationLabel, mobileDateLabel].filter(Boolean).map((meta) => (
                        <span key={meta} className="min-w-0 truncate text-[14px] text-muted">
                          <span className="px-1.5">·</span>{meta}
                        </span>
                      ))}
                    </div>
                    {renderMobileFollowButton()}
                  </div>

                  {post.plan.title && (
                    <p className="mt-1 text-[15px] font-[700] leading-snug text-app">{post.plan.title}</p>
                  )}
                  {post.text && (
                    <p className="mt-0.5 text-[15px] leading-snug text-app">{post.text}</p>
                  )}

                  <div
                    className="relative mt-3 w-full overflow-hidden rounded-[14px] border border-app bg-surface-inset"
                    style={{ aspectRatio: coverAspect ? String(coverAspect) : "4/5", maxHeight: "calc(100svh - 360px)" }}
                  >
                    {!imgLoaded && <div className="skeleton-shimmer absolute inset-0 z-[2]" aria-hidden="true" />}
                    {slides.map((slide, i) => {
                      const active = i === clampedIndex;
                      const base = "absolute inset-0 transition-opacity duration-300 ease-out";
                      if (slide.type === "cover") return (
                        <div key="mobile-twitter-cover" className={`${base} bg-surface-inset ${active ? "z-[1] opacity-100" : "z-0 opacity-0"}`}>
                          <NextImage
                            src={post.coverImage!}
                            alt="Imagen del plan"
                            fill
                            className="object-contain"
                            style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
                            unoptimized
                            onLoad={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              if (img.naturalWidth && img.naturalHeight) {
                                setCoverAspect(img.naturalWidth / img.naturalHeight);
                              }
                              setImgLoaded(true);
                            }}
                            onError={() => setImgLoaded(true)}
                          />
                        </div>
                      );
                      if (slide.type === "photo") return (
                        <div key={`mobile-twitter-photo-${i}`} className={`${base} bg-surface-inset ${active ? "z-[1] opacity-100" : "z-0 opacity-0"}`}>
                          <NextImage src={slide.url} alt="" fill className="object-contain" unoptimized />
                        </div>
                      );
                      if (slide.type === "summary") return (
                        <div key="mobile-twitter-summary" className={`${base} bg-[#0d0e12] ${active ? "z-[1] opacity-100" : "z-0 opacity-0"}`}>
                          <NextImage src={post.coverImage!} alt="" fill className="scale-110 object-cover opacity-15 blur-xl" unoptimized />
                          <div className="absolute inset-0 bg-black/60" />
                          <div className="absolute inset-0 z-10 flex flex-col justify-between p-5">
                            <div>
                              <p className="text-[12px] font-[700] uppercase tracking-[0.12em] text-white/55">Resumen del plan</p>
                              <p className="mt-1 line-clamp-2 text-[22px] font-[800] leading-[1.05] tracking-tight text-white">{post.plan.title}</p>
                              <p className="mt-2 truncate text-[13px] font-[600] text-white/65">{[mobileLocationLabel, mobileDateLabel].filter(Boolean).join(" · ")}</p>
                            </div>
                            <div className="space-y-3">
                              {post.itinerarySnapshot && post.itinerarySnapshot.length > 0 && (
                                <div className="space-y-[6px] rounded-[14px] bg-white/[0.08] p-3">
                                  {post.itinerarySnapshot.slice(0, 4).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <span className="text-[12px]">{getSlideActivityEmoji(item.tipo)}</span>
                                      <span className="truncate text-[13px] font-[600] text-white/90">{item.titulo}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {post.photosSnapshot && post.photosSnapshot.length > 0 && (
                                  <span className="rounded-full bg-white/[0.1] px-3 py-1 text-[12px] font-[700] text-white/80">{post.photosSnapshot.length} fotos</span>
                                )}
                                {post.participantsSnapshot && (
                                  <span className="rounded-full bg-white/[0.1] px-3 py-1 text-[12px] font-[700] text-white/80">{post.participantsSnapshot.count} personas</span>
                                )}
                                {post.expensesSnapshot && (
                                  <span className="rounded-full bg-white/[0.1] px-3 py-1 text-[12px] font-[700] text-white/80">{post.expensesSnapshot.currency} {Math.round(post.expensesSnapshot.total).toLocaleString("es-ES")}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                      return null;
                    })}
                    {slidesLen > 1 && (
                      <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-[5px]">
                        {slides.map((_, i) => (
                          <div
                            key={i}
                            className="rounded-full transition-all duration-200"
                            style={{
                              width: i === clampedIndex ? "16px" : "6px",
                              height: "6px",
                              background: i === clampedIndex ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-muted" style={{ touchAction: "manipulation" }}>
                    <button
                      type="button"
                      className={mobileActionButtonClass}
                      onClick={(e) => { e.stopPropagation(); onLikeToggle(); }}
                      onTouchStart={(e) => e.stopPropagation()}
                      disabled={!currentUserId || likeLoading}
                      aria-label={liked ? "Quitar like" : "Dar like"}
                    >
                      <PlaneIcon liked={liked} animating={likeAnimating} size={18} className={liked ? "text-primary-token" : ""} />
                      <span className={`text-[13px] ${likeCount > 0 ? "" : "invisible"}`}>{likeCount || 0}</span>
                    </button>
                    <button
                      type="button"
                      className={mobileActionButtonClass}
                      onClick={(e) => { e.stopPropagation(); openCommentsModal(); }}
                      onTouchStart={(e) => e.stopPropagation()}
                      aria-label="Comentarios"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden="true">
                        <path d="M12 4C7.582 4 4 6.91 4 10.5C4 12.31 4.913 13.947 6.39 15.109C6.272 16.213 5.79 17.343 4.98 18.316C4.787 18.549 5.02 18.88 5.315 18.785C7.005 18.243 8.357 17.471 9.235 16.86C10.115 17.113 11.04 17.25 12 17.25C16.418 17.25 20 14.34 20 10.75C20 7.16 16.418 4 12 4Z" />
                      </svg>
                      <span className={`text-[13px] ${commentsSection.length > 0 ? "" : "invisible"}`}>{commentsSection.length || 0}</span>
                    </button>
                    <button
                      type="button"
                      className={`${mobileSaveButtonClass} ${saved ? "text-primary-token" : ""}`}
                      onClick={(e) => { e.stopPropagation(); void handleToggleSave(); }}
                      onTouchStart={(e) => e.stopPropagation()}
                      disabled={!currentUserId}
                      aria-label={saved ? "Quitar guardado" : "Guardar"}
                    >
                      <BookmarkIcon size={18} />
                    </button>
                    <Link
                      href={Capacitor.isNativePlatform() ? `/plan/static?id=${post.plan.id}` : `/plan/${post.plan.id}`}
                      onClick={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-[13px] font-[700] text-muted transition-colors hover:text-primary-token"
                    >
                      Ver plan
                      <svg viewBox="0 0 24 24" fill="none" className="size-[11px]" aria-hidden="true">
                        <path d="M13 3L21 12M21 12L13 21M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </>
        )}
      </div>

      {/* ── DESKTOP: Instagram-style card ── */}
      <div className="hidden md:flex h-full items-center justify-center overflow-hidden">
        <div className="flex h-full w-full items-center justify-center px-8 py-6">

          {post.hasImage && post.coverImage ? (
            /* ── Card Instagram ── */
            <div className="flex items-start gap-3 w-full max-w-[520px]">
              {/* Avatar outside card — top left */}
              <Link href={`/profile/${post.plan.ownerUserId}`} className="shrink-0 mt-1">
                <div className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset">
                  {post.avatarImage ? (
                    <NextImage src={post.avatarImage} alt={post.avatarLabel} width={40} height={40} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[13px] font-[700] text-app">{post.avatarLabel}</span>
                  )}
                </div>
              </Link>

              {/* Card */}
              <div className="min-w-0 flex-1 overflow-hidden rounded-[18px] border border-app bg-surface">

              {/* Header */}
              <div className="flex items-start gap-3 px-4 py-[11px]">
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${post.plan.ownerUserId}`} className="text-[14px] font-[700] text-app hover:underline">{post.userName}</Link>
                  <p className="text-[12px] text-muted leading-tight">
                    {[
                      post.plan.locationName,
                      formatDate(post.plan.startsAt) === formatDate(post.plan.endsAt)
                        ? formatDate(post.plan.startsAt)
                        : `${formatDate(post.plan.startsAt)} – ${formatDate(post.plan.endsAt)}`
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {!isOwnPost && (
                  <button
                    type="button"
                    onClick={onFollowPress}
                    className="mt-[1px] shrink-0 text-[13px] font-[700] leading-tight text-primary-token transition-colors"
                  >
                    {following ? "Siguiendo" : "Seguir"}
                  </button>
                )}
              </div>

              {/* Image / Slides section — ratio from cover image */}
              <div
                className="relative w-full bg-black"
                style={{ aspectRatio: coverAspect ? String(coverAspect) : "4/5", maxHeight: "70vh" }}
              >
                {/* Skeleton while loading */}
                {!imgLoaded && <div className="skeleton-shimmer absolute inset-0 z-[2]" aria-hidden="true" />}

                {/* All slides */}
                {slides.map((slide, i) => {
                  const active = i === clampedIndex;
                  const base = "absolute inset-0 transition-opacity duration-300 ease-out";
                  if (slide.type === "cover") return (
                    <div key="cover" className={`${base} bg-black ${active ? "opacity-100 z-[1]" : "opacity-0 z-0"}`}>
                      <NextImage
                        src={post.coverImage!}
                        alt="Imagen del plan"
                        fill
                        className="object-contain"
                        style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
                        unoptimized
                        onLoad={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (img.naturalWidth && img.naturalHeight) {
                            setCoverAspect(img.naturalWidth / img.naturalHeight);
                          }
                          setImgLoaded(true);
                        }}
                        onError={() => setImgLoaded(true)}
                      />
                    </div>
                  );
                  if (slide.type === "photo") return (
                    <div key={`photo-${i}`} className={`${base} bg-black ${active ? "opacity-100 z-[1]" : "opacity-0 z-0"}`}>
                      <NextImage src={slide.url} alt="" fill className="object-contain" unoptimized />
                    </div>
                  );
                  if (slide.type === "summary") return (
                    <div key="summary" className={`${base} bg-[#0d0e12] ${active ? "opacity-100 z-[1]" : "opacity-0 z-0"}`}>
                      <NextImage src={post.coverImage!} alt="" fill className="object-cover opacity-15 scale-110 blur-xl" unoptimized />
                      <div className="absolute inset-0 bg-black/60" />
                      <div className="absolute inset-0 z-10 flex flex-col justify-between p-5">
                        <div>
                          <p className="text-[12px] font-[700] uppercase tracking-[0.12em] text-white/55">Resumen del plan</p>
                          <p className="mt-1 line-clamp-2 text-[24px] font-[800] leading-[1.05] tracking-tight text-white">{post.plan.title}</p>
                          <p className="mt-2 truncate text-[13px] font-[600] text-white/65">{[post.plan.locationName, desktopDateLabel].filter(Boolean).join(" · ")}</p>
                        </div>
                        <div className="space-y-3">
                          {post.itinerarySnapshot && post.itinerarySnapshot.length > 0 && (
                            <div className="space-y-[6px] rounded-[14px] bg-white/[0.08] p-3">
                              {post.itinerarySnapshot.slice(0, 4).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-[12px]">{getSlideActivityEmoji(item.tipo)}</span>
                                  <span className="truncate text-[13px] font-[600] text-white/90">{item.titulo}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {post.photosSnapshot && post.photosSnapshot.length > 0 && (
                              <span className="rounded-full bg-white/[0.1] px-3 py-1 text-[12px] font-[700] text-white/80">{post.photosSnapshot.length} fotos</span>
                            )}
                            {post.participantsSnapshot && (
                              <span className="rounded-full bg-white/[0.1] px-3 py-1 text-[12px] font-[700] text-white/80">{post.participantsSnapshot.count} personas</span>
                            )}
                            {post.expensesSnapshot && (
                              <span className="rounded-full bg-white/[0.1] px-3 py-1 text-[12px] font-[700] text-white/80">{post.expensesSnapshot.currency} {Math.round(post.expensesSnapshot.total).toLocaleString("es-ES")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  return null;
                })}

                {/* Carousel arrows — solo fotos/slides reales */}
                {slidesLen > 1 && clampedIndex > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 flex size-8 items-center justify-center text-white transition-all active:scale-90" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}
                    aria-label="Foto anterior"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                )}
                {slidesLen > 1 && clampedIndex < slidesLen - 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 flex size-8 items-center justify-center text-white transition-all active:scale-90" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}
                    aria-label="Foto siguiente"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                )}

                {/* Dots inside image — bottom center */}
                {slidesLen > 1 && (
                  <div className="absolute bottom-3 inset-x-0 z-20 flex items-center justify-center gap-[5px]">
                    {slides.map((_, i) => (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-200"
                        style={{
                          width: i === clampedIndex ? "16px" : "6px",
                          height: "6px",
                          background: i === clampedIndex ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-4 px-4 pt-3 pb-[10px]">
                <button
                  type="button"
                  className="flex items-center gap-1.5 disabled:opacity-40 active:scale-90 transition-transform"
                  onClick={onLikeToggle}
                  disabled={!currentUserId || likeLoading}
                  aria-label={liked ? "Quitar like" : "Dar like"}
                >
                  <PlaneIcon liked={liked} animating={likeAnimating} size={24} className={liked ? "text-primary-token" : "text-app"} />
                  {likeCount > 0 && <span className="text-[13px] font-[700] text-app">{likeCount}</span>}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-app active:scale-90 transition-transform"
                  onClick={openCommentsModal}
                  aria-label="Comentarios"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden="true">
                    <path d="M12 4C7.582 4 4 6.91 4 10.5C4 12.31 4.913 13.947 6.39 15.109C6.272 16.213 5.79 17.343 4.98 18.316C4.787 18.549 5.02 18.88 5.315 18.785C7.005 18.243 8.357 17.471 9.235 16.86C10.115 17.113 11.04 17.25 12 17.25C16.418 17.25 20 14.34 20 10.75C20 7.16 16.418 4 12 4Z" />
                  </svg>
                  {commentsSection.length > 0 && <span className="text-[13px] font-[700] text-app">{commentsSection.length}</span>}
                </button>
                {!isOwnPost && (
                  <button
                    type="button"
                    className="active:scale-90 transition-transform text-app"
                    onClick={handleToggleSave}
                    aria-label={saved ? "Quitar guardado" : "Guardar"}
                  >
                    <span className={saved ? "text-primary-token" : ""}><BookmarkIcon size={24} /></span>
                  </button>
                )}
                <Link
                  href={Capacitor.isNativePlatform() ? `/plan/static?id=${post.plan.id}` : `/plan/${post.plan.id}`}
                  className="ml-auto flex items-center gap-1 text-[14px] font-[700] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Ver plan
                  <svg viewBox="0 0 24 24" fill="none" className="size-[12px]" aria-hidden="true">
                    <path d="M13 3L21 12M21 12L13 21M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>

              {/* Caption */}
              {(post.plan.title || post.text) && (
                <div className="px-4 pb-4 space-y-[2px]">
                  {post.plan.title && (
                    <p className="text-[15px] font-[800] text-app leading-snug">{post.plan.title}</p>
                  )}
                  {post.text && (
                    <p className="text-[14px] text-app leading-snug">
                      <span className="font-[600] mr-1">{post.userName}</span>{post.text}
                    </p>
                  )}
                </div>
              )}
            </div>
            </div>
          ) : (
            /* Text-only post */
            <div className="flex items-start gap-3 w-full max-w-[540px]">
              {/* Avatar outside card — top left */}
              <Link href={`/profile/${post.plan.ownerUserId}`} className="shrink-0 mt-1">
                <div className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)] transition-opacity hover:opacity-80">
                  {post.avatarImage ? (
                    <NextImage src={post.avatarImage} alt={post.avatarLabel} width={40} height={40} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[14px] font-[700] text-[var(--text-primary)]">{post.avatarLabel}</span>
                  )}
                </div>
              </Link>

              {/* Card */}
              <div className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] p-8">
              <div className="mb-5 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${post.plan.ownerUserId}`} className="text-[15px] font-[800] text-[var(--text-primary)]">{post.userName}</Link>
                  <p className="mt-[1px] truncate text-[14px] text-[var(--text-tertiary)]">
                    {[post.plan.locationName, desktopDateLabel].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {!isOwnPost && (
                  <button
                    type="button"
                    onClick={onFollowPress}
                    className="mt-[1px] shrink-0 text-[14px] font-[700] leading-tight text-primary-token transition-opacity hover:opacity-70"
                  >
                    {following ? "Siguiendo" : "Seguir"}
                  </button>
                )}
              </div>
              {post.text && (
                <p className="text-[17px] leading-[1.55] text-[var(--text-primary)]">{post.text}</p>
              )}
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
                  href={Capacitor.isNativePlatform() ? `/plan/static?id=${post.plan.id}` : `/plan/${post.plan.id}`}
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

        </div>
      </div>{/* end desktop wrapper */}

      {commentsModalOpen && (
        <div data-closing={commentsClosing ? "true" : "false"} className="app-modal-overlay fixed inset-0 z-[1100] flex items-end justify-center md:items-center md:p-[var(--space-6)]" onClick={closeCommentsModal}>
          <div className="app-modal-panel grid h-dvh w-full overflow-hidden bg-app shadow-elev-4 md:h-[min(88dvh,760px)] md:max-w-[1120px] md:rounded-[6px] md:grid-cols-[minmax(0,1fr)_420px]" style={modalHeight ? { height: modalHeight } : undefined} onClick={(e) => e.stopPropagation()}>
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
                      <button type="button" onClick={onFollowPress} className="font-[700] text-primary-token transition-opacity hover:opacity-80">
                        {following ? "Siguiendo" : "Seguir"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col bg-app">
              <div className="flex items-center justify-between border-b px-[22px] pb-[18px] pt-[max(18px,calc(env(safe-area-inset-top)+10px))] md:py-[18px]">
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
                        <button type="button" onClick={onFollowPress} className="shrink-0 text-[13px] font-[700] text-primary-token transition-opacity hover:opacity-80">
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
                <button type="button" onClick={closeCommentsModal} aria-label="Cerrar comentarios" className="text-muted transition-opacity hover:opacity-70">
                  <CloseIcon />
                </button>
              </div>

              <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain px-[22px] py-[22px]">
                {renderCommentsList()}
              </div>

              <div className="hidden md:block px-[22px] py-[14px]">
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

              <div ref={emojiPickerRef} className="relative border-t border-app px-4 py-3 md:border-t-0 md:px-[22px] md:py-[14px] md:pt-0">
                {replyingTo && (
                  <div className="flex items-center justify-between px-[2px] pb-[6px] text-[14px] text-muted">
                    <span>Respondiendo a <span className="font-[700] text-app">@{replyingTo.userName}</span></span>
                    <button type="button" onClick={() => { setReplyingTo(null); setCommentText(""); }} className="text-muted hover:opacity-70">✕</button>
                  </div>
                )}

                {/* Mobile: chat-style pill input with emoji inside */}
                <div className="flex items-center gap-2 md:hidden">
                  <div className="relative flex min-w-0 flex-1 items-center rounded-full border border-app bg-surface px-3">
                    {emojiPickerOpen && (
                      <div className="absolute bottom-[calc(100%+8px)] left-0 z-[70] max-w-[calc(100vw-32px)]">
                        <EmojiMartPicker
                          data={async () => { const r = await fetch("https://cdn.jsdelivr.net/npm/@emoji-mart/data"); return r.json(); }}
                          onEmojiSelect={insertEmoji}
                          locale="es"
                          theme="auto"
                          set="native"
                          previewPosition="none"
                          skinTonePosition="search"
                        />
                      </div>
                    )}
                    <button type="button" className="shrink-0 py-2 pr-1 text-muted transition-colors hover:text-app" aria-label="Emoji" onClick={() => setEmojiPickerOpen((v) => !v)}>
                      <SmileyIcon />
                    </button>
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value.slice(0, 300))}
                      onKeyDown={onCommentKeyDown}
                      placeholder={replyingTo ? `Responder a @${replyingTo.userName}...` : "Añade un comentario..."}
                      maxLength={300}
                      className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-app outline-none placeholder:text-muted"
                      disabled={!currentUserId || commentSubmitting}
                    />
                    {commentText.length > 250 && (
                      <span className="shrink-0 text-[11px] text-muted">{300 - commentText.length}</span>
                    )}
                  </div>
                  {commentText.trim() && (
                    <button type="button" onClick={onSubmitComment} disabled={!currentUserId || commentSubmitting} aria-label="Enviar comentario" className="shrink-0 text-primary-token transition-opacity hover:opacity-70 disabled:opacity-40">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="size-[22px]" aria-hidden>
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Desktop: original input */}
                <div className="hidden md:flex items-center gap-[var(--space-2)]">
                  {emojiPickerOpen && (
                    <div className="absolute bottom-[calc(100%+8px)] left-[22px] z-[70] max-w-[calc(100vw-32px)]">
                      <EmojiMartPicker
                        data={async () => { const r = await fetch("https://cdn.jsdelivr.net/npm/@emoji-mart/data"); return r.json(); }}
                        onEmojiSelect={insertEmoji}
                        locale="es"
                        theme="auto"
                        set="native"
                        previewPosition="none"
                        skinTonePosition="search"
                      />
                    </div>
                  )}
                  <button type="button" className="flex items-center justify-center text-muted" aria-label="Emoticonos" onClick={() => setEmojiPickerOpen((prev) => !prev)}>
                    <SmileyIcon />
                  </button>
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value.slice(0, 300))}
                    onKeyDown={onCommentKeyDown}
                    placeholder={replyingTo ? `Responder a @${replyingTo.userName}...` : "Añade un comentario..."}
                    maxLength={300}
                    className="min-w-0 flex-1 bg-transparent py-[4px] text-[15px] text-app outline-none ring-0 focus:outline-none focus:ring-0 focus:border-transparent placeholder:text-muted"
                    disabled={!currentUserId || commentSubmitting}
                  />
                  {commentText.trim() && (
                    <button type="button" onClick={onSubmitComment} disabled={!currentUserId || commentSubmitting} className="text-[15px] font-[700] text-[#bfc2ca] disabled:opacity-40">
                      Publicar
                    </button>
                  )}
                </div>
                <div className="md:hidden" style={{ height: "env(safe-area-inset-bottom)" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete comment confirmation modal */}
      {confirmDeleteId && (
        <div data-closing={deleteClosing ? "true" : "false"} className="app-modal-overlay fixed inset-0 z-[1200] flex items-end justify-center pb-[max(var(--space-6),env(safe-area-inset-bottom))] sm:items-center" onClick={closeDeleteConfirm}>
          <div className="app-modal-panel mx-[var(--space-4)] w-full max-w-[340px] rounded-modal border border-app bg-surface p-[var(--space-5)] shadow-elev-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-body font-[var(--fw-semibold)] text-app">¿Eliminar comentario?</p>
            <p className="mt-[var(--space-1)] text-body-sm text-muted">Esta acción no se puede deshacer.</p>
            <div className="mt-[var(--space-4)] flex gap-[var(--space-2)]">
              <button type="button" onClick={closeDeleteConfirm} className="flex-1 rounded-button border border-app py-[10px] text-body-sm font-[var(--fw-medium)] text-app transition-colors hover:bg-[var(--interactive-hover-surface)]">
                Cancelar
              </button>
              <button type="button" onClick={() => onDeleteComment(confirmDeleteId)} className="flex-1 rounded-button bg-[var(--error-token,#ef4444)] py-[10px] text-body-sm font-[var(--fw-medium)] text-white transition-opacity hover:opacity-80">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {unfollowDialogVisible && (
        <dialog
          open
          data-closing={unfollowDialogClosing ? "true" : "false"}
          className="feed-dialog-overlay fixed inset-0 z-[1200] m-0 flex h-dvh w-dvw max-w-none items-center justify-center bg-black/55 p-[var(--space-4)] text-app backdrop:bg-black/55"
          onCancel={(e) => { e.preventDefault(); closeUnfollowDialog(); }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeUnfollowDialog();
          }}
        >
          <div className="feed-dialog-box w-full max-w-[380px] rounded-[20px] border border-app bg-surface p-[var(--space-5)] shadow-elev-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex size-[44px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset">
                {post.avatarImage ? (
                  <NextImage src={post.avatarImage} alt={post.avatarLabel} width={44} height={44} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[15px] font-[800] text-app">{post.avatarLabel}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[18px] font-[600] leading-tight text-app">Dejar de seguir a {post.userName}</h3>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={confirmUnfollow}
                className="w-full rounded-[10px] bg-[var(--error-token,#ef4444)] px-4 py-[11px] text-[14px] font-[600] text-white transition-opacity hover:opacity-90"
              >
                Dejar de seguir
              </button>
              <form method="dialog">
                <button
                  type="button"
                  onClick={closeUnfollowDialog}
                  className="w-full rounded-[10px] border border-app px-4 py-[11px] text-[14px] font-[500] text-app transition-colors hover:border-app hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                >
                  Cancelar
                </button>
              </form>
            </div>
          </div>
        </dialog>
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
  return <CloseX className="size-5" />;
}
