"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Pin } from "lucide-react";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { InicioPlanExtra } from "@/services/api/endpoints/misPlanes.endpoint";
import { CoverCard, type OpenPlan } from "./blocks";
import { FOCUS, LABEL } from "./pieces";

type Props = {
  plans: FeedPlanItemDto[];
  extras: Map<number, InicioPlanExtra>;
  onTogglePin: (planId: number) => void;
  onOpen: OpenPlan;
  userId?: string;
  desktop?: boolean;
};

const ANIM_MS = 240;

/**
 * Pinned plans stacked like postcards (s-pila): one whole card in front, the edges of the next
 * ones behind. Arrows, dots, swipe or ← → move through them. A single pinned plan is a plain card.
 */
export function PinnedStack({ plans, extras, onTogglePin, onOpen, userId, desktop }: Props) {
  const [index, setIndex] = useState(0);
  // The card on its way out, drawn over the new one while it leaves.
  const [leaving, setLeaving] = useState<{ plan: FeedPlanItemDto; dir: 1 | -1 } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const count = plans.length;
  const current = Math.min(index, count - 1);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (count === 0) return null;

  const go = (to: number) => {
    if (to < 0 || to >= count || to === current) return;
    setLeaving({ plan: plans[current], dir: to > current ? 1 : -1 });
    setIndex(to);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLeaving(null), ANIM_MS);
  };

  const card = (plan: FeedPlanItemDto) => (
    <CoverCard
      plan={plan}
      extra={extras.get(plan.id)}
      pinned
      onTogglePin={() => onTogglePin(plan.id)}
      onOpen={onOpen}
      userId={userId}
      label="Anclado"
      desktop={desktop}
    />
  );

  const titleCls = desktop
    ? "mt-4 flex h-8 items-center gap-2 text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted"
    : `${LABEL} flex items-center gap-2`;

  if (count === 1) {
    return (
      <div>
        <div className={desktop ? "" : "flex min-h-10 items-center px-4"}>
          <h2 className={titleCls}>Anclado</h2>
        </div>
        <div className={desktop ? "" : "px-4"}>{card(plans[0])}</div>
      </div>
    );
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - start.y)) go(current + (dx < 0 ? 1 : -1));
  };

  const arrow = "flex size-11 shrink-0 items-center justify-center rounded-[8px] text-app hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent";
  const edges = Math.min(2, count - 1);

  return (
    <div>
      <div className={`flex h-11 items-center ${desktop ? "mt-4" : "mt-1 px-4 pr-1"}`}>
        <h2 className={`${LABEL} flex flex-1 items-center gap-2`}>
          <Pin size={14} aria-hidden className="text-[var(--chat-accent-text)]" />
          Anclados ·{" "}
          <span className="tabular-nums" aria-live="polite">{current + 1} de {count}</span>
        </h2>
        <div role="group" aria-label="Elegir plan anclado" className="flex">
          {plans.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Ir a ${p.title}`}
              aria-current={i === current}
              onClick={() => go(i)}
              className={`flex h-11 w-6 items-center justify-center rounded-[6px] ${FOCUS}`}
            >
              <span
                aria-hidden
                className={`block size-2 rounded-full ${i === current ? "bg-[var(--chat-accent-text)]" : "shadow-[inset_0_0_0_1.5px_var(--text-secondary)]"}`}
              />
            </button>
          ))}
        </div>
        <button type="button" aria-label="Anclado anterior" title="Anclado anterior" disabled={current === 0} onClick={() => go(current - 1)} className={`${arrow} ${FOCUS}`}>
          <ChevronLeft size={20} aria-hidden />
        </button>
        <button type="button" aria-label="Anclado siguiente" title="Anclado siguiente" disabled={current === count - 1} onClick={() => go(current + 1)} className={`${arrow} ${FOCUS}`}>
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>
      <div className={desktop ? "" : "px-4"}>
        <div
          role="region"
          aria-roledescription="carrusel"
          aria-label="Planes anclados"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { swipe.current = null; }}
          className={`relative isolate mb-3 touch-pan-y rounded-[8px] ${FOCUS}`}
        >
          {edges >= 1 && <div aria-hidden className="absolute inset-x-2 -bottom-1.5 -z-10 h-10 rounded-[8px] border border-app bg-surface" />}
          {edges >= 2 && <div aria-hidden className="absolute inset-x-4 -bottom-3 -z-20 h-10 rounded-[8px] border border-app bg-surface" />}
          <div key={plans[current].id} className={`relative z-[1] ${leaving ? "pinned-stack-enter" : ""}`}>
            {card(plans[current])}
          </div>
          {leaving && (
            <div
              aria-hidden
              inert
              className={`pointer-events-none absolute inset-0 z-[2] ${leaving.dir === 1 ? "pinned-stack-leave-left" : "pinned-stack-leave-right"}`}
            >
              {card(leaving.plan)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
