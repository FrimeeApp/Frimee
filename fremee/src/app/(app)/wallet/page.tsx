"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import AddTicketModal from "@/components/wallet/AddTicketModal";
import { PlusIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { CloseX } from "@/components/ui/CloseX";
import {
  listTicketsEndpoint,
  getTicketSourceSignedUrl,
  type PlanTicket,
  type TicketType,
  getTicketColor,
  TICKET_TEXT,
  TICKET_MUTED,
  TICKET_TYPE_LABELS,
} from "@/services/api/endpoints/wallet.endpoint";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d
    .toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase()
    .replace(",", " ·");
}

function statusLabel(s: PlanTicket["status"]) {
  if (s === "used") return "USADO";
  if (s === "cancelled") return "CANCELADO";
  return "LISTO";
}

function isRouteType(type: TicketType) {
  return type === "flight" || type === "ferry" || type === "train";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<PlanTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<PlanTicket | null>(null);

  async function load() {
    try {
      const data = await listTicketsEndpoint();
      setTickets(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+var(--space-6))] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
          <div className="mx-auto w-full max-w-[980px]">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 text-body-sm font-[var(--fw-semibold)] text-muted transition-colors hover:text-app"
              >
                <span aria-hidden="true">&lt;</span>
                Volver
              </button>

              <button
                type="button"
                aria-label="Añadir ticket"
                onClick={() => setAddOpen(true)}
                className="flex size-10 items-center justify-center rounded-full border border-app text-app transition-colors hover:bg-surface"
              >
                <PlusIcon className="size-[18px]" />
              </button>
            </div>

            <div className="mt-5">
              <p className="text-label text-muted">Wallet</p>
              <h1 className="mt-1 text-[32px] font-[var(--fw-semibold)] tracking-[-0.03em] text-app">
                Tickets y billetes
              </h1>
              <p className="mt-2 max-w-[420px] text-body-sm text-muted">
                Guarda entradas, billetes y reservas de cualquier plan. Se ordenan por fecha para que arriba tengas siempre lo más cercano.
              </p>
            </div>

            {loading ? (
              <div className="mt-10 flex justify-center">
                <span className="text-body-sm text-muted">Cargando...</span>
              </div>
            ) : tickets.length === 0 ? (
              <WalletEmptyState onAdd={() => setAddOpen(true)} />
            ) : (
              <div className="mt-6">
                <WalletStack tickets={tickets} onOpen={setViewTicket} />
              </div>
            )}
          </div>
        </main>
      </div>

      {addOpen && (
        <AddTicketModal
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); load(); }}
        />
      )}

      {viewTicket && (
        <TicketSourceViewer
          ticket={viewTicket}
          onClose={() => setViewTicket(null)}
        />
      )}
    </div>
  );
}

// ── TicketCard ────────────────────────────────────────────────────────────────

// ── WalletStack ───────────────────────────────────────────────────────────────

const PEEK        = 120;   // px of stacked card visible below active card
const STACK_GAP   = 6;    // extra px offset per card depth
const MAX_PEEKING = 3;    // max cards visible in the stack
const SCROLL_STEP = 260;  // px scrolled per card transition

function WalletStack({ tickets, onOpen }: { tickets: PlanTicket[]; onOpen: (t: PlanTicket) => void }) {
  const captureRef   = useRef<HTMLDivElement>(null);
  const firstCardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH]     = useState(230);
  const [progress, setProgress] = useState(0); // 0…n-1 fractional

  // Measure actual card height
  useEffect(() => {
    if (firstCardRef.current) setCardH(firstCardRef.current.offsetHeight);
  }, [tickets]);

  const peekCount  = Math.min(MAX_PEEKING, tickets.length - 1);
  const frameH     = cardH + peekCount * (PEEK * 0.4 + STACK_GAP);
  const containerH = frameH + 16;
  // Total scroll distance inside the capture div
  const scrollableH = containerH + (tickets.length - 1) * SCROLL_STEP;

  // Distinguish tap from scroll: track scroll movement during pointer interaction
  const scrollAtPointerDown = useRef(0);
  const didScrollRef = useRef(false);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const p = Math.min(tickets.length - 1, e.currentTarget.scrollTop / SCROLL_STEP);
    setProgress(p);
    if (Math.abs(e.currentTarget.scrollTop - scrollAtPointerDown.current) > 4) {
      didScrollRef.current = true;
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    scrollAtPointerDown.current = (e.currentTarget as HTMLDivElement).scrollTop;
    didScrollRef.current = false;
  }

  function onCaptureClick() {
    if (didScrollRef.current) return;
    const activeTicket = tickets[Math.round(progress)];
    if (activeTicket) onOpen(activeTicket);
  }

  return (
    <div className="relative" style={{ height: containerH }}>
      {/* Transparent scroll-capture div — sits on top, invisible, drives animation */}
      <div
        ref={captureRef}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onClick={onCaptureClick}
        className="absolute inset-0 z-20 cursor-pointer overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div style={{ height: scrollableH }} />
      </div>

      {/* Cards layer */}
      <div className="pointer-events-none absolute inset-0">
        {tickets.map((ticket, i) => {
          const offset = i - progress; // 0=active, +ve=below, -ve=gone above

          let y: number;
          let scale: number;
          let opacity: number;
          let zIndex: number;
          let blur = 0;

          if (offset <= 0) {
            const t = Math.max(-1, offset);
            y       = t * (cardH + 70);
            scale   = 1 + t * 0.04;
            opacity = offset < -0.05 ? Math.max(0, 1 + offset * 5) : 1;
            zIndex  = 10;
          } else if (offset < 1) {
            y       = offset * (cardH - PEEK);
            scale   = 1 - offset * 0.04;
            opacity = 1;
            zIndex  = 9;
          } else {
            const depth = Math.min(offset, MAX_PEEKING + 1);
            y       = (cardH - PEEK) + (depth - 1) * STACK_GAP;
            scale   = 1 - depth * 0.04;
            opacity = depth > MAX_PEEKING ? 0 : 1 - (depth - 1) * 0.1;
            zIndex  = Math.max(1, 8 - Math.floor(offset));
            blur    = (depth - 1) * 0.6;
          }

          return (
            <div
              key={ticket.id}
              ref={i === 0 ? firstCardRef : undefined}
              style={{
                position:        "absolute",
                inset:           "0 0 auto 0",
                transform:       `translateY(${y}px) scale(${Math.max(0.84, Math.min(1, scale))})`,
                opacity:         Math.max(0, Math.min(1, opacity)),
                zIndex,
                filter:          blur > 0 ? `blur(${blur}px)` : undefined,
                transformOrigin: "top center",
                willChange:      "transform, opacity",
              }}
            >
              <TicketCard ticket={ticket} />
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ── TicketCard ─────────────────────────────────────────────────────────────────

function TicketCard({ ticket }: { ticket: PlanTicket }) {
  const gradient = ticket.cover_color ?? getTicketColor(ticket.type, ticket.id);
  const textCls  = TICKET_TEXT[ticket.type];
  const mutedCls = TICKET_MUTED[ticket.type];
  const hasQr    = !!(ticket.qr_image_url || ticket.barcode_value);
  const routeType = isRouteType(ticket.type);

  const metaParts = [
    ticket.gate_label && `Gate ${ticket.gate_label}`,
    ticket.seat_label && `Seat ${ticket.seat_label}`,
    ticket.booking_code,
  ].filter(Boolean);

  return (
    <article
      className="relative overflow-hidden rounded-[22px] shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
      style={{ background: gradient }}
    >
      <div className="absolute inset-y-0 right-[170px] hidden w-px border-r border-dashed border-white/20 md:block" />
      <div className="absolute -right-4 top-1/2 hidden size-8 -translate-y-1/2 rounded-full bg-app md:block" />
      <div className="absolute right-[154px] top-1/2 hidden size-8 -translate-y-1/2 rounded-full bg-app md:block" />

      <div className="flex flex-col md:flex-row md:items-stretch">
        <div className="flex-1 p-5 md:px-6 md:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className={`inline-flex items-center gap-2 rounded-full border border-white/18 px-2.5 py-1 text-[11px] font-[var(--fw-semibold)] tracking-[0.14em] ${mutedCls}`}>
              <TicketTypeIcon type={ticket.type} className="size-[13px]" />
              <span>{TICKET_TYPE_LABELS[ticket.type].toUpperCase()}</span>
            </div>

            {ticket.shared_by_nombre && (
              <div className={`shrink-0 rounded-full border border-white/18 px-3 py-1.5 text-caption font-[var(--fw-semibold)] ${textCls}`}>
                de {ticket.shared_by_nombre}
              </div>
            )}
          </div>

          {routeType ? (
            <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_auto_0.95fr] md:items-center">
              <div>
                <p className={`text-[12px] font-[var(--fw-semibold)] tracking-[0.14em] ${mutedCls}`}>FROM</p>
                <h2 className={`mt-1 text-[40px] leading-none font-[var(--fw-semibold)] tracking-[-0.05em] ${textCls}`}>
                  {ticket.from_label ?? "—"}
                </h2>
              </div>
              <div className="flex items-center justify-center">
                <TicketTypeIcon type={ticket.type} className={`size-[26px] ${textCls}`} />
              </div>
              <div className="md:text-right">
                <p className={`text-[12px] font-[var(--fw-semibold)] tracking-[0.14em] ${mutedCls}`}>TO</p>
                <h2 className={`mt-1 text-[40px] leading-none font-[var(--fw-semibold)] tracking-[-0.05em] ${textCls}`}>
                  {ticket.to_label ?? "—"}
                </h2>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <p className={`text-[12px] font-[var(--fw-semibold)] tracking-[0.14em] ${mutedCls}`}>EVENTO</p>
              <h2 className={`mt-1 text-[32px] leading-none font-[var(--fw-semibold)] tracking-[-0.04em] ${textCls}`}>
                {ticket.title}
              </h2>
              {ticket.place_label && (
                <p className={`mt-1 text-body-sm ${mutedCls}`}>{ticket.place_label}</p>
              )}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniField label="SALIDA"      value={fmtDate(ticket.starts_at)} textClass={textCls} mutedClass={mutedCls} />
            <MiniField label="LOCALIZADOR" value={ticket.booking_code ?? "—"} textClass={textCls} mutedClass={mutedCls} />
            <MiniField label="DETALLE"     value={metaParts.slice(0, 2).join(" · ") || "—"} textClass={textCls} mutedClass={mutedCls} />
            <MiniField label="ESTADO"      value={statusLabel(ticket.status)} textClass={textCls} mutedClass={mutedCls} />
          </div>
        </div>

        <div className="border-t border-white/15 p-5 md:w-[170px] md:border-t-0 md:p-5">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className={`text-[11px] font-[var(--fw-semibold)] tracking-[0.14em] ${mutedCls}`}>
                {routeType ? "BOARDING" : "ACCESO"}
              </p>
              <p className={`mt-2 text-[18px] font-[var(--fw-semibold)] leading-tight ${textCls}`}>
                {routeType ? (ticket.from_label ?? ticket.title) : ticket.title}
              </p>
              <p className={`mt-1 text-body-sm ${mutedCls}`}>{fmtDate(ticket.starts_at)}</p>
            </div>

            {hasQr ? (
              <div className="mt-5 self-start rounded-[16px] bg-white p-2.5">
                <QrStamp />
              </div>
            ) : (
              <div className={`mt-5 text-body-sm font-[var(--fw-semibold)] ${textCls}`}>
                Sin QR
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 left-12 size-24 rounded-full bg-black/10 blur-2xl" />
    </article>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

// ── TicketSourceViewer ────────────────────────────────────────────────────────

function TicketSourceViewer({ ticket, onClose }: { ticket: PlanTicket; onClose: () => void }) {
  const [url, setUrl]         = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [resolvedSourcePath, setResolvedSourcePath] = useState<string | null>(null);

  const sourcePath = ticket.source_image_url ?? ticket.source_pdf_url ?? null;
  const isPdf      = !!ticket.source_pdf_url && !ticket.source_image_url;
  const loading    = !!sourcePath && resolvedSourcePath !== sourcePath && !error;

  useEffect(() => {
    if (!sourcePath) return;
    let cancelled = false;
    getTicketSourceSignedUrl(sourcePath)
      .then((nextUrl) => {
        if (cancelled) return;
        setUrl(nextUrl);
        setError(null);
        setResolvedSourcePath(sourcePath);
      })
      .catch(() => {
        if (cancelled) return;
        setUrl(null);
        setError("No se pudo cargar la imagen original.");
        setResolvedSourcePath(sourcePath);
      });
    return () => {
      cancelled = true;
    };
  }, [sourcePath]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex shrink-0 items-center justify-between px-5 py-4"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <p className="text-body-sm font-[var(--fw-semibold)] text-white">{ticket.title}</p>
          {ticket.booking_code && (
            <p className="text-caption text-white/60">{ticket.booking_code}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <CloseX />
        </button>
      </div>

      {/* Content */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-4"
        onClick={e => e.stopPropagation()}
      >
        {!sourcePath && (
          <div className="text-center">
            <p className="text-body-sm text-white/60">Este ticket no tiene imagen original guardada.</p>
            <p className="mt-1 text-caption text-white/40">Sube el boarding pass al crear el ticket para verlo aquí.</p>
          </div>
        )}
        {sourcePath && loading && (
          <p className="text-body-sm text-white/60">Cargando...</p>
        )}
        {sourcePath && error && (
          <p className="text-body-sm text-red-400">{error}</p>
        )}
        {url && !isPdf && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Ticket original"
            className="max-h-full max-w-full rounded-[16px] object-contain shadow-2xl"
          />
        )}
        {url && isPdf && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-body-sm text-white/70">Este ticket es un PDF.</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white px-6 py-3 text-body-sm font-[var(--fw-semibold)] text-black transition-opacity hover:opacity-90"
            >
              Abrir PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function WalletEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={<TicketTypeIcon type="other" className="size-7 text-muted" />}
      title="Sin tickets todavía"
      description="Añade tu primera entrada, billete o reserva."
      actionLabel="Añadir ticket"
      onAction={onAdd}
      className="mt-16"
    />
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function MiniField({ label, value, textClass, mutedClass }: {
  label: string; value: string; textClass: string; mutedClass: string;
}) {
  return (
    <div>
      <p className={`text-[11px] font-[var(--fw-semibold)] tracking-[0.14em] ${mutedClass}`}>{label}</p>
      <p className={`mt-1 text-body-sm font-[var(--fw-semibold)] ${textClass}`}>{value}</p>
    </div>
  );
}

export function TicketTypeIcon({ type, className = "size-[14px]" }: { type: TicketType; className?: string }) {
  if (type === "flight") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M3 13.5L21 6.5L14.5 21L11.5 14.5L5 11.5L3 13.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "ferry") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M4 16.5L12 20L20 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 14.5V6.5H17V14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 14.5H19L17 17H7L5 14.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "train") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <rect x="5" y="4" width="14" height="16" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 14H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8.5" cy="18" r="1" fill="currentColor" />
        <circle cx="15.5" cy="18" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (type === "concert") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M7 6.5V17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17 6.5V17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 8.5C9 8.5 9.5 6.5 12 6.5C14.5 6.5 15 8.5 17 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 15.5C9 15.5 9.5 13.5 12 13.5C14.5 13.5 15 15.5 17 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "match") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 4V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "hotel") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M3 20V8L12 4L21 8V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="9" y="14" width="6" height="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 10H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M5 6.5H19V17.5H5V6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9.5H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 13.5H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function QrStamp() {
  const cells = ["111010", "100110", "101001", "111101", "001011", "110101"];
  return (
    <div className="grid grid-cols-6 gap-[2px]">
      {cells.flatMap((row, ri) =>
        row.split("").map((cell, ci) => (
          <span
            key={`${ri}-${ci}`}
            className={`block size-[6px] rounded-[1px] ${cell === "1" ? "bg-black" : "bg-black/15"}`}
          />
        )),
      )}
    </div>
  );
}
