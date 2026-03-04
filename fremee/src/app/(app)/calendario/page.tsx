"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AppSidebar from "@/components/common/AppSidebar";
import { CALENDAR_PLANS } from "@/app/(app)/calendario/mock-data";

type PlanTab = "active" | "finished";

function formatPeople(count: number): string {
  return `${count} ${count === 1 ? "persona" : "personas"}`;
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(amount);
}

export default function CalendarioPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<PlanTab>("active");
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const finishedTabRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const plans = useMemo(() => {
    return CALENDAR_PLANS.filter((plan) => (activeTab === "active" ? plan.status === "active" : plan.status === "finished"));
  }, [activeTab]);

  useEffect(() => {
    const updateIndicator = () => {
      const row = tabRowRef.current;
      const target = activeTab === "active" ? activeTabRef.current : finishedTabRef.current;
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
            <header className="mb-[var(--space-4)]">
              <h1 className="text-[var(--font-h2)] font-[var(--fw-semibold)] leading-[var(--lh-h2)]">Mis planes</h1>
            </header>

            <div ref={tabRowRef} className="relative flex gap-[var(--space-8)] border-b border-app text-body text-muted">
              <button
                ref={activeTabRef}
                type="button"
                onClick={() => setActiveTab("active")}
                className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                  activeTab === "active" ? "text-app" : "hover:text-app"
                }`}
              >
                Activos
              </button>
              <button
                ref={finishedTabRef}
                type="button"
                onClick={() => setActiveTab("finished")}
                className={`pb-[var(--space-2)] font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] ${
                  activeTab === "finished" ? "text-app" : "hover:text-app"
                }`}
              >
                Finalizados
              </button>
              <span
                className={`pointer-events-none absolute bottom-0 h-[2px] bg-warning-token transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] ${
                  indicator.ready ? "opacity-100" : "opacity-0"
                }`}
                style={{ left: indicator.left, width: indicator.width }}
                aria-hidden="true"
              />
            </div>

            <div className="mt-[var(--space-6)] space-y-[var(--space-5)]">
              {plans.map((plan) => {
                const balanceLabel =
                  plan.balanceType === "owed_to_me"
                    ? `Te deben ${formatEuro(plan.balanceAmount)}€`
                    : plan.balanceType === "i_owe"
                      ? `Debes ${formatEuro(plan.balanceAmount)}€`
                      : "Saldado";

                const balanceToneClass =
                  plan.balanceType === "owed_to_me"
                    ? "border-[color-mix(in_srgb,var(--success)_30%,var(--border)_70%)] bg-[color-mix(in_srgb,var(--success)_15%,var(--bg)_85%)] text-[var(--success)]"
                    : plan.balanceType === "i_owe"
                      ? "border-[color-mix(in_srgb,var(--error)_30%,var(--border)_70%)] bg-[color-mix(in_srgb,var(--error)_10%,var(--bg)_90%)] text-[var(--error)]"
                      : "border-app bg-surface text-muted";

                return (
                  <Link
                    key={plan.id}
                    href={`/calendario/${plan.id}`}
                    className="block overflow-hidden rounded-[12px] border border-app bg-app shadow-elev-1 transition-opacity duration-[var(--duration-base)] hover:opacity-95"
                  >
                    <div className="relative h-[164px] w-full">
                      <img src={plan.imageUrl} alt={plan.title} className="h-full w-full object-cover" />
                      <span
                        className={`absolute right-3 top-3 rounded-chip px-3 py-1 text-caption font-[var(--fw-medium)] ${
                          plan.status === "active"
                            ? "bg-[color-mix(in_srgb,var(--success)_24%,black_8%)] text-[color-mix(in_srgb,white_86%,var(--success)_14%)]"
                            : "bg-[color-mix(in_srgb,var(--text-secondary)_42%,black_8%)] text-white"
                        }`}
                      >
                        {plan.status === "active" ? "Activo" : "Finalizado"}
                      </span>
                    </div>

                    <div className="flex items-end justify-between gap-3 p-[var(--space-4)]">
                      <div>
                        <h2 className="text-[26px] font-[var(--fw-medium)] leading-[1.15]">{plan.title}</h2>
                        <p className="mt-2 text-body text-muted">
                          {plan.rangeText} · {formatPeople(plan.peopleCount)}
                        </p>
                      </div>
                      <span className={`rounded-input border px-3 py-2 text-body-sm font-[var(--fw-medium)] ${balanceToneClass}`}>
                        {balanceLabel}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
