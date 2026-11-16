"use client";

import { useMemo } from "react";
import { ChevronRight, Plus } from "lucide-react";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { capitalize, formatPlanRange, startOfDay } from "../home/homeSections";
import { FOCUS, LABEL, PlanCover, SERIF, TEXT_BTN, TripProgress } from "../home/pieces";
import type { OpenPlan } from "../home/blocks";
import {
  MONTHS,
  MONTHS_SHORT,
  WEEKDAYS,
  activitiesOfDay,
  activityState,
  addDays,
  byListOrder,
  byPriority,
  covers,
  dayAria,
  dayKey,
  dayOfPlan,
  hhmm,
  kindOf,
  monthWeeks,
  periodOf,
  plansBetween,
  planEnd,
  planStart,
  sameDay,
  weekBars,
  weekLane,
  weekdayName,
  type Bar,
  type CalMode,
  type Kind,
} from "./calendarModel";
import { usePlanActivities } from "./hooks";
import { DayTimeline, PlanAside, PlanListRow, barTone, thinBarTone, type DayItem } from "./parts";

export type ViewProps = {
  plans: FeedPlanItemDto[];
  date: Date;
  desktop: boolean;
  onOpen: OpenPlan;
  go: (mode: CalMode, date: Date) => void;
  onCreate: (from: Date, to: Date) => void;
};

function plansCount(n: number) {
  return `${n} ${n === 1 ? "plan" : "planes"}`;
}

/** «Nuevo plan en estas fechas»: from today when it falls in the period, else from its first day. */
function createFrom(from: Date, to: Date) {
  const today = startOfDay(new Date());
  return today >= from && today <= to ? today : from;
}

function TodayCircle({ size, text, children }: { size: number; text: number; children: React.ReactNode }) {
  return (
    <span
      aria-current="date"
      className="flex items-center justify-center rounded-full bg-[var(--chat-accent-text)] font-[var(--fw-semibold)] tabular-nums text-contrast-token"
      style={{ width: size, height: size, fontSize: text }}
    >
      {children}
    </span>
  );
}

function WeekdayHeader() {
  return (
    <div className="grid h-7 grid-cols-7 items-center">
      {WEEKDAYS.map(([s, l]) => (
        <abbr key={s} title={l} className={`${LABEL} text-center no-underline`}>
          {s}
        </abbr>
      ))}
    </div>
  );
}

/* ───────────── Año ───────────── */

const YEAR_CELL: Record<Kind, string> = {
  ongoing: "bg-[var(--chat-accent-text)] text-contrast-token",
  upcoming: "bg-[var(--chat-me)] text-app shadow-[inset_0_0_0_1px_var(--primary)]",
  finished: "bg-[var(--text-secondary)] text-[var(--bg)]",
};

export function YearView({ plans, date, desktop, onOpen, go, onCreate }: ViewProps) {
  const year = date.getFullYear();
  const { from, to } = useMemo(() => periodOf("ano", date), [date]);
  const today = startOfDay(new Date());
  const inYear = useMemo(() => plansBetween(plans, from, to), [plans, from, to]);

  // Each day takes the colour of its most important plan (in progress > upcoming > finished).
  const dayKind = useMemo(() => {
    const map = new Map<string, Kind>();
    for (const p of [...inYear].reverse()) {
      const kind = kindOf(p);
      const last = planEnd(p) > to ? to : planEnd(p);
      for (let d = planStart(p) < from ? from : planStart(p); d <= last; d = addDays(d, 1)) map.set(dayKey(d), kind);
    }
    return map;
  }, [inYear, from, to]);

  // Desktop: up to 22 px, shrinking with the width so the 12 months always fit in 4 columns.
  const cell = desktop ? 22 : 12;
  const grid = (
    <div
      className={desktop ? "grid min-w-0 flex-1 grid-cols-4 gap-x-5 gap-y-4" : "grid grid-cols-3 gap-x-3.5 gap-y-2 px-4"}
    >
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1);
        const offset = (first.getDay() + 6) % 7;
        const count = new Date(year, m + 1, 0).getDate();
        const isCurrent = year === today.getFullYear() && m === today.getMonth();
        const planned = new Set(inYear.filter((p) => planStart(p) <= new Date(year, m, count) && planEnd(p) >= first).map((p) => p.id)).size;
        return (
          <button
            key={m}
            type="button"
            aria-label={`${MONTHS[m]} ${year}${planned ? `, ${plansCount(planned)}` : ""}`}
            onClick={() => go("mes", first)}
            className={`flex min-w-0 flex-col gap-1.5 text-left ${desktop ? "" : "py-1.5"} ${FOCUS} rounded-[6px]`}
          >
            <span className={`${desktop ? "text-[14px]" : "text-[13px]"} font-[var(--fw-semibold)] ${isCurrent ? "text-[var(--chat-accent-text)]" : "text-app"}`}>
              {capitalize(MONTHS[m])}
            </span>
            <span
              aria-hidden
              className="grid gap-[2px]"
              style={{ gridTemplateColumns: desktop ? `repeat(7, minmax(0, ${cell}px))` : `repeat(7, ${cell}px)` }}
            >
              {Array.from({ length: offset }, (_, i) => (
                <span key={`pad-${i}`} className={desktop ? "aspect-square w-full" : ""} style={desktop ? undefined : { width: cell, height: cell }} />
              ))}
              {Array.from({ length: count }, (_, i) => {
                const d = new Date(year, m, i + 1);
                const kind = dayKind.get(dayKey(d));
                const isToday = d.getTime() === today.getTime();
                return (
                  <span
                    key={i}
                    className={`flex items-center justify-center text-[10px] tabular-nums ${desktop ? "aspect-square w-full" : ""} ${kind ? YEAR_CELL[kind] : "bg-surface-2 text-app"} ${
                      isToday ? "outline outline-2 outline-offset-1 outline-[var(--text-primary)]" : ""
                    }`}
                    style={desktop ? { borderRadius: 5 } : { width: cell, height: cell, borderRadius: 3 }}
                  >
                    {desktop ? i + 1 : null}
                  </span>
                );
              })}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (desktop) {
    return (
      <div className="flex items-start gap-10">
        {grid}
        <PlanAside
          title={`${year} · ${plansCount(inYear.length)}`}
          plans={[...inYear].sort(byListOrder)}
          empty={`Nada planeado en ${year}`}
          onOpen={onOpen}
          onCreate={() => {
            const f = createFrom(from, to);
            onCreate(f, addDays(f, 1));
          }}
        />
      </div>
    );
  }

  const legend: Array<[string, string]> = [
    ["En curso", YEAR_CELL.ongoing],
    ["Próximos", YEAR_CELL.upcoming],
    ["Finalizados", YEAR_CELL.finished],
  ];
  return (
    <div className="pb-4">
      {grid}
      <div className="flex flex-wrap gap-4 px-4 pt-2">
        {legend.map(([label, cls]) => (
          <span key={label} className="flex items-center gap-1.5 text-[12px] text-muted">
            <span aria-hidden className={`size-3 rounded-[3px] ${cls}`} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <span aria-hidden className="size-3 rounded-[3px] outline outline-2 outline-offset-1 outline-[var(--text-primary)]" />
          Hoy
        </span>
      </div>
    </div>
  );
}

/* ───────────── Mes ───────────── */

export function MonthView({ plans, date, desktop, onOpen, go, onCreate }: ViewProps) {
  const month = useMemo(() => new Date(date.getFullYear(), date.getMonth(), 1), [date]);
  const { from, to } = useMemo(() => periodOf("mes", month), [month]);
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const inMonth = useMemo(() => plansBetween(plans, from, to), [plans, from, to]);
  const listed = useMemo(() => [...inMonth].sort(byListOrder), [inMonth]);
  const today = startOfDay(new Date());
  const monthName = MONTHS[month.getMonth()];

  const dayNumber = (d: Date, size: number) => {
    const out = d.getMonth() !== month.getMonth();
    if (d.getTime() === today.getTime()) return <TodayCircle size={size} text={14}>{d.getDate()}</TodayCircle>;
    return (
      <span className={`flex h-7 items-center text-[14px] tabular-nums ${out ? "text-muted opacity-60" : "text-app"}`}>{d.getDate()}</span>
    );
  };

  if (!desktop) {
    return (
      <div className="pb-4">
        <div className="px-3">
          <WeekdayHeader />
          {weeks.map((days) => {
            const { segments, dots } = weekLane(inMonth, days, month);
            return (
              <div key={days[0].getTime()} className="relative h-[52px] border-t border-app">
                {days.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={dayAria(d)}
                    onClick={() => go("dia", d)}
                    className={`absolute inset-y-0 flex justify-center pt-1 ${FOCUS}`}
                    style={{ left: `${(i * 100) / 7}%`, width: `${100 / 7}%` }}
                  >
                    {dayNumber(d, 28)}
                  </button>
                ))}
                {segments.map((seg) => (
                  <div
                    key={`${seg.plan.id}-${seg.from}`}
                    aria-hidden
                    className={`pointer-events-none absolute top-[38px] h-1.5 ${thinBarTone(kindOf(seg.plan))}`}
                    style={{
                      left: `calc(${(seg.from * 100) / 7}% + ${seg.roundLeft ? 3 : 0}px)`,
                      width: `calc(${((seg.to - seg.from + 1) * 100) / 7}% - ${(seg.roundLeft ? 3 : 0) + (seg.roundRight ? 3 : 0)}px)`,
                      borderRadius: `${seg.roundLeft ? 3 : 0}px ${seg.roundRight ? 3 : 0}px ${seg.roundRight ? 3 : 0}px ${seg.roundLeft ? 3 : 0}px`,
                    }}
                  />
                ))}
                {dots.map((i) => (
                  <span
                    key={`dot-${i}`}
                    aria-hidden
                    className="pointer-events-none absolute top-[46px] size-1 -translate-x-1/2 rounded-full bg-[var(--text-secondary)]"
                    style={{ left: `${((i + 0.5) * 100) / 7}%` }}
                  />
                ))}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex min-h-10 items-center px-4">
          <h2 className={LABEL}>
            {listed.length ? `En ${monthName} · ${plansCount(listed.length)}` : `Nada planeado en ${monthName}`}
          </h2>
        </div>
        {listed.length ? (
          <ul>
            {listed.map((p) => (
              <PlanListRow key={p.id} plan={p} onOpen={onOpen} />
            ))}
          </ul>
        ) : (
          <div className="px-4">
            <button
              type="button"
              onClick={() => {
                const f = createFrom(from, to);
                onCreate(f, addDays(f, 1));
              }}
              className={`${TEXT_BTN} ${FOCUS}`}
            >
              <Plus size={18} aria-hidden />
              Nuevo plan
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-10">
      <div className="min-w-0 flex-1 rounded-[12px] border border-app bg-app px-2">
        <WeekdayHeader />
        {weeks.map((days) => {
          const { bars, hidden } = weekBars(plans, days, 2);
          return (
            <div key={days[0].getTime()} className="relative h-[112px] border-t border-app">
              {days.map((d, i) => (
                <div key={i} className="absolute top-1 flex justify-center" style={{ left: `${(i * 100) / 7}%`, width: `${100 / 7}%` }}>
                  <button
                    type="button"
                    aria-label={dayAria(d)}
                    onClick={() => go("dia", d)}
                    className={`flex min-w-7 justify-center rounded-full px-1 hover:bg-surface-2 ${FOCUS}`}
                  >
                    {dayNumber(d, 28)}
                  </button>
                </div>
              ))}
              {bars.map((b) => (
                <MonthBar key={`${b.plan.id}-${b.from}`} bar={b} onOpen={onOpen} />
              ))}
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => go("semana", days[0])}
                  className={`absolute bottom-1.5 right-2 rounded-[4px] px-1 text-[12px] font-[var(--fw-semibold)] text-muted hover:text-app ${FOCUS}`}
                >
                  +{hidden} más
                </button>
              )}
            </div>
          );
        })}
      </div>
      <PlanAside
        title={`En ${monthName} · ${listed.length}`}
        plans={listed}
        empty={`Nada planeado en ${monthName}`}
        onOpen={onOpen}
        onCreate={() => {
          const f = createFrom(from, to);
          onCreate(f, addDays(f, 1));
        }}
      />
    </div>
  );
}

function MonthBar({ bar, onOpen }: { bar: Bar; onOpen: OpenPlan }) {
  const span = bar.to - bar.from + 1;
  const l = bar.startsHere ? 5 : 0;
  const r = bar.endsHere ? 5 : 0;
  return (
    <button
      type="button"
      title={bar.plan.title}
      onClick={() => onOpen(bar.plan.id)}
      className={`absolute flex h-[22px] items-center overflow-hidden px-1.5 text-left text-[12px] font-[var(--fw-semibold)] transition-opacity hover:opacity-85 ${barTone(kindOf(bar.plan))} ${FOCUS}`}
      style={{
        top: 40 + bar.lane * 26,
        left: `calc(${(bar.from * 100) / 7}% + 2px)`,
        width: `calc(${(span * 100) / 7}% - 4px)`,
        borderRadius: `${l}px ${r}px ${r}px ${l}px`,
      }}
    >
      <span className="truncate">
        {bar.startsHere ? "" : "… "}
        {bar.plan.title}
      </span>
    </button>
  );
}

/* ───────────── Semana ───────────── */

function useDayItems(plans: FeedPlanItemDto[], days: Date[]) {
  const visible = useMemo(() => plansBetween(plans, days[0], days[days.length - 1]), [plans, days]);
  const ids = useMemo(() => visible.map((p) => p.id), [visible]);
  const { byPlan, loading, failed } = usePlanActivities(ids);
  const perDay = useMemo(
    () =>
      days.map((d) => {
        const ps = visible.filter((p) => covers(p, d));
        const items: DayItem[] = ps
          .flatMap((p) => activitiesOfDay(byPlan.get(p.id) ?? [], d).map((row) => ({ row, plan: p })))
          .sort(
            (a, b) =>
              Number(b.row.all_day) - Number(a.row.all_day) || new Date(a.row.inicio_at).getTime() - new Date(b.row.inicio_at).getTime(),
          );
        return { day: d, plans: ps, items };
      }),
    [days, visible, byPlan],
  );
  return { visible, perDay, loading, failed: failed.length > 0 };
}

function weekBarLabel(b: Bar, days: Date[]) {
  const { total } = dayOfPlan(b.plan, days[b.from]);
  const a = dayOfPlan(b.plan, days[b.from]).day;
  const z = dayOfPlan(b.plan, days[b.to]).day;
  let label = b.plan.title;
  if (total > 1) label += a === z ? ` · día ${a}` : ` · días ${a}–${z}`;
  if (!b.endsHere) label += " · sigue el lunes";
  return label;
}

export function WeekView({ plans, date, desktop, onOpen, go, onCreate }: ViewProps) {
  const { from, to } = useMemo(() => periodOf("semana", date), [date]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(from, i)), [from]);
  const { visible, perDay, loading, failed } = useDayItems(plans, days);
  const today = startOfDay(new Date());
  const now = new Date();

  if (!desktop) {
    return (
      <div className="pb-4">
        {perDay.map(({ day, plans: ps, items }, i) => {
          const isToday = sameDay(day, today);
          return (
            <button
              key={i}
              type="button"
              aria-label={dayAria(day)}
              onClick={() => go("dia", day)}
              className={`flex w-full gap-3 border-t border-app px-4 py-2 text-left ${isToday ? "bg-surface" : ""} ${FOCUS}`}
            >
              <span className="flex w-9 shrink-0 flex-col items-center">
                <abbr title={WEEKDAYS[i][1]} className={`${LABEL} no-underline`}>
                  {WEEKDAYS[i][0]}
                </abbr>
                {isToday ? (
                  <TodayCircle size={30} text={15}>{day.getDate()}</TodayCircle>
                ) : (
                  <span className={`${SERIF} text-[24px] leading-[30px] tabular-nums text-app`}>{day.getDate()}</span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                {ps.length === 0 && <span className="flex min-h-7 items-center text-[12px] text-muted">Nada planeado</span>}
                {ps.map((p) => {
                  const { day: n, total } = dayOfPlan(p, day);
                  return (
                    <span key={p.id} className={`flex h-[22px] items-center rounded-[5px] px-2 text-[12px] font-[var(--fw-semibold)] ${barTone(kindOf(p))}`}>
                      <span className="truncate">{total > 1 ? `${p.title} · día ${n} de ${total}` : p.title}</span>
                    </span>
                  );
                })}
                {items.slice(0, 3).map(({ row }) => (
                  <span key={row.id} className="flex min-h-[26px] items-center gap-2.5">
                    <span className="w-[38px] shrink-0 text-[12px] tabular-nums text-muted">{row.all_day ? "Día" : hhmm(row.inicio_at)}</span>
                    <span className="truncate text-[14px] text-app">{row.titulo}</span>
                  </span>
                ))}
                {items.length > 3 && <span className="pl-12 text-[12px] text-muted">y {items.length - 3} más</span>}
              </span>
            </button>
          );
        })}
        <ActivitiesNotice loading={loading} failed={failed} />
      </div>
    );
  }

  const { bars, lanes } = weekBars(plans, days, 3);
  const current = today >= from && today <= to;
  return (
    <div className="flex items-start gap-10">
      <div className="min-w-0 flex-1">
        <div className="relative grid grid-cols-7">
          {perDay.map(({ day, items }, i) => {
            const isToday = sameDay(day, today);
            return (
              <div key={i} className={`flex min-w-0 flex-col gap-2 px-1.5 pb-3 ${isToday ? "rounded-[10px] bg-surface" : ""}`}>
                <button type="button" aria-label={dayAria(day)} onClick={() => go("dia", day)} className={`flex h-12 items-center gap-2 rounded-[8px] ${FOCUS}`}>
                  <abbr title={WEEKDAYS[i][1]} className={`${LABEL} no-underline`}>
                    {WEEKDAYS[i][0]}
                  </abbr>
                  {isToday ? (
                    <TodayCircle size={32} text={16}>{day.getDate()}</TodayCircle>
                  ) : (
                    <span className={`${SERIF} text-[28px] leading-8 tabular-nums text-app`}>{day.getDate()}</span>
                  )}
                </button>
                {lanes > 0 && <div aria-hidden style={{ height: lanes * 30 - 8 }} />}
                {items.length ? (
                  items.map(({ row, plan }) => {
                    const isNow = activityState(row, day, now) === "now" && !row.all_day;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => onOpen(plan.id, "itinerario")}
                        className={`block rounded-[8px] border px-2.5 py-2 text-left transition-colors ${FOCUS} ${
                          isNow ? "border-[var(--chat-me-border)] bg-[var(--chat-me)]" : "border-app bg-surface hover:bg-surface-2"
                        }`}
                      >
                        <span className="block text-[12px] font-[var(--fw-semibold)] tabular-nums text-muted">{row.all_day ? "Todo el día" : hhmm(row.inicio_at)}</span>
                        <span className="mt-0.5 block text-[13px] leading-[1.35] text-app">{row.titulo}</span>
                      </button>
                    );
                  })
                ) : (
                  <span className="text-[12px] text-muted">{covers0(visible, day) ? "Sin actividades" : "Nada planeado"}</span>
                )}
              </div>
            );
          })}
          {bars.map((b) => {
            const span = b.to - b.from + 1;
            const l = b.startsHere ? 5 : 0;
            const r = b.endsHere ? 5 : 0;
            return (
              <button
                key={`${b.plan.id}-${b.from}`}
                type="button"
                title={b.plan.title}
                onClick={() => onOpen(b.plan.id)}
                className={`absolute flex h-6 items-center overflow-hidden px-2.5 text-left text-[12px] font-[var(--fw-semibold)] transition-opacity hover:opacity-85 ${barTone(kindOf(b.plan))} ${FOCUS}`}
                style={{
                  top: 54 + b.lane * 30,
                  left: `calc(${(b.from * 100) / 7}% + 6px)`,
                  width: `calc(${(span * 100) / 7}% - 12px)`,
                  borderRadius: `${l}px ${r}px ${r}px ${l}px`,
                }}
              >
                <span className="truncate">{weekBarLabel(b, days)}</span>
              </button>
            );
          })}
        </div>
        <ActivitiesNotice loading={loading} failed={failed} />
      </div>
      <PlanAside
        title={current ? `Esta semana · ${visible.length}` : `Semana del ${from.getDate()} ${MONTHS_SHORT[from.getMonth()]} · ${visible.length}`}
        plans={[...visible].sort(byListOrder)}
        empty="Nada planeado esta semana"
        onOpen={onOpen}
        onCreate={() => onCreate(createFrom(from, to), to)}
      />
    </div>
  );
}

function covers0(plans: FeedPlanItemDto[], day: Date) {
  return plans.some((p) => covers(p, day));
}

function ActivitiesNotice({ loading, failed }: { loading: boolean; failed: boolean }) {
  if (failed) return <p className="px-4 pt-3 text-[14px] text-muted md:px-0">No se han podido cargar algunas actividades.</p>;
  if (loading) return <p role="status" className="px-4 pt-3 text-[12px] text-muted md:px-0">Cargando actividades…</p>;
  return null;
}

/* ───────────── Día ───────────── */

export function DayView({ plans, date, desktop, onOpen, onCreate }: ViewProps) {
  const day = useMemo(() => startOfDay(date), [date]);
  const tomorrow = useMemo(() => addDays(day, 1), [day]);
  const days = useMemo(() => [day, tomorrow], [day, tomorrow]);
  const { perDay, loading, failed } = useDayItems(plans, days);
  const { plans: ps, items } = perDay[0];
  const sorted = useMemo(() => [...ps].sort(byPriority), [ps]);
  const main = sorted[0];

  const empty = (
    <div className="px-4 pt-2 md:px-0">
      {ps.length === 0 ? (
        <>
          <p className="text-[16px] text-app">Nada planeado este día</p>
          <button type="button" onClick={() => onCreate(day, day)} className={`${TEXT_BTN} ${FOCUS}`}>
            <Plus size={18} aria-hidden />
            Nuevo plan este día
          </button>
        </>
      ) : loading ? (
        <p role="status" className="text-[14px] text-muted">Cargando actividades…</p>
      ) : failed ? (
        <p className="text-[14px] text-muted">No se han podido cargar las actividades.</p>
      ) : (
        <p className="text-[16px] text-app">Sin actividades este día</p>
      )}
    </div>
  );

  const timeline = items.length ? <DayTimeline items={items} day={day} showPlan={ps.length > 1} large={desktop} onOpen={onOpen} /> : empty;
  const addButton = main ? (
    <div className="pl-14 pt-1 md:pt-2">
      <button type="button" onClick={() => onOpen(main.id, "itinerario")} className={`${TEXT_BTN} ${FOCUS}`}>
        <Plus size={18} aria-hidden />
        Añadir al día
      </button>
    </div>
  ) : null;

  if (!desktop) {
    return (
      <div className="pb-4">
        {sorted.length > 0 && (
          <div className="flex flex-col gap-2 px-4 pb-2 pt-1">
            {sorted.map((p) => {
              const { day: n, total } = dayOfPlan(p, day);
              return (
                <button key={p.id} type="button" onClick={() => onOpen(p.id)} className={`flex items-center gap-3 rounded-[8px] border border-app bg-surface p-2 text-left ${FOCUS}`}>
                  <PlanCover plan={p} variant="thumb" className="size-11 shrink-0 rounded-[6px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-[var(--fw-semibold)] text-app">{p.title}</span>
                    <span className="text-[12px] text-muted">{total > 1 ? `Día ${n} de ${total}` : formatPlanRange(p.startsAt, p.endsAt)}</span>
                  </span>
                  <ChevronRight size={18} aria-hidden className="mr-1 shrink-0 text-muted" />
                </button>
              );
            })}
          </div>
        )}
        {timeline}
        {addButton}
      </div>
    );
  }

  const nextItems = main ? perDay[1].items.filter((it) => it.plan.id === main.id) : [];
  return (
    <div className="flex items-start gap-8">
      <div className="min-w-0 flex-1">
        {timeline}
        {addButton}
      </div>
      {main && (
        <div className="w-[300px] shrink-0">
          {sorted.map((p, i) => {
            const { day: n, total } = dayOfPlan(p, day);
            return (
              <article key={p.id} className={`overflow-hidden rounded-[12px] border border-app bg-surface ${i ? "mt-3" : ""}`}>
                {i === 0 && <PlanCover plan={p} className="h-[150px] w-full" />}
                <div className="px-4 py-3">
                  <h3 className={`${SERIF} text-[24px] leading-7 text-app`}>{p.title}</h3>
                  <p className="text-[12px] text-muted">
                    {total > 1 ? `Día ${n} de ${total} · ` : ""}
                    {formatPlanRange(p.startsAt, p.endsAt)}
                  </p>
                  {total > 1 && (
                    <div className="mt-2.5">
                      <TripProgress day={n} total={total} />
                    </div>
                  )}
                  <button type="button" onClick={() => onOpen(p.id)} className={`${TEXT_BTN} mt-1 ${FOCUS}`}>
                    Abrir el plan
                    <ChevronRight size={18} aria-hidden />
                  </button>
                </div>
              </article>
            );
          })}
          {nextItems.length > 0 && (
            <>
              <h3 className={`${LABEL} mt-5 flex h-7 items-center`}>
                Mañana · {weekdayName(tomorrow)} {tomorrow.getDate()}
              </h3>
              <ul>
                {nextItems.map(({ row }) => (
                  <li key={row.id} className="flex min-h-10 items-center gap-3 border-t border-app">
                    <span className="w-10 shrink-0 text-[12px] tabular-nums text-muted">{row.all_day ? "Día" : hhmm(row.inicio_at)}</span>
                    <span className="truncate text-[14px] text-app">{row.titulo}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
