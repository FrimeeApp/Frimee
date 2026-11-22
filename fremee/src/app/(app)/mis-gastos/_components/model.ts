import type { ExpenseItem } from "@/components/plans/modals/ExpenseDetailModal";

export type PlanFilter = "all" | number;

export type PlanGroup = {
  planId: number;
  planName: string;
  items: ExpenseItem[];
  /** Suma de lo que te deben en este plan (0 si solo hay pagos tuyos). */
  owedSubtotal: number;
};

export type PlanOption = { id: number; name: string; count: number };

const time = (item: ExpenseItem) => new Date(item.date).getTime();

/** Te toca a ti: confirmar un pago recibido o pagar tú. */
export const needsYou = (i: ExpenseItem) =>
  (i.direction === "incoming" && i.estado === "EN_REVISION") ||
  (i.direction === "outgoing" && i.estado === "PENDIENTE");

/** Esperando a otros: te deben, o ya pagaste y falta que confirmen. */
export const waitingOthers = (i: ExpenseItem) =>
  (i.direction === "incoming" && i.estado === "PENDIENTE") ||
  (i.direction === "outgoing" && i.estado === "EN_REVISION");

export const isOpen = (i: ExpenseItem) => i.estado === "PENDIENTE" || i.estado === "EN_REVISION";

// Dentro de cada zona: primero confirmar y luego pagar; primero lo que te deben y luego tus pagos por confirmar.
function rank(i: ExpenseItem): number {
  if (i.direction === "incoming" && i.estado === "EN_REVISION") return 0;
  if (i.direction === "outgoing" && i.estado === "PENDIENTE") return 1;
  if (i.direction === "incoming" && i.estado === "PENDIENTE") return 2;
  return 3;
}

/** Agrupa por plan; los planes van por lo más urgente y, a igualdad, por lo más reciente. */
export function groupByPlan(items: ExpenseItem[]): PlanGroup[] {
  const map = new Map<number, ExpenseItem[]>();
  for (const item of items) {
    const list = map.get(item.planId);
    if (list) list.push(item);
    else map.set(item.planId, [item]);
  }
  const groups: PlanGroup[] = [...map.entries()].map(([planId, list]) => {
    const sorted = [...list].sort((a, b) => rank(a) - rank(b) || time(b) - time(a));
    return {
      planId,
      planName: sorted[0].planName,
      items: sorted,
      owedSubtotal: sorted
        .filter((i) => i.direction === "incoming")
        .reduce((sum, i) => sum + i.amount, 0),
    };
  });
  return groups.sort((a, b) => {
    const ra = Math.min(...a.items.map(rank));
    const rb = Math.min(...b.items.map(rank));
    if (ra !== rb) return ra - rb;
    return Math.max(...b.items.map(time)) - Math.max(...a.items.map(time));
  });
}

export type MonthGroup = { key: string; label: string; received: number; paid: number; items: ExpenseItem[] };

export function groupByMonth(items: ExpenseItem[]): MonthGroup[] {
  const sorted = [...items].sort((a, b) => time(b) - time(a));
  const map = new Map<string, MonthGroup>();
  for (const item of sorted) {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let group = map.get(key);
    if (!group) {
      const label = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
      group = { key, label: label.charAt(0).toUpperCase() + label.slice(1), received: 0, paid: 0, items: [] };
      map.set(key, group);
    }
    group.items.push(item);
    if (item.direction === "incoming") group.received += item.amount;
    else group.paid += item.amount;
  }
  return [...map.values()];
}

/** Planes para el filtro: con el número de elementos de la pestaña y los que están al día (count 0) al final. */
export function buildPlanOptions(allItems: ExpenseItem[], tabItems: ExpenseItem[]): PlanOption[] {
  const names = new Map<number, string>();
  allItems.forEach((i) => names.set(i.planId, i.planName));
  const counts = new Map<number, number>();
  tabItems.forEach((i) => counts.set(i.planId, (counts.get(i.planId) ?? 0) + 1));
  return [...names.entries()]
    .map(([id, name]) => ({ id, name, count: counts.get(id) ?? 0 }))
    .sort((a, b) => (b.count > 0 ? 1 : 0) - (a.count > 0 ? 1 : 0) || b.count - a.count || a.name.localeCompare(b.name, "es"));
}

/** «Sara», «Sara y Diego», «Sara, Diego y 2 más». */
export function namesList(names: string[]): string {
  const unique = [...new Set(names)];
  if (unique.length <= 1) return unique[0] ?? "";
  if (unique.length === 2) return `${unique[0]} y ${unique[1]}`;
  return `${unique[0]}, ${unique[1]} y ${unique.length - 2} más`;
}
