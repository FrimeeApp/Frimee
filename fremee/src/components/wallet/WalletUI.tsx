"use client";
/**
 * Cartera (talonario de billetes de papel). Piezas de pantalla: billete grande, billete en fila,
 * billete abierto con QR, hoja «Añadir» y estados de carga/error.
 * El papel y las tintas son los del pasaporte (iguales en los dos temas).
 */
import { useEffect } from "react";
import { TicketCodeView } from "./TicketCodeView";
import { raiseScreenBrightness } from "@/lib/screen-brightness";
import type { TicketCodeFormat } from "@/lib/ticket-barcode";
import {
  AlertCircle, BedDouble, Bus, ChevronLeft, ChevronRight, FileText, MapPin,
  Plane, Plus, QrCode, RefreshCw, Ship, Ticket as TicketIcon, Train, Trash2, Pencil, Upload,
} from "lucide-react";
import { BOOK, PaperGuilloche } from "@/components/profile/passport/Libreta";

export const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";
export const SERIF = "[font-family:var(--font-display-face)] font-normal";
const T2 = "text-[var(--text-secondary)]";
const ON_PRIMARY = "text-[var(--contrast)]";

export const INKS = { azul: "#2B4C9B", rojo: "#9B2B3A", verde: "#1E5E52", violeta: "#5B3A8C", negro: BOOK.text } as const;

/* ---------------- datos ---------------- */

export type TicketKind = "vuelo" | "tren" | "bus" | "barco" | "entrada" | "reserva" | "otro";

export type Ticket = {
  id: string;
  kind: TicketKind;
  startsAt: string;
  status: "listo" | "usado";
  plan?: { id: string; title: string; dates?: string };
  code?: string;
  /** Contenido real del código (QR, Aztec o PDF417), si lo tenemos. */
  qr?: string;
  qrFormat?: TicketCodeFormat;
  /** Hay un código guardado pero solo como imagen del billete original. */
  hasSourceCode?: boolean;
  hasSource?: boolean;
  from?: string; to?: string; fromCity?: string; toCity?: string; gate?: string; seat?: string;
  title?: string; venue?: string; qty?: number;
};

const KIND: Record<TicketKind, { label: string; ink: string; Icon: typeof Plane; transport: boolean }> = {
  vuelo: { label: "VUELO", ink: INKS.azul, Icon: Plane, transport: true },
  tren: { label: "TREN", ink: INKS.verde, Icon: Train, transport: true },
  bus: { label: "BUS", ink: INKS.verde, Icon: Bus, transport: true },
  barco: { label: "BARCO", ink: INKS.azul, Icon: Ship, transport: true },
  entrada: { label: "ENTRADA", ink: INKS.violeta, Icon: TicketIcon, transport: false },
  reserva: { label: "RESERVA", ink: INKS.rojo, Icon: BedDouble, transport: false },
  otro: { label: "OTRO", ink: INKS.negro, Icon: TicketIcon, transport: false },
};

/* ---------------- fechas ---------------- */

const TZ = "Europe/Madrid";
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso)).replace(".", "");
const fmtTime = (iso: string) => new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

/** «Hoy», «Mañana», «En 3 días» (hasta 7); null si falta más o ya pasó. */
export function relLabel(iso: string, now = new Date()) {
  const a = new Date(dayKey(now)), b = new Date(dayKey(new Date(iso)));
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (days < 0 || days > 7) return null;
  return days === 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`;
}
const when = (iso: string, now: Date) => {
  const r = relLabel(iso, now);
  return `${r === "Hoy" || r === "Mañana" ? r : fmtDay(iso)} · ${fmtTime(iso)}`;
};

const ariaFor = (t: Ticket, now: Date) => {
  const k = KIND[t.kind];
  const what = k.transport ? `${k.label.toLowerCase()} ${t.fromCity ?? t.from ?? ""} a ${t.toCity ?? t.to ?? ""}` : `${k.label.toLowerCase()}: ${t.title ?? ""}`;
  return `${what[0].toUpperCase()}${what.slice(1)}, ${when(t.startsAt, now)}${t.status === "usado" ? ", usado" : ""}`;
};

/* ---------------- piezas de papel ---------------- */

function Notches({ x }: { x: number }) {
  return (
    <>
      <span aria-hidden className="absolute h-[18px] w-[18px] rounded-full bg-[var(--bg)]" style={{ left: x - 9, top: -9 }} />
      <span aria-hidden className="absolute h-[18px] w-[18px] rounded-full bg-[var(--bg)]" style={{ left: x - 9, bottom: -9 }} />
    </>
  );
}

function UsedStamp({ width = 110 }: { width?: number }) {
  return (
    <svg aria-hidden width={width} height={Math.round(width * 0.46)} viewBox="0 0 100 46" className="pointer-events-none -rotate-12 opacity-85">
      <rect x="2" y="2" width="96" height="42" rx="6" fill="none" stroke={INKS.rojo} strokeWidth={3} strokeDasharray="38 2 22 1.5 30 2.5 18 1" />
      <rect x="7" y="7" width="86" height="32" rx="3" fill="none" stroke={INKS.rojo} strokeWidth={1.2} />
      <text x="50" y="30" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontSize={17} fontWeight={800} letterSpacing={3} fill={INKS.rojo}>USADO</text>
    </svg>
  );
}

function Field({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] font-semibold tracking-[0.06em]" style={{ color: BOOK.label }}>{label}</span>
      <span className={`truncate text-[15px] tabular-nums ${mono ? "font-mono font-medium" : "font-semibold"}`} style={{ color: BOOK.text }} title={value}>{value}</span>
    </div>
  );
}

function KindChip({ kind }: { kind: TicketKind }) {
  const k = KIND[kind];
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border-[1.5px] px-2.5 text-[11px] font-bold tracking-[0.1em]" style={{ borderColor: k.ink, color: k.ink }}>
      <k.Icon size={14} aria-hidden />{k.label}
    </span>
  );
}

/* ---------------- billete grande ---------------- */

export function TicketBig({ t, width, now = new Date(), onShowQr }: { t: Ticket; width: number; now?: Date; onShowQr?: () => void }) {
  const k = KIND[t.kind];
  const wide = width >= 420;
  const stub = wide ? 150 : 108;
  const main = width - stub;
  const h = 236;
  const rel = t.status === "listo" ? relLabel(t.startsAt, now) : null;
  const hasCode = !!(t.qr || t.hasSourceCode);
  const big = `${wide ? "text-[44px]" : "text-[36px]"} truncate font-bold leading-none tracking-[0.02em]`;
  return (
    <article aria-label={ariaFor(t, now)} className="relative overflow-hidden rounded-[10px]"
      style={{ width, height: h, background: BOOK.paper, boxShadow: "0 1px 0 #d6dbd2, 0 2px 0 #e9ece4, 0 3px 0 #d2d7ce" }}>
      <PaperGuilloche w={width} h={h} seed={5} variant="ticket" />
      <div className="absolute left-0 top-0 box-border px-5 py-[18px]" style={{ width: main, height: h }}>
        <div className="flex items-center gap-2">
          <KindChip kind={t.kind} />
          <span className="flex-1" />
          {rel && <span className="inline-flex h-[26px] items-center rounded-full px-2.5 text-xs font-semibold text-white" style={{ background: BOOK.ribbon }}>{rel}</span>}
        </div>
        {k.transport ? (
          <>
            <div className="mt-3.5 flex items-center gap-3">
              <div className="flex min-w-0 flex-col" style={{ maxWidth: "38%" }}>
                <span className={big} style={{ color: BOOK.text }}>{t.from ?? "—"}</span>
                <span className="truncate text-[13px]" style={{ color: BOOK.label }}>{t.fromCity}</span>
              </div>
              <div aria-hidden className="flex flex-1 items-center gap-1.5 pb-[18px]" style={{ color: BOOK.label }}>
                <span className="flex-1 border-t-[1.5px] border-dashed" style={{ borderColor: BOOK.label }} />
                <k.Icon size={18} />
                <span className="flex-1 border-t-[1.5px] border-dashed" style={{ borderColor: BOOK.label }} />
              </div>
              <div className="flex min-w-0 flex-col items-end" style={{ maxWidth: "38%" }}>
                <span className={big} style={{ color: BOOK.text }}>{t.to ?? "—"}</span>
                <span className="truncate text-[13px]" style={{ color: BOOK.label }}>{t.toCity}</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <Field label="SALIDA" value={when(t.startsAt, now)} />
              <Field label="PUERTA · ASIENTO" value={[t.gate, t.seat].filter(Boolean).join(" · ") || undefined} />
              <Field label={wide ? "LOCALIZADOR" : "LOCALIZ."} value={t.code} mono />
            </div>
          </>
        ) : (
          <>
            <p className={`${SERIF} ${wide ? "text-[32px]" : "text-[26px]"} mt-3.5 line-clamp-1 leading-[1.1]`} style={{ color: BOOK.text }} title={t.title}>{t.title}</p>
            <p className="truncate text-[13px]" style={{ color: BOOK.label }}>{t.venue}</p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Field label="FECHA · HORA" value={when(t.startsAt, now)} />
              <Field label="LOCALIZADOR" value={t.code} mono />
            </div>
          </>
        )}
      </div>

      <div className="absolute bottom-0 right-0 top-0 flex flex-col items-center justify-center gap-2 border-l-2 border-dashed px-2.5" style={{ left: main, borderColor: "#B9C4BE" }}>
        {hasCode ? (
          <>
            <button type="button" onClick={onShowQr} aria-label="Mostrar el código QR"
              className={`grid place-content-center rounded-lg border bg-white ${FOCUS}`} style={{ width: Math.min(84, stub - 24), height: Math.min(84, stub - 24), borderColor: "#DDE3DA", color: BOOK.text }}>
              <QrCode size={40} aria-hidden />
            </button>
            <span className="text-center text-xs font-semibold" style={{ color: BOOK.text }}>Mostrar QR</span>
          </>
        ) : (
          <span className="text-center text-xs font-semibold" style={{ color: BOOK.label }}>Sin QR</span>
        )}
      </div>

      {t.status === "usado" && <span className="absolute top-[18px]" style={{ left: main - 120 }}><UsedStamp /></span>}
      <Notches x={main} />
    </article>
  );
}

/* ---------------- billete en fila ---------------- */

export function TicketRow({ t, selected, now = new Date(), onSelect }: { t: Ticket; selected?: boolean; now?: Date; onSelect: () => void }) {
  const k = KIND[t.kind];
  const stub = 92;
  const cap = k.label[0] + k.label.slice(1).toLowerCase();
  const title = k.transport ? `${t.from ?? "—"} → ${t.to ?? "—"}` : t.title;
  const meta = k.transport
    ? [cap, t.gate && `puerta ${t.gate}`, t.seat && `asiento ${t.seat}`].filter(Boolean).join(" · ")
    : [cap, t.venue].filter(Boolean).join(" · ");
  return (
    <button type="button" onClick={onSelect} aria-label={ariaFor(t, now)} aria-current={selected || undefined}
      className={`relative block h-[72px] w-full overflow-hidden rounded-lg text-left ${FOCUS} ${selected ? "outline outline-2 outline-offset-[3px] outline-[var(--primary)]" : ""}`}
      style={{ background: BOOK.paper, boxShadow: "0 1px 0 #d6dbd2, 0 2px 0 #e9ece4" }}>
      <div className="absolute inset-y-0 left-0 flex items-center gap-3 px-3.5" style={{ right: stub }}>
        <span className="grid h-9 w-9 shrink-0 place-content-center rounded-full border-[1.5px]" style={{ borderColor: k.ink, color: k.ink }}><k.Icon size={18} aria-hidden /></span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold" style={{ color: BOOK.text }}>{title}</span>
          <span className="truncate text-[13px] tabular-nums" style={{ color: BOOK.label }}>{meta}</span>
        </span>
      </div>
      <div className="absolute inset-y-0 right-0 flex flex-col items-center justify-center border-l-2 border-dashed" style={{ width: stub, borderColor: "#B9C4BE" }}>
        <span className="text-lg font-bold leading-tight tabular-nums" style={{ color: BOOK.text }}>{fmtTime(t.startsAt)}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] tabular-nums" style={{ color: BOOK.label }}>{fmtDay(t.startsAt)}</span>
      </div>
      {t.status === "usado" && <span className="absolute top-3" style={{ right: stub + 12 }}><UsedStamp width={84} /></span>}
      <span aria-hidden className="absolute h-[18px] w-[18px] rounded-full bg-[var(--bg)]" style={{ right: stub - 9, top: -9 }} />
      <span aria-hidden className="absolute h-[18px] w-[18px] rounded-full bg-[var(--bg)]" style={{ right: stub - 9, bottom: -9 }} />
    </button>
  );
}

/* ---------------- billete abierto ---------------- */

export function TicketDetail({ t, now, isDesktop, sourceUrl, onBack, onOpenPlan, onEdit, onDelete, onAddQr }: {
  t: Ticket; now: Date; isDesktop: boolean;
  /** URL firmada de la imagen o PDF original, si existe. */
  sourceUrl?: { url: string; isPdf: boolean } | null;
  onBack?: () => void; onOpenPlan: (planId: string) => void; onEdit?: () => void; onDelete: () => void;
  /** Abre la subida de PDF o captura para este billete. */
  onAddQr: () => void;
}) {
  const width = isDesktop ? 560 : 358;
  const secondary = `inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 text-sm font-semibold ${FOCUS}`;
  const iconBtn = `inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold hover:bg-[var(--surface-2)] ${FOCUS}`;

  // Con el código a la vista (billete próximo), la pantalla sube al máximo en la app nativa y vuelve a como estaba al cerrar.
  const showingCode = !!t.qr && t.status === "listo";
  useEffect(() => {
    if (!showingCode) return;
    let restore: (() => void) | null = null;
    let cancelled = false;
    void raiseScreenBrightness().then((r) => { if (cancelled) r(); else restore = r; });
    return () => { cancelled = true; restore?.(); };
  }, [showingCode, t.id]);

  const qrBlock = t.qr ? (
    <section aria-label="Código del billete" className={`flex rounded-[10px] bg-white p-5 ${isDesktop ? "items-center gap-4" : "flex-col items-center gap-3"}`}>
      <TicketCodeView formato={t.qrFormat ?? "qr"} contenido={t.qr} size={isDesktop ? 150 : 196} />
    </section>
  ) : sourceUrl && !sourceUrl.isPdf ? (
    <section aria-label="Billete original" className="rounded-[10px] bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sourceUrl.url} alt="Billete original con su código" className="mx-auto max-h-[420px] w-full object-contain" />
    </section>
  ) : t.status === "usado" ? null : (
    <section aria-label="Sin código QR"
      className={`flex rounded-[10px] border-[1.5px] border-dashed border-[var(--border-strong)] p-5 ${isDesktop ? "items-center gap-4" : "flex-col items-start gap-3"}`}>
      <span aria-hidden className="grid h-12 w-12 shrink-0 place-content-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]"><QrCode size={24} /></span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">Este billete no tiene QR</span>
        <span className={`text-sm ${T2}`}>Sube el PDF o una captura y lo añadimos para enseñarlo en la puerta.</span>
      </div>
      <button type="button" onClick={onAddQr} className={`${secondary} ${isDesktop ? "" : "w-full"}`}>
        <Upload size={18} aria-hidden />Añadir QR o PDF
      </button>
    </section>
  );

  const actions = (
    <div className={`flex items-center gap-2 ${isDesktop ? "" : "flex-wrap"}`}>
      {t.plan && <button type="button" className={secondary} onClick={() => onOpenPlan(t.plan!.id)}><MapPin size={18} aria-hidden />Ver en el plan</button>}
      {sourceUrl?.isPdf && <a href={sourceUrl.url} target="_blank" rel="noreferrer" className={secondary}><FileText size={18} aria-hidden />Abrir el PDF</a>}
      <span className="flex-1" />
      {onEdit && <button type="button" className={`${iconBtn} text-[var(--text-primary)]`} onClick={onEdit}><Pencil size={18} aria-hidden />Editar</button>}
      <button type="button" className={`${iconBtn} text-[var(--error)]`} onClick={onDelete}><Trash2 size={18} aria-hidden />Eliminar</button>
    </div>
  );

  const body = (
    <div className="flex flex-col gap-3" style={{ width }}>
      <TicketBig t={t} width={width} now={now} />
      {actions}
      {qrBlock}
    </div>
  );

  if (isDesktop) return <aside aria-label="Billete seleccionado" className="min-w-0 flex-[0_1_560px]">{body}</aside>;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--bg)] pb-[max(16px,env(safe-area-inset-bottom))] text-[var(--text-primary)]">
      <div className="flex h-14 items-center px-1 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onBack} className={`inline-flex h-11 items-center gap-1 rounded-lg pl-1 pr-2 text-[17px] font-semibold ${FOCUS}`}>
          <ChevronLeft size={22} aria-hidden />Cartera
        </button>
      </div>
      <div className="px-4">{body}</div>
    </div>
  );
}

/* ---------------- confirmar borrado ---------------- */

export function ConfirmDelete({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onCancel]);
  return (
    <>
      <div aria-hidden className="fixed inset-0 z-[80] bg-black/60" onClick={onCancel} />
      <section role="alertdialog" aria-modal="true" aria-labelledby="del-h"
        className="fixed left-1/2 top-1/2 z-[81] w-[min(360px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text-primary)] shadow-[0_12px_24px_rgba(0,0,0,0.3)]">
        <h2 id="del-h" className="text-lg font-semibold">¿Eliminar este billete?</h2>
        <p className={`mt-1 text-sm ${T2}`}>No se puede deshacer.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={`h-11 rounded-lg px-4 text-sm font-semibold ${FOCUS}`}>Cancelar</button>
          <button type="button" onClick={onConfirm} className={`h-11 rounded-lg bg-[var(--error)] px-4 text-sm font-semibold text-white ${FOCUS}`}>Eliminar</button>
        </div>
      </section>
    </>
  );
}

/* ---------------- cargando y error ---------------- */

export function WalletSkeleton() {
  const sk = "bg-[var(--surface-2)] animate-pulse motion-reduce:animate-none motion-reduce:opacity-70";
  return (
    <div aria-busy="true" className="flex flex-col gap-3 pt-6">
      <span className={`h-3 w-28 rounded-full ${sk}`} />
      <span className={`mt-4 h-[236px] w-full max-w-[560px] rounded-[10px] ${sk}`} />
      <span className={`h-[72px] w-full max-w-[560px] rounded-lg ${sk}`} />
      <span className={`h-[72px] w-full max-w-[560px] rounded-lg ${sk}`} />
      <p role="status" className={`text-sm ${T2}`}>Cargando tu cartera…</p>
    </div>
  );
}

export function WalletError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <AlertCircle size={40} aria-hidden className="text-[var(--error)]" />
      <h2 className="mt-4 text-xl font-semibold">No se pudo cargar la cartera</h2>
      <p className={`mt-2 text-base ${T2}`}>Comprueba la conexión y vuelve a intentarlo.</p>
      <button type="button" onClick={onRetry} className={`mt-6 inline-flex h-[46px] items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-5 font-semibold ${FOCUS}`}>
        <RefreshCw size={18} aria-hidden />Reintentar
      </button>
    </div>
  );
}

export { Plus, T2, ON_PRIMARY, ChevronLeft, ChevronRight, fmtDay };
