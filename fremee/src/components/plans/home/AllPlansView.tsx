"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Pin, Plus, Search } from "lucide-react";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { InicioPlanExtra } from "@/services/api/endpoints/misPlanes.endpoint";
import { planTiming } from "./homeSections";
import { PlanRow, PlanTile, type OpenPlan } from "./blocks";
import { FILL_BTN, FOCUS, LABEL, SERIF } from "./pieces";

export type AllFilter = "all" | "active" | "finished" | "pinned";
type Sort = "date" | "mine";

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type Section = { key: string; title: string; plans: FeedPlanItemDto[]; finished: boolean };

/** «Todos los planes» (m-todos, d-todos): search, Todos / Activos / Finalizados / Anclados and order. */
export function AllPlansView({
  plans,
  extras,
  pinnedIds,
  onTogglePin,
  onOpen,
  onBack,
  onCreate,
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
  onCreate: () => void;
  userId?: string;
  initialFilter: AllFilter;
  initialQuery: string;
}) {
  const [filter, setFilter] = useState<AllFilter>(initialFilter);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<Sort>("date");

  const active = useMemo(() => plans.filter((p) => planTiming(p).kind !== "finished"), [plans]);
  const finished = useMemo(() => plans.filter((p) => planTiming(p).kind === "finished"), [plans]);
  const pinned = useMemo(() => active.filter((p) => pinnedIds.includes(p.id)), [active, pinnedIds]);

  const sections = useMemo<Section[]>(() => {
    const q = normalize(query.trim());
    // Name, place or person: the creator and, when known, every member.
    const match = (p: FeedPlanItemDto) =>
      !q ||
      normalize(
        [p.title, p.locationName ?? "", p.creator.name, ...(extras.get(p.id)?.miembros ?? []).map((m) => m.nombre)].join(" "),
      ).includes(q);
    const mine = (p: FeedPlanItemDto) => p.creator.id === userId || p.ownerUserId === userId;
    const order = (list: FeedPlanItemDto[], newestFirst: boolean) =>
      list.filter(match).sort((a, b) => {
        if (sort === "mine" && mine(a) !== mine(b)) return mine(a) ? -1 : 1;
        const diff = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
        return newestFirst ? -diff : diff;
      });

    const out: Section[] = [];
    if (filter === "all" || filter === "active") {
      const list = order(active, false);
      if (list.length) out.push({ key: "active", title: "Activos", plans: list, finished: false });
    }
    if (filter === "pinned") {
      const list = order(pinned, false);
      if (list.length) out.push({ key: "pinned", title: "Anclados", plans: list, finished: false });
    }
    if (filter === "all" || filter === "finished") {
      const byYear = new Map<number, FeedPlanItemDto[]>();
      for (const p of order(finished, true)) {
        const y = new Date(p.startsAt).getFullYear();
        byYear.set(y, [...(byYear.get(y) ?? []), p]);
      }
      [...byYear.entries()].forEach(([year, list], i) => {
        out.push({ key: `y${year}`, title: i === 0 && filter === "all" ? `Finalizados · ${year}` : String(year), plans: list, finished: true });
      });
    }
    return out;
  }, [filter, query, sort, active, finished, pinned, extras, userId]);

  const chips: Array<{ value: AllFilter; label: string; count?: number }> = [
    { value: "all", label: "Todos", count: plans.length },
    { value: "active", label: "Activos", count: active.length },
    { value: "finished", label: "Finalizados", count: finished.length },
    ...(pinned.length ? [{ value: "pinned" as const, label: "Anclados" }] : []),
  ];

  const search = (cls: string) => (
    <label className={`flex h-[46px] items-center gap-2 rounded-full bg-surface-2 px-4 text-muted focus-within:outline focus-within:outline-2 focus-within:outline-[var(--primary)] ${cls}`}>
      <Search size={18} aria-hidden />
      <input
        autoFocus={Boolean(initialQuery)}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Buscar planes"
        placeholder="Nombre, destino o persona"
        className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-app outline-none placeholder:text-muted"
      />
    </label>
  );

  const common = (p: FeedPlanItemDto) => ({
    plan: p,
    extra: extras.get(p.id),
    pinned: pinnedIds.includes(p.id),
    onTogglePin: () => onTogglePin(p.id),
    onOpen,
    userId,
  });

  const empty = (
    <p className="px-4 pt-6 text-[14px] text-muted md:px-0">
      {query.trim()
        ? `Ningún plan coincide con «${query.trim()}».`
        : filter === "finished"
          ? "Aquí aparecerán los planes que ya hayan terminado."
          : filter === "pinned"
            ? "No tienes planes anclados."
            : "No tienes planes activos."}
    </p>
  );

  return (
    <div className="mx-auto w-full max-w-[720px] pb-8 md:max-w-none">
      <header className="flex h-16 items-center gap-1 pl-1 pr-4 md:gap-3 md:pl-0 md:pr-0">
        <button type="button" aria-label="Volver a Mis planes" title="Volver a Mis planes" onClick={onBack} className={`flex size-11 shrink-0 items-center justify-center rounded-[8px] text-app hover:bg-surface-2 ${FOCUS}`}>
          <ArrowLeft size={22} aria-hidden />
        </button>
        <h1 className={`${SERIF} flex-1 text-[32px] leading-10 text-app`}>Todos los planes</h1>
        {search("hidden w-[340px] md:flex")}
        <button type="button" onClick={onCreate} className={`${FILL_BTN} ${FOCUS} hidden md:inline-flex`}>
          <Plus size={18} aria-hidden />
          Nuevo plan
        </button>
      </header>
      <div className="px-4 md:px-0">
        {search("md:hidden")}
        <div className="mt-3 flex items-center gap-2">
          <div role="group" aria-label="Mostrar" className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
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
                  {c.value === "pinned" && <Pin size={14} aria-hidden />}
                  {c.label}
                  {c.count !== undefined && <span className={`tabular-nums ${on ? "" : "text-muted"}`}>{c.count}</span>}
                </button>
              );
            })}
          </div>
          <label className="hidden shrink-0 items-center gap-2 text-[14px] text-muted md:flex">
            Ordenar
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className={`h-11 rounded-[8px] border border-[var(--border-strong)] bg-surface px-3 text-[14px] text-app ${FOCUS}`}
            >
              <option value="date">Por fecha</option>
              <option value="mine">Creados por mí</option>
            </select>
          </label>
        </div>
      </div>

      {sections.length === 0 ? (
        empty
      ) : (
        sections.map((s) => (
          <section key={s.key} aria-label={s.title} className="mt-4 md:mt-5">
            {/* Mobile: list rows under a small label */}
            <div className="md:hidden">
              <h2 className={`${LABEL} px-4`}>{s.title}</h2>
              {s.plans.map((p) => (
                <PlanRow key={p.id} {...common(p)} finished={s.finished} />
              ))}
            </div>
            {/* Desktop: grid of covers */}
            <div className="hidden md:block">
              <div className="mb-3 flex items-baseline gap-2.5">
                <h2 className={`${SERIF} text-[24px] leading-7 text-app`}>{s.title}</h2>
                <span className="text-[12px] tabular-nums text-muted">{s.plans.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {s.plans.map((p) => (
                  <PlanTile key={p.id} {...common(p)} />
                ))}
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
