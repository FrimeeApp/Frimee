"use client";

import { useRouter } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { NotificationsFeed } from "@/components/notifications/NotificationsFeed";
import { useAuth } from "@/providers/AuthProvider";

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) return <LoadingScreen />;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main className="min-h-[calc(100dvh-env(safe-area-inset-top)-clamp(56px,8dvh,64px)-env(safe-area-inset-bottom))] px-safe pb-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom))] pt-mobile-safe-top md:min-h-0 md:py-[var(--space-10)] md:pr-[var(--space-14)]">
          <section className="mx-auto w-full max-w-[720px]">
            <h1 className="mb-[var(--space-6)] text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">
              Notificaciones
            </h1>

            <NotificationsFeed
              active={!!user}
              onRead={() => window.dispatchEvent(new CustomEvent("frimee:notifications-read"))}
              onPlanAccepted={(planId) => router.push(`/plans/${planId}`)}
              className="min-h-[320px]"
            />
          </section>
        </main>
      </div>
    </div>
  );
}
