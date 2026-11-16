"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Calendar, Check, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { ACTIVITY_TYPE_OPTIONS } from "@/app/(app)/plans/[id]/_components/AddSubplanSheet";
import { bandText, hhmm, type Band } from "./itineraryModel";

/** Current time, refreshed every minute (the «Ahora» line and «Empieza en…»). */
export function useNow(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    let interval: number | undefined;
    // Line up with the minute so «Ahora, 13:20» changes when the clock does.
    const timeout = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(timeout);
      if (interval) window.clearInterval(interval);
    };
  }, [enabled]);
  return now;
}

const PILL = "inline-flex h-[22px] shrink-0 items-center rounded-full px-[8px] text-[12px] font-[var(--fw-semibold)]";

export function TodayPill() {
  return <span className={`${PILL} bg-[var(--text-primary)] text-[var(--bg)]`}>Hoy</span>;
}

export function DonePill({ label }: { label: string }) {
  return (
    <span className={`${PILL} gap-[4px] bg-surface-2 text-[var(--text-secondary)]`}>
      <Check className="size-[12px]" strokeWidth={2.6} aria-hidden />
      {label}
    </span>
  );
}

/** «Ahora» between what is done and what is coming. */
export function NowLine({ now }: { now: Date }) {
  const time = hhmm(now.toISOString());
  return (
    <div className="-mt-[6px] mb-[6px] flex h-[28px] items-center" role="note" aria-label={`Ahora, ${time}`}>
      <span className="w-[54px] shrink-0 pr-[var(--space-2)] text-right text-[12px] font-[var(--fw-bold)] tabular-nums text-primary-token sm:w-[82px]">
        {time}
      </span>
      <span className="flex w-[28px] shrink-0 justify-center">
        <span className="itinerary-now-dot block size-[10px] rounded-full bg-primary-token shadow-[0_0_0_3px_var(--bg)]" />
      </span>
      <span className="ml-[var(--space-3)] h-[2px] flex-1 rounded-[1px] bg-primary-token" />
    </div>
  );
}

type DayHeaderProps = {
  title: string;
  detail: string;
  expanded: boolean | null;
  onToggle?: () => void;
  pill?: ReactNode;
  action?: ReactNode;
};

/** Day header. `expanded: null` = nothing inside to unfold (an empty day). */
export function DayHeader({ title, detail, expanded, onToggle, pill, action }: DayHeaderProps) {
  const body = (
    <>
      <span className="mt-[2px] inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center text-muted">
        {expanded !== null && <ChevronDown className={`size-[15px] transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-[8px]">
          <span className="font-[var(--fw-semibold)] text-app" style={{ fontSize: "var(--font-h4)", lineHeight: "1.15" }}>{title}</span>
          {pill}
        </span>
        <span className="mt-[6px] block text-body-sm font-[var(--fw-medium)] leading-[1.15] text-muted">{detail}</span>
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-[var(--space-2)]">
      {expanded === null ? (
        <div className="flex min-w-0 flex-1 items-start gap-[6px]">{body}</div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-[6px] text-left transition-colors hover:text-primary-token"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Plegar" : "Desplegar"} ${title}`}
        >
          {body}
        </button>
      )}
      {action}
    </div>
  );
}

export function DayAddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-[44px] shrink-0 items-center gap-[6px] rounded-chip px-[var(--space-3)] text-body-sm font-[var(--fw-medium)] text-primary-token transition-colors hover:bg-primary-token/10"
    >
      <Plus className="size-[16px]" aria-hidden />
      Añadir
    </button>
  );
}

function TypeIcon({ tipo, className }: { tipo: string; className?: string }) {
  const opt = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === tipo) ?? ACTIVITY_TYPE_OPTIONS[0];
  return <opt.Icon className={className} aria-hidden />;
}

/** «Sigue · Hotel Alfama · noche 2 de 4» above the day, outside the hour line. */
export function BandRow({ band, onOpen }: { band: Band; onOpen?: () => void }) {
  const { lead, tail } = bandText(band);
  const inner = (
    <>
      <span className="flex text-primary-token"><TypeIcon tipo={band.span.row.tipo} className="size-[16px]" /></span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-[var(--fw-semibold)] text-app">{lead}</span>
        <span className="text-muted"> · {tail}</span>
      </span>
      {onOpen && <span className="flex w-[32px] justify-center text-muted"><ChevronRight className="size-[16px]" aria-hidden /></span>}
    </>
  );
  const cls = "flex min-h-[44px] w-full items-center gap-[10px] rounded-[8px] border border-app bg-surface pl-[12px] pr-[4px] text-left text-[14px]";
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`${cls} transition-colors hover:border-[var(--border-strong)]`} aria-label={`${lead}, ${tail}. Abrir`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Folded run of days: quiet days («3 días libres») or days already lived («Hechos»). */
export function FoldRow({
  title, detail, pill, onExpand, onAdd, addLabel,
}: { title: string; detail: string; pill?: ReactNode; onExpand: () => void; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="flex min-h-[52px] items-center gap-[var(--space-2)]">
      <button
        type="button"
        onClick={onExpand}
        aria-expanded={false}
        aria-label={`${title}, ${detail}. Desplegar`}
        className="flex min-w-0 flex-1 items-center gap-[6px] text-left transition-colors hover:text-primary-token"
      >
        <span className="flex w-[20px] shrink-0 flex-col items-center gap-[3px]" aria-hidden>
          <i className="block size-[3px] rounded-full bg-[var(--text-secondary)]" />
          <i className="block size-[3px] rounded-full bg-[var(--text-secondary)]" />
          <i className="block size-[3px] rounded-full bg-[var(--text-secondary)]" />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-[8px]">
            <span className="text-body font-[var(--fw-semibold)] text-app">{title}</span>
            {pill}
          </span>
          <span className="mt-[2px] block text-body-sm text-muted">{detail}</span>
        </span>
      </button>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          className="inline-flex size-[44px] shrink-0 items-center justify-center rounded-full text-primary-token transition-colors hover:bg-primary-token/10"
        >
          <Plus className="size-[18px]" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Long plan with nothing yet: «14 días por llenar». */
export function LongEmptyState({ range, days, onAdd }: { range: string; days: number; onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-[var(--space-16)] text-center text-muted">
      <Calendar className="mb-[var(--space-3)] size-[40px] opacity-30" aria-hidden />
      <p className="text-body font-[var(--fw-medium)] text-app">Sin actividades</p>
      <p className="mt-[var(--space-1)] text-body-sm">{days} días por llenar · {range}</p>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-[var(--space-5)] flex min-h-[44px] items-center gap-[var(--space-2)] rounded-chip border border-primary-token px-[var(--space-4)] text-body-sm font-[var(--fw-medium)] text-primary-token transition-colors hover:bg-primary-token/10"
        >
          <Plus className="size-[16px]" aria-hidden /> Añadir actividad
        </button>
      )}
      <p className="mt-[var(--space-4)] text-body-sm">Los días irán apareciendo según añadas cosas.</p>
    </div>
  );
}

export function MapPlaceholder() {
  return (
    <div className="flex h-[160px] items-center justify-center rounded-[8px] border border-dashed border-app bg-surface px-[var(--space-6)] text-center text-body-sm text-muted">
      El mapa aparece cuando añadas la primera actividad.
    </div>
  );
}

/** Finished trip: «5 días · 9 actividades · 732,00 € en gastos». */
export function TripSummary({ stats }: { stats: Array<{ value: string; label: string }> }) {
  return (
    <section aria-label="Resumen del viaje" className="mb-[var(--space-6)] grid grid-flow-col auto-cols-fr gap-[var(--space-3)] rounded-[8px] border border-app bg-surface p-[var(--space-4)]">
      {stats.map((s) => (
        <div key={s.label} className="min-w-0">
          <p className="truncate text-[22px] font-[var(--fw-semibold)] leading-[1.1] tabular-nums text-app [font-family:var(--font-display-face)]">{s.value}</p>
          <p className="mt-[2px] text-caption text-muted">{s.label}</p>
        </div>
      ))}
    </section>
  );
}

/** One day of a finished trip; the day number sits where the day's photo would go. */
export function FinishedDayRow({
  number, title, detail, expanded, onToggle,
}: { number: number; title: string; detail: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`${title}, ${detail}. ${expanded ? "Ocultar" : "Ver"}`}
      className="flex w-full items-center gap-[var(--space-3)] py-[var(--space-2)] text-left transition-colors hover:text-primary-token"
    >
      <span className="flex size-[56px] shrink-0 items-center justify-center rounded-[8px] bg-surface-2 text-[24px] text-app [font-family:var(--font-display-face)]">
        {number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-[var(--fw-semibold)] text-app">{title}</span>
        <span className="mt-[2px] block text-body-sm text-muted">{detail}</span>
      </span>
      <ChevronDown className={`size-[16px] shrink-0 text-muted transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`} aria-hidden />
    </button>
  );
}

/** Renders `children` only once the box scrolls into view (the finished trip's map). */
export function WhenVisible({ children, placeholderClassName }: { children: ReactNode; placeholderClassName: string }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!node || visible) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible(true);
    }, { rootMargin: "200px" });
    io.observe(node);
    return () => io.disconnect();
  }, [node, visible]);
  return visible ? <>{children}</> : <div ref={setNode} className={placeholderClassName} aria-hidden />;
}
