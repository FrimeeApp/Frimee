"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BusFront, CarFront, CarTaxiFront, CircleEllipsis, FerrisWheel, Footprints, Hotel, Maximize2, Plane, Ship, TrainFront, TramFront, UtensilsCrossed, X } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useCallContext } from "@/providers/CallProvider";
import { ChatConversation, PhoneCallIcon, VideoCallIcon } from "@/components/chat/ChatConversation";
import { fetchPlanChatItem, type ChatListItem } from "@/services/api/repositories/chat.repository";
import { resolveChatName, resolveChatAvatar } from "@/services/api/repositories/chat.repository";
import { fetchPlansByIds, fetchPlanMemberIds, fetchPlanUserRol, type PlanByIdRow } from "@/services/api/endpoints/plans.endpoint";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { fetchSubplanes, createSubplan, updateSubplan, updateSubplanTransporte, updateSubplanViaje, type SubplanRow, type TipoSubplan, TIPOS_TRANSPORTE } from "@/services/api/endpoints/subplanes.endpoint";
import { getBalancesForPlanEndpoint, listGastosForPlanEndpoint, type BalanceRow, type GastoRow } from "@/services/api/endpoints/gastos.endpoint";
import DayRouteMap from "@/components/plans/DayRouteMap";
import LocationAutocomplete, { type Coords } from "@/components/plans/LocationAutocomplete";
import AddGastoSheet from "@/components/plans/AddGastoSheet";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";
import { insertNotificacion } from "@/services/api/repositories/notifications.repository";
import { syncPlanWidget } from "@/services/widget/planWidget";
import { QRCodeSVG } from "qrcode.react";
import AppSidebar from "@/components/common/AppSidebar";

type Tab = "itinerario" | "gastos" | "chat";

/* ───────────── icons ───────────── */

function BackIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InviteIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2 20C2.5 16.5 5.5 14 9 14C12.5 14 15.5 16.5 16 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 11V17M16 14H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 12V20C4 20.5523 4.44772 21 5 21H19C19.5523 21 20 20.5523 20 20V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 6L12 2L8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 2V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M16.474 5.408L18.592 7.526M17.836 3.186L12.109 8.913C11.81 9.212 11.601 9.589 11.506 10.002L11 12L12.998 11.494C13.411 11.399 13.788 11.19 14.087 10.891L19.814 5.164C20.395 4.583 20.395 3.767 19.814 3.186C19.233 2.605 18.417 2.605 17.836 3.186Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 15V19C19 20.1046 18.1046 21 17 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapPinIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CalendarSmallIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3V7M16 3V7M3 10H21" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ArrowRightIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 7V17M7 12H17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M10 6H18V14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6L8 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ───────────── skeleton ───────────── */

function PlanDetailSkeleton() {
  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative min-h-dvh w-full">
        <main className="pb-[max(var(--space-6),env(safe-area-inset-bottom))] md:py-0 md:pl-[102px]">
          <div className="md:grid md:grid-cols-[minmax(88px,1fr)_minmax(0,1536px)_minmax(88px,1fr)] xl:grid-cols-[minmax(180px,1fr)_minmax(0,1280px)_minmax(180px,1fr)] 2xl:grid-cols-[minmax(240px,1fr)_minmax(0,1240px)_minmax(240px,1fr)]">
            <div className="md:col-start-2">

          {/* Hero skeleton */}
          <div
            className="relative w-full overflow-hidden md:ml-0 md:rounded-b-[20px] animate-pulse bg-[var(--surface-2)]"
            style={{ height: "clamp(260px, 40vh, 380px)" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            {/* Back button placeholder */}
            <div className="absolute left-[var(--page-margin-x)] top-[calc(env(safe-area-inset-top)+var(--space-4))] md:top-[var(--space-6)] h-9 w-9 rounded-full bg-white/20" />
            {/* Title & meta placeholders */}
            <div className="absolute bottom-0 left-0 right-0 px-[var(--page-margin-x)] pb-[var(--space-6)] space-y-[var(--space-2)]">
              <div className="h-8 w-2/3 rounded-lg bg-white/20" />
              <div className="h-4 w-1/3 rounded-md bg-white/15" />
              <div className="flex gap-[var(--space-4)] pt-[var(--space-1)]">
                <div className="h-4 w-24 rounded-md bg-white/15" />
                <div className="h-4 w-28 rounded-md bg-white/15" />
              </div>
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="border-b border-app px-[var(--page-margin-x)]">
            <div className="flex gap-[var(--space-8)] py-[var(--space-4)]">
              {[80, 56, 64].map((w, i) => (
                <div key={i} className="h-4 rounded-md bg-[var(--surface-2)] animate-pulse" style={{ width: w }} />
              ))}
            </div>
          </div>

          {/* Content skeleton */}
          <div className="px-[var(--page-margin-x)] pt-[var(--space-8)] space-y-[var(--space-6)]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-[var(--space-4)]">
                <div className="h-6 w-6 shrink-0 rounded-full bg-[var(--surface-2)] animate-pulse" />
                <div className="flex-1 space-y-[var(--space-2)]">
                  <div className="h-4 w-1/4 rounded-md bg-[var(--surface-2)] animate-pulse" />
                  <div className="h-4 w-1/2 rounded-md bg-[var(--surface-2)] animate-pulse" />
                  <div className="h-3 w-1/3 rounded-md bg-[var(--surface-2)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>

            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

/* ───────────── page ───────────── */

function formatDateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const sameDay = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();
  if (sameDay) return `${start.getDate()} ${months[start.getMonth()]}`;
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} – ${end.getDate()} ${months[start.getMonth()]}`;
  }
  return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`;
}

/* ───────────── helpers ───────────── */

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function fmtDayHeader(iso: string) {
  const d = new Date(iso);
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function isoDateOnly(iso: string) {
  return iso.slice(0, 10);
}

function groupByDay(subplanes: SubplanRow[]) {
  const map = new Map<string, SubplanRow[]>();
  for (const s of subplanes) {
    const key = isoDateOnly(s.inicio_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

/* ───────────── location autocomplete ───────────── */

/* ───────────── occupied-time helpers ───────────── */


function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return isoDateOnly(new Date(value).toISOString());
}

function formatExpenseDateTime(value: string) {
  const formatted = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
  return formatted.replace(",", " ·");
}

function getInitial(value: string | null | undefined) {
  return (value?.trim()[0] || "U").toUpperCase();
}

function summarizeRecipients(parts: GastoRow["partes"], excludeUserId?: string | null) {
  const filtered = (parts ?? []).filter((part) => part.user_id !== excludeUserId);
  if (!filtered.length) return "Sin reparto";
  if (filtered.length === 1) return filtered[0].nombre ?? "1 persona";
  if (filtered.length === 2) {
    return `${filtered[0].nombre ?? "Persona"} y ${filtered[1].nombre ?? "persona"}`;
  }
  return `${filtered[0].nombre ?? "Persona"} y ${filtered.length - 1} más`;
}

function PlanExpenseAvatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-app">
        <Image src={image} alt={name} fill sizes="44px" className="object-cover" unoptimized referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-app bg-surface-2 text-body-sm font-[var(--fw-semibold)] text-muted">
      {getInitial(name)}
    </div>
  );
}

function formatExpenseDetailDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function PlanGastoDetailModal({
  gasto,
  planName,
  currentUserId,
  onClose,
}: {
  gasto: GastoRow | null;
  planName: string;
  currentUserId: string | null;
  onClose: () => void;
}) {
  if (!gasto) return null;

  const payerName = gasto.pagado_por_nombre ?? "Usuario";
  const categoryLine = gasto.subplan_titulo ?? gasto.categoria_nombre ?? gasto.descripcion?.trim() ?? "Sin detalle";
  const categoryLabel = gasto.subplan_titulo
    ? "Actividad"
    : gasto.categoria_nombre
      ? "Categoría"
      : "Detalle";
  const yourShare = currentUserId
    ? gasto.partes?.find((parte) => parte.user_id === currentUserId)?.importe ?? null
    : null;
  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50 px-[var(--space-4)] py-[var(--space-6)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] rounded-[18px] border border-app bg-app shadow-elev-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-[var(--space-4)] border-b border-app px-[var(--space-5)] py-[var(--space-4)]">
          <div className="min-w-0">
            <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
              {planName}
            </p>
            <h2 className="mt-[6px] truncate text-[var(--font-h3)] font-[var(--fw-bold)] leading-[1.15] text-app">
              {gasto.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface"
            aria-label="Cerrar detalle"
          >
            <X className="size-[18px]" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-[var(--space-5)] px-[var(--space-5)] py-[var(--space-5)]">
          <div className="flex items-start justify-between gap-[var(--space-4)]">
            <div>
              <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                Importe
              </p>
              <p className="mt-[6px] text-[32px] font-[var(--fw-bold)] leading-none text-app">
                {formatMoney(gasto.total, gasto.moneda)}
              </p>
            </div>
            {yourShare != null && (
              <div className="text-right">
                <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                  Tu parte
                </p>
                <p className="mt-[6px] text-body font-[var(--fw-semibold)] text-app">
                  {formatMoney(yourShare, gasto.moneda)}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
            <PlanExpenseDetailItem label="Pagado por" value={payerName} />
            <PlanExpenseDetailItem label="Fecha" value={formatExpenseDetailDate(gasto.fecha_gasto)} />
            <PlanExpenseDetailItem label={categoryLabel} value={categoryLine} />
          </div>

          {gasto.descripcion?.trim() && (
            <div>
              <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                Descripción
              </p>
              <p className="mt-[4px] text-body-sm text-app">{gasto.descripcion.trim()}</p>
            </div>
          )}

          <div>
            <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
              Repartido entre
            </p>
            <div className="mt-[var(--space-3)] divide-y divide-app">
              {(gasto.partes ?? []).map((parte) => {
                const partName = parte.user_id === currentUserId ? "Tú" : (parte.nombre ?? "Usuario");
                return (
                  <div key={`${gasto.id}-${parte.user_id}`} className="flex items-center gap-3 py-[var(--space-3)]">
                    <PlanExpenseAvatar name={partName} image={parte.foto ?? null} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{partName}</p>
                    </div>
                    <p className="shrink-0 text-body-sm font-[var(--fw-semibold)] text-app">
                      {formatMoney(parte.importe, gasto.moneda)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanExpenseDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-[var(--space-2)]">
      <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="mt-[4px] text-body-sm font-[var(--fw-semibold)] text-app">{value}</p>
    </div>
  );
}

type Interval = { from: number; to: number };

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.from - b.from);
  const merged: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].from < last.to) last.to = Math.max(last.to, sorted[i].to);
    else merged.push({ ...sorted[i] });
  }
  return merged;
}

function getOccupiedIntervals(subplanes: SubplanRow[], fecha: string): Interval[] {
  const toLocalHHMM = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };
  const toLocalDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  const daySubplanes = subplanes
    .filter(s => toLocalDate(s.inicio_at) === fecha)
    .sort((a, b) => new Date(a.inicio_at).getTime() - new Date(b.inicio_at).getTime());

  const intervals: Interval[] = daySubplanes.map(s => ({
    from: timeToMin(toLocalHHMM(s.inicio_at)),
    to:   timeToMin(toLocalHHMM(s.fin_at)),
  }));

  return mergeIntervals(intervals);
}

/* ───────────── plan inline calendar ───────────── */

function PlanInlineCalendar({
  minDate, maxDate, startDate, endDate, onChange,
}: {
  minDate: string; maxDate: string;
  startDate: string; endDate: string | null;
  onChange: (start: string, end: string | null) => void;
}) {
  const [phase, setPhase] = useState<"start" | "end">("start");
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const parseYMD = (s: string) => new Date(s + "T12:00:00");

  const handleDayClick = (dateStr: string) => {
    if (dateStr < minDate || dateStr > maxDate) return;
    if (phase === "start") {
      onChange(dateStr, null);
      setPhase("end");
    } else {
      if (dateStr === startDate) { onChange(startDate, null); setPhase("start"); }
      else if (dateStr > startDate) { onChange(startDate, dateStr); setPhase("start"); }
      else { onChange(dateStr, null); setPhase("end"); }
    }
  };

  const hasRange = !!endDate && endDate !== startDate;
  const previewEnd = phase === "end" && hoverDate && hoverDate > startDate ? hoverDate : null;

  const renderMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDow = firstDay.getDay();
    startDow = (startDow + 6) % 7;
    const monthLabel = firstDay.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

    const cells: React.ReactNode[] = Array.from({ length: startDow }, (_, i) => <div key={`pad-${i}`} />);

    for (let i = 0; i < daysInMonth; i++) {
      const day = i + 1;
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateStr = `${year}-${mm}-${dd}`;
      const isOutside = dateStr < minDate || dateStr > maxDate;
      const isStart = dateStr === startDate;
      const isEnd = hasRange && dateStr === endDate;
      const inRange = hasRange && dateStr > startDate && dateStr < endDate!;
      const inPreview = !!previewEnd && dateStr > startDate && dateStr < previewEnd && !hasRange;
      const isPreviewEnd = dateStr === previewEnd && !hasRange;

      cells.push(
        <div
          key={dateStr}
          className="relative flex h-12 items-center justify-center"
          onClick={() => !isOutside && handleDayClick(dateStr)}
          onMouseEnter={() => !isOutside && setHoverDate(dateStr)}
          onMouseLeave={() => setHoverDate(null)}
        >
          {inRange && <div className="absolute inset-y-[4px] inset-x-0 bg-[var(--surface-2)]" />}
          {!inRange && inPreview && <div className="absolute inset-y-[4px] inset-x-0 bg-[var(--surface-2)] opacity-50" />}
          {isStart && (hasRange || !!previewEnd) && (
            <div className={`absolute inset-y-[4px] left-1/2 right-0 bg-[var(--surface-2)] ${!hasRange ? "opacity-50" : ""}`} />
          )}
          {(isEnd || isPreviewEnd) && (
            <div className={`absolute inset-y-[4px] left-0 right-1/2 bg-[var(--surface-2)] ${isPreviewEnd ? "opacity-50" : ""}`} />
          )}
          <div className={[
            "relative z-10 flex size-10 items-center justify-center rounded-full text-[15px] font-[var(--fw-semibold)] select-none transition-colors",
            isStart || isEnd ? "bg-[var(--text-primary)] text-[var(--bg)]" :
            isPreviewEnd ? "bg-[var(--surface-2)] text-app" :
            isOutside ? "cursor-default text-muted opacity-20" :
            "cursor-pointer text-app hover:bg-[var(--surface-2)]",
          ].join(" ")}>
            {day}
          </div>
        </div>
      );
    }

    while (cells.length < 42) cells.push(<div key={`tail-${cells.length}`} />);

    return (
      <div key={`${year}-${month}`}>
        <p className="mb-[var(--space-4)] text-center text-[15px] font-[var(--fw-bold)] capitalize text-app">{monthLabel}</p>
        <div className="mb-[var(--space-1)] grid grid-cols-7 text-center">
          {["L","M","X","J","V","S","D"].map((d) => (
            <span key={d} className="py-1 text-[11px] font-[var(--fw-semibold)] text-muted">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">{cells}</div>
      </div>
    );
  };

  // Build months in plan range
  const startMonthDate = parseYMD(minDate);
  const endMonthDate = parseYMD(maxDate);
  const allMonths: { year: number; month: number }[] = [];
  const cur = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth(), 1);
  const last = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth(), 1);
  while (cur <= last) {
    allMonths.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }

  const totalMonths = allMonths.length;

  return (
    <div>
      {/* Mobile: all months stacked */}
      <div className="space-y-[var(--space-8)] md:hidden">
        {allMonths.map(({ year, month }) => renderMonth(year, month))}
      </div>

      {/* Desktop: 1 month → centered; 2+ → 2-col grid (parent scrolls for overflow) */}
      <div className="hidden md:block">
        {totalMonths === 1 ? (
          <div className="mx-auto max-w-[320px]">
            {allMonths.map(({ year, month }) => renderMonth(year, month))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-[var(--space-8)]">
            {allMonths.map(({ year, month }) => renderMonth(year, month))}
          </div>
        )}
      </div>

      {/* Range hint */}
      <p className="mt-[var(--space-3)] text-center text-caption text-muted">
        {!endDate || endDate === startDate
          ? parseYMD(startDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
          : `${parseYMD(startDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} → ${parseYMD(endDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
        }
        {phase === "end" && (!endDate || endDate === startDate) && (
          <span className="ml-1 opacity-60">— elige fecha de fin o continúa</span>
        )}
      </p>
    </div>
  );
}

/* ───────────── time wheel input ───────────── */

function TimeWheelInput({ value, onChange, minTime, maxTime }: {
  value: string;
  onChange: (v: string) => void;
  minTime?: string;
  maxTime?: string;
}) {
  const [hStr, mStr] = value.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const touchHRef = useRef<{ startY: number; start: number } | null>(null);
  const touchMRef = useRef<{ startY: number; start: number } | null>(null);

  const emit = (hh: number, mm: number) => {
    let total = Math.max(0, Math.min(23 * 60 + 59, hh * 60 + mm));
    if (minTime) { const [a, b] = minTime.split(":").map(Number); total = Math.max((a ?? 0) * 60 + (b ?? 0), total); }
    if (maxTime) { const [a, b] = maxTime.split(":").map(Number); total = Math.min((a ?? 0) * 60 + (b ?? 0), total); }
    onChange(`${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`);
  };

  const inputCls = "w-[46px] bg-transparent text-[28px] font-[var(--fw-bold)] text-app outline-none text-center [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden";

  return (
    <div className="flex items-baseline">
      <input
        type="number" min={0} max={23}
        value={String(h).padStart(2, "0")}
        onChange={(e) => emit(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)), m)}
        onWheel={(e) => { e.preventDefault(); emit(h + (e.deltaY > 0 ? -1 : 1), m); }}
        onTouchStart={(e) => { touchHRef.current = { startY: e.touches[0]!.clientY, start: h }; }}
        onTouchMove={(e) => {
          if (!touchHRef.current) return;
          e.preventDefault();
          const delta = Math.round((touchHRef.current.startY - e.touches[0]!.clientY) / 20);
          emit(touchHRef.current.start + delta, m);
        }}
        onTouchEnd={() => { touchHRef.current = null; }}
        className={inputCls}
      />
      <span className="text-[28px] font-[var(--fw-bold)] text-app select-none">:</span>
      <input
        type="number" min={0} max={59}
        value={String(m).padStart(2, "0")}
        onChange={(e) => emit(h, Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
        onWheel={(e) => { e.preventDefault(); emit(h, m + (e.deltaY > 0 ? -1 : 1)); }}
        onTouchStart={(e) => { touchMRef.current = { startY: e.touches[0]!.clientY, start: m }; }}
        onTouchMove={(e) => {
          if (!touchMRef.current) return;
          e.preventDefault();
          const delta = Math.round((touchMRef.current.startY - e.touches[0]!.clientY) / 8);
          emit(h, touchMRef.current.start + delta);
        }}
        onTouchEnd={() => { touchMRef.current = null; }}
        className={inputCls}
      />
    </div>
  );
}

/* ───────────── add sheet ───────────── */

const TRANSPORT_LLEGADA = [
  { value: "APIE", Icon: Footprints, label: "A pie", googleMode: "walking" },
  { value: "COCHE", Icon: CarFront, label: "Coche", googleMode: "driving" },
  { value: "TAXI", Icon: CarTaxiFront, label: "Taxi", googleMode: "driving" },
  { value: "BUS", Icon: BusFront, label: "Bus", googleMode: "transit" },
  { value: "METRO", Icon: TramFront, label: "Metro", googleMode: "transit" },
  { value: "TREN", Icon: TrainFront, label: "Tren", googleMode: "transit" },
] as const satisfies ReadonlyArray<{
  value: string;
  Icon: LucideIcon;
  label: string;
  googleMode: "walking" | "driving" | "transit";
}>;

const TRANSPORT_MAP = Object.fromEntries(TRANSPORT_LLEGADA.map((t) => [t.value, t]));

const ACTIVITY_TYPE_OPTIONS = [
  { value: "ACTIVIDAD", label: "Actividad", Icon: FerrisWheel },
  { value: "VUELO", label: "Vuelo", Icon: Plane },
  { value: "BARCO", label: "Barco", Icon: Ship },
  { value: "HOTEL", label: "Hotel", Icon: Hotel },
  { value: "RESTAURANTE", label: "Restaurante", Icon: UtensilsCrossed },
  { value: "OTRO", label: "Otro", Icon: CircleEllipsis },
] as const satisfies ReadonlyArray<{
  value: TipoSubplan;
  label: string;
  Icon: LucideIcon;
}>;

type AddSheetProps = {
  planId: number;
  planStartDate: string;
  planEndDate: string;
  subplanes: SubplanRow[];
  onClose: () => void;
  onSaved: (saved: SubplanRow, original?: SubplanRow | null) => void;
  initialTitulo?: string;
  initialDate?: string;
  initialSubplan?: SubplanRow | null;
};

function AddSubplanSheet({ planId, planStartDate, planEndDate, subplanes, onClose, onSaved, initialTitulo, initialDate, initialSubplan }: AddSheetProps) {
  const TOTAL_STEPS = 3;
  const STEP_META = [
    { title: "¿Qué hacéis?", subtitle: "Tipo y lugar de la actividad" },
    { title: "¿Cuándo?", subtitle: "Fecha y horario" },
    { title: initialSubplan ? "Editar actividad" : "¿Cómo se llama?", subtitle: "Dale un nombre a la actividad" },
  ];

  // Use local date to avoid UTC-offset shifting the allowed range by one day
  const toLocalDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const toLocalTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };
  const minDate = toLocalDate(planStartDate);
  const maxDate = toLocalDate(planEndDate);
  const planStartTime = toLocalTime(planStartDate);
  const planEndTime   = toLocalTime(planEndDate);
  const planIsAllDay  = planStartTime === "00:00" && planEndTime === "23:59";
  const isEditing = Boolean(initialSubplan);

  const initialStartDate = initialSubplan ? toLocalDate(initialSubplan.inicio_at) : null;
  const initialEndDate = initialSubplan ? toLocalDate(initialSubplan.fin_at) : null;
  const defaultDate = initialStartDate && initialStartDate >= minDate && initialStartDate <= maxDate
    ? initialStartDate
    : initialDate && initialDate >= minDate && initialDate <= maxDate
      ? initialDate
      : minDate;
  // Default hours clamped to plan bounds (only matters when plan has specific hours)
  const defaultHoraInicio = initialSubplan ? toLocalTime(initialSubplan.inicio_at) : (planIsAllDay ? "10:00" : planStartTime);
  const defaultHoraFin    = initialSubplan ? toLocalTime(initialSubplan.fin_at) : (planIsAllDay ? "11:00" : planEndTime);

  const [titulo, setTitulo] = useState(initialSubplan?.titulo ?? initialTitulo ?? "");
  const [descripcion, setDescripcion] = useState(initialSubplan?.descripcion ?? "");
  const [fecha, setFecha] = useState(defaultDate);
  const [fechaFin, setFechaFin] = useState<string | null>(initialEndDate && initialEndDate !== defaultDate ? initialEndDate : null); // null = mismo día que fecha
  const [horaInicio, setHoraInicio] = useState(defaultHoraInicio);
  const [horaFin, setHoraFin] = useState(defaultHoraFin);
  const allDay = false;
  const [tipo, setTipo] = useState<TipoSubplan>(initialSubplan?.tipo ?? "ACTIVIDAD");
  const [ubicacion, setUbicacion] = useState(initialSubplan?.ubicacion_nombre ?? "");
  const [ubicacionCoords, setUbicacionCoords] = useState<Coords | null>(
    initialSubplan?.ubicacion_lat != null && initialSubplan?.ubicacion_lng != null
      ? { lat: initialSubplan.ubicacion_lat, lng: initialSubplan.ubicacion_lng }
      : null
  );
  const [ubicacionFin, setUbicacionFin] = useState(initialSubplan?.ubicacion_fin_nombre ?? "");
  const [ubicacionFinCoords, setUbicacionFinCoords] = useState<Coords | null>(
    initialSubplan?.ubicacion_fin_lat != null && initialSubplan?.ubicacion_fin_lng != null
      ? { lat: initialSubplan.ubicacion_fin_lat, lng: initialSubplan.ubicacion_fin_lng }
      : null
  );
  const [transporteLlegada, setTransporteLlegada] = useState<string | null>(initialSubplan?.transporte_llegada ?? null);
  const [saving, setSaving] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  const planMonthCount = useMemo(() => {
    const s = new Date(minDate + "T12:00:00");
    const e = new Date(maxDate + "T12:00:00");
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  }, [minDate, maxDate]);

  // ¿Ya hay actividades ese día? → mostrar selector de transporte
  const hayActividadEseDia = subplanes.some((s) => s.id !== initialSubplan?.id && isoDateOnly(s.inicio_at) === fecha);
  const esTransporte = TIPOS_TRANSPORTE.includes(tipo);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Clamp hours when date or hours change to ensure they stay within plan bounds
  const clampedHoraInicio = (() => {
    if (planIsAllDay) return horaInicio;
    if (fecha === minDate && horaInicio < planStartTime) return planStartTime;
    if (fecha === maxDate && horaInicio > planEndTime)   return planEndTime;
    return horaInicio;
  })();

  const efectivaFechaFin = fechaFin ?? fecha;
  const clampedHoraFin = (() => {
    if (planIsAllDay) return horaFin;
    if (efectivaFechaFin === maxDate && horaFin > planEndTime) return planEndTime;
    // Only enforce fin > inicio when on the same day
    if (efectivaFechaFin === fecha && horaFin <= clampedHoraInicio) {
      const [h, m] = clampedHoraInicio.split(":").map(Number);
      const totalMin = h * 60 + m + 60;
      const maxTotal = planIsAllDay ? 23 * 60 + 59 : (Number(planEndTime.split(":")[0]) * 60 + Number(planEndTime.split(":")[1]));
      const clamped = Math.min(totalMin, maxTotal);
      return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
    }
    return horaFin;
  })();

  // Occupied intervals for the selected day (existing subplans + travel time)
  const occupiedIntervals = fecha ? getOccupiedIntervals(subplanes.filter((s) => s.id !== initialSubplan?.id), fecha) : [];

  const canSubmit = titulo.trim().length > 0 && fecha.length > 0 && fecha >= minDate && fecha <= maxDate && !saving;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;

    // Validate dates are within plan range
    if (fecha < minDate || fecha > maxDate) {
      setError(`La actividad debe estar entre el ${minDate} y el ${maxDate}.`);
      return;
    }
    if (efectivaFechaFin > maxDate) {
      setError(`La fecha de fin debe estar dentro del rango del plan.`);
      return;
    }

    // Validate no overlap with existing subplans + travel time
    if (!allDay && occupiedIntervals.length > 0) {
      const newFrom = timeToMin(clampedHoraInicio);
      const newTo   = timeToMin(clampedHoraFin);
      const overlaps = occupiedIntervals.some(b => newFrom < b.to && newTo > b.from);
      if (overlaps) {
        setError("Este horario se solapa con una actividad existente o su tiempo de viaje.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const inicioAt = `${fecha}T${clampedHoraInicio}:00`;
      const finAt    = `${efectivaFechaFin}T${clampedHoraFin}:00`;
      const normalizedSubplan = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        inicio_at: new Date(inicioAt).toISOString(),
        fin_at: new Date(finAt).toISOString(),
        all_day: allDay,
        tipo,
        ubicacion_nombre: ubicacion.trim(),
        ubicacion_fin_nombre: esTransporte ? ubicacionFin.trim() : null,
        ubicacion_lat: ubicacionCoords?.lat ?? null,
        ubicacion_lng: ubicacionCoords?.lng ?? null,
        ubicacion_fin_lat: esTransporte ? (ubicacionFinCoords?.lat ?? null) : null,
        ubicacion_fin_lng: esTransporte ? (ubicacionFinCoords?.lng ?? null) : null,
        transporte_llegada: hayActividadEseDia ? transporteLlegada : null,
      };

      if (initialSubplan) {
        await updateSubplan({
          subplanId: initialSubplan.id,
          titulo: normalizedSubplan.titulo,
          descripcion: normalizedSubplan.descripcion,
          inicioAt: normalizedSubplan.inicio_at,
          finAt: normalizedSubplan.fin_at,
          allDay,
          tipo,
          ubicacionNombre: normalizedSubplan.ubicacion_nombre,
          ubicacionFinNombre: normalizedSubplan.ubicacion_fin_nombre,
          ubicacionLat: normalizedSubplan.ubicacion_lat,
          ubicacionLng: normalizedSubplan.ubicacion_lng,
          ubicacionFinLat: normalizedSubplan.ubicacion_fin_lat,
          ubicacionFinLng: normalizedSubplan.ubicacion_fin_lng,
          transporteLlegada: normalizedSubplan.transporte_llegada,
        });

        onSaved({
          ...initialSubplan,
          ...normalizedSubplan,
          ruta_polyline: null,
          duracion_viaje: null,
          distancia_viaje: null,
        }, initialSubplan);
      } else {
        const newId = await createSubplan({
          planId,
          titulo: normalizedSubplan.titulo,
          descripcion: normalizedSubplan.descripcion,
          inicioAt: normalizedSubplan.inicio_at,
          finAt: normalizedSubplan.fin_at,
          allDay,
          tipo,
          ubicacionNombre: normalizedSubplan.ubicacion_nombre,
          ubicacionFinNombre: normalizedSubplan.ubicacion_fin_nombre,
          ubicacionLat: normalizedSubplan.ubicacion_lat,
          ubicacionLng: normalizedSubplan.ubicacion_lng,
          ubicacionFinLat: normalizedSubplan.ubicacion_fin_lat,
          ubicacionFinLng: normalizedSubplan.ubicacion_fin_lng,
          transporteLlegada: normalizedSubplan.transporte_llegada,
        });
        onSaved({
          id: newId, plan_id: planId, parent_subplan_id: null,
          ...normalizedSubplan,
          ubicacion_direccion: null,
          ubicacion_fin_direccion: null,
          duracion_viaje: null, distancia_viaje: null, ruta_polyline: null,
          orden: 0, estado: "ACTIVO",
          creado_por_user_id: "", created_at: new Date().toISOString(),
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error al ${isEditing ? "guardar" : "crear"} la actividad`);
    } finally {
      setSaving(false);
    }
  };

  const canContinueWizard = wizardStep === 3 ? titulo.trim().length > 0 : true;
  const isLastStep = wizardStep === TOTAL_STEPS;
  const meta = STEP_META[wizardStep - 1];

  const handleAdvance = () => {
    if (!canContinueWizard || saving) return;
    if (isLastStep) { void handleSubmit(); }
    else { setWizardStep((s) => s + 1); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const tag = (e.target as HTMLElement).tagName;
      // Let textarea handle Enter naturally; text inputs in step 3 handled separately
      if (tag === "TEXTAREA") return;
      e.preventDefault();
      handleAdvance();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canContinueWizard, saving, isLastStep, wizardStep, titulo]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" onClick={onClose}>
        <div
          ref={sheetRef}
          className={`flex h-dvh w-full flex-col overflow-hidden bg-[var(--bg)] transition-[max-width] duration-[400ms] [transition-timing-function:var(--ease-standard)] md:h-auto md:max-h-[90dvh] md:rounded-[24px] md:shadow-elev-4 ${
            wizardStep === 2
              ? planMonthCount === 1 ? "md:max-w-[420px]" : "md:max-w-[760px]"
              : "md:max-w-[520px]"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          <div className="h-[3px] w-full shrink-0 bg-[var(--surface-2)]">
            <div
              className="h-full bg-primary-token transition-all duration-[400ms] [transition-timing-function:var(--ease-standard)]"
              style={{ width: `${(wizardStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          {/* Top nav */}
          <div className="flex shrink-0 items-center justify-between px-[var(--space-5)] py-[var(--space-3)]">
            <button
              type="button"
              onClick={wizardStep === 1 ? onClose : () => setWizardStep((s) => s - 1)}
              className="flex size-9 items-center justify-center rounded-full text-app transition-colors hover:bg-surface"
            >
              {wizardStep === 1 ? (
                <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
                  <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span className="text-caption font-[var(--fw-medium)] text-muted">{wizardStep} de {TOTAL_STEPS}</span>
            <div className="size-9" aria-hidden="true" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-[var(--space-6)] pb-[var(--space-8)] pt-[var(--space-2)]">
            <div className="mb-[var(--space-6)]">
              <h2 className="font-[var(--fw-bold)] leading-tight text-app" style={{ fontSize: "clamp(22px, 5vw, 28px)" }}>
                {meta.title}
              </h2>
              <p className="mt-[var(--space-1)] text-body-sm text-muted">{meta.subtitle}</p>
            </div>

            {/* ── Step 1: Tipo + Ubicación ── */}
            {wizardStep === 1 && (
              <div className="space-y-[var(--space-6)]">
                {/* Activity type grid */}
                <div className="grid grid-cols-3 gap-[var(--space-2)] sm:gap-[var(--space-3)]">
                  {ACTIVITY_TYPE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTipo(t.value)}
                      className={`flex flex-col items-start gap-[var(--space-2)] rounded-[14px] border-2 px-[var(--space-3)] py-[var(--space-3)] text-left transition-colors sm:rounded-[16px] sm:p-[var(--space-4)] ${
                        tipo === t.value
                          ? "border-[var(--primary)]/40 bg-[var(--primary)]/10"
                          : "border-app bg-app hover:bg-surface"
                      }`}
                    >
                      <t.Icon className={`size-5 shrink-0 ${tipo === t.value ? "text-primary-token" : "text-muted"}`} strokeWidth={1.5} />
                      <span className="text-[13px] leading-[1.15] font-[var(--fw-semibold)] text-app sm:text-body-sm">{t.label}</span>
                    </button>
                  ))}
                </div>

                {/* Ubicación */}
                <div>
                  <p className="mb-[var(--space-2)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                    {esTransporte ? "Origen" : "Ubicación"} <span className="normal-case font-[var(--fw-normal)]">(opcional)</span>
                  </p>
                  <div className="group flex items-center gap-[var(--space-3)] border-b-2 border-app pb-[var(--space-2)] transition-colors focus-within:border-primary-token">
                    <MapPinIcon className="size-[16px] shrink-0 text-muted transition-colors group-focus-within:text-primary-token" />
                    <LocationAutocomplete
                      value={ubicacion}
                      onChange={(v, coords) => { setUbicacion(v); if (coords) setUbicacionCoords(coords); else setUbicacionCoords(null); }}
                      dropdownVariant="surface"
                      placeholder={
                        tipo === "VUELO" ? "Aeropuerto de salida" :
                        tipo === "BARCO" ? "Puerto de salida" :
                        tipo === "HOTEL" ? "Nombre del hotel" :
                        tipo === "RESTAURANTE" ? "Nombre del restaurante" :
                        "¿Dónde será?"
                      }
                    />
                  </div>
                </div>

                {/* Destino (transport only) */}
                {esTransporte && (
                  <div>
                    <p className="mb-[var(--space-2)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Destino</p>
                    <div className="group flex items-center gap-[var(--space-3)] border-b-2 border-app pb-[var(--space-2)] transition-colors focus-within:border-primary-token">
                      <MapPinIcon className="size-[16px] shrink-0 text-primary-token" />
                      <LocationAutocomplete
                        value={ubicacionFin}
                        onChange={(v, coords) => { setUbicacionFin(v); if (coords) setUbicacionFinCoords(coords); else setUbicacionFinCoords(null); }}
                        dropdownVariant="surface"
                        placeholder={tipo === "VUELO" ? "Aeropuerto de llegada" : "Puerto de llegada"}
                      />
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── Step 2: Cuándo (calendar + hours) ── */}
            {wizardStep === 2 && (
              <div className="space-y-[var(--space-6)]">
                <PlanInlineCalendar
                  key={`${minDate}-${maxDate}`}
                  minDate={minDate}
                  maxDate={maxDate}
                  startDate={fecha}
                  endDate={fechaFin}
                  onChange={(start, end) => { setFecha(start); setFechaFin(end); }}
                />
                {/* Time pickers */}
                <div className="grid grid-cols-2 gap-[var(--space-5)]">
                  <div>
                    <p className="mb-[var(--space-2)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Hora inicio</p>
                    <div className="border-b-2 border-app pb-[var(--space-1)] transition-colors focus-within:border-primary-token">
                      <TimeWheelInput
                        value={horaInicio}
                        onChange={setHoraInicio}
                        minTime={fecha === minDate && !planIsAllDay ? planStartTime : undefined}
                        maxTime={fecha === maxDate && !planIsAllDay ? planEndTime : undefined}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-[var(--space-2)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Hora fin</p>
                    <div className="border-b-2 border-app pb-[var(--space-1)] transition-colors focus-within:border-primary-token">
                      <TimeWheelInput
                        value={horaFin}
                        onChange={setHoraFin}
                        minTime={efectivaFechaFin === fecha ? horaInicio : undefined}
                        maxTime={efectivaFechaFin === maxDate && !planIsAllDay ? planEndTime : undefined}
                      />
                    </div>
                  </div>
                </div>
                {error && wizardStep === 2 && <p className="text-body-sm text-[var(--error)]">{error}</p>}
              </div>
            )}

            {/* ── Step 3: Nombre ── */}
            {wizardStep === 3 && (
              <div className="space-y-[var(--space-5)]">
                <div className="border-b-2 border-app pb-[var(--space-2)] transition-colors focus-within:border-primary-token">
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder={
                      tipo === "VUELO" ? "Vuelo a París" :
                      tipo === "HOTEL" ? "Hotel Marina Bay" :
                      tipo === "RESTAURANTE" ? "Cena en La Trattoria" :
                      tipo === "BARCO" ? "Ferry a Ibiza" :
                      "Tarde en el museo"
                    }
                    autoFocus
                    className="w-full bg-transparent text-[22px] font-[var(--fw-semibold)] text-app outline-none placeholder:text-muted"
                  />
                </div>
                <div className="border-b border-app pb-[var(--space-1)] transition-colors focus-within:border-[var(--border-strong)]">
                  <input
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Descripción breve (opcional)"
                    className="w-full bg-transparent text-body-sm text-app outline-none placeholder:text-muted"
                  />
                </div>

                {/* ¿Cómo llegas? */}
                {hayActividadEseDia && (
                  <div>
                    <p className="mb-[var(--space-3)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">¿Cómo llegas?</p>
                    <div className="grid grid-cols-3 gap-[var(--space-2)]">
                      {TRANSPORT_LLEGADA.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setTransporteLlegada(transporteLlegada === t.value ? null : t.value)}
                          className={`flex flex-col items-center gap-[var(--space-1)] rounded-[14px] border-2 py-[var(--space-3)] transition-colors ${
                            transporteLlegada === t.value
                              ? "border-[var(--primary)]/40 bg-[var(--primary)]/10"
                              : "border-app bg-app hover:bg-surface"
                          }`}
                        >
                          <t.Icon className={`size-[18px] shrink-0 ${transporteLlegada === t.value ? "text-primary-token" : "text-muted"}`} strokeWidth={1.5} />
                          <span className={`text-[11px] font-[var(--fw-semibold)] ${transporteLlegada === t.value ? "text-primary-token" : "text-app"}`}>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && isLastStep && <p className="text-body-sm text-[var(--error)]">{error}</p>}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-app px-[var(--space-5)] py-[var(--space-4)]">
            <div className="flex items-center justify-between">
              {wizardStep === 2 ? (
                <button
                  type="button"
                  onClick={() => { setFecha(defaultDate); setFechaFin(null); setHoraInicio(defaultHoraInicio); setHoraFin(defaultHoraFin); }}
                  className="text-body-sm font-[var(--fw-semibold)] text-app underline underline-offset-2 transition-opacity hover:opacity-60"
                >
                  Restablecer
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                disabled={!canContinueWizard || (isLastStep && saving)}
                onClick={handleAdvance}
                className="rounded-[14px] bg-[var(--text-primary)] px-[var(--space-8)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-85 disabled:opacity-[var(--disabled-opacity)]"
              >
                {isLastStep ? (saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear actividad") : wizardStep === 2 ? "Siguiente" : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────────── page ───────────── */

export default function PlanDetailPage() {
  const { loading, user } = useAuth();
  const { startCall, joinCall, callState } = useCallContext();
  const reloadCallMessagesRef = useRef<(() => void) | null>(null);
  const router = useRouter();
  const { id: paramId } = useParams<{ id: string }>();
  // In Capacitor static export we navigate to /plans/static?id=18.
  // Read the real id from query params and store it in state so effects re-run.
  const [id, setId] = useState<string>(paramId);
  useEffect(() => {
    if (paramId === "static") {
      const queryId = new URLSearchParams(window.location.search).get("id");
      setId(queryId ?? paramId);
    } else {
      setId(paramId);
    }
  }, [paramId]);
  const [activeTab, setActiveTab] = useState<Tab>("itinerario");
  const [plan, setPlan] = useState<PlanByIdRow | null>(null);
  const isPast = plan ? new Date(plan.fin_at) < new Date() : false;
  const [isAdmin, setIsAdmin] = useState(false);
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [planChat, setPlanChat] = useState<ChatListItem | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [subplanes, setSubplanes] = useState<SubplanRow[]>([]);
  const [selectedMapDay, setSelectedMapDay] = useState<string | null>(null);
  const [showMapFullscreen, setShowMapFullscreen] = useState(false);
  const [routeSectionVisible, setRouteSectionVisible] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addSheetInitialTitulo, setAddSheetInitialTitulo] = useState<string | undefined>();
  const [addSheetInitialDate, setAddSheetInitialDate] = useState<string | undefined>();
  const [editingSubplan, setEditingSubplan] = useState<SubplanRow | null>(null);
  const [showAddGastoSheet, setShowAddGastoSheet] = useState(false);
  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [selectedGastoId, setSelectedGastoId] = useState<number | null>(null);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [editingTransporteId, setEditingTransporteId] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFriends, setInviteFriends] = useState<PublicUserProfileRow[]>([]);
  const [inviteFriendsLoading, setInviteFriendsLoading] = useState(false);
  const [inviteSentIds, setInviteSentIds] = useState<Set<string>>(new Set());
  const [inviteSendingIds, setInviteSendingIds] = useState<Set<string>>(new Set());
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const routeSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void syncPlanWidget(user.id);
  }, [user?.id, plan?.id]);

  const expenseSummary = useMemo(() => {
    const confirmedExpenses = gastos.filter((gasto) => gasto.estado === "CONFIRMADO");
    const currency = confirmedExpenses[0]?.moneda ?? "EUR";
    const total = confirmedExpenses.reduce((sum, gasto) => sum + gasto.total, 0);
    const paidByYou = user?.id
      ? confirmedExpenses
          .filter((gasto) => gasto.pagado_por_user_id === user.id)
          .reduce((sum, gasto) => sum + gasto.total, 0)
      : 0;
    const yourShare = user?.id
      ? confirmedExpenses.reduce((sum, gasto) => {
          const part = gasto.partes?.find((parte) => parte.user_id === user.id)?.importe ?? 0;
          return sum + part;
        }, 0)
      : 0;
    const net = paidByYou - yourShare;

    const participantIds = new Set<string>();
    confirmedExpenses.forEach((gasto) => {
      participantIds.add(gasto.pagado_por_user_id);
      gasto.partes?.forEach((parte) => participantIds.add(parte.user_id));
    });

    const categoriesMap = new Map<
      string,
      { label: string; amount: number; count: number; icon: string | null }
    >();

    confirmedExpenses.forEach((gasto) => {
      const key = gasto.categoria_nombre ?? gasto.subplan_titulo ?? "Otros";
      const prev = categoriesMap.get(key);
      categoriesMap.set(key, {
        label: key,
        amount: (prev?.amount ?? 0) + gasto.total,
        count: (prev?.count ?? 0) + 1,
        icon: prev?.icon ?? gasto.categoria_icono ?? null,
      });
    });

    const topCategories = [...categoriesMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return {
      hasExpenses: confirmedExpenses.length > 0,
      currency,
      total,
      count: confirmedExpenses.length,
      paidByYou,
      yourShare,
      net,
      participantCount: participantIds.size,
      topCategories,
    };
  }, [gastos, user?.id]);

  const dayExpenseTotals = useMemo(() => {
    const totals = new Map<string, { total: number; currency: string }>();
    gastos
      .filter((gasto) => gasto.estado === "CONFIRMADO")
      .forEach((gasto) => {
        const key = normalizeDateKey(gasto.fecha_gasto);
        const prev = totals.get(key);
        totals.set(key, {
          total: (prev?.total ?? 0) + gasto.total,
          currency: prev?.currency ?? gasto.moneda,
        });
      });
    return totals;
  }, [gastos]);

  const routeDayGroups = useMemo(() => groupByDay(subplanes), [subplanes]);
  const activeRouteDay = selectedMapDay ?? routeDayGroups[0]?.[0] ?? isoDateOnly(plan?.inicio_at ?? "");
  const routeDayItems = useMemo(
    () =>
      subplanes
        .filter((s) => isoDateOnly(s.inicio_at) === activeRouteDay && s.ubicacion_nombre)
        .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at)),
    [activeRouteDay, subplanes],
  );
  const routeStops = useMemo(() => {
    const stops: string[] = [];
    routeDayItems.forEach((s) => {
      if (s.ubicacion_nombre) stops.push(s.ubicacion_nombre);
      if (TIPOS_TRANSPORTE.includes(s.tipo) && s.ubicacion_fin_nombre) stops.push(s.ubicacion_fin_nombre);
    });
    return stops;
  }, [routeDayItems]);
  const routeHasRoute = routeStops.length >= 2;
  const routeShouldShowMap = !(isPast && !routeHasRoute && !plan?.ubicacion_nombre);
  const routeMapsUrl = useMemo(() => {
    if (!routeHasRoute) return null;
    const origin = encodeURIComponent(routeStops[0]);
    const destination = encodeURIComponent(routeStops[routeStops.length - 1]);
    const waypoints = routeStops.slice(1, -1).map(encodeURIComponent).join("|");
    const modes = routeDayItems
      .slice(1)
      .map((s) => TRANSPORT_MAP[s.transporte_llegada ?? ""]?.googleMode ?? "driving");
    const travelmode =
      modes.sort((a, b) => modes.filter((m) => m === b).length - modes.filter((m) => m === a).length)[0] ?? "driving";
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=${travelmode}`;
  }, [routeDayItems, routeHasRoute, routeStops]);
  const routeWazeUrl = useMemo(() => {
    if (!routeHasRoute) return null;
    return `https://waze.com/ul?q=${encodeURIComponent(routeStops[routeStops.length - 1])}&navigate=yes`;
  }, [routeHasRoute, routeStops]);

  useEffect(() => {
    if (activeTab !== "itinerario") {
      setRouteSectionVisible(false);
      return;
    }

    const target = routeSectionRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setRouteSectionVisible(entry.isIntersecting);
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, subplanes.length]);

  useEffect(() => {
    if (!showMapFullscreen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [showMapFullscreen]);

  const visibleBalances = useMemo(() => {
    return [...balances].sort((a, b) => b.importe - a.importe);
  }, [balances]);

  const visiblePlanGastos = useMemo(() => {
    return [...gastos].sort((a, b) => {
      const dateDiff = new Date(b.fecha_gasto).getTime() - new Date(a.fecha_gasto).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [gastos]);

  const selectedGasto = useMemo(
    () => gastos.find((gasto) => gasto.id === selectedGastoId) ?? null,
    [gastos, selectedGastoId],
  );

  const openInviteModal = async () => {
    setShowInviteModal(true);
    setInviteSentIds(new Set());
    setInviteSendingIds(new Set());
    setInviteLinkCopied(false);
    setShowQr(false);
    setInviteFriendsLoading(true);
    try {
      const [friends, memberIds] = await Promise.all([
        fetchActiveFriends(),
        fetchPlanMemberIds(Number(id)),
      ]);
      const memberSet = new Set(memberIds);
      setInviteFriends(friends.filter((f) => !memberSet.has(f.id)));
    } catch (e) {
      console.error(e);
    } finally {
      setInviteFriendsLoading(false);
    }
  };

  const handleInviteFriend = async (friendId: string) => {
    if (!user?.id) return;
    setInviteSendingIds((prev) => new Set(prev).add(friendId));
    try {
      await insertNotificacion({
        userId: friendId,
        tipo: "plan_invite",
        actorId: user.id,
        entityId: String(Number(id)),
        entityType: "plan",
      });
      setInviteSentIds((prev) => new Set(prev).add(friendId));
    } catch (e) {
      console.error(e);
    } finally {
      setInviteSendingIds((prev) => { const n = new Set(prev); n.delete(friendId); return n; });
    }
  };

  const inviteLink = plan?.join_code ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${plan.join_code}` : null;

  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
    });
  };

  const handleSubplanCreated = (s: SubplanRow) => {
    setSubplanes((prev) => {
      const sorted = [...prev, s].sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      const newIdx = sorted.findIndex(x => x.id === s.id);
      const next = sorted[newIdx + 1];
      // The subplan immediately after (same day) has a stale polyline — its origin changed.
      if (next && isoDateOnly(next.inicio_at) === isoDateOnly(s.inicio_at) && next.ruta_polyline) {
        // Clear in DB (fire-and-forget, outside render cycle)
        void updateSubplanViaje(next.id, "", "", "");
        return sorted.map(x =>
          x.id === next.id ? { ...x, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null } : x
        );
      }
      return sorted;
    });
  };

  const clearRouteCache = (subplanIds: number[]) => {
    [...new Set(subplanIds)].forEach((subplanId) => {
      if (!subplanId) return;
      void updateSubplanViaje(subplanId, "", "", "").catch(() => {});
    });
  };

  const handleSubplanSaved = (saved: SubplanRow, original?: SubplanRow | null) => {
    if (!original) {
      handleSubplanCreated(saved);
      return;
    }

    setSubplanes((prev) => {
      const oldDateKey = isoDateOnly(original.inicio_at);
      const oldDayItems = prev
        .filter((item) => isoDateOnly(item.inicio_at) === oldDateKey)
        .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      const oldIndex = oldDayItems.findIndex((item) => item.id === original.id);
      const oldSuccessor = oldIndex >= 0 ? oldDayItems[oldIndex + 1] : undefined;

      const updated = prev.map((item) => item.id === saved.id ? saved : item);
      const sorted = [...updated].sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      const newDateKey = isoDateOnly(saved.inicio_at);
      const newDayItems = sorted
        .filter((item) => isoDateOnly(item.inicio_at) === newDateKey)
        .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      const newIndex = newDayItems.findIndex((item) => item.id === saved.id);
      const newSuccessor = newIndex >= 0 ? newDayItems[newIndex + 1] : undefined;
      const affectedIds = [saved.id, oldSuccessor?.id ?? 0, newSuccessor?.id ?? 0];

      clearRouteCache(affectedIds);

      return sorted.map((item) =>
        affectedIds.includes(item.id)
          ? { ...item, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null }
          : item
      );
    });
  };

  const toggleCollapsedDay = (dateKey: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  // Auto-select today if within plan range, else first day with subplanes
  useEffect(() => {
    const days = groupByDay(subplanes);
    if (days.length === 0) return;
    const todayKey = isoDateOnly(new Date().toISOString());
    const todayExists = days.some(([k]) => k === todayKey);
    setSelectedMapDay((prev) => {
      // Keep manual selection if already set and still valid
      if (prev && days.some(([k]) => k === prev)) return prev;
      return todayExists ? todayKey : days[0][0];
    });
  }, [subplanes]);

  const handleViajeComputed = (subplanId: number, duracion: string, distancia: string, polyline: string) => {
    setSubplanes((prev) => prev.map((s) =>
      s.id === subplanId ? { ...s, duracion_viaje: duracion, distancia_viaje: distancia, ruta_polyline: polyline } : s
    ));
    updateSubplanViaje(subplanId, duracion, distancia, polyline).catch(() => {});
  };

  const handleTransporteChange = async (subplanId: number, transporte: string | null) => {
    // Clear cached route so DayRouteMap recalculates with the new travel mode
    setSubplanes((prev) => prev.map((s) =>
      s.id === subplanId
        ? { ...s, transporte_llegada: transporte, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null }
        : s
    ));
    setEditingTransporteId(null);
    try { await updateSubplanTransporte(subplanId, transporte); }
    catch { setSubplanes((prev) => prev.map((s) => s.id === subplanId ? { ...s, transporte_llegada: null } : s)); }
  };

  useEffect(() => {
    if (id === "static") return; // still resolving real id from query params
    const planId = Number(id);
    if (!planId) { setPlanLoading(false); return; }
    setPlanLoading(true);
    fetchPlansByIds({ planIds: [planId] })
      .then((rows) => setPlan(rows[0] ?? null))
      .catch(console.error)
      .finally(() => setPlanLoading(false));
  }, [id]);

  useEffect(() => {
    const planId = Number(id);
    if (!planId) return;
    fetchSubplanes(planId).then(setSubplanes).catch(console.error);

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`subplan-changes-${planId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subplan", filter: `plan_id=eq.${planId}` }, () => {
        fetchSubplanes(planId).then(setSubplanes).catch(console.error);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    const planId = Number(id);
    if (!planId || !user?.id) return;
    fetchPlanUserRol(planId, user.id).then((rol) => {
      if (rol === null) { router.push("/calendar"); return; }
      setIsAdmin(rol === "ADMIN");
      setMembershipChecked(true);
    }).catch(() => router.push("/calendar"));

  }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recargar lista de miembros cuando alguien entra o sale del chat del plan
  useEffect(() => {
    if (!planChat?.chat_id || !user?.id) return;
    const planId = Number(id);
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`chat-members-${planChat.chat_id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_miembro", filter: `chat_id=eq.${planChat.chat_id}` }, () => {
        void fetchPlanChatItem(planId).then(setPlanChat);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_miembro", filter: `chat_id=eq.${planChat.chat_id}` }, () => {
        void fetchPlanUserRol(planId, user.id).then((rol) => {
          if (rol === null) { router.push("/calendar"); return; }
          void fetchPlanChatItem(planId).then(setPlanChat);
        });
      })
      .subscribe();

    // Escuchar broadcast de cambio de rol emitido desde el chat
    const rolChannel = supabase
      .channel(`msg:${planChat.chat_id}`)
      .on("broadcast", { event: "rol_change" }, ({ payload }) => {
        const { user_id, rol } = payload as { user_id: string; rol: string };
        if (user_id === user.id) setIsAdmin(rol === "ADMIN");
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(rolChannel);
    };
  }, [planChat?.chat_id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const planId = Number(id);
    if (!planId || !user?.id) return;
    fetchPlanChatItem(planId).then(setPlanChat).catch(console.error);
  }, [id, user?.id]);

  const loadGastos = () => {
    const planId = Number(id);
    if (!planId) return;
    listGastosForPlanEndpoint(planId).then(setGastos).catch(console.error);
  };

  const loadBalances = () => {
    const planId = Number(id);
    if (!planId) return;
    getBalancesForPlanEndpoint(planId).then(setBalances).catch(console.error);
  };

  useEffect(() => { loadGastos(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadBalances(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedGastoId && !gastos.some((gasto) => gasto.id === selectedGastoId)) {
      setSelectedGastoId(null);
    }
  }, [gastos, selectedGastoId]);

  if (loading || planLoading || !membershipChecked) return <PlanDetailSkeleton />;
  if (!plan) return (
    <div className="flex min-h-dvh items-center justify-center text-muted">
      Plan no encontrado.
    </div>
  );

  return (
    <div className={`${activeTab === "chat" ? "h-dvh overflow-hidden" : "min-h-dvh"} bg-app text-app`}>
      <div className={`relative w-full ${activeTab === "chat" ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
        <AppSidebar hideMobileNav={true} />
        <main className={`${activeTab === "chat" ? "h-dvh overflow-hidden" : "pb-[max(var(--space-6),env(safe-area-inset-bottom))]"} md:py-0 md:pl-[102px]`}>
          <div className={`${activeTab === "chat" ? "h-full" : ""} md:grid md:grid-cols-[minmax(88px,1fr)_minmax(0,1536px)_minmax(88px,1fr)] xl:grid-cols-[minmax(180px,1fr)_minmax(0,1280px)_minmax(180px,1fr)] 2xl:grid-cols-[minmax(240px,1fr)_minmax(0,1240px)_minmax(240px,1fr)]`}>
            <div className={`${activeTab === "chat" ? "flex h-full min-h-0 flex-col" : ""} md:col-start-2`}>

          {/* ─── Hero ─── */}
          <div
            className={`relative w-full overflow-hidden transition-[height] duration-300 md:ml-0 md:[border-bottom-left-radius:var(--radius-card)] md:[border-bottom-right-radius:var(--radius-card)] ${
              activeTab === "chat"
                ? "h-[clamp(150px,21vh,190px)] md:h-[clamp(260px,40vh,380px)]"
                : "h-[clamp(220px,34vh,320px)] md:h-[clamp(260px,40vh,380px)]"
            }`}
          >
            {plan.foto_portada ? (
              <Image
                src={plan.foto_portada}
                alt={plan.titulo}
                fill
                sizes="100vw"
                className="absolute inset-0 h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/60 to-primary/30" />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

            {/* Back button */}
            <button
              onClick={() => router.back()}
              className="absolute left-[var(--page-margin-x)] top-[calc(env(safe-area-inset-top)+var(--space-4))] md:top-[var(--space-6)] flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <BackIcon className="size-[20px]" />
            </button>

            {/* Title & meta */}
            <div className="absolute bottom-0 left-0 right-0 px-[var(--page-margin-x)] pb-[var(--space-6)]">
              <h1 className="[font-family:var(--font-display-face)] text-[clamp(24px,5vw,36px)] font-[var(--fw-medium)] leading-[1.1] tracking-[-0.01em] text-white">
                {plan.titulo}
              </h1>
              {plan.descripcion && (
                <p className="mt-[var(--space-1)] text-body-sm text-white/75 line-clamp-2">
                  {plan.descripcion}
                </p>
              )}
              <div className="mt-[var(--space-2)] flex flex-wrap items-center gap-[var(--space-3)] text-white/85">
                <span className="flex items-center gap-[5px] text-body-sm">
                  <CalendarSmallIcon className="size-[14px]" />
                  {formatDateRange(plan.inicio_at, plan.fin_at)}
                </span>
                {isPast && (
                  <span className="rounded-chip border border-white/30 bg-white/10 px-[var(--space-2)] py-[2px] text-[11px] font-[var(--fw-medium)] text-white/70">
                    Finalizado
                  </span>
                )}
                <span className="flex items-center gap-[5px] text-body-sm">
                  <MapPinIcon className="size-[14px]" />
                  {plan.ubicacion_nombre}
                </span>
              </div>

              {/* Action buttons */}
              <div className="absolute bottom-[var(--space-6)] right-[var(--page-margin-x)] flex gap-[var(--space-2)]">
                {!isPast && isAdmin && (
                  <button onClick={() => void openInviteModal()} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30">
                    <InviteIcon className="size-[18px]" />
                  </button>
                )}
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30">
                  <ShareIcon className="size-[18px]" />
                </button>
                {!isPast && isAdmin && (
                  <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30">
                    <EditIcon className="size-[18px]" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="border-b border-app px-[var(--page-margin-x)]">
            <div className="flex items-center justify-between">
              <div className="flex gap-[var(--space-8)]">
                {(["itinerario", "gastos", "chat"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative py-[var(--space-3)] text-body-sm font-[var(--fw-medium)] capitalize transition-colors ${
                      activeTab === tab
                        ? "text-app"
                        : "text-muted hover:text-app"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {activeTab === tab && (
                      <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-primary-token" />
                    )}
                  </button>
                ))}
              </div>
              {activeTab === "chat" && planChat && (
                <div className="flex items-center gap-[var(--space-1)] pb-[2px]">
                  <button
                    type="button"
                    onClick={() => {
                      const nombre = resolveChatName(planChat, user!.id);
                      const foto = resolveChatAvatar(planChat, user!.id) ?? undefined;
                      const miembros = planChat.miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));
                      void startCall(String(planChat.chat_id), "audio", nombre, foto, miembros);
                    }}
                    className="flex size-[32px] items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-app"
                    aria-label="Llamada de voz"
                  >
                    <PhoneCallIcon className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nombre = resolveChatName(planChat, user!.id);
                      const foto = resolveChatAvatar(planChat, user!.id) ?? undefined;
                      const miembros = planChat.miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));
                      void startCall(String(planChat.chat_id), "video", nombre, foto, miembros);
                    }}
                    className="flex size-[32px] items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-app"
                    aria-label="Videollamada"
                  >
                    <VideoCallIcon className="size-[18px]" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── Chat tab ─── */}
          {activeTab === "chat" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {planChat && user ? (
                <ChatConversation
                  chat={planChat}
                  currentUserId={user.id}
                  onBack={() => setActiveTab("itinerario")}
                  onNewMessage={() => {}}
                  onStartCall={(tipo) => {
                    const nombre = resolveChatName(planChat, user.id);
                    const foto = resolveChatAvatar(planChat, user.id) ?? undefined;
                    const miembros = planChat.miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));
                    void startCall(String(planChat.chat_id), tipo, nombre, foto, miembros);
                  }}
                  onJoinCall={(llamadaId, roomName, tipo) => {
                    const nombre = resolveChatName(planChat, user.id);
                    const foto = resolveChatAvatar(planChat, user.id) ?? undefined;
                    const miembros = planChat.miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));
                    void joinCall(llamadaId, roomName, String(planChat.chat_id), tipo, nombre, foto, miembros);
                  }}
                  inCall={callState.status !== "idle"}
                  registerCallReload={(fn) => { reloadCallMessagesRef.current = fn; }}
                  containerClassName="flex min-h-0 flex-1 flex-col"
                  embedded
                  planInfo={plan ? { titulo: plan.titulo, inicio_at: plan.inicio_at, fin_at: plan.fin_at, ubicacion_nombre: plan.ubicacion_nombre } : undefined}
                  planId={plan?.id}
                  isAdmin={isAdmin}
                  onAbrirActividad={(titulo) => {
                    if (isPast || !isAdmin) return;
                    setEditingSubplan(null);
                    setAddSheetInitialTitulo(titulo);
                    setAddSheetInitialDate(undefined);
                    setShowAddSheet(true);
                    setActiveTab("itinerario");
                  }}
                  onLeave={() => router.push("/calendar")}
                  onMembersChanged={() => {
                    const planId = Number(id);
                    if (planId) void fetchPlanChatItem(planId).then(setPlanChat);
                  }}
                />
              ) : (
                <div className="flex h-[50vh] items-center justify-center text-body-sm text-muted">
                  Cargando chat...
                </div>
              )}
            </div>
          )}

          {/* ─── Content ─── */}
          {activeTab !== "chat" && <div className="px-[var(--page-margin-x)] pt-[var(--space-6)] pb-[var(--space-3)] md:pb-[var(--space-16)]">

            {activeTab === "itinerario" && (
              <div
                className="flex flex-col gap-[var(--space-8)] lg:flex-row lg:gap-[var(--space-12)]"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >

                {/* Left column — itinerary */}
                <div className="flex-1 min-w-0">
                  {subplanes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-[var(--space-16)] text-muted">
                      <CalendarSmallIcon className="size-[40px] mb-[var(--space-3)] opacity-30" />
                      <p className="text-body font-[var(--fw-medium)]">Sin actividades</p>
                      <p className="text-body-sm mt-[var(--space-1)]">{isPast ? "Este plan ya ha finalizado" : "Añade la primera actividad del plan"}</p>
                      {!isPast && isAdmin && (
                      <button
                        onClick={() => {
                          setEditingSubplan(null);
                          setAddSheetInitialTitulo(undefined);
                          setAddSheetInitialDate(undefined);
                          setShowAddSheet(true);
                        }}
                        className="mt-[var(--space-5)] hidden items-center gap-[var(--space-2)] rounded-chip border border-primary-token px-[var(--space-4)] py-[var(--space-2)] text-body-sm font-[var(--fw-medium)] text-primary-token transition-colors hover:bg-primary-token/10 md:flex"
                      >
                        <span className="text-lg leading-none">+</span> Añadir actividad
                      </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {groupByDay(subplanes).map(([dateKey, items]) => (
                        <div key={dateKey} className={collapsedDays.has(dateKey) ? "mb-[var(--space-4)]" : "mb-[var(--space-6)]"}>
                          {/* Day header */}
                          <div className={`-mx-[var(--page-margin-x)] border-b border-app px-[var(--page-margin-x)] md:mx-0 md:px-0 ${collapsedDays.has(dateKey) ? "pb-[var(--space-4)]" : "mb-[var(--space-5)] pb-[var(--space-4)]"}`}>
                            <div className="flex items-start gap-[var(--space-3)]">
                              <div className="min-w-0 flex items-start gap-[6px]">
                                <button
                                  type="button"
                                  onClick={() => toggleCollapsedDay(dateKey)}
                                  className="mt-[2px] inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center text-muted transition-colors hover:text-primary-token"
                                  aria-label={collapsedDays.has(dateKey) ? `Desplegar ${fmtDayHeader(items[0].inicio_at)}` : `Plegar ${fmtDayHeader(items[0].inicio_at)}`}
                                >
                                  <ChevronDownIcon className={`size-[15px] transition-transform ${collapsedDays.has(dateKey) ? "-rotate-90" : "rotate-0"}`} />
                                </button>
                                {(() => {
                                  const dayExpense = dayExpenseTotals.get(dateKey);
                                  const daySummary = [
                                    `${items.length} actividad${items.length === 1 ? "" : "es"}`,
                                    dayExpense ? formatMoney(dayExpense.total, dayExpense.currency) : "Sin gastos",
                                  ].join(" · ");
                                  return (
                                    <>
                                      <div className="min-w-0">
                                        <h2
                                          className="font-[var(--fw-semibold)] uppercase tracking-[0.06em] text-app"
                                          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "var(--font-h4)", lineHeight: "1.15" }}
                                        >
                                          {fmtDayHeader(items[0].inicio_at)}
                                        </h2>
                                        <p
                                          className="mt-[6px] font-[var(--fw-medium)] leading-[1.15] text-muted"
                                          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "var(--font-body-sm)" }}
                                        >
                                          {daySummary}
                                        </p>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Timeline */}
                          <div
                            className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                              collapsedDays.has(dateKey)
                                ? "mt-0 grid-rows-[0fr] opacity-0"
                                : "mt-[var(--space-1)] grid-rows-[1fr] opacity-100"
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="relative pl-0">
                                {items.map((s, idx) => {
                                  const isLast = idx === items.length - 1;
                                  const nextTransporte = !isLast ? TRANSPORT_MAP[items[idx + 1]?.transporte_llegada ?? ""] : null;
                                  const startTimeLabel = fmtTime(s.inicio_at);
                                  const endTimeLabel = fmtTime(s.fin_at);
                                  return (
                                    <div key={s.id}>
                                    <div className="relative flex gap-0 pb-[var(--space-2)]">
                                      <div className="w-[82px] shrink-0 pr-[var(--space-2)] pt-[2px] text-right">
                                        {s.all_day ? (
                                          <span className="block text-[11px] font-[var(--fw-medium)] leading-[1.1] tracking-[0.01em] text-muted">
                                            Todo el día
                                          </span>
                                        ) : (
                                          <div className="ml-auto flex w-fit flex-col items-start text-left leading-[1.05] text-muted">
                                            <span className="block tabular-nums text-caption font-[var(--fw-medium)] tracking-[0.01em]">
                                              {startTimeLabel} -
                                            </span>
                                            <span className="mt-[2px] block tabular-nums text-caption font-[var(--fw-medium)] tracking-[0.01em]">
                                              {endTimeLabel}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="relative flex w-[28px] shrink-0 justify-center">
                                        {idx > 0 && (
                                          <div className="absolute left-1/2 top-[-16px] h-[18px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                                        )}
                                        {!isLast && (
                                          <div className="absolute left-1/2 top-[26px] bottom-[-10px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                                        )}
                                        <div className="relative z-10 mt-[2px] flex h-[24px] w-[24px] items-center justify-center rounded-full border-[2px] border-primary-token bg-app">
                                          <div className="h-[8px] w-[8px] rounded-full bg-primary-token" />
                                        </div>
                                      </div>

                                      <div className="min-w-0 flex-1 pl-[var(--space-3)]">
                                        <div className="flex items-start gap-[6px]">
                                          <h4
                                            className="min-w-0 shrink text-body font-[var(--fw-semibold)]"
                                            style={{ fontFamily: "var(--font-inter), sans-serif" }}
                                          >
                                            {s.titulo}
                                          </h4>
                                          {!isPast && isAdmin && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingSubplan(s);
                                                setAddSheetInitialTitulo(undefined);
                                                setAddSheetInitialDate(undefined);
                                                setShowAddSheet(true);
                                              }}
                                              className="mt-[1px] inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center text-muted transition-colors hover:text-primary-token"
                                              aria-label={`Editar ${s.titulo}`}
                                            >
                                              <EditIcon className="size-[14px]" />
                                            </button>
                                          )}
                                        </div>
                                        {s.descripcion && (
                                          <p className="mt-[2px] text-body-sm text-muted line-clamp-2">{s.descripcion}</p>
                                        )}
                                        {s.ubicacion_nombre && !s.ubicacion_fin_nombre && (
                                          <p className="mt-[4px] flex items-center gap-[4px] text-body-sm text-muted">
                                            <MapPinIcon className="size-[13px] shrink-0" />
                                            {s.ubicacion_nombre}
                                          </p>
                                        )}
                                        {s.ubicacion_nombre && s.ubicacion_fin_nombre && (
                                          <div className="mt-[4px] flex flex-col gap-[2px] text-body-sm text-muted">
                                            <p className="flex items-center gap-[4px]">
                                              <MapPinIcon className="size-[13px] shrink-0" />
                                              {s.ubicacion_nombre}
                                            </p>
                                            <div className="pl-[18px] text-[11px] leading-none text-primary-token">↓</div>
                                            <p className="flex items-center gap-[4px]">
                                              <MapPinIcon className="size-[13px] shrink-0" />
                                              {s.ubicacion_fin_nombre}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {/* Transport connector between activities */}
                                    {!isLast && (
                                      <div className="relative flex items-center gap-0 pb-[var(--space-4)]">
                                        <div className="w-[82px] shrink-0 pr-[var(--space-2)]" />
                                        <div className="relative flex w-[28px] shrink-0 justify-center">
                                          <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                                          {nextTransporte ? (
                                            <div className="relative z-10 flex h-[24px] w-[24px] items-center justify-center rounded-full border border-app bg-app text-muted">
                                              <nextTransporte.Icon className="size-[14px]" />
                                            </div>
                                          ) : null}
                                        </div>
                                        <div className="min-w-0 flex-1 pl-[var(--space-3)]">
                                        {!isPast && editingTransporteId === items[idx + 1].id ? (
                                          <div className="flex flex-wrap gap-[var(--space-2)]">
                                            {TRANSPORT_LLEGADA.map((t) => (
                                              <button
                                                key={t.value}
                                                onClick={() => handleTransporteChange(items[idx + 1].id, t.value)}
                                                className={`flex items-center gap-[6px] rounded-chip border px-[var(--space-2)] py-[4px] text-caption transition-colors ${
                                                  items[idx + 1].transporte_llegada === t.value
                                                    ? "border-primary-token bg-primary-token/10 text-primary-token"
                                                    : "border-app bg-surface-inset text-muted"
                                                }`}
                                              >
                                                <t.Icon className="size-[14px] shrink-0" />
                                                <span>{t.label}</span>
                                              </button>
                                            ))}
                                            <button onClick={() => setEditingTransporteId(null)} className="text-caption text-muted px-[var(--space-2)]">✕</button>
                                          </div>
                                        ) : nextTransporte ? (
                                          <div className="flex items-center gap-[var(--space-2)]">
                                            {isPast ? (
                                              <span className="flex items-center gap-[6px] text-caption text-muted">
                                                <span>{nextTransporte.label}</span>
                                                {items[idx + 1].duracion_viaje && (
                                                  <>
                                                    <span className="text-muted opacity-40">·</span>
                                                    <span>{items[idx + 1].duracion_viaje}</span>
                                                    {items[idx + 1].distancia_viaje && (
                                                      <span className="text-caption text-muted">{items[idx + 1].distancia_viaje}</span>
                                                    )}
                                                  </>
                                                )}
                                              </span>
                                            ) : (
                                              <button
                                                onClick={() => setEditingTransporteId(items[idx + 1].id)}
                                                className="flex items-center gap-[6px] text-caption text-muted transition-colors hover:text-primary-token"
                                              >
                                                <span>{nextTransporte.label}</span>
                                                {items[idx + 1].duracion_viaje && (
                                                  <>
                                                    <span className="text-muted opacity-40">·</span>
                                                    <span>{items[idx + 1].duracion_viaje}</span>
                                                    {items[idx + 1].distancia_viaje && (
                                                      <span className="text-caption text-muted">{items[idx + 1].distancia_viaje}</span>
                                                    )}
                                                  </>
                                                )}
                                              </button>
                                            )}
                                            <a
                                              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(s.ubicacion_fin_nombre ?? s.ubicacion_nombre ?? "")}&destination=${encodeURIComponent(items[idx + 1].ubicacion_nombre ?? "")}&travelmode=${nextTransporte.googleMode ?? "driving"}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center text-caption text-muted transition-colors hover:text-primary-token"
                                              title="Abrir en Google Maps"
                                            >
                                              <Image src="/brands/google-maps.svg" alt="Google Maps" width={14} height={14} className="size-[14px]" />
                                            </a>
                                            <a
                                              href={`https://waze.com/ul?q=${encodeURIComponent(items[idx + 1].ubicacion_nombre ?? "")}&navigate=yes`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center text-caption text-muted transition-colors hover:text-primary-token"
                                              title="Abrir en Waze"
                                            >
                                              <Image src="/brands/waze-icon.svg" alt="Waze" width={14} height={14} className="size-[14px]" />
                                            </a>
                                          </div>
                                        ) : !isPast ? (
                                          <button
                                            onClick={() => setEditingTransporteId(items[idx + 1].id)}
                                            className="text-caption text-muted hover:text-primary-token transition-colors"
                                          >
                                            + ¿Cómo llegas?
                                          </button>
                                        ) : null}
                                        </div>
                                      </div>
                                    )}
                                    </div>
                                  );
                                })}

                                {!isPast && isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSubplan(null);
                                      setAddSheetInitialTitulo(undefined);
                                      setAddSheetInitialDate(dateKey);
                                      setShowAddSheet(true);
                                    }}
                                    className="group relative flex w-full gap-0 pb-[var(--space-2)] pt-[var(--space-2)] text-left"
                                    aria-label={`Añadir actividad en ${fmtDayHeader(items[0].inicio_at)}`}
                                  >
                                    <div className="w-[82px] shrink-0 pr-[var(--space-2)]" />
                                    <div className="relative flex w-[28px] shrink-0 justify-center">
                                      <div className="absolute left-1/2 top-[-40px] h-[42px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                                      <div className="relative z-10 mt-[2px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-primary-token/35 bg-primary-token/10 text-primary-token transition-colors group-hover:border-primary-token/55 group-hover:bg-primary-token/16">
                                        <PlusIcon className="size-[12px]" />
                                      </div>
                                    </div>
                                    <div className="min-w-0 flex-1 self-center pl-[var(--space-3)]">
                                      <span className="text-body-sm font-[var(--fw-regular)] text-primary-token transition-colors group-hover:text-primary-token">
                                        Añadir actividad
                                      </span>
                                    </div>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                    </>
                  )}
                </div>

                {/* Right column — route map + expenses */}
                <div className="lg:w-[340px] lg:shrink-0">

                  {/* Route map card */}
                  {routeShouldShowMap && (
                    <div ref={routeSectionRef} className="mb-[var(--space-8)]">
                      <div className="mb-[var(--space-3)] flex items-center justify-between">
                        <h3 className="text-body font-[var(--fw-semibold)]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>Ruta del Día</h3>
                      </div>
                      {routeDayGroups.length > 1 && (
                        <div className="mb-[var(--space-3)] flex flex-wrap gap-[var(--space-2)]">
                          {routeDayGroups.map(([dateKey]) => {
                            const d = new Date(dateKey);
                            const label = `${d.getDate()} ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()]}`;
                            const isActive = activeRouteDay === dateKey;
                            return (
                              <button
                                key={dateKey}
                                type="button"
                                onClick={() => setSelectedMapDay(dateKey)}
                                className={`rounded-chip border px-[var(--space-3)] py-[4px] text-caption transition-colors ${isActive ? "border-primary-token bg-primary-token/10 text-primary-token" : "border-app text-muted hover:text-app"}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="relative">
                        <DayRouteMap
                          subplanes={subplanes}
                          selectedDate={activeRouteDay}
                          ubicacionNombre={plan.ubicacion_nombre ?? undefined}
                          onViajeComputed={handleViajeComputed}
                        />
                        <div className="absolute left-[var(--space-3)] top-[var(--space-3)] z-10 flex items-center gap-[var(--space-2)]">
                          {routeHasRoute && routeMapsUrl && (
                            <a
                              href={routeMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full border border-app bg-app/88 shadow-elev-2 backdrop-blur-sm transition-transform hover:scale-[1.04]"
                              title="Abrir ruta en Google Maps"
                            >
                              <Image src="/brands/google-maps.svg" alt="Google Maps" width={18} height={18} className="size-[18px]" />
                              <span className="absolute right-[-3px] top-[-3px] flex h-[15px] w-[15px] items-center justify-center rounded-full border border-app bg-app text-app shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                                <ExternalLinkIcon className="size-[8px]" />
                              </span>
                            </a>
                          )}
                          {routeHasRoute && routeWazeUrl && (
                            <a
                              href={routeWazeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full border border-app bg-app/88 shadow-elev-2 backdrop-blur-sm transition-transform hover:scale-[1.04]"
                              title="Abrir ruta en Waze"
                            >
                              <Image src="/brands/waze-icon.svg" alt="Waze" width={18} height={18} className="size-[18px]" />
                              <span className="absolute right-[-3px] top-[-3px] flex h-[15px] w-[15px] items-center justify-center rounded-full border border-app bg-app text-app shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                                <ExternalLinkIcon className="size-[8px]" />
                              </span>
                            </a>
                          )}
                        </div>
                        <div className="absolute right-[var(--space-3)] top-[var(--space-3)] z-10 flex items-center gap-[var(--space-2)]">
                          <button
                            type="button"
                            onClick={() => setShowMapFullscreen(true)}
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/12 bg-black/58 text-white shadow-[0_8px_20px_rgba(0,0,0,0.34)] backdrop-blur-sm transition-transform hover:scale-[1.04] hover:bg-black/66"
                            title="Ver mapa en pantalla completa"
                            aria-label="Ver mapa en pantalla completa"
                          >
                            <Maximize2 className="size-[16px]" strokeWidth={1.9} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expenses summary */}
                  <div className="rounded-[16px] border border-app bg-surface px-[var(--space-4)] py-[var(--space-4)]">
                    <div className="flex items-center justify-between gap-[var(--space-3)]">
                      <div className="flex min-w-0 items-center gap-[var(--space-2)]">
                        <h3 className="text-body font-[var(--fw-semibold)]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>Resumen gastos</h3>
                        <button
                          type="button"
                          onClick={() => setActiveTab("gastos")}
                          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-inset hover:text-app"
                          aria-label="Ir a la sección de gastos"
                        >
                          <ArrowRightIcon className="size-[16px]" />
                        </button>
                      </div>
                      {expenseSummary.hasExpenses ? (
                        <span
                          className="font-[var(--fw-bold)] leading-[1.1] text-app"
                          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "var(--font-h3)" }}
                        >
                          {formatMoney(expenseSummary.total, expenseSummary.currency)}
                        </span>
                      ) : null}
                    </div>

                    {expenseSummary.hasExpenses ? (
                      <>
                        <p className="mt-[4px] text-caption text-muted">
                          {expenseSummary.count} gasto{expenseSummary.count === 1 ? "" : "s"} confirmados
                          {expenseSummary.participantCount > 0
                            ? ` · ${expenseSummary.participantCount} participante${expenseSummary.participantCount === 1 ? "" : "s"}`
                            : ""}
                        </p>

                        <div className="mt-[var(--space-4)] grid grid-cols-2 gap-[var(--space-3)]">
                          <div className="rounded-[12px] border border-app bg-app px-[var(--space-3)] py-[var(--space-3)]">
                            <p className="text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                              Pagado por ti
                            </p>
                            <p className="mt-[6px] text-body font-[var(--fw-semibold)] text-app">
                              {formatMoney(expenseSummary.paidByYou, expenseSummary.currency)}
                            </p>
                          </div>
                          <div className="rounded-[12px] border border-app bg-app px-[var(--space-3)] py-[var(--space-3)]">
                            <p className="text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                              Tu parte
                            </p>
                            <p className="mt-[6px] text-body font-[var(--fw-semibold)] text-app">
                              {formatMoney(expenseSummary.yourShare, expenseSummary.currency)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-[var(--space-3)] rounded-[12px] border border-app bg-app px-[var(--space-3)] py-[var(--space-3)]">
                          <div className="flex items-center justify-between gap-[var(--space-3)]">
                            <div>
                              <p className="text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                                Balance del plan
                              </p>
                              <p className={`mt-[6px] text-body font-[var(--fw-semibold)] ${
                                expenseSummary.net > 0
                                  ? "text-[var(--success)]"
                                  : expenseSummary.net < 0
                                    ? "text-[var(--warning)]"
                                    : "text-app"
                              }`}>
                                {expenseSummary.net > 0 ? "+" : ""}
                                {formatMoney(expenseSummary.net, expenseSummary.currency)}
                              </p>
                            </div>
                            <span className={`rounded-full px-[var(--space-3)] py-[6px] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] ${
                              expenseSummary.net > 0
                                ? "bg-[var(--success)]/12 text-[var(--success)]"
                                : expenseSummary.net < 0
                                  ? "bg-[var(--warning)]/12 text-[var(--warning)]"
                                  : "bg-surface-inset text-muted"
                            }`}>
                              {expenseSummary.net > 0
                                ? "Te deben"
                                : expenseSummary.net < 0
                                  ? "Debes"
                                  : "En equilibrio"}
                            </span>
                          </div>
                        </div>

                        {expenseSummary.topCategories.length > 0 ? (
                          <div className="mt-[var(--space-4)]">
                            <p className="mb-[var(--space-3)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                              Categorías principales
                            </p>
                            <div className="space-y-[var(--space-2)]">
                              {expenseSummary.topCategories.map((category) => (
                                <div key={category.label} className="flex items-center gap-[var(--space-3)] rounded-[12px] border border-app bg-app px-[var(--space-3)] py-[var(--space-3)]">
                                  <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-surface-inset text-[16px]">
                                    {category.icon || "•"}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-body-sm font-[var(--fw-medium)] text-app">
                                      {category.label}
                                    </p>
                                    <p className="text-caption text-muted">
                                      {category.count} gasto{category.count === 1 ? "" : "s"}
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-body-sm font-[var(--fw-semibold)] text-app">
                                    {formatMoney(category.amount, expenseSummary.currency)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="mt-[var(--space-2)] text-body-sm text-muted">
                          Aún no hay gastos confirmados en este plan.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "gastos" && (
              <div className="mx-auto max-w-[760px]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                <div className="mb-[var(--space-6)] flex items-start justify-between gap-[var(--space-4)]">
                  <div>
                    <p className="text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                      Total gastado en el plan
                    </p>
                    <p
                      className="mt-[4px] text-[26px] font-[var(--fw-bold)] leading-none text-app"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {formatMoney(expenseSummary.total, expenseSummary.currency)}
                    </p>
                  </div>
                  {!isPast && (
                  <button
                    onClick={() => setShowAddGastoSheet(true)}
                    aria-label="Añadir gasto"
                    className="hidden size-10 items-center justify-center rounded-full bg-primary-token text-contrast-token md:flex"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </button>
                  )}
                </div>

                <div className="space-y-[var(--space-6)]">
                  <section>
                    <div className="mb-[var(--space-3)] flex items-center justify-between gap-[var(--space-3)]">
                      <div>
                        <h4 className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                          Deudas pendientes
                        </h4>
                      </div>
                      <span className="text-caption text-muted">
                        {visibleBalances.length} deuda{visibleBalances.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {visibleBalances.length === 0 ? (
                      <p className="px-[var(--space-4)] py-[var(--space-2)] text-body-sm text-muted">
                        No hay deudas pendientes en este plan.
                      </p>
                    ) : (
                      <div className="divide-y divide-app">
                        {visibleBalances.map((balance) => {
                          const isMineOutgoing = balance.from_user_id === user?.id;
                          const isMineIncoming = balance.to_user_id === user?.id;
                          const senderName = isMineOutgoing ? "Tú" : (balance.from_nombre ?? "Usuario");
                          const receiverName = isMineIncoming ? "Tú" : (balance.to_nombre ?? "Usuario");

                          return (
                            <article
                              key={`${balance.from_user_id}-${balance.to_user_id}-${balance.importe}`}
                              className="flex items-center gap-3 px-[var(--space-4)] py-[var(--space-3)]"
                            >
                              <PlanExpenseAvatar
                                name={senderName}
                                image={isMineOutgoing ? null : (balance.from_foto ?? null)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-body-sm text-app">
                                  {isMineOutgoing ? (
                                    <>
                                      <span className="font-light">Debes a </span>
                                      <span className="font-bold">{receiverName}</span>
                                    </>
                                  ) : isMineIncoming ? (
                                    <>
                                      <span className="font-bold">{senderName}</span>
                                      <span className="font-light"> te debe</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-bold">{senderName}</span>
                                      <span className="font-light"> debe a </span>
                                      <span className="font-bold">{receiverName}</span>
                                    </>
                                  )}
                                </p>
                                <p className="truncate text-caption text-muted">
                                  Deuda pendiente
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-body-sm font-[var(--fw-semibold)] ${
                                  isMineOutgoing
                                    ? "text-[var(--warning,#b45309)]"
                                    : isMineIncoming
                                      ? "text-[var(--success,#15803d)]"
                                      : "text-app"
                                }`}>
                                  {formatMoney(balance.importe, expenseSummary.currency)}
                                </p>
                                <p className="mt-[2px] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.06em] text-muted">
                                  Pendiente
                                </p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section>
                    <div className="mb-[var(--space-3)] flex items-center justify-between gap-[var(--space-3)]">
                      <div>
                        <h4 className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                          Historial de gastos
                        </h4>
                      </div>
                      <span className="text-caption text-muted">
                        {visiblePlanGastos.length} gasto{visiblePlanGastos.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {visiblePlanGastos.length === 0 ? (
                      <p className="px-[var(--space-4)] py-[var(--space-2)] text-body-sm text-muted">
                        Aún no hay gastos registrados en este plan.
                      </p>
                    ) : (
                      <div className="divide-y divide-app">
                        {visiblePlanGastos.map((gasto) => {
                          const payerName = gasto.pagado_por_nombre ?? "Usuario";
                          const categoryLine = gasto.subplan_titulo ?? gasto.categoria_nombre ?? gasto.descripcion?.trim() ?? "Sin detalle";
                          const recipientsSummary = summarizeRecipients(gasto.partes, gasto.pagado_por_user_id);
                          const isPaidByYou = gasto.pagado_por_user_id === user?.id;
                          const yourShare = user?.id
                            ? gasto.partes?.find((parte) => parte.user_id === user.id)?.importe ?? null
                            : null;

                          return (
                            <article
                              key={gasto.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedGastoId(gasto.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedGastoId(gasto.id);
                                }
                              }}
                              className="flex cursor-pointer items-center gap-3 px-[var(--space-4)] py-[var(--space-3)] transition-colors hover:bg-surface focus:outline-none"
                            >
                              <PlanExpenseAvatar name={payerName} image={gasto.pagado_por_foto ?? null} />

                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-[var(--space-2)]">
                                  <p className="truncate text-body-sm text-app">
                                    {isPaidByYou ? (
                                      <>
                                        <span className="font-bold">Tú</span>
                                        <span className="font-light"> pagaste </span>
                                        <span className="font-bold">{gasto.titulo}</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="font-bold">{payerName}</span>
                                        <span className="font-light"> pagó </span>
                                        <span className="font-bold">{gasto.titulo}</span>
                                      </>
                                    )}
                                  </p>
                                </div>
                                <p className="truncate text-caption text-muted">
                                  {yourShare != null
                                    ? `Tu parte: ${formatMoney(yourShare, gasto.moneda)}`
                                    : `Repartido entre ${recipientsSummary}`}
                                </p>
                                <p className="truncate text-caption text-muted">
                                  {categoryLine} · {formatExpenseDateTime(gasto.fecha_gasto)}
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-body-sm font-[var(--fw-semibold)] text-app">
                                  {formatMoney(gasto.total, gasto.moneda)}
                                </p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

          </div>}

            </div>
          </div>

        </main>
      </div>

      {showMapFullscreen && routeShouldShowMap && plan && (
        <div className="fixed inset-0 z-[85] bg-app overscroll-none">
          <div className="relative h-full w-full">
            <DayRouteMap
              subplanes={subplanes}
              selectedDate={activeRouteDay}
              ubicacionNombre={plan.ubicacion_nombre ?? undefined}
              onViajeComputed={handleViajeComputed}
              heightClassName="h-full"
              containerClassName="h-full"
            />
            <div className="absolute left-[max(var(--space-3),env(safe-area-inset-left))] top-[calc(env(safe-area-inset-top)+var(--space-3))] z-10 flex items-center gap-[var(--space-2)]">
              {routeHasRoute && routeMapsUrl && (
                <a
                  href={routeMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-app bg-app/88 shadow-elev-2 backdrop-blur-sm transition-transform hover:scale-[1.04]"
                  title="Abrir ruta en Google Maps"
                >
                  <Image src="/brands/google-maps.svg" alt="Google Maps" width={20} height={20} className="size-[20px]" />
                  <span className="absolute right-[-3px] top-[-3px] flex h-[15px] w-[15px] items-center justify-center rounded-full border border-app bg-app text-app shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                    <ExternalLinkIcon className="size-[8px]" />
                  </span>
                </a>
              )}
              {routeHasRoute && routeWazeUrl && (
                <a
                  href={routeWazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-app bg-app/88 shadow-elev-2 backdrop-blur-sm transition-transform hover:scale-[1.04]"
                  title="Abrir ruta en Waze"
                >
                  <Image src="/brands/waze-icon.svg" alt="Waze" width={20} height={20} className="size-[20px]" />
                  <span className="absolute right-[-3px] top-[-3px] flex h-[15px] w-[15px] items-center justify-center rounded-full border border-app bg-app text-app shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                    <ExternalLinkIcon className="size-[8px]" />
                  </span>
                </a>
              )}
            </div>
            <div className="absolute right-[max(var(--space-3),env(safe-area-inset-right))] top-[calc(env(safe-area-inset-top)+var(--space-3))] z-10 flex items-center gap-[var(--space-2)]">
              <button
                type="button"
                onClick={() => setShowMapFullscreen(false)}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/12 bg-black/58 text-white shadow-[0_8px_20px_rgba(0,0,0,0.34)] backdrop-blur-sm transition-colors hover:bg-black/66"
                aria-label="Cerrar mapa"
              >
                <X className="size-[18px]" strokeWidth={1.9} />
              </button>
            </div>
            {routeDayGroups.length > 1 && (
              <div className="absolute inset-x-[var(--page-margin-x)] bottom-[calc(env(safe-area-inset-bottom)+var(--space-4))] z-10 flex flex-wrap justify-center gap-[var(--space-2)]">
                {routeDayGroups.map(([dateKey]) => {
                  const d = new Date(dateKey);
                  const label = `${d.getDate()} ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()]}`;
                  const isActive = activeRouteDay === dateKey;
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedMapDay(dateKey)}
                      className={`rounded-full px-[var(--space-3)] py-[5px] text-caption font-[var(--fw-medium)] shadow-[0_2px_8px_rgba(0,0,0,0.25)] backdrop-blur-md transition-colors ${isActive ? "bg-primary-token text-contrast-token" : "bg-app/82 text-app hover:bg-app"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {!isPast && isAdmin && activeTab === "itinerario" && !routeSectionVisible && !showAddSheet && (
        <button
          type="button"
          onClick={() => {
            setEditingSubplan(null);
            setAddSheetInitialTitulo(undefined);
            setAddSheetInitialDate(undefined);
            setShowAddSheet(true);
          }}
          className="fixed bottom-[calc(var(--space-6)+env(safe-area-inset-bottom))] right-[var(--page-margin-x)] z-[65] flex h-[54px] w-[54px] items-center justify-center rounded-full bg-primary-token text-contrast-token shadow-[0_16px_32px_rgba(0,0,0,0.24)] transition-transform hover:scale-[1.03] hover:opacity-90 md:hidden"
          aria-label="Añadir actividad"
          title="Añadir actividad"
        >
          <PlusIcon className="size-[18px]" />
        </button>
      )}

      {!isPast && activeTab === "gastos" && !showAddGastoSheet && (
        <button
          type="button"
          onClick={() => setShowAddGastoSheet(true)}
          className="fixed bottom-[calc(var(--space-6)+env(safe-area-inset-bottom))] right-[var(--page-margin-x)] z-[65] flex h-[54px] w-[54px] items-center justify-center rounded-full bg-primary-token text-contrast-token shadow-[0_16px_32px_rgba(0,0,0,0.24)] transition-transform hover:scale-[1.03] hover:opacity-90 md:hidden"
          aria-label="Añadir gasto"
          title="Añadir gasto"
        >
          <PlusIcon className="size-[18px]" />
        </button>
      )}

      {showAddSheet && plan && !isPast && isAdmin && (
        <AddSubplanSheet
          planId={plan.id}
          planStartDate={plan.inicio_at}
          planEndDate={plan.fin_at}
          subplanes={subplanes}
          onClose={() => {
            setShowAddSheet(false);
            setEditingSubplan(null);
            setAddSheetInitialTitulo(undefined);
            setAddSheetInitialDate(undefined);
          }}
          onSaved={handleSubplanSaved}
          initialTitulo={addSheetInitialTitulo}
          initialDate={addSheetInitialDate}
          initialSubplan={editingSubplan}
        />
      )}

      {showAddGastoSheet && plan && user && (
        <AddGastoSheet
          planId={plan.id}
          userId={user.id}
          onClose={() => setShowAddGastoSheet(false)}
          onCreated={() => {
            loadGastos();
            loadBalances();
          }}
        />
      )}

      <PlanGastoDetailModal
        gasto={selectedGasto}
        planName={plan.titulo}
        currentUserId={user?.id ?? null}
        onClose={() => setSelectedGastoId(null)}
      />

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center bg-black/50 px-4 pb-[max(var(--space-4),env(safe-area-inset-bottom))]" onClick={() => setShowInviteModal(false)}>
          <div className="w-full max-w-[440px] rounded-modal bg-[var(--bg)] shadow-elev-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-app">
              <p className="text-body font-[var(--fw-semibold)]">Invitar al plan</p>
              <button type="button" onClick={() => setShowInviteModal(false)} className="text-muted transition-opacity hover:opacity-70">
                <svg viewBox="0 0 24 24" fill="none" className="size-[20px]"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Friends list */}
            <div className="px-2 pt-2 pb-1">
              <p className="px-3 pb-1.5 text-[11px] font-[var(--fw-semibold)] uppercase tracking-wider text-muted">Amigos</p>
              {inviteFriendsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="size-[20px] animate-spin rounded-full border-2 border-[var(--text-primary)] border-t-transparent" />
                </div>
              ) : inviteFriends.length === 0 ? (
                <p className="py-4 text-center text-body-sm text-muted">No hay amigos para invitar.</p>
              ) : (
                <div className="max-h-[calc(4*52px)] overflow-y-auto">
                  {inviteFriends.map((friend) => {
                    const sent = inviteSentIds.has(friend.id);
                    const sending = inviteSendingIds.has(friend.id);
                    const avatarLabel = (friend.nombre.trim()[0] || "?").toUpperCase();
                    return (
                      <div key={friend.id} className="flex h-[52px] w-full items-center gap-3 rounded-[8px] px-3">
                        {friend.profile_image ? (
                          <Image src={friend.profile_image} alt={friend.nombre} width={32} height={32} className="size-[32px] rounded-full object-cover" referrerPolicy="no-referrer" unoptimized />
                        ) : (
                          <div className="flex size-[32px] items-center justify-center rounded-full bg-[var(--text-primary)] text-[13px] font-[var(--fw-semibold)] text-contrast-token">{avatarLabel}</div>
                        )}
                        <span className="flex-1 text-body-sm font-[var(--fw-medium)]">{friend.nombre}</span>
                        <button
                          type="button"
                          disabled={sent || sending}
                          onClick={() => void handleInviteFriend(friend.id)}
                          className={`rounded-full px-4 py-1.5 text-[12px] font-[var(--fw-semibold)] transition-all ${sent ? "bg-surface text-muted cursor-default" : "bg-[var(--text-primary)] text-contrast-token hover:opacity-80 disabled:opacity-50"}`}
                        >
                          {sending ? "..." : sent ? "Enviado" : "Invitar"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invite link */}
            {inviteLink && (
              <div className="px-5 py-3 border-t border-app">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-[var(--fw-semibold)] uppercase tracking-wider text-muted">Enlace de invitación</p>
                  <button
                    type="button"
                    onClick={() => setShowQr((v) => !v)}
                    className="flex items-center gap-1 text-[12px] text-muted hover:text-[var(--text-primary)] transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="size-[14px]"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/><path d="M14 14h3v3M17 17v3h3M14 20h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    QR
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-[8px] bg-surface px-3 py-2">
                  <span className="flex-1 truncate text-[12px] text-muted">{inviteLink}</span>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="shrink-0 rounded-full bg-[var(--text-primary)] px-3 py-1 text-[12px] font-[var(--fw-semibold)] text-contrast-token transition-all hover:opacity-80"
                  >
                    {inviteLinkCopied ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
                {/* QR code */}
                {showQr && (
                  <div className="mt-3 flex justify-center">
                    <div className="rounded-[12px] bg-white p-3 shadow-sm">
                      <QRCodeSVG value={inviteLink} size={160} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="px-5 pb-4 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-full rounded-full border border-app py-[10px] text-body-sm font-[var(--fw-semibold)] transition-opacity hover:opacity-70"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
