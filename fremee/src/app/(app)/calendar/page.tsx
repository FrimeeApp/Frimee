"use client";

import { Suspense } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import CreatePlanModal, { type CreatePlanDates, type CreatePlanPayload } from "@/components/plans/modals/CreatePlanModal";
import { useCreatePlan } from "@/hooks/useCreatePlan";
import { MisPlanesHome } from "@/components/plans/home/MisPlanesHome";
import { AllPlansView } from "@/components/plans/home/AllPlansView";
import { CalendarView } from "@/components/plans/calendar/CalendarView";
import { dayKey, isCalMode, parseDayKey, type CalMode } from "@/components/plans/calendar/calendarModel";
import type { PlanTab as PlanSectionTab } from "@/components/plans/home/blocks";
import { fetchMisPlanesInicio, type MisPlanesInicio } from "@/services/api/endpoints/misPlanes.endpoint";
import { useAuth } from "@/providers/AuthProvider";
import { clearCachedGoogleProviderToken } from "@/services/auth/googleTokenCache";
import { resolveGoogleProviderToken } from "@/services/auth/googleProviderToken";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { syncGoogleCalendarBidirectional } from "@/services/api/repositories/events.repository";
import { listUserRelatedPlans } from "@/services/api/repositories/plans.repository";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { STORAGE_KEYS } from "@/config/storage";
import { useToast } from "@/components/ui/Toaster";
import { MAX_PINNED_PLANS, planTiming } from "@/components/plans/home/homeSections";


let calendarPlansCache: { userId: string; plans: FeedPlanItemDto[] } | null = null;

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarPageInner />
    </Suspense>
  );
}

function CalendarPageInner() {
  const { user, session, googleProviderToken, settings, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // A plan opens as a layer over this page (@modal); when it closes the path is /calendar again.
  const onCalendar = usePathname() === "/calendar";
  const createFromQuery = searchParams.get("create");
  const navigateToPlan = (id: number) => {
    const appWindow = window as Window & {
      Capacitor?: {
        isNativePlatform?: () => boolean;
      };
    };
    const isCapacitor = typeof window !== "undefined" && !!appWindow.Capacitor?.isNativePlatform?.();
    router.push(isCapacitor ? `/plans/static?id=${id}` : `/plans/${id}`);
  };
  const openPlan = (id: number, tab?: PlanSectionTab, messageId?: number) => {
    if (!tab) return navigateToPlan(id);
    const appWindow = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
    const isCapacitor = !!appWindow.Capacitor?.isNativePlatform?.();
    const q = `tab=${tab}${messageId ? `&m=${messageId}` : ""}`;
    router.push(isCapacitor ? `/plans/static?id=${id}&${q}` : `/plans/${id}?${q}`);
  };
  const view = searchParams.get("vista");
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(() => !calendarPlansCache);

  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [plans, setPlans] = useState<FeedPlanItemDto[]>(() => calendarPlansCache?.plans ?? []);
  const [pinnedPlanIds, setPinnedPlanIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.pinnedPlans);
      return stored ? (JSON.parse(stored) as number[]) : [];
    } catch { return []; }
  });
  const { toast } = useToast();
  const [reloadNonce, setReloadNonce] = useState(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDates, setCreateDates] = useState<CreatePlanDates | undefined>(undefined);
  const [localPlans] = useState<FeedPlanItemDto[]>([]);
  const autoSyncTriggeredRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    autoSyncTriggeredRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (createFromQuery === "1") {
      setCreateModalOpen(true);
    }
  }, [createFromQuery]);

  const togglePin = (planId: number) => {
    const savePins = (next: number[]) => {
      setPinnedPlanIds(next);
      try { localStorage.setItem(STORAGE_KEYS.pinnedPlans, JSON.stringify(next)); } catch { /* noop */ }
    };
    if (pinnedPlanIds.includes(planId)) {
      savePins(pinnedPlanIds.filter((id) => id !== planId));
      return;
    }
    // Only active plans count (and stay stored): a finished or deleted plan frees its place.
    const activeIds = new Set(mergedPlans.filter((p) => planTiming(p).kind !== "finished").map((p) => p.id));
    const activePins = pinnedPlanIds.filter((id) => activeIds.has(id));
    if (activePins.length >= MAX_PINNED_PLANS) {
      toast(`Puedes anclar hasta ${MAX_PINNED_PLANS} planes. Desancla uno para anclar este.`, "info");
      return;
    }
    savePins([...activePins, planId]);
  };

  const openCreate = () => {
    setCreateDates(undefined);
    setCreateModalOpen(true);
  };

  // After creating, useCreatePlan has already gone to the new plan: replacing the URL here would undo it.
  const createdRef = useRef(false);
  const closeCreateModal = () => {
    setCreateModalOpen(false);
    if (createFromQuery === "1" && !createdRef.current) {
      router.replace("/calendar");
    }
    createdRef.current = false;
  };

  const createPlan = useCreatePlan();
  const createPlanFromForm = async (payload: CreatePlanPayload) => {
    const created = await createPlan(payload);
    createdRef.current = true;
    return created;
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setPlans([]);
      setLoading(false);
      hasLoadedOnceRef.current = false;
      calendarPlansCache = null;
      return;
    }

    if (calendarPlansCache?.userId === user.id) {
      setPlans(calendarPlansCache.plans);
      setLoading(false);
      hasLoadedOnceRef.current = true;
    } else if (calendarPlansCache) {
      calendarPlansCache = null;
      setPlans([]);
      hasLoadedOnceRef.current = false;
    }

    let cancelled = false;

    const load = async () => {
      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      }
      try {
        const plansResult = await listUserRelatedPlans({ userId: user.id, limit: 300 });

        if (cancelled) return;
        setPlans(plansResult);
        calendarPlansCache = { userId: user.id, plans: plansResult };
        hasLoadedOnceRef.current = true;
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof Error) {
          console.error("[calendar] error loading calendar data", {
            message: loadError.message,
            name: loadError.name,
          });
        } else {
          const e = loadError as Record<string, unknown>;
          console.error("[calendar] error loading calendar data", {
            message: e?.message,
            code: e?.code,
            details: e?.details,
            hint: e?.hint,
            raw: String(loadError),
          });
        }
        setPlans([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, reloadNonce]);

  const runGoogleSync = useCallback(async () => {
    if (!user?.id || syncingGoogle) return;
    const providerToken = await resolveGoogleProviderToken({
      supabase,
      session,
      userId: user.id,
      cachedToken: googleProviderToken,
    });

    if (!providerToken) return;

    setSyncingGoogle(true);
    console.log("[google-sync] Iniciando sincronización con Google Calendar...");

    try {
      const timeMin = startOfMonth(addMonths(new Date(), -12)).toISOString();
      const timeMax = endOfMonth(addMonths(new Date(), 12)).toISOString();
      await syncGoogleCalendarBidirectional({
        userId: user.id,
        accessToken: providerToken,
        timeMin,
        timeMax,
        plans,
        googleSyncEnabled: settings?.google_sync_enabled,
        googleSyncExportPlans: settings?.google_sync_export_plans,
      });
      console.log("[google-sync] Sincronización completada.");
      setReloadNonce((prev) => prev + 1);
    } catch (syncError) {
      if (syncError instanceof Error) {
        const message = syncError.message;
        const isGoogle401 = message.includes("[google-calendar] 401");
        const isGoogle403 = message.includes("[google-calendar] 403");
        if (isGoogle401 || isGoogle403) {
          if (user?.id) clearCachedGoogleProviderToken(user.id);
          console.log("[google-sync] Token expirado (401/403) — se intentará renovar en próxima sync.");
        } else {
          console.log("[google-sync] Error en sincronización:", message);
        }
      } else {
        console.log("[google-sync] Error en sincronización:", syncError);
      }
    } finally {
      setSyncingGoogle(false);
    }
  }, [
    googleProviderToken,
    plans,
    session,
    settings?.google_sync_enabled,
    settings?.google_sync_export_plans,
    syncingGoogle,
    supabase,
    user?.id,
  ]);


  useEffect(() => {
    if (authLoading || loading) return;
    if (!user?.id) return;
    if (!settings?.google_sync_enabled) return;
    if (autoSyncTriggeredRef.current) return;

    autoSyncTriggeredRef.current = true;
    void runGoogleSync();
  }, [authLoading, loading, runGoogleSync, settings?.google_sync_enabled, user?.id]);

  const [inicio, setInicio] = useState<MisPlanesInicio | null>(null);
  // Members, unread, open polls, today's activities and invitations (step 2.34). The home works without it.
  useEffect(() => {
    if (authLoading || !user?.id || !onCalendar) return;
    let cancelled = false;
    fetchMisPlanesInicio()
      .then((data) => {
        if (!cancelled) setInicio(data);
      })
      .catch((error: unknown) => {
        const e = error as { message?: string; code?: string };
        console.error("[mis-planes] inicio", e?.code, e?.message ?? String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, reloadNonce, plans, onCalendar]);
  const inicioExtras = useMemo(() => new Map((inicio?.planes ?? []).map((e) => [e.plan_id, e])), [inicio]);

  const mergedPlans = useMemo(() => {
    return [...localPlans, ...plans];
  }, [localPlans, plans]);

  const calMode: CalMode = (() => {
    const m = searchParams.get("modo");
    return isCalMode(m) ? m : "mes";
  })();
  const calKey = searchParams.get("fecha");
  const calDate = useMemo(() => parseDayKey(calKey) ?? new Date(), [calKey]);

  if (authLoading) return <LoadingScreen />;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar onCreatePlan={openCreate} />

        <main
          className="min-h-[calc(100dvh-env(safe-area-inset-top)-clamp(56px,8dvh,64px)-env(safe-area-inset-bottom))] pb-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-mobile-safe-top md:min-h-0 md:pb-0 md:pl-[136px] md:pr-12 md:pt-9"
        >
          <div className="mx-auto w-full max-w-[1280px]">
            {loading ? (
              <PlanListSkeleton />
            ) : view === "calendario" ? (
              <CalendarView
                plans={mergedPlans}
                mode={calMode}
                date={calDate}
                onChange={(m, d) => router.replace(`/calendar?vista=calendario&modo=${m}&fecha=${dayKey(d)}`, { scroll: false })}
                onBack={() => router.replace("/calendar")}
                onOpen={openPlan}
                onCreate={(from, to) => {
                  setCreateDates({ startDate: dayKey(from), endDate: dayKey(to) });
                  setCreateModalOpen(true);
                }}
              />
            ) : view === "todos" ? (
              <AllPlansView
                plans={mergedPlans}
                extras={inicioExtras}
                pinnedIds={pinnedPlanIds}
                onTogglePin={togglePin}
                onOpen={openPlan}
                onBack={() => router.replace("/calendar")}
                onCreate={openCreate}
                userId={user?.id}
                initialFilter={searchParams.get("filtro") === "finalizados" ? "finished" : "all"}
                initialQuery={searchParams.get("q") ?? ""}
              />
            ) : (
              <MisPlanesHome
                plans={mergedPlans}
                inicio={inicio}
                pinnedIds={pinnedPlanIds}
                onTogglePin={togglePin}
                onOpen={openPlan}
                onCreate={openCreate}
                onOpenCalendar={() => router.push("/calendar?vista=calendario")}
                onOpenAll={(opts) => {
                  const qs = new URLSearchParams({ vista: "todos" });
                  if (opts?.finished) qs.set("filtro", "finalizados");
                  if (opts?.query) qs.set("q", opts.query);
                  router.push(`/calendar?${qs.toString()}`);
                }}
                onOpenInvitations={() => router.push("/notifications")}
                userId={user?.id}
                isGuest={Boolean(user?.is_anonymous)}
              />
            )}
          </div>
        </main>
      </div>

      <CreatePlanModal open={createModalOpen} onClose={closeCreateModal} onCreate={createPlanFromForm} currentUserId={user?.id} initialDates={createDates} />
    </div>
  );
}

function PlanListSkeleton() {
  return (
    <div className="space-y-[var(--space-4)]" aria-label="Cargando planes" role="status">
      <div className="skeleton-shimmer h-[150px] w-full rounded-card" />

      <div className="grid grid-cols-1 gap-[var(--space-3)] md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton-shimmer size-[64px] shrink-0 rounded-card" />
            <div className="skeleton-shimmer h-[14px] w-[150px] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
