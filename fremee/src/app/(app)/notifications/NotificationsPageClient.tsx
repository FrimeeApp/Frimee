"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { NotificationsFeed } from "@/components/notifications/NotificationsFeed";
import { useAuth } from "@/providers/AuthProvider";

const NOTIFICATIONS_ROUTE_TRANSITION_MS = 260;
const NOTIFICATIONS_SWIPE_EDGE_PX = 32;
const NOTIFICATIONS_SWIPE_TRIGGER_PX = 88;

type NotificationsPageClientProps = {
  presentation?: "page" | "overlay";
};

export default function NotificationsPageClient({ presentation = "page" }: NotificationsPageClientProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isOverlayPresentation = presentation === "overlay";
  const [routeEntered, setRouteEntered] = useState(false);
  const [routeClosing, setRouteClosing] = useState(false);
  const [routeDragOffset, setRouteDragOffset] = useState(0);
  const [routeDragging, setRouteDragging] = useState(false);
  const routeCloseTimeoutRef = useRef<number | null>(null);
  const routeDragStartRef = useRef<{ x: number; y: number; active: boolean } | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setRouteEntered(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!isOverlayPresentation) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.setAttribute("data-notifications-open", "true");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.removeAttribute("data-notifications-open");
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [isOverlayPresentation]);

  useEffect(() => {
    return () => {
      if (routeCloseTimeoutRef.current !== null) {
        window.clearTimeout(routeCloseTimeoutRef.current);
      }
    };
  }, []);

  const closeRoute = () => {
    if (routeClosing) return;
    setRouteClosing(true);
    setRouteDragging(false);
    setRouteDragOffset(0);

    if (routeCloseTimeoutRef.current !== null) {
      window.clearTimeout(routeCloseTimeoutRef.current);
    }

    routeCloseTimeoutRef.current = window.setTimeout(() => {
      router.back();
    }, NOTIFICATIONS_ROUTE_TRANSITION_MS);
  };

  const handleRoutePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    if (event.clientX > NOTIFICATIONS_SWIPE_EDGE_PX) return;
    routeDragStartRef.current = { x: event.clientX, y: event.clientY, active: true };
    setRouteDragging(true);
  };

  const handleRoutePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = routeDragStartRef.current;
    if (!start?.active) return;

    const deltaX = Math.max(0, event.clientX - start.x);
    const deltaY = Math.abs(event.clientY - start.y);
    if (deltaX < 8 && deltaY > 12) {
      routeDragStartRef.current = null;
      setRouteDragging(false);
      setRouteDragOffset(0);
      return;
    }

    event.preventDefault();
    setRouteDragOffset(Math.min(deltaX, window.innerWidth));
  };

  const handleRoutePointerEnd = () => {
    const shouldClose = routeDragOffset >= NOTIFICATIONS_SWIPE_TRIGGER_PX;
    routeDragStartRef.current = null;
    setRouteDragging(false);

    if (shouldClose) {
      closeRoute();
      return;
    }

    setRouteDragOffset(0);
  };

  const routeTransform = routeClosing
    ? "translate3d(100%,0,0)"
    : routeDragging && routeDragOffset > 0
      ? `translate3d(${routeDragOffset}px,0,0)`
      : routeEntered
        ? "none"
        : "translate3d(100%,0,0)";
  const routeTransition = routeDragging
    ? "none"
    : `transform ${NOTIFICATIONS_ROUTE_TRANSITION_MS}ms var(--ease-standard)`;
  const routeIsMoving = !routeEntered || routeClosing || routeDragging;
  const routeMotionProps = {
    style: { transform: routeTransform, transition: routeTransition, touchAction: "pan-y" },
    onPointerDown: handleRoutePointerDown,
    onPointerMove: handleRoutePointerMove,
    onPointerUp: handleRoutePointerEnd,
    onPointerCancel: handleRoutePointerEnd,
  };
  const routeContainerClass = isOverlayPresentation
    ? "fixed inset-0 z-[1200] h-dvh overflow-y-auto overscroll-contain scrollbar-overlay-subtle"
    : "relative z-[1] min-h-dvh";

  if (authLoading) {
    return (
      <div className={`${routeContainerClass} bg-app ${routeIsMoving ? "will-change-transform" : ""}`} {...routeMotionProps}>
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className={`${routeContainerClass} bg-app text-app ${routeIsMoving ? "will-change-transform" : ""}`} {...routeMotionProps}>
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar hideMobileNav={isOverlayPresentation} />

        <main className="min-h-[calc(100dvh-env(safe-area-inset-top)-clamp(56px,8dvh,64px)-env(safe-area-inset-bottom))] px-safe pb-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom))] pt-mobile-safe-top md:min-h-0 md:py-[var(--space-10)] md:pr-[var(--space-14)]">
          <section className="mx-auto w-full max-w-[860px]">
            <div className="mb-[var(--space-6)] flex items-center gap-[var(--space-3)]">
              <button
                type="button"
                onClick={closeRoute}
                aria-label="Volver"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-app transition-colors hover:bg-surface"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <h1 className="text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">
                Notificaciones
              </h1>
            </div>

            <NotificationsFeed
              active={!!user}
              onRead={() => window.dispatchEvent(new CustomEvent("frimee:notifications-read"))}
              onPlanAccepted={(planId) => router.push(`/plans/${planId}`)}
              className="min-h-[320px]"
              edgePadding="none"
            />
          </section>
        </main>
      </div>
    </div>
  );
}
