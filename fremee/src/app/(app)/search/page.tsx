"use client";

import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import UserSearchSurface from "@/components/search/UserSearchSurface";
import { useAuth } from "@/providers/AuthProvider";

export default function SearchPage() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main className="min-h-[calc(100dvh-env(safe-area-inset-top)-clamp(56px,8dvh,64px)-env(safe-area-inset-bottom))] px-safe pb-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom))] pt-mobile-safe-top md:min-h-0 md:py-[var(--space-10)] md:pr-[var(--space-14)]">
          <section className="mx-auto w-full max-w-[720px]">
            <h1 className="mb-[var(--space-6)] text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">
              Buscar
            </h1>

            <UserSearchSurface excludeUserId={user?.id} autoFocus />
          </section>
        </main>
      </div>
    </div>
  );
}
