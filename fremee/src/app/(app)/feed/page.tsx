"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { GlobeMethods } from "react-globe.gl";
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
const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] w-full items-center justify-center">
      <span className="text-body-sm text-muted">Cargando mapa...</span>
    </div>
  ),
});

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((prev) => !prev)} />

        <main
          className={`px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] lg:py-[var(--space-8)] lg:pr-[var(--space-14)] ${
            sidebarCollapsed ? "lg:pl-[56px]" : "lg:pl-[136px]"
          }`}
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
                  <div className="space-y-[var(--space-6)]">
                    {uiPosts.map((post) => (
                      <FeedCard key={post.id} post={post} currentUserId={currentUserId} />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <aside className="hidden pt-[var(--space-10)] xl:block">
              <h3 className="text-[var(--font-h5)] font-[var(--fw-semibold)] leading-[var(--lh-h5)]">Actividad reciente</h3>
              <div className="mt-[var(--space-4)]">
                {loadingFeed ? (
                  <div className="flex h-[340px] items-center justify-center text-body-sm text-muted">
                    Cargando mapa...
                  </div>
                ) : (
                  <RecentActivityGlobe
                    avatarImage={uiPosts[0]?.avatarImage ?? null}
                    avatarLabel={uiPosts[0]?.avatarLabel ?? "F"}
                  />
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function RecentActivityGlobe({
  avatarImage,
  avatarLabel,
}: {
  avatarImage: string | null;
  avatarLabel: string;
}) {
  type GlobeMarker = {
    id: string;
    locationName: string;
    lat: number;
    lng: number;
    altitude: number;
    image: string | null;
    label: string;
  };

  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const globeContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoRotateFrameRef = useRef<number | null>(null);
  const selectedMarkerIdRef = useRef<string | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const globeViewportWidth = 320;
  const globeViewportHeight = 340;
  const globeRenderWidth = 420;
  const globeRenderHeight = 420;
  const lockedAltitude = 1.92;
  const viewRef = useRef({ lat: 12, lng: 18, altitude: lockedAltitude });
  const htmlMarkers: GlobeMarker[] = [
    {
      id: "tokyo",
      locationName: "Tokyo",
      lat: 35.6762,
      lng: 139.6503,
      altitude: 0.04,
      image: avatarImage,
      label: avatarLabel,
    },
    {
      id: "madrid",
      locationName: "Madrid",
      lat: 40.4168,
      lng: -3.7038,
      altitude: 0.04,
      image: null,
      label: "M",
    },
    {
      id: "new-york",
      locationName: "New York",
      lat: 40.7128,
      lng: -74.006,
      altitude: 0.04,
      image: null,
      label: "N",
    },
    {
      id: "sydney",
      locationName: "Sydney",
      lat: -33.8688,
      lng: 151.2093,
      altitude: 0.04,
      image: null,
      label: "S",
    },
    {
      id: "sao-paulo",
      locationName: "Sao Paulo",
      lat: -23.5505,
      lng: -46.6333,
      altitude: 0.04,
      image: null,
      label: "B",
    },
    {
      id: "london",
      locationName: "London",
      lat: 51.5074,
      lng: -0.1278,
      altitude: 0.04,
      image: null,
      label: "L",
    },
    {
      id: "paris",
      locationName: "Paris",
      lat: 48.8566,
      lng: 2.3522,
      altitude: 0.04,
      image: null,
      label: "P",
    },
    {
      id: "singapore",
      locationName: "Singapore",
      lat: 1.3521,
      lng: 103.8198,
      altitude: 0.04,
      image: null,
      label: "G",
    },
    {
      id: "nairobi",
      locationName: "Nairobi",
      lat: -1.2921,
      lng: 36.8219,
      altitude: 0.04,
      image: null,
      label: "K",
    },
    {
      id: "dubai",
      locationName: "Dubai",
      lat: 25.2048,
      lng: 55.2708,
      altitude: 0.04,
      image: null,
      label: "D",
    },
  ];

  useEffect(() => {
    selectedMarkerIdRef.current = selectedMarkerId;
  }, [selectedMarkerId]);

  const centerMarker = (marker: GlobeMarker) => {
    const nextView = {
      lat: marker.lat,
      lng: marker.lng,
      altitude: lockedAltitude,
    };

    viewRef.current = nextView;
    selectedMarkerIdRef.current = marker.id;
    setSelectedMarkerId(marker.id);
    globeRef.current?.pointOfView(nextView, 900);
  };

  useEffect(() => {
    if (!globeReady) return;
    let cancelled = false;
    let retryFrameId: number | null = null;
    let detach: (() => void) | null = null;

    const tryAttachInteractions = () => {
      if (cancelled) return;

      const interactionLayer = globeContainerRef.current;
      const controls = globeRef.current?.controls?.();
      const renderer = globeRef.current?.renderer?.();
      const canvas = renderer?.domElement;

      if (!interactionLayer || !controls || !canvas) {
        retryFrameId = window.requestAnimationFrame(tryAttachInteractions);
        return;
      }

      viewRef.current = { lat: 12, lng: 18, altitude: lockedAltitude };
      globeRef.current?.pointOfView(viewRef.current, 0);

      controls.autoRotate = false;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;
      controls.zoomSpeed = 0;
      controls.update();

      const applyView = () => {
        globeRef.current?.pointOfView(viewRef.current, 0);
      };

      const tickAutoRotate = () => {
        if (!isDraggingRef.current && !selectedMarkerIdRef.current) {
          viewRef.current = {
            ...viewRef.current,
            lng: ((((viewRef.current.lng + 0.025) + 180) % 360) + 360) % 360 - 180,
          };
          applyView();
        }

        autoRotateFrameRef.current = window.requestAnimationFrame(tickAutoRotate);
      };

      const preventZoom = (event: WheelEvent | TouchEvent) => {
        event.preventDefault();
        event.stopPropagation();
        applyView();
      };

      const clearSelection = () => {
        setSelectedMarkerId(null);
      };

      const onPointerDown = (event: PointerEvent) => {
        const eventTarget = event.target;
        if (eventTarget instanceof Element && eventTarget.closest("[data-globe-marker='true']")) {
          return;
        }

        event.preventDefault();
        clearSelection();
        isDraggingRef.current = true;
        dragPointerIdRef.current = event.pointerId;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        interactionLayer.setPointerCapture(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (
          !isDraggingRef.current ||
          dragPointerIdRef.current !== event.pointerId ||
          !lastPointerRef.current
        ) {
          return;
        }

        event.preventDefault();

        const deltaX = event.clientX - lastPointerRef.current.x;
        const deltaY = event.clientY - lastPointerRef.current.y;

        lastPointerRef.current = { x: event.clientX, y: event.clientY };

        viewRef.current = {
          lat: Math.max(-85, Math.min(85, viewRef.current.lat + deltaY * 0.24)),
          lng: ((((viewRef.current.lng - deltaX * 0.32) + 180) % 360) + 360) % 360 - 180,
          altitude: lockedAltitude,
        };

        applyView();
      };

      const onPointerUp = (event: PointerEvent) => {
        if (dragPointerIdRef.current !== event.pointerId) return;

        isDraggingRef.current = false;
        dragPointerIdRef.current = null;
        lastPointerRef.current = null;

        if (interactionLayer.hasPointerCapture(event.pointerId)) {
          interactionLayer.releasePointerCapture(event.pointerId);
        }
      };

      canvas.style.touchAction = "none";
      canvas.style.pointerEvents = "none";
      interactionLayer.style.touchAction = "none";

      interactionLayer.addEventListener("wheel", preventZoom, { passive: false });
      interactionLayer.addEventListener("touchmove", preventZoom, { passive: false });
      interactionLayer.addEventListener("pointerdown", onPointerDown);
      interactionLayer.addEventListener("pointermove", onPointerMove);
      interactionLayer.addEventListener("pointerup", onPointerUp);
      interactionLayer.addEventListener("pointercancel", onPointerUp);
      autoRotateFrameRef.current = window.requestAnimationFrame(tickAutoRotate);

      detach = () => {
        if (autoRotateFrameRef.current !== null) {
          window.cancelAnimationFrame(autoRotateFrameRef.current);
          autoRotateFrameRef.current = null;
        }
        interactionLayer.removeEventListener("wheel", preventZoom);
        interactionLayer.removeEventListener("touchmove", preventZoom);
        interactionLayer.removeEventListener("pointerdown", onPointerDown);
        interactionLayer.removeEventListener("pointermove", onPointerMove);
        interactionLayer.removeEventListener("pointerup", onPointerUp);
        interactionLayer.removeEventListener("pointercancel", onPointerUp);
      };
    };

    tryAttachInteractions();

    return () => {
      cancelled = true;
      if (retryFrameId !== null) {
        window.cancelAnimationFrame(retryFrameId);
      }
      detach?.();
    };
  }, [globeReady]);

  return (
    <div className="flex justify-center">
      <div
        ref={globeContainerRef}
        className="relative"
        style={{ width: `${globeViewportWidth}px`, height: `${globeViewportHeight}px` }}
      >
        <div
          className="absolute"
          style={{
            width: `${globeRenderWidth}px`,
            height: `${globeRenderHeight}px`,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <Globe
            ref={globeRef}
            width={globeRenderWidth}
            height={globeRenderHeight}
            backgroundColor="rgba(0,0,0,0)"
            rendererConfig={{ alpha: true, antialias: true }}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            showAtmosphere={false}
            pointsData={[]}
            htmlElementsData={htmlMarkers}
            htmlLat="lat"
            htmlLng="lng"
            htmlAltitude="altitude"
            htmlElement={(marker) => {
        const data = marker as (typeof htmlMarkers)[number];
        const el = document.createElement("div");
        el.dataset.globeMarker = "true";
        el.style.position = "relative";
        el.style.zIndex = "20";
        el.style.width = "40px";
        el.style.height = "40px";
        el.style.cursor = "pointer";
        el.style.pointerEvents = "auto";
        el.onclick = (event) => {
          event.stopPropagation();
          centerMarker(data);
        };

        const bubble = document.createElement("div");
        bubble.dataset.globeMarker = "true";
        bubble.style.width = "40px";
        bubble.style.height = "40px";
        bubble.style.borderRadius = "999px";
        bubble.style.overflow = "hidden";
        bubble.style.border = "2px solid white";
        bubble.style.background = "#ff6a3d";
        bubble.style.display = "grid";
        bubble.style.placeItems = "center";
        bubble.style.fontSize = "16px";
        bubble.style.fontWeight = "700";
        bubble.style.color = "#ffffff";

        if (data.image) {
          const img = document.createElement("img");
          img.src = data.image;
          img.alt = `Avatar de ${data.label}`;
              img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          img.referrerPolicy = "no-referrer";
          bubble.appendChild(img);
        } else {
          bubble.textContent = data.label;
        }

        el.appendChild(bubble);

        if (selectedMarkerId === data.id) {
          const tooltip = document.createElement("div");
          tooltip.dataset.globeMarker = "true";
          tooltip.textContent = data.locationName;
          tooltip.style.position = "absolute";
          tooltip.style.left = "50%";
          tooltip.style.bottom = "calc(100% + 10px)";
          tooltip.style.transform = "translateX(-50%)";
          tooltip.style.padding = "6px 10px";
          tooltip.style.borderRadius = "999px";
          tooltip.style.background = "rgba(15, 23, 20, 0.92)";
          tooltip.style.color = "#ffffff";
          tooltip.style.fontSize = "12px";
          tooltip.style.fontWeight = "600";
          tooltip.style.lineHeight = "1";
          tooltip.style.whiteSpace = "nowrap";
          tooltip.style.pointerEvents = "none";
          el.appendChild(tooltip);
        }

        return el;
      }}
            onGlobeReady={() => setGlobeReady(true)}
          />
        </div>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-[var(--space-6)]" aria-label="Cargando publicaciones" role="status">
      {Array.from({ length: 3 }).map((_, index) => (
        <article key={index} className="px-[var(--space-2)] py-[var(--space-3)]">
          <div className="mb-[var(--space-4)] flex items-center gap-3">
            <div className="feed-skeleton-shimmer h-[44px] w-[44px] rounded-full" />
            <div className="space-y-2">
              <div className="feed-skeleton-shimmer h-4 w-[92px] rounded-full" />
              <div className="feed-skeleton-shimmer h-3 w-[72px] rounded-full" />
            </div>
          </div>

          <div className="relative">
            <div className="feed-skeleton-shimmer aspect-[4/3] w-full rounded-card" />
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-card border border-white/20 bg-black/20 px-3 py-2 backdrop-blur-[2px]">
              <div className="flex items-center gap-2">
                <div className="feed-skeleton-shimmer h-4 w-10 rounded-full" />
                <div className="feed-skeleton-shimmer h-4 w-[148px] rounded-full" />
              </div>
              <div className="feed-skeleton-shimmer h-8 w-[170px] rounded-card" />
            </div>
          </div>

          <div className="mt-[var(--space-4)] flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="feed-skeleton-shimmer h-4 w-[72%] rounded-full" />
              <div className="flex items-center gap-4">
                <div className="feed-skeleton-shimmer h-6 w-6 rounded-full" />
                <div className="feed-skeleton-shimmer h-6 w-6 rounded-full" />
                <div className="feed-skeleton-shimmer h-4 w-[64px] rounded-full" />
              </div>
            </div>
            <div className="feed-skeleton-shimmer h-6 w-6 rounded-full" />
          </div>
        </article>
      ))}
    </div>
  );
}

function FeedCard({ post, currentUserId }: { post: FeedItemDto; currentUserId: string | null }) {
  const [publishing, setPublishing] = useState(false);
  const [liked, setLiked] = useState(post.initiallyLiked);
  const [likeCount, setLikeCount] = useState(post.initialLikeCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentsSection, setCommentsSection] = useState<CommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [visibleCommentIndex, setVisibleCommentIndex] = useState(0);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
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

  // Cycle through comments every 5 seconds (pause when expanded)
  useEffect(() => {
    if (commentsSection.length <= 1 || commentsExpanded) return;
    const intervalId = window.setInterval(() => {
      setVisibleCommentIndex((prev) => (prev + 1) % commentsSection.length);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [commentsSection.length, commentsExpanded]);

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

  const getCommentAuthorColor = (userId: string) => {
    const colors = [
      "#7DD3FC", // sky-300
      "#FCA5A5", // red-300
      "#86EFAC", // green-300
      "#FDE68A", // amber-200
      "#C4B5FD", // violet-300
      "#F9A8D4", // pink-300
      "#6EE7B7", // emerald-300
      "#93C5FD", // blue-300
      "#FDBA74", // orange-300
      "#A5B4FC", // indigo-300
      "#5EEAD4", // teal-300
      "#FCA5CF", // fuchsia-300
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <article className="border-b border-app pb-[var(--space-4)]">
      {/* Header */}
      <header className="mb-[var(--space-3)] flex items-center gap-3">
        <Avatar label={post.avatarLabel} image={post.avatarImage ?? null} />
        <div>
          <div className="text-body font-[var(--fw-semibold)] leading-none">{post.userName}</div>
          <p className="mt-[var(--space-1)] text-body-sm leading-none text-muted">{post.subtitle}</p>
        </div>
      </header>

      {/* Image + comment overlay */}
      {post.hasImage && (
        <div className="relative">
          <img
            src={post.coverImage ?? undefined}
            alt="Imagen del plan"
            className="feed-image-responsive"
          />
          {/* Integrated comment overlay */}
          <div className="absolute inset-x-3 bottom-3 max-h-[calc(100%-24px)] rounded-[12px] bg-black/60 backdrop-blur-sm transition-all duration-300 ease-out">
            {/* Expanded comments list */}
            <div
              className={`overflow-hidden transition-[max-height,opacity] ease-out ${
                commentsExpanded && commentsSection.length > 0
                  ? "max-h-[calc(100vh)] opacity-100 duration-700"
                  : "max-h-0 opacity-0 duration-300"
              }`}
            >
              <div className="max-h-[180px] space-y-[var(--space-2)] overflow-y-auto overscroll-contain px-[var(--space-3)] pt-[var(--space-2)]">
                {commentsSection.map((comment) => (
                  <div key={comment.commentId} className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-body-sm leading-[1.4] text-white">
                      <span className="font-[var(--fw-semibold)]" style={{ color: getCommentAuthorColor(comment.userId) }}>{getCommentAuthorName(comment)}:</span>{" "}
                      {comment.content}
                    </p>
                    {comment.userId === currentUserId && (
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 p-0.5 text-red-500/60"
                        aria-label="Eliminar comentario"
                        title="Eliminar comentario"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Comment bar */}
            <div className="flex items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)]">
              {/* Left: cycling comments (click to expand) */}
              <button
                type="button"
                className="relative min-h-[20px] min-w-0 flex-1 overflow-hidden text-left"
                onClick={() => commentsSection.length > 0 && setCommentsExpanded((prev) => !prev)}
              >
                {commentsSection.length > 0 ? (
                  commentsSection.map((comment, idx) => (
                    <p
                      key={comment.commentId}
                      className={`text-body-sm leading-snug text-white transition-opacity duration-500 ${idx === visibleCommentIndex ? "relative opacity-100" : "absolute inset-0 opacity-0"}`}
                    >
                      <span className="font-[var(--fw-semibold)]" style={{ color: getCommentAuthorColor(comment.userId) }}>{getCommentAuthorName(comment)}:</span>{" "}
                      {comment.content}
                    </p>
                  ))
                ) : (
                  <p className="text-body-sm leading-snug text-white/60">Sin comentarios</p>
                )}
              </button>
              {/* Right: comment input + send */}
              <div ref={emojiPickerRef} className="relative flex shrink-0 items-center rounded-[6px] bg-white/15 px-[var(--space-2)] ring-0 ring-white/30 transition-shadow focus-within:ring-[1px]">
                <button
                  type="button"
                  className="mr-[var(--space-2)] flex items-center justify-center text-white/70"
                  aria-label="Emoticonos"
                  onClick={() => setEmojiPickerOpen((prev) => !prev)}
                >
                  <SmileyIcon />
                </button>
                {emojiPickerOpen && (
                  <div className="absolute bottom-[calc(100%+8px)] right-0 z-50 w-[256px] rounded-[10px] bg-[#1a1a1a]/95 p-2 shadow-lg backdrop-blur-md">
                    <div className="grid max-h-[180px] grid-cols-8 gap-0.5 overflow-y-auto overscroll-contain">
                      {EMOJI_LIST.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="flex size-[30px] items-center justify-center rounded-[6px] text-[18px] transition-colors hover:bg-white/15"
                          onClick={() => insertEmoji(emoji)}
                        >
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
                  placeholder="Comentar..."
                  className="w-[130px] bg-transparent py-[6px] text-body-sm text-white outline-none ring-0 placeholder:text-white/50 focus:ring-0"
                  disabled={!currentUserId || commentSubmitting}
                />
                <button
                  type="button"
                  onClick={onSubmitComment}
                  disabled={!currentUserId || commentSubmitting || !commentText.trim()}
                  className="ml-1 flex items-center justify-center text-white/70 disabled:opacity-40"
                >
                  <SendIcon small />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Text */}
      <p className="mt-[var(--space-3)] text-body leading-[1.45]">
        <span className="font-[var(--fw-semibold)]">{post.userName}</span>{" "}
        {post.text}
      </p>

      {/* Actions */}
      <div className="mt-[var(--space-2)] flex items-center justify-between text-app">
        <div className="flex items-center gap-[var(--space-3)]">
          <button
            type="button"
            className="flex items-center gap-1 p-1 disabled:opacity-50"
            aria-label={liked ? "Quitar like" : "Dar like"}
            onClick={onLikeToggle}
            disabled={!currentUserId || likeLoading}
            title={liked ? "Quitar like" : "Dar like"}
          >
            <PlaneIcon liked={liked} animating={likeAnimating} />
          </button>
          <button
            type="button"
            className="p-1 disabled:opacity-50"
            aria-label="Compartir"
            onClick={onPublish}
            disabled={publishing}
            title={publishing ? "Publicando..." : "Compartir"}
          >
            <SendIcon />
          </button>
          <button
            type="button"
            className="text-body-sm font-[var(--fw-semibold)] text-primary-token"
          >
            Ver plan
          </button>
        </div>
        <button type="button" className="p-1" aria-label="Guardar">
          <BookmarkIcon />
        </button>
      </div>

    </article>
  );
}

function Avatar({ label, image }: { label: string; image?: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt={`Avatar de ${label}`}
        className="avatar-lg rounded-full border border-app object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="flex avatar-lg items-center justify-center border border-app bg-surface-inset text-body font-[var(--fw-semibold)] text-app">
      {label}
    </div>
  );
}

function PlaneIcon({ liked, animating }: { liked: boolean; animating: boolean }) {
  return (
    <svg
      width="28"
      height="28"
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

function CommentIcon({ small }: { small?: boolean }) {
  return (
    <svg width={small ? "16" : "28"} height={small ? "16" : "28"} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H18.5A1.5 1.5 0 0 1 20 5.5V14.5A1.5 1.5 0 0 1 18.5 16H9L4 20V5.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SendIcon({ small }: { small?: boolean }) {
  return (
    <svg width={small ? "16" : "28"} height={small ? "16" : "28"} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 3L10 14" stroke="currentColor" strokeWidth="1.7" />
      <path d="M21 3L14.5 21L10 14L3 9.5L21 3Z" stroke="currentColor" strokeWidth="1.7" />
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

function BookmarkIcon() {
  return (
    <svg width="29" height="29" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 4H16.5A1 1 0 0 1 17.5 5V20L12 16.8L6.5 20V5A1 1 0 0 1 7.5 4Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}
