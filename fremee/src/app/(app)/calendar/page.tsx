"use client";

import { Suspense } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import CreatePlanModal, { type CreatePlanPayload } from "@/components/plans/CreatePlanModal";
import { useAuth } from "@/providers/AuthProvider";
import { clearCachedGoogleProviderToken } from "@/services/auth/googleTokenCache";
import { resolveGoogleProviderToken } from "@/services/auth/googleProviderToken";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { syncGoogleCalendarBidirectional } from "@/services/api/repositories/events.repository";
import { createPlan, listPlansByIdsInOrder, listUserRelatedPlans } from "@/services/api/repositories/plans.repository";
import { publishPlanAsPost } from "@/services/api/repositories/post.repository";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

type PlanTab = "active" | "done";
type CalendarViewMode = "month" | "day";

type CalendarCell = {
  key: string;
  date: Date;
  day: number;
  isCurrentMonth: boolean;
};

type CalendarWeek = {
  key: string;
  days: CalendarCell[];
};

type WeekPlanSegment = {
  key: string;
  planId: number;
  title: string;
  startCol: number;
  endCol: number;
  isStart: boolean;
  isEnd: boolean;
};

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const WEEK_DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarPageInner />
    </Suspense>
  );
}

function CalendarPageInner() {
  const { user, session, googleProviderToken, settings, loading: authLoading, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const createFromQuery = searchParams.get("create");
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);

  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [needsGoogleReconnect, setNeedsGoogleReconnect] = useState(false);
  const [plans, setPlans] = useState<FeedPlanItemDto[]>([]);
  const [tab, setTab] = useState<PlanTab>("active");
  const [planSearch, setPlanSearch] = useState("");
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [pinnedPlanIds, setPinnedPlanIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem("frimee:pinnedPlans");
      return stored ? (JSON.parse(stored) as number[]) : [];
    } catch { return []; }
  });
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const doneTabRef = useRef<HTMLButtonElement | null>(null);
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, ready: false });
  const [reloadNonce, setReloadNonce] = useState(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [localPlans] = useState<FeedPlanItemDto[]>([]);
  const autoSyncTriggeredRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    autoSyncTriggeredRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    const updateIndicator = () => {
      const row = tabRowRef.current;
      const target = tab === "active" ? activeTabRef.current : doneTabRef.current;
      if (!row || !target) return;
      const rowRect = row.getBoundingClientRect();
      const tabRect = target.getBoundingClientRect();
      setTabIndicator({ left: tabRect.left - rowRect.left, width: tabRect.width, ready: true });
    };
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [tab]);

  useEffect(() => {
    if (createFromQuery === "1") {
      setCreateModalOpen(true);
    }
  }, [createFromQuery]);

  useEffect(() => {
    const handleScroll = () => {
      const isMobile = window.innerWidth < 1024;
      if (isMobile && viewMode === "day") return;
      if (window.scrollY > 60) {
        setCalendarOpen(false);
      } else if (window.scrollY < 10) {
        setCalendarOpen(true);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [viewMode]);

  const togglePin = (planId: number) => {
    setPinnedPlanIds((prev) => {
      const next = prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : prev.length < 3 ? [...prev, planId] : prev;
      try { localStorage.setItem("frimee:pinnedPlans", JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    if (createFromQuery === "1") {
      router.replace("/calendar");
    }
  };

  const [savingPlan, setSavingPlan] = useState(false);

  const handleCreatePlan = async (payload: CreatePlanPayload) => {
    if (!user?.id || savingPlan) return;

    setSavingPlan(true);

    try {
      let coverUrl: string | null = null;

      if (payload.coverFile) {
        const { uploadPlanCoverFile } = await import("@/services/firebase/upload");
        const { downloadUrl } = await uploadPlanCoverFile({ file: payload.coverFile, userId: user.id });
        coverUrl = downloadUrl;
      }

      const startIso = dateInputToIso(payload.startDate, 10);
      const endIso = dateInputToIso(payload.endDate, 18);

      const created = await createPlan({
        titulo: payload.title,
        descripcion: `Plan en ${payload.location}`,
        inicioAt: startIso,
        finAt: endIso,
        ubicacionNombre: payload.location,
        fotoPortada: coverUrl,
        allDay: true,
        visibilidad: payload.visibility,
        ownerUserId: user.id,
        creadoPorUserId: user.id,
      });

      try {
        await publishPlanAsPost({
          id: created.id,
          title: payload.title,
          description: `Plan en ${payload.location}`,
          locationName: payload.location,
          startsAt: startIso,
          endsAt: endIso,
          allDay: true,
          visibility: payload.visibility,
          coverImage: coverUrl,
          ownerUserId: user.id,
          creator: {
            id: user.id,
            name: profile?.nombre ?? "",
            profileImage: profile?.profile_image ?? null,
          },
        });
      } catch (publishErr) {
        console.warn("[calendar] publish to firebase error:", publishErr);
      }

      if (settings?.google_sync_enabled && settings.google_sync_export_plans) {
        try {
          const providerToken = await resolveGoogleProviderToken({
            supabase,
            session,
            userId: user.id,
            cachedToken: googleProviderToken,
          });
          if (providerToken) {
            const [createdPlan] = await listPlansByIdsInOrder([created.id]);
            if (createdPlan) {
              const timeMin = startOfMonth(addMonths(new Date(), -12)).toISOString();
              const timeMax = endOfMonth(addMonths(new Date(), 12)).toISOString();
              await syncGoogleCalendarBidirectional({
                userId: user.id,
                accessToken: providerToken,
                timeMin,
                timeMax,
                plans: [createdPlan],
                googleSyncEnabled: settings.google_sync_enabled,
                googleSyncExportPlans: settings.google_sync_export_plans,
              });
            }
          }
        } catch (syncErr) {
          console.warn("[calendar] google sync after create failed:", syncErr);
        }
      }

      setReloadNonce((prev) => prev + 1);
      setSavingPlan(false);
      closeCreateModal();
    } catch (err) {
      console.error("[calendar] create plan error:", err);
      setSavingPlan(false);
      throw err;
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setPlans([]);
      setLoading(false);
      setBackgroundRefreshing(false);
      hasLoadedOnceRef.current = false;
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (hasLoadedOnceRef.current) {
        setBackgroundRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const plansResult = await listUserRelatedPlans({ userId: user.id, limit: 300 });

        if (cancelled) return;
        setPlans(plansResult);
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
          setBackgroundRefreshing(false);
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

    if (!providerToken) {
      setNeedsGoogleReconnect(true);
      return;
    }
    setNeedsGoogleReconnect(false);

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

  const reconnectGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "https://www.googleapis.com/auth/calendar",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }, [supabase]);

  useEffect(() => {
    if (authLoading || loading) return;
    if (!user?.id) return;
    if (!settings?.google_sync_enabled) return;
    if (autoSyncTriggeredRef.current) return;

    autoSyncTriggeredRef.current = true;
    void runGoogleSync();
  }, [authLoading, loading, runGoogleSync, settings?.google_sync_enabled, user?.id]);

  const mergedPlans = useMemo(() => {
    return [...localPlans, ...plans];
  }, [localPlans, plans]);

  const visiblePlans = useMemo(() => {
    const startToday = startOfDay(new Date());
    return mergedPlans.filter((plan) => {
      const endsAt = new Date(plan.endsAt);
      return tab === "active" ? endsAt >= startToday : endsAt < startToday;
    });
  }, [mergedPlans, tab]);

  const filteredPlans = useMemo(() => {
    const query = planSearch.trim().toLowerCase();
    if (!query) return visiblePlans;
    return visiblePlans.filter((plan) => plan.title.toLowerCase().includes(query));
  }, [visiblePlans, planSearch]);

  const calendarCells = useMemo(() => buildCalendarCells(monthDate), [monthDate]);
  const calendarWeeks = useMemo(() => groupCalendarWeeks(calendarCells), [calendarCells]);

  const weekSegments = useMemo(
    () => calendarWeeks.map((week) => buildWeekPlanRows(week, filteredPlans)),
    [calendarWeeks, filteredPlans],
  );
  const selectedDayValue = useMemo(() => selectedDay ?? startOfDay(new Date()), [selectedDay]);
  const selectedDayPlans = useMemo(
    () =>
      filteredPlans
        .filter((plan) => rangesOverlap(new Date(plan.startsAt), new Date(plan.endsAt), startOfDay(selectedDayValue), endOfDay(selectedDayValue)))
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [filteredPlans, selectedDayValue],
  );
  const timedDayPlans = useMemo(
    () => selectedDayPlans.filter((plan) => !plan.allDay),
    [selectedDayPlans],
  );
  const allDayPlans = useMemo(
    () => selectedDayPlans.filter((plan) => plan.allDay),
    [selectedDayPlans],
  );

  const monthLabel = `${MONTHS_SHORT[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  if (authLoading) return <LoadingScreen />;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar onCreatePlan={() => setCreateModalOpen(true)} />

        <main
          className={`px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] md:py-[var(--space-8)] md:pr-[var(--space-14)]`}
        >
          <div className="mx-auto w-full max-w-[1120px]">
            <div className="border-b border-app text-body text-muted">
              <div className="flex flex-wrap items-end justify-between gap-[var(--space-3)]">
                <div ref={tabRowRef} className="relative flex items-center gap-[var(--space-10)]">
                  <button
                    ref={activeTabRef}
                    type="button"
                    onClick={() => setTab("active")}
                    className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                      tab === "active" ? "text-app" : "hover:text-app"
                    }`}
                  >
                    Activos
                  </button>
                  <button
                    ref={doneTabRef}
                    type="button"
                    onClick={() => setTab("done")}
                    className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                      tab === "done" ? "text-app" : "hover:text-app"
                    }`}
                  >
                    Finalizados
                  </button>
                  <span
                    className={`pointer-events-none absolute bottom-0 h-[2px] bg-black transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] dark:bg-white ${
                      tabIndicator.ready ? "opacity-100" : "opacity-0"
                    }`}
                    style={{ left: tabIndicator.left, width: tabIndicator.width }}
                    aria-hidden="true"
                  />
                </div>

                {needsGoogleReconnect && settings?.google_sync_enabled ? (
                  <button
                    type="button"
                    onClick={() => void reconnectGoogle()}
                    className="flex items-center gap-1.5 rounded-button border border-warning/40 bg-warning/10 px-3 py-1.5 text-body-sm text-warning transition-colors hover:bg-warning/20"
                  >
                    <span>⚠</span>
                    Reconectar Google Calendar
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-[var(--space-5)] grid grid-cols-1 gap-[var(--space-6)] md:grid-cols-[minmax(0,1fr)_320px] md:gap-[var(--space-8)]">
              {loading ? (
                <CalendarPageSkeleton />
              ) : (
                <>
                  <aside className={`md:col-start-2 md:row-start-1 flex flex-col rounded-modal border border-app bg-surface shadow-elev-1 md:sticky md:top-[var(--space-6)] md:self-start transition-all duration-300 ${calendarOpen ? (viewMode === "day" ? "h-[380px] md:h-[420px]" : "md:h-[420px]") : "md:h-auto"}`}>
                    <div className={`min-h-0 flex-1 overflow-hidden p-[var(--space-4)] ${calendarOpen ? "block" : "hidden"}`}>
                    {viewMode === "month" ? (
                      <>
                        <div className="mb-[var(--space-2)] flex items-center justify-between">
                          <button
                            type="button"
                            aria-label="Mes anterior"
                            onClick={() => setMonthDate((prev) => addMonths(prev, -1))}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-app transition-colors hover:border-primary-token hover:text-primary-token"
                          >
                            <span className="inline-block rotate-180 text-[13px] leading-none">✈</span>
                          </button>
                          <div className="text-body-sm font-[var(--fw-medium)]">{monthLabel}</div>
                          <button
                            type="button"
                            aria-label="Mes siguiente"
                            onClick={() => setMonthDate((prev) => addMonths(prev, 1))}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-app transition-colors hover:border-primary-token hover:text-primary-token"
                          >
                            <span className="inline-block text-[13px] leading-none">✈</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-x-1 gap-y-2 border-b border-app/70 pb-2 text-center">
                          {WEEK_DAYS.map((weekDay) => (
                            <div key={weekDay} className="text-[11px] text-muted">
                              {weekDay}
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 space-y-1">
                          {calendarWeeks.map((week, weekIndex) => (
                            <div key={week.key} className="relative h-[48px] p-1.5">
                              <div className="grid grid-cols-7 gap-x-1">
                                {week.days.map((cell) => {
                                  const isToday = toDayKey(cell.date) === toDayKey(new Date());
                                  return (
                                    <button
                                      type="button"
                                      key={cell.key}
                                      onClick={() => {
                                        setSelectedDay(startOfDay(cell.date));
                                        setMonthDate(startOfMonth(cell.date));
                                        setViewMode("day");
                                      }}
                                      className={`flex h-7 items-center justify-center text-body-sm transition-colors ${
                                        cell.isCurrentMonth ? "text-app" : "text-tertiary"
                                      } ${isToday ? "rounded-full bg-[#E8841A] font-[var(--fw-semibold)] text-white" : "hover:bg-app/50"}`}
                                    >
                                      {cell.day}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-1 space-y-0.5">
                                {[0, 1].map((laneIndex) => {
                                  const lane = weekSegments[weekIndex]?.lanes[laneIndex] ?? [];
                                  return (
                                    <div key={`${week.key}-lane-${laneIndex}`} className="grid grid-cols-7 gap-x-1">
                                      {lane.length
                                        ? lane.map((segment) => (
                                            <div
                                              key={segment.key}
                                              className="h-3 cursor-pointer rounded-full bg-[linear-gradient(90deg,#cc37b0_0%,#f06ebc_100%)] px-1.5 text-[8px] font-[var(--fw-semibold)] leading-[12px] text-white transition-opacity hover:opacity-90"
                                              style={{
                                                gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                                              }}
                                              title={segment.title}
                                              onClick={() => router.push(`/plans/${segment.planId}`)}
                                            >
                                              <span className="block truncate">{segment.title}</span>
                                            </div>
                                          ))
                                        : <div className="h-3" aria-hidden="true" />}
                                    </div>
                                  );
                                })}
                              </div>

                              {weekSegments[weekIndex]?.hiddenCount ? (
                                <p className="pointer-events-none absolute bottom-0 right-1.5 text-[9px] leading-none text-muted">
                                  +{weekSegments[weekIndex].hiddenCount}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full min-h-0 flex-col">
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMonthDate(startOfMonth(selectedDayValue));
                              setViewMode("month");
                            }}
                            className="flex items-center gap-1 rounded-full border border-app py-1 pl-2 pr-3 text-body-sm font-[var(--fw-medium)] text-muted transition-colors hover:text-app"
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="size-[14px]" aria-hidden="true">
                              <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {selectedDayValue.toLocaleDateString("es-ES", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())}
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Dia anterior"
                              onClick={() => {
                                const nextDay = addDays(selectedDayValue, -1);
                                setSelectedDay(nextDay);
                                setMonthDate(startOfMonth(nextDay));
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-app text-muted transition-colors hover:text-app"
                            >
                              <svg viewBox="0 0 24 24" fill="none" className="size-[14px]" aria-hidden="true">
                                <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDay(startOfDay(new Date()));
                                setMonthDate(startOfMonth(new Date()));
                              }}
                              className="rounded-full border border-app px-3 py-1 text-body-sm font-[var(--fw-medium)]"
                            >
                              Hoy
                            </button>
                            <button
                              type="button"
                              aria-label="Dia siguiente"
                              onClick={() => {
                                const nextDay = addDays(selectedDayValue, 1);
                                setSelectedDay(nextDay);
                                setMonthDate(startOfMonth(nextDay));
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-app text-muted transition-colors hover:text-app"
                            >
                              <svg viewBox="0 0 24 24" fill="none" className="size-[14px]" aria-hidden="true">
                                <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <h3 className="mb-4 text-[var(--font-h2)] font-[var(--fw-bold)] leading-[var(--lh-h2)] text-app">
                          {formatDayHeading(selectedDayValue)}
                        </h3>

                        {allDayPlans.length ? (
                          <div className="mb-4 space-y-2">
                            {allDayPlans.map((plan) => (
                              <div
                                key={`all-day-${plan.id}`}
                                className="rounded-full bg-[linear-gradient(90deg,#cc37b0_0%,#f06ebc_100%)] px-3 py-1.5 text-body-sm font-[var(--fw-medium)] text-white"
                              >
                                <span className="block truncate">{plan.title}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1">
                          <div className="relative">
                            {Array.from({ length: 24 }).map((_, hour) => (
                              <div key={`hour-${hour}`} className="grid h-16 grid-cols-[52px_minmax(0,1fr)]">
                                <div className="pr-2 pt-1 text-right text-[11px] text-muted">
                                  {String(hour).padStart(2, "0")}:00
                                </div>
                                <div className="border-t border-app/60" />
                              </div>
                            ))}

                            <div className="pointer-events-none absolute inset-y-0 left-[60px] right-0">
                              {timedDayPlans.map((plan) => {
                                const startMinutes = getMinutesWithinDay(plan.startsAt, selectedDayValue);
                                const endMinutes = getMinutesWithinDay(plan.endsAt, selectedDayValue, true);
                                const duration = Math.max(endMinutes - startMinutes, 30);

                                return (
                                  <div
                                    key={`day-plan-${plan.id}`}
                                    className="absolute left-2 right-2 cursor-pointer overflow-hidden rounded-[12px] bg-[linear-gradient(90deg,#cc37b0_0%,#f06ebc_100%)] px-3 py-2 text-white shadow-sm transition-opacity hover:opacity-90"
                                    style={{
                                      top: `${(startMinutes / 60) * 64}px`,
                                      height: `${Math.max((duration / 60) * 64, 24)}px`,
                                    }}
                                    title={plan.title}
                                    onClick={() => router.push(`/plans/${plan.id}`)}
                                  >
                                    <p className="truncate text-body-sm font-[var(--fw-semibold)]">{plan.title}</p>
                                    <p className="mt-0.5 truncate text-[11px] text-white/90">
                                      {formatTimeRange(
                                        clampDateTimeToDay(plan.startsAt, selectedDayValue).toISOString(),
                                        clampDateTimeToDay(plan.endsAt, selectedDayValue, true).toISOString(),
                                      )}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    </div>

                    {!calendarOpen && (
                      <div className="hidden border-t border-app/50 px-[var(--space-3)] pb-[var(--space-3)] md:block">
                        {pinnedPlanIds.length === 0 ? (
                          <p className="pt-[var(--space-3)] text-center text-[11px] text-muted">
                            Ancla hasta 3 planes con 📌
                          </p>
                        ) : (
                          <div className="space-y-2 pt-[var(--space-2)]">
                            {mergedPlans
                              .filter((p) => pinnedPlanIds.includes(p.id))
                              .map((p) => (
                                <div
                                  key={`pinboard-${p.id}`}
                                  className="group relative flex cursor-pointer overflow-hidden rounded-[10px] border border-app bg-app transition-shadow hover:shadow-elev-1"
                                  onClick={() => router.push(`/plans/${p.id}`)}
                                >
                                  <div
                                    className="h-12 w-12 shrink-0 bg-cover bg-center"
                                    style={{ backgroundImage: `url(${p.coverImage ?? "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=400&q=60"})` }}
                                  />
                                  <div className="min-w-0 flex-1 px-3 py-2">
                                    <p className="truncate text-[12px] font-[var(--fw-medium)] text-app">{p.title}</p>
                                    <p className="mt-0.5 truncate text-[10px] text-muted">{formatDateRange(p.startsAt, p.endsAt)}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); togglePin(p.id); }}
                                    aria-label="Desanclar"
                                    className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </aside>

                  <section className="space-y-[var(--space-4)] md:col-start-1 md:row-start-1">
                    <div className="relative">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-[16px] -translate-y-1/2 text-muted">
                        <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      <input
                        type="text"
                        value={planSearch}
                        onChange={(e) => setPlanSearch(e.target.value)}
                        placeholder="Buscar plan"
                        className="w-full rounded-full border border-app bg-surface py-[7px] pl-9 pr-8 text-body-sm text-app outline-none transition-colors focus:border-[var(--border-strong)] [&::-webkit-search-cancel-button]:hidden"
                      />
                      {planSearch && (
                        <button type="button" onClick={() => setPlanSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[14px]">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {filteredPlans.length === 0 ? (
                      <p className="text-body-sm text-muted">
                        {planSearch.trim()
                          ? "No hay planes con ese nombre."
                          : "No hay planes para mostrar."}
                      </p>
                    ) : null}

                    <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                      {filteredPlans.map((plan) => {
                        const creatorLabel = plan.creator.id === user?.id ? "Creado por ti" : `De ${plan.creator.name}`;
                        const scheduleLabel = formatPlanSchedule(plan);
                        const statusLabel = tab === "active" ? "Activo" : "Finalizado";
                        const statusClass =
                          tab === "active"
                            ? "border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_20%,transparent_80%)] text-success-token"
                            : "border-app bg-surface/90 text-muted";

                        return (
                          <article
                            key={`plan-${plan.id}`}
                            className="group flex cursor-pointer flex-row overflow-hidden rounded-[14px] border border-app bg-surface shadow-elev-1 transition-shadow hover:shadow-elev-2 lg:flex-col"
                            onClick={() => router.push(`/plans/${plan.id}`)}
                          >
                            <div
                              className="relative h-auto min-h-[90px] w-[90px] shrink-0 bg-cover bg-center bg-no-repeat sm:w-[110px] lg:h-[138px] lg:w-full"
                              role="img"
                              aria-label={plan.title}
                              style={{
                                backgroundImage: `url(${plan.coverImage ?? "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80"})`,
                              }}
                            >
                              <span
                                className={`absolute right-3 top-3 hidden rounded-chip border px-2.5 py-1 text-[11px] font-[var(--fw-medium)] leading-none lg:inline-flex ${statusClass}`}
                              >
                                {statusLabel}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); togglePin(plan.id); }}
                                aria-label={pinnedPlanIds.includes(plan.id) ? "Desanclar" : "Anclar"}
                                className={`absolute left-3 top-3 hidden h-7 w-7 items-center justify-center rounded-full text-[13px] shadow-sm transition-opacity lg:flex ${
                                  pinnedPlanIds.includes(plan.id)
                                    ? "bg-warning-token/90 opacity-100"
                                    : "bg-white/80 opacity-0 group-hover:opacity-100"
                                }`}
                              >
                                📌
                              </button>
                            </div>

                            <div className="flex min-w-0 flex-1 items-center justify-between gap-2 p-[var(--space-3)] lg:items-end lg:p-[var(--space-4)]">
                              <div className="min-w-0">
                                <h2 className="truncate text-body-sm font-[var(--fw-semibold)] leading-[1.2] text-app lg:text-[22px] lg:font-[var(--fw-medium)] lg:leading-[1.15]">
                                  {plan.title}
                                </h2>
                                <p className="mt-0.5 text-caption text-muted lg:mt-1 lg:text-body-sm">{formatDateRange(plan.startsAt, plan.endsAt)}</p>
                                <p className="mt-0.5 truncate text-caption text-tertiary lg:mt-1">{creatorLabel}</p>
                              </div>

                              <span className={`shrink-0 rounded-chip border px-2 py-1 text-[10px] font-[var(--fw-medium)] leading-none lg:rounded-[10px] lg:px-3 lg:py-2 lg:text-[12px] ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      <CreatePlanModal open={createModalOpen} onClose={closeCreateModal} onCreate={handleCreatePlan} />
    </div>
  );
}

function CalendarPageSkeleton() {
  return (
    <>
      <section className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="overflow-hidden rounded-[14px] border border-app bg-surface shadow-elev-1">
            <div className="feed-skeleton-shimmer h-[138px] w-full" />
            <div className="flex items-end justify-between gap-3 p-[var(--space-4)]">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="feed-skeleton-shimmer h-7 w-[62%] rounded-full" />
                <div className="feed-skeleton-shimmer h-4 w-[48%] rounded-full" />
                <div className="feed-skeleton-shimmer h-3 w-[34%] rounded-full" />
              </div>
              <div className="feed-skeleton-shimmer h-10 w-24 rounded-[10px]" />
            </div>
          </article>
        ))}
      </section>

      <aside
        className="overflow-hidden rounded-modal border border-app bg-surface p-[var(--space-4)] shadow-elev-1 lg:sticky lg:top-[var(--space-6)] lg:self-start"
        aria-hidden="true"
      >
        <div className="mb-[var(--space-2)] flex items-center justify-between">
          <div className="feed-skeleton-shimmer h-8 w-10 rounded-input" />
          <div className="feed-skeleton-shimmer h-4 w-24 rounded-full" />
          <div className="feed-skeleton-shimmer h-8 w-10 rounded-input" />
        </div>

        <div className="grid grid-cols-7 gap-x-1 gap-y-2 text-center">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={`calendar-head-${index}`} className="feed-skeleton-shimmer mx-auto h-3 w-5 rounded-full" />
          ))}
        </div>

        <div className="mt-2 space-y-1">
          {Array.from({ length: 5 }).map((_, weekIndex) => (
            <div key={`calendar-week-${weekIndex}`} className="h-[48px] p-1.5">
              <div className="grid grid-cols-7 gap-x-1">
                {Array.from({ length: 7 }).map((__, dayIndex) => (
                  <div key={`calendar-day-${weekIndex}-${dayIndex}`} className="feed-skeleton-shimmer h-7" />
                ))}
              </div>
              <div className="mt-1 space-y-0.5">
                <div className="grid grid-cols-7 gap-x-1">
                  <div className="feed-skeleton-shimmer col-span-4 h-3 rounded-full" />
                </div>
                <div className="grid grid-cols-7 gap-x-1">
                  <div className="feed-skeleton-shimmer col-span-3 h-3 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
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

function dateInputToIso(dateInput: string, hour = 12) {
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hour, 0, 0).toISOString();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function toDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && aEnd >= bStart;
}

function formatDateRange(startsAtIso: string, endsAtIso: string) {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(endsAtIso);
  const startDate = startsAt.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  const endDate = endsAt.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  return `${startDate} - ${endDate}`;
}

function formatPlanSchedule(plan: FeedPlanItemDto) {
  if (plan.allDay) return "Todo el dia";
  return formatTimeRange(plan.startsAt, plan.endsAt);
}

function formatTimeRange(startsAtIso: string, endsAtIso: string) {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(endsAtIso);
  const startTime = startsAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const endTime = endsAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${startTime} - ${endTime}`;
}

function formatDayHeading(date: Date) {
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWeekdayShort(date: Date) {
  return date
    .toLocaleDateString("es-ES", { weekday: "short" })
    .replace(".", "")
    .toUpperCase();
}

function getMinutesWithinDay(iso: string, day: Date, clampToEnd = false) {
  const value = new Date(iso);
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const clamped = value < dayStart ? dayStart : value > dayEnd ? dayEnd : value;

  if (clampToEnd && toDayKey(value) !== toDayKey(day)) {
    return 24 * 60;
  }

  return clamped.getHours() * 60 + clamped.getMinutes();
}

function clampDateTimeToDay(iso: string, day: Date, clampToEnd = false) {
  const value = new Date(iso);
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  if (value < dayStart) return dayStart;
  if (value > dayEnd) return clampToEnd ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59) : dayEnd;
  return value;
}

function buildCalendarCells(monthDate: Date): CalendarCell[] {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const firstWeekday = firstDay.getDay();

  const cells: CalendarCell[] = [];

  for (let idx = firstWeekday - 1; idx >= 0; idx -= 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), -idx);
    cells.push({
      key: `prev-${toDayKey(date)}`,
      date,
      day: date.getDate(),
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    cells.push({
      key: `curr-${toDayKey(date)}`,
      date,
      day,
      isCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0 || cells.length < 35) {
    const nextDate = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      daysInMonth + (cells.length - (firstWeekday + daysInMonth)) + 1,
    );
    cells.push({
      key: `next-${toDayKey(nextDate)}-${cells.length}`,
      date: nextDate,
      day: nextDate.getDate(),
      isCurrentMonth: false,
    });
  }

  return cells;
}

function groupCalendarWeeks(cells: CalendarCell[]): CalendarWeek[] {
  const weeks: CalendarWeek[] = [];

  for (let index = 0; index < cells.length; index += 7) {
    const days = cells.slice(index, index + 7);
    weeks.push({
      key: `week-${toDayKey(days[0].date)}`,
      days,
    });
  }

  return weeks;
}

function buildWeekPlanRows(week: CalendarWeek, plans: FeedPlanItemDto[]) {
  const weekStart = startOfDay(week.days[0].date);
  const weekEnd = endOfDay(week.days[6].date);

  const segments = plans
    .map((plan) => {
      const startsAt = new Date(plan.startsAt);
      const endsAt = new Date(plan.endsAt);
      if (!rangesOverlap(startsAt, endsAt, weekStart, weekEnd)) return null;

      const startCol = week.days.findIndex((day) => startOfDay(day.date) >= startOfDay(startsAt));
      const endCol = [...week.days].reverse().findIndex((day) => endOfDay(day.date) <= endOfDay(endsAt));

      const resolvedStartCol = startCol === -1 ? 0 : startCol;
      const resolvedEndCol = endCol === -1 ? 6 : 6 - endCol;

      return {
        key: `${plan.id}-${week.key}`,
        planId: plan.id,
        title: plan.title,
        startCol: resolvedStartCol,
        endCol: resolvedEndCol,
        isStart: startsAt >= weekStart,
        isEnd: endsAt <= weekEnd,
      } satisfies WeekPlanSegment;
    })
    .filter((segment): segment is WeekPlanSegment => Boolean(segment))
    .sort((a, b) => {
      if (a.startCol !== b.startCol) return a.startCol - b.startCol;
      return b.endCol - a.endCol;
    });

  const lanes: WeekPlanSegment[][] = [];
  const hidden: WeekPlanSegment[] = [];

  for (const segment of segments) {
    let placed = false;

    for (const lane of lanes) {
      const overlaps = lane.some((item) => !(segment.endCol < item.startCol || segment.startCol > item.endCol));
      if (overlaps) continue;
      lane.push(segment);
      placed = true;
      break;
    }

    if (!placed) {
      if (lanes.length < 2) {
        lanes.push([segment]);
      } else {
        hidden.push(segment);
      }
    }
  }

  return {
    lanes,
    hiddenCount: hidden.length,
  };
}
