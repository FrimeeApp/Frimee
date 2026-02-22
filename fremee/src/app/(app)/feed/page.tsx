"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import AppSidebar from "@/components/common/AppSidebar";
import { listExplorePlans } from "@/services/api/repositories/plans.repository";

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

export default function FeedPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

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
        router.replace("/login");
        return;
      }
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

        const mapped: FeedPost[] = plans.map((p) => {
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
          };
        });

        setPosts(mapped);
        setSuggestions(MOCK_SUGGESTIONS);
      } catch (e) {
        console.error("[feed] load error", e);
        setPosts([]);
        setSuggestions(MOCK_SUGGESTIONS);
      } finally {
        if (!cancelled) setLoadingFeed(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [ready]);

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
              <div className="flex gap-[var(--space-10)] border-b border-app pb-[var(--space-2)] text-body text-muted">
                <button type="button" className="font-[var(--fw-medium)] text-app">
                  Siguiendo
                </button>
                <button type="button" className="font-[var(--fw-medium)]">
                  Explorar
                </button>
              </div>

              <div className="mt-[var(--space-5)] space-y-[var(--space-6)]">
                {loadingFeed ? (
                  <FeedSkeleton />
                ) : (
                  posts.map((post) => <FeedCard key={post.id} post={post} />)
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

function FeedCard({ post }: { post: FeedPost }) {
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
          <HeartIcon />
          <CommentIcon />
          <SendIcon />
        </div>
        <BookmarkIcon />
      </div>

      <p className="mt-[var(--space-2)] text-body leading-[1.45]">
        <span className="font-[var(--fw-semibold)]">{post.userName}</span> {post.text}
      </p>
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

function HeartIcon() {
  return (
    <svg width="31" height="31" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
