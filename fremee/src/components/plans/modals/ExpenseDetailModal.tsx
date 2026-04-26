"use client";

import { formatMoney, formatLongDate } from "@/lib/formatters";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EstadoLiquidacion = "PENDIENTE" | "EN_REVISION" | "CONFIRMADA" | "ANULADA";

export type ExpenseItem = {
  id: number;
  amount: number;
  date: string;
  direction: "outgoing" | "incoming";
  counterparty: string;
  counterpartyId: string;
  counterpartyImage: string | null;
  planName: string;
  planId: number;
  concept: string | null;
  estado: EstadoLiquidacion;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatAmount = formatMoney;
const formatDetailDate = formatLongDate;

export function getExpenseStatusMeta(item: ExpenseItem) {
  if (item.direction === "incoming" && item.estado === "EN_REVISION") {
    return {
      text: "Por confirmar",
      toneClass: "border-[var(--info)]/30 bg-[var(--info)]/10 text-[var(--info)]",
      inlineTextClass: "text-[var(--info,#2563eb)]",
      description: "Has recibido un pago y debes validarlo.",
    };
  }

  if (item.direction === "outgoing" && item.estado === "EN_REVISION") {
    return {
      text: "Confirmación pendiente",
      toneClass: "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]",
      inlineTextClass: "text-[var(--warning,#d97706)]",
      description: "Ya has pagado y estás esperando confirmación.",
    };
  }

  if (item.direction === "incoming" && item.estado === "PENDIENTE") {
    return {
      text: "Te deben",
      toneClass: "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]",
      inlineTextClass: "text-[var(--success,#15803d)]",
      description: "Todavía no has recibido este pago.",
    };
  }

  if (item.direction === "outgoing" && item.estado === "PENDIENTE") {
    return {
      text: "Debes",
      toneClass: "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]",
      inlineTextClass: "text-[var(--warning,#d97706)]",
      description: "Todavía no has completado este pago.",
    };
  }

  if (item.estado === "CONFIRMADA") {
    return {
      text: "Confirmado",
      toneClass: "border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]",
      inlineTextClass: "text-[var(--success,#15803d)]",
      description: "Operación confirmada correctamente.",
    };
  }

  return {
    text: "Anulada",
    toneClass: "border-app bg-surface text-muted",
    inlineTextClass: "text-muted",
    description: "Operación anulada.",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-[var(--space-2)]">
      <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="mt-[4px] text-body-sm font-[var(--fw-semibold)] text-app">{value}</p>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ExpenseDetailModalProps {
  item: ExpenseItem | null;
  profileName: string;
  actingId: number | null;
  onClose: () => void;
  onOpenPlan: (planId: number) => void;
  onConfirm: (item: ExpenseItem) => void;
  onReject: (item: ExpenseItem) => void;
}

export function ExpenseDetailModal({
  item,
  profileName,
  actingId,
  onClose,
  onOpenPlan,
  onConfirm,
  onReject,
}: ExpenseDetailModalProps) {
  if (!item) return null;

  const incoming = item.direction === "incoming";
  const otherPartyLabel = incoming ? item.counterparty : `${profileName} (Tú)`;
  const statusMeta = getExpenseStatusMeta(item);
  const requiresValidation = incoming && item.estado === "EN_REVISION";

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50 px-[var(--space-4)] py-[var(--space-6)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-[18px] border border-app bg-app shadow-elev-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-[var(--space-4)] border-b border-app px-[var(--space-5)] py-[var(--space-4)]">
          <div className="min-w-0">
            <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
              {item.planName}
            </p>
            <h2 className="mt-[6px] text-[var(--font-h3)] font-[var(--fw-bold)] leading-[1.15] text-app">
              {incoming
                ? item.estado === "CONFIRMADA"
                  ? "Pago recibido"
                  : item.estado === "EN_REVISION"
                  ? "Pago por confirmar"
                  : "Pago pendiente"
                : item.estado === "CONFIRMADA"
                  ? "Pago realizado"
                  : item.estado === "EN_REVISION"
                  ? "Pago enviado"
                  : "Pago pendiente"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface"
            aria-label="Cerrar detalle"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-[var(--space-4)] px-[var(--space-5)] py-[var(--space-5)]">
          <div className="flex items-start justify-between gap-[var(--space-4)]">
            <div>
              <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                Importe
              </p>
              <p className={`mt-[6px] text-[32px] font-[var(--fw-bold)] leading-none ${incoming ? "text-[var(--success,#15803d)]" : "text-[var(--warning,#b45309)]"}`}>
                {incoming ? "+" : "-"}{formatAmount(item.amount)}
              </p>
            </div>
            <span className={`inline-flex rounded-full border px-[var(--space-3)] py-[6px] text-body-sm font-[var(--fw-semibold)] ${statusMeta.toneClass}`}>
              {statusMeta.text}
            </span>
          </div>

          <p className="text-body-sm text-muted">
            {statusMeta.description}
          </p>

          <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
            <DetailCard label="Persona" value={otherPartyLabel} />
            <DetailCard label="Fecha" value={formatDetailDate(item.date)} />
            <DetailCard label="Plan" value={item.planName} />
            <DetailCard label="Concepto" value={item.concept?.trim() || "Sin concepto"} />
          </div>
        </div>

        <div className="flex flex-col gap-[var(--space-2)] border-t border-app px-[var(--space-5)] py-[var(--space-4)]">
          {requiresValidation && (
            <div className="flex gap-[var(--space-2)]">
              <button
                type="button"
                disabled={actingId === item.id}
                onClick={() => onReject(item)}
                className="flex-1 rounded-full border border-app py-[12px] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface disabled:opacity-50"
              >
                No recibido
              </button>
              <button
                type="button"
                disabled={actingId === item.id}
                onClick={() => onConfirm(item)}
                className="flex-1 rounded-full bg-[var(--success)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-white transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {actingId === item.id ? "Confirmando..." : "Confirmar pago"}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => onOpenPlan(item.planId)}
            className="w-full rounded-full bg-[var(--text-primary)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-85"
          >
            Ir al plan
          </button>
        </div>
      </div>
    </div>
  );
}
