"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { InicioPlanExtra } from "@/services/api/endpoints/misPlanes.endpoint";
import { planTiming } from "./homeSections";
import { PlanRow, type OpenPlan } from "./blocks";
import { FOCUS, LABEL, SERIF } from "./pieces";

export type AllFilter = "active" | "finished" | "pinned";

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** «Todos los planes»: search + Activos / Finalizados / Anclados, grouped by year. */
export function AllPlansView({
  plans,
  extras,
  pinnedIds,
  onTogglePin,
  onOpen,
  onBack,
  userId,
  initialFilter,
  initialQuery,
}: {
  plans: FeedPlanItemDto[];
  extras: Map<number, InicioPlanExtra>;
  pinnedIds: number[];
  onTogglePin: (id: number) => void;
  onOpen: OpenPlan;
  onBack: () => void;
  userId?: string;
  initialFilter: AllFilter;
  initialQuery: string;
}) {
  const [filter, setFilter] = useState<AllFilter>(initialFilter);
  const [query, setQuery] = useState(initialQuery);

  const active = useMemo(() => plans.filter((p) => planTiming(p).kind !== "finished"), [plans]);
  const finished = useMemo(() => plans.filter((p) => planTiming(p).kind === "finished"), [plans]);
  const pinned = useMemo(() => active.filter((p) => pinnedIds.includes(p.id)), [active, pinnedIds]);

  const groups = useMemo(() => {
    const base = filter === "active" ? active : filter === "finished" ? finished : pinned;
    const q = normalize(query.trim());
    const list = q
      ? base.filter((p) => normalize(`${p.title} ${p.locationName ?? ""} ${p.creator.name}`).includes(q))
      : base;
    const sorted = [...list].sort((a, b) =>
      filter === "finished"
        ? new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
        : new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
    const byYear = new Map<number, FeedPlanItemDto[]>();
    for (const p of sorted) {
      const y = new Date(p.startsAt).getFullYear();
      byYear.set(y, [...(byYear.get(y) ?? []), p]);
    }
    return [...byYear.entries()];
  }, [filter, active, finished, pinned, query]);

  const chips: Array<{ value: AllFilter; label: string; count?: number }> = [
    { value: "active", label: "Activos", count: active.length },
    { value: "finished", label: "Finalizados", count: finished.length },
    ...(pinned.length ? [{ value: "pinned" as const, label: "Anclados" }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[720px] pb-8">
      <header className="flex h-16 items-center gap-1 pl-1 pr-4 md:pl-0">
        <button type="button" aria-label="Volver" title="Volver" onClick={onBack} className={`flex size-11 items-center justify-center rounded-[8px] text-app hover:bg-surface-2 ${FOCUS}`}>
          <ArrowLeft size={22} aria-hidden />
        </button>
        <h1 className={`${SERIF} text-[32px] leading-10 text-app`}>Todos los planes</h1>
      </header>
      <div className="px-4 md:px-0">
        <label className="flex h-[46px] items-center gap-2 rounded-full bg-surface-2 px-4 text-muted focus-within:outline focus-within:outline-2 focus-within:outline-[var(--primary)]">
          <Search size={18} aria-hidden />
          <input
            autoFocus={Boolean(initialQuery) || initialFilter === "active"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar planes"
            placeholder="Buscar planes"
            className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-app outline-none placeholder:text-muted"
          />
        </label>
        <div role="group" aria-label="Mostrar" className="mt-3 flex gap-2 overflow-x-auto">
          {chips.map((c) => {
            const on = filter === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(c.value)}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[14px] font-[var(--fw-medium)] ${FOCUS} ${
                  on ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-contrast-token" : "border-[var(--border-strong)] text-app"
                }`}
              >
                {c.label}
                {c.count !== undefined && <span className={`tabular-nums ${on ? "" : "text-muted"}`}>{c.count}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="px-4 pt-6 text-[14px] text-muted md:px-0">
          {query.trim()
            ? `Ningún plan coincide con «${query.trim()}».`
            : filter === "finished"
              ? "Aquí aparecerán los planes que ya hayan terminado."
              : "No tienes planes activos."}
        </p>
      ) : (
        groups.map(([year, list]) => (
          <section key={year} aria-label={String(year)} className="mt-4">
            <h2 className={`${LABEL} px-4 md:px-0`}>{year}</h2>
            <div className="md:-mx-4">
              {list.map((p) => (
                <PlanRow
                  key={p.id}
                  plan={p}
                  extra={extras.get(p.id)}
                  pinned={pinnedIds.includes(p.id)}
                  onTogglePin={() => onTogglePin(p.id)}
                  onOpen={onOpen}
                  userId={userId}
                  finished={filter === "finished"}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
