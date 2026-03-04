"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import { listPlansByIdsInOrder } from "@/services/api/repositories/plans.repository";
import { listPublishedPostPlanIds } from "@/services/api/repositories/feed.repository";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { publishPlanAsPost } from "@/services/api/repositories/post.repository";
import {
  listPlanLikeCounts,
  listUserLikedPlanIds,
  togglePlanLike,
} from "@/services/api/repositories/likes.repository";
import {
  createComment,
  listCommentsForPlan,
  listPreviewCommentsForPlans,
  type CommentDto,
} from "@/services/api/repositories/comments.repository";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";

type PostType = "plan" | "comment";

type FeedPost = {
  id: string;
  type: PostType;
  userName: string;
  avatarLabel: string;
  avatarImage?: string | null;
  subtitle: string;
  text: string;
  hasImage?: boolean;
  coverImage?: string;
};

type UiPost = FeedPost & {
  plan: FeedPlanItemDto;
  initiallyLiked: boolean;
  initialLikeCount: number;
  previewComments: CommentDto[];
};

type Suggestion = {
  id: string;
  name: string;
  text: string;
  avatarLabel: string;
};

const MOCK_SUGGESTIONS: Suggestion[] = [
  { id: "s1", name: "Patrick", text: "Ha publicado su viaje a Oslo", avatarLabel: "P" },
  { id: "s2", name: "Isa", text: "Ha publicado su viaje a Escocia", avatarLabel: "I" },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeFeedTab, setActiveFeedTab] = useState<"following" | "explore">("following");
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [uiPosts, setUiPosts] = useState<UiPost[]>([]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const lastProfileUpdatedAtRef = useRef<string | null>(null);
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const followingTabRef = useRef<HTMLButtonElement | null>(null);
  const exploreTabRef = useRef<HTMLButtonElement | null>(null);
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, ready: false });

  useEffect(() => {
    if (!currentUserId) {
      setUiPosts([]);
      setSuggestions(MOCK_SUGGESTIONS);
      setLoadingFeed(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoadingFeed(true);
      try {
        const publishedPlanIds = await listPublishedPostPlanIds({ limit: 20 });
        const plans = await listPlansByIdsInOrder(publishedPlanIds);

        if (cancelled) return;

        const resolvedPlanIds = plans.map((plan) => plan.id);
        const [likedPlanIds, likeCountsByPlanId, previewCommentsByPlanId] = await Promise.all([
          listUserLikedPlanIds({
            userId: currentUserId,
            planIds: resolvedPlanIds,
          }),
          listPlanLikeCounts({ planIds: resolvedPlanIds }),
          listPreviewCommentsForPlans({
            planIds: resolvedPlanIds,
            userId: currentUserId,
            limitPerPlan: 2,
          }),
        ]);

        if (cancelled) return;

        const likedSet = new Set<number>(likedPlanIds);
        const mapped: UiPost[] = plans.map((p) => {
          const name = p.creator?.name || "Usuario";
          const avatarLabel = (name.trim()[0] || "U").toUpperCase();

          return {
            id: String(p.id),
            type: "plan",
            userName: name,
            avatarLabel,
            avatarImage: p.creator?.profileImage ?? null,
            subtitle: p.title,
            text: p.description,
            hasImage: Boolean(p.coverImage),
            coverImage: p.coverImage ?? undefined,
            plan: p,
            initiallyLiked: likedSet.has(p.id),
            initialLikeCount: likeCountsByPlanId[p.id] ?? 0,
            previewComments: previewCommentsByPlanId[p.id] ?? [],
          };
        });

        const imageUrlsToPreload = mapped.flatMap((post) => {
          const urls: string[] = [];
          if (post.coverImage) urls.push(post.coverImage);
          if (post.avatarImage) urls.push(post.avatarImage);
          return urls;
        });

        await preloadImages(imageUrlsToPreload);
        if (cancelled) return;

        setUiPosts(mapped);
        setSuggestions(MOCK_SUGGESTIONS);
      } catch (e) {
        console.error("[feed] load error", e);
        setUiPosts([]);
        setSuggestions(MOCK_SUGGESTIONS);
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

  if (loading || loadingFeed) return <LoadingScreen />;

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
                className="relative flex gap-[var(--space-10)] border-b border-app text-body text-muted"
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

              <div className="mt-[var(--space-5)] space-y-[var(--space-6)]">
                {uiPosts.map((post) => (
                  <FeedCard key={post.id} post={post} currentUserId={currentUserId} />
                ))}
              </div>
            </section>

            <aside className="hidden pt-[var(--space-10)] xl:block">
              <h3 className="text-[var(--font-h5)] font-[var(--fw-semibold)] leading-[var(--lh-h5)]">Actividad reciente</h3>
              <div className="mt-[var(--space-4)] space-y-[var(--space-5)]">
                {suggestions.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <Avatar label={item.avatarLabel} />
                    <div>
                      <div className="text-body font-[var(--fw-semibold)] leading-none">{item.name}</div>
                      <p className="mt-[var(--space-1)] text-body-sm leading-[1.35] text-muted">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function FeedCard({ post, currentUserId }: { post: UiPost; currentUserId: string | null }) {
  const [publishing, setPublishing] = useState(false);
  const [liked, setLiked] = useState(post.initiallyLiked);
  const [likeCount, setLikeCount] = useState(post.initialLikeCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [previewComments, setPreviewComments] = useState<CommentDto[]>(post.previewComments);
  const [commentsSection, setCommentsSection] = useState<CommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [resolvedAuthorNames, setResolvedAuthorNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setLiked(post.initiallyLiked);
  }, [post.initiallyLiked]);

  useEffect(() => {
    setLikeCount(post.initialLikeCount);
  }, [post.initialLikeCount]);

  useEffect(() => {
    setPreviewComments(post.previewComments);
  }, [post.previewComments]);

  useEffect(() => {
    if (!likeAnimating) return;
    const timeoutId = window.setTimeout(() => setLikeAnimating(false), 180);
    return () => window.clearTimeout(timeoutId);
  }, [likeAnimating]);

  useEffect(() => {
    let cancelled = false;
    const commentsToResolve = [...previewComments, ...commentsSection];
    const uniqueUserIds = [...new Set(commentsToResolve.map((c) => c.userId).filter((id) => id && id.length > 0))];
    const unresolved = uniqueUserIds.filter((userId) => {
      if (resolvedAuthorNames[userId]) return false;
      const cached = commentAuthorCache.get(userId);
      return !(cached && Date.now() - cached.cachedAt < COMMENT_AUTHOR_CACHE_TTL_MS);
    });

    if (unresolved.length === 0) {
      const hydratedFromCache: Record<string, string> = {};
      for (const userId of uniqueUserIds) {
        const cached = commentAuthorCache.get(userId);
        if (cached && Date.now() - cached.cachedAt < COMMENT_AUTHOR_CACHE_TTL_MS) {
          hydratedFromCache[userId] = cached.name;
        }
      }
      if (!cancelled && Object.keys(hydratedFromCache).length > 0) {
        setResolvedAuthorNames((prev) => {
          let changed = false;
          for (const [userId, name] of Object.entries(hydratedFromCache)) {
            if (prev[userId] !== name) {
              changed = true;
              break;
            }
          }
          if (!changed) return prev;
          return { ...prev, ...hydratedFromCache };
        });
      }
      return () => {
        cancelled = true;
      };
    }

    const resolveNames = async () => {
      const resolved: Record<string, string> = {};

      await Promise.all(
        unresolved.map(async (userId) => {
          try {
            const profile = await getPublicUserProfile(userId);
            const name = profile?.nombre?.trim();
            if (name) {
              resolved[userId] = name;
              commentAuthorCache.set(userId, {
                name,
                profileImage: profile?.profile_image ?? null,
                cachedAt: Date.now(),
              });
            }
          } catch {
            // silent fallback to snapshot name/user placeholder
          }
        }),
      );

      if (!cancelled && Object.keys(resolved).length > 0) {
        setResolvedAuthorNames((prev) => {
          let changed = false;
          for (const [userId, name] of Object.entries(resolved)) {
            if (prev[userId] !== name) {
              changed = true;
              break;
            }
          }
          if (!changed) return prev;
          return { ...prev, ...resolved };
        });
      }
    };

    void resolveNames();

    return () => {
      cancelled = true;
    };
  }, [previewComments, commentsSection, resolvedAuthorNames]);

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
      setPreviewComments(allComments.slice(0, 2));
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
    return resolvedAuthorNames[comment.userId] || comment.userName?.trim() || "Usuario";
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
          src={post.coverImage}
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

      {!commentOpen && previewComments.length > 0 && (
        <div className="mt-[var(--space-3)] space-y-[var(--space-1)]">
          {previewComments.slice(0, 2).map((comment) => (
            <p key={comment.commentId} className="text-body-sm leading-[1.35]">
              <span className="font-[var(--fw-semibold)]">{getCommentAuthorName(comment)}</span>{" "}
              {comment.content}
            </p>
          ))}
        </div>
      )}

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
