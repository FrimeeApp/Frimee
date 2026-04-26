"use client";

import { Suspense } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import CreatePlanModal, { type CreatePlanPayload } from "@/components/plans/modals/CreatePlanModal";
import { useAuth } from "@/providers/AuthProvider";
import { clearCachedGoogleProviderToken } from "@/services/auth/googleTokenCache";
import { resolveGoogleProviderToken } from "@/services/auth/googleProviderToken";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { syncGoogleCalendarBidirectional } from "@/services/api/repositories/events.repository";
import { createPlan, listPlansByIdsInOrder, listUserRelatedPlans } from "@/services/api/repositories/plans.repository";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { insertNotificacion } from "@/services/api/repositories/notifications.repository";
import { syncPlanWidget } from "@/services/widget/planWidget";
import { Tabs } from "@/components/ui/Tabs";
import { SearchInput } from "@/components/ui/SearchInput";
import { DEFAULT_PLAN_COVER_IMAGE } from "@/config/app";
import { STORAGE_KEYS } from "@/config/storage";
import { ES_MONTHS_SHORT, ES_WEEK_DAYS_MIN } from "@/lib/date-labels";
import { formatDateRange, formatTimeRange, formatDayHeading } from "@/lib/formatters";

type PlanTab = "active" | "done";
type CalendarViewMode = "month" | "day" | "year";

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

const MONTHS_SHORT = ES_MONTHS_SHORT;
const WEEK_DAYS = ES_WEEK_DAYS_MIN;
const MOBILE_CALENDAR_OPEN_KEY = STORAGE_KEYS.mobileCalendarOpen;

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
      const stored = localStorage.getItem(STORAGE_KEYS.pinnedPlans);
      return stored ? (JSON.parse(stored) as number[]) : [];
    } catch { return []; }
  });
  const [reloadNonce, setReloadNonce] = useState(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
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
      try { localStorage.setItem(STORAGE_KEYS.pinnedPlans, JSON.stringify(next)); } catch { /* noop */ }
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

      await syncPlanWidget(user.id);

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
  const yearValue = monthDate.getFullYear();

  const stripWeeks = useMemo(() => {
    const today = startOfDay(new Date());
    const dayOfWeek = today.getDay();
    const weekStart = addDays(today, -dayOfWeek);
    return [0, 1].map((weekOffset) =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, weekOffset * 7 + i);
        return { key: toDayKey(date), date, day: date.getDate(), isCurrentMonth: date.getMonth() === today.getMonth() };
      })
    );
  }, []);

  const stripCalendarWeeks = useMemo((): CalendarWeek[] =>
    stripWeeks.map((days, i) => ({ key: `strip-week-${i}`, days })),
  [stripWeeks]);

  const stripWeekSegments = useMemo(
    () => stripCalendarWeeks.map((week) => buildWeekPlanRows(week, filteredPlans)),
    [stripCalendarWeeks, filteredPlans]
  );

  if (authLoading) return <LoadingScreen />;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar onCreatePlan={() => setCreateModalOpen(true)} />

        <main
          className={`min-h-[calc(100dvh-env(safe-area-inset-top)-clamp(56px,8dvh,64px)-env(safe-area-inset-bottom))] px-safe pb-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom))] pt-mobile-safe-top transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] md:min-h-0 md:py-[var(--space-10)] md:pr-[var(--space-14)]`}
        >
          <div className="mx-auto w-full max-w-[1120px]">

            {/* Título */}
            <h1 className="mb-[var(--space-6)] text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">
              Mis planes
            </h1>

            {/* Tabs */}
            <Tabs
              tabs={[
                { value: "active", label: "Activos" },
                { value: "done", label: "Finalizados" },
              ]}
              value={tab}
              onChange={(v) => setTab(v as PlanTab)}
              className="mb-[var(--space-4)]"
              fontWeight="var(--fw-semibold)"
            />

            {/* Buscador */}
            <div className="mb-[var(--space-5)]">
              <SearchInput
                value={planSearch}
                onChange={setPlanSearch}
                placeholder="Buscar"
                className="h-[40px] w-full px-[12px] md:max-w-[220px]"
              />
            </div>

            <div className="grid grid-cols-1 gap-[var(--space-5)] md:grid-cols-[minmax(0,1fr)_300px] md:gap-[var(--space-8)]">

              {/* ── Calendario mobile: strip 2 semanas ── */}
              {!loading && (
                <div className="md:hidden md:col-start-2 md:row-start-1 mb-[var(--space-2)]">
                  <div className="mb-[var(--space-3)] flex items-center justify-between">
                    <span className="text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                      {monthLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCalendarModalOpen(true)}
                      className="flex items-center gap-[5px] text-caption font-[var(--fw-medium)] text-[var(--primary)]"
                    >
                      Ver todo
                      <svg viewBox="0 0 24 24" fill="none" className="size-[13px]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-7 mb-[var(--space-1)]">
                    {WEEK_DAYS.map((d) => (
                      <div key={d} className="text-center text-[10px] font-[var(--fw-semibold)] uppercase tracking-[0.06em] text-muted">
                        {d}
                      </div>
                    ))}
                  </div>
                  {stripCalendarWeeks.map((week, wi) => (
                    <div key={`strip-week-${wi}`} className={`relative ${wi > 0 ? "border-t border-app" : ""}`}>
                      <div className="grid grid-cols-7 gap-x-1 py-[var(--space-2)]">
                        {week.days.map((cell) => {
                          const isToday = toDayKey(cell.date) === toDayKey(new Date());
                          const isSelected = toDayKey(cell.date) === toDayKey(selectedDayValue);
                          return (
                            <button
                              key={cell.key}
                              type="button"
                              onClick={() => { setSelectedDay(startOfDay(cell.date)); setCalendarModalOpen(true); }}
                              className={`flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-[13px] transition-colors ${
                                isSelected
                                  ? "bg-[color-mix(in_srgb,var(--primary)_72%,black_28%)] font-[var(--fw-semibold)] text-white"
                                  : isToday
                                    ? "border border-[color-mix(in_srgb,var(--primary)_42%,var(--border)_58%)] bg-[color-mix(in_srgb,var(--primary)_24%,var(--surface)_76%)] font-[var(--fw-semibold)] text-app"
                                    : `${cell.isCurrentMonth ? "text-app" : "text-muted/40"} hover:bg-surface-2`
                              }`}
                            >
                              {cell.day}
                            </button>
                          );
                        })}
                      </div>
                      <div className="space-y-[3px] pb-[var(--space-2)]">
                        {[0, 1].map((laneIndex) => {
                          const lane = stripWeekSegments[wi]?.lanes[laneIndex] ?? [];
                          return (
                            <div key={`strip-${wi}-lane-${laneIndex}`} className="grid grid-cols-7 gap-x-1">
                              {lane.length ? lane.map((segment) => (
                                <div
                                  key={segment.key}
                                  className="h-[14px] cursor-pointer rounded-full border border-[color-mix(in_srgb,var(--primary)_24%,var(--border)_76%)] bg-[color-mix(in_srgb,var(--primary)_22%,var(--surface)_78%)] px-1 text-[8px] font-[var(--fw-semibold)] leading-[13px] text-app transition-opacity hover:opacity-80"
                                  style={{ gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}` }}
                                  title={segment.title}
                                  onClick={() => { setSelectedDay(startOfDay(new Date(segment.planId))); setCalendarModalOpen(true); }}
                                >
                                  <span className="block truncate">{segment.title}</span>
                                </div>
                              )) : <div className="h-[14px]" aria-hidden="true" />}
                            </div>
                          );
                        })}
                      </div>
                      {stripWeekSegments[wi]?.hiddenCount ? (
                        <p className="pointer-events-none absolute bottom-[var(--space-1)] right-0 text-[9px] leading-none text-muted">
                          +{stripWeekSegments[wi].hiddenCount}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Calendario desktop: sidebar sticky ── */}
              {!loading && (
                <aside className="hidden md:flex md:col-start-2 md:row-start-1 flex-col md:sticky md:top-[var(--space-6)] md:self-start">
                  {/* Switcher + nav */}
                  <div className="mb-[var(--space-3)] flex flex-col gap-[var(--space-2)]">
                    <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                    <div className="flex items-center justify-between">
                      <button type="button" aria-label="Anterior"
                        onClick={() => {
                          if (viewMode === "year") setMonthDate(new Date(yearValue - 1, monthDate.getMonth(), 1));
                          else if (viewMode === "month") setMonthDate(addMonths(monthDate, -1));
                          else { const d = addDays(selectedDayValue, -1); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
                        }}
                        className="flex size-8 items-center justify-center text-muted transition-colors hover:text-app">
                        <svg viewBox="0 0 24 24" fill="none" className="size-[14px]"><path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <span className="text-body-sm font-[var(--fw-semibold)] text-app">
                        {viewMode === "year" ? String(yearValue) : viewMode === "month" ? monthLabel : formatDayHeading(selectedDayValue)}
                      </span>
                      <button type="button" aria-label="Siguiente"
                        onClick={() => {
                          if (viewMode === "year") setMonthDate(new Date(yearValue + 1, monthDate.getMonth(), 1));
                          else if (viewMode === "month") setMonthDate(addMonths(monthDate, 1));
                          else { const d = addDays(selectedDayValue, 1); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
                        }}
                        className="flex size-8 items-center justify-center text-muted transition-colors hover:text-app">
                        <svg viewBox="0 0 24 24" fill="none" className="size-[14px]"><path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  </div>

                  {viewMode === "year" ? (
                    /* ── Sidebar: vista año ── */
                    <div className="grid grid-cols-3 gap-[var(--space-2)]">
                      {Array.from({ length: 12 }).map((_, i) => {
                        const monthStart = new Date(yearValue, i, 1);
                        const monthEnd = new Date(yearValue, i + 1, 0, 23, 59, 59);
                        const plansInMonth = filteredPlans.filter((p) =>
                          rangesOverlap(new Date(p.startsAt), new Date(p.endsAt), monthStart, monthEnd)
                        );
                        const isCurrentMonth = i === startOfDay(new Date()).getMonth() && yearValue === startOfDay(new Date()).getFullYear();
                        return (
                          <button key={i} type="button"
                            onClick={() => { setMonthDate(monthStart); setViewMode("month"); }}
                            className={`flex flex-col items-center rounded-[8px] py-[var(--space-2)] transition-colors ${isCurrentMonth ? "bg-surface-2" : "hover:bg-surface-inset"}`}>
                            <span className={`text-[12px] font-[var(--fw-medium)] ${isCurrentMonth ? "text-app" : "text-muted"}`}>{MONTHS_SHORT[i]}</span>
                            {plansInMonth.length > 0 && (
                              <span className="mt-[2px] text-[10px] text-[var(--primary)]">{plansInMonth.length}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : viewMode === "month" ? (
                    /* ── Sidebar: vista mes ── */
                    <>
                      <div className="grid grid-cols-7 gap-x-1 gap-y-2 border-b border-app pb-3 text-center">
                        {WEEK_DAYS.map((weekDay) => (
                          <div key={weekDay} className="text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">{weekDay}</div>
                        ))}
                      </div>
                      <div className="mt-3">
                        {calendarWeeks.map((week, weekIndex) => (
                          <div key={week.key} className={`relative px-1 py-2 ${weekIndex === 0 ? "" : "border-t border-app"}`}>
                            <div className="grid grid-cols-7 gap-x-1">
                              {week.days.map((cell) => {
                                const isCellToday = toDayKey(cell.date) === toDayKey(new Date());
                                const isSelected = toDayKey(cell.date) === toDayKey(selectedDayValue);
                                return (
                                  <button type="button" key={cell.key}
                                    onClick={() => { setSelectedDay(startOfDay(cell.date)); setMonthDate(startOfMonth(cell.date)); setViewMode("day"); }}
                                    className={`flex h-7 w-7 items-center justify-center justify-self-center rounded-full text-[13px] transition-colors ${cell.isCurrentMonth ? "text-app" : "text-tertiary"} ${isSelected ? "bg-[color-mix(in_srgb,var(--primary)_72%,black_28%)] font-[var(--fw-semibold)] text-white shadow-sm" : isCellToday ? "border border-[color-mix(in_srgb,var(--primary)_42%,var(--border)_58%)] bg-[color-mix(in_srgb,var(--primary)_24%,var(--surface)_76%)] font-[var(--fw-semibold)] text-app" : "hover:bg-surface-inset"}`}
                                  >{cell.day}</button>
                                );
                              })}
                            </div>
                            <div className="mt-1.5 space-y-[3px]">
                              {[0, 1].map((laneIndex) => {
                                const lane = weekSegments[weekIndex]?.lanes[laneIndex] ?? [];
                                return (
                                  <div key={`${week.key}-lane-${laneIndex}`} className="grid grid-cols-7 gap-x-1">
                                    {lane.length ? lane.map((segment) => (
                                      <div key={segment.key}
                                        className="h-[14px] cursor-pointer overflow-hidden rounded-full bg-[var(--primary)]/20 px-1 text-[8px] font-[var(--fw-semibold)] leading-[14px] text-app transition-opacity hover:opacity-80"
                                        style={{ gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}` }}
                                        title={segment.title} onClick={() => navigateToPlan(segment.planId)}>
                                        <span className="block truncate">{segment.title}</span>
                                      </div>
                                    )) : <div className="h-3" aria-hidden="true" />}
                                  </div>
                                );
                              })}
                            </div>
                            {weekSegments[weekIndex]?.hiddenCount ? (
                              <p className="pointer-events-none absolute bottom-1 right-1 text-[9px] leading-none text-muted">+{weekSegments[weekIndex].hiddenCount}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* ── Sidebar: vista día ── */
                    <div className="flex flex-col">
                      {toDayKey(selectedDayValue) !== toDayKey(new Date()) && (
                        <button type="button"
                          onClick={() => { setSelectedDay(startOfDay(new Date())); setMonthDate(startOfMonth(new Date())); }}
                          className="mb-[var(--space-3)] self-start text-caption text-[var(--primary)]">Hoy</button>
                      )}
                      <h3 className="mb-[var(--space-3)] text-[var(--font-h3)] font-[var(--fw-semibold)] leading-[1.2] text-app">{formatDayHeading(selectedDayValue)}</h3>
                      {allDayPlans.length > 0 && (
                        <div className="mb-[var(--space-3)] flex flex-col border-b border-app">
                          {allDayPlans.map((plan, i) => (
                            <button key={`sidebar-allday-${plan.id}`} type="button"
                              onClick={() => navigateToPlan(plan.id)}
                              className={`flex items-center gap-2 py-[var(--space-2)] text-left transition-colors hover:bg-surface-inset/50 ${i < allDayPlans.length - 1 ? "border-b border-app" : ""}`}>
                              <div className="size-[6px] shrink-0 rounded-full bg-[var(--primary)]/60" />
                              <span className="truncate text-[13px] font-[var(--fw-medium)] text-app">{plan.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="scrollbar-thin max-h-[420px] overflow-y-auto pr-1">
                        <div className="relative">
                          {Array.from({ length: 24 }).map((_, hour) => (
                            <div key={`sidebar-hour-${hour}`} className="grid h-16 grid-cols-[40px_minmax(0,1fr)]">
                              <div className="pr-2 pt-1 text-right text-[11px] text-muted">{String(hour).padStart(2, "0")}:00</div>
                              <div className="border-t border-app/40" />
                            </div>
                          ))}
                          <div className="pointer-events-none absolute inset-y-0 left-[48px] right-0">
                            {timedDayPlans.map((plan) => {
                              const startMinutes = getMinutesWithinDay(plan.startsAt, selectedDayValue);
                              const endMinutes = getMinutesWithinDay(plan.endsAt, selectedDayValue, true);
                              const duration = Math.max(endMinutes - startMinutes, 30);
                              return (
                                <div key={`sidebar-plan-${plan.id}`}
                                  className="pointer-events-auto absolute left-1 right-1 cursor-pointer overflow-hidden rounded-[8px] bg-[var(--primary)]/15 px-2 py-1 text-app transition-opacity hover:opacity-90"
                                  style={{ top: `${(startMinutes / 60) * 64}px`, height: `${Math.max((duration / 60) * 64, 24)}px` }}
                                  onClick={() => navigateToPlan(plan.id)}>
                                  <p className="truncate text-[12px] font-[var(--fw-semibold)]">{plan.title}</p>
                                  <p className="mt-0.5 truncate text-[10px] text-muted">{formatTimeRange(clampDateTimeToDay(plan.startsAt, selectedDayValue).toISOString(), clampDateTimeToDay(plan.endsAt, selectedDayValue, true).toISOString())}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </aside>
              )}

              {/* ── Planes ── */}
              <section className="md:col-start-1 md:row-start-1">
                {loading ? (
                  <PlanListSkeleton />
                ) : filteredPlans.length === 0 ? (
                  <p className="pt-[var(--space-2)] text-body-sm text-muted">
                    {planSearch.trim() ? "No hay planes con ese nombre." : "No hay planes para mostrar."}
                  </p>
                ) : (
                  <>
                    {/* Mobile: lista con divisores */}
                    <div className="flex flex-col md:hidden">
                      {filteredPlans.map((plan, index) => {
                        const isLast = index === filteredPlans.length - 1;
                        return (
                          <article
                            key={`plan-mobile-${plan.id}`}
                            className="flex cursor-pointer items-stretch gap-3 transition-colors hover:bg-surface-inset/50"
                            onClick={() => navigateToPlan(plan.id)}
                          >
                            <div
                              className="size-[68px] shrink-0 self-start rounded-[8px] bg-cover bg-center bg-no-repeat my-[var(--space-3)]"
                              style={{ backgroundImage: `url(${plan.coverImage ?? DEFAULT_PLAN_COVER_IMAGE.mobile})` }}
                              role="img"
                              aria-label={plan.title}
                            />
                            <div className={`flex min-w-0 flex-1 items-start gap-2 py-[var(--space-3)] ${!isLast ? "border-b border-app" : ""}`}>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{plan.title}</p>
                                <p className="mt-[2px] text-caption text-muted">{formatDateRange(plan.startsAt, plan.endsAt)}</p>
                              </div>
                              <svg viewBox="0 0 24 24" fill="none" className="size-[15px] shrink-0 self-center text-muted" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {/* Desktop: grid sin borde */}
                    <div className="hidden md:grid md:grid-cols-2 md:gap-x-[var(--space-5)] md:gap-y-[var(--space-8)]">
                      {filteredPlans.map((plan) => {
                        return (
                          <article
                            key={`plan-desktop-${plan.id}`}
                            className="group cursor-pointer"
                            onClick={() => navigateToPlan(plan.id)}
                          >
                            <div
                              className="relative h-[160px] w-full overflow-hidden rounded-[10px] bg-cover bg-center bg-no-repeat transition-opacity group-hover:opacity-95"
                              style={{ backgroundImage: `url(${plan.coverImage ?? DEFAULT_PLAN_COVER_IMAGE.desktop})` }}
                              role="img"
                              aria-label={plan.title}
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); togglePin(plan.id); }}
                                aria-label={pinnedPlanIds.includes(plan.id) ? "Desanclar" : "Anclar"}
                                className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-opacity ${pinnedPlanIds.includes(plan.id) ? "bg-[color-mix(in_srgb,var(--primary)_18%,var(--surface)_82%)] text-app" : "bg-surface/80 text-app"}`}
                              >
                                <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                                  <path d="M8 4.5h8M10 4.5v4l-3 3v1h10v-1l-3-3v-4M12 12.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                            <div className="pt-[var(--space-3)]">
                              <p className="truncate text-[17px] font-[var(--fw-semibold)] leading-[1.2] text-app">{plan.title}</p>
                              <p className="mt-[3px] text-caption text-muted">{formatDateRange(plan.startsAt, plan.endsAt)}</p>
                              <p className="mt-[2px] truncate text-caption text-tertiary">
                                {plan.creator.id === user?.id ? "Creado por ti" : `De ${plan.creator.name}`}
                              </p>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

            </div>
          </div>
        </main>
      </div>

      {calendarModalOpen && (
        <FullCalendarModal
          monthDate={monthDate}
          setMonthDate={setMonthDate}
          viewMode={viewMode}
          setViewMode={setViewMode}
          selectedDayValue={selectedDayValue}
          setSelectedDay={setSelectedDay}
          calendarWeeks={calendarWeeks}
          weekSegments={weekSegments}
          allDayPlans={allDayPlans}
          timedDayPlans={timedDayPlans}
          monthLabel={monthLabel}
          yearValue={yearValue}
          filteredPlans={filteredPlans}
          navigateToPlan={navigateToPlan}
          onClose={() => setCalendarModalOpen(false)}
        />
      )}

      <CreatePlanModal open={createModalOpen} onClose={closeCreateModal} onCreate={handleCreatePlan} currentUserId={user?.id} />
    </div>
  );
}

function PlanListSkeleton() {
  return (
    <>
      {/* Mobile skeleton */}
      <div className="flex flex-col md:hidden">
        {[1, 2, 3, 4].map((i, index, arr) => (
          <div key={i} className={`flex items-center gap-3 ${index < arr.length - 1 ? "border-b border-app" : ""}`}>
            <div className="size-[68px] shrink-0 animate-pulse rounded-[8px] bg-surface-2" style={{ animationDelay: `${index * 60}ms` }} />
            <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-2)] py-[var(--space-4)]">
              <div className="h-[13px] w-[140px] animate-pulse rounded-full bg-surface-2" style={{ animationDelay: `${index * 60}ms` }} />
              <div className="h-[11px] w-[90px] animate-pulse rounded-full bg-surface-2 opacity-60" style={{ animationDelay: `${index * 60 + 30}ms` }} />
            </div>
          </div>
        ))}
      </div>
      {/* Desktop skeleton */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-[var(--space-5)]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="h-[160px] w-full animate-pulse rounded-[10px] bg-surface-2" />
            <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
              <div className="h-[16px] w-[70%] animate-pulse rounded-full bg-surface-2" />
              <div className="h-[12px] w-[50%] animate-pulse rounded-full bg-surface-2 opacity-60" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ViewSwitcher({ viewMode, setViewMode }: { viewMode: CalendarViewMode; setViewMode: (m: CalendarViewMode) => void }) {
  return (
    <div className="flex items-center rounded-full border border-app bg-surface-inset p-[3px]">
      {(["year", "month", "day"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setViewMode(mode)}
          className={`rounded-full px-[10px] py-[5px] text-[12px] font-[var(--fw-medium)] transition-colors ${
            viewMode === mode ? "bg-app text-app shadow-sm" : "text-muted hover:text-app"
          }`}
        >
          {mode === "year" ? "Año" : mode === "month" ? "Mes" : "Día"}
        </button>
      ))}
    </div>
  );
}

function FullCalendarModal({
  monthDate,
  setMonthDate,
  viewMode,
  setViewMode,
  selectedDayValue,
  setSelectedDay,
  calendarWeeks,
  weekSegments,
  allDayPlans,
  timedDayPlans,
  monthLabel,
  yearValue,
  filteredPlans,
  navigateToPlan,
  onClose,
}: {
  monthDate: Date;
  setMonthDate: (d: Date) => void;
  viewMode: CalendarViewMode;
  setViewMode: (m: CalendarViewMode) => void;
  selectedDayValue: Date;
  setSelectedDay: (d: Date | null) => void;
  calendarWeeks: CalendarWeek[];
  weekSegments: { lanes: WeekPlanSegment[][]; hiddenCount: number }[];
  allDayPlans: FeedPlanItemDto[];
  timedDayPlans: FeedPlanItemDto[];
  monthLabel: string;
  yearValue: number;
  filteredPlans: FeedPlanItemDto[];
  navigateToPlan: (id: number) => void;
  onClose: () => void;
}) {
  const today = startOfDay(new Date());
  const isToday = toDayKey(selectedDayValue) === toDayKey(today);

  // Navigation label and handlers per view
  const navLabel = viewMode === "year"
    ? String(yearValue)
    : viewMode === "month"
      ? monthLabel
      : selectedDayValue.toLocaleDateString("es-ES", { day: "numeric", month: "short" });

  const handlePrev = () => {
    if (viewMode === "year") setMonthDate(new Date(yearValue - 1, monthDate.getMonth(), 1));
    else if (viewMode === "month") setMonthDate(addMonths(monthDate, -1));
    else { const d = addDays(selectedDayValue, -1); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
  };
  const handleNext = () => {
    if (viewMode === "year") setMonthDate(new Date(yearValue + 1, monthDate.getMonth(), 1));
    else if (viewMode === "month") setMonthDate(addMonths(monthDate, 1));
    else { const d = addDays(selectedDayValue, 1); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-app" role="dialog" aria-modal="true">
      {/* Cabecera */}
      <div className="flex items-center gap-[var(--space-3)] border-b border-app px-[var(--space-4)] pb-[var(--space-3)] pt-[calc(var(--space-3)+env(safe-area-inset-top))]">
        {/* Navegación izquierda */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button type="button" onClick={handlePrev} aria-label="Anterior" className="flex size-8 items-center justify-center text-muted transition-colors hover:text-app">
            <svg viewBox="0 0 24 24" fill="none" className="size-[15px]"><path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="min-w-[60px] text-center text-body-sm font-[var(--fw-semibold)] text-app">{navLabel}</span>
          <button type="button" onClick={handleNext} aria-label="Siguiente" className="flex size-8 items-center justify-center text-muted transition-colors hover:text-app">
            <svg viewBox="0 0 24 24" fill="none" className="size-[15px]"><path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        {/* Switcher central */}
        <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
        {/* Cerrar */}
        <div className="flex min-w-0 flex-1 justify-end">
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2">
            <svg viewBox="0 0 24 24" fill="none" className="size-[18px]"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-[var(--space-4)] pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]">
        {viewMode === "year" ? (
          /* ── Vista año ── */
          <div className="grid grid-cols-3 gap-[var(--space-3)] pt-[var(--space-4)]">
            {Array.from({ length: 12 }).map((_, i) => {
              const monthStart = new Date(yearValue, i, 1);
              const monthEnd = new Date(yearValue, i + 1, 0, 23, 59, 59);
              const plansInMonth = filteredPlans.filter((p) =>
                rangesOverlap(new Date(p.startsAt), new Date(p.endsAt), monthStart, monthEnd)
              );
              const isCurrentMonth = i === today.getMonth() && yearValue === today.getFullYear();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setMonthDate(monthStart); setViewMode("month"); }}
                  className={`flex flex-col items-center rounded-[10px] py-[var(--space-3)] transition-colors ${
                    isCurrentMonth ? "bg-surface-2" : "hover:bg-surface-inset"
                  }`}
                >
                  <span className={`text-[13px] font-[var(--fw-medium)] ${isCurrentMonth ? "text-app" : "text-muted"}`}>{MONTHS_SHORT[i]}</span>
                  {plansInMonth.length > 0 && (
                    <span className="mt-[3px] text-[10px] text-[var(--primary)]">{plansInMonth.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : viewMode === "month" ? (
          /* ── Vista mes ── */
          <>
            <div className="grid grid-cols-7 gap-x-1 gap-y-2 border-b border-app pb-3 pt-3 text-center">
              {WEEK_DAYS.map((d) => (
                <div key={d} className="text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.06em] text-muted">{d}</div>
              ))}
            </div>
            <div className="mt-3">
              {calendarWeeks.map((week, weekIndex) => (
                <div key={week.key} className={`relative px-1.5 py-3 ${weekIndex === 0 ? "" : "border-t border-app"}`}>
                  <div className="grid grid-cols-7 gap-x-1">
                    {week.days.map((cell) => {
                      const isCellToday = toDayKey(cell.date) === toDayKey(today);
                      const isSelected = toDayKey(cell.date) === toDayKey(selectedDayValue);
                      return (
                        <button type="button" key={cell.key}
                          onClick={() => { setSelectedDay(startOfDay(cell.date)); setMonthDate(startOfMonth(cell.date)); setViewMode("day"); }}
                          className={`flex h-9 w-9 items-center justify-center justify-self-center rounded-full text-[15px] transition-colors ${cell.isCurrentMonth ? "text-app" : "text-muted/40"} ${isSelected ? "bg-[color-mix(in_srgb,var(--primary)_72%,black_28%)] font-[var(--fw-semibold)] text-white shadow-sm" : isCellToday ? "border border-[color-mix(in_srgb,var(--primary)_42%,var(--border)_58%)] bg-[color-mix(in_srgb,var(--primary)_24%,var(--surface)_76%)] font-[var(--fw-semibold)] text-app" : "hover:bg-surface-2"}`}
                        >{cell.day}</button>
                      );
                    })}
                  </div>
                  <div className="mt-2 space-y-1">
                    {[0, 1].map((laneIndex) => {
                      const lane = weekSegments[weekIndex]?.lanes[laneIndex] ?? [];
                      return (
                        <div key={`${week.key}-lane-${laneIndex}`} className="grid grid-cols-7 gap-x-1">
                          {lane.length ? lane.map((segment) => (
                            <div key={segment.key}
                              className="h-[18px] cursor-pointer overflow-hidden rounded-full bg-[var(--primary)]/20 px-1.5 text-[9px] font-[var(--fw-semibold)] leading-[18px] text-app transition-opacity hover:opacity-80"
                              style={{ gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}` }}
                              title={segment.title}
                              onClick={() => { navigateToPlan(segment.planId); onClose(); }}>
                              <span className="block truncate">{segment.title}</span>
                            </div>
                          )) : <div className="h-3" aria-hidden="true" />}
                        </div>
                      );
                    })}
                  </div>
                  {weekSegments[weekIndex]?.hiddenCount ? (
                    <p className="pointer-events-none absolute bottom-1 right-2 text-[9px] leading-none text-muted">+{weekSegments[weekIndex].hiddenCount}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          /* ── Vista día ── */
          <div className="flex flex-col">
            {/* Cabecera día */}
            <div className="flex items-center justify-between py-[var(--space-4)]">
              <button type="button" aria-label="Día anterior"
                onClick={() => { const d = addDays(selectedDayValue, -1); setSelectedDay(d); setMonthDate(startOfMonth(d)); }}
                className="flex size-9 items-center justify-center text-muted transition-colors hover:text-app">
                <svg viewBox="0 0 24 24" fill="none" className="size-[16px]"><path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className="flex flex-col items-center">
                <p className="text-body-sm font-[var(--fw-semibold)] text-app">{formatDayHeading(selectedDayValue)}</p>
                {!isToday && (
                  <button type="button"
                    onClick={() => { setSelectedDay(today); setMonthDate(startOfMonth(today)); }}
                    className="mt-[2px] text-caption text-[var(--primary)]">Hoy</button>
                )}
              </div>
              <button type="button" aria-label="Día siguiente"
                onClick={() => { const d = addDays(selectedDayValue, 1); setSelectedDay(d); setMonthDate(startOfMonth(d)); }}
                className="flex size-9 items-center justify-center text-muted transition-colors hover:text-app">
                <svg viewBox="0 0 24 24" fill="none" className="size-[16px]"><path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            {/* All-day plans */}
            {allDayPlans.length > 0 && (
              <div className="mb-[var(--space-3)] flex flex-col border-b border-app">
                {allDayPlans.map((plan, i) => (
                  <button key={`modal-allday-${plan.id}`} type="button"
                    onClick={() => { navigateToPlan(plan.id); onClose(); }}
                    className={`flex items-center gap-2 py-[var(--space-3)] text-left transition-colors hover:bg-surface-inset/50 ${i < allDayPlans.length - 1 ? "border-b border-app" : ""}`}>
                    <div className="size-2 shrink-0 rounded-full bg-[var(--primary)]/60" />
                    <span className="truncate text-body-sm font-[var(--fw-medium)] text-app">{plan.title}</span>
                  </button>
                ))}
              </div>
            )}
            {/* 24h timeline */}
            <div className="relative">
              {Array.from({ length: 24 }).map((_, hour) => (
                <div key={`modal-hour-${hour}`} className="grid h-16 grid-cols-[44px_minmax(0,1fr)]">
                  <div className="pr-2 pt-1 text-right text-[12px] text-muted">{String(hour).padStart(2, "0")}:00</div>
                  <div className="border-t border-app/40" />
                </div>
              ))}
              <div className="pointer-events-none absolute inset-y-0 left-[52px] right-0">
                {timedDayPlans.map((plan) => {
                  const startMinutes = getMinutesWithinDay(plan.startsAt, selectedDayValue);
                  const endMinutes = getMinutesWithinDay(plan.endsAt, selectedDayValue, true);
                  const duration = Math.max(endMinutes - startMinutes, 30);
                  return (
                    <div key={`modal-timed-${plan.id}`}
                      className="pointer-events-auto absolute left-2 right-2 cursor-pointer overflow-hidden rounded-[10px] bg-[var(--primary)]/15 px-3 py-2 text-app transition-opacity hover:opacity-90"
                      style={{ top: `${(startMinutes / 60) * 64}px`, height: `${Math.max((duration / 60) * 64, 24)}px` }}
                      onClick={() => { navigateToPlan(plan.id); onClose(); }}>
                      <p className="truncate text-[13px] font-[var(--fw-semibold)]">{plan.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">{formatTimeRange(clampDateTimeToDay(plan.startsAt, selectedDayValue).toISOString(), clampDateTimeToDay(plan.endsAt, selectedDayValue, true).toISOString())}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
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
