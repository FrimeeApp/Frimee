"use client";

import { useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock3, Share2, XCircle, type LucideIcon } from "lucide-react";
import { formatMoney, formatLongDateTime } from "@/lib/formatters";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { Avatar } from "@/components/ui/Avatar";
import { CloseButton, IconButton } from "@/components/ui/IconButton";

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
const formatDetailDate = formatLongDateTime;

export function getExpenseStatusMeta(item: ExpenseItem) {
  if (item.direction === "incoming" && item.estado === "CONFIRMADA") {
    return {
      text: "Pago recibido",
      toneClass: "border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]",
      inlineTextClass: "text-[var(--success,#15803d)]",
      iconClass: "bg-[var(--success)]/10 text-[var(--success)]",
      Icon: ArrowDownLeft,
      description: "Operación confirmada correctamente.",
    };
  }

  if (item.direction === "outgoing" && item.estado === "CONFIRMADA") {
    return {
      text: "Pago realizado",
      toneClass: "border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]",
      inlineTextClass: "text-[var(--success,#15803d)]",
      iconClass: "bg-[var(--success)]/10 text-[var(--success)]",
      Icon: ArrowUpRight,
      description: "Operación confirmada correctamente.",
    };
  }

  if (item.direction === "incoming" && item.estado === "EN_REVISION") {
    return {
      text: "Por confirmar",
      toneClass: "border-[var(--info)]/30 bg-[var(--info)]/10 text-[var(--info)]",
      inlineTextClass: "text-[var(--info,#2563eb)]",
      iconClass: "bg-[var(--info)]/10 text-[var(--info)]",
      Icon: Clock3,
      description: "Has recibido un pago y debes validarlo.",
    };
  }

  if (item.direction === "outgoing" && item.estado === "EN_REVISION") {
    return {
      text: "Confirmación pendiente",
      toneClass: "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]",
      inlineTextClass: "text-[var(--warning,#d97706)]",
      iconClass: "bg-[var(--warning)]/10 text-[var(--warning)]",
      Icon: Clock3,
      description: "Ya has pagado y estás esperando confirmación.",
    };
  }

  if (item.direction === "incoming" && item.estado === "PENDIENTE") {
    return {
      text: "Te deben",
      toneClass: "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]",
      inlineTextClass: "text-[var(--success,#15803d)]",
      iconClass: "bg-[var(--success)]/10 text-[var(--success)]",
      Icon: ArrowDownLeft,
      description: "Todavía no has recibido este pago.",
    };
  }

  if (item.direction === "outgoing" && item.estado === "PENDIENTE") {
    return {
      text: "Debes",
      toneClass: "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]",
      inlineTextClass: "text-[var(--warning,#d97706)]",
      iconClass: "bg-[var(--warning)]/10 text-[var(--warning)]",
      Icon: ArrowUpRight,
      description: "Todavía no has completado este pago.",
    };
  }

  if (item.estado === "CONFIRMADA") {
    return {
      text: "Confirmado",
      toneClass: "border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]",
      inlineTextClass: "text-[var(--success,#15803d)]",
      iconClass: "bg-[var(--success)]/10 text-[var(--success)]",
      Icon: CheckCircle2,
      description: "Operación confirmada correctamente.",
    };
  }

  return {
    text: "Anulada",
    toneClass: "border-app bg-surface text-muted",
    inlineTextClass: "text-muted",
    iconClass: "bg-surface text-muted",
    Icon: XCircle,
    description: "Operación anulada.",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConceptRow({ value }: { value: string }) {
  return (
    <div className="w-full text-left">
      <p className="text-caption text-muted">Concepto</p>
      <p className="mt-[4px] text-body-sm font-[var(--fw-semibold)] text-app">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-full text-left">
      <p className="text-caption text-muted">{label}</p>
      <p className="mt-[4px] text-body-sm font-[var(--fw-semibold)] text-app">{value}</p>
    </div>
  );
}

function PlanRow({ value, onClick }: { value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start justify-between gap-[var(--space-4)] text-left transition-opacity hover:opacity-70"
    >
      <span className="min-w-0">
        <span className="block text-caption text-muted">Plan</span>
        <span className="mt-[4px] block truncate text-body-sm font-[var(--fw-semibold)] text-app">
          {value}
        </span>
      </span>
      <ArrowUpRight className="mt-[17px] size-[22px] shrink-0 text-muted" strokeWidth={1.8} aria-hidden />
    </button>
  );
}

function MovementIcon({ Icon, className }: { Icon: LucideIcon; className: string }) {
  return (
    <div className={`flex size-12 items-center justify-center rounded-full ${className}`}>
      <Icon className="size-5" strokeWidth={1.9} aria-hidden />
    </div>
  );
}

function CounterpartyLine({ name, image }: { name: string; image: string | null }) {
  return (
    <div className="mt-[var(--space-3)] flex max-w-full items-center justify-center gap-[var(--space-2)]">
      <Avatar name={name} src={image} px={32} topMargin="" />
      <p className="min-w-0 truncate text-body-sm font-[var(--fw-semibold)] leading-tight text-app">
        {name}
      </p>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

type ExpenseDetailModalProps = {
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
  const { isClosing, requestClose } = useModalCloseAnimation(onClose, true, {
    closeAnimationMs: 240,
    lockScroll: false,
  });
  useEffect(() => {
    if (!item) return;

    const previousOverflow = document.body.style.overflow;

    document.body.setAttribute("data-expense-detail-open", "true");
    document.body.style.overflow = "hidden";

    return () => {
      document.body.removeAttribute("data-expense-detail-open");
      document.body.style.overflow = previousOverflow;
    };
  }, [item]);

  if (!item) return null;

  const incoming = item.direction === "incoming";
  const otherPartyLabel = item.counterparty || profileName || "Usuario";
  const statusMeta = getExpenseStatusMeta(item);
  const StatusIcon = statusMeta.Icon;
  const requiresValidation = incoming && item.estado === "EN_REVISION";
  const isResolved = item.estado === "CONFIRMADA";
  const signedAmount = `${incoming ? "+" : "-"}${formatAmount(item.amount)}`;
  const concept = item.concept?.trim() || item.planName;
  const pendingMessage = incoming ? "Todavía te deben" : "Todavía debes";
  const resolvedMessage = incoming ? "Te han pagado" : "Has pagado";

  const handleShare = async () => {
    const text = `${statusMeta.text}: ${signedAmount} con ${otherPartyLabel} · ${concept}`;
    const appNavigator = typeof window !== "undefined" ? window.navigator : null;
    const clipboard = appNavigator?.clipboard;

    if (appNavigator && "share" in appNavigator) {
      try {
        await appNavigator.share({ title: "Detalle del pago", text });
        return;
      } catch {
        return;
      }
    }

    if (clipboard) {
      await clipboard.writeText(text);
    }
  };

  return (
    <div
      data-closing={isClosing ? "true" : "false"}
      className="app-modal-overlay app-mobile-sheet-overlay fixed inset-0 z-[var(--z-modal)] flex items-end justify-center px-0 md:items-center md:px-[var(--space-4)] md:py-[var(--space-6)]"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        data-closing={isClosing ? "true" : "false"}
        className="app-expense-detail-panel app-mobile-sheet-panel flex h-[70dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[var(--bg)] shadow-elev-4 md:h-auto md:max-w-[540px] md:rounded-[24px]"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pt-[8px]" aria-hidden="true">
          <div className="h-[4px] w-10 rounded-full bg-[var(--border)]" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-[var(--space-5)] pb-[var(--space-2)] pt-[var(--space-2)]">
          <IconButton onClick={handleShare} aria-label="Compartir detalle">
            <Share2 className="size-5" strokeWidth={1.8} aria-hidden />
          </IconButton>
          <CloseButton onClick={requestClose} label="Cerrar detalle" iconClassName="size-5" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center px-[var(--space-6)] pb-[var(--space-4)] text-center">
          <MovementIcon Icon={StatusIcon} className={statusMeta.iconClass} />
          <CounterpartyLine name={otherPartyLabel} image={item.counterpartyImage} />
          <p className="mt-[var(--space-2)] text-caption text-muted">
            {isResolved ? resolvedMessage : pendingMessage}
          </p>
          <p className={`mt-[var(--space-2)] text-[26px] font-[var(--fw-bold)] leading-none text-app ${isResolved ? "" : "opacity-55"}`}>
            {signedAmount}
          </p>
          {isResolved && (
            <p className="mt-[var(--space-2)] text-caption text-muted">
              {formatDetailDate(item.date)}
            </p>
          )}

          <div className="w-full space-y-[var(--space-4)] pt-[var(--space-8)] pb-[calc(var(--space-10)+env(safe-area-inset-bottom))]">
            <ConceptRow value={concept} />
            {!isResolved && <DetailRow label="Creado" value={formatDetailDate(item.date)} />}
            <PlanRow value={item.planName} onClick={() => onOpenPlan(item.planId)} />
          </div>
        </div>

        {requiresValidation && (
          <div className="flex shrink-0 flex-col gap-[var(--space-2)] border-t border-app px-[var(--space-5)] pb-[calc(var(--space-4)+env(safe-area-inset-bottom))] pt-[var(--space-4)] md:pb-[var(--space-4)]">
            <div className="flex gap-[var(--space-2)]">
              <button
                type="button"
                disabled={actingId === item.id}
                onClick={() => onReject(item)}
                className="flex-1 rounded-[14px] border border-app py-[12px] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface disabled:opacity-50"
              >
                No recibido
              </button>
              <button
                type="button"
                disabled={actingId === item.id}
                onClick={() => onConfirm(item)}
                className="flex-1 rounded-[14px] bg-[var(--success)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-white transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {actingId === item.id ? "Confirmando..." : "Confirmar pago"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
