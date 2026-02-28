"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppSidebar from "@/components/common/AppSidebar";

type ExpenseTab = "paid" | "pending";
type ExpenseDirection = "outgoing" | "incoming";

type ExpenseItem = {
  id: string;
  amount: number;
  currency: "EUR";
  date: string;
  direction: ExpenseDirection;
  counterparty: string;
  planName: string;
  concept: string;
};

const MOCK_PAID_ITEMS: ExpenseItem[] = [
  {
    id: "p-1",
    amount: 48,
    currency: "EUR",
    date: "2026-02-26T18:15:00Z",
    direction: "outgoing",
    counterparty: "Lucia",
    planName: "Escapada a Valencia",
    concept: "Cena del sabado",
  },
  {
    id: "p-2",
    amount: 32.5,
    currency: "EUR",
    date: "2026-02-24T10:20:00Z",
    direction: "incoming",
    counterparty: "Nico",
    planName: "Cumple de Marta",
    concept: "Regalo conjunto",
  },
  {
    id: "p-3",
    amount: 21.9,
    currency: "EUR",
    date: "2026-02-19T07:40:00Z",
    direction: "outgoing",
    counterparty: "Irene",
    planName: "Viaje a Lisboa",
    concept: "Transfer aeropuerto",
  },
  {
    id: "p-4",
    amount: 15,
    currency: "EUR",
    date: "2026-02-16T12:05:00Z",
    direction: "incoming",
    counterparty: "Carlos",
    planName: "Barbacoa domingo",
    concept: "Compra de bebida",
  },
];

const MOCK_PENDING_ITEMS: ExpenseItem[] = [
  {
    id: "q-1",
    amount: 54,
    currency: "EUR",
    date: "2026-02-27T20:10:00Z",
    direction: "incoming",
    counterparty: "Marta",
    planName: "Casa rural abril",
    concept: "Reserva alojamiento",
  },
  {
    id: "q-2",
    amount: 12.8,
    currency: "EUR",
    date: "2026-02-25T08:50:00Z",
    direction: "outgoing",
    counterparty: "Pedro",
    planName: "Partido del viernes",
    concept: "Entradas compartidas",
  },
  {
    id: "q-3",
    amount: 29.99,
    currency: "EUR",
    date: "2026-02-22T15:30:00Z",
    direction: "incoming",
    counterparty: "Alba",
    planName: "Fin de semana en Madrid",
    concept: "Museo + transporte",
  },
  {
    id: "q-4",
    amount: 40,
    currency: "EUR",
    date: "2026-02-18T19:00:00Z",
    direction: "outgoing",
    counterparty: "Hugo",
    planName: "Esqui en Andorra",
    concept: "Gasolina",
  },
];

const REFERENCE_NOW_TS = Date.now();

function formatAmount(value: number, currency: ExpenseItem["currency"]): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<ExpenseTab>("paid");
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const paidTabRef = useRef<HTMLButtonElement | null>(null);
  const pendingTabRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const items = useMemo(() => {
    const source = activeTab === "paid" ? MOCK_PAID_ITEMS : MOCK_PENDING_ITEMS;
    return [...source].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeTab]);

  const overduePendingDebts = useMemo(() => {
    if (activeTab !== "pending") return [];
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    return MOCK_PENDING_ITEMS.filter((item) => {
      if (item.direction !== "outgoing") return false;
      const ageMs = REFERENCE_NOW_TS - new Date(item.date).getTime();
      return ageMs > twoDaysMs;
    });
  }, [activeTab]);

  useEffect(() => {
    const updateIndicator = () => {
      const row = tabRowRef.current;
      const target = activeTab === "paid" ? paidTabRef.current : pendingTabRef.current;
      if (!row || !target) return;

      const rowRect = row.getBoundingClientRect();
      const tabRect = target.getBoundingClientRect();
      setIndicator({
        left: tabRect.left - rowRect.left,
        width: tabRect.width,
        ready: true,
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeTab]);

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((prev) => !prev)} />

        <main
          className={`px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] lg:py-[var(--space-8)] lg:pr-[var(--space-14)] ${
            sidebarCollapsed ? "lg:pl-[56px]" : "lg:pl-[136px]"
          }`}
        >
          <section className="mx-auto w-full max-w-[860px]">
            <header className="mb-[var(--space-6)]">
              <h1 className="text-[var(--font-h2)] font-[var(--fw-semibold)] leading-[var(--lh-h2)]">Mis gastos</h1>
              <p className="mt-[var(--space-2)] text-body-sm text-muted">
                Consulta lo que has pagado, lo que te han pagado y lo que sigue pendiente por plan.
              </p>
            </header>

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
                className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                  activeTab === "pending" ? "text-app" : "hover:text-app"
                }`}
              >
                Pendientes
              </button>
              <span
                className={`pointer-events-none absolute bottom-0 h-[2px] bg-warning-token transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] ${
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
              {items.map((item) => {
                const incoming = item.direction === "incoming";
                const isOverdueDebt =
                  activeTab === "pending" &&
                  item.direction === "outgoing" &&
                  REFERENCE_NOW_TS - new Date(item.date).getTime() > 2 * 24 * 60 * 60 * 1000;
                const relationText =
                  activeTab === "pending"
                    ? incoming
                      ? `Te debe ${item.counterparty}`
                      : `Debes a ${item.counterparty}`
                    : incoming
                      ? `Te pago ${item.counterparty}`
                      : `Pagaste a ${item.counterparty}`;
                const cardToneClass =
                  isOverdueDebt
                    ? "border-[color-mix(in_srgb,var(--error)_28%,var(--border)_72%)] bg-[color-mix(in_srgb,var(--error)_8%,var(--bg)_92%)]"
                    : "border-app bg-app";

                return (
                  <article key={item.id} className={`rounded-card border p-[var(--space-4)] shadow-elev-1 ${cardToneClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <DirectionIcon incoming={incoming} />
                        <div>
                          <p className="text-body font-[var(--fw-semibold)]">{relationText}</p>
                          <p className="mt-1 text-body-sm text-muted">
                            Plan: <span className="font-[var(--fw-medium)] text-app">{item.planName}</span>
                          </p>
                          <p className="mt-1 text-body-sm text-muted">{item.concept}</p>
                        </div>
                      </div>

                      <div className="text-right">
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
                          {formatAmount(item.amount, item.currency)}
                        </p>
                        <p className="mt-1 text-caption text-muted">{formatDate(item.date)}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function DirectionIcon({ incoming }: { incoming: boolean }) {
  return (
    <div
      className={`mt-1 flex size-9 items-center justify-center rounded-avatar border ${
        incoming
          ? "border-[color-mix(in_srgb,var(--success)_32%,var(--border)_68%)] text-[var(--success)]"
          : "border-[color-mix(in_srgb,var(--warning)_32%,var(--border)_68%)] text-[var(--warning)]"
      }`}
      aria-hidden="true"
    >
      {incoming ? <ArrowDownLeftIcon /> : <ArrowUpRightIcon />}
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
