"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/providers/AuthProvider";
import {
  listLiquidacionesForUserEndpoint,
  confirmReceiptEndpoint,
  rejectReceiptEndpoint,
} from "@/services/api/endpoints/liquidaciones.endpoint";

type ExpenseTab = "history" | "action";
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

type PlanFilter = "all" | number;

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

function formatDetailDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function isNativePlatform() {
  if (typeof window === "undefined") return false;
  const platformWindow = window as Window & {
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  };
  return Boolean(platformWindow.Capacitor?.isNativePlatform?.());
}

function getExpenseStatusMeta(item: ExpenseItem) {
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ExpenseTab>("action");
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanFilter>("all");
  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null);
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
    setActiveTab("history");
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

  const visibleItems = activeTab === "history" ? paidItems : pendingItems;

  const selectedExpense = useMemo(
    () => items.find((item) => item.id === selectedExpenseId) ?? null,
    [items, selectedExpenseId]
  );

  const planOptions = useMemo(() => {
    const uniquePlans = new Map<number, string>();
    items.forEach((item) => {
      if (!uniquePlans.has(item.planId)) {
        uniquePlans.set(item.planId, item.planName);
      }
    });

    return [...uniquePlans.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const filteredVisibleItems = useMemo(() => {
    const scopedItems =
      selectedPlanId === "all"
        ? visibleItems
        : visibleItems.filter((item) => item.planId === selectedPlanId);

    if (activeTab !== "action") return scopedItems;

    const getPriority = (item: ExpenseItem) => {
      if (item.direction === "incoming" && item.estado === "EN_REVISION") return 0;
      if (item.direction === "incoming" && item.estado === "PENDIENTE") return 1;
      if (item.direction === "outgoing" && item.estado === "PENDIENTE") return 2;
      if (item.direction === "outgoing" && item.estado === "EN_REVISION") return 3;
      return 4;
    };

    return [...scopedItems].sort((a, b) => {
      const priorityDiff = getPriority(a) - getPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [activeTab, selectedPlanId, visibleItems]);

  const selectedPlanName = useMemo(() => {
    if (selectedPlanId === "all") return null;
    return planOptions.find((plan) => plan.id === selectedPlanId)?.name ?? null;
  }, [planOptions, selectedPlanId]);

  const kpis = useMemo(
    () => ({
      owedToYou: items
        .filter((item) => item.direction === "incoming" && item.estado === "PENDIENTE")
        .reduce((sum, item) => sum + item.amount, 0),
      youOwe: items
        .filter((item) => item.direction === "outgoing" && item.estado === "PENDIENTE")
        .reduce((sum, item) => sum + item.amount, 0),
      toConfirmAmount: items
        .filter((item) => item.direction === "incoming" && item.estado === "EN_REVISION")
        .reduce((sum, item) => sum + item.amount, 0),
      toConfirmCount: items.filter(
        (item) => item.direction === "incoming" && item.estado === "EN_REVISION"
      ).length,
    }),
    [items]
  );

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
      const target = activeTab === "history" ? paidTabRef.current : pendingTabRef.current;
      if (!row || !target) return;
      const rowRect = row.getBoundingClientRect();
      const tabRect = target.getBoundingClientRect();
      setIndicator({ left: tabRect.left - rowRect.left, width: tabRect.width, ready: true });
    };
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeTab]);

  useEffect(() => {
    if (selectedExpenseId && !items.some((item) => item.id === selectedExpenseId)) {
      setSelectedExpenseId(null);
    }
  }, [items, selectedExpenseId]);

  // Payee confirms receipt → CONFIRMADA
  const handleConfirmReceipt = async (item: ExpenseItem) => {
    setActingId(item.id);
    try {
      await confirmReceiptEndpoint(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, estado: "CONFIRMADA" } : i)));
      setActiveTab("history");
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

  const openPlan = (planId: number) => {
    router.push(isNativePlatform() ? `/plans/static?id=${planId}` : `/plans/${planId}`);
  };

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main
          className={`px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] md:py-[var(--space-8)] md:pr-[var(--space-14)]`}
        >
          <section className="mx-auto w-full max-w-[860px]">
            <div className="mb-[var(--space-5)] grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-3">
              <KpiCard
                label="Te deben"
                value={formatAmount(kpis.owedToYou)}
                description="Pagos pendientes de recibir"
                tone="success"
              />
              <KpiCard
                label="Debes"
                value={formatAmount(kpis.youOwe)}
                description="Pagos que aún no has hecho"
                tone="warning"
              />
              <KpiCard
                label="Por confirmar"
                value={formatAmount(kpis.toConfirmAmount)}
                description={
                  kpis.toConfirmCount > 0
                    ? `${kpis.toConfirmCount} pago${kpis.toConfirmCount === 1 ? "" : "s"} por validar`
                    : "Nada pendiente de validar"
                }
                tone="info"
              />
            </div>

            {planOptions.length > 0 && (
              <div className="mb-[var(--space-5)]">
                <label className="mb-[var(--space-2)] block text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                  Filtrar por plan
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-[44px] w-full max-w-[360px] items-center justify-between rounded-[12px] border border-app bg-surface px-[14px] text-left text-body-sm font-[var(--fw-medium)] text-app transition-colors hover:bg-surface-inset"
                    >
                      <span className="min-w-0 truncate">
                        {selectedPlanName ?? "Todos los planes"}
                      </span>
                      <div className="ml-[var(--space-3)] flex shrink-0 items-center gap-[var(--space-2)]">
                        <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 py-[2px] text-[11px] font-[var(--fw-semibold)] text-[var(--contrast)]">
                          {filteredVisibleItems.length}
                        </span>
                        <svg viewBox="0 0 24 24" fill="none" className="size-[18px] text-muted" aria-hidden="true">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[min(360px,calc(100vw-32px))] p-[var(--space-2)]">
                    <div className="space-y-[2px]">
                      <PlanFilterOption
                        label="Todos los planes"
                        count={visibleItems.length}
                        active={selectedPlanId === "all"}
                        onClick={() => setSelectedPlanId("all")}
                      />
                      {planOptions.map((plan) => (
                        <PlanFilterOption
                          key={plan.id}
                          label={plan.name}
                          count={visibleItems.filter((item) => item.planId === plan.id).length}
                          active={selectedPlanId === plan.id}
                          onClick={() => setSelectedPlanId(plan.id)}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Tabs */}
            <div
              ref={tabRowRef}
              className="relative mb-[var(--space-5)] flex gap-[var(--space-4)] border-b border-app pb-[var(--space-2)] text-body text-muted"
            >
              <button
                ref={paidTabRef}
                type="button"
                onClick={() => setActiveTab("history")}
                className={`-mb-[2px] pb-0 font-[700] transition-colors duration-[var(--duration-base)] ${
                  activeTab === "history" ? "text-app" : "hover:text-app"
                }`}
              >
                Historial
              </button>
              <button
                ref={pendingTabRef}
                type="button"
                onClick={() => setActiveTab("action")}
                className={`-mb-[2px] flex items-center gap-2 pb-0 font-[700] transition-colors duration-[var(--duration-base)] ${
                  activeTab === "action" ? "text-app" : "hover:text-app"
                }`}
              >
                Por resolver
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
              ) : filteredVisibleItems.length === 0 ? (
                <EmptyState tab={activeTab} selectedPlanName={selectedPlanName} />
              ) : (
                filteredVisibleItems.map((item) => {
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

                  const needsAction = incoming && item.estado === "EN_REVISION";
                  const statusMeta = getExpenseStatusMeta(item);

                  return (
                    <article
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedExpenseId(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedExpenseId(item.id);
                        }
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-app bg-app px-[var(--space-4)] py-[var(--space-3)] transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
                    >
                      <ExpenseAvatar name={senderName} image={senderImage} />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{senderName}</p>
                        <p className="truncate text-caption text-muted">{secondaryLine}</p>
                        {item.estado !== "CONFIRMADA" && (
                          <p className={`mt-0.5 flex items-center gap-1 text-caption ${statusMeta.inlineTextClass}`}>
                            <svg viewBox="0 0 24 24" fill="none" className="size-3 shrink-0" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            {statusMeta.text}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {needsAction ? (
                          <>
                            <button
                              type="button"
                              disabled={actingId === item.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRejectReceipt(item);
                              }}
                              className="rounded-chip border border-app px-2.5 py-1 text-caption font-[var(--fw-medium)] text-muted disabled:opacity-50"
                            >
                              No recibido
                            </button>
                            <button
                              type="button"
                              disabled={actingId === item.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleConfirmReceipt(item);
                              }}
                              className="rounded-chip bg-[#16a34a] px-2.5 py-1 text-caption font-[var(--fw-semibold)] text-white disabled:opacity-50"
                            >
                              {actingId === item.id ? "..." : "Confirmar"}
                            </button>
                          </>
                        ) : (
                          <div className="text-right">
                            <p
                              className={`text-body-sm font-[var(--fw-semibold)] ${
                                incoming ? "text-[var(--success,#15803d)]" : "text-[var(--warning,#b45309)]"
                              }`}
                            >
                              {incoming ? "+" : "-"}{formatAmount(item.amount)}
                            </p>
                            <p className="mt-[2px] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.06em] text-muted">
                              Ver detalle
                            </p>
                          </div>
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

      <ExpenseDetailModal
        item={selectedExpense}
        profileName={profile?.nombre ?? "Tú"}
        actingId={actingId}
        onClose={() => setSelectedExpenseId(null)}
        onOpenPlan={openPlan}
        onConfirm={(item) => void handleConfirmReceipt(item)}
        onReject={(item) => void handleRejectReceipt(item)}
      />
    </div>
  );
}


// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab, selectedPlanName }: { tab: ExpenseTab; selectedPlanName: string | null }) {
  return (
    <div className="py-[var(--space-10)] text-center">
      <p className="text-body-sm text-muted">
        {selectedPlanName
          ? `No hay movimientos ${tab === "history" ? "en historial" : "por resolver"} en ${selectedPlanName}.`
          : tab === "history"
            ? "Aún no tienes movimientos cerrados."
            : "No tienes nada por resolver. ¡Todo al día!"}
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
    return (
      <div className="relative mt-0.5 size-11 shrink-0 overflow-hidden rounded-full border border-app">
        <Image src={image} alt={name} fill sizes="44px" className="object-cover" unoptimized referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border border-app bg-surface-2 text-body-sm font-[var(--fw-semibold)] text-muted">
      {(name.trim()[0] || "U").toUpperCase()}
    </div>
  );
}

function KpiCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  tone: "success" | "warning" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-[var(--success)]/35 bg-app"
      : tone === "warning"
        ? "border-[var(--warning)]/35 bg-app"
        : "border-[var(--info)]/35 bg-app";

  return (
    <div className={`rounded-[14px] border px-[var(--space-4)] py-[var(--space-4)] ${toneClass}`}>
      <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p
        className="mt-[8px] font-[var(--fw-bold)] leading-[1.1] text-app"
        style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "var(--font-h3)" }}
      >
        {value}
      </p>
      <p className="mt-[6px] text-body-sm text-muted">{description}</p>
    </div>
  );
}

function PlanFilterOption({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-[10px] px-[var(--space-3)] py-[10px] text-left text-body-sm transition-colors ${
        active ? "bg-surface-inset text-app" : "text-app hover:bg-surface"
      }`}
    >
      <span className={`min-w-0 truncate ${active ? "font-[var(--fw-semibold)]" : "font-[var(--fw-medium)]"}`}>
        {label}
      </span>
      <div className="ml-[var(--space-3)] flex shrink-0 items-center">
        <span className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-[2px] text-[11px] font-[var(--fw-semibold)] ${
          active ? "bg-[var(--primary)] text-[var(--contrast)]" : "bg-app text-muted"
        }`}>
          {count}
        </span>
      </div>
    </button>
  );
}

function ExpenseDetailModal({
  item,
  profileName,
  actingId,
  onClose,
  onOpenPlan,
  onConfirm,
  onReject,
}: {
  item: ExpenseItem | null;
  profileName: string;
  actingId: number | null;
  onClose: () => void;
  onOpenPlan: (planId: number) => void;
  onConfirm: (item: ExpenseItem) => void;
  onReject: (item: ExpenseItem) => void;
}) {
  if (!item) return null;

  const incoming = item.direction === "incoming";
  const otherPartyLabel = incoming ? item.counterparty : `${profileName} (Tú)`;
  const statusMeta = getExpenseStatusMeta(item);
  const requiresValidation = incoming && item.estado === "EN_REVISION";

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/40 px-[var(--space-4)] pb-[max(var(--space-4),env(safe-area-inset-bottom))] pt-[var(--space-6)] md:items-center md:pb-[var(--space-6)]"
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
              {incoming ? "Pago recibido" : "Pago realizado"}
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

          <p className="rounded-[12px] bg-surface px-[var(--space-4)] py-[var(--space-3)] text-body-sm text-muted">
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

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-app bg-surface px-[var(--space-4)] py-[var(--space-3)]">
      <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="mt-[6px] text-body-sm font-[var(--fw-semibold)] text-app">{value}</p>
    </div>
  );
}
