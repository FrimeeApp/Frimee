"use client";

import { formatMoney } from "@/lib/formatters";
import type { BalanceRow } from "@/services/api/endpoints/gastos.endpoint";

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

const SERIF = { fontFamily: 'var(--font-display-face), "Instrument Serif", Georgia, serif', fontWeight: 400, letterSpacing: "-0.01em" } as const;

const firstName = (name: string | null | undefined) => (name ?? "Usuario").trim().split(" ")[0] || "Usuario";

function joinNames(names: string[]) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.length} personas`;
}

/** Tarjeta reducida de la columna lateral (Itinerario): tu situación, el total del grupo y el acceso a Gastos. El detalle vive en la pestaña. */
export function ExpenseSummaryCard({
  summary: s,
  balances,
  userId,
  onOpen,
}: {
  summary: ExpenseSummary;
  balances: BalanceRow[];
  userId: string | undefined;
  onOpen: () => void;
}) {
  const mine = balances.filter((b) => b.from_user_id === userId);
  const owedToMe = balances.filter((b) => b.to_user_id === userId);
  const debt = mine.reduce((sum, b) => sum + b.importe, 0);
  const credit = owedToMe.reduce((sum, b) => sum + b.importe, 0);

  return (
    <div className="hidden rounded-lg border border-app bg-surface p-4 md:block">
      <h3 className="text-[15px] font-[var(--fw-semibold)] text-app">Gastos</h3>

      {s.hasExpenses ? (
        <>
          {debt > 0 ? (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <span className="w-full text-[13px] font-[var(--fw-semibold)] text-app">Debes</span>
              <span className="text-[32px] leading-none tabular-nums text-app" style={SERIF}>{formatMoney(debt, s.currency)}</span>
              <span className="text-[14px] text-muted">a {joinNames(mine.map((b) => firstName(b.to_nombre)))}</span>
            </p>
          ) : credit > 0 ? (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <span className="w-full text-[13px] font-[var(--fw-semibold)] text-[var(--success)]">Te deben</span>
              <span className="text-[32px] leading-none tabular-nums text-app" style={SERIF}>{formatMoney(credit, s.currency)}</span>
              <span className="text-[14px] text-muted">{joinNames(owedToMe.map((b) => firstName(b.from_nombre)))}</span>
            </p>
          ) : (
            <p className="mt-3 text-[26px] leading-none text-app" style={SERIF}>Estás al día</p>
          )}
          <p className="mt-3 text-[13px] tabular-nums text-muted">
            {formatMoney(s.total, s.currency)} entre los {s.participantCount} · {s.count} gasto{s.count === 1 ? "" : "s"}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[14px] text-muted">Aún no hay gastos confirmados en este plan.</p>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 inline-flex min-h-10 items-center text-[14px] font-[var(--fw-semibold)] text-[var(--primary)] hover:opacity-80"
      >
        Ver gastos
      </button>
    </div>
  );
}
