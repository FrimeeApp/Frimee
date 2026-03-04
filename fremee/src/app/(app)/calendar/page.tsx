"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import type { CalendarEventDto } from "@/services/api/dtos/event.dto";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import {
  listUserCalendarEventsByRange,
  syncGoogleCalendarBidirectional,
} from "@/services/api/repositories/events.repository";
import { listUserRelatedPlans } from "@/services/api/repositories/plans.repository";

type PlanTab = "active" | "done";

type DayOccupancy = {
  count: number;
  hasAllDay: boolean;
  hasTimed: boolean;
  hasInformative: boolean;
};

type CalendarCell = {
  key: string;
  date: Date;
  day: number;
  isCurrentMonth: boolean;
};

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const WEEK_DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

export default function CalendarPage() {
  const { user, session, settings, loading: authLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [plans, setPlans] = useState<FeedPlanItemDto[]>([]);
  const [events, setEvents] = useState<CalendarEventDto[]>([]);
  const [tab, setTab] = useState<PlanTab>("active");
  const [planSearch, setPlanSearch] = useState("");
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const autoSyncTriggeredRef = useRef(false);

  useEffect(() => {
    autoSyncTriggeredRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setPlans([]);
      setEvents([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rangeStart = startOfMonth(addMonths(new Date(), -12)).toISOString();
        const rangeEnd = endOfMonth(addMonths(new Date(), 12)).toISOString();

        const [plansResult, eventsResult] = await Promise.all([
          listUserRelatedPlans({ userId: user.id, limit: 300 }),
          listUserCalendarEventsByRange({
            userId: user.id,
            rangeStartAt: rangeStart,
            rangeEndAt: rangeEnd,
            limit: 1000,
          }),
        ]);

        if (cancelled) return;
        setPlans(plansResult);
        setEvents(eventsResult);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof Error) {
          console.error("[calendar] error loading calendar data", {
            message: loadError.message,
            name: loadError.name,
          });
        } else {
          console.error("[calendar] error loading calendar data", loadError);
        }
        setError("No se pudieron cargar tus datos del calendario.");
        setPlans([]);
        setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, reloadNonce]);

  const runGoogleSync = useCallback(async () => {
    if (!user?.id || syncingGoogle) return;
    const providerToken = (session as { provider_token?: string | null } | null)?.provider_token ?? null;

    if (!providerToken) {
      setError("No hay token de Google Calendar. Cierra sesion e inicia con Google de nuevo para conceder permisos.");
      return;
    }

    setSyncingGoogle(true);
    setError(null);

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
      setReloadNonce((prev) => prev + 1);
    } catch (syncError) {
      if (syncError instanceof Error) {
        setError(`No se pudo sincronizar Google Calendar: ${syncError.message}`);
      } else {
        setError("No se pudo sincronizar Google Calendar.");
      }
    } finally {
      setSyncingGoogle(false);
    }
  }, [plans, session, settings?.google_sync_enabled, settings?.google_sync_export_plans, syncingGoogle, user?.id]);

  useEffect(() => {
    if (authLoading || loading) return;
    if (!user?.id) return;
    if (!settings?.google_sync_enabled) return;
    if (autoSyncTriggeredRef.current) return;

    autoSyncTriggeredRef.current = true;
    void runGoogleSync();
  }, [authLoading, loading, runGoogleSync, settings?.google_sync_enabled, user?.id]);

  const visiblePlans = useMemo(() => {
    const startToday = startOfDay(new Date());
    return plans.filter((plan) => {
      const endsAt = new Date(plan.endsAt);
      return tab === "active" ? endsAt >= startToday : endsAt < startToday;
    });
  }, [plans, tab]);

  const visibleEvents = useMemo(() => {
    const startToday = startOfDay(new Date());
    return events.filter((event) => {
      const endsAt = new Date(event.endsAt);
      return tab === "active" ? endsAt >= startToday : endsAt < startToday;
    });
  }, [events, tab]);

  const selectedDayDate = useMemo(() => dayKeyToDate(selectedDayKey), [selectedDayKey]);

  const filteredPlans = useMemo(() => {
    const dayFilteredPlans = !selectedDayDate
      ? visiblePlans
      : visiblePlans.filter((plan) => {
          const startsAt = new Date(plan.startsAt);
          const endsAt = new Date(plan.endsAt);
          const dayStart = startOfDay(selectedDayDate);
          const dayEnd = endOfDay(selectedDayDate);
          return rangesOverlap(startsAt, endsAt, dayStart, dayEnd);
        });

    const query = planSearch.trim().toLowerCase();
    if (!query) return dayFilteredPlans;
    return dayFilteredPlans.filter((plan) => plan.title.toLowerCase().includes(query));
  }, [visiblePlans, selectedDayDate, planSearch]);
  const selectedDayEvents = useMemo(() => {
    if (!selectedDayDate) return [] as CalendarEventDto[];
    const dayStart = startOfDay(selectedDayDate);
    const dayEnd = endOfDay(selectedDayDate);
    return visibleEvents.filter((event) => {
      const startsAt = new Date(event.startsAt);
      const endsAt = new Date(event.endsAt);
      return rangesOverlap(startsAt, endsAt, dayStart, dayEnd);
    });
  }, [selectedDayDate, visibleEvents]);

  const calendarCells = useMemo(() => buildCalendarCells(monthDate), [monthDate]);

  const occupancyMap = useMemo(() => {
    const map = new Map<string, DayOccupancy>();

    const appendItem = (startsAtIso: string, endsAtIso: string, isAllDay: boolean) => {
      const firstDay = startOfDay(new Date(startsAtIso));
      const lastDay = startOfDay(new Date(endsAtIso));

      for (let cursor = new Date(firstDay); cursor <= lastDay; cursor.setDate(cursor.getDate() + 1)) {
        const key = toDayKey(cursor);
        const prev = map.get(key) ?? { count: 0, hasAllDay: false, hasTimed: false, hasInformative: false };
        map.set(key, {
          count: prev.count + 1,
          hasAllDay: prev.hasAllDay || isAllDay,
          hasTimed: prev.hasTimed || !isAllDay,
          hasInformative: prev.hasInformative,
        });
      }
    };

    for (const plan of visiblePlans) {
      const firstDay = startOfDay(new Date(plan.startsAt));
      const lastDay = startOfDay(new Date(plan.endsAt));

      for (let cursor = new Date(firstDay); cursor <= lastDay; cursor.setDate(cursor.getDate() + 1)) {
        const dayMode = getPlanDayOccupation(plan, cursor);
        if (dayMode === "none") continue;
        const key = toDayKey(cursor);
        const prev = map.get(key) ?? { count: 0, hasAllDay: false, hasTimed: false, hasInformative: false };
        map.set(key, {
          count: prev.count + 1,
          hasAllDay: prev.hasAllDay || dayMode === "all_day",
          hasTimed: prev.hasTimed || dayMode === "partial",
          hasInformative: prev.hasInformative,
        });
      }
    }

    for (const event of visibleEvents) {
      if (isNonBlockingGoogleHoliday(event)) {
        const firstDay = startOfDay(new Date(event.startsAt));
        const lastDay = startOfDay(new Date(event.endsAt));
        for (let cursor = new Date(firstDay); cursor <= lastDay; cursor.setDate(cursor.getDate() + 1)) {
          const key = toDayKey(cursor);
          const prev = map.get(key) ?? { count: 0, hasAllDay: false, hasTimed: false, hasInformative: false };
          map.set(key, {
            count: prev.count,
            hasAllDay: prev.hasAllDay,
            hasTimed: prev.hasTimed,
            hasInformative: true,
          });
        }
        continue;
      }
      appendItem(event.startsAt, event.endsAt, event.allDay);
    }

    return map;
  }, [visiblePlans, visibleEvents]);

  const monthLabel = `${MONTHS_SHORT[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  if (authLoading || loading) return <LoadingScreen />;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((prev) => !prev)} />

        <main
          className={`px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] lg:py-[var(--space-8)] lg:pr-[var(--space-14)] ${
            sidebarCollapsed ? "lg:pl-[56px]" : "lg:pl-[136px]"
          }`}
        >
          <div className="mx-auto w-full max-w-[1040px]">
            <div className="flex items-center justify-between gap-[var(--space-4)] border-b border-app pb-[var(--space-2)] text-body text-muted">
              <div className="flex items-center gap-[var(--space-4)]">
                <div className="flex gap-[var(--space-10)]">
                <button
                  type="button"
                  onClick={() => setTab("active")}
                  className={tab === "active" ? "font-[var(--fw-medium)] text-app" : "font-[var(--fw-medium)]"}
                >
                  Activos
                </button>
                <button
                  type="button"
                  onClick={() => setTab("done")}
                  className={tab === "done" ? "font-[var(--fw-medium)] text-app" : "font-[var(--fw-medium)]"}
                >
                  Finalizados
                </button>
                </div>

                <input
                  type="text"
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                  placeholder="Buscar plan..."
                  className="h-[34px] w-[180px] rounded-input border border-app bg-app px-3 text-body-sm text-app outline-none"
                />
              </div>

              {syncingGoogle ? <span className="text-body-sm text-muted">Sincronizando Google...</span> : null}
            </div>

            <div className="mt-[var(--space-5)] grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-[var(--space-8)]">
              <section className="space-y-[var(--space-4)]">
                {error ? <p className="text-body text-error-token">{error}</p> : null}
                {!error && filteredPlans.length === 0 ? (
                  <p className="rounded-modal border border-app bg-surface p-[var(--space-4)] text-body text-muted">
                    {planSearch.trim()
                      ? "No hay planes con ese nombre."
                      : selectedDayDate
                        ? "No hay planes para este dia."
                        : "No hay planes para mostrar."}
                  </p>
                ) : null}

                {filteredPlans.map((plan) => {
                  const creatorLabel = plan.creator.id === user?.id ? "Creado por ti" : `De ${plan.creator.name}`;
                  const scheduleLabel = formatPlanSchedule(plan);

                  return (
                    <article key={`plan-${plan.id}`} className="overflow-hidden rounded-modal border border-app bg-surface shadow-elev-1">
                      <div>
                        <div
                          className="relative h-[148px] bg-cover bg-center bg-no-repeat"
                          role="img"
                          aria-label={plan.title}
                          style={{ backgroundImage: `url(${plan.coverImage ?? "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80"})` }}
                        >
                          <span className="absolute right-3 top-3 rounded-chip border border-app bg-surface/90 px-3 py-1 text-caption text-muted">
                            Plan
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-[var(--space-4)] p-[var(--space-4)]">
                          <div>
                            <h2 className="text-[30px] font-[var(--fw-semibold)] leading-[1.15] text-app sm:text-[34px] lg:text-[36px]">
                              {plan.title}
                            </h2>
                            <p className="mt-1 text-body text-muted">{formatDateRange(plan.startsAt, plan.endsAt)}</p>
                            <p className="mt-1 text-body-sm text-tertiary">{creatorLabel}</p>
                          </div>

                          <span className="shrink-0 rounded-input border border-success-token bg-[color-mix(in_srgb,var(--success)_16%,white_84%)] px-4 py-3 text-body-sm text-success-token">
                            {scheduleLabel}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>

              <aside className="rounded-modal border border-app bg-surface p-[var(--space-4)] shadow-elev-1 lg:sticky lg:top-[var(--space-6)] lg:self-start">
                <div className="mb-[var(--space-2)] flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Mes anterior"
                    onClick={() => setMonthDate((prev) => addMonths(prev, -1))}
                    className="rounded-input border border-app px-3 py-1 text-body"
                  >
                    {"<"}
                  </button>
                  <div className="text-body-sm font-[var(--fw-medium)]">{monthLabel}</div>
                  <button
                    type="button"
                    aria-label="Mes siguiente"
                    onClick={() => setMonthDate((prev) => addMonths(prev, 1))}
                    className="rounded-input border border-app px-3 py-1 text-body"
                  >
                    {">"}
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-y-2 text-center">
                  {WEEK_DAYS.map((weekDay) => (
                    <div key={weekDay} className="text-caption text-muted">
                      {weekDay}
                    </div>
                  ))}

                  {calendarCells.map((cell) => {
                    const dayData = occupancyMap.get(toDayKey(cell.date));
                    const isBusy = Boolean(dayData?.count);
                    const allDay = Boolean(dayData?.hasAllDay);
                    const partiallyBusy = Boolean(dayData?.hasTimed) && !allDay;
                    const informativeOnly = Boolean(dayData?.hasInformative) && !isBusy;
                    const dayKey = toDayKey(cell.date);
                    const isSelected = selectedDayKey === dayKey;

                    return (
                      <button
                        type="button"
                        key={cell.key}
                        onClick={() => setSelectedDayKey((prev) => (prev === dayKey ? null : dayKey))}
                        title={
                          dayData
                            ? informativeOnly
                              ? "Dia con informacion"
                              : `${dayData.count} elemento(s)`
                            : "Sin elementos"
                        }
                        className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-input text-body transition-colors ${
                          allDay
                            ? "bg-error-token text-contrast-token"
                            : partiallyBusy
                              ? "border border-warning-token bg-[color-mix(in_srgb,var(--warning)_16%,white_84%)] text-warning-token"
                              : "border border-success-token bg-[color-mix(in_srgb,var(--success)_16%,white_84%)] text-success-token"
                        } ${!cell.isCurrentMonth ? "opacity-60" : ""} ${isSelected ? "ring-2 ring-[var(--primary)] ring-offset-1" : ""}`}
                      >
                        {cell.day}
                        {isBusy && partiallyBusy ? (
                          <span className="absolute bottom-[4px] h-1.5 w-1.5 rounded-chip bg-warning-token" aria-hidden="true" />
                        ) : null}
                        {informativeOnly ? (
                          <span className="absolute bottom-[4px] h-1.5 w-1.5 rounded-chip bg-info-token" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-[var(--space-4)] rounded-input border border-app bg-app p-[var(--space-3)]">
                  <h4 className="text-body-sm font-[var(--fw-semibold)]">
                    {selectedDayDate ? formatSelectedDayLabel(selectedDayDate) : "Sin dia seleccionado"}
                  </h4>

                  <div className="mt-[var(--space-2)] space-y-2">
                    {!selectedDayDate ? (
                      <p className="text-body-sm text-muted">Selecciona un dia para ver sus eventos.</p>
                    ) : selectedDayEvents.length === 0 ? (
                      <p className="text-body-sm text-muted">Sin eventos para este dia.</p>
                    ) : (
                      selectedDayEvents
                        .sort((a, b) => {
                          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
                          return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
                        })
                        .map((event) => (
                        <div key={`selected-event-${event.id}`} className="rounded-input border border-app bg-surface p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-body-sm font-[var(--fw-medium)]">{event.title}</span>
                            <span className="text-caption text-muted">
                              {event.allDay ? "Todo el dia" : formatTimeRange(event.startsAt, event.endsAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-caption text-tertiary">
                            Evento | {event.category} | {event.source === "GOOGLE" ? "Google" : "Local"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </main>
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function toDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayKeyToDate(dayKey: string | null) {
  if (!dayKey) return null;
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && aEnd >= bStart;
}

function getPlanDayOccupation(plan: FeedPlanItemDto, dayDate: Date): "none" | "all_day" | "partial" {
  const startsAt = new Date(plan.startsAt);
  const endsAt = new Date(plan.endsAt);
  const dayStart = startOfDay(dayDate);
  const dayEnd = endOfDay(dayDate);

  if (!rangesOverlap(startsAt, endsAt, dayStart, dayEnd)) return "none";
  if (plan.allDay) return "all_day";

  const startKey = toDayKey(startsAt);
  const endKey = toDayKey(endsAt);
  const currentKey = toDayKey(dayDate);

  if (startKey === endKey) return "partial";
  if (currentKey === startKey || currentKey === endKey) return "partial";
  return "all_day";
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

function formatSelectedDayLabel(date: Date) {
  const raw = date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatTimeRange(startsAtIso: string, endsAtIso: string) {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(endsAtIso);
  const startTime = startsAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const endTime = endsAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${startTime} - ${endTime}`;
}

function isNonBlockingGoogleHoliday(event: CalendarEventDto) {
  if (event.source !== "GOOGLE") return false;
  const calendarId = (event.googleCalendarId ?? "").toLowerCase();
  const title = (event.title ?? "").toLowerCase();

  return (
    calendarId.includes("holiday") ||
    calendarId.includes("festiv") ||
    title.includes("holiday") ||
    title.includes("festivo")
  );
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
