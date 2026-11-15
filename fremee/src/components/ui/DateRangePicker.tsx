"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Drawer } from "vaul";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import { useIsPhone } from "@/components/chat/bitacora/Sheet";

/**
 * Selector de fechas (canvas «Frimee · Chat · Bitácora», boards fe-*): one «Fechas» field instead of
 * two dd/mm/aaaa inputs. A dropdown under the row on desktop (it applies and closes on the last day),
 * a bottom sheet on phones («Usar …» waits for both days). Days @frimee suggested have a dashed
 * border. First tap = start, second = end; a second tap before the start becomes the new start (there
 * is never a range error); the same day twice = a one-day plan. Dates are «yyyy-mm-dd».
 */
export type DateRangePickerProps = {
  inicio: string;
  fin: string;
  onChange: (inicio: string, fin: string) => void;
  /** What @frimee suggested: dashed days in the calendar. */
  sugerido?: { inicio: string; fin: string } | null;
  /** «Crear plan» pressed without dates: red field, «Elige las fechas del plan». */
  invalid?: boolean;
  disabled?: boolean;
  label?: string;
};

// ── dates ─────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
const todayIso = () => iso(new Date());
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dayShort = (s: string) => parse(s).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(".", "");
const mon = (s: string) => parse(s).toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
/** «noviembre 2026» */
const monthTitle = (y: number, m: number) => `${new Date(y, m, 1).toLocaleDateString("es-ES", { month: "long" })} ${y}`;

/** «Vie 27 nov» */
export const dayLabel = (s: string) => `${cap(dayShort(s))} ${mon(s)}`;
/** «Vie 27 – dom 29 nov» (no count), across months «Lun 30 nov – mié 2 dic». */
export function rangeLabel(a: string, b: string): string {
  if (a === b) return dayLabel(a);
  return parse(a).getMonth() === parse(b).getMonth()
    ? `${cap(dayShort(a))} – ${dayShort(b)} ${mon(b)}`
    : `${dayLabel(a)} – ${dayShort(b)} ${mon(b)}`;
}
/** «Vie 27 – dom 29 nov · 3 días» */
export const rangeWithCount = (a: string, b: string) => {
  const n = daysBetween(a, b) + 1;
  return `${rangeLabel(a, b)} · ${n} ${n === 1 ? "día" : "días"}`;
};
const ariaDay = (s: string) => parse(s).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

// ── the field ─────────────────────────────────────────────────────────────────

export function DateRangePicker(props: DateRangePickerProps) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { inicio, fin, invalid, disabled, label = "Fechas del plan" } = props;
  const has = Boolean(inicio && fin);

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`${label}: ${has ? rangeWithCount(inicio, fin) : "sin elegir"}`}
      onClick={() => setOpen(true)}
      className={`relative -mx-[8px] flex h-[44px] min-w-0 flex-1 items-center gap-[8px] rounded-[8px] pl-[8px] pr-[4px] text-left text-[15px] disabled:opacity-50 ${
        open ? "bg-[var(--surface-2)] outline outline-2 -outline-offset-2 outline-[var(--primary)]" : ""}`}
    >
      {invalid && !has ? (
        <>
          <CircleAlert aria-hidden className="size-[18px] shrink-0 text-[var(--error)]" />
          <span className="min-w-0 flex-1 truncate text-[var(--error)]">Elige las fechas del plan</span>
        </>
      ) : has ? (
        <span className="min-w-0 flex-1 truncate tabular-nums text-app">{rangeWithCount(inicio, fin)}</span>
      ) : (
        <>
          <CalendarDays aria-hidden className="size-[18px] shrink-0 text-[var(--text-secondary)]" />
          <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">Elige las fechas</span>
        </>
      )}
      <ChevronDown aria-hidden className="size-[18px] shrink-0 text-[var(--text-secondary)]" />
    </button>
  );

  return (
    <>
      {trigger}
      {open && (phone
        ? <PhoneSheet {...props} label={label} onClose={() => { setOpen(false); triggerRef.current?.focus(); }} />
        : <DesktopMenu {...props} anchor={triggerRef} onClose={() => { setOpen(false); triggerRef.current?.focus(); }} />)}
    </>
  );
}

// ── shared calendar ───────────────────────────────────────────────────────────

type CalProps = {
  /** Applied range (shown when not choosing). */
  a: string;
  b: string;
  /** First day tapped while choosing the end (null = not choosing). */
  first: string | null;
  sugerido?: { inicio: string; fin: string } | null;
  hover: boolean;
  onPick: (day: string) => void;
  onEscape: () => void;
};

function Calendar({ a, b, first, sugerido, hover, onPick, onEscape }: CalProps) {
  const today = todayIso();
  const start0 = first ?? a ?? sugerido?.inicio ?? today;
  const [view, setView] = useState(() => { const d = parse(start0 || today); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [focusDay, setFocusDay] = useState(() => (start0 && start0 >= today ? start0 : today));
  const [hov, setHov] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(view.y, view.m, 1);
    const offset = (firstOfMonth.getDay() + 6) % 7;
    const days = new Date(view.y, view.m + 1, 0).getDate();
    return { offset, list: Array.from({ length: days }, (_, i) => iso(new Date(view.y, view.m, i + 1))) };
  }, [view]);
  const isCurrentMonth = view.y === new Date().getFullYear() && view.m === new Date().getMonth();

  // While choosing the end, the hovered day previews the stretch (desktop): tinted days up to it,
  // the hovered one with a 2 px border (it is not chosen yet).
  const preview = first && hover && hov && hov > first ? hov : null;
  const end = first ? (preview ?? first) : b;
  const startSel = first ?? a;
  const inRange = (d: string) => Boolean(startSel && end && d > startSel && d < end);
  const isEdge = (d: string) => Boolean(startSel && (d === startSel || (d === end && !preview)));
  const isSug = (d: string) => Boolean(sugerido?.inicio && sugerido.fin && d >= sugerido.inicio && d <= sugerido.fin);

  const go = (d: string) => {
    if (d < today) d = today;
    setFocusDay(d);
    const p = parse(d);
    if (p.getFullYear() !== view.y || p.getMonth() !== view.m) setView({ y: p.getFullYear(), m: p.getMonth() });
    moved.current = true;
  };
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [focusDay, view]);
  const changeMonth = (delta: number) => {
    const n = new Date(view.y, view.m + delta, 1);
    if (delta < 0 && isCurrentMonth) return;
    setView({ y: n.getFullYear(), m: n.getMonth() });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key;
    let next: string | null = null;
    if (k === "ArrowRight") next = addDays(focusDay, 1);
    else if (k === "ArrowLeft") next = addDays(focusDay, -1);
    else if (k === "ArrowDown") next = addDays(focusDay, 7);
    else if (k === "ArrowUp") next = addDays(focusDay, -7);
    else if (k === "PageDown" || k === "PageUp") {
      const p = parse(focusDay);
      const n = new Date(p.getFullYear(), p.getMonth() + (k === "PageDown" ? 1 : -1), 1);
      const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
      next = iso(new Date(n.getFullYear(), n.getMonth(), Math.min(p.getDate(), last)));
    } else if (k === "Home") next = addDays(focusDay, -((parse(focusDay).getDay() + 6) % 7));
    else if (k === "End") next = addDays(focusDay, 6 - ((parse(focusDay).getDay() + 6) % 7));
    else if (k === "Enter" || k === " ") { e.preventDefault(); e.stopPropagation(); if (focusDay >= today) onPick(focusDay); return; }
    else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); onEscape(); return; }
    if (next) { e.preventDefault(); go(next); if (first) setHov(next); }
  };

  const hint = first
    ? <><b className="font-[var(--fw-semibold)] text-app">{dayLabel(first)}</b> · ahora toca el último día</>
    : a && b ? rangeWithCount(a, b)
    : sugerido?.inicio ? "Toca el primer día o usa las sugeridas" : "Toca el primer día";

  return (
    <div>
      <div className="flex items-center gap-[4px]">
        <b className="flex-1 text-[16px] font-[var(--fw-semibold)] text-app">{monthTitle(view.y, view.m)}</b>
        <button type="button" aria-label="Mes anterior" title="Mes anterior" disabled={isCurrentMonth} onClick={() => changeMonth(-1)}
          className="flex size-[44px] items-center justify-center rounded-[8px] text-muted hover:bg-[var(--surface-2)] disabled:opacity-40">
          <ChevronLeft className="size-[20px]" aria-hidden />
        </button>
        <button type="button" aria-label="Mes siguiente" title="Mes siguiente" onClick={() => changeMonth(1)}
          className="flex size-[44px] items-center justify-center rounded-[8px] text-app hover:bg-[var(--surface-2)]">
          <ChevronRight className="size-[20px]" aria-hidden />
        </button>
      </div>
      <p aria-live="polite" className="mb-[8px] mt-[2px] flex min-h-[20px] items-center gap-[6px] text-[13px] tabular-nums text-muted">{hint}</p>
      <div ref={gridRef} role="grid" aria-label={monthTitle(view.y, view.m)} onKeyDown={onKeyDown} onPointerLeave={() => setHov(null)}
        className="grid grid-cols-[repeat(7,44px)] gap-x-[4px] gap-y-[2px]">
        {["L", "M", "X", "J", "V", "S", "D"].map((w) => (
          <span key={w} aria-hidden className="flex h-[28px] items-center justify-center text-[12px] font-[var(--fw-semibold)] text-muted">{w}</span>
        ))}
        {Array.from({ length: cells.offset }, (_, i) => <span key={`x${i}`} aria-hidden />)}
        {cells.list.map((d) => {
          const past = d < today;
          const edge = isEdge(d);
          const mid = !edge && !(preview === d) && inRange(d);
          const sug = !edge && !mid && isSug(d);
          const hv = preview === d;
          const label = `${ariaDay(d)}${d === today ? ", hoy" : ""}${isSug(d) ? ", sugerido por Frimee" : ""}${past ? ", no disponible" : ""}`;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              data-day={d}
              aria-selected={edge || mid}
              aria-label={label}
              aria-disabled={past || undefined}
              tabIndex={d === focusDay ? 0 : -1}
              onClick={() => { if (!past) { setFocusDay(d); onPick(d); } }}
              onPointerEnter={() => { if (hover && !past) setHov(d); }}
              className={`relative flex size-[44px] items-center justify-center rounded-[8px] border text-[15px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                past ? "cursor-not-allowed border-transparent text-muted opacity-45"
                : edge ? "border-[var(--text-primary)] bg-[var(--text-primary)] font-[var(--fw-semibold)] text-[var(--bg)]"
                : mid ? "border-[var(--chat-me-border)] bg-[var(--chat-tint)] text-app"
                : hv ? "border-2 border-[var(--primary)] text-app"
                : sug ? "border-dashed border-[var(--chat-me-border)] text-app"
                : "border-transparent text-app hover:bg-[var(--surface-2)]"}`}
            >
              {Number(d.slice(8))}
              {d === today && <span aria-hidden className={`absolute bottom-[5px] size-[4px] rounded-full ${edge ? "bg-[var(--bg)]" : "bg-[var(--text-primary)]"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const Legend = () => (
  <span className="inline-flex items-center gap-[6px] text-[12px] text-muted">
    <span aria-hidden className="size-[14px] rounded-[4px] border border-dashed border-[var(--chat-me-border)]" />Sugerido por Frimee
  </span>
);

// ── desktop: dropdown under the row ───────────────────────────────────────────

function DesktopMenu({ inicio, fin, sugerido, onChange, anchor, onClose, label = "Fechas del plan" }: DateRangePickerProps & {
  anchor: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [first, setFirst] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const W = 352;

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const h = ref.current?.offsetHeight ?? 420;
      const up = r.bottom + 4 + h > window.innerHeight && r.top - 4 - h > 0;
      setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - W - 8)), top: up ? r.top - 4 - h : r.bottom + 4 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [anchor, onClose]);
  // Focus the calendar on open.
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('[role="gridcell"][tabindex="0"]')?.focus(); }, []);

  const pick = (d: string) => {
    if (!first || d < first) { setFirst(d); return; }
    onChange(first, d);
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="fixed z-[120] rounded-[8px] border border-app bg-[var(--bg)] px-[12px] pb-[8px] pt-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.12)]"
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: W, visibility: pos ? "visible" : "hidden" }}
      onClick={(e) => e.stopPropagation()}
    >
      <Calendar a={inicio} b={fin} first={first} sugerido={sugerido} hover onPick={pick} onEscape={onClose} />
      <div className="mt-[8px] flex items-center justify-between border-t border-app pt-[4px]">
        {sugerido?.inicio ? <Legend /> : <span />}
        <button type="button" onClick={() => { setFirst(null); onChange("", ""); }}
          className="min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-muted">Borrar</button>
      </div>
    </div>,
    document.body,
  );
}

// ── phones: bottom sheet with «Usar …» ────────────────────────────────────────

function PhoneSheet({ inicio, fin, sugerido, onChange, onClose, label = "Fechas del plan" }: DateRangePickerProps & { onClose: () => void }) {
  const [draft, setDraft] = useState<{ a: string; b: string }>({ a: inicio, b: fin });
  const [first, setFirst] = useState<string | null>(null);
  const pick = (d: string) => {
    if (!first || d < first) { setFirst(d); setDraft({ a: d, b: "" }); return; }
    setFirst(null);
    setDraft({ a: first, b: d });
  };
  const ready = Boolean(draft.a && draft.b);

  return (
    <Drawer.Root open onOpenChange={(o) => { if (!o) onClose(); }} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[110] bg-black/60" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[111] flex flex-col rounded-t-[16px] border-t border-app bg-[var(--bg)] px-[16px] pt-[8px] outline-none"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
        >
          <div aria-hidden className="mx-auto mb-[4px] h-[4px] w-[36px] rounded-full bg-[var(--border)]" />
          <div className="-ml-[12px] flex items-center gap-[4px]">
            <button type="button" aria-label="Volver" title="Volver" onClick={onClose} className="flex size-[44px] items-center justify-center rounded-[8px] text-app">
              <ChevronLeft className="size-[22px]" aria-hidden />
            </button>
            <Drawer.Title className="flex-1 text-[16px] font-[var(--fw-semibold)] text-app">{label}</Drawer.Title>
            <button type="button" onClick={() => { setFirst(null); setDraft({ a: "", b: "" }); }} className="min-h-[44px] px-[4px] text-[14px] font-[var(--fw-semibold)] text-muted">Borrar</button>
          </div>
          <div className="mt-[8px] flex justify-center">
            <div className="w-[322px]">
              <Calendar a={draft.b ? draft.a : ""} b={draft.b} first={first} sugerido={sugerido} hover={false} onPick={pick} onEscape={onClose} />
            </div>
          </div>
          {sugerido?.inicio && <div className="mt-[10px]"><Legend /></div>}
          <button
            type="button"
            disabled={!ready}
            onClick={() => { onChange(draft.a, draft.b); onClose(); }}
            className="mt-[14px] flex min-h-[46px] w-full items-center justify-center rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] disabled:bg-[var(--surface-2)] disabled:text-muted"
          >
            {ready ? `Usar ${rangeLabel(draft.a, draft.b).replace(/^\w/, (c) => c.toLowerCase())}` : first ? "Elige el último día" : "Elige las fechas"}
          </button>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
