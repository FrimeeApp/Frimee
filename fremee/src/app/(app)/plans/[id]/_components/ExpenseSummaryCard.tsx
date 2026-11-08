"use client";

import { ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/formatters";

export type ExpenseSummary = {
  hasExpenses: boolean;
  currency: string;
  total: number;
  count: number;
  paidByYou: number;
  yourShare: number;
  net: number;
  participantCount: number;
  topCategories: { label: string; amount: number; count: number; icon: string | null }[];
};

// Three steps of the brand colour for the top three categories; the rest is neutral.
const CATEGORY_SHADES = [
  "var(--primary)",
  "color-mix(in srgb, var(--primary) 60%, var(--surface))",
  "color-mix(in srgb, var(--primary) 35%, var(--surface))",
];

function balanceText(net: number, currency: string) {
  if (net > 0) return { text: `Te deben ${formatMoney(net, currency)}`, tone: "text-[var(--success)]" };
  if (net < 0) return { text: `Debes ${formatMoney(-net, currency)}`, tone: "text-[var(--warning)]" };
  return { text: "En equilibrio", tone: "text-muted" };
}

/** Sidebar summary of the plan's expenses: total, balance and how it splits by category. Full detail lives in the Gastos tab. */
export function ExpenseSummaryCard({ summary: s, onOpen }: { summary: ExpenseSummary; onOpen: () => void }) {
  const balance = balanceText(s.net, s.currency);
  const shown = s.topCategories.reduce((sum, c) => sum + c.amount, 0);
  const rest = Math.max(s.total - shown, 0);
  const parts = [
    ...s.topCategories.map((c, i) => ({ label: c.label, amount: c.amount, color: CATEGORY_SHADES[i] })),
    ...(rest > 0.005 ? [{ label: "Resto", amount: rest, color: "var(--surface-inset)" }] : []),
  ];
  const caption = `${s.count} gasto${s.count === 1 ? "" : "s"}${
    s.participantCount > 0 ? ` · ${s.participantCount} participante${s.participantCount === 1 ? "" : "s"}` : ""
  }`;

  return (
    <div className="hidden rounded-[16px] border border-app bg-surface px-[var(--space-4)] py-[var(--space-4)] md:block">
      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <h3 className="text-body font-[var(--fw-semibold)]">Resumen gastos</h3>
        <button
          type="button"
          onClick={onOpen}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-inset hover:text-app"
          aria-label="Ir a la sección de gastos"
        >
          <ArrowRight className="size-[16px]" />
        </button>
      </div>

      {s.hasExpenses ? (
        <>
          <div className="mt-[var(--space-2)] flex items-end justify-between gap-[var(--space-3)]">
            <div>
              <p className="text-[28px] font-[var(--fw-bold)] leading-none text-app">{formatMoney(s.total, s.currency)}</p>
              <p className="mt-[6px] text-caption text-muted">{caption}</p>
            </div>
            <span className={`shrink-0 rounded-full bg-surface-inset px-[10px] py-[4px] text-caption font-[var(--fw-semibold)] ${balance.tone}`}>
              {balance.text}
            </span>
          </div>

          {parts.length > 0 && s.total > 0 ? (
            <>
              <div className="mt-[var(--space-4)] flex h-[8px] gap-[2px] overflow-hidden rounded-full" aria-hidden>
                {parts.map((p) => (
                  <div key={p.label} style={{ width: `${(p.amount / s.total) * 100}%`, background: p.color }} />
                ))}
              </div>
              <ul className="mt-[var(--space-3)] space-y-[6px]">
                {parts.map((p) => (
                  <li key={p.label} className="flex items-center gap-[var(--space-2)] text-body-sm">
                    <span className="size-[8px] shrink-0 rounded-full" style={{ background: p.color }} />
                    <span className="min-w-0 flex-1 truncate text-app">{p.label}</span>
                    <span className="text-caption text-muted">{Math.round((p.amount / s.total) * 100)}%</span>
                    <span className="w-[76px] shrink-0 text-right font-[var(--fw-medium)] text-app">
                      {formatMoney(p.amount, s.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="mt-[var(--space-4)] border-t border-app pt-[var(--space-3)] text-caption text-muted">
            Pagaste <span className="font-[var(--fw-medium)] text-app">{formatMoney(s.paidByYou, s.currency)}</span>
            {" · "}Tu parte <span className="font-[var(--fw-medium)] text-app">{formatMoney(s.yourShare, s.currency)}</span>
          </p>
        </>
      ) : (
        <p className="mt-[var(--space-2)] text-body-sm text-muted">Aún no hay gastos confirmados en este plan.</p>
      )}
    </div>
  );
}
