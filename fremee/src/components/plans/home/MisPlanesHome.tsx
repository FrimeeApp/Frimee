"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Link2, Plus, Search } from "lucide-react";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { MisPlanesInicio } from "@/services/api/endpoints/misPlanes.endpoint";
import { buildHomeSections } from "./homeSections";
import { CoverCard, FinishedLink, HeroBlock, LaterSpine, LaterTile, NowBlock, type OpenPlan } from "./blocks";
import { PinnedStack } from "./PinnedStack";
import { MiniMonth, TeToca } from "./side";
import { AfterCard, CreateJoinFab, CreateJoinSheet, EmptyHome } from "./actions";
import { FILL_BTN, FOCUS, GHOST_BTN, LiveDot, SERIF, SectionTitle, TEXT_BTN } from "./pieces";

type Props = {
  plans: FeedPlanItemDto[];
  inicio: MisPlanesInicio | null;
  pinnedIds: number[];
  onTogglePin: (planId: number) => void;
  onOpen: OpenPlan;
  onCreate: () => void;
  onOpenCalendar: () => void;
  /** «Todos los planes», optionally on the Finalizados filter or with a search. */
  onOpenAll: (opts?: { finished?: boolean; query?: string }) => void;
  onOpenInvitations: () => void;
  userId?: string;
  isGuest: boolean;
};

export function MisPlanesHome(props: Props) {
  const { plans, inicio, pinnedIds, onTogglePin, onOpen, onCreate, onOpenCalendar, onOpenAll, onOpenInvitations, userId } = props;
  const sections = useMemo(() => buildHomeSections(plans, pinnedIds), [plans, pinnedIds]);
  const extras = useMemo(() => new Map((inicio?.planes ?? []).map((e) => [e.plan_id, e])), [inicio]);
  const [sheet, setSheet] = useState<null | "menu" | "join">(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  // Ctrl/⌘ K focuses the desktop search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const empty = plans.length === 0;
  const { now, hero, next, pinned, later, finished, activeCount } = sections;
  const single = !now && hero && activeCount === 1;
  const lastTrip = activeCount === 0 ? finished[0] ?? null : null;
  const common = (plan: FeedPlanItemDto) => ({
    plan,
    extra: extras.get(plan.id),
    pinned: pinnedIds.includes(plan.id),
    onTogglePin: () => onTogglePin(plan.id),
    onOpen,
    userId,
  });
  const laterPlans = later.flatMap((c) => c.plans);

  const iconBtn = `flex size-11 shrink-0 items-center justify-center rounded-[8px] text-app hover:bg-surface-2 ${FOCUS}`;

  /* ───────────── Mobile ───────────── */
  const mobile = (
    <div className="md:hidden">
      {/* The bell is fixed at the top right (AppSidebar): leave it its room, as Mensajes does. */}
      <header className="mb-[10px] flex h-11 items-center pl-4 pr-[calc(var(--page-margin-x)+48px)]">
        <h1 className={`${SERIF} flex-1 text-[32px] leading-10 text-app`}>Mis planes</h1>
        {!empty && (
          <button type="button" aria-label="Buscar en tus planes" title="Buscar en tus planes" onClick={() => onOpenAll()} className={iconBtn}>
            <Search size={22} aria-hidden />
          </button>
        )}
        <button type="button" aria-label="Calendario" title="Calendario" onClick={onOpenCalendar} className={iconBtn}>
          <CalendarDays size={22} aria-hidden />
        </button>
      </header>
      {empty ? (
        <EmptyHome onCreate={onCreate} onJoin={() => setSheet("join")} onOpenPlan={(id) => onOpen(id)} />
      ) : (
        <div className="pb-6">
          {lastTrip && (
            <>
              <SectionTitle>Tu último viaje</SectionTitle>
              <div className="px-4">
                <HeroBlock {...common(lastTrip)} />
              </div>
              <AfterCard planTitle={lastTrip.title} onCreate={onCreate} onJoin={() => setSheet("join")} finished />
            </>
          )}
          {!lastTrip && now && (
            <>
              <SectionTitle>
                <span className="flex items-center gap-2 text-[var(--chat-accent-text)]">
                  <LiveDot />
                  En curso
                </span>
              </SectionTitle>
              <div className="px-4">
                <NowBlock {...common(now)} />
              </div>
            </>
          )}
          {!lastTrip && hero && (
            <>
              <SectionTitle>Tu próximo viaje</SectionTitle>
              <div className="px-4">
                <HeroBlock {...common(hero)} />
              </div>
            </>
          )}
          {!lastTrip && next && (
            <div className="mt-3">
              <SectionTitle>Siguiente</SectionTitle>
              <div className="px-4">
                <CoverCard {...common(next)} label="Siguiente" />
              </div>
            </div>
          )}
          {!lastTrip && single && <AfterCard planTitle={hero.title} onCreate={onCreate} onJoin={() => setSheet("join")} />}
          {!lastTrip && pinned.length > 0 && (
            <div className="mt-3">
              <PinnedStack plans={pinned} extras={extras} onTogglePin={onTogglePin} onOpen={onOpen} userId={userId} />
            </div>
          )}
          {!lastTrip && later.length > 0 && (
            <div className="mt-3">
              <SectionTitle
                action={
                  <button type="button" onClick={onOpenCalendar} className={`${TEXT_BTN} pl-2 ${FOCUS}`}>
                    Ver calendario
                  </button>
                }
              >
                Más adelante
              </SectionTitle>
              <LaterSpine chapters={later} extras={extras} pinnedIds={pinnedIds} onTogglePin={onTogglePin} onOpen={onOpen} userId={userId} />
            </div>
          )}
          {finished.length > 0 && (
            <div className="mt-4">
              <FinishedLink plans={finished} onClick={() => onOpenAll({ finished: true })} />
            </div>
          )}
          {!single && !lastTrip && <CreateJoinFab onCreate={onCreate} open={sheet === "menu"} onOpenChange={(o) => setSheet(o ? "menu" : null)} />}
        </div>
      )}
    </div>
  );

  /* ───────────── Desktop ───────────── */
  const desktop = (
    <div className="hidden md:block">
      <header className="flex h-14 items-center gap-3">
        <h1 className={`${SERIF} flex-1 text-[32px] leading-10 text-app`}>Mis planes</h1>
        {!empty && (
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              onOpenAll({ query: query.trim() || undefined });
            }}
          >
            <label className="flex h-[46px] w-[280px] items-center gap-2 rounded-full bg-surface-2 px-4 text-muted focus-within:outline focus-within:outline-2 focus-within:outline-[var(--primary)]">
              <Search size={18} aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar en tus planes"
                placeholder="Buscar en tus planes"
                className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-app outline-none placeholder:text-muted"
              />
              <kbd className="rounded-[4px] border border-[var(--border-strong)] px-[5px] py-px font-[inherit] text-[12px] text-muted">Ctrl K</kbd>
            </label>
          </form>
        )}
        <button type="button" onClick={() => setSheet("join")} className={`${GHOST_BTN} ${FOCUS}`}>
          <Link2 size={18} aria-hidden />
          Unirme con enlace
        </button>
        <button type="button" onClick={onCreate} className={`${FILL_BTN} ${FOCUS}`}>
          <Plus size={18} aria-hidden />
          Nuevo plan
        </button>
      </header>
      {empty ? (
        <EmptyHome desktop onCreate={onCreate} onJoin={() => setSheet("join")} onOpenPlan={(id) => onOpen(id)} />
      ) : (
        <div className="flex items-start gap-10">
          <div className="min-w-0 flex-1 pb-12">
            {lastTrip && (
              <>
                <h2 className="mt-5 flex h-8 items-center text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">Tu último viaje</h2>
                <HeroBlock {...common(lastTrip)} desktop />
                <AfterCard planTitle={lastTrip.title} onCreate={onCreate} onJoin={() => setSheet("join")} finished />
              </>
            )}
            {!lastTrip && now && (
              <>
                <h2 className="mt-5 flex h-8 items-center gap-2 text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-[var(--chat-accent-text)]">
                  <LiveDot />
                  En curso
                </h2>
                <NowBlock {...common(now)} desktop />
              </>
            )}
            {!lastTrip && hero && (
              <>
                <h2 className="mt-5 flex h-8 items-center text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">Tu próximo viaje</h2>
                <HeroBlock {...common(hero)} desktop />
              </>
            )}
            {!lastTrip && single && <AfterCard planTitle={hero.title} onCreate={onCreate} onJoin={() => setSheet("join")} />}
            {!lastTrip && (next || pinned.length > 0) && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {next && (
                  <div>
                    <h2 className="mt-4 flex h-8 items-center text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">Siguiente</h2>
                    <CoverCard {...common(next)} label="Siguiente" desktop />
                  </div>
                )}
                {pinned.length > 0 && (
                  <PinnedStack plans={pinned} extras={extras} onTogglePin={onTogglePin} onOpen={onOpen} userId={userId} desktop />
                )}
              </div>
            )}
            {(lastTrip || laterPlans.length > 0 || finished.length > 0) && (
              <div className="mt-4 flex h-8 items-center justify-between">
                <h2 className="text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">
                  {lastTrip ? "Historial" : laterPlans.length ? "Más adelante" : ""}
                </h2>
                <button type="button" onClick={() => onOpenAll()} className={`${TEXT_BTN} ${FOCUS}`}>
                  Todos los planes · {activeCount} {activeCount === 1 ? "activo" : "activos"}
                  {finished.length ? `, ${finished.length} ${finished.length === 1 ? "finalizado" : "finalizados"}` : ""}
                </button>
              </div>
            )}
            {!lastTrip && laterPlans.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {laterPlans.map((p) => (
                  <LaterTile key={p.id} plan={p} onOpen={onOpen} userId={userId} pinned={pinnedIds.includes(p.id)} onTogglePin={() => onTogglePin(p.id)} />
                ))}
              </div>
            )}
          </div>
          <aside className="hidden w-[360px] shrink-0 pt-[52px] lg:block">
            <MiniMonth plans={plans} onOpen={onOpen} onOpenCalendar={onOpenCalendar} />
            <TeToca plans={plans} extras={extras} invitations={inicio?.invitaciones ?? []} onOpen={onOpen} onOpenInvitations={onOpenInvitations} />
          </aside>
        </div>
      )}
    </div>
  );

  return (
    <>
      {mobile}
      {desktop}
      {sheet === "join" && <CreateJoinSheet onClose={() => setSheet(null)} onCreate={onCreate} startOnJoin />}
    </>
  );
}
