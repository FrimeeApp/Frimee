"use client";

import Link from "next/link";
import { BedDouble, Bus, CalendarDays, Plane, Receipt, Ship, Ticket, Train, UtensilsCrossed } from "lucide-react";
import type { CardKind, CardMoment, ExpenseMoment, TripSummaryMoment } from "./moments";
import { cardLabel, formatEuros } from "./moments";

const frame = "w-full max-w-[340px] overflow-hidden rounded-[8px] border border-app bg-[var(--surface)]";
const label = "flex items-center gap-[6px] text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted";
const footer = "flex min-h-[44px] items-center justify-between gap-[8px] border-t border-app px-[14px] text-[13px]";

// ── Trip summary ──────────────────────────────────────────────────────────────────────────────

/** Closes the last chapter when the trip ends (board k-momentos · Resumen del viaje). */
export function TripSummaryCard({
  data, planTitle, planDates, planId,
}: {
  data: TripSummaryMoment;
  planTitle?: string;
  planDates?: string;
  planId?: number | null;
}) {
  return (
    <div className={frame}>
      <div className="p-[14px]">
        <p className={label}>Fin del viaje</p>
        {planTitle && <p className="mt-[4px] [font-family:var(--font-display-face)] text-[32px] leading-[36px] text-app">{planTitle}</p>}
        {planDates && <p className="mt-[2px] text-[12px] text-muted">{planDates}</p>}
        <dl className="mt-[14px] grid grid-cols-2 gap-[12px]">
          <div>
            <dt className="text-[12px] text-muted">Total gastado</dt>
            <dd className="text-[20px] font-[var(--fw-semibold)] tabular-nums text-app">{data.total > 0 ? formatEuros(data.total) : "Sin gastos"}</dd>
          </div>
          {data.num_miembros > 1 && data.total > 0 && (
            <div>
              <dt className="text-[12px] text-muted">Por persona</dt>
              <dd className="text-[20px] font-[var(--fw-semibold)] tabular-nums text-app">{formatEuros(data.por_persona)}</dd>
            </div>
          )}
        </dl>
        {data.top_pagador && (
          <p className="mt-[12px] text-[14px] text-app">
            <span className="text-muted">Pagó más · </span>
            {data.top_pagador} · <span className="tabular-nums">{formatEuros(data.top_pagador_importe ?? 0)}</span>
          </p>
        )}
        <p className="mt-[6px] text-[12px] text-muted">
          {data.actividades} {data.actividades === 1 ? "actividad" : "actividades"} · {data.deudas_pendientes} {data.deudas_pendientes === 1 ? "deuda pendiente" : "deudas pendientes"}
        </p>
      </div>
      {planId && (
        <div className={footer}>
          <Link href={`/plans/${planId}?tab=gastos`} className="flex min-h-[44px] items-center font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Ver cuentas</Link>
          <Link href={`/plans/${planId}/album`} className="flex min-h-[44px] items-center font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Álbum</Link>
        </div>
      )}
    </div>
  );
}

// ── Expense ───────────────────────────────────────────────────────────────────────────────────

export function ExpenseCard({ data, planId }: { data: ExpenseMoment; planId?: number | null }) {
  const each = data.participantes > 0 ? data.total / data.participantes : data.total;
  return (
    <div className={frame}>
      <div className="p-[14px]">
        <p className={label}><Receipt className="size-[14px]" aria-hidden /> Gasto</p>
        <div className="mt-[6px] flex items-baseline justify-between gap-[12px]">
          <p className="min-w-0 break-words [font-family:var(--font-display-face)] text-[24px] leading-[28px] text-app">{data.titulo}</p>
          <p className="shrink-0 text-[18px] font-[var(--fw-semibold)] tabular-nums text-app">{formatEuros(data.total)}</p>
        </div>
        <p className="mt-[4px] text-[12px] text-muted">
          Pagó {data.pagado_por_nombre} · {data.participantes > 1 ? `a partes iguales entre ${data.participantes} · ${formatEuros(each)} cada uno` : "solo para una persona"}
        </p>
      </div>
      {planId && (
        <div className={footer}>
          <span className="text-muted">En los gastos del plan</span>
          <Link href={`/plans/${planId}?tab=gastos`} className="flex min-h-[44px] items-center font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Ver cuentas</Link>
        </div>
      )}
    </div>
  );
}

// ── Plan cards ────────────────────────────────────────────────────────────────────────────────

const CARD_ICON: Record<CardKind, typeof Plane> = {
  plan: CalendarDays,
  vuelo: Plane,
  barco: Ship,
  tren: Train,
  bus: Bus,
  alojamiento: BedDouble,
  restaurante: UtensilsCrossed,
  actividad: Ticket,
};

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysBetween = (a: string, b: string) => Math.round((startOfDay(new Date(b)) - startOfDay(new Date(a))) / 86_400_000);

function dateRange(a: string, b: string) {
  const s = new Date(a);
  const e = new Date(b);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const month = (d: Date) => d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  return sameMonth ? `${s.getDate()}–${e.getDate()} ${month(e)}` : `${s.getDate()} ${month(s)} – ${e.getDate()} ${month(e)}`;
}

function inDays(iso: string) {
  const d = daysBetween(new Date().toISOString(), iso);
  return d > 1 ? `en ${d} días` : d === 1 ? "mañana" : d === 0 ? "hoy" : null;
}

/**
 * Plan, flight, boat, stay and restaurant share a header (icon + kind) and a footer (where it is in
 * the plan, or a link to open it) — board k-momentos · Tarjetas.
 */
export function PlanItemCard({ data, tripStart, isMe = false }: { data: CardMoment; tripStart?: string | null; isMe?: boolean }) {
  const Icon = CARD_ICON[data.kind] ?? CalendarDays;
  const isTransport = data.kind === "vuelo" || data.kind === "barco" || data.kind === "tren" || data.kind === "bus";
  const dayN = tripStart ? daysBetween(tripStart, data.inicio_at) + 1 : null;
  const where = data.kind === "plan" ? null : dayN && dayN >= 1 ? `En el plan · Día ${dayN}` : `En «${data.plan_titulo}»`;

  return (
    <div className={frame}>
      <div className="p-[14px]">
        <p className={label}><Icon className="size-[14px]" aria-hidden /> {data.kind === "plan" ? "Invitación a un plan" : cardLabel(data.kind)}</p>

        {data.kind === "plan" ? (
          <>
            <p className="mt-[6px] [font-family:var(--font-display-face)] text-[24px] leading-[28px] text-app">{data.titulo}</p>
            <p className="mt-[4px] text-[12px] text-muted">
              {dateRange(data.inicio_at, data.fin_at)} · {daysBetween(data.inicio_at, data.fin_at) + 1} días{inDays(data.inicio_at) ? ` · ${inDays(data.inicio_at)}` : ""}
              {data.lugar ? ` · ${data.lugar}` : ""}
            </p>
          </>
        ) : isTransport ? (
          <>
            <div className="mt-[8px] grid grid-cols-[1fr_auto_1fr] items-end gap-[10px]">
              <div className="min-w-0">
                <p className="[font-family:var(--font-display-face)] text-[26px] leading-[30px] tabular-nums text-app">{hhmm(data.inicio_at)}</p>
                <p className="truncate text-[12px] text-muted">{data.lugar ?? ""}</p>
              </div>
              <p className="pb-[18px] text-center text-[12px] text-muted">{data.duracion ?? ""}</p>
              <div className="min-w-0 text-right">
                <p className="[font-family:var(--font-display-face)] text-[26px] leading-[30px] tabular-nums text-app">{hhmm(data.fin_at)}</p>
                <p className="truncate text-[12px] text-muted">{data.lugar_fin ?? ""}</p>
              </div>
            </div>
            <p className="mt-[6px] text-[12px] text-muted">{dayLabel(data.inicio_at)} · {data.titulo}</p>
          </>
        ) : (
          <>
            <p className="mt-[6px] [font-family:var(--font-display-face)] text-[24px] leading-[28px] text-app">{data.titulo}</p>
            <p className="mt-[4px] text-[12px] text-muted">
              {data.lugar ? `${data.lugar} · ` : ""}
              {data.kind === "alojamiento"
                ? `${dateRange(data.inicio_at, data.fin_at)} · ${Math.max(1, daysBetween(data.inicio_at, data.fin_at))} noches${data.all_day ? "" : ` · entrada ${hhmm(data.inicio_at)}`}`
                : `${dayLabel(data.inicio_at)}${data.all_day ? "" : ` · ${hhmm(data.inicio_at)}`}`}
            </p>
          </>
        )}
      </div>
      <div className={footer}>
        {data.kind === "plan" && data.join_code && !isMe ? (
          <>
            <span className="min-w-0 truncate text-muted">Te invitan a unirte</span>
            {/* The join page shows the plan and, if you are already in, opens it. */}
            <Link href={`/join/${data.join_code}`} className="flex min-h-[44px] shrink-0 items-center font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Ver invitación</Link>
          </>
        ) : (
          <>
            <span className="min-w-0 truncate text-muted">{data.kind === "plan" ? "Invitación enviada" : where ?? `Plan · ${data.plan_titulo}`}</span>
            <Link href={`/plans/${data.plan_id}`} className="flex min-h-[44px] shrink-0 items-center font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Abrir plan</Link>
          </>
        )}
      </div>
    </div>
  );
}

// ── Shared place ──────────────────────────────────────────────────────────────────────────────

/** Opens the point in Google Maps (app on phones, web elsewhere). Coordinates: exact, no lookup. */
export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
