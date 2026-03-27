"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import {
  listLiquidacionesForUserEndpoint,
  confirmReceiptEndpoint,
  rejectReceiptEndpoint,
} from "@/services/api/endpoints/liquidaciones.endpoint";

type ExpenseTab = "paid" | "pending";
type EstadoLiquidacion = "PENDIENTE" | "EN_REVISION" | "CONFIRMADA" | "ANULADA";

type ExpenseItem = {
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

function formatAmount(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatListDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
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
  const { user, profile } = useAuth();
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
            counterpartyImage: l.counterparty_profile_image ?? null,
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
              className="relative mb-[var(--space-5)] flex gap-[var(--space-4)] border-b border-app pb-[var(--space-2)] text-body text-muted"
            >
              <button
                ref={paidTabRef}
                type="button"
                onClick={() => setActiveTab("paid")}
                className={`-mb-[2px] pb-0 font-[700] transition-colors duration-[var(--duration-base)] ${
                  activeTab === "paid" ? "text-app" : "hover:text-app"
                }`}
              >
                Pagados
              </button>
              <button
                ref={pendingTabRef}
                type="button"
                onClick={() => setActiveTab("pending")}
                className={`-mb-[2px] flex items-center gap-2 pb-0 font-[700] transition-colors duration-[var(--duration-base)] ${
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
                className={`pointer-events-none absolute bottom-0 h-[2px] bg-[var(--text-primary)] transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] ${
                  indicator.ready ? "opacity-100" : "opacity-0"
                }`}
                style={{ left: indicator.left, width: indicator.width }}
                aria-hidden="true"
              />
              <span className="ml-auto pb-[var(--space-2)] opacity-0" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="size-[20px]">
                  <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <span className="pb-[var(--space-2)] opacity-0" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="size-[20px]">
                  <path
                    d="M6 10.5C6 7.46 8.24 5 12 5s6 2.46 6 5.5v3l1.5 2.5H4.5L6 13.5v-3Z"
                    stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
                  />
                  <path
                    d="M10 17.5a2 2 0 0 0 4 0"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                  />
                </svg>
              </span>
            </div>

            <div className="space-y-[var(--space-3)]">
              {dataLoading ? (
                <SkeletonList />
              ) : visibleItems.length === 0 ? (
                <EmptyState tab={activeTab} />
              ) : (
                visibleItems.map((item) => {
                  const incoming = item.direction === "incoming";
                  const senderName = incoming ? item.counterparty : `${profile?.nombre ?? "Tú"} (Tú)`;
                  const senderImage = incoming ? item.counterpartyImage : profile?.profile_image ?? null;
                  const secondaryLine = [
                    item.concept || item.planName,
                    item.concept ? item.planName : null,
                    formatListDate(item.date),
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  const needsAction =
                    activeTab === "pending" && incoming && item.estado === "EN_REVISION";
                  type PendingStatus = { text: string; color: string } | null;
                  const pendingStatus: PendingStatus =
                    needsAction
                      ? { text: "Pago entrante", color: "text-[var(--warning,#d97706)]" }
                      : activeTab === "pending" && !incoming && item.estado === "EN_REVISION"
                        ? { text: "Pendiente de confirmación", color: "text-[#8b5cf6]" }
                        : activeTab === "pending" && incoming && item.estado === "PENDIENTE"
                          ? { text: "Esperando pago", color: "text-[var(--info,#2563eb)]" }
                          : activeTab === "pending" && !incoming && item.estado === "PENDIENTE"
                            ? { text: "Pendiente de pago", color: "text-[#e879a2]" }
                            : null;

                  return (
                    <article
                      key={item.id}
                      className="flex items-center gap-3 rounded-[6px] border border-app bg-app px-[var(--space-4)] py-[var(--space-3)]"
                    >
                      <ExpenseAvatar name={senderName} image={senderImage} />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{senderName}</p>
                        <p className="truncate text-caption text-muted">{secondaryLine}</p>
                        {pendingStatus && (
                          <p className={`mt-0.5 flex items-center gap-1 text-caption ${pendingStatus.color}`}>
                            <svg viewBox="0 0 24 24" fill="none" className="size-3 shrink-0" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            {pendingStatus.text}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {needsAction ? (
                          <>
                            <button
                              type="button"
                              disabled={actingId === item.id}
                              onClick={() => handleRejectReceipt(item)}
                              className="rounded-chip border border-app px-2.5 py-1 text-caption font-[var(--fw-medium)] text-muted disabled:opacity-50"
                            >
                              No recibido
                            </button>
                            <button
                              type="button"
                              disabled={actingId === item.id}
                              onClick={() => handleConfirmReceipt(item)}
                              className="rounded-chip bg-[#16a34a] px-2.5 py-1 text-caption font-[var(--fw-semibold)] text-white disabled:opacity-50"
                            >
                              {actingId === item.id ? "..." : "Confirmar"}
                            </button>
                          </>
                        ) : (
                          <p
                            className={`text-body-sm font-[var(--fw-semibold)] ${
                              incoming ? "text-[var(--success,#15803d)]" : "text-[var(--warning,#b45309)]"
                            }`}
                          >
                            {incoming ? "+" : "-"}{formatAmount(item.amount)}
                          </p>
                        )}
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
        <div key={i} className="h-20 animate-pulse rounded-[6px] border border-app bg-surface" />
      ))}
    </div>
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function ExpenseAvatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return <img src={image} alt={name} className="mt-0.5 size-11 shrink-0 rounded-full border border-app object-cover" referrerPolicy="no-referrer" />;
  }

  return (
    <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border border-app bg-surface-2 text-body-sm font-[var(--fw-semibold)] text-muted">
      {(name.trim()[0] || "U").toUpperCase()}
    </div>
  );
}

