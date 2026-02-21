"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import AppSidebar from "@/components/common/AppSidebar";

type PostType = "plan" | "comment";

type FeedPost = {
  id: string;
  type: PostType;
  userName: string;
  avatarLabel: string;
  subtitle: string;
  text: string;
  hasImage?: boolean;
};

type Suggestion = {
  id: string;
  name: string;
  text: string;
  avatarLabel: string;
};

const MOCK_POSTS: FeedPost[] = [
  {
    id: "p1",
    type: "plan",
    userName: "Lucas",
    avatarLabel: "L",
    subtitle: "Maldivas",
    text: "Por fin llegamos a nuestro destino!",
    hasImage: true,
  },
  {
    id: "p2",
    type: "comment",
    userName: "Paola",
    avatarLabel: "P",
    subtitle: "Desayuno de Domingo",
    text: "Mesa reservada para 6 en el Saona, quien mas se apunta?",
  },
  {
    id: "p3",
    type: "comment",
    userName: "JessicaL",
    avatarLabel: "J",
    subtitle: "Desayuno de Viernes",
    text: "Mesa reservada para 6 en el Saona, quien mas se apunta?",
  },
];

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
      // En OAuth web puede haber una carrera de 100-1500ms entre callback y persistencia de sesión.
      // Reintentamos brevemente antes de redirigir a login para evitar bucles/negro.
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

    const timer = setTimeout(() => {
      setPosts(MOCK_POSTS);
      setSuggestions(MOCK_SUGGESTIONS);
      setLoadingFeed(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f4f4f4] px-6 text-center text-[#535353]">
        <div>
          <p className="text-lg font-medium">Cargando tu feed...</p>
          <p className="mt-2 text-sm text-[#7d7d7d]">Comprobando sesión.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f4f4f4] text-[#1A1F1D]">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((prev) => !prev)} />

        <main
          className={`px-5 pb-[calc(6rem+var(--safe-bottom))] pt-6 transition-[padding] duration-300 ease-in-out lg:py-8 lg:pr-14 ${
            sidebarCollapsed ? "lg:pl-[56px]" : "lg:pl-[136px]"
          }`}
        >
          <div className="mx-auto grid max-w-[1130px] grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="max-w-[835px]">
              <div className="flex gap-12 border-b border-[#b9b9b9] pb-2 text-[20px] text-[#5f6368]">
                <button type="button" className="font-medium text-[#666]">
                  Siguiendo
                </button>
                <button type="button" className="font-medium text-[#666]">
                  Explorar
                </button>
              </div>

              <div className="mt-5 space-y-6">
                {loadingFeed ? (
                  <FeedSkeleton />
                ) : (
                  posts.map((post) => <FeedCard key={post.id} post={post} />)
                )}
              </div>
            </section>

            <aside className="hidden pt-11 xl:block">
              <h2 className="text-[24px] font-semibold leading-[1.1]">Sugerencias para ti</h2>
              <div className="mt-5 space-y-5">
                {loadingFeed
                  ? [0, 1].map((idx) => (
                      <div key={idx} className="flex animate-pulse items-start gap-3">
                        <div className="size-11 rounded-full bg-[#d8d8d8]" />
                        <div className="space-y-2">
                          <div className="h-3 w-24 rounded bg-[#d8d8d8]" />
                          <div className="h-3 w-36 rounded bg-[#d8d8d8]" />
                        </div>
                      </div>
                    ))
                  : suggestions.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <Avatar label={item.avatarLabel} />
                        <div>
                          <div className="text-[18px] font-semibold leading-none">{item.name}</div>
                          <p className="mt-1 text-[18px] leading-[1.3] text-[#353a40]">{item.text}</p>
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
    <article className="border-b border-[#b9b9b9] pb-8">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar label={post.avatarLabel} />
          <div>
            <div className="text-[18px] font-semibold leading-none">{post.userName}</div>
            <p className="mt-1 text-[15px] leading-none text-[#353a40]">{post.subtitle}</p>
          </div>
        </div>
      </header>

      {post.hasImage && (
        <div className="relative mb-3 h-[385px] overflow-hidden rounded-[14px] bg-gradient-to-br from-[#77a7ea] via-[#7dc0f0] to-[#a4dde7]">
          <div className="absolute bottom-6 left-8 text-[19px] font-semibold text-white/90">MALDIVAS</div>
          <div className="absolute right-11 top-8 text-[19px] font-semibold text-white/90">AIR</div>
        </div>
      )}

      <div className="flex items-center justify-between text-[#1f1f1f]">
        <div className="flex items-center gap-4">
          <HeartIcon />
          <CommentIcon />
          <SendIcon />
        </div>
        <BookmarkIcon />
      </div>

      <p className="mt-2 text-[17px] leading-[1.35]">
        <span className="font-semibold">{post.userName}</span> {post.text}
      </p>
      <button type="button" className="mt-3 text-[16px] font-medium text-[#d33a09]">
        Ver plan
      </button>
    </article>
  );
}

function FeedSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 w-44 rounded bg-[#d8d8d8]" />
      <div className="h-[344px] rounded-xl bg-[#d8d8d8]" />
      <div className="h-6 w-2/3 rounded bg-[#d8d8d8]" />
      <div className="h-6 w-24 rounded bg-[#d8d8d8]" />
    </div>
  );
}

function Avatar({ label }: { label: string }) {
  return (
    <div className="flex size-11 items-center justify-center rounded-full bg-[#f5d2ad] text-base font-semibold text-[#5b3e2b]">
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
