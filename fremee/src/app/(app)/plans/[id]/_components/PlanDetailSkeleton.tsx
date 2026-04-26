export function PlanDetailSkeleton() {
  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative min-h-dvh w-full">
        <main className="pb-[max(var(--space-6),env(safe-area-inset-bottom))] md:py-0 md:pl-[102px]">
          <div className="md:grid md:grid-cols-[minmax(88px,1fr)_minmax(0,1536px)_minmax(88px,1fr)] xl:grid-cols-[minmax(180px,1fr)_minmax(0,1280px)_minmax(180px,1fr)] 2xl:grid-cols-[minmax(240px,1fr)_minmax(0,1240px)_minmax(240px,1fr)]">
            <div className="md:col-start-2">

              {/* Hero skeleton */}
              <div
                className="relative w-full overflow-hidden md:ml-0 md:rounded-b-[20px] animate-pulse bg-[var(--surface-2)]"
                style={{ height: "clamp(260px, 40vh, 380px)" }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute left-[var(--page-margin-x)] top-[calc(env(safe-area-inset-top)+var(--space-4))] md:top-[var(--space-6)] h-9 w-9 rounded-full bg-white/20" />
                <div className="absolute bottom-0 left-0 right-0 px-[var(--page-margin-x)] pb-[var(--space-6)] space-y-[var(--space-2)]">
                  <div className="h-8 w-2/3 rounded-lg bg-white/20" />
                  <div className="h-4 w-1/3 rounded-md bg-white/15" />
                  <div className="flex gap-[var(--space-4)] pt-[var(--space-1)]">
                    <div className="h-4 w-24 rounded-md bg-white/15" />
                    <div className="h-4 w-28 rounded-md bg-white/15" />
                  </div>
                </div>
              </div>

              {/* Tabs skeleton */}
              <div className="border-b border-app px-[var(--page-margin-x)]">
                <div className="flex gap-[var(--space-8)] py-[var(--space-4)]">
                  {[80, 56, 64].map((w, i) => (
                    <div key={i} className="h-4 rounded-md bg-[var(--surface-2)] animate-pulse" style={{ width: w }} />
                  ))}
                </div>
              </div>

              {/* Content skeleton */}
              <div className="px-[var(--page-margin-x)] pt-[var(--space-8)] space-y-[var(--space-6)]">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-[var(--space-4)]">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-[var(--surface-2)] animate-pulse" />
                    <div className="flex-1 space-y-[var(--space-2)]">
                      <div className="h-4 w-1/4 rounded-md bg-[var(--surface-2)] animate-pulse" />
                      <div className="h-4 w-1/2 rounded-md bg-[var(--surface-2)] animate-pulse" />
                      <div className="h-3 w-1/3 rounded-md bg-[var(--surface-2)] animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
