"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/components/ui/Avatar";
import { ExpenseDetailModal, type ExpenseItem } from "@/components/plans/modals/ExpenseDetailModal";
import { Tabs } from "@/components/ui/Tabs";
import { formatMoney, formatShortDate } from "@/lib/formatters";
import { useAuth } from "@/providers/AuthProvider";
import {
  listLiquidacionesForUserEndpoint,
  confirmReceiptEndpoint,
  rejectReceiptEndpoint,
} from "@/services/api/endpoints/liquidaciones.endpoint";

type ExpenseTab = "history" | "action";

type PlanFilter = "all" | number;

const formatAmount = formatMoney;
const formatListDate = formatShortDate;


function isNativePlatform() {
  if (typeof window === "undefined") return false;
  const platformWindow = window as Window & {
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  };
  return Boolean(platformWindow.Capacitor?.isNativePlatform?.());
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
          className={`min-h-[calc(100dvh-env(safe-area-inset-top)-clamp(56px,8dvh,64px)-env(safe-area-inset-bottom))] px-safe pb-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom))] pt-mobile-safe-top transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] md:min-h-0 md:py-[var(--space-10)] md:pr-[var(--space-14)]`}
        >
          <section className="mx-auto w-full max-w-[860px]">
            {/* Título */}
            <h1 className="text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">
              Mis gastos
            </h1>
            {(kpis.owedToYou > 0 || kpis.youOwe > 0) && (
              <p className="mt-[var(--space-2)] mb-[var(--space-8)] text-caption text-muted">
                {kpis.owedToYou > 0 && (
                  <>Te deben <span className="font-[var(--fw-medium)] text-app opacity-60">{formatAmount(kpis.owedToYou)}</span></>
                )}
                {kpis.owedToYou > 0 && kpis.youOwe > 0 && " · "}
                {kpis.youOwe > 0 && (
                  <>Debes <span className="font-[var(--fw-medium)] text-app opacity-60">{formatAmount(kpis.youOwe)}</span></>
                )}
              </p>
            )}
            {kpis.owedToYou === 0 && kpis.youOwe === 0 && (
              <div className="mb-[var(--space-8)]" />
            )}

            {/* Tabs */}
            <Tabs
              tabs={[
                { value: "history", label: "Historial" },
                {
                  value: "action",
                  label: "Por resolver",
                  badge: actionRequiredCount > 0 ? (
                    <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-[var(--warning)] text-[11px] font-[var(--fw-semibold)] text-white">
                      {actionRequiredCount}
                    </span>
                  ) : undefined,
                },
              ]}
              value={activeTab}
              onChange={(v) => setActiveTab(v as ExpenseTab)}
              className="mb-0 items-center"
              fontWeight="var(--fw-semibold)"
            />

            {/* Filtro por plan — debajo de los tabs */}
            {planOptions.length > 0 && (
              <div className="flex justify-end pt-[var(--space-3)] pb-[var(--space-1)]">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-[5px] text-caption text-muted transition-colors hover:text-app"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="size-[12px] shrink-0" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M7 12h10M11 18h2" />
                      </svg>
                      <span className="font-[var(--fw-medium)]">
                        {selectedPlanId === "all" ? "Todos los planes" : selectedPlanName}
                      </span>
                      <svg viewBox="0 0 24 24" fill="none" className="size-[10px] shrink-0" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[min(300px,calc(100vw-32px))] p-[var(--space-2)]">
                    <div className="max-h-[calc(5*44px)] overflow-y-auto space-y-[2px]">
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

            <div className="flex flex-col">
              {dataLoading ? (
                <SkeletonList />
              ) : filteredVisibleItems.length === 0 ? (
                <GastosEmptyState tab={activeTab} selectedPlanName={selectedPlanName} />
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
                      className="flex cursor-pointer items-center gap-3 transition-colors hover:bg-surface-inset/50 focus:outline-none"
                    >
                      <ExpenseAvatar name={senderName} image={senderImage} />

                      <div className="flex min-w-0 flex-1 items-center gap-2 py-[var(--space-4)]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{senderName}</p>
                          <p className="truncate text-caption text-muted">{secondaryLine}</p>
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
                            <div className="flex items-center gap-[var(--space-3)]">
                              <p
                                className="text-body-sm font-[var(--fw-semibold)] text-app"
                              >
                                {incoming ? "+" : "-"}{formatAmount(item.amount)}
                              </p>
                              <svg viewBox="0 0 24 24" fill="none" className="size-[15px] shrink-0 text-muted" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                            </div>
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

function GastosEmptyState({ tab, selectedPlanName }: { tab: ExpenseTab; selectedPlanName: string | null }) {
  const msg = selectedPlanName
    ? `No hay movimientos ${tab === "history" ? "en historial" : "por resolver"} en ${selectedPlanName}.`
    : tab === "history"
      ? "Aún no tienes movimientos cerrados."
      : "No tienes nada por resolver. ¡Todo al día!";

  return (
    <div className="py-[var(--space-10)] text-center">
      <p className="text-body-sm text-muted">{msg}</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="flex flex-col gap-[var(--space-4)] py-[var(--space-2)]" aria-label="Cargando gastos" role="status">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton-shimmer size-11 shrink-0 rounded-full" />
          <div className="skeleton-shimmer h-[14px] w-[148px] rounded-full" />
          <div className="skeleton-shimmer ml-auto h-[14px] w-[58px] rounded-full opacity-70" />
        </div>
      ))}
    </div>
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function ExpenseAvatar({ name, image }: { name: string; image: string | null }) {
  return <Avatar name={name} src={image} size="lg" />;
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
        <span className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-[2px] text-[14px] font-[var(--fw-semibold)] ${
          active ? "bg-[var(--primary)] text-[var(--contrast)]" : "bg-app text-muted"
        }`}>
          {count}
        </span>
      </div>
    </button>
  );
}
