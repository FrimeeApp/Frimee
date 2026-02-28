"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import AppSidebar from "@/components/common/AppSidebar";
import { listExplorePlans } from "@/services/api/repositories/plans.repository";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { publishPlanAsPost } from "@/services/api/repositories/post.repository";
import {
  listPlanLikeCounts,
  listUserLikedPlanIds,
  togglePlanLike,
} from "@/services/api/repositories/likes.repository";
import {
  createComment,
  getTopCommentForPlan,
  listTopCommentsForPlans,
  toggleCommentLike,
  type TopCommentDto,
} from "@/services/api/repositories/comments.repository";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";

type PostType = "plan" | "comment";

type FeedPost = {
  id: string;
  type: PostType;
  userName: string;
  avatarLabel: string;
  subtitle: string;
  text: string;
  hasImage?: boolean;
  coverImage?: string;
};

type UiPost = FeedPost & {
  plan: FeedPlanItemDto;
  initiallyLiked: boolean;
  initialLikeCount: number;
  topComment: TopCommentDto | null;
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
const commentAuthorNameCache = new Map<string, { name: string; cachedAt: number }>();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function FeedPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeFeedTab, setActiveFeedTab] = useState<"following" | "explore">("following");
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [uiPosts, setUiPosts] = useState<UiPost[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const followingTabRef = useRef<HTMLButtonElement | null>(null);
  const exploreTabRef = useRef<HTMLButtonElement | null>(null);
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, ready: false });

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    const guard = async () => {
      let sessionFound = false;

      for (let i = 0; i < 8; i += 1) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setCurrentUserId(session.user.id);
          sessionFound = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      if (cancelled) return;

      if (!sessionFound) {
        router.replace("/login");
        return;
      }

      setReady(true);
    };

    guard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) {
        setCurrentUserId(null);
        router.replace("/login");
        return;
      }
      setCurrentUserId(session.user.id);
      setReady(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const load = async () => {
      setLoadingFeed(true);
      try {
        const plans = await listExplorePlans({ limit: 20 });

        if (cancelled) return;

        const planIds = plans.map((plan) => plan.id);
        const [likedPlanIds, likeCountsByPlanId, topCommentsByPlanId] = await Promise.all([
          currentUserId
            ? listUserLikedPlanIds({
                userId: currentUserId,
                planIds,
              })
            : Promise.resolve<number[]>([]),
          listPlanLikeCounts({ planIds }),
          listTopCommentsForPlans({ planIds, userId: currentUserId ?? undefined }),
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
            subtitle: p.title,
            text: p.description,
            hasImage: Boolean(p.coverImage),
            coverImage: p.coverImage ?? undefined,
            plan: p,
            initiallyLiked: likedSet.has(p.id),
            initialLikeCount: likeCountsByPlanId[p.id] ?? 0,
            topComment: topCommentsByPlanId[p.id] ?? null,
          };
        });

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

    load();

    return () => {
      cancelled = true;
    };
  }, [ready, currentUserId]);

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

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app px-[var(--space-6)] text-center text-app">
        <div>
          <p className="text-body-lg font-[var(--fw-medium)]">Cargando tu feed...</p>
          <p className="mt-[var(--space-2)] text-body-sm text-muted">Comprobando sesion.</p>
        </div>
      </div>
    );
  }

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
                {loadingFeed ? (
                  <FeedSkeleton />
                ) : (
                  uiPosts.map((post) => (
                    <FeedCard key={post.id} post={post} currentUserId={currentUserId} />
                  ))
                )}
              </div>
            </section>

            <aside className="hidden pt-[var(--space-10)] xl:block">
              <h3 className="text-[var(--font-h5)] font-[var(--fw-semibold)] leading-[var(--lh-h5)]">Actividad reciente</h3>
              <div className="mt-[var(--space-4)] space-y-[var(--space-5)]">
                {loadingFeed
                  ? [0, 1].map((idx) => (
                      <div key={idx} className="flex animate-pulse items-start gap-3">
                        <div className="avatar-lg bg-[color-mix(in_srgb,var(--surface)_62%,var(--text-primary)_38%)]" />
                        <div className="space-y-2">
                          <div className="h-3 w-24 rounded bg-[color-mix(in_srgb,var(--surface)_62%,var(--text-primary)_38%)]" />
                          <div className="h-3 w-36 rounded bg-[color-mix(in_srgb,var(--surface)_62%,var(--text-primary)_38%)]" />
                        </div>
                      </div>
                    ))
                  : suggestions.map((item) => (
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
  const [topComment, setTopComment] = useState<TopCommentDto | null>(post.topComment);
  const [commentLikeLoading, setCommentLikeLoading] = useState(false);
  const [topCommentAuthorName, setTopCommentAuthorName] = useState<string | null>(null);

  useEffect(() => {
    setLiked(post.initiallyLiked);
  }, [post.initiallyLiked]);

  useEffect(() => {
    setLikeCount(post.initialLikeCount);
  }, [post.initialLikeCount]);

  useEffect(() => {
    setTopComment(post.topComment);
  }, [post.topComment]);

  useEffect(() => {
    let cancelled = false;

    const loadAuthorName = async () => {
      const userId = topComment?.userId;
      const fallbackName = topComment?.userName?.trim() || null;
      if (!userId) {
        setTopCommentAuthorName(fallbackName);
        return;
      }

      const cached = commentAuthorNameCache.get(userId);
      if (cached && Date.now() - cached.cachedAt < COMMENT_AUTHOR_CACHE_TTL_MS) {
        setTopCommentAuthorName(cached.name);
        return;
      }

      let resolvedName: string | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const profile = await getPublicUserProfile(userId);
          if (cancelled) return;
          const candidate = profile?.nombre?.trim() ?? "";
          if (candidate) {
            resolvedName = candidate;
            break;
          }
        } catch {
          // retry on transient failure
        }
        await wait(200 * (attempt + 1));
      }

      if (cancelled) return;
      if (resolvedName) {
        commentAuthorNameCache.set(userId, { name: resolvedName, cachedAt: Date.now() });
        setTopCommentAuthorName(resolvedName);
        return;
      }

      // si no hay permiso para resolver perfil por UID, usa snapshot guardado en el comentario
      if (fallbackName) {
        setTopCommentAuthorName(fallbackName);
        return;
      }

      setTopCommentAuthorName("Usuario");
    };

    void loadAuthorName();

    return () => {
      cancelled = true;
    };
  }, [topComment?.userId, topComment?.userName, currentUserId]);

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

  const refreshTopComment = async () => {
    const latest = await getTopCommentForPlan({
      planId: post.plan.id,
      userId: currentUserId ?? undefined,
    });
    setTopComment(latest);
  };

  const onSubmitComment = async () => {
    if (!currentUserId || commentSubmitting) return;
    const content = commentText.trim();
    if (!content) return;

    setCommentSubmitting(true);
    try {
      const cachedCurrentUser = commentAuthorNameCache.get(currentUserId);
      let currentUserName =
        cachedCurrentUser && Date.now() - cachedCurrentUser.cachedAt < COMMENT_AUTHOR_CACHE_TTL_MS
          ? cachedCurrentUser.name
          : "";
      if (!currentUserName) {
        const profile = await getPublicUserProfile(currentUserId);
        currentUserName = profile?.nombre?.trim() || "Usuario";
        commentAuthorNameCache.set(currentUserId, { name: currentUserName, cachedAt: Date.now() });
      }

      await createComment({
        planId: post.plan.id,
        userId: currentUserId,
        userName: currentUserName,
        content,
      });
      setCommentText("");
      setCommentOpen(false);
      await refreshTopComment();
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

  const onToggleTopCommentLike = async () => {
    if (!currentUserId || !topComment || commentLikeLoading) return;

    setCommentLikeLoading(true);
    try {
      const result = await toggleCommentLike({
        planId: post.plan.id,
        commentId: topComment.commentId,
        userId: currentUserId,
      });
      setTopComment((prev) =>
        prev
          ? {
              ...prev,
              likedByMe: result.liked,
              likeCount: result.likeCount,
            }
          : prev,
      );
    } catch (e) {
      console.error("[feed] Error toggling comment like:", e);
    } finally {
      setCommentLikeLoading(false);
    }
  };

  return (
    <article className="border-b border-app pb-[var(--space-6)]">
      <header className="mb-[var(--space-3)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar label={post.avatarLabel} />
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
            aria-label={commentOpen ? "Ocultar comentarios" : "Comentar"}
            onClick={() => setCommentOpen((prev) => !prev)}
            disabled={!currentUserId}
            title={commentOpen ? "Ocultar comentarios" : "Comentar"}
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

      <p className="mt-[var(--space-2)] text-body leading-[1.45]">
        {post.text}
      </p>

      {topComment && (
        <div className="mt-[var(--space-3)] rounded-card border border-app px-[var(--space-3)] py-[var(--space-2)]">
          <div className="text-body-sm leading-[1.35]">
            <span className="font-[var(--fw-semibold)]">{topCommentAuthorName ?? "Usuario"}</span>{" "}
            {topComment.content}
          </div>
          <div className="mt-[var(--space-2)]">
            <button
              type="button"
              className="flex items-center gap-1 text-body-sm text-muted disabled:opacity-50"
              onClick={onToggleTopCommentLike}
              disabled={!currentUserId || commentLikeLoading}
            >
              <HeartIcon liked={topComment.likedByMe} animating={false} small />
              <span className="tabular-nums">{topComment.likeCount}</span>
            </button>
          </div>
        </div>
      )}

      {commentOpen && (
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
      )}

      <button type="button" className="mt-[var(--space-3)] text-body-sm font-[var(--fw-semibold)] text-primary-token">
        Ver plan
      </button>
    </article>
  );
}

function FeedSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 w-44 rounded bg-[color-mix(in_srgb,var(--surface)_62%,var(--text-primary)_38%)]" />
      <div className="h-[344px] rounded-card bg-[color-mix(in_srgb,var(--surface)_62%,var(--text-primary)_38%)]" />
      <div className="h-6 w-2/3 rounded bg-[color-mix(in_srgb,var(--surface)_62%,var(--text-primary)_38%)]" />
      <div className="h-6 w-24 rounded bg-[color-mix(in_srgb,var(--surface)_62%,var(--text-primary)_38%)]" />
    </div>
  );
}

function Avatar({ label }: { label: string }) {
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
      className={`transition-all duration-150 ${liked ? "text-red-500" : "text-app"} ${animating ? "scale-[1.2]" : "scale-100"}`}
    >
      <path
        d="M12 20.5C11.7 20.5 11.4 20.4 11.1 20.2C8.2 18.2 4 14.8 4 10.8C4 8.2 6 6.2 8.5 6.2C10 6.2 11.3 6.9 12 8C12.7 6.9 14 6.2 15.5 6.2C18 6.2 20 8.2 20 10.8C20 14.8 15.8 18.2 12.9 20.2C12.6 20.4 12.3 20.5 12 20.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
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
