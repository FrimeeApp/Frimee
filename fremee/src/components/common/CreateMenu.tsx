"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, ChevronRight, Link2, Map, Receipt, Search, UserPlus, Users } from "lucide-react";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { isPlanFinished } from "@/lib/plan-dates";

/** The plan the user is looking at (plan page): its own group «En este plan». */
export type CreateMenuPlanContext = {
  planId: number;
  title: string;
  /** Member of a plan that has not ended: may add activities. */
  canEdit: boolean;
  /** Admin of a plan that has not ended: may invite. */
  canInvite: boolean;
  onActividad: () => void;
  onGasto: () => void;
  onInvitar: () => void;
};

type Props = {
  open: boolean;
  onClose: (returnFocus: boolean) => void;
  /** «Crear» button: the menu sits to the right of the sidebar, top-aligned with it. */
  anchorRef: RefObject<HTMLElement | null>;
  sidebarRef: RefObject<HTMLElement | null>;
  plans: FeedPlanItemDto[] | null;
  lastPlanId: number | null;
  planContext?: CreateMenuPlanContext;
  onActividadEnPlan: (planId: number) => void;
  onGastoEnPlan: (planId: number) => void;
  onPlanNuevo: () => void;
  onGrupoNuevo: () => void;
  onUnirme: (code: string) => void;
};

type Option = {
  key: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  submenu?: boolean;
  run: () => void;
};

type Group = { key: string; header?: { text: string; live: boolean }; options: Option[] };

const DAY = 86_400_000;
const ICON = "size-[18px] shrink-0 text-muted transition-colors group-hover:text-app group-focus-visible:text-app";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Plan in progress (the last opened one if there are two), or one starting within 7 days. */
export function pickRelevantPlan(plans: FeedPlanItemDto[], lastPlanId: number | null, now = new Date()) {
  const t = now.getTime();
  const live = plans.filter((p) => new Date(p.startsAt).getTime() <= t && !isPlanFinished(p.endsAt));
  if (live.length > 0) {
    const plan = live.find((p) => p.id === lastPlanId) ?? live[0];
    return { plan, live: true, header: "En curso" };
  }
  const soon = plans
    .filter((p) => {
      const start = new Date(p.startsAt).getTime();
      return start > t && start - t <= 7 * DAY;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  if (!soon) return null;
  const days = Math.round((startOfDay(new Date(soon.startsAt)) - startOfDay(now)) / DAY);
  const header = days <= 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`;
  return { plan: soon, live: false, header };
}

/** Accepts a full invite link (…/join/CODE or …/join/static?code=CODE) or the bare code. */
export function parseJoinCode(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const fromQuery = /[?&]code=([^&#\s]+)/.exec(text);
  if (fromQuery) return decodeURIComponent(fromQuery[1]);
  const fromPath = /\/join\/([^/?#\s]+)/.exec(text);
  if (fromPath && fromPath[1] !== "static") return decodeURIComponent(fromPath[1]);
  return /^[\w-]{4,}$/.test(text) ? text : null;
}

export default function CreateMenu(props: Props) {
  const { open, onClose, anchorRef, sidebarRef, plans, lastPlanId, planContext } = props;
  const menuRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [view, setView] = useState<"menu" | "unirme">("menu");
  const [subOpen, setSubOpen] = useState(false);
  const [subQuery, setSubQuery] = useState("");
  const [joinText, setJoinText] = useState("");
  const [joinError, setJoinError] = useState(false);

  const relevant = useMemo(() => {
    if (planContext || !plans) return null;
    return pickRelevantPlan(plans, lastPlanId);
  }, [planContext, plans, lastPlanId]);

  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    if (planContext) {
      const opts: Option[] = [];
      if (planContext.canEdit) opts.push({ key: "actividad", label: "Actividad", shortcut: "A", icon: <CalendarPlus className={ICON} aria-hidden />, run: planContext.onActividad });
      opts.push({ key: "gasto", label: "Gasto", shortcut: "G", icon: <Receipt className={ICON} aria-hidden />, run: planContext.onGasto });
      if (planContext.canInvite) opts.push({ key: "invitar", label: "Invitar", shortcut: "I", icon: <UserPlus className={ICON} aria-hidden />, run: planContext.onInvitar });
      out.push({ key: "plan", header: { text: `En este plan · ${planContext.title}`, live: false }, options: opts });
    } else if (relevant) {
      const id = relevant.plan.id;
      out.push({
        key: "plan",
        header: { text: `${relevant.header} · ${relevant.plan.title}`, live: relevant.live },
        options: [
          { key: "actividad", label: "Actividad", shortcut: "A", icon: <CalendarPlus className={ICON} aria-hidden />, run: () => props.onActividadEnPlan(id) },
          { key: "gasto", label: "Gasto", shortcut: "G", icon: <Receipt className={ICON} aria-hidden />, run: () => props.onGastoEnPlan(id) },
        ],
      });
    }
    const general: Option[] = [
      { key: "plan-nuevo", label: "Plan nuevo", shortcut: "P", icon: <Map className={ICON} aria-hidden />, run: props.onPlanNuevo },
      { key: "grupo-nuevo", label: "Grupo nuevo", icon: <Users className={ICON} aria-hidden />, run: props.onGrupoNuevo },
    ];
    if (out.length > 0) {
      general.push({ key: "gasto-otro", label: "Gasto en otro plan", submenu: true, icon: <Receipt className={ICON} aria-hidden />, run: () => setSubOpen(true) });
    } else {
      general.push({ key: "unirme", label: "Unirme con enlace", icon: <Link2 className={ICON} aria-hidden />, run: () => setView("unirme") });
    }
    out.push({ key: "general", options: general });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are recreated each render by the sidebar; the groups only depend on the data
  }, [planContext, relevant]);

  const options = useMemo(() => groups.flatMap((g) => g.options), [groups]);

  // Plans for «Gasto en otro plan»: active ones, in progress and upcoming first.
  const otherPlans = useMemo(() => {
    const current = planContext?.planId ?? relevant?.plan.id;
    const list = (plans ?? [])
      .filter((p) => p.id !== current && !isPlanFinished(p.endsAt))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    const q = subQuery.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    if (!q) return list;
    return list.filter((p) => p.title.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(q));
  }, [plans, planContext, relevant, subQuery]);
  const activeCount = useMemo(() => (plans ?? []).filter((p) => !isPlanFinished(p.endsAt)).length, [plans]);

  // Reset when it opens; position next to the sidebar.
  useLayoutEffect(() => {
    if (!open) return;
    setView("menu");
    setSubOpen(false);
    setSubQuery("");
    setJoinText("");
    setJoinError(false);
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const s = sidebarRef.current?.getBoundingClientRect();
      if (!a || !s) return;
      setPos({ left: s.right + 8, top: a.top });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchorRef, sidebarRef]);

  // Focus: first option of the first group; with a plan that only starts soon, «Plan nuevo».
  const focusedOnOpen = useRef(false);
  useEffect(() => {
    if (!open) { focusedOnOpen.current = false; return; }
    if (focusedOnOpen.current || !pos || view !== "menu") return;
    focusedOnOpen.current = true;
    const target = relevant && !relevant.live ? "plan-nuevo" : options[0]?.key;
    menuRef.current?.querySelector<HTMLElement>(`[data-key="${target}"]`)?.focus();
  }, [open, pos, view, relevant, options]);

  // If the plans arrive after opening, keep the focus where the design wants it.
  useEffect(() => {
    if (!open || view !== "menu") return;
    const el = document.activeElement as HTMLElement | null;
    if (el && menuRef.current?.contains(el)) return;
    const target = relevant && !relevant.live ? "plan-nuevo" : options[0]?.key;
    menuRef.current?.querySelector<HTMLElement>(`[data-key="${target}"]`)?.focus();
  }, [open, view, relevant, options]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || subRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose, anchorRef]);

  if (!open || !pos || typeof document === "undefined") return null;

  const choose = (o: Option) => {
    if (o.submenu || o.key === "unirme") { o.run(); return; }
    onClose(false);
    o.run();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (subOpen) { setSubOpen(false); menuRef.current?.querySelector<HTMLElement>('[data-key="gasto-otro"]')?.focus(); return; }
      if (view === "unirme") { setView("menu"); return; }
      onClose(true);
      return;
    }
    if (view !== "menu" || subOpen) return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next]?.focus();
      return;
    }
    if (e.key === "ArrowRight" && (document.activeElement as HTMLElement | null)?.dataset.key === "gasto-otro") {
      e.preventDefault();
      setSubOpen(true);
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? items[0] : items[items.length - 1])?.focus();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    const hit = options.find((o) => o.shortcut?.toLowerCase() === e.key.toLowerCase());
    if (hit) { e.preventDefault(); choose(hit); }
  };

  const submitJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = parseJoinCode(joinText);
    if (!code) { setJoinError(true); return; }
    onClose(false);
    props.onUnirme(code);
  };

  const maxH = `calc(100dvh - ${pos.top}px - 16px)`;

  return createPortal(
    <div onKeyDown={onMenuKey}>
      <div
        ref={menuRef}
        role={view === "menu" ? "menu" : "dialog"}
        aria-label={view === "menu" ? "Crear" : "Unirme con enlace"}
        style={{ left: pos.left, top: pos.top, maxHeight: maxH }}
        className="fixed z-[1250] w-[292px] overflow-y-auto rounded-[8px] border border-app bg-app p-[6px] shadow-[var(--shadow-md)]"
      >
        {view === "menu" ? (
          groups.map((g, gi) => (
            <div key={g.key} role="group" aria-label={g.header?.text}>
              {gi > 0 && <div role="separator" className="mx-[-6px] my-[6px] h-px bg-[var(--border)]" />}
              {g.header && (
                <div className="flex h-[32px] items-center gap-[6px] px-[10px] text-[12px] font-[var(--fw-semibold)] text-muted">
                  {g.header.live && <span aria-hidden className="size-[8px] shrink-0 rounded-full bg-[var(--primary)]" />}
                  <span className="truncate">{g.header.text}</span>
                </div>
              )}
              {g.options.map((o) => (
                <button
                  key={o.key}
                  data-key={o.key}
                  type="button"
                  role="menuitem"
                  aria-haspopup={o.submenu ? "menu" : undefined}
                  aria-expanded={o.submenu ? subOpen : undefined}
                  aria-keyshortcuts={o.shortcut}
                  onClick={() => choose(o)}
                  onMouseEnter={o.submenu ? () => setSubOpen(true) : () => setSubOpen(false)}
                  className={`group flex h-[44px] w-full items-center gap-[12px] rounded-[6px] px-[10px] text-left text-[15px] text-app transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none ${o.submenu && subOpen ? "bg-[var(--surface-2)]" : ""}`}
                >
                  {o.icon}
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.shortcut && (
                    <kbd className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[4px] border border-[var(--border-strong)] px-[5px] font-[inherit] text-[12px] text-muted">{o.shortcut}</kbd>
                  )}
                  {o.submenu && <ChevronRight className="size-[16px] text-muted" aria-hidden />}
                </button>
              ))}
            </div>
          ))
        ) : (
          <form onSubmit={submitJoin} className="flex flex-col gap-[10px] p-[8px]">
            <label htmlFor="crear-unirme" className="text-[13px] font-[var(--fw-semibold)] text-app">Enlace o código del plan</label>
            <input
              id="crear-unirme"
              autoFocus
              value={joinText}
              onChange={(e) => { setJoinText(e.target.value); setJoinError(false); }}
              placeholder="frimee.es/join/…"
              aria-invalid={joinError}
              aria-describedby={joinError ? "crear-unirme-error" : undefined}
              className="h-[44px] w-full rounded-[8px] border border-[var(--input-border)] bg-[var(--input-bg)] px-[12px] text-[15px] text-app outline-none placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-border-focus)]"
            />
            {joinError && <p id="crear-unirme-error" className="text-[13px] text-[var(--error)]">Ese enlace no es de un plan de Frimee.</p>}
            <div className="flex justify-end gap-[8px]">
              <button type="button" onClick={() => setView("menu")} className="h-[40px] rounded-[8px] px-[14px] text-[14px] text-app hover:bg-[var(--surface-2)]">Volver</button>
              <button type="submit" disabled={!joinText.trim()} className="h-[40px] rounded-[8px] bg-[var(--text-primary)] px-[14px] text-[14px] font-[var(--fw-semibold)] text-[var(--bg)] disabled:opacity-40">Unirme</button>
            </div>
          </form>
        )}
      </div>

      {subOpen && view === "menu" && (
        <SubmenuPlans
          ref={subRef}
          left={pos.left + 292 + 4}
          anchor={menuRef.current?.querySelector<HTMLElement>('[data-key="gasto-otro"]') ?? null}
          plans={otherPlans}
          loading={plans === null}
          showSearch={activeCount > 6}
          query={subQuery}
          onQuery={setSubQuery}
          onPick={(id) => { onClose(false); props.onGastoEnPlan(id); }}
          onBack={() => { setSubOpen(false); menuRef.current?.querySelector<HTMLElement>('[data-key="gasto-otro"]')?.focus(); }}
        />
      )}
    </div>,
    document.body,
  );
}

type SubProps = {
  ref: RefObject<HTMLDivElement | null>;
  left: number;
  anchor: HTMLElement | null;
  plans: FeedPlanItemDto[];
  loading: boolean;
  showSearch: boolean;
  query: string;
  onQuery: (q: string) => void;
  onPick: (planId: number) => void;
  onBack: () => void;
};

function SubmenuPlans({ ref, left, anchor, plans, loading, showSearch, query, onQuery, onPick, onBack }: SubProps) {
  const top = Math.max(8, (anchor?.getBoundingClientRect().top ?? 80) - 6);
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const first = innerRef.current?.querySelector<HTMLElement>(showSearch ? "input" : "[role=menuitem]");
    // Only take the focus when the submenu was opened from the keyboard.
    if (anchor && document.activeElement === anchor) first?.focus();
  }, [anchor, showSearch]);

  const onKey = (e: React.KeyboardEvent) => {
    const items = Array.from(innerRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowLeft" && (e.target as HTMLElement).tagName !== "INPUT") { e.preventDefault(); e.stopPropagation(); onBack(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); items[i <= 0 ? items.length - 1 : i - 1]?.focus(); }
  };

  return (
    <div
      ref={(el) => { innerRef.current = el; ref.current = el; }}
      role="menu"
      aria-label="Gasto en otro plan"
      onKeyDown={onKey}
      style={{ left, top, maxHeight: `calc(100dvh - ${top}px - 16px)` }}
      className="fixed z-[1251] flex w-[272px] flex-col rounded-[8px] border border-app bg-app p-[6px] shadow-[var(--shadow-md)]"
    >
      {showSearch && (
        <div className="relative mb-[6px]">
          <Search className="pointer-events-none absolute left-[10px] top-1/2 size-[16px] -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Buscar plan"
            aria-label="Buscar plan"
            className="h-[38px] w-full rounded-[6px] bg-[var(--search-field-bg)] pl-[32px] pr-[10px] text-[14px] text-app outline-none placeholder:text-[var(--input-placeholder)]"
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p role="status" className="px-[10px] py-[12px] text-[14px] text-muted">Cargando tus planes…</p>
        ) : plans.length === 0 ? (
          <p className="px-[10px] py-[12px] text-[14px] text-muted">{query ? `Ningún plan con «${query}»` : "No tienes otros planes activos"}</p>
        ) : (
          plans.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              onClick={() => onPick(p.id)}
              className="flex h-[44px] w-full items-center rounded-[6px] px-[10px] text-left text-[15px] text-app transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none"
            >
              <span className="truncate">{p.title}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
