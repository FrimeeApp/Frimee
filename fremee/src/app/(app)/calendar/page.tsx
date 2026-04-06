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
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { insertNotificacion } from "@/services/api/repositories/notifications.repository";

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
const MOBILE_CALENDAR_OPEN_KEY = "frimee:calendar-mobile-open";

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
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(true);

  const [syncingGoogle, setSyncingGoogle] = useState(false);
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
    if (typeof window === "undefined") return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) {
      setCalendarOpen(true);
      return;
    }

    try {
      const stored = localStorage.getItem(MOBILE_CALENDAR_OPEN_KEY);
      setCalendarOpen(stored === "true");
    } catch {
      setCalendarOpen(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    try {
      localStorage.setItem(MOBILE_CALENDAR_OPEN_KEY, String(calendarOpen));
    } catch {
      /* noop */
    }
  }, [calendarOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const isMobile = window.innerWidth < 1024;
      if (isMobile) return;
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

      if (payload.invitedFriendIds.length > 0) {
        await Promise.allSettled(
          payload.invitedFriendIds.map((friendId) =>
            insertNotificacion({
              userId: friendId,
              tipo: "plan_invite",
              actorId: user.id,
              entityId: String(created.id),
              entityType: "plan",
            })
          )
        );
      }

      setSavingPlan(false);
      navigateToPlan(created.id);
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
      hasLoadedOnceRef.current = false;
      return;
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

  const mergedPlans = useMemo(() => {
    return [...localPlans, ...plans];
  }, [localPlans, plans]);

  const visiblePlans = useMemo(() => {
    const now = new Date();
    return mergedPlans.filter((plan) => {
      const endsAt = new Date(plan.endsAt);
      return tab === "active" ? endsAt >= now : endsAt < now;
    });
  }, [mergedPlans, tab]);

  const filteredPlans = useMemo(() => {
    const query = planSearch.trim().toLowerCase();
    const basePlans = !query
      ? visiblePlans
      : visiblePlans.filter((plan) => plan.title.toLowerCase().includes(query));

    return [...basePlans].sort((a, b) => {
      const aPinned = pinnedPlanIds.includes(a.id);
      const bPinned = pinnedPlanIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (aPinned && bPinned) {
        return pinnedPlanIds.indexOf(a.id) - pinnedPlanIds.indexOf(b.id);
      }
      return 0;
    });
  }, [visiblePlans, planSearch, pinnedPlanIds]);

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
            <div
              ref={tabRowRef}
              className="relative flex gap-[var(--space-4)] border-b border-app pb-[var(--space-2)] text-body text-muted"
            >
              <button
                ref={activeTabRef}
                type="button"
                onClick={() => setTab("active")}
                className={`-mb-[2px] pb-0 font-[700] transition-colors duration-[var(--duration-base)] ${
                  tab === "active" ? "text-app" : "hover:text-app"
                }`}
              >
                Activos
              </button>
              <button
                ref={doneTabRef}
                type="button"
                onClick={() => setTab("done")}
                className={`-mb-[2px] pb-0 font-[700] transition-colors duration-[var(--duration-base)] ${
                  tab === "done" ? "text-app" : "hover:text-app"
                }`}
              >
                Finalizados
              </button>
              <span
                className={`pointer-events-none absolute bottom-0 h-[2px] bg-[var(--text-primary)] transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] ${
                  tabIndicator.ready ? "opacity-100" : "opacity-0"
                }`}
                style={{ left: tabIndicator.left, width: tabIndicator.width }}
                aria-hidden="true"
              />
            </div>

            <div className="mt-[var(--space-4)]">
              <div className="flex h-[44px] w-full items-center gap-[10px] rounded-[12px] border border-app bg-surface-inset px-[14px] text-muted md:max-w-[240px]">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[22px] shrink-0">
                  <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                  placeholder="Buscar"
                  className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-app shadow-none outline-none ring-0 focus:border-none focus:shadow-none focus:outline-none focus:ring-0 placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
                />
                {planSearch && (
                  <button type="button" onClick={() => setPlanSearch("")} className="text-muted transition-opacity hover:opacity-70">
                    <svg viewBox="0 0 24 24" fill="none" className="size-[14px]" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-[var(--space-4)] grid grid-cols-1 gap-[var(--space-5)] md:grid-cols-[minmax(0,1fr)_320px] md:gap-[var(--space-8)]">
              {loading ? (
                <CalendarPageSkeleton />
              ) : (
                <>
                  <aside className={`md:col-start-2 md:row-start-1 flex flex-col overflow-hidden rounded-[10px] border border-app bg-surface shadow-[0_14px_32px_rgb(28_28_34_/_0.08)] md:rounded-[10px] md:border-app md:bg-surface md:shadow-elev-1 md:sticky md:top-[var(--space-6)] md:self-start transition-all [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${calendarOpen ? "duration-[720ms]" : "duration-[560ms]"} ${calendarOpen ? (viewMode === "day" ? "h-[430px] md:h-[420px]" : "md:h-auto") : "h-auto md:h-auto"}`}>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen((prev) => !prev)}
                      className={`flex items-center px-[var(--space-4)] py-[var(--space-3)] text-left md:hidden ${calendarOpen ? "justify-end" : "justify-between"}`}
                      aria-expanded={calendarOpen}
                      aria-controls="calendar-mobile-panel"
                    >
                      {!calendarOpen ? (
                        <span className="flex items-center gap-2 text-body-sm font-[var(--fw-semibold)] text-app">
                          <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                            <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          {monthLabel}
                        </span>
                      ) : null}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`size-4 text-muted transition-transform ${calendarOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div
                      id="calendar-mobile-panel"
                      className={`min-h-0 flex-1 overflow-hidden px-[var(--space-4)] transition-[max-height,opacity,padding] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${calendarOpen ? "duration-[720ms]" : "duration-[560ms]"} md:block md:p-[var(--space-4)] ${
                        calendarOpen
                          ? "max-h-[860px] opacity-100 pb-[var(--space-4)]"
                          : "max-h-0 opacity-0 pb-0 md:max-h-none md:opacity-100 md:pb-[var(--space-4)]"
                      }`}
                    >
                    {viewMode === "month" ? (
                      <>
                        <div className="mb-[var(--space-3)] flex items-center justify-between">
                          <button
                            type="button"
                            aria-label="Mes anterior"
                            onClick={() => setMonthDate((prev) => addMonths(prev, -1))}
                            className="flex h-9 w-9 items-center justify-center text-app transition-colors hover:text-[var(--primary)]"
                          >
                            <span className="inline-block rotate-180 text-[13px] leading-none">✈</span>
                          </button>
                          <div className="px-1 text-body-sm font-[var(--fw-semibold)] text-app">{monthLabel}</div>
                          <button
                            type="button"
                            aria-label="Mes siguiente"
                            onClick={() => setMonthDate((prev) => addMonths(prev, 1))}
                            className="flex h-9 w-9 items-center justify-center text-app transition-colors hover:text-[var(--primary)]"
                          >
                            <span className="inline-block text-[13px] leading-none">✈</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-x-1 gap-y-2 border-b border-app pb-3 text-center">
                          {WEEK_DAYS.map((weekDay) => (
                            <div key={weekDay} className="text-[10px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                              {weekDay}
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 space-y-0">
                          {calendarWeeks.map((week, weekIndex) => (
                            <div
                              key={week.key}
                              className={`relative px-1.5 py-2 ${weekIndex === 0 ? "" : "border-t border-app"}`}
                            >
                              <div className="grid grid-cols-7 gap-x-1">
                                {week.days.map((cell) => {
                                  const isToday = toDayKey(cell.date) === toDayKey(new Date());
                                  const isSelected = toDayKey(cell.date) === toDayKey(selectedDayValue);
                                  return (
                                    <button
                                      type="button"
                                      key={cell.key}
                                      onClick={() => {
                                        setSelectedDay(startOfDay(cell.date));
                                        setMonthDate(startOfMonth(cell.date));
                                        setViewMode("day");
                                      }}
                                      className={`flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-body-sm transition-colors ${
                                        cell.isCurrentMonth ? "text-app" : "text-tertiary"
                                      } ${
                                        isSelected
                                          ? "bg-[color-mix(in_srgb,var(--primary)_72%,black_28%)] font-[var(--fw-semibold)] text-white shadow-sm"
                                          : isToday
                                            ? "border border-[color-mix(in_srgb,var(--primary)_42%,var(--border)_58%)] bg-[color-mix(in_srgb,var(--primary)_24%,var(--surface)_76%)] font-[var(--fw-semibold)] text-app"
                                            : "hover:bg-[color-mix(in_srgb,var(--primary)_18%,var(--surface)_82%)]"
                                      }`}
                                    >
                                      {cell.day}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-1.5 space-y-1">
                                {[0, 1].map((laneIndex) => {
                                  const lane = weekSegments[weekIndex]?.lanes[laneIndex] ?? [];
                                  return (
                                    <div key={`${week.key}-lane-${laneIndex}`} className="grid grid-cols-7 gap-x-1">
                                      {lane.length
                                        ? lane.map((segment) => (
                                            <div
                                              key={segment.key}
                                              className="h-4 cursor-pointer rounded-full border border-[color-mix(in_srgb,var(--primary)_24%,var(--border)_76%)] bg-[color-mix(in_srgb,var(--primary)_22%,var(--surface)_78%)] px-1.5 text-[8px] font-[var(--fw-semibold)] leading-[14px] text-app transition-opacity hover:opacity-90"
                                              style={{
                                                gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                                              }}
                                              title={segment.title}
                                              onClick={() => navigateToPlan(segment.planId)}
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
                                <p className="pointer-events-none absolute bottom-1 right-2 text-[9px] leading-none text-muted">
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
                            className="flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--primary)_20%,var(--border)_80%)] bg-surface py-1.5 pl-2.5 pr-3.5 text-body-sm font-[var(--fw-medium)] text-muted transition-colors hover:text-app"
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
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--primary)_20%,var(--border)_80%)] bg-surface text-muted transition-colors hover:text-app"
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
                              className="rounded-full border border-[color-mix(in_srgb,var(--primary)_20%,var(--border)_80%)] bg-[color-mix(in_srgb,var(--primary)_10%,white_90%)] px-3 py-1 text-body-sm font-[var(--fw-semibold)] text-[var(--primary)]"
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
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--primary)_20%,var(--border)_80%)] bg-surface text-muted transition-colors hover:text-app"
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
                                className="rounded-[12px] border border-[color-mix(in_srgb,var(--primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,white_88%)] px-3 py-2 text-body-sm font-[var(--fw-medium)] text-app"
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
                                    className="absolute left-2 right-2 cursor-pointer overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--primary)_22%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface)_88%)] px-3 py-2 text-app shadow-sm transition-opacity hover:opacity-90"
                                    style={{
                                      top: `${(startMinutes / 60) * 64}px`,
                                      height: `${Math.max((duration / 60) * 64, 24)}px`,
                                    }}
                                    title={plan.title}
                                    onClick={() => navigateToPlan(plan.id)}
                                  >
                                    <p className="truncate text-body-sm font-[var(--fw-semibold)]">{plan.title}</p>
                                    <p className="mt-0.5 truncate text-[11px] text-muted">
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

                  </aside>

                  <section className="space-y-[var(--space-4)] md:col-start-1 md:row-start-1">
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
                        const statusLabel = tab === "active" ? "Activo" : "Finalizado";
                        const statusClass =
                          tab === "active"
                            ? "border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_20%,transparent_80%)] text-success-token"
                            : "border-app bg-surface/90 text-muted";
                        const heroStatusClass =
                          tab === "active"
                            ? "border-[color-mix(in_srgb,var(--success)_40%,transparent)] bg-[color-mix(in_srgb,var(--success)_26%,rgba(17,17,17,0.56)_74%)] text-[var(--success)] backdrop-blur-sm"
                            : "border-white/20 bg-[rgba(17,17,17,0.48)] text-white/78 backdrop-blur-sm";

                        return (
                          <article
                            key={`plan-${plan.id}`}
                            className="group flex cursor-pointer flex-row overflow-hidden rounded-[10px] border border-app bg-surface shadow-elev-1 transition-shadow hover:shadow-elev-2 lg:rounded-[10px] lg:flex-col"
                            onClick={() => navigateToPlan(plan.id)}
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
                                className={`absolute right-3 top-3 hidden rounded-chip border px-2.5 py-1 text-[11px] font-[var(--fw-medium)] leading-none lg:inline-flex ${heroStatusClass}`}
                              >
                                {statusLabel}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); togglePin(plan.id); }}
                                aria-label={pinnedPlanIds.includes(plan.id) ? "Desanclar" : "Anclar"}
                                className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[13px] shadow-sm transition-opacity ${
                                  pinnedPlanIds.includes(plan.id)
                                    ? "bg-[color-mix(in_srgb,var(--primary)_18%,var(--surface)_82%)] text-app opacity-100"
                                    : "bg-surface/80 text-app opacity-100"
                                }`}
                              >
                                <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                                  <path d="M8 4.5h8M10 4.5v4l-3 3v1h10v-1l-3-3v-4M12 12.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>

                            <div className="flex min-w-0 flex-1 p-[var(--space-3)] lg:p-[var(--space-4)]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <h2
                                  className="truncate text-[16px] font-[var(--fw-medium)] leading-[1.2] tracking-[0.012em] text-app sm:text-[17px] lg:text-[24px] lg:font-[var(--fw-medium)] lg:leading-[1.15] lg:tracking-[0.02em]"
                                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                                >
                                  {plan.title}
                                </h2>
                                <p
                                  className="mt-0.5 text-caption text-muted lg:mt-1 lg:text-body-sm"
                                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                                >
                                  {formatDateRange(plan.startsAt, plan.endsAt)}
                                </p>
                                <div className="mt-1 flex items-end justify-between gap-2">
                                  <p
                                    className="min-w-0 truncate text-caption text-tertiary"
                                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                                  >
                                    {creatorLabel}
                                  </p>
                                  <span
                                    className={`shrink-0 rounded-chip border px-2 py-1 text-[10px] font-[var(--fw-medium)] leading-none lg:hidden ${statusClass}`}
                                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                                  >
                                    {statusLabel}
                                  </span>
                                </div>
                              </div>
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
          <article key={index} className="overflow-hidden rounded-card border border-app bg-surface shadow-elev-1">
            <div className="skeleton-shimmer h-[138px] w-full" />
            <div className="flex items-end justify-between gap-3 p-[var(--space-4)]">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton-shimmer h-7 w-[62%] rounded-full" />
                <div className="skeleton-shimmer h-4 w-[48%] rounded-full" />
                <div className="skeleton-shimmer h-3 w-[34%] rounded-full" />
              </div>
              <div className="skeleton-shimmer h-10 w-24 rounded-[10px]" />
            </div>
          </article>
        ))}
      </section>

      <aside
        className="overflow-hidden rounded-modal border border-app bg-surface p-[var(--space-4)] shadow-elev-1 lg:sticky lg:top-[var(--space-6)] lg:self-start"
        aria-hidden="true"
      >
        <div className="mb-[var(--space-2)] flex items-center justify-between">
          <div className="skeleton-shimmer h-8 w-10 rounded-input" />
          <div className="skeleton-shimmer h-4 w-24 rounded-full" />
          <div className="skeleton-shimmer h-8 w-10 rounded-input" />
        </div>

        <div className="grid grid-cols-7 gap-x-1 gap-y-2 text-center">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={`calendar-head-${index}`} className="skeleton-shimmer mx-auto h-3 w-5 rounded-full" />
          ))}
        </div>

        <div className="mt-2 space-y-1">
          {Array.from({ length: 5 }).map((_, weekIndex) => (
            <div key={`calendar-week-${weekIndex}`} className="h-[48px] p-1.5">
              <div className="grid grid-cols-7 gap-x-1">
                {Array.from({ length: 7 }).map((__, dayIndex) => (
                  <div key={`calendar-day-${weekIndex}-${dayIndex}`} className="skeleton-shimmer h-7" />
                ))}
              </div>
              <div className="mt-1 space-y-0.5">
                <div className="grid grid-cols-7 gap-x-1">
                  <div className="skeleton-shimmer col-span-4 h-3 rounded-full" />
                </div>
                <div className="grid grid-cols-7 gap-x-1">
                  <div className="skeleton-shimmer col-span-3 h-3 rounded-full" />
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
