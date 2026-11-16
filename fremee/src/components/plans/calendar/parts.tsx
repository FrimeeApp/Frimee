"use client";

import { Check, MapPin, Plus } from "lucide-react";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { formatPlanRange, startOfDay } from "../home/homeSections";
import { FOCUS, LABEL, PlanCover, TEXT_BTN } from "../home/pieces";
import type { OpenPlan } from "../home/blocks";
import { MODES, activityState, dayOfPlan, hhmm, kindOf, statusText, type CalMode, type Kind } from "./calendarModel";

/** Bar colours: in progress filled, upcoming outlined (not colour alone), finished grey. */
export function barTone(kind: Kind) {
  if (kind === "ongoing") return "bg-[var(--chat-accent-text)] text-contrast-token";
  if (kind === "upcoming") return "bg-[var(--chat-me)] text-app shadow-[inset_0_0_0_1px_var(--chat-me-border)]";
  return "bg-surface-2 text-muted";
}

/** Thin bars without text (phone month): upcoming gets a stronger outline so it reads at 6 px. */
export function thinBarTone(kind: Kind) {
  if (kind === "ongoing") return "bg-[var(--chat-accent-text)]";
  if (kind === "upcoming") return "bg-[var(--chat-me)] shadow-[inset_0_0_0_1.5px_var(--chat-accent-text)]";
  return "bg-[var(--border-strong)]";
}

export function ModeSwitch({ mode, onChange, desktop }: { mode: CalMode; onChange: (m: CalMode) => void; desktop: boolean }) {
  return (
    <div role="group" aria-label="Vista" className="flex rounded-[10px] bg-surface-2 p-[2px]">
      {MODES.map((m) => {
        const on = m.value === mode;
        return (
          <button
            key={m.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(m.value)}
            className={`flex h-11 items-center justify-center rounded-[8px] px-3 text-[14px] font-[var(--fw-semibold)] transition-colors ${FOCUS} ${
              desktop ? "w-[88px]" : "flex-1"
            } ${on ? "bg-[var(--text-primary)] text-contrast-token" : "text-muted hover:text-app"}`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusLabel({ plan }: { plan: FeedPlanItemDto }) {
  const ongoing = kindOf(plan) === "ongoing";
  return (
    <span className={`shrink-0 text-[12px] tabular-nums ${ongoing ? "font-[var(--fw-semibold)] text-[var(--chat-accent-text)]" : "text-muted"}`}>
      {statusText(plan)}
    </span>
  );
}

/** Desktop side list: thumbnail, title, dates and status. */
export function PlanAside({
  title,
  plans,
  empty,
  onOpen,
  onCreate,
}: {
  title: string;
  plans: FeedPlanItemDto[];
  empty: string;
  onOpen: OpenPlan;
  onCreate: () => void;
}) {
  return (
    <aside className="w-[320px] shrink-0">
      <h2 className={`${LABEL} flex h-8 items-center`}>{title}</h2>
      {plans.length ? (
        <ul>
          {plans.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onOpen(p.id)} className={`flex min-h-[72px] w-full items-center gap-3 border-t border-app text-left hover:bg-surface-2 ${FOCUS}`}>
                <PlanCover plan={p} variant="thumb" className="size-12 shrink-0 rounded-[8px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-[var(--fw-semibold)] text-app">{p.title}</span>
                  <span className="text-[12px] text-muted">{formatPlanRange(p.startsAt, p.endsAt)}</span>
                </span>
                <StatusLabel plan={p} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-app py-4 text-[14px] text-muted">{empty}</p>
      )}
      <button type="button" onClick={onCreate} className={`${TEXT_BTN} mt-2 ${FOCUS}`}>
        <Plus size={18} aria-hidden />
        Nuevo plan en estas fechas
      </button>
    </aside>
  );
}

/** Phone list under the month: bar swatch, title, dates + day or place, status. */
export function PlanListRow({ plan, onOpen }: { plan: FeedPlanItemDto; onOpen: OpenPlan }) {
  const kind = kindOf(plan);
  const range = formatPlanRange(plan.startsAt, plan.endsAt);
  let detail = plan.locationName?.split(",")[0]?.trim() ?? "";
  if (kind === "ongoing") {
    const { day, total } = dayOfPlan(plan, startOfDay(new Date()));
    if (total > 1) detail = `día ${day} de ${total}`;
  }
  return (
    <li>
      <button type="button" onClick={() => onOpen(plan.id)} className={`flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-surface-2 ${FOCUS}`}>
        <span aria-hidden className={`h-2 w-7 shrink-0 rounded-[4px] ${thinBarTone(kind)}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-[var(--fw-medium)] text-app">{plan.title}</span>
          <span className="block truncate text-[14px] text-muted">{detail ? `${range} · ${detail}` : range}</span>
        </span>
        <StatusLabel plan={plan} />
      </button>
    </li>
  );
}

export type DayItem = { row: SubplanRow; plan: FeedPlanItemDto };

/**
 * A day's activities on the Bitácora spine: done ones greyed with a check, the current one
 * highlighted with «Ahora», the next ones with a hollow dot.
 */
export function DayTimeline({ items, day, showPlan, large, onOpen }: { items: DayItem[]; day: Date; showPlan: boolean; large: boolean; onOpen: OpenPlan }) {
  const now = new Date();
  return (
    <ol className="relative">
      <span aria-hidden className="absolute bottom-0 left-[27px] top-0 w-px bg-[var(--border)]" />
      {items.map(({ row, plan }) => {
        const state = activityState(row, day, now);
        const place = row.ubicacion_nombre?.trim();
        const meta = [place, showPlan ? plan.title : ""].filter(Boolean).join(" · ");
        const isNow = state === "now";
        return (
          <li key={row.id} aria-current={isNow ? "time" : undefined} className="relative py-1 pl-14">
            {state === "done" ? (
              <span aria-hidden className="absolute left-[19px] top-[14px] flex size-[17px] items-center justify-center rounded-full bg-surface-2 text-muted">
                <Check size={11} strokeWidth={3} />
              </span>
            ) : isNow ? (
              <span aria-hidden className="absolute left-5 top-[14px] size-[15px] rounded-full bg-[var(--primary)] shadow-[0_0_0_4px_var(--chat-me)]" />
            ) : (
              <span aria-hidden className="absolute left-[22px] top-4 size-[11px] rounded-full border-2 border-[var(--text-secondary)] bg-app" />
            )}
            <button
              type="button"
              onClick={() => onOpen(plan.id, "itinerario")}
              className={`block text-left ${FOCUS} ${
                isNow ? "w-[calc(100%-16px)] rounded-[8px] border border-[var(--chat-me-border)] bg-[var(--chat-me)] px-3 py-2" : "w-full py-2 pr-4"
              }`}
            >
              <span className="flex items-center">
                <span className={`text-[13px] font-[var(--fw-semibold)] tabular-nums ${state === "done" ? "text-muted" : "text-app"}`}>
                  {row.all_day ? "Todo el día" : hhmm(row.inicio_at)}
                </span>
                {isNow && !row.all_day && (
                  <span className="ml-2 inline-flex h-[22px] items-center rounded-full border border-[var(--chat-me-border)] bg-[var(--chat-me)] px-2 text-[11px] font-[var(--fw-semibold)] text-app">
                    Ahora
                  </span>
                )}
              </span>
              <span className={`mt-0.5 block font-[var(--fw-medium)] ${large ? "text-[17px]" : "text-[15px]"} ${state === "done" ? "text-muted" : "text-app"}`}>
                {row.titulo}
              </span>
              {meta && (
                <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
                  {place && <MapPin size={12} aria-hidden className="shrink-0" />}
                  <span className="truncate">{meta}</span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
