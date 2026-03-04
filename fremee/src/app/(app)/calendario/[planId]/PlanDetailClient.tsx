"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PLAN_DETAILS_BY_ID, type PlanActivity } from "@/app/(app)/calendario/mock-data";

type DetailTab = "summary" | "expenses" | "chat";

function formatPeople(count: number): string {
  return `${count} ${count === 1 ? "persona" : "personas"}`;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDayMonth(dateIso: string): { day: string; month: string } {
  const date = new Date(dateIso);
  return {
    day: new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("es-ES", { month: "short" }).format(date),
  };
}

function formatDateTime(dateIso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateIso));
}

export default function PlanDetailClient({ planId }: { planId: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const summaryTabRef = useRef<HTMLButtonElement | null>(null);
  const expensesTabRef = useRef<HTMLButtonElement | null>(null);
  const chatTabRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const plan = PLAN_DETAILS_BY_ID[planId] ?? PLAN_DETAILS_BY_ID["plan-1"];
  const hasFallback = !PLAN_DETAILS_BY_ID[planId];

  const orderedActivities = useMemo(() => {
    return [...plan.upcomingActivities].sort(
      (a: PlanActivity, b: PlanActivity) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime(),
    );
  }, [plan.upcomingActivities]);

  const orderedExpenses = useMemo(() => {
    return [...plan.expenses].sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());
  }, [plan.expenses]);

  useEffect(() => {
    const updateIndicator = () => {
      const row = tabRowRef.current;
      const target =
        activeTab === "summary"
          ? summaryTabRef.current
          : activeTab === "expenses"
            ? expensesTabRef.current
            : chatTabRef.current;
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

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/calendario");
  };

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[980px] px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] lg:py-[var(--space-8)]">
        <section className="overflow-hidden rounded-card border border-app bg-app shadow-elev-1">
            <div className="relative h-[268px] w-full">
              <img src={plan.imageUrl} alt={plan.title} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Volver"
                onClick={goBack}
                className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-avatar bg-white/85 text-app shadow-elev-1"
              >
                <BackIcon />
              </button>
              <button
                type="button"
                aria-label="Mas opciones"
                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-avatar bg-white/85 text-app shadow-elev-1"
              >
                <DotsIcon />
              </button>
            </div>

            <div className="p-[var(--space-4)]">
              {hasFallback && (
                <p className="mb-[var(--space-2)] text-body-sm text-muted">
                  Este plan no existe en mock. Mostrando un ejemplo de detalle.
                </p>
              )}

              <h1 className="text-[32px] font-[var(--fw-medium)] leading-[1.12]">{plan.title}</h1>
              <p className="mt-[var(--space-2)] text-body text-muted">
                {plan.rangeText} · {formatPeople(plan.peopleCount)}
              </p>

              <div
                ref={tabRowRef}
                className="relative mt-[var(--space-5)] flex gap-[var(--space-8)] border-b border-app text-body text-muted"
              >
                <button
                  ref={summaryTabRef}
                  type="button"
                  onClick={() => setActiveTab("summary")}
                  className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                    activeTab === "summary" ? "text-app" : "hover:text-app"
                  }`}
                >
                  Resumen
                </button>
                <button
                  ref={expensesTabRef}
                  type="button"
                  onClick={() => setActiveTab("expenses")}
                  className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                    activeTab === "expenses" ? "text-app" : "hover:text-app"
                  }`}
                >
                  Gastos
                </button>
                <button
                  ref={chatTabRef}
                  type="button"
                  onClick={() => setActiveTab("chat")}
                  className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                    activeTab === "chat" ? "text-app" : "hover:text-app"
                  }`}
                >
                  Chat
                </button>
                <span
                  className={`pointer-events-none absolute bottom-0 h-[2px] bg-warning-token transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] ${
                    indicator.ready ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ left: indicator.left, width: indicator.width }}
                  aria-hidden="true"
                />
              </div>

              {activeTab === "summary" && (
                <div className="mt-[var(--space-4)] space-y-[var(--space-4)]">
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    <button
                      type="button"
                      className="flex h-[114px] min-w-[72px] items-center justify-center rounded-[14px] border border-app bg-surface text-[32px] text-muted"
                      aria-label="Subir historia"
                    >
                      +
                    </button>
                    {plan.stories.map((story) => (
                      <article key={story.id} className="min-w-[72px]">
                        <div className="h-[114px] w-[72px] overflow-hidden rounded-[14px] border border-app bg-surface">
                          <img src={story.imageUrl} alt={`Historia de ${story.author}`} className="h-full w-full object-cover" />
                        </div>
                        <p className="mt-1 truncate text-caption text-muted">{story.author}</p>
                      </article>
                    ))}
                  </div>

                  <article className="rounded-card border border-app bg-app p-[var(--space-4)] shadow-elev-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-[30px] font-[var(--fw-medium)] leading-[1.1]">Balance del grupo</h2>
                        <p className="mt-1 text-body-sm text-muted">Pendiente para dejar cuentas saldadas</p>
                      </div>
                      <p className="text-[var(--font-h1)] font-[var(--fw-semibold)] leading-[1] tabular-nums">
                        {formatMoney(plan.groupBalance)}
                      </p>
                    </div>
                  </article>

                  <article className="rounded-card border border-app bg-app p-[var(--space-4)] shadow-elev-1">
                    <div className="mb-[var(--space-3)] flex items-center justify-between">
                      <h3 className="text-[30px] font-[var(--fw-medium)] leading-[1.1]">Proximas actividades</h3>
                      <button type="button" className="text-body text-muted">
                        + Anadir
                      </button>
                    </div>

                    <div className="space-y-[var(--space-4)]">
                      {orderedActivities.map((activity, index) => {
                        const { day, month } = formatDayMonth(activity.dateIso);
                        return (
                          <div key={activity.id} className="flex gap-4">
                            <div className="flex w-14 flex-col items-center">
                              <span
                                className={`h-7 w-7 rounded-avatar border border-app ${
                                  index === 0
                                    ? "border-warning-token bg-[color-mix(in_srgb,var(--warning)_24%,var(--bg)_76%)]"
                                    : "bg-app"
                                }`}
                              />
                              {index < orderedActivities.length - 1 && (
                                <span className="mt-1 h-10 w-px bg-[color:var(--border)]" />
                              )}
                            </div>

                            <div className="-ml-2 flex w-16 shrink-0 items-center gap-1 text-muted">
                              <span className="text-body">{day}</span>
                              <span className="text-body-sm">{month}</span>
                            </div>

                            <div>
                              <p className="text-body font-[var(--fw-semibold)]">{activity.title}</p>
                              <p className="text-body-sm text-muted">{activity.subtitle}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                </div>
              )}

              {activeTab === "expenses" && (
                <div className="mt-[var(--space-4)] space-y-[var(--space-3)]">
                  {orderedExpenses.map((expense) => (
                    <article key={expense.id} className="rounded-card border border-app bg-app p-[var(--space-3)] shadow-elev-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-body font-[var(--fw-semibold)]">
                            {expense.from} pago a {expense.to}
                          </p>
                          <p className="mt-1 text-body-sm text-muted">{expense.concept}</p>
                          <p className="mt-1 text-caption text-muted">{formatDateTime(expense.dateIso)}</p>
                        </div>
                        <p className="text-body font-[var(--fw-semibold)]">{formatMoney(expense.amount)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {activeTab === "chat" && (
                <div className="mt-[var(--space-4)]">
                  <div className="space-y-[var(--space-3)]">
                    {plan.chat.map((message) => (
                      <article
                        key={message.id}
                        className={`max-w-[82%] rounded-[14px] px-[var(--space-3)] py-[var(--space-2)] ${
                          message.mine
                            ? "ml-auto border border-warning-token bg-[color-mix(in_srgb,var(--warning)_16%,var(--bg)_84%)]"
                            : "border border-app bg-surface"
                        }`}
                      >
                        <p className="text-caption text-muted">{message.sender}</p>
                        <p className="mt-1 text-body-sm">{message.text}</p>
                        <p className="mt-1 text-caption text-muted">{formatDateTime(message.sentAtIso)}</p>
                      </article>
                    ))}
                  </div>

                  <div className="mt-[var(--space-4)] flex gap-2 border-t border-app pt-[var(--space-3)]">
                    <input
                      type="text"
                      placeholder="Escribe un mensaje..."
                      className="h-input flex-1 rounded-input border border-app bg-app px-3 text-body-sm outline-none"
                      disabled
                    />
                    <button
                      type="button"
                      disabled
                      className="h-input rounded-input border border-app px-4 text-body-sm font-[var(--fw-medium)] text-muted"
                    >
                      Enviar
                    </button>
                  </div>
                </div>
              )}

            </div>
        </section>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
      <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}
