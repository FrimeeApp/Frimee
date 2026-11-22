"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, Clock3, Share2, XCircle } from "lucide-react";
import { formatMoney, formatLongDateTime } from "@/lib/formatters";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { DraggableBottomSheet } from "@/components/ui/DraggableBottomSheet";

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
  /** Cómo se pagó (lo elige quien paga); null si no lo dijo. */
  metodo?: "BIZUM" | "TRANSFERENCIA" | "EFECTIVO" | "OTRO" | "STRIPE" | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatAmount = formatMoney;
const formatDetailDate = formatLongDateTime;
const SERIF_STYLE = { fontFamily: "var(--font-display-face), Instrument Serif, Georgia, serif", fontWeight: 400, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" } as const;

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

// ── Modal ─────────────────────────────────────────────────────────────────────

type ExpenseDetailModalProps = {
  item: ExpenseItem | null;
  profileName: string;
  actingId: number | null;
  onClose: () => void;
  onOpenPlan: (planId: number) => void;
  onPay: (item: ExpenseItem) => void;
  onConfirm: (item: ExpenseItem) => void;
  onReject: (item: ExpenseItem) => void;
}

export function ExpenseDetailModal({
  item,
  profileName,
  actingId,
  onClose,
  onOpenPlan,
  onPay,
  onConfirm,
  onReject,
}: ExpenseDetailModalProps) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose, true, {
    closeAnimationMs: 240,
    lockScroll: false,
  });
  const overlayResetTimeoutRef = useRef<number | null>(null);
  const [overlayDragState, setOverlayDragState] = useState({
    itemId: null as number | null,
    progress: 0,
    dragging: false,
  });
  const [overlayEntered, setOverlayEntered] = useState(false);

  const requestDetailClose = () => {
    requestClose();

    if (overlayResetTimeoutRef.current !== null) {
      window.clearTimeout(overlayResetTimeoutRef.current);
    }

    overlayResetTimeoutRef.current = window.setTimeout(() => {
      overlayResetTimeoutRef.current = null;
      setOverlayDragState({ itemId: null, progress: 0, dragging: false });
      setOverlayEntered(false);
    }, 260);
  };

  useEffect(() => {
    if (!item) return;

    const frameId = window.requestAnimationFrame(() => setOverlayEntered(true));
    const previousOverflow = document.body.style.overflow;

    document.body.setAttribute("data-expense-detail-open", "true");
    document.body.style.overflow = "hidden";

    return () => {
      document.body.removeAttribute("data-expense-detail-open");
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frameId);
    };
  }, [item]);

  useEffect(() => {
    return () => {
      if (overlayResetTimeoutRef.current !== null) {
        window.clearTimeout(overlayResetTimeoutRef.current);
      }
    };
  }, []);

  if (!item) return null;

  const incoming = item.direction === "incoming";
  const other = { name: item.counterparty || "Usuario", image: item.counterpartyImage };
  const me: { name: string; image: string | null } = { name: profileName || "Tú", image: null };
  const payer = incoming ? other : me;
  const payee = incoming ? me : other;
  const statusMeta = getExpenseStatusMeta(item);
  const requiresValidation = incoming && item.estado === "EN_REVISION";
  const mustPay = !incoming && item.estado === "PENDIENTE";
  const resolved = item.estado === "CONFIRMADA";
  const signedAmount = `${incoming ? "+" : "\u2212"}${formatAmount(item.amount)}`;
  const concept = item.concept?.trim() || item.planName;
  const title = incoming
    ? item.estado === "EN_REVISION"
      ? <><b>{other.name}</b> te ha pagado</>
      : resolved
        ? <><b>{other.name}</b> te pagó</>
        : <><b>{other.name}</b> te debe</>
    : resolved || item.estado === "EN_REVISION"
      ? <>Pagaste a <b>{other.name}</b></>
      : <>Debes a <b>{other.name}</b></>;
  const marked = item.estado === "EN_REVISION" || resolved;
  const steps: { text: string; when?: string; done: boolean }[] = [
    { text: "Calculado al repartir los gastos", when: formatDetailDate(item.date), done: true },
  ];
  if (marked) steps.push({ text: incoming ? `${other.name} lo marcó como pagado` : "Lo marcaste como pagado", done: true });
  if (item.estado === "EN_REVISION") {
    steps.push({ text: incoming ? "Falta que lo confirmes" : `Falta que ${other.name} lo confirme`, done: false });
  } else if (resolved) {
    steps.push({ text: "Pago confirmado", done: true });
  }
  const overlayDragProgress = overlayDragState.itemId === item.id ? overlayDragState.progress : 0;
  const overlayDragging = overlayDragState.itemId === item.id ? overlayDragState.dragging : false;
  const overlayOpacity = isClosing
    ? 0
    : !overlayEntered
      ? 0
    : Math.max(0.12, 1 - overlayDragProgress * 1.25);

  const handleShare = async () => {
    const text = `${statusMeta.text}: ${signedAmount} con ${other.name} · ${concept}`;
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
      style={{
        animation: "none",
        backgroundColor: "transparent",
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          requestDetailClose();
        }
      }}
    >
      <div
        className="absolute inset-0 bg-black"
        style={{
          opacity: overlayOpacity * 0.55,
          transition: overlayDragging ? "none" : "opacity 240ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          requestDetailClose();
        }}
        aria-hidden="true"
      />
      <DraggableBottomSheet
        isClosing={isClosing}
        onDismiss={requestDetailClose}
        handleLabel="Arrastrar detalle del gasto"
        handleClassName="md:hidden"
        onDragProgress={(progress, dragging) => {
          setOverlayDragState({ itemId: item.id, progress, dragging });
        }}
        className="app-expense-detail-panel app-mobile-sheet-panel relative z-10 flex h-[70dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[var(--bg)] shadow-elev-4 md:h-auto md:max-w-[480px] md:rounded-[24px]"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute left-[var(--space-5)] top-[var(--space-5)] z-10">
          <IconButton onClick={handleShare} aria-label="Compartir detalle">
            <Share2 className="size-5" strokeWidth={1.8} aria-hidden />
          </IconButton>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[var(--space-6)] pb-[var(--space-4)] pt-[var(--space-8)]">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2">
              <Avatar name={payer.name} src={payer.image} px={40} topMargin="" />
              <ArrowRight className="size-4 text-muted" aria-hidden />
              <Avatar name={payee.name} src={payee.image} px={40} topMargin="" />
            </div>
            <p className="mt-[var(--space-3)] text-body-sm text-app [&_b]:font-[var(--fw-semibold)]">{title}</p>
            <p className="mt-[var(--space-2)] text-[44px] leading-none text-app" style={SERIF_STYLE}>
              {signedAmount}
            </p>
          </div>

          <ol className="mt-[var(--space-8)] space-y-[var(--space-4)]">
            {steps.map((step) => (
              <li key={step.text} className="flex items-start gap-3">
                <span
                  className={`mt-[2px] flex size-5 shrink-0 items-center justify-center rounded-full ${
                    step.done ? "bg-[var(--chat-tint)] text-[var(--chat-accent-text)]" : "border border-dashed border-[var(--border-strong)] text-muted"
                  }`}
                >
                  {step.done ? <Check className="size-3" strokeWidth={2.5} aria-hidden /> : <Clock3 className="size-3" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-body-sm ${step.done ? "text-app" : "font-[var(--fw-semibold)] text-app"}`}>{step.text}</p>
                  {step.when && <p className="text-caption text-muted">{step.when}</p>}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-[var(--space-6)] space-y-[var(--space-4)] pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]">
            {item.concept?.trim() && <ConceptRow value={item.concept.trim()} />}
            <PlanRow value={item.planName} onClick={() => onOpenPlan(item.planId)} />
          </div>
        </div>

        {(requiresValidation || mustPay) && (
          <div className="flex shrink-0 flex-col gap-[var(--space-2)] border-t border-app px-[var(--space-5)] pb-[calc(var(--space-4)+env(safe-area-inset-bottom))] pt-[var(--space-4)] md:pb-[var(--space-4)]">
            {requiresValidation ? (
              <div className="flex gap-[var(--space-2)]">
                <button
                  type="button"
                  disabled={actingId === item.id}
                  onClick={() => onReject(item)}
                  className="h-[46px] flex-1 rounded-lg border border-[var(--border-strong)] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface disabled:opacity-50"
                >
                  No recibido
                </button>
                <button
                  type="button"
                  disabled={actingId === item.id}
                  onClick={() => onConfirm(item)}
                  className="h-[46px] flex-1 rounded-lg bg-[var(--success)] text-body-sm font-[var(--fw-semibold)] text-[var(--success-contrast)] transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                  {actingId === item.id ? "Confirmando…" : "Confirmar"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onPay(item)}
                className="h-[46px] w-full rounded-lg bg-[var(--primary)] text-body-sm font-[var(--fw-semibold)] text-[var(--contrast)] transition-opacity hover:opacity-85"
              >
                Pagar
              </button>
            )}
          </div>
        )}
      </DraggableBottomSheet>
    </div>
  );
}
