"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { ExpenseDetailModal, type ExpenseItem } from "@/components/plans/modals/ExpenseDetailModal";
import { PayDebtSheet, type PaidResult } from "@/components/plans/modals/PayDebtSheet";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toaster";
import { deshacerPagoEndpoint } from "@/services/api/endpoints/gastos.endpoint";
import { formatMoney, formatShortDate } from "@/lib/formatters";
import { createRealtimeTopic } from "@/lib/realtime";
import { useAuth } from "@/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import {
  listLiquidacionesForUserEndpoint,
  confirmReceiptEndpoint,
  rejectReceiptEndpoint,
} from "@/services/api/endpoints/liquidaciones.endpoint";
import {
  buildPlanOptions,
  groupByMonth,
  groupByPlan,
  isOpen,
  namesList,
  needsYou,
  waitingOthers,
  type PlanFilter,
} from "./_components/model";
import {
  AlDiaCard,
  FilteredEmpty,
  LiquidacionRow,
  MisGastosSkeleton,
  PlanChips,
  PlanList,
  SERIF,
  SimpleEmpty,
  SummaryCard,
  TabCount,
  Zone,
  type Kpis,
} from "./_components/parts";

type ExpenseTab = "history" | "action";



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
  const [reloadKey, setReloadKey] = useState(0);
  const [payingId, setPayingId] = useState<number | null>(null);
  const { toast, toastError } = useToast();
  const [actingId, setActingId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanFilter>("all");
  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
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
            metodo: l.metodo,
          }))
        );
      } catch {
        setItems([]);
      } finally {
        setDataLoading(false);
      }
    };
    void load();
  }, [user, reloadKey]);

  // Pagos en vivo: cuando alguien te paga, confirma o rechaza, la lista se actualiza sola.
  useEffect(() => {
    if (!user) return;
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => setReloadKey((k) => k + 1), 400);
    };
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(createRealtimeTopic("mis-gastos", user.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "liquidaciones", filter: `from_user_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "liquidaciones", filter: `to_user_id=eq.${user.id}` }, reload)
      .subscribe();
    return () => {
      clearTimeout(reloadTimer);
      void supabase.removeChannel(channel);
    };
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


  const openItems = useMemo(() => items.filter(isOpen), [items]);
  const paidItems = useMemo(() => items.filter((i) => i.estado === "CONFIRMADA"), [items]);
  const tabItems = activeTab === "history" ? paidItems : openItems;

  const selectedExpense = useMemo(
    () => items.find((item) => item.id === selectedExpenseId) ?? null,
    [items, selectedExpenseId]
  );

  const planOptions = useMemo(() => buildPlanOptions(items, tabItems), [items, tabItems]);

  const scoped = useMemo(
    () => (selectedPlanId === "all" ? tabItems : tabItems.filter((item) => item.planId === selectedPlanId)),
    [tabItems, selectedPlanId]
  );

  const tocaGroups = useMemo(() => groupByPlan(scoped.filter(needsYou)), [scoped]);
  const esperaGroups = useMemo(() => groupByPlan(scoped.filter(waitingOthers)), [scoped]);
  const months = useMemo(() => groupByMonth(scoped), [scoped]);
  const tocaCount = tocaGroups.reduce((n, g) => n + g.items.length, 0);
  const esperaCount = esperaGroups.reduce((n, g) => n + g.items.length, 0);

  const selectedPlanName = useMemo(
    () => (selectedPlanId === "all" ? null : (planOptions.find((plan) => plan.id === selectedPlanId)?.name ?? null)),
    [planOptions, selectedPlanId]
  );

  const kpis = useMemo<Kpis>(() => {
    // «Te deben» incluye lo que te han marcado como pagado y falta confirmar; «Debes» no incluye lo que ya marcaste.
    const incoming = items.filter((i) => i.direction === "incoming" && isOpen(i));
    const toConfirm = incoming.filter((i) => i.estado === "EN_REVISION");
    const outgoing = items.filter((i) => i.direction === "outgoing" && i.estado === "PENDIENTE");
    const sum = (list: ExpenseItem[]) => list.reduce((s, i) => s + i.amount, 0);
    return {
      owed: sum(incoming),
      owedPeople: new Set(incoming.map((i) => i.counterpartyId)).size,
      owedPlans: new Set(incoming.map((i) => i.planId)).size,
      owe: sum(outgoing),
      oweTo: namesList(outgoing.map((i) => i.counterparty)),
      toConfirmAmount: sum(toConfirm),
      toConfirmCount: toConfirm.length,
    };
  }, [items]);

  const allClear = !dataLoading && openItems.length === 0;

  useEffect(() => {
    if (selectedExpenseId && !items.some((item) => item.id === selectedExpenseId)) {
      setSelectedExpenseId(null);
    }
  }, [items, selectedExpenseId]);

  const handleConfirmReceipt = async (item: ExpenseItem) => {
    setActingId(item.id);
    try {
      await confirmReceiptEndpoint(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, estado: "CONFIRMADA" } : i)));
      setSelectedExpenseId(null);
    } catch {
      alert("No se pudo confirmar. Inténtalo de nuevo.");
    } finally {
      setActingId(null);
    }
  };

  const handleRejectReceipt = async (item: ExpenseItem) => {
    setActingId(item.id);
    try {
      await rejectReceiptEndpoint(item.id);
      // El pago se anula y la deuda vuelve sola con el recálculo: se recarga la lista.
      setSelectedExpenseId(null);
      setReloadKey((k) => k + 1);
    } catch {
      alert("No se pudo rechazar. Inténtalo de nuevo.");
    } finally {
      setActingId(null);
    }
  };

  const openPlan = (planId: number, tab?: "gastos") => {
    const suffix = tab ? `${isNativePlatform() ? "&" : "?"}tab=${tab}` : "";
    router.push(isNativePlatform() ? `/plans/static?id=${planId}${suffix}` : `/plans/${planId}${suffix}`);
  };
  const payItem = (item: ExpenseItem) => {
    setSelectedExpenseId(null);
    setPayingId(item.id);
  };
  const payingItem = useMemo(() => items.find((i) => i.id === payingId) ?? null, [items, payingId]);

  const handlePaid = (result: PaidResult) => {
    setReloadKey((k) => k + 1);
    toast(`Pago a ${result.toName} marcado`, "success", {
      label: "Deshacer",
      onClick: () => {
        deshacerPagoEndpoint(result.pagoId)
          .then(() => setReloadKey((k) => k + 1))
          .catch(() => toastError("No se ha podido deshacer el pago."));
      },
    });
  };

  const rowProps = (item: ExpenseItem) => ({
    item,
    acting: actingId === item.id,
    onOpen: () => setSelectedExpenseId(item.id),
    onConfirm: () => void handleConfirmReceipt(item),
    onReject: () => void handleRejectReceipt(item),
    onPay: () => payItem(item),
  });

  const zoneProps = {
    actingId,
    onOpenItem: (item: ExpenseItem) => setSelectedExpenseId(item.id),
    onConfirm: (item: ExpenseItem) => void handleConfirmReceipt(item),
    onReject: (item: ExpenseItem) => void handleRejectReceipt(item),
    onPay: payItem,
    onOpenPlan: (planId: number) => openPlan(planId),
  };

  const summary = dataLoading ? null : allClear ? <AlDiaCard /> : <SummaryCard kpis={kpis} stacked />;
  const filterProps = {
    options: planOptions,
    total: tabItems.length,
    value: selectedPlanId,
    onChange: setSelectedPlanId,
  };

  const renderAction = () => {
    if (dataLoading) return <MisGastosSkeleton />;

    if (allClear) {
      const latest = [...paidItems]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 2);
      if (latest.length === 0) return null;
      return (
        <section aria-label="Lo último">
          <h2 className="mt-6 flex items-baseline border-b border-app pb-1 text-[14px] font-[var(--fw-semibold)] text-app">Lo último</h2>
          {latest.map((item) => (
            <LiquidacionRow key={item.id} history {...rowProps(item)} />
          ))}
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className="mt-1.5 inline-flex min-h-11 items-center text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]"
          >
            Ver el historial
          </button>
        </section>
      );
    }

    if (scoped.length === 0 && selectedPlanName) {
      const last = paidItems
        .filter((i) => i.planId === selectedPlanId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return (
        <FilteredEmpty
          planName={selectedPlanName}
          lastText={
            last
              ? last.direction === "incoming"
                ? `El último pago, de ${last.counterparty}, el ${formatShortDate(last.date)}.`
                : `Tu último pago, a ${last.counterparty}, el ${formatShortDate(last.date)}.`
              : null
          }
          onHistory={() => setActiveTab("history")}
          onAll={() => setSelectedPlanId("all")}
        />
      );
    }

    return (
      <>
        <Zone id="confirmar" title="Te toca a ti" count={tocaCount} tinted groups={tocaGroups} cap={2} {...zoneProps} />
        <Zone title="Esperando a otros" count={esperaCount} groups={esperaGroups} cap={3} {...zoneProps} />
      </>
    );
  };

  const renderHistory = () => {
    if (dataLoading) return <MisGastosSkeleton />;
    if (months.length === 0) {
      return (
        <SimpleEmpty
          text={selectedPlanName ? `No hay movimientos en el historial de ${selectedPlanName}.` : "Aún no tienes movimientos cerrados."}
        />
      );
    }
    return months.map((month) => (
      <section key={month.key} aria-label={month.label}>
        <h2 className="mt-7 flex items-baseline gap-2 border-b border-app pb-1 text-[14px] font-[var(--fw-semibold)] text-app">
          {month.label}
          <span className="ml-auto text-[13px] font-[var(--fw-medium)] tabular-nums text-muted">
            {[month.received > 0 && `Recibiste ${formatMoney(month.received)}`, month.paid > 0 && `pagaste ${formatMoney(month.paid)}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </h2>
        {month.items.map((item) => (
          <LiquidacionRow key={item.id} history {...rowProps(item)} />
        ))}
      </section>
    ));
  };

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main
          className={`min-h-[calc(100dvh-env(safe-area-inset-top)-clamp(56px,8dvh,64px)-env(safe-area-inset-bottom))] px-safe pb-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom))] pt-mobile-safe-top transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] md:min-h-0 md:py-[var(--space-10)] md:pr-[var(--space-14)]`}
        >
          <section className="mx-auto w-full max-w-[1100px] md:flex md:items-start md:gap-14">
            <div className="min-w-0 flex-1">
              <h1 className="text-[32px] leading-none text-app md:text-[48px]" style={SERIF}>
                Mis gastos
              </h1>

              <div className="mt-4 md:hidden">{summary}</div>

              <Tabs
                tabs={[
                  {
                    value: "action",
                    label: "Por resolver",
                    badge: openItems.length > 0 ? <TabCount count={openItems.length} /> : undefined,
                  },
                  { value: "history", label: "Historial" },
                ]}
                value={activeTab}
                onChange={(v) => setActiveTab(v as ExpenseTab)}
                className="mb-0 mt-5 items-center md:mt-6"
                fontWeight="var(--fw-semibold)"
              />

              {!allClear && (
                <div className="md:hidden">
                  <PlanChips {...filterProps} />
                </div>
              )}

              {activeTab === "action" ? renderAction() : renderHistory()}
            </div>

            <aside aria-label="Resumen" className="hidden w-[360px] flex-none flex-col gap-4 md:flex md:pt-1">
              {summary}
              <PlanList {...filterProps} />
            </aside>
          </section>
        </main>
      </div>

      <ExpenseDetailModal
        item={selectedExpense}
        profileName={profile?.nombre ?? "Tú"}
        actingId={actingId}
        onClose={() => setSelectedExpenseId(null)}
        onOpenPlan={(planId) => openPlan(planId)}
        onPay={payItem}
        onConfirm={(item) => void handleConfirmReceipt(item)}
        onReject={(item) => void handleRejectReceipt(item)}
      />

      {payingItem && user && (
        <PayDebtSheet
          debt={{
            liquidacionId: payingItem.id,
            amount: payingItem.amount,
            toName: payingItem.counterparty,
            toImage: payingItem.counterpartyImage,
            planTitle: payingItem.planName,
          }}
          me={{ id: user.id, name: profile?.nombre ?? "Tú", image: profile?.profile_image ?? null }}
          onClose={() => setPayingId(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}
