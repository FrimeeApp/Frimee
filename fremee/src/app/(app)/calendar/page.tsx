"use client";

import { Suspense } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
import { ES_MONTHS_SHORT } from "@/lib/date-labels";
import { formatDateRange, formatTimeRange } from "@/lib/formatters";
import { CloseButton, IconButton } from "@/components/ui/IconButton";

type PlanTab = "active" | "done";
type CalendarViewMode = "month" | "week" | "day" | "year";

let calendarPlansCache: { userId: string; plans: FeedPlanItemDto[] } | null = null;

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
const WEEK_DAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"] as const;
const WEEK_DAYS_MONDAY_SHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;
const MOBILE_CALENDAR_OPEN_KEY = STORAGE_KEYS.mobileCalendarOpen;
const CALENDAR_DAY_SELECTED_CLASS = "bg-[color-mix(in_srgb,var(--primary)_72%,black_28%)] font-[var(--fw-semibold)] text-white";
const CALENDAR_DAY_TODAY_CLASS = "border border-[color-mix(in_srgb,var(--primary)_42%,var(--border)_58%)] bg-[color-mix(in_srgb,var(--primary)_24%,var(--surface)_76%)] font-[var(--fw-semibold)] text-app";
const CLICK_MOTION_CLASS = "transition-transform duration-150 ease-out active:translate-y-[1px] active:scale-[0.98]";
const CALENDAR_DAY_BUTTON_CLASS = "transition-[color,background-color,border-color,transform] duration-150 ease-out active:translate-y-[1px] active:scale-[0.94]";
const CALENDAR_PLAN_PILL_BASE_CLASS = "cursor-pointer overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--primary)_24%,var(--border)_76%)] bg-[color-mix(in_srgb,var(--primary)_22%,var(--surface)_78%)] font-[var(--fw-semibold)] text-app transition-[opacity,transform] duration-150 ease-out hover:opacity-80 active:translate-y-[1px] active:scale-[0.98]";
const CALENDAR_PLAN_PILL_COMPACT_CLASS = "h-[22px] px-1.5 text-[14px] leading-[22px]";
const FINISHED_PLAN_IMAGE_CLASS = "grayscale-[45%] opacity-80 saturate-[0.75]";
const FINISHED_PLAN_TITLE_CLASS = "text-muted";
const ACTIVE_PLAN_TITLE_CLASS = "text-app";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function PlanPinButton({
  pinned,
  onToggle,
  className,
  compact = false,
}: {
  pinned: boolean;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={pinned ? "Desanclar" : "Anclar"}
      className={cx(
        "z-10 flex items-center justify-center rounded-full bg-transparent transition-[opacity,transform] duration-150 ease-out hover:opacity-75 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]",
        compact ? "size-11" : "size-8",
        !pinned && "opacity-95",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={compact ? "size-[22px]" : "size-5"}
        aria-hidden="true"
      >
        <path
          d="M8 4.5h8M10 4.5v4l-3 3v1h10v-1l-3-3v-4M12 12.5v7"
          stroke="currentColor"
          strokeWidth={pinned ? "2.55" : "2.2"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function getCalendarDayStateClass({
  isSelected,
  isToday,
  currentMonthClass = "text-app",
  otherMonthClass = "text-muted/40",
  hoverClass = "hover:bg-surface-2",
  isCurrentMonth = true,
}: {
  isSelected: boolean;
  isToday: boolean;
  currentMonthClass?: string;
  otherMonthClass?: string;
  hoverClass?: string;
  isCurrentMonth?: boolean;
}) {
  if (isSelected) return CALENDAR_DAY_SELECTED_CLASS;
  if (isToday) return CALENDAR_DAY_TODAY_CLASS;
  return `${isCurrentMonth ? currentMonthClass : otherMonthClass} ${hoverClass}`;
}

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
  const [loading, setLoading] = useState(() => !calendarPlansCache);

  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [plans, setPlans] = useState<FeedPlanItemDto[]>(() => calendarPlansCache?.plans ?? []);
  const [tab, setTab] = useState<PlanTab>("active");
  const [planSearch, setPlanSearch] = useState("");
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [stripWeekOffset, setStripWeekOffset] = useState(0);
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
    if (!calendarModalOpen || typeof window === "undefined") return;

    const scrollY = window.scrollY;
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousHtmlOverscroll = documentElement.style.overscrollBehavior;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    documentElement.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [calendarModalOpen]);

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
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncMobileViewMode = () => {
      if (mediaQuery.matches) {
        setViewMode((current) => (current === "week" ? "month" : current));
      }
    };

    syncMobileViewMode();
    mediaQuery.addEventListener("change", syncMobileViewMode);
    return () => mediaQuery.removeEventListener("change", syncMobileViewMode);
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
    const weekStart = addDays(startOfWeek(today), stripWeekOffset);
    return [0, 1].map((weekOffset) =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, weekOffset * 7 + i);
        return { key: toDayKey(date), date, day: date.getDate(), isCurrentMonth: true };
      })
    );
  }, [stripWeekOffset]);

  const stripRangeLabel = useMemo(() => {
    const first = stripWeeks[0]?.[0]?.date;
    if (!first) return "";
    return formatMonthYearHeading(first);
  }, [stripWeeks]);

  const stripCalendarWeeks = useMemo((): CalendarWeek[] =>
    stripWeeks.map((days, i) => ({ key: `strip-week-${i}`, days })),
  [stripWeeks]);

  const stripWeekSegments = useMemo(
    () => stripCalendarWeeks.map((week) => buildWeekPlanRows(week, filteredPlans)),
    [stripCalendarWeeks, filteredPlans]
  );

  if (authLoading) return <LoadingScreen />;

  const showingFinishedPlans = tab === "done";

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
            <div className="mb-[var(--space-5)] grid grid-cols-1 gap-[var(--space-5)] md:grid-cols-[minmax(0,1fr)_300px] md:gap-[var(--space-8)]">
              <div className="md:grid md:grid-cols-2 md:gap-x-[var(--space-5)]">
                <SearchInput
                  value={planSearch}
                  onChange={setPlanSearch}
                  placeholder="Buscar"
                  className="h-[40px] w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-[var(--space-5)] md:grid-cols-[minmax(0,1fr)_300px] md:gap-[var(--space-8)]">

              {/* ── Calendario mobile: strip 2 semanas ── */}
              {!loading && (
                <div className="md:hidden md:col-start-2 md:row-start-1 mb-[var(--space-2)]">
                  <div className="mb-[var(--space-3)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStripWeekOffset((offset) => offset - 14)}
                        aria-label="Ver dos semanas anteriores"
                        className="flex size-8 items-center justify-center rounded-full text-muted transition-colors active:bg-surface-2 active:text-app"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="size-[15px]" aria-hidden="true">
                          <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <span className="whitespace-nowrap text-center text-[15px] font-[var(--fw-semibold)] leading-tight text-app">
                        {stripRangeLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStripWeekOffset((offset) => offset + 14)}
                        aria-label="Ver dos semanas siguientes"
                        className="flex size-8 items-center justify-center rounded-full text-muted transition-colors active:bg-surface-2 active:text-app"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="size-[15px]" aria-hidden="true">
                          <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarModalOpen(true)}
                      aria-label="Ver calendario completo"
                      className="flex size-8 items-center justify-center rounded-full text-muted transition-colors active:bg-surface-2 active:text-app"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="size-[13px]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-7 mb-[var(--space-1)]">
                    {WEEK_DAYS.map((d) => (
                      <div key={d} className="text-center text-[10px] font-[var(--fw-semibold)] tracking-[0.04em] text-muted">
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
                              onClick={() => {
                                setSelectedDay(startOfDay(cell.date));
                                setMonthDate(startOfMonth(cell.date));
                                setViewMode("day");
                                setCalendarModalOpen(true);
                              }}
                              className={cx(
                                "flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-[13px]",
                                CALENDAR_DAY_BUTTON_CLASS,
                                getCalendarDayStateClass({ isSelected, isToday, isCurrentMonth: cell.isCurrentMonth })
                              )}
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
                              {lane.length ? lane.map((segment) => {
                                const segmentPlan = filteredPlans.find((plan) => plan.id === segment.planId);
                                const targetDate = startOfDay(segmentPlan ? new Date(segmentPlan.startsAt) : selectedDayValue);
                                return (
                                  <div
                                    key={segment.key}
                                    className={cx(CALENDAR_PLAN_PILL_BASE_CLASS, CALENDAR_PLAN_PILL_COMPACT_CLASS)}
                                    style={{ gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}` }}
                                    title={segment.title}
                                    onClick={() => {
                                      setSelectedDay(targetDate);
                                      setMonthDate(startOfMonth(targetDate));
                                      setViewMode("day");
                                      setCalendarModalOpen(true);
                                    }}
                                  >
                                    <span className="block truncate">{segment.title}</span>
                                  </div>
                                );
                              }) : <div className="h-[22px]" aria-hidden="true" />}
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
                  <div className="mb-[var(--space-3)] flex flex-col items-center gap-[var(--space-2)]">
                    <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                    <div className="flex w-full items-center justify-between">
                      <button type="button" aria-label="Anterior"
                        onClick={() => {
                          if (viewMode === "year") setMonthDate(new Date(yearValue - 1, monthDate.getMonth(), 1));
                          else if (viewMode === "month") setMonthDate(addMonths(monthDate, -1));
                          else if (viewMode === "week") { const d = addDays(selectedDayValue, -7); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
                          else { const d = addDays(selectedDayValue, -1); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
                        }}
                        className="flex size-8 items-center justify-center text-muted transition-colors hover:text-app">
                        <svg viewBox="0 0 24 24" fill="none" className="size-[14px]"><path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <span className="whitespace-nowrap text-left text-[22px] font-[var(--fw-semibold)] leading-tight text-app">
                        {viewMode === "year" ? String(yearValue) : viewMode === "month" ? monthLabel : viewMode === "week" ? formatMonthYearHeading(selectedDayValue) : selectedDayValue.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <button type="button" aria-label="Siguiente"
                        onClick={() => {
                          if (viewMode === "year") setMonthDate(new Date(yearValue + 1, monthDate.getMonth(), 1));
                          else if (viewMode === "month") setMonthDate(addMonths(monthDate, 1));
                          else if (viewMode === "week") { const d = addDays(selectedDayValue, 7); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
                          else { const d = addDays(selectedDayValue, 1); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
                        }}
                        className="flex size-8 items-center justify-center text-muted transition-colors hover:text-app">
                        <svg viewBox="0 0 24 24" fill="none" className="size-[14px]"><path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  </div>

                  {viewMode === "year" ? (
                    /* ── Sidebar: vista año ── */
                    <div className="grid grid-cols-3 grid-rows-4 gap-x-[var(--space-3)] gap-y-[var(--space-5)]">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <YearMonthMini
                          key={i}
                          year={yearValue}
                          monthIndex={i}
                          today={startOfDay(new Date())}
                          selectedDay={selectedDayValue}
                          compact
                          onSelectDay={(day) => {
                            setSelectedDay(startOfDay(day));
                            setMonthDate(startOfMonth(day));
                            setViewMode("day");
                          }}
                        />
                      ))}
                    </div>
                  ) : viewMode === "month" ? (
                    /* ── Sidebar: vista mes ── */
                    <>
                      <div className="grid grid-cols-7 gap-x-1 gap-y-2 border-b border-app pb-3 text-center">
                        {WEEK_DAYS.map((weekDay) => (
                          <div key={weekDay} className="text-[11px] font-[var(--fw-semibold)] tracking-[0.04em] text-muted">{weekDay}</div>
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
                                    className={cx(
                                      "flex h-7 w-7 items-center justify-center justify-self-center rounded-full text-[13px]",
                                      CALENDAR_DAY_BUTTON_CLASS,
                                      getCalendarDayStateClass({
                                        isSelected,
                                        isToday: isCellToday,
                                        isCurrentMonth: cell.isCurrentMonth,
                                        otherMonthClass: "text-tertiary",
                                        hoverClass: "hover:bg-surface-inset",
                                      })
                                    )}
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
                                        className={cx(CALENDAR_PLAN_PILL_BASE_CLASS, CALENDAR_PLAN_PILL_COMPACT_CLASS)}
                                        style={{ gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}` }}
                                        title={segment.title} onClick={() => navigateToPlan(segment.planId)}>
                                        <span className="block truncate">{segment.title}</span>
                                      </div>
                                    )) : <div className="h-[22px]" aria-hidden="true" />}
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
                      {allDayPlans.length > 0 && (
                        <div className="mb-[var(--space-3)] grid grid-cols-[40px_minmax(0,1fr)] border-b border-app pb-[var(--space-2)]">
                          <div className="pr-2 pt-[3px] text-right text-[10px] font-[var(--fw-semibold)] leading-tight text-muted">
                            todo<br />el día
                          </div>
                          <div className="space-y-[4px]">
                            {allDayPlans.map((plan) => (
                              <button
                                key={`sidebar-allday-${plan.id}`}
                                type="button"
                                onClick={() => navigateToPlan(plan.id)}
                                className={cx(CALENDAR_PLAN_PILL_BASE_CLASS, CALENDAR_PLAN_PILL_COMPACT_CLASS, "block w-full text-left")}
                              >
                                <span className="block truncate">{plan.title}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="scrollbar-thin max-h-[420px] overflow-y-auto pr-1">
                        <div className="relative">
                          {Array.from({ length: 24 }).map((_, hour) => (
                            <div key={`sidebar-hour-${hour}`} className="grid h-16 grid-cols-[40px_minmax(0,1fr)]">
                              <div className="relative">
                                <span className="absolute right-2 top-0 -translate-y-1/2 text-right text-[11px] leading-none text-muted">
                                  {String(hour).padStart(2, "0")}:00
                                </span>
                              </div>
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
                                  className="pointer-events-auto absolute left-1 right-1 cursor-pointer overflow-hidden rounded-[8px] bg-[var(--primary)]/15 px-2 py-1 text-app transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:translate-y-[1px] active:scale-[0.98]"
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
                      {filteredPlans.map((plan) => {
                        return (
                          <article
                            key={`plan-mobile-${plan.id}`}
                            className={cx("flex cursor-pointer items-stretch gap-3 hover:bg-surface-inset/50", CLICK_MOTION_CLASS)}
                            onClick={() => navigateToPlan(plan.id)}
                          >
                            <div
                              className={cx(
                                "size-[84px] shrink-0 self-start rounded-[8px] bg-cover bg-center bg-no-repeat my-[var(--space-2)] transition-[filter,opacity]",
                                showingFinishedPlans && FINISHED_PLAN_IMAGE_CLASS
                              )}
                              style={{ backgroundImage: `url(${plan.coverImage ?? DEFAULT_PLAN_COVER_IMAGE.mobile})` }}
                              role="img"
                              aria-label={plan.title}
                            />
                            <div className="flex min-w-0 flex-1 items-start gap-2 py-[var(--space-2)]">
                              <div className="min-w-0 flex-1">
                                <p className={cx(
                                  "truncate text-body-sm font-[var(--fw-semibold)]",
                                  showingFinishedPlans ? FINISHED_PLAN_TITLE_CLASS : ACTIVE_PLAN_TITLE_CLASS
                                )}>{plan.title}</p>
                                <p className={cx("mt-[2px] text-caption", showingFinishedPlans ? "text-tertiary" : "text-muted")}>{formatDateRange(plan.startsAt, plan.endsAt)}</p>
                              </div>
                              <div className={cx("flex shrink-0 items-center gap-0 self-center", showingFinishedPlans ? "text-tertiary" : "text-muted")}>
                                <PlanPinButton
                                  pinned={pinnedPlanIds.includes(plan.id)}
                                  onToggle={(e) => { e.stopPropagation(); togglePin(plan.id); }}
                                  compact
                                />
                                <span className="flex size-11 shrink-0 items-center justify-center" aria-hidden="true">
                                  <svg viewBox="0 0 24 24" fill="none" className="size-[22px]" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 18l6-6-6-6" />
                                  </svg>
                                </span>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {/* Desktop: grid sin borde */}
                    <div className="hidden md:grid md:grid-cols-2 md:gap-x-[var(--space-5)] md:gap-y-[var(--space-6)]">
                      {filteredPlans.map((plan) => {
                        return (
                          <article
                            key={`plan-desktop-${plan.id}`}
                            className={cx("group cursor-pointer", CLICK_MOTION_CLASS)}
                            onClick={() => navigateToPlan(plan.id)}
                          >
                            <div
                              className={cx(
                                "relative h-[160px] w-full overflow-hidden rounded-[10px] bg-cover bg-center bg-no-repeat transition-[filter,opacity] group-hover:opacity-95",
                                showingFinishedPlans && FINISHED_PLAN_IMAGE_CLASS
                              )}
                              style={{ backgroundImage: `url(${plan.coverImage ?? DEFAULT_PLAN_COVER_IMAGE.desktop})` }}
                              role="img"
                              aria-label={plan.title}
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                              <PlanPinButton
                                pinned={pinnedPlanIds.includes(plan.id)}
                                onToggle={(e) => { e.stopPropagation(); togglePin(plan.id); }}
                                className="absolute right-1 top-1 text-app"
                              />
                            </div>
                            <div className="pt-[var(--space-3)]">
                              <p className={cx(
                                "truncate text-[17px] font-[var(--fw-semibold)] leading-[1.2]",
                                showingFinishedPlans ? FINISHED_PLAN_TITLE_CLASS : ACTIVE_PLAN_TITLE_CLASS
                              )}>{plan.title}</p>
                              <p className={cx("mt-[3px] text-caption", showingFinishedPlans ? "text-tertiary" : "text-muted")}>{formatDateRange(plan.startsAt, plan.endsAt)}</p>
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
          filteredPlans={filteredPlans}
          monthLabel={monthLabel}
          yearValue={yearValue}
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

function ViewSwitcher({ viewMode, setViewMode }: { viewMode: CalendarViewMode; setViewMode: (m: CalendarViewMode) => void }) {
  return (
    <div className="grid w-max grid-cols-3 items-center rounded-full border border-app bg-surface-inset p-[3px] md:grid-cols-4">
      {(["year", "month", "week", "day"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setViewMode(mode)}
          className={`flex h-[30px] min-w-[46px] items-center justify-center rounded-full px-2 text-center text-[12px] font-[var(--fw-medium)] transition-colors md:min-w-[56px] ${mode === "week" ? "hidden md:flex md:min-w-[66px]" : ""} ${
            viewMode === mode ? "bg-app text-app shadow-sm" : "text-muted hover:text-app"
          }`}
        >
          {mode === "year" ? "Año" : mode === "month" ? "Mes" : mode === "week" ? "Semana" : "Día"}
        </button>
      ))}
    </div>
  );
}

function YearMonthMini({
  year,
  monthIndex,
  today,
  selectedDay,
  compact = false,
  fit = false,
  onSelectDay,
}: {
  year: number;
  monthIndex: number;
  today: Date;
  selectedDay: Date;
  compact?: boolean;
  fit?: boolean;
  onSelectDay: (day: Date) => void;
}) {
  const monthDate = new Date(year, monthIndex, 1);
  const monthName = compact || fit
    ? MONTHS_SHORT[monthIndex]
    : new Intl.DateTimeFormat("es-ES", { month: "short" }).format(monthDate).replace(".", "");
  const cells = buildYearMonthCells(year, monthIndex);
  const titleClass = compact
    ? "mb-[6px] text-[12px]"
    : fit
      ? "mb-[clamp(5px,1vh,9px)] text-[clamp(16px,2.55vh,27px)] md:text-[30px]"
      : "mb-[var(--space-4)] text-[22px]";
  const gridClass = compact
    ? "gap-x-[1px] gap-y-[2px]"
    : fit
      ? "gap-x-[clamp(3px,0.9vw,6px)] gap-y-[clamp(2px,0.65vh,7px)]"
      : "mt-[var(--space-3)] gap-y-[7px]";
  const dayClass = compact
    ? "size-[13px] text-[8px]"
    : fit
      ? "size-[clamp(14px,2vh,22px)] text-[clamp(7px,1.05vh,14px)] font-[var(--fw-medium)]"
      : "size-8 text-[14px]";

  return (
    <section className={fit ? "min-h-0" : undefined}>
      <h3 className={`${titleClass} text-left font-[var(--fw-semibold)] capitalize leading-none text-app`}>
        {monthName}
      </h3>
      <div className={`${gridClass} grid grid-cols-7 text-center`}>
        {cells.map((cell) => {
          const isToday = toDayKey(cell.date) === toDayKey(today);
          const isSelected = toDayKey(cell.date) === toDayKey(selectedDay);

          if (!cell.isCurrentMonth) {
            return <span key={cell.key} aria-hidden="true" className={dayClass} />;
          }

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDay(cell.date)}
              className={cx(
                "flex items-center justify-center justify-self-center rounded-full transition-colors",
                CALENDAR_DAY_BUTTON_CLASS,
                dayClass,
                getCalendarDayStateClass({ isSelected, isToday })
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </section>
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
  filteredPlans,
  monthLabel,
  yearValue,
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
  filteredPlans: FeedPlanItemDto[];
  monthLabel: string;
  yearValue: number;
  navigateToPlan: (id: number) => void;
  onClose: () => void;
}) {
  const today = startOfDay(new Date());

  // Navigation label and handlers per view
  const navLabel = viewMode === "year"
    ? String(yearValue)
    : viewMode === "month"
      ? monthLabel
      : viewMode === "week"
        ? formatMonthYearHeading(selectedDayValue)
        : selectedDayValue.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const navLabelClass = "whitespace-nowrap text-left text-[22px] font-[var(--fw-semibold)] leading-tight text-app";

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDayValue), index));
  const weekStart = startOfDay(weekDays[0]);
  const weekEnd = endOfDay(weekDays[6]);
  const weekAllDayPlans = filteredPlans
    .filter((plan) => plan.allDay && rangesOverlap(new Date(plan.startsAt), new Date(plan.endsAt), weekStart, weekEnd))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const weekTimedEntries = weekDays.flatMap((day, dayIndex) =>
    filteredPlans
      .filter((plan) => !plan.allDay && rangesOverlap(new Date(plan.startsAt), new Date(plan.endsAt), startOfDay(day), endOfDay(day)))
      .map((plan) => ({ plan, day, dayIndex }))
  );

  const handlePrev = () => {
    if (viewMode === "year") setMonthDate(new Date(yearValue - 1, monthDate.getMonth(), 1));
    else if (viewMode === "month") setMonthDate(addMonths(monthDate, -1));
    else if (viewMode === "week") { const d = addDays(selectedDayValue, -7); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
    else { const d = addDays(selectedDayValue, -1); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
  };
  const handleNext = () => {
    if (viewMode === "year") setMonthDate(new Date(yearValue + 1, monthDate.getMonth(), 1));
    else if (viewMode === "month") setMonthDate(addMonths(monthDate, 1));
    else if (viewMode === "week") { const d = addDays(selectedDayValue, 7); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
    else { const d = addDays(selectedDayValue, 1); setSelectedDay(d); setMonthDate(startOfMonth(d)); }
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-app" role="dialog" aria-modal="true">
      {/* Cabecera */}
      <div className="border-b border-app px-[var(--space-4)] pb-[var(--space-3)] pt-[calc(var(--space-3)+env(safe-area-inset-top))]">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-[var(--space-3)]">
          <div aria-hidden="true" />
          <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
          <div className="flex justify-end">
            <CloseButton onClick={onClose} />
          </div>
        </div>
        <div className="mt-[var(--space-2)] flex items-center justify-start gap-2">
          <IconButton onClick={handlePrev} aria-label="Anterior">
            <svg viewBox="0 0 24 24" fill="none" className="size-[15px]"><path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </IconButton>
          <span className={navLabelClass}>{navLabel}</span>
          <IconButton onClick={handleNext} aria-label="Siguiente">
            <svg viewBox="0 0 24 24" fill="none" className="size-[15px]"><path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </IconButton>
        </div>
      </div>

      {/* Contenido */}
      <div className={viewMode === "year"
        ? "flex-1 overflow-hidden px-[var(--space-4)] pb-[calc(var(--space-4)+env(safe-area-inset-bottom))]"
        : viewMode === "month"
          ? "flex-1 overflow-hidden px-[var(--space-3)] pb-[calc(var(--space-3)+env(safe-area-inset-bottom))] sm:px-[var(--space-4)]"
        : viewMode === "week"
          ? "flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-[var(--space-3)] pb-[calc(var(--space-6)+env(safe-area-inset-bottom))] sm:px-[var(--space-4)]"
          : "flex-1 overflow-y-auto overscroll-contain px-[var(--space-4)] pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]"
      }>
        {viewMode === "year" ? (
          /* ── Vista año ── */
          <div className="grid h-full grid-cols-3 grid-rows-4 gap-x-[clamp(8px,3vw,34px)] gap-y-[clamp(14px,3vh,28px)] pt-[clamp(10px,1.8vh,18px)]">
            {Array.from({ length: 12 }).map((_, i) => (
              <YearMonthMini
                key={i}
                year={yearValue}
                monthIndex={i}
                today={today}
                selectedDay={selectedDayValue}
                fit
                onSelectDay={(day) => {
                  setSelectedDay(startOfDay(day));
                  setMonthDate(startOfMonth(day));
                  setViewMode("day");
                }}
              />
            ))}
          </div>
        ) : viewMode === "month" ? (
          /* ── Vista mes ── */
          <div className="flex h-full min-h-0 flex-col">
            <div className="sticky top-0 z-20 grid shrink-0 grid-cols-7 gap-x-1 gap-y-2 border-b border-app bg-app pb-[clamp(6px,1vh,12px)] pt-[clamp(6px,1vh,12px)] text-center">
              {WEEK_DAYS.map((d) => (
                <div key={d} className="text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted sm:text-[13px]">{d}</div>
              ))}
            </div>
            <div
              className="mt-[clamp(4px,0.8vh,12px)] grid min-h-0 flex-1"
              style={{ gridTemplateRows: `repeat(${calendarWeeks.length}, minmax(0, 1fr))` }}
            >
              {calendarWeeks.map((week, weekIndex) => (
                <div key={week.key} className={`relative flex min-h-0 flex-col px-1 py-[clamp(2px,0.55vh,8px)] ${weekIndex === 0 ? "" : "border-t border-app"}`}>
                  <div className="grid shrink-0 grid-cols-7 gap-x-1">
                    {week.days.map((cell) => {
                      const isCellToday = toDayKey(cell.date) === toDayKey(today);
                      const isSelected = toDayKey(cell.date) === toDayKey(selectedDayValue);
                      return (
                        <button type="button" key={cell.key}
                          onClick={() => { setSelectedDay(startOfDay(cell.date)); setMonthDate(startOfMonth(cell.date)); setViewMode("day"); }}
                          className={cx(
                            "flex size-[clamp(24px,4.3vh,36px)] items-center justify-center justify-self-center rounded-full text-[clamp(12px,1.9vh,15px)]",
                            CALENDAR_DAY_BUTTON_CLASS,
                            getCalendarDayStateClass({
                              isSelected,
                              isToday: isCellToday,
                              isCurrentMonth: cell.isCurrentMonth,
                            })
                          )}
                        >{cell.day}</button>
                      );
                    })}
                  </div>
                  <div className="mt-[clamp(2px,0.45vh,8px)] min-h-0 space-y-[clamp(2px,0.35vh,4px)] overflow-hidden">
                    {[0, 1].map((laneIndex) => {
                      const lane = weekSegments[weekIndex]?.lanes[laneIndex] ?? [];
                      return (
                        <div key={`${week.key}-lane-${laneIndex}`} className="grid grid-cols-7 gap-x-1">
                          {lane.length ? lane.map((segment) => (
                            <div key={segment.key}
                              className={cx(CALENDAR_PLAN_PILL_BASE_CLASS, CALENDAR_PLAN_PILL_COMPACT_CLASS)}
                              style={{ gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}` }}
                              title={segment.title}
                              onClick={() => { navigateToPlan(segment.planId); onClose(); }}>
                              <span className="block truncate">{segment.title}</span>
                            </div>
                          )) : <div className="h-[clamp(13px,2.15vh,22px)]" aria-hidden="true" />}
                        </div>
                      );
                    })}
                  </div>
                  {weekSegments[weekIndex]?.hiddenCount ? (
                    <p className="pointer-events-none absolute bottom-[2px] right-1 text-[9px] leading-none text-muted">+{weekSegments[weekIndex].hiddenCount}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === "week" ? (
          /* ── Vista semana ── */
          <div className="flex w-full min-w-0 flex-col pt-[var(--space-2)]">
            <div className="sticky top-0 z-20 bg-app">
              <div className="grid grid-cols-[40px_repeat(7,minmax(0,1fr))] border-b border-app text-center sm:grid-cols-[48px_repeat(7,minmax(0,1fr))]">
                <div aria-hidden="true" />
                {weekDays.map((day, index) => {
                  const isCurrentDay = toDayKey(day) === toDayKey(today);
                  return (
                    <div
                      key={toDayKey(day)}
                      className="flex min-w-0 flex-col items-center justify-center gap-[3px] px-[1px] pb-[var(--space-2)] pt-[var(--space-2)] text-app sm:flex-row sm:gap-[6px] sm:px-1"
                    >
                      <span className={`${isCurrentDay ? "font-[var(--fw-semibold)] text-app" : "font-[var(--fw-regular)] text-muted"} text-[11px] leading-none sm:text-[15px]`}>
                        {WEEK_DAYS_MONDAY_SHORT[index]}
                      </span>
                      <span className={`flex size-6 items-center justify-center rounded-full text-[13px] sm:size-7 sm:text-[15px] ${
                        isCurrentDay
                          ? "border border-[color-mix(in_srgb,var(--primary)_42%,var(--border)_58%)] bg-[color-mix(in_srgb,var(--primary)_24%,var(--surface)_76%)] font-[var(--fw-semibold)] text-app"
                          : "font-[var(--fw-regular)] text-app"
                      }`}>
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="grid min-h-[42px] grid-cols-[40px_repeat(7,minmax(0,1fr))] border-b border-app sm:grid-cols-[48px_repeat(7,minmax(0,1fr))]">
                <div className="flex items-start justify-end pr-[5px] pt-[9px] text-right text-[9px] font-[var(--fw-semibold)] leading-tight text-muted sm:pr-[8px] sm:text-[11px]">
                  todo<br className="sm:hidden" /> el día
                </div>
                {weekDays.map((day) => {
                  const dayPlans = weekAllDayPlans.filter((plan) =>
                    rangesOverlap(new Date(plan.startsAt), new Date(plan.endsAt), startOfDay(day), endOfDay(day))
                  );
                  return (
                    <div key={`week-all-day-${toDayKey(day)}`} className="min-h-[42px] border-l border-app px-[2px] py-[4px]">
                      <div className="space-y-[3px]">
                        {dayPlans.slice(0, 2).map((plan) => (
                          <button
                            key={`week-all-day-${toDayKey(day)}-${plan.id}`}
                            type="button"
                            onClick={() => { navigateToPlan(plan.id); onClose(); }}
                            className="block h-[17px] w-full truncate rounded-[5px] bg-[var(--primary)]/15 px-[4px] text-left text-[9px] font-[var(--fw-semibold)] leading-[17px] text-app sm:text-[10px]"
                          >
                            {plan.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              {Array.from({ length: 24 }).map((_, hour) => (
                <div key={`week-hour-${hour}`} className="grid h-[64px] grid-cols-[40px_repeat(7,minmax(0,1fr))] sm:grid-cols-[48px_repeat(7,minmax(0,1fr))]">
                  <div className="relative">
                    <span className="absolute right-[5px] top-0 -translate-y-1/2 text-right text-[10px] font-[var(--fw-semibold)] leading-none text-muted sm:right-[8px] sm:text-[12px]">
                      {hour}:00
                    </span>
                  </div>
                  {weekDays.map((day) => (
                    <div key={`${toDayKey(day)}-${hour}`} className="border-l border-t border-app/40" />
                  ))}
                </div>
              ))}
              <div className="pointer-events-none absolute inset-y-0 left-[40px] right-0 sm:left-[48px]">
                {weekTimedEntries.map(({ plan, day, dayIndex }) => {
                  const startMinutes = getMinutesWithinDay(plan.startsAt, day);
                  const endMinutes = getMinutesWithinDay(plan.endsAt, day, true);
                  const duration = Math.max(endMinutes - startMinutes, 30);
                  return (
                    <div
                      key={`week-timed-${plan.id}-${toDayKey(day)}`}
                      className="pointer-events-auto absolute cursor-pointer overflow-hidden rounded-[7px] bg-[var(--primary)]/15 px-[4px] py-1 text-app transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:translate-y-[1px] active:scale-[0.98] sm:px-2 sm:py-1.5"
                      style={{
                        top: `${(startMinutes / 60) * 64}px`,
                        left: `calc(${dayIndex} * (100% / 7) + 1px)`,
                        width: "calc((100% / 7) - 2px)",
                        height: `${Math.max((duration / 60) * 64, 24)}px`,
                      }}
                      onClick={() => { navigateToPlan(plan.id); onClose(); }}
                    >
                      <p className="truncate text-[9px] font-[var(--fw-semibold)] leading-tight sm:text-[11px]">{plan.title}</p>
                      <p className="mt-0.5 hidden truncate text-[10px] text-muted sm:block">
                        {formatTimeRange(clampDateTimeToDay(plan.startsAt, day).toISOString(), clampDateTimeToDay(plan.endsAt, day, true).toISOString())}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ── Vista día ── */
          <div className="flex flex-col pt-[var(--space-3)]">
            {/* All-day plans */}
            {allDayPlans.length > 0 && (
              <div className="mb-[var(--space-3)] grid grid-cols-[44px_minmax(0,1fr)] border-b border-app pb-[var(--space-2)]">
                <div className="pr-2 pt-[3px] text-right text-[11px] font-[var(--fw-semibold)] leading-tight text-muted">
                  todo<br />el día
                </div>
                <div className="space-y-[4px]">
                  {allDayPlans.map((plan) => (
                    <button
                      key={`modal-allday-${plan.id}`}
                      type="button"
                      onClick={() => { navigateToPlan(plan.id); onClose(); }}
                      className={cx(CALENDAR_PLAN_PILL_BASE_CLASS, CALENDAR_PLAN_PILL_COMPACT_CLASS, "block w-full text-left")}
                    >
                      <span className="block truncate">{plan.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* 24h timeline */}
            <div className="relative">
              {Array.from({ length: 24 }).map((_, hour) => (
                <div key={`modal-hour-${hour}`} className="grid h-16 grid-cols-[44px_minmax(0,1fr)]">
                  <div className="relative">
                    <span className="absolute right-2 top-0 -translate-y-1/2 text-right text-[12px] leading-none text-muted">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
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
                      className="pointer-events-auto absolute left-2 right-2 cursor-pointer overflow-hidden rounded-[10px] bg-[var(--primary)]/15 px-3 py-2 text-app transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:translate-y-[1px] active:scale-[0.98]"
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

function startOfWeek(date: Date) {
  const current = startOfDay(date);
  const mondayFirstOffset = (current.getDay() + 6) % 7;
  return addDays(current, -mondayFirstOffset);
}

function formatMonthYearHeading(date: Date) {
  const label = date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
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
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7;

  const cells: CalendarCell[] = [];

  for (let offset = mondayFirstOffset; offset > 0; offset -= 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1 - offset);
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
      daysInMonth + (cells.length - (mondayFirstOffset + daysInMonth)) + 1,
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

function buildYearMonthCells(year: number, monthIndex: number): CalendarCell[] {
  const firstDay = new Date(year, monthIndex, 1);
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
  const cells: CalendarCell[] = [];

  for (let offset = mondayFirstOffset; offset > 0; offset -= 1) {
    const date = new Date(year, monthIndex, 1 - offset);
    cells.push({
      key: `year-prev-${toDayKey(date)}`,
      date,
      day: date.getDate(),
      isCurrentMonth: false,
    });
  }

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day);
    cells.push({
      key: `year-curr-${toDayKey(date)}`,
      date,
      day,
      isCurrentMonth: true,
    });
  }

  while (cells.length < 42) {
    const date = new Date(year, monthIndex, daysInMonth + (cells.length - (mondayFirstOffset + daysInMonth)) + 1);
    cells.push({
      key: `year-next-${toDayKey(date)}-${cells.length}`,
      date,
      day: date.getDate(),
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
