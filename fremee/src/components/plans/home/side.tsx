"use client";

import { useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { InicioInvitacion, InicioPlanExtra } from "@/services/api/endpoints/misPlanes.endpoint";
import { daysBetween, planTiming, startOfDay } from "./homeSections";
import { CARD, FOCUS, LABEL, SERIF, TEXT_BTN } from "./pieces";
import type { OpenPlan } from "./blocks";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEKDAYS: Array<[string, string]> = [
  ["lu", "lunes"], ["ma", "martes"], ["mi", "miércoles"], ["ju", "jueves"], ["vi", "viernes"], ["sá", "sábado"], ["do", "domingo"],
];

type BarStyle = "ongoing" | "upcoming" | "finished";

/** Only the plan in progress stands out: filled 4 px. Upcoming: thin 2 px outline. Finished: thin grey. */
function barClass(kind: BarStyle) {
  if (kind === "ongoing") return "h-1 bg-[var(--chat-accent-text)]";
  if (kind === "upcoming") return "h-[2px] bg-[var(--chat-me)] shadow-[inset_0_0_0_1px_var(--chat-accent-text)]";
  return "h-[2px] bg-[var(--border-strong)]";
}

function kindOf(plan: FeedPlanItemDto): BarStyle {
  const k = planTiming(plan).kind;
  return k === "ongoing" ? "ongoing" : k === "upcoming" ? "upcoming" : "finished";
}

const KIND_ORDER: Record<BarStyle, number> = { ongoing: 0, upcoming: 1, finished: 2 };

/** In progress first, then upcoming by start, then finished. */
function byPriority(a: FeedPlanItemDto, b: FeedPlanItemDto) {
  return KIND_ORDER[kindOf(a)] - KIND_ORDER[kindOf(b)] || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

type Segment = { plan: FeedPlanItemDto; from: number; to: number; roundLeft: boolean; roundRight: boolean };

/**
 * One lane per week, only on days of the shown month. Each day shows its first plan by priority;
 * consecutive days of the same plan join into one bar. Days with more than one plan get a dot.
 */
function weekLane(plans: FeedPlanItemDto[], days: Date[], month: Date) {
  const segments: Segment[] = [];
  const dots: number[] = [];
  let current: Segment | null = null;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const inMonth = d.getMonth() === month.getMonth();
    const covering = inMonth
      ? plans.filter((p) => startOfDay(new Date(p.startsAt)) <= d && startOfDay(new Date(p.endsAt)) >= d)
      : [];
    if (covering.length > 1) dots.push(i);
    const top = covering[0];
    if (current && top && current.plan.id === top.id && current.to === i - 1) {
      current.to = i;
      continue;
    }
    if (current) segments.push(current);
    current = top ? { plan: top, from: i, to: i, roundLeft: false, roundRight: false } : null;
  }
  if (current) segments.push(current);
  for (const seg of segments) {
    seg.roundLeft = startOfDay(new Date(seg.plan.startsAt)).getTime() === days[seg.from].getTime();
    seg.roundRight = startOfDay(new Date(seg.plan.endsAt)).getTime() === days[seg.to].getTime();
  }
  return { segments, dots };
}

const LEGEND_MAX = 3;

/** Compact month for the desktop side column: one lane, dots where plans overlap, legend of up to 3. */
export function MiniMonth({ plans, onOpen, onOpenCalendar }: { plans: FeedPlanItemDto[]; onOpen: OpenPlan; onOpenCalendar: () => void }) {
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const today = startOfDay(new Date());

  const weeks = useMemo(() => {
    const offset = (month.getDay() + 6) % 7;
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const out: Date[][] = [];
    for (let w = 0; ; w++) {
      const days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i));
      out.push(days);
      if (days[6] >= last) break;
    }
    return out;
  }, [month]);

  // Plans with at least one day in the shown month, by priority.
  const inMonth = useMemo(() => {
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return plans
        .filter((p) => startOfDay(new Date(p.startsAt)) <= monthEnd && startOfDay(new Date(p.endsAt)) >= month)
        .sort(byPriority);
  }, [plans, month]);
  const legend = inMonth.slice(0, LEGEND_MAX);
  const more = inMonth.length - legend.length;

  return (
    <section aria-label={`Calendario de ${MONTHS[month.getMonth()].toLowerCase()}`} className={`${CARD} px-4 pb-2 pt-4`}>
      <div className="flex items-center gap-1">
        <h2 className={`${SERIF} flex-1 text-[24px] leading-[30px] text-app`}>
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </h2>
        <button type="button" aria-label="Mes anterior" title="Mes anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className={`flex size-11 items-center justify-center rounded-[8px] text-app hover:bg-surface-2 ${FOCUS}`}>
          <ChevronLeft size={20} aria-hidden />
        </button>
        <button type="button" aria-label="Mes siguiente" title="Mes siguiente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className={`flex size-11 items-center justify-center rounded-[8px] text-app hover:bg-surface-2 ${FOCUS}`}>
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>
      <div className="mt-1">
        <div className="grid h-7 grid-cols-7 items-center">
          {WEEKDAYS.map(([s, l]) => (
            <abbr key={s} title={l} className={`${LABEL} text-center no-underline`}>{s}</abbr>
          ))}
        </div>
        {weeks.map((days) => {
          const { segments, dots } = weekLane(inMonth, days, month);
          return (
            <div key={days[0].toISOString()} className="relative h-11 border-t border-app">
              {days.map((d, i) => {
                const out = d.getMonth() !== month.getMonth();
                const isToday = d.getTime() === today.getTime();
                return (
                  <div key={i} className="absolute top-1 flex justify-center" style={{ left: `${(i * 100) / 7}%`, width: `${100 / 7}%` }}>
                    <span
                      aria-current={isToday ? "date" : undefined}
                      className={`flex h-7 items-center justify-center text-[14px] tabular-nums ${
                        isToday
                          ? "w-7 rounded-full bg-[var(--chat-accent-text)] font-[var(--fw-semibold)] text-contrast-token"
                          : out
                            ? "text-muted opacity-60"
                            : "text-app"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
              {dots.map((i) => (
                <span
                  key={`dot-${i}`}
                  aria-hidden
                  className="absolute top-[33px] size-1 -translate-x-1/2 rounded-full bg-[var(--text-secondary)]"
                  style={{ left: `${((i + 0.5) * 100) / 7}%` }}
                />
              ))}
              {segments.map((seg) => {
                const kind = kindOf(seg.plan);
                return (
                  <div
                    key={`${seg.plan.id}-${seg.from}`}
                    aria-hidden
                    className={`absolute ${barClass(kind)}`}
                    style={{
                      top: kind === "ongoing" ? 38 : 39,
                      left: `calc(${(seg.from * 100) / 7}% + ${seg.roundLeft ? 3 : 0}px)`,
                      width: `calc(${((seg.to - seg.from + 1) * 100) / 7}% - ${(seg.roundLeft ? 3 : 0) + (seg.roundRight ? 3 : 0)}px)`,
                      borderRadius: `${seg.roundLeft ? 2 : 0}px ${seg.roundRight ? 2 : 0}px ${seg.roundRight ? 2 : 0}px ${seg.roundLeft ? 2 : 0}px`,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      {legend.length > 0 && (
        <ul className="mt-1 border-t border-app pt-1">
          {legend.map((p) => {
            const kind = kindOf(p);
            const s = new Date(p.startsAt);
            const e = new Date(p.endsAt);
            const range = daysBetween(s, e) > 0 ? `${s.getDate()}–${e.getDate()}` : `${s.getDate()}`;
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onOpen(p.id)} className={`flex min-h-11 w-full items-center gap-2.5 text-left ${FOCUS}`}>
                  <span aria-hidden className="flex w-6 shrink-0 items-center">
                    <span className={`w-6 rounded-[2px] ${barClass(kind)}`} />
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[14px] text-app ${kind === "ongoing" ? "font-[var(--fw-semibold)]" : "font-[var(--fw-medium)]"}`}>{p.title}</span>
                  <span className="text-[12px] tabular-nums text-muted">
                    {range}
                    {kind === "ongoing" ? " · en curso" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {more > 0 && (
        <button type="button" onClick={onOpenCalendar} className={`${TEXT_BTN} ${FOCUS}`}>
          y {more} más este mes
        </button>
      )}
      <button type="button" onClick={onOpenCalendar} className={`${TEXT_BTN} w-full justify-between ${FOCUS}`}>
        Ver calendario completo
        <ChevronRight size={18} aria-hidden />
      </button>
    </section>
  );
}

type Task = { key: string; title: string; meta: string; icon: "poll" | "invite"; onClick: () => void };

/** «Te toca»: open polls without your vote + plan invitations without an answer. */
export function TeToca({
  plans,
  extras,
  invitations,
  onOpen,
  onOpenInvitations,
}: {
  plans: FeedPlanItemDto[];
  extras: Map<number, InicioPlanExtra>;
  invitations: InicioInvitacion[];
  onOpen: OpenPlan;
  onOpenInvitations: () => void;
}) {
  const tasks: Task[] = [];
  for (const p of plans) {
    for (const poll of extras.get(p.id)?.encuestas ?? []) {
      if (poll.he_votado) continue;
      tasks.push({
        key: `poll-${poll.mensaje_id}`,
        title: `Votar «${poll.pregunta}»`,
        meta: `${p.title} · faltas tú`,
        icon: "poll",
        onClick: () => onOpen(p.id, "chat"),
      });
    }
  }
  for (const inv of invitations) {
    tasks.push({
      key: `inv-${inv.notificacion_id}`,
      title: "Confirmar si vas",
      meta: inv.de_nombre ? `${inv.plan_titulo} · te invitó ${inv.de_nombre.split(" ")[0]}` : inv.plan_titulo,
      icon: "invite",
      onClick: onOpenInvitations,
    });
  }
  if (!tasks.length) return null;
  return (
    <section className="mt-4">
      <h2 className={`${LABEL} flex h-7 items-center`}>Te toca · {tasks.length}</h2>
      <ul>
        {tasks.map((t) => (
          <li key={t.key}>
            <button type="button" onClick={t.onClick} className={`flex min-h-14 w-full items-center gap-3 border-t border-app text-left ${FOCUS}`}>
              <span className="flex text-[var(--chat-accent-text)]">
                {t.icon === "poll" ? <BarChart3 size={20} aria-hidden /> : <UserPlus size={20} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-[var(--fw-semibold)] text-app">{t.title}</span>
                <span className="block truncate text-[12px] text-muted">{t.meta}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
