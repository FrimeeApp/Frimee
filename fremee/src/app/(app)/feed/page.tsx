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
                  className={`pointer-events-none absolute bottom-0 h-[2px] bg-warning-token transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] ${
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
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentsSection, setCommentsSection] = useState<CommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

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

  const openCommentsSection = async () => {
    setCommentOpen(true);
    setCommentsLoading(true);
    try {
      const allComments = await listCommentsForPlan({
        planId: post.plan.id,
        userId: currentUserId ?? undefined,
        limit: 50,
      });
      setCommentsSection(allComments);
    } catch (error) {
      console.error("[feed] Error loading comments:", error);
      setCommentsSection([]);
    } finally {
      setCommentsLoading(false);
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
      await openCommentsSection();
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

  const onToggleCommentsSection = async () => {
    if (commentOpen) {
      setCommentOpen(false);
      return;
    }
    await openCommentsSection();
  };

  const getCommentAuthorName = (comment: CommentDto) => {
    return comment.userName?.trim() || "Usuario";
  };

  return (
    <article className="border-b border-app pb-[var(--space-6)]">
      <header className="mb-[var(--space-3)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar label={post.avatarLabel} image={post.avatarImage ?? null} />
          <div>
            <div className="text-body font-[var(--fw-semibold)] leading-none">{post.userName}</div>
            <p className="mt-[var(--space-1)] text-body-sm leading-none text-muted">{post.subtitle}</p>
          </div>
        </div>
      </header>

      {post.hasImage && (
        <img
          src={post.coverImage ?? undefined}
          alt="Imagen del plan"
          className="feed-image-responsive mb-[var(--space-4)]"
        />
      )}

      <div className="flex items-center justify-between text-app">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex items-center gap-1 p-1 disabled:opacity-50"
            aria-label={liked ? "Quitar like" : "Dar like"}
            onClick={onLikeToggle}
            disabled={!currentUserId || likeLoading}
            title={liked ? "Quitar like" : "Dar like"}
          >
            <HeartIcon liked={liked} animating={likeAnimating} />
            <span className="text-body-sm font-[var(--fw-medium)] tabular-nums">{likeCount}</span>
          </button>
          <button
            type="button"
            className="p-1 disabled:opacity-50"
            aria-label={commentOpen ? "Cerrar comentarios" : "Abrir comentarios"}
            onClick={onToggleCommentsSection}
            title={commentOpen ? "Cerrar comentarios" : "Abrir comentarios"}
          >
            <CommentIcon />
          </button>
          <button
            type="button"
            className="p-1 disabled:opacity-50"
            aria-label="Publicar"
            onClick={onPublish}
            disabled={publishing}
            title={publishing ? "Publicando..." : "Publicar en Firebase"}
          >
            <SendIcon />
          </button>
        </div>
        <BookmarkIcon />
      </div>

      <p className="mt-[var(--space-2)] text-body leading-[1.45]">{post.text}</p>

      {commentOpen && (
        <div className="mt-[var(--space-3)] border-t border-app pt-[var(--space-3)]">
          <p className="text-body-sm font-[var(--fw-semibold)]">Comentarios</p>

          <div className="mt-[var(--space-2)] space-y-[var(--space-2)]">
            {commentsLoading ? (
              <p className="text-body-sm text-muted">Cargando comentarios...</p>
            ) : commentsSection.length === 0 ? (
              <p className="text-body-sm text-muted">Aun no hay comentarios. Se el primero.</p>
            ) : (
              commentsSection.map((comment) => (
                <p key={comment.commentId} className="text-body-sm leading-[1.35]">
                  <span className="font-[var(--fw-semibold)]">{getCommentAuthorName(comment)}</span>{" "}
                  {comment.content}
                </p>
              ))
            )}
          </div>

          <div className="mt-[var(--space-3)] flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={onCommentKeyDown}
              placeholder="Escribe un comentario..."
              className="flex-1 rounded-card border border-app bg-app px-3 py-2 text-body-sm outline-none"
              disabled={!currentUserId || commentSubmitting}
            />
            <button
              type="button"
              onClick={onSubmitComment}
              disabled={!currentUserId || commentSubmitting || !commentText.trim()}
              className="rounded-card border border-app px-3 py-2 text-body-sm font-[var(--fw-semibold)] disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      <button type="button" className="mt-[var(--space-3)] text-body-sm font-[var(--fw-semibold)] text-primary-token">
        Ver plan
      </button>
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

function HeartIcon({ liked, animating, small }: { liked: boolean; animating: boolean; small?: boolean }) {
  return (
    <svg
      width={small ? "18" : "31"}
      height={small ? "18" : "31"}
      viewBox="0 0 24 24"
      fill={liked ? "currentColor" : "none"}
      aria-hidden="true"
      className={`transition-all duration-150 ${liked ? "text-warning-token" : "text-app"} ${animating ? "scale-[1.2]" : "scale-100"}`}
    >
      <path
        d="M2.5 11.2H8.6L12.6 4.2H14.5L13.5 11.2H20.8L21.8 12.8L13.5 13.8L14.5 20.8H12.6L8.6 13.8H2.5V11.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="31" height="31" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H18.5A1.5 1.5 0 0 1 20 5.5V14.5A1.5 1.5 0 0 1 18.5 16H9L4 20V5.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="31" height="31" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 3L10 14" stroke="currentColor" strokeWidth="1.7" />
      <path d="M21 3L14.5 21L10 14L3 9.5L21 3Z" stroke="currentColor" strokeWidth="1.7" />
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
