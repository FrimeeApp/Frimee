import type { GastoRow } from "@/services/api/endpoints/gastos.endpoint";

/* La parte de quien paga un gasto no se guarda en `gasto_partes` (fn_gasto_insert_partes la salta):
 * ahí solo están las partes de los demás, es decir, lo que le deben al pagador.
 * Por eso lo que le toca al pagador es lo que sobra al restar esas partes del total. */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Lo que los demás le deben a quien pagó el gasto. */
export function owedToPayer(g: Pick<GastoRow, "partes">): number {
  return round2((g.partes ?? []).reduce((s, p) => s + Number(p.importe), 0));
}

/** Lo que le toca a una persona de este gasto: su parte guardada o, si pagó ella, lo que queda del total. */
export function shareOf(g: Pick<GastoRow, "partes" | "total" | "pagado_por_user_id">, userId: string | null | undefined): number {
  if (!userId) return 0;
  if (g.pagado_por_user_id === userId) return Math.max(0, round2(Number(g.total) - owedToPayer(g)));
  return Number(g.partes?.find((p) => p.user_id === userId)?.importe ?? 0);
}

/** ¿El gasto le toca algo a esta persona? (los que no participan salen como «no participas»). */
export const takesPart = (g: Pick<GastoRow, "partes" | "total" | "pagado_por_user_id">, userId: string | null | undefined) =>
  shareOf(g, userId) > 0.005;
