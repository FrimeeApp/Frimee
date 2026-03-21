"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import {
  listLiquidacionesForUserEndpoint,
  requestConfirmationEndpoint,
  confirmReceiptEndpoint,
  rejectReceiptEndpoint,
} from "@/services/api/endpoints/liquidaciones.endpoint";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return isMobile;
}

type ExpenseTab = "paid" | "pending";
type EstadoLiquidacion = "PENDIENTE" | "EN_REVISION" | "CONFIRMADA" | "ANULADA";

type ExpenseItem = {
  id: number;
  amount: number;
  date: string;
  direction: "outgoing" | "incoming";
  counterparty: string;
  counterpartyId: string;
  planName: string;
  planId: number;
  concept: string | null;
  estado: EstadoLiquidacion;
};

function formatAmount(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MisGastosPage() {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return (
    <Suspense>
      <MisGastosContent />
    </Suspense>
  );
}

function MisGastosContent() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<ExpenseTab>("pending");
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const paidTabRef = useRef<HTMLButtonElement | null>(null);
  const pendingTabRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setDataLoading(true);
      try {
        const rows = await listLiquidacionesForUserEndpoint();
        setItems(
          rows.map((l) => ({
            id: l.id,
            amount: l.importe,
            date: l.fecha,
            direction: l.from_user_id === user.id ? "outgoing" : "incoming",
            counterparty: l.counterparty_nombre ?? "Usuario",
            counterpartyId: l.counterparty_id,
            planName: l.plan_titulo ?? `Plan ${l.plan_id}`,
            planId: l.plan_id,
            concept: l.nota,
            estado: l.estado,
          }))
        );
      } catch {
        setItems([]);
      } finally {
        setDataLoading(false);
      }
    };
    void load();
  }, [user]);

  useEffect(() => {
    const confirmadaId = searchParams.get("confirmada");
    if (!confirmadaId) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === Number(confirmadaId) ? { ...item, estado: "CONFIRMADA" } : item
      )
    );
    setActiveTab("paid");
    window.history.replaceState(null, "", "/mis-gastos");
  }, [searchParams]);

  const pendingItems = useMemo(
    () => items.filter((i) => i.estado === "PENDIENTE" || i.estado === "EN_REVISION"),
    [items]
  );

  const paidItems = useMemo(
    () => items.filter((i) => i.estado === "CONFIRMADA"),
    [items]
  );

  const visibleItems = activeTab === "paid" ? paidItems : pendingItems;

  // Badge: deudas propias sin pagar + pagos entrantes esperando que confirmes
  const actionRequiredCount = useMemo(
    () =>
      pendingItems.filter(
        (i) =>
          (i.direction === "outgoing" && i.estado === "PENDIENTE") ||
          (i.direction === "incoming" && i.estado === "EN_REVISION")
      ).length,
    [pendingItems]
  );

  const overduePendingDebts = useMemo(() => {
    if (activeTab !== "pending") return [];
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    return pendingItems.filter(
      (i) =>
        i.direction === "outgoing" &&
        i.estado === "PENDIENTE" &&
        Date.now() - new Date(i.date).getTime() > twoDaysMs
    );
  }, [activeTab, pendingItems]);

  useEffect(() => {
    const updateIndicator = () => {
      const row = tabRowRef.current;
      const target = activeTab === "paid" ? paidTabRef.current : pendingTabRef.current;
      if (!row || !target) return;
      const rowRect = row.getBoundingClientRect();
      const tabRect = target.getBoundingClientRect();
      setIndicator({ left: tabRect.left - rowRect.left, width: tabRect.width, ready: true });
    };
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeTab]);

  // Payer clicks "Marcar como pagado" → sends to EN_REVISION so payee can confirm
  const handleRequestConfirmation = async (item: ExpenseItem) => {
    setActingId(item.id);
    try {
      await requestConfirmationEndpoint(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, estado: "EN_REVISION" } : i)));
    } catch {
      alert("No se pudo enviar la solicitud. Inténtalo de nuevo.");
    } finally {
      setActingId(null);
    }
  };

  // Payee confirms receipt → CONFIRMADA
  const handleConfirmReceipt = async (item: ExpenseItem) => {
    setActingId(item.id);
    try {
      await confirmReceiptEndpoint(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, estado: "CONFIRMADA" } : i)));
      setActiveTab("paid");
    } catch {
      alert("No se pudo confirmar. Inténtalo de nuevo.");
    } finally {
      setActingId(null);
    }
  };

  // Payee rejects receipt → back to PENDIENTE
  const handleRejectReceipt = async (item: ExpenseItem) => {
    setActingId(item.id);
    try {
      await rejectReceiptEndpoint(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, estado: "PENDIENTE" } : i)));
    } catch {
      alert("No se pudo rechazar. Inténtalo de nuevo.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main
          className={`px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] md:py-[var(--space-8)] md:pr-[var(--space-14)]`}
        >
          <section className="mx-auto w-full max-w-[860px]">
            {/* Tabs */}
            <div
              ref={tabRowRef}
              className="relative mb-[var(--space-5)] flex gap-[var(--space-8)] border-b border-app text-body text-muted"
            >
              <button
                ref={paidTabRef}
                type="button"
                onClick={() => setActiveTab("paid")}
                className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                  activeTab === "paid" ? "text-app" : "hover:text-app"
                }`}
              >
                Pagados
              </button>
              <button
                ref={pendingTabRef}
                type="button"
                onClick={() => setActiveTab("pending")}
                className={`flex items-center gap-2 pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                  activeTab === "pending" ? "text-app" : "hover:text-app"
                }`}
              >
                Pendientes
                {actionRequiredCount > 0 && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--warning)] text-caption font-[var(--fw-semibold)] text-white">
                    {actionRequiredCount}
                  </span>
                )}
              </button>
              <span
                className={`pointer-events-none absolute bottom-0 h-[2px] bg-black transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] dark:bg-white ${
                  indicator.ready ? "opacity-100" : "opacity-0"
                }`}
                style={{ left: indicator.left, width: indicator.width }}
                aria-hidden="true"
              />
            </div>

            {activeTab === "pending" && overduePendingDebts.length > 0 && (
              <div className="mb-[var(--space-4)] rounded-card border border-app bg-surface px-[var(--space-3)] py-[var(--space-2)] text-body-sm text-muted">
                Recordatorio: tienes {overduePendingDebts.length} pago(s) pendiente(s) desde hace más de 2 días.
              </div>
            )}

            <div className="space-y-[var(--space-3)]">
              {dataLoading ? (
                <SkeletonList />
              ) : visibleItems.length === 0 ? (
                <EmptyState tab={activeTab} />
              ) : (
                visibleItems.map((item) => {
                  const incoming = item.direction === "incoming";
                  const isOverdue =
                    !incoming &&
                    item.estado === "PENDIENTE" &&
                    activeTab === "pending" &&
                    Date.now() - new Date(item.date).getTime() > 2 * 24 * 60 * 60 * 1000;

                  const relationText =
                    activeTab === "paid"
                      ? incoming
                        ? `Te pagó ${item.counterparty}`
                        : `Pagaste a ${item.counterparty}`
                      : incoming
                        ? `Te debe ${item.counterparty}`
                        : `Debes a ${item.counterparty}`;

                  const cardToneClass =
                    item.estado === "EN_REVISION" && incoming
                      ? "border-[color-mix(in_srgb,var(--info,#0099ff)_28%,var(--border)_72%)] bg-[color-mix(in_srgb,var(--info,#0099ff)_5%,var(--bg)_95%)]"
                      : isOverdue
                        ? "border-[color-mix(in_srgb,var(--error)_28%,var(--border)_72%)] bg-[color-mix(in_srgb,var(--error)_8%,var(--bg)_92%)]"
                        : "border-app bg-app";

                  return (
                    <article
                      key={item.id}
                      className={`rounded-card border p-[var(--space-4)] shadow-elev-1 ${cardToneClass}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <DirectionIcon incoming={incoming} enRevision={item.estado === "EN_REVISION"} />
                          <div>
                            <p className="text-body font-[var(--fw-semibold)]">{relationText}</p>
                            <p className="mt-1 text-body-sm text-muted">
                              Plan:{" "}
                              <span className="font-[var(--fw-medium)] text-app">
                                {item.planName}
                              </span>
                            </p>
                            {item.concept && (
                              <p className="mt-1 text-body-sm text-muted">{item.concept}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <p
                            className={`text-body font-[var(--fw-semibold)] ${
                              activeTab === "pending"
                                ? "text-muted"
                                : incoming
                                  ? "text-[#15803d]"
                                  : "text-[#b45309]"
                            }`}
                          >
                            {incoming ? "+" : "-"}
                            {formatAmount(item.amount)}
                          </p>
                          <p className="text-caption text-muted">{formatDate(item.date)}</p>

                          {/* Outgoing PENDIENTE: pay + mark as sent */}
                          {activeTab === "pending" && !incoming && item.estado === "PENDIENTE" && (
                            <PayActions
                              item={item}
                              isMobile={isMobile}
                              actingId={actingId}
                              onMarkAsSent={handleRequestConfirmation}
                            />
                          )}

                          {/* Outgoing EN_REVISION: waiting for payee */}
                          {activeTab === "pending" && !incoming && item.estado === "EN_REVISION" && (
                            <span className="mt-1 flex items-center gap-1.5 text-caption text-muted">
                              <svg viewBox="0 0 24 24" fill="none" className="size-3.5 animate-spin" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                              </svg>
                              Esperando confirmación
                            </span>
                          )}

                          {/* Incoming PENDIENTE: waiting for payer */}
                          {activeTab === "pending" && incoming && item.estado === "PENDIENTE" && (
                            <span className="mt-1 text-caption text-muted">
                              Esperando pago
                            </span>
                          )}

                          {/* Incoming EN_REVISION: payee must confirm or reject */}
                          {activeTab === "pending" && incoming && item.estado === "EN_REVISION" && (
                            <ConfirmReceiptActions
                              item={item}
                              actingId={actingId}
                              onConfirm={handleConfirmReceipt}
                              onReject={handleRejectReceipt}
                            />
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

// ── Pay actions (payer side) ──────────────────────────────────────────────────

function PayActions({
  item,
  isMobile,
  actingId,
  onMarkAsSent,
}: {
  item: ExpenseItem;
  isMobile: boolean;
  actingId: number | null;
  onMarkAsSent: (item: ExpenseItem) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `${item.concept ? item.concept + " — " : ""}${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(item.amount)} a ${item.counterparty}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-1 flex flex-col items-end gap-2">
      {isMobile ? (
        <a
          href="bizum://"
          className="flex items-center gap-1.5 rounded-card bg-[#0099ff] px-3 py-1.5 text-body-sm font-[var(--fw-semibold)] text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
          Pagar con Bizum
        </a>
      ) : (
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-card border border-app bg-surface px-3 py-1.5 text-body-sm font-[var(--fw-medium)] text-app transition-colors"
        >
          {copied ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" className="size-3.5 text-[var(--success)]" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              ¡Copiado!
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copiar datos del pago
            </>
          )}
        </button>
      )}
      <button
        type="button"
        disabled={actingId === item.id}
        onClick={() => onMarkAsSent(item)}
        className="text-caption text-muted underline underline-offset-2 disabled:opacity-50"
      >
        {actingId === item.id ? "Enviando…" : "Ya he pagado"}
      </button>
    </div>
  );
}

// ── Confirm receipt actions (payee side) ──────────────────────────────────────

function ConfirmReceiptActions({
  item,
  actingId,
  onConfirm,
  onReject,
}: {
  item: ExpenseItem;
  actingId: number | null;
  onConfirm: (item: ExpenseItem) => void;
  onReject: (item: ExpenseItem) => void;
}) {
  const isActing = actingId === item.id;
  return (
    <div className="mt-2 flex flex-col items-end gap-2">
      <p className="text-body-sm font-[var(--fw-medium)] text-app">
        ¿Te ha llegado el pago?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isActing}
          onClick={() => onReject(item)}
          className="rounded-card border border-app bg-surface px-3 py-1.5 text-body-sm font-[var(--fw-medium)] text-muted transition-colors disabled:opacity-50"
        >
          No recibido
        </button>
        <button
          type="button"
          disabled={isActing}
          onClick={() => onConfirm(item)}
          className="rounded-card bg-[var(--success,#16a34a)] px-3 py-1.5 text-body-sm font-[var(--fw-semibold)] text-white transition-opacity disabled:opacity-50"
        >
          {isActing ? "Confirmando…" : "Sí, confirmar"}
        </button>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: ExpenseTab }) {
  return (
    <div className="py-[var(--space-10)] text-center">
      <p className="text-body-sm text-muted">
        {tab === "paid"
          ? "Aún no tienes pagos confirmados."
          : "No tienes pagos pendientes. ¡Todo al día!"}
      </p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="space-y-[var(--space-3)]">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-card border border-app bg-surface" />
      ))}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function DirectionIcon({ incoming, enRevision }: { incoming: boolean; enRevision: boolean }) {
  return (
    <div
      className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-avatar border ${
        enRevision
          ? "border-[color-mix(in_srgb,#0099ff_40%,var(--border)_60%)] text-[#0099ff]"
          : incoming
            ? "border-[color-mix(in_srgb,var(--success)_32%,var(--border)_68%)] text-[var(--success)]"
            : "border-[color-mix(in_srgb,var(--warning)_32%,var(--border)_68%)] text-[var(--warning)]"
      }`}
      aria-hidden="true"
    >
      {enRevision ? (
        <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 8v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      ) : incoming ? (
        <ArrowDownLeftIcon />
      ) : (
        <ArrowUpRightIcon />
      )}
    </div>
  );
}

function ArrowDownLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 18H6V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M6 18L18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 6H18V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
