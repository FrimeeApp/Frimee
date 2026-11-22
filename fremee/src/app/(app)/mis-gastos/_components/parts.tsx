"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronRight, MapPin, SlidersHorizontal, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { ExpenseItem } from "@/components/plans/modals/ExpenseDetailModal";
import { formatMoney, formatShortDate } from "@/lib/formatters";
import type { PlanGroup, PlanOption, PlanFilter } from "./model";

export const SERIF: CSSProperties = {
  fontFamily: 'var(--font-display-face), "Instrument Serif", Georgia, serif',
  fontWeight: 400,
  letterSpacing: "-0.01em",
  fontVariantNumeric: "tabular-nums",
};

const MINUS = "−";
const METODO_TEXT = { BIZUM: "Por Bizum", TRANSFERENCIA: "Por transferencia", EFECTIVO: "En efectivo", OTRO: "Por otro medio", STRIPE: "Con tarjeta" } as const;
const methodText = (item: ExpenseItem) => (item.metodo ? METODO_TEXT[item.metodo] : null);
const signed = (item: ExpenseItem) => `${item.direction === "incoming" ? "+" : MINUS}${formatMoney(item.amount)}`;
const STRONG = "border-[var(--border-strong)]";

// ── Resumen de cifras ─────────────────────────────────────────────────────────

export type Kpis = {
  owed: number;
  owedPeople: number;
  owedPlans: number;
  owe: number;
  oweTo: string;
  toConfirmAmount: number;
  toConfirmCount: number;
};

function Figure({ label, Icon, value, hint }: { label: string; Icon: typeof ArrowDownLeft; value: number; hint: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1 text-[14px] font-[var(--fw-semibold)] text-muted">
        <Icon className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
        {label}
      </p>
      <p
        className={`mt-1.5 text-[34px] leading-none md:text-[44px] ${value === 0 ? "text-muted" : "text-app"}`}
        style={SERIF}
      >
        {formatMoney(value)}
      </p>
      <p className="mt-1 text-[12px] text-muted">{hint}</p>
    </div>
  );
}

export function SummaryCard({ kpis, stacked }: { kpis: Kpis; stacked?: boolean }) {
  const owedHint =
    kpis.owed === 0
      ? "nadie te debe nada"
      : kpis.toConfirmAmount > 0
        ? `${formatMoney(kpis.toConfirmAmount)} ya pagados, por confirmar`
        : `de ${kpis.owedPeople} ${kpis.owedPeople === 1 ? "persona" : "personas"} en ${kpis.owedPlans} ${kpis.owedPlans === 1 ? "plan" : "planes"}`;
  return (
    <section className="rounded-lg border border-app bg-surface p-4 md:p-6" aria-label="Resumen">
      <div className={stacked ? "block" : "flex gap-4"}>
        <Figure label="Te deben" Icon={ArrowDownLeft} value={kpis.owed} hint={owedHint} />
        <div className={stacked ? "mt-4 border-t border-app pt-4" : "min-w-0 flex-1"}>
          <Figure label="Debes" Icon={ArrowUpRight} value={kpis.owe} hint={kpis.owe === 0 ? "no debes nada" : `a ${kpis.oweTo}`} />
        </div>
      </div>
      {kpis.toConfirmCount > 0 && (
        <a
          href="#confirmar"
          className="mt-4 flex min-h-12 items-center gap-2 rounded-lg bg-[var(--chat-tint)] px-3 text-[14px] font-[var(--fw-semibold)] text-app"
        >
          <CheckCircle2 className="size-[18px] shrink-0 text-[var(--chat-accent-text)]" strokeWidth={1.8} aria-hidden />
          <span className="flex-1">
            {kpis.toConfirmCount} {kpis.toConfirmCount === 1 ? "pago por confirmar" : "pagos por confirmar"}
          </span>
          <span className="tabular-nums">{formatMoney(kpis.toConfirmAmount)}</span>
          <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
        </a>
      )}
    </section>
  );
}

export function AlDiaCard() {
  return (
    <section className="rounded-lg border border-app bg-surface px-4 py-5 md:p-6">
      <div className="flex items-center gap-3.5">
        <CheckCircle2 className="size-7 shrink-0 text-[var(--success)]" strokeWidth={1.75} aria-hidden />
        <div>
          <p className="text-[34px] leading-none md:text-[40px]" style={SERIF}>Estás al día</p>
          <p className="mt-1 text-[14px] text-muted">Ni debes ni te deben nada en ningún plan.</p>
        </div>
      </div>
    </section>
  );
}

// ── Pestañas: contador ────────────────────────────────────────────────────────

export function TabCount({ count }: { count: number }) {
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[11px] font-[var(--fw-bold)] tabular-nums text-[var(--contrast)]">
      {count}
    </span>
  );
}

// ── Fila de liquidación ───────────────────────────────────────────────────────

type RowProps = {
  item: ExpenseItem;
  history?: boolean;
  acting: boolean;
  onOpen: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onPay: () => void;
};

export function LiquidacionRow({ item, history, acting, onOpen, onConfirm, onReject, onPay }: RowProps) {
  const incoming = item.direction === "incoming";
  const name = item.counterparty;
  const date = formatShortDate(item.date);
  const confirming = !history && incoming && item.estado === "EN_REVISION";
  const toPay = !history && !incoming && item.estado === "PENDIENTE";

  let sentence: ReactNode;
  let sub: string;
  let hint: string | null = null;
  if (history) {
    sentence = incoming ? <><b>{name}</b> te pagó</> : <>Pagaste a <b>{name}</b></>;
    sub = `${item.planName} · ${date}`;
  } else if (confirming) {
    sentence = <><b>{name}</b> te ha pagado</>;
    const how = methodText(item);
    sub = item.concept || (how ? `${how} · ${date}` : `Lo marcó el ${date}`);
    hint = "por confirmar";
  } else if (toPay) {
    sentence = <>Debes a <b>{name}</b></>;
    sub = `${item.planName} · ${date}`;
  } else if (incoming) {
    sentence = <><b>{name}</b> te debe</>;
    sub = `Desde el ${date}`;
  } else {
    sentence = <>Pagaste a <b>{name}</b></>;
    const how = methodText(item);
    sub = how ? `${how} · ${date}` : `Lo marcaste el ${date}`;
    hint = "falta que confirme";
  }

  return (
    <div className="grid grid-cols-[40px_1fr_auto] items-center gap-x-3 border-b border-app py-2.5 last:border-b-0">
      <Avatar name={name} src={item.counterpartyImage} px={40} topMargin="" />
      <button type="button" onClick={onOpen} aria-label={`Ver detalle: ${name}`} className="min-w-0 text-left">
        <p className="truncate text-[15px] leading-[1.3] text-app [&_b]:font-[var(--fw-semibold)]">{sentence}</p>
        <p className="mt-0.5 truncate text-[13px] text-muted">{sub}</p>
      </button>
      <div className="text-right text-[15px] tabular-nums text-app">
        {toPay ? (
          <span className="flex items-center justify-end gap-2.5">
            <span className="font-[var(--fw-semibold)]">{signed(item)}</span>
            <button
              type="button"
              onClick={onPay}
              className="h-10 rounded-lg bg-[var(--primary)] px-3.5 text-[14px] font-[var(--fw-semibold)] text-[var(--contrast)]"
            >
              Pagar
            </button>
          </span>
        ) : (
          <>
            <span className={history ? "font-[var(--fw-medium)]" : "font-[var(--fw-semibold)]"}>{signed(item)}</span>
            {hint && <span className="block text-[12px] font-[var(--fw-medium)] text-muted">{hint}</span>}
          </>
        )}
      </div>
      {confirming && (
        <div className="col-span-2 col-start-2 mt-2.5 flex gap-2">
          <button
            type="button"
            disabled={acting}
            onClick={onReject}
            className={`h-10 rounded-lg border px-3.5 text-[14px] font-[var(--fw-semibold)] text-app disabled:opacity-50 ${STRONG}`}
          >
            No recibido
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={onConfirm}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--success)] px-3.5 text-[14px] font-[var(--fw-semibold)] text-[var(--success-contrast)] disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" strokeWidth={2} aria-hidden />
            {acting ? "Confirmando…" : "Confirmar"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Zonas y cabeceras de plan ─────────────────────────────────────────────────

function PlanHeader({ name, dates, subtotal, onOpen }: { name: string; dates: string | null; subtotal: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ${name}`}
      className="flex min-h-12 w-full items-center gap-2.5 pt-2.5 text-left"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[var(--chat-me-border)] bg-[var(--chat-me)] text-[var(--chat-accent-text)]">
        <MapPin className="size-4" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0 truncate text-[14px] text-app">
        <b className="font-[var(--fw-semibold)]">{name}</b>
        {dates && <em className="ml-1 text-[12px] not-italic text-muted">· {dates}</em>}
      </span>
      {subtotal > 0 && <span className="ml-auto text-[13px] tabular-nums text-muted">+{formatMoney(subtotal)}</span>}
      <ChevronRight className={`size-4 shrink-0 text-muted ${subtotal > 0 ? "" : "ml-auto"}`} aria-hidden />
    </button>
  );
}

type ZoneProps = {
  id?: string;
  title: string;
  count: number;
  tinted?: boolean;
  groups: PlanGroup[];
  cap: number;
  actingId: number | null;
  onOpenItem: (item: ExpenseItem) => void;
  onConfirm: (item: ExpenseItem) => void;
  onReject: (item: ExpenseItem) => void;
  onPay: (item: ExpenseItem) => void;
  onOpenPlan: (planId: number) => void;
};

export function Zone({ id, title, count, tinted, groups, cap, actingId, onOpenItem, onConfirm, onReject, onPay, onOpenPlan }: ZoneProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  if (count === 0) return null;
  return (
    <section id={id} aria-label={title} className="scroll-mt-4">
      <div className="mb-1.5 mt-7 flex items-baseline gap-2">
        <h2 className="text-[17px] font-[var(--fw-semibold)] text-app">{title}</h2>
        <span className="text-[13px] tabular-nums text-muted">{count}</span>
      </div>
      <div className={tinted ? "-mx-3 rounded-xl bg-[var(--chat-tint)] px-3 pb-2 pt-1" : ""}>
        {groups.map((group) => {
          const open = expanded.has(group.planId);
          const shown = open ? group.items : group.items.slice(0, cap);
          const hidden = group.items.length - shown.length;
          return (
            <div key={group.planId}>
              <PlanHeader name={group.planName} dates={group.planDates} subtotal={tinted ? 0 : group.owedSubtotal} onOpen={() => onOpenPlan(group.planId)} />
              {shown.map((item) => (
                <LiquidacionRow
                  key={item.id}
                  item={item}
                  acting={actingId === item.id}
                  onOpen={() => onOpenItem(item)}
                  onConfirm={() => onConfirm(item)}
                  onReject={() => onReject(item)}
                  onPay={() => onPay(item)}
                />
              ))}
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => new Set(prev).add(group.planId))}
                  className="flex min-h-11 items-center gap-1.5 text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]"
                >
                  {tinted ? `${hidden} más en ${group.planName}` : `Ver los ${group.items.length} de ${group.planName}`}
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Filtro por plan ───────────────────────────────────────────────────────────

const countLabel = (n: number) => (n === 0 ? "al día" : String(n));

type FilterProps = { options: PlanOption[]; total: number; value: PlanFilter; onChange: (v: PlanFilter) => void };

/** Escritorio: lista siempre visible en la columna lateral. */
export function PlanList({ options, total, value, onChange }: FilterProps) {
  if (options.length === 0) return null;
  const entry = (on: boolean, label: string, n: string, key: string | number, v: PlanFilter) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onChange(v)}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] text-app ${on ? "bg-surface-inset font-[var(--fw-semibold)]" : "hover:bg-surface-inset/50"}`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-[12px] tabular-nums text-muted">{n}</span>
    </button>
  );
  return (
    <section className="rounded-lg border border-app bg-surface px-2 py-3" aria-label="Por plan">
      <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-[var(--fw-semibold)] text-muted">Por plan</p>
      <div role="radiogroup" aria-label="Plan">
        {entry(value === "all", "Todos los planes", String(total), "all", "all")}
        {options.map((o) => entry(value === o.id, o.name, countLabel(o.count), o.id, o.id))}
      </div>
    </section>
  );
}

/** Móvil: chips con contador y un botón que abre la hoja «Ver por plan». */
export function PlanChips({ options, total, value, onChange }: FilterProps) {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);
  if (options.length === 0) return null;
  const withItems = options.filter((o) => o.count > 0);
  // El plan elegido siempre se ve como chip, aunque no esté entre los primeros.
  const picked = options.find((o) => o.id === value);
  const shown = withItems.slice(0, 3);
  if (picked && !shown.some((o) => o.id === picked.id)) shown.splice(2, 1, picked);
  const chip = (on: boolean, label: string, n: number, key: string | number, v: PlanFilter) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      onClick={() => onChange(v)}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-[13px] font-[var(--fw-semibold)] ${on ? "border-2 border-[var(--primary)] px-[13px] text-app" : `border px-3.5 text-muted ${STRONG}`}`}
    >
      {label} <b className="font-[var(--fw-semibold)] text-app">{n}</b>
    </button>
  );
  const sheetRows = [
    { id: "all" as PlanFilter, name: "Todos los planes", n: String(total) },
    ...options.map((o) => ({ id: o.id, name: o.name, n: countLabel(o.count) })),
  ];
  return (
    <>
      <div className="mt-3 flex gap-1.5 overflow-x-auto" aria-label="Filtrar por plan">
        {chip(value === "all", "Todos", total, "all", "all")}
        {shown.map((o) => chip(value === o.id, o.name, o.count, o.id, o.id))}
        {options.length > shown.length && (
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-label="Ver por plan"
            className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border text-muted ${STRONG}`}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {sheet && (
        <div className="fixed inset-0 z-[var(--z-modal)]" role="dialog" aria-modal="true" aria-label="Ver por plan">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/55" onClick={() => setSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-app bg-[var(--bg)] px-3 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 shadow-elev-4">
            <div className="flex items-center px-2 pb-2">
              <h2 className="flex-1 text-[17px] font-[var(--fw-semibold)] text-app">Ver por plan</h2>
              <button type="button" onClick={() => setSheet(false)} aria-label="Cerrar" className="flex size-11 items-center justify-center text-app">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {sheetRows.map((o) => (
              <button
                key={String(o.id)}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setSheet(false);
                }}
                className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[15px] text-app ${value === o.id ? "bg-[var(--chat-tint)] font-[var(--fw-semibold)]" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                <span className="text-[12px] tabular-nums text-muted">{o.n}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Estados ───────────────────────────────────────────────────────────────────

type FilteredEmptyProps = {
  planName: string;
  lastText: string | null;
  onHistory: () => void;
  onAll: () => void;
};

export function FilteredEmpty({ planName, lastText, onHistory, onAll }: FilteredEmptyProps) {
  return (
    <div className="mt-8 rounded-lg border border-app bg-surface p-5">
      <CheckCircle2 className="size-6 text-[var(--success)]" strokeWidth={1.75} aria-hidden />
      <p className="mt-3 text-[24px] leading-tight" style={SERIF}>{planName} está saldado</p>
      {lastText && <p className="mt-1 text-[14px] text-muted">{lastText}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onHistory} className={`h-10 rounded-lg border px-3.5 text-[14px] font-[var(--fw-semibold)] text-app ${STRONG}`}>
          Ver su historial
        </button>
        <button type="button" onClick={onAll} className="h-10 px-2 text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">
          Todos los planes
        </button>
      </div>
    </div>
  );
}

export function SimpleEmpty({ text }: { text: string }) {
  return <p className="py-10 text-center text-[14px] text-muted">{text}</p>;
}

function Bar({ w, h, mt = 0 }: { w: string; h: number; mt?: number }) {
  return <span className="skeleton-shimmer block rounded-lg" style={{ width: w, height: h, marginTop: mt }} />;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 border-b border-app py-3">
      <span className="skeleton-shimmer block size-10 rounded-full" />
      <div className="flex-1">
        <Bar w="60%" h={14} />
        <Bar w="40%" h={12} mt={6} />
      </div>
      <Bar w="64px" h={16} />
    </div>
  );
}

export function MisGastosSkeleton() {
  return (
    <div aria-busy="true" role="status" aria-label="Cargando tus gastos">
      <div className="mt-7"><Bar w="120px" h={18} /><SkeletonRow /><SkeletonRow /></div>
      <div className="mt-7"><Bar w="140px" h={18} /><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
    </div>
  );
}
