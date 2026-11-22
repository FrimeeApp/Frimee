"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, FileText, Pencil, Plus, Search, WalletCards } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatMoney } from "@/lib/formatters";
import { owedToPayer, takesPart } from "@/lib/gastos-shares";
import type { BalanceRow, GastoRow, Topes } from "@/services/api/endpoints/gastos.endpoint";
import { AddBudgetButton, GroupBudget, MyTope } from "./BudgetBits";
import type { ExpenseSummary } from "./ExpenseSummaryCard";
import { normalizeDateKey } from "./plan-utils";

/* Pestaña Gastos del plan. Solo presentación: los datos y las acciones llegan por props. */

const SERIF = { fontFamily: 'var(--font-display-face), "Instrument Serif", Georgia, serif', fontWeight: 400, letterSpacing: "-0.01em" } as const;
const ME_TINT = "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]";
const SHADES = [1, 0.68, 0.42, 0.22];
const SEARCH_FROM = 15;
const CATS_TOP = 3;
const SUBPLANS_SHOWN = 4;

type Filter = "todos" | "mios" | "afectan";

type Props = {
  gastos: GastoRow[];
  balances: BalanceRow[];
  userId: string | undefined;
  summary: ExpenseSummary;
  planStart: string | null;
  isPast: boolean;
  canAdd: boolean;
  onOpenGasto: (id: number) => void;
  onPagar: (balance: BalanceRow) => void;
  onAdd: () => void;
  onPdf: () => void;
  /** Presupuesto del grupo y tope personal; null en cada uno si no hay. */
  topes: Topes;
  isAdmin: boolean;
  /** Abre la hoja de presupuesto en «Del grupo» o «Solo mío». */
  onEditTope: (mode: "grupo" | "mio") => void;
};

const firstName = (name: string | null | undefined) => (name ?? "Usuario").trim().split(" ")[0] || "Usuario";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const catOf = (g: GastoRow) => g.categoria_nombre ?? "Otros";
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function joinNames(names: string[]) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.length} personas`;
}

function dayTitle(key: string, planStart: string | null) {
  const d = new Date(`${key}T12:00:00`);
  const wd = cap(new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(d).replace(".", ""));
  const mo = new Intl.DateTimeFormat("es-ES", { month: "short" }).format(d).replace(".", "");
  const label = `${wd} ${d.getDate()} ${mo}`;
  if (!planStart) return label;
  const diff = Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${normalizeDateKey(planStart)}T00:00:00Z`)) / 86400000);
  return diff >= 0 ? `${label} · Día ${diff + 1}` : label;
}

export function GastosTab({ gastos, balances, userId, summary, planStart, isPast, canAdd, onOpenGasto, onPagar, onAdd, onPdf, topes, isAdmin, onEditTope }: Props) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [cat, setCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [owedOpen, setOwedOpen] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const [allCats, setAllCats] = useState(false);
  const [allSubplans, setAllSubplans] = useState(false);
  const currency = summary.currency;

  /* ── Tu cuenta y deudas ── */
  const mine = useMemo(() => balances.filter((b) => b.from_user_id === userId), [balances, userId]);
  const owedToMe = useMemo(() => balances.filter((b) => b.to_user_id === userId), [balances, userId]);
  const others = useMemo(() => balances.filter((b) => b.from_user_id !== userId && b.to_user_id !== userId), [balances, userId]);
  const othersByDebtor = useMemo(() => {
    const map = new Map<string, BalanceRow[]>();
    others.forEach((b) => map.set(b.from_user_id, [...(map.get(b.from_user_id) ?? []), b]));
    return [...map.values()].sort((a, b) => sum(b.map((d) => d.importe)) - sum(a.map((d) => d.importe)));
  }, [others]);

  const debt = sum(mine.map((b) => b.importe));
  const credit = sum(owedToMe.map((b) => b.importe));

  /* ── Categorías y subplanes (solo gastos confirmados) ── */
  const confirmed = useMemo(() => gastos.filter((g) => g.estado === "CONFIRMADO"), [gastos]);
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    confirmed.forEach((g) => map.set(catOf(g), (map.get(catOf(g)) ?? 0) + g.total));
    const total = sum([...map.values()]) || 1;
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, amount], i) => ({ label, amount, pct: Math.round((amount / total) * 100), shade: SHADES[Math.min(i, SHADES.length - 1)] }));
  }, [confirmed]);
  const collapsible = categories.length > CATS_TOP + 1;
  const shownCats: ((typeof categories)[number] & { other?: boolean })[] =
    allCats || !collapsible
      ? categories
      : [
          ...categories.slice(0, CATS_TOP),
          (() => {
            const rest = categories.slice(CATS_TOP);
            return { label: "Otras", amount: sum(rest.map((c) => c.amount)), pct: sum(rest.map((c) => c.pct)), shade: SHADES[SHADES.length - 1], other: true };
          })(),
        ];
  const pickCat = (c: { label: string; other?: boolean }) => (c.other ? setAllCats(true) : setCat(cat === c.label ? null : c.label));
  const showCategories = categories.length > 0 && !(categories.length === 1 && categories[0].label === "Otros");
  const subplans = useMemo(() => {
    const map = new Map<string, number>();
    confirmed.forEach((g) => { if (g.subplan_titulo) map.set(g.subplan_titulo, (map.get(g.subplan_titulo) ?? 0) + g.total); });
    const withSub = sum([...map.values()]);
    return { rows: [...map.entries()].sort((a, b) => b[1] - a[1]), rest: summary.total - withSub };
  }, [confirmed, summary.total]);

  /* ── Lista de gastos ── */
  const live = useMemo(() => gastos.filter((g) => g.estado !== "ANULADO"), [gastos]);
  const paidByMeCount = live.filter((g) => g.pagado_por_user_id === userId).length;
  const affectCount = live.filter((g) => takesPart(g, userId)).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gastos.filter((g) => {
      if (filter === "mios" && g.pagado_por_user_id !== userId) return false;
      if (filter === "afectan" && !takesPart(g, userId)) return false;
      if (cat && catOf(g) !== cat) return false;
      if (q && !g.titulo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [gastos, filter, cat, query, userId]);

  const drafts = visible.filter((g) => g.estado === "BORRADOR");
  const groups = useMemo(() => {
    const start = planStart ? normalizeDateKey(planStart) : null;
    const map = new Map<string, GastoRow[]>();
    visible
      .filter((g) => g.estado !== "BORRADOR")
      .sort((a, b) => b.fecha_gasto.localeCompare(a.fecha_gasto) || b.created_at.localeCompare(a.created_at))
      .forEach((g) => {
        const k = normalizeDateKey(g.fecha_gasto);
        const key = start && k < start ? "antes" : k;
        map.set(key, [...(map.get(key) ?? []), g]);
      });
    const days = [...map.entries()].filter(([k]) => k !== "antes");
    const before = map.get("antes");
    return [...days, ...(before ? ([["antes", before]] as [string, GastoRow[]][]) : [])];
  }, [visible, planStart]);

  /* ── Estado vacío ── */
  if (gastos.length === 0) {
    return (
      <div className="mx-auto flex max-w-[360px] flex-col items-center gap-2 pt-[var(--space-8)] text-center">
        <WalletCards className="size-8 text-muted" strokeWidth={1.75} aria-hidden />
        <h2 className="text-[18px] font-[var(--fw-semibold)] text-app">{isPast ? "Este plan no tuvo gastos" : "Sin gastos todavía"}</h2>
        {!isPast && <p className="text-[14px] leading-[1.5] text-muted">Apunta el primero y Frimee irá calculando quién debe a quién.</p>}
        {!isPast && canAdd && (
          <button type="button" onClick={onAdd} className="mt-2 h-[46px] rounded-lg bg-primary-token px-4 text-[15px] font-[var(--fw-semibold)] text-contrast-token">
            Añadir gasto
          </button>
        )}
      </div>
    );
  }

  const chip = (on: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-[var(--fw-semibold)] ${on ? "border-2 border-[var(--primary)] px-[13px] text-app" : "border border-app text-muted"}`;

  const money = (n: number, c = currency) => formatMoney(n, c);
  const hasPdf = gastos.length > 0;

  /* Presupuesto del grupo (en «Entre los N») y tope personal (en «Tu cuenta»). Con el plan terminado no se editan. */
  const groupBudget = topes.grupo ? (
    <GroupBudget
      spent={summary.total}
      limit={topes.grupo.limite}
      currency={currency}
      people={summary.participantCount}
      segments={categories}
      onEdit={isPast ? undefined : () => onEditTope("grupo")}
    />
  ) : isAdmin && !isPast ? (
    <AddBudgetButton label="Poner un presupuesto" onClick={() => onEditTope("grupo")} />
  ) : null;
  const myTope = topes.mio ? (
    <MyTope share={summary.yourShare} limit={topes.mio.limite} currency={currency} onEdit={isPast ? undefined : () => onEditTope("mio")} />
  ) : !isPast ? (
    <AddBudgetButton label="Ponerte un tope" hint="solo lo ves tú" onClick={() => onEditTope("mio")} />
  ) : null;

  return (
    <div className="mx-auto max-w-[1100px] md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-14">
      <div className="min-w-0 md:max-w-[720px]">
        {isPast && hasPdf && (
          <button type="button" onClick={onPdf} className="mb-3 flex h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-primary-token text-[15px] font-[var(--fw-semibold)] text-contrast-token md:hidden">
            <FileText className="size-[18px]" aria-hidden />Factura final
          </button>
        )}

        {/* Tu cuenta */}
        <section aria-label="Tu cuenta" className="rounded-lg border border-app bg-surface p-4 md:px-6 md:py-5">
          <div className="md:flex md:items-end md:justify-between md:gap-8">
          <div>
            {debt > 0 ? (
              <>
                <p className="inline-flex items-center gap-1 text-[14px] font-[var(--fw-semibold)] text-app"><ArrowUpRight className="size-4" aria-hidden />Debes</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="text-[44px] leading-none tabular-nums" style={SERIF}>{money(debt)}</span>
                  <span className="text-[15px] text-muted">a {joinNames(mine.map((b) => firstName(b.to_nombre)))}</span>
                </p>
              </>
            ) : credit > 0 ? (
              <>
                <p className="inline-flex items-center gap-1 text-[14px] font-[var(--fw-semibold)] text-[var(--success)]"><ArrowDownLeft className="size-4" aria-hidden />Te deben</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="text-[44px] leading-none tabular-nums" style={SERIF}>{money(credit)}</span>
                  <span className="text-[15px] text-muted">{joinNames(owedToMe.map((b) => firstName(b.from_nombre)))}</span>
                </p>
              </>
            ) : (
              <>
                <p className="text-[14px] font-[var(--fw-semibold)] text-muted">Tu cuenta</p>
                <p className="mt-1 text-[32px] leading-none" style={SERIF}>Estás al día</p>
              </>
            )}
          </div>
          <div className="mt-3.5 flex gap-6 border-t border-app pt-3 md:mt-0 md:border-0 md:pt-0">
            <div><p className="text-[12px] text-muted">Pagaste</p><p className="mt-0.5 text-[16px] font-[var(--fw-semibold)] tabular-nums text-app">{money(summary.paidByYou)}</p></div>
            <div><p className="text-[12px] text-muted">Tu parte</p><p className="mt-0.5 text-[16px] font-[var(--fw-semibold)] tabular-nums text-app">{money(summary.yourShare)}</p></div>
          </div>
          </div>
          {myTope}
        </section>

        {/* Quién debe a quién */}
        <section aria-label="Quién debe a quién">
          <h2 className="mb-1 mt-7 flex items-baseline gap-2 text-[13px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">
            Quién debe a quién
            <span className="ml-auto font-[var(--fw-medium)] tabular-nums">
              {balances.length === 0 ? "Todo saldado" : `${balances.length} ${balances.length === 1 ? "pago" : "pagos"} y queda todo saldado`}
            </span>
          </h2>
          {balances.length === 0 ? (
            <p className="border-b border-app py-4 text-[14px] text-muted">Nadie debe nada en este plan.</p>
          ) : (
            <>
              {mine.map((b) => (
                <div key={b.liquidacion_id} className={`-mx-3 flex min-h-16 items-center gap-3 rounded-lg px-3 py-2.5 ${ME_TINT}`}>
                  <Avatar name={b.to_nombre ?? "Usuario"} src={b.to_profile_image} px={36} topMargin="" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[15px] font-[var(--fw-semibold)] text-app">Debes a {firstName(b.to_nombre)}</b>
                    <span className="block text-[13px] text-muted">Pendiente de pagar</span>
                  </div>
                  <b className="text-[16px] font-[var(--fw-semibold)] tabular-nums text-app">{money(b.importe)}</b>
                  <button type="button" onClick={() => onPagar(b)} className="h-10 shrink-0 rounded-lg bg-primary-token px-3.5 text-[14px] font-[var(--fw-semibold)] text-contrast-token">Pagar</button>
                </div>
              ))}
              {owedToMe.length === 1 &&
                owedToMe.map((b) => (
                  <div key={b.liquidacion_id} className="flex min-h-16 items-center gap-3 border-b border-app py-2">
                    <Avatar name={b.from_nombre ?? "Usuario"} src={b.from_profile_image} px={36} topMargin="" />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] font-[var(--fw-semibold)] text-app">{firstName(b.from_nombre)} te debe</b>
                      <span className="block text-[13px] text-muted">Pendiente de cobrar</span>
                    </div>
                    <b className="text-[15px] font-[var(--fw-semibold)] tabular-nums text-[var(--success)]">{money(b.importe)}</b>
                  </div>
                ))}
              {owedToMe.length > 1 && (
                <div>
                  <button
                    type="button"
                    aria-expanded={owedOpen}
                    onClick={() => setOwedOpen((v) => !v)}
                    className="flex min-h-16 w-full items-center gap-3 border-b border-app py-2 text-left"
                  >
                    <span className="flex shrink-0 items-center">
                      {owedToMe.slice(0, 3).map((b, i) => (
                        <Avatar key={b.liquidacion_id} name={b.from_nombre ?? "Usuario"} src={b.from_profile_image} px={36} topMargin="" className={`ring-2 ring-[var(--bg)] ${i > 0 ? "-ml-3" : ""}`} />
                      ))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] font-[var(--fw-semibold)] text-app">{owedToMe.length} personas te deben</b>
                      <span className="block text-[13px] text-muted">Pendiente de cobrar</span>
                    </div>
                    <b className="text-[15px] font-[var(--fw-semibold)] tabular-nums text-[var(--success)]">{money(credit)}</b>
                    <ChevronDown className={`size-[18px] text-muted transition-transform ${owedOpen ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {owedOpen && (
                    <div className="pb-1.5 pl-12">
                      {owedToMe.map((b) => (
                        <div key={b.liquidacion_id} className="flex min-h-11 items-center gap-2.5 border-b border-app">
                          <Avatar name={b.from_nombre ?? "Usuario"} src={b.from_profile_image} px={28} topMargin="" />
                          <span className="min-w-0 flex-1 truncate text-[14px] font-[var(--fw-semibold)] text-app">{firstName(b.from_nombre)}</span>
                          <span className="text-[14px] tabular-nums text-[var(--success)]">{money(b.importe)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {others.length > 0 && (
                <div>
                  <button
                    type="button"
                    aria-expanded={othersOpen}
                    onClick={() => setOthersOpen((v) => !v)}
                    className="flex min-h-14 w-full items-center gap-3 border-b border-app py-2 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-[14px] text-muted">
                      <b className="font-[var(--fw-semibold)] text-app">{others.length} {others.length === 1 ? "pago" : "pagos"} entre los demás</b> · No te afecta
                    </span>
                    <ChevronDown className={`size-[18px] text-muted transition-transform ${othersOpen ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {othersOpen && (
                    <>
              {othersByDebtor.map((debts) => {
                const d = debts[0];
                const many = debts.length > 1;
                const isOpen = open.has(d.from_user_id);
                const row = (
                  <>
                    <Avatar name={d.from_nombre ?? "Usuario"} src={d.from_profile_image} px={36} topMargin="" />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] font-[var(--fw-medium)] text-app">
                        <span className="font-[var(--fw-semibold)]">{firstName(d.from_nombre)}</span> debe a {many ? `${debts.length} personas` : firstName(d.to_nombre)}
                      </b>
                      <span className="block text-[13px] text-muted">No te afecta</span>
                    </div>
                    <b className="text-[15px] font-[var(--fw-medium)] tabular-nums text-app">{money(sum(debts.map((x) => x.importe)))}</b>
                    {many && <ChevronDown className={`size-[18px] text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />}
                  </>
                );
                return (
                  <div key={d.from_user_id}>
                    {many ? (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen((prev) => { const n = new Set(prev); if (n.has(d.from_user_id)) n.delete(d.from_user_id); else n.add(d.from_user_id); return n; })}
                        className="flex min-h-16 w-full items-center gap-3 border-b border-app py-2 text-left"
                      >{row}</button>
                    ) : (
                      <div className="flex min-h-16 items-center gap-3 border-b border-app py-2">{row}</div>
                    )}
                    {many && isOpen && (
                      <div className="pb-1.5 pl-12">
                        {debts.map((x) => (
                          <div key={x.liquidacion_id} className="flex min-h-11 items-center gap-2.5 border-b border-app">
                            <Avatar name={x.to_nombre ?? "Usuario"} src={x.to_profile_image} px={28} topMargin="" />
                            <span className="flex-1 text-[14px] text-app">a <b className="font-[var(--fw-semibold)]">{firstName(x.to_nombre)}</b></span>
                            <span className="text-[14px] tabular-nums text-app">{money(x.importe)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* Entre todos · móvil */}
        <section aria-label="Entre todos" className="mt-5 md:hidden">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-muted">Entre los {summary.participantCount}</p>
              <p className="mt-0.5 text-[20px] font-[var(--fw-semibold)] tabular-nums text-app">{money(summary.total)}</p>
              <p className="mt-0.5 text-[12px] tabular-nums text-muted">
                {summary.count} {summary.count === 1 ? "gasto" : "gastos"}
                {summary.participantCount > 0 && ` · ${money(summary.total / summary.participantCount)} por persona`}
              </p>
            </div>
            {!isPast && hasPdf && (
              <button type="button" onClick={onPdf} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-0.5 text-[14px] font-[var(--fw-semibold)] text-[var(--primary)]">
                <FileText className="size-[18px]" aria-hidden />Resumen PDF
              </button>
            )}
          </div>
          {groupBudget}
          {showCategories && (
            <>
              {!topes.grupo && (
                <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded" role="img" aria-label={categories.map((c) => `${c.label} ${c.pct} %`).join(", ")}>
                  {categories.map((c) => <i key={c.label} style={{ width: `${c.pct}%`, background: "var(--text-primary)", opacity: c.shade }} />)}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {shownCats.map((c) => (
                  <button key={c.label} type="button" aria-pressed={cat === c.label} onClick={() => pickCat(c)} className={`${chip(cat === c.label)} !h-8 !px-2.5 !text-[12px]`}>
                    <span aria-hidden className="size-2 rounded-[2px]" style={{ background: "var(--text-primary)", opacity: c.shade }} />
                    {c.label} <b className="font-[var(--fw-semibold)] tabular-nums text-app">{c.pct} %</b>
                  </button>
                ))}
                {collapsible && allCats && (
                  <button type="button" onClick={() => setAllCats(false)} className="inline-flex h-8 items-center px-2 text-[12px] font-[var(--fw-semibold)] text-[var(--primary)]">Ver menos</button>
                )}
              </div>
            </>
          )}
        </section>

        {/* Gastos */}
        <section aria-label="Gastos">
          <h2 className="mb-1 mt-7 flex items-baseline gap-2 text-[13px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">
            Gastos<span className="ml-auto font-[var(--fw-medium)] tabular-nums">{summary.count}</span>
          </h2>
          {gastos.length >= SEARCH_FROM && (
            <label className="mb-2 flex h-11 items-center gap-2.5 rounded-lg border border-app bg-surface-2 px-3 text-muted">
              <Search className="size-4" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar un gasto" aria-label="Buscar un gasto" className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-app outline-none placeholder:text-muted" />
            </label>
          )}
          <div className="mb-0.5 mt-1.5 flex gap-1.5 overflow-x-auto">
            <button type="button" aria-pressed={filter === "todos"} onClick={() => setFilter("todos")} className={chip(filter === "todos")}>Todos</button>
            <button type="button" aria-pressed={filter === "mios"} onClick={() => setFilter("mios")} className={chip(filter === "mios")}>Pagados por ti <b className="tabular-nums text-app">{paidByMeCount}</b></button>
            <button type="button" aria-pressed={filter === "afectan"} onClick={() => setFilter("afectan")} className={chip(filter === "afectan")}>Te afectan <b className="tabular-nums text-app">{affectCount}</b></button>
            {cat && <button type="button" onClick={() => setCat(null)} className={chip(true)}>{cat} <span aria-hidden>×</span><span className="sr-only">Quitar filtro</span></button>}
          </div>

          {visible.length === 0 && <p className="py-6 text-[14px] text-muted">Ningún gasto coincide con lo que has elegido.</p>}

          {drafts.map((g) => (
            <div key={g.id} className="flex min-h-16 items-center gap-3 border-b border-dashed border-app py-2">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-app text-muted"><Pencil className="size-[15px]" /></span>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-[var(--fw-semibold)] text-app">{g.titulo} <span className="ml-1 inline-flex h-5 items-center rounded-full border border-app px-[7px] align-[1px] text-[11px] font-[var(--fw-semibold)]">Borrador</span></b>
                <span className="block truncate text-[13px] text-muted">{firstName(g.pagado_por_nombre)} · sin repartir · no cuenta</span>
              </div>
              <button type="button" onClick={() => onOpenGasto(g.id)} className="min-h-10 shrink-0 text-[14px] font-[var(--fw-semibold)] text-[var(--primary)]">Terminar</button>
            </div>
          ))}

          {groups.map(([key, items]) => (
            <div key={key}>
              <h3 className="flex items-baseline gap-2 border-b border-app pb-1 pt-4 text-[14px] font-[var(--fw-semibold)] text-app">
                {key === "antes" ? "Antes del viaje" : dayTitle(key, planStart)}
                <span className="ml-auto text-[13px] font-[var(--fw-medium)] tabular-nums text-muted">
                  {money(sum(items.filter((g) => g.estado === "CONFIRMADO").map((g) => g.total)))}
                </span>
              </h3>
              {items.map((g) => <GastoRowItem key={g.id} g={g} userId={userId} onOpen={() => onOpenGasto(g.id)} />)}
            </div>
          ))}
        </section>
      </div>

      {/* Entre todos · escritorio */}
      <aside aria-label="Entre todos" className="hidden flex-col gap-4 md:sticky md:top-6 md:flex md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto">
        {isPast && hasPdf ? (
          <button type="button" onClick={onPdf} className="flex h-[46px] w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-token text-[15px] font-[var(--fw-semibold)] text-contrast-token">
            <FileText className="size-[18px]" aria-hidden />Factura final (PDF)
          </button>
        ) : !isPast && canAdd ? (
          <button type="button" onClick={onAdd} className="flex h-[46px] w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-token text-[15px] font-[var(--fw-semibold)] text-contrast-token">
            <Plus className="size-[18px]" strokeWidth={2.25} aria-hidden />Añadir gasto
          </button>
        ) : null}
        <section className="shrink-0 rounded-lg border border-app bg-surface p-5">
          <p className="text-[12px] text-muted">Entre los {summary.participantCount}{isPast && " · plan terminado"}</p>
          <p className="mt-0.5 text-[28px] font-[var(--fw-semibold)] tabular-nums text-app">{money(summary.total)}</p>
          <p className="mt-0.5 text-[12px] tabular-nums text-muted">
            {summary.count} {summary.count === 1 ? "gasto" : "gastos"}
            {summary.participantCount > 0 && ` · ${money(summary.total / summary.participantCount)} por persona`}
          </p>
          {groupBudget}
          {showCategories && (
            <>
              <p className="mb-1 mt-5 text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">En qué se ha ido</p>
              {shownCats.map((c) => (
                <button key={c.label} type="button" aria-pressed={cat === c.label} onClick={() => pickCat(c)} className="grid w-full grid-cols-[minmax(0,1fr)_88px] gap-x-2.5 gap-y-1 py-1.5 text-left">
                  <span className={`truncate text-[14px] ${cat === c.label ? "font-[var(--fw-semibold)]" : ""} text-app`}>{c.label}</span>
                  <span className="text-right text-[14px] tabular-nums text-app">{money(c.amount)}</span>
                  <span className="flex h-1.5 items-center overflow-hidden rounded bg-surface-2"><i className="block h-full" style={{ width: `${c.pct}%`, background: "var(--text-primary)", opacity: c.shade }} /></span>
                  <span className="text-right text-[12px] tabular-nums text-muted">{c.pct} %</span>
                </button>
              ))}
              {collapsible && allCats && (
                <button type="button" onClick={() => setAllCats(false)} className="mt-1 min-h-9 text-[13px] font-[var(--fw-semibold)] text-[var(--primary)]">Ver menos</button>
              )}
            </>
          )}
          {subplans.rows.length > 1 && (
            <>
              <p className="mb-1 mt-5 text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">Por subplan</p>
              {subplans.rows.slice(0, SUBPLANS_SHOWN).map(([name, amount]) => (
                <div key={name} className="flex items-baseline gap-2 py-1 text-[14px] text-app"><span className="min-w-0 flex-1 truncate">{name}</span><span className="tabular-nums">{money(amount)}</span></div>
              ))}
              {allSubplans && subplans.rows.slice(SUBPLANS_SHOWN).map(([name, amount]) => (
                <div key={name} className="flex items-baseline gap-2 py-1 text-[14px] text-app"><span className="min-w-0 flex-1 truncate">{name}</span><span className="tabular-nums">{money(amount)}</span></div>
              ))}
              {subplans.rows.length > SUBPLANS_SHOWN && (
                <button type="button" onClick={() => setAllSubplans((v) => !v)} className="flex min-h-9 w-full items-baseline gap-2 py-1 text-left text-[13px] font-[var(--fw-semibold)] text-[var(--primary)]">
                  {allSubplans ? "Ver menos" : <><span className="flex-1">Y {subplans.rows.length - SUBPLANS_SHOWN} más</span><span className="tabular-nums">{money(sum(subplans.rows.slice(SUBPLANS_SHOWN).map((r) => r[1])))}</span></>}
                </button>
              )}
              {subplans.rest > 0.005 && (
                <div className="flex items-baseline gap-2 py-1 text-[14px] text-muted"><span className="flex-1">Sin subplan</span><span className="tabular-nums">{money(subplans.rest)}</span></div>
              )}
            </>
          )}
          {!isPast && hasPdf && (
            <button type="button" onClick={onPdf} aria-label="Resumen parcial en PDF" className="mt-4 flex h-[46px] w-full items-center justify-center gap-2 rounded-lg border border-app text-[15px] font-[var(--fw-semibold)] text-app hover:bg-surface-2">
              <FileText className="size-[18px]" aria-hidden />Resumen PDF
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}

function GastoRowItem({ g, userId, onOpen }: { g: GastoRow; userId: string | undefined; onOpen: () => void }) {
  const paidByMe = g.pagado_por_user_id === userId;
  const myPart = paidByMe ? undefined : g.partes?.find((p) => p.user_id === userId)?.importe;
  const anulado = g.estado === "ANULADO";
  const owed = paidByMe ? owedToPayer(g) : 0;
  const detail = [paidByMe ? "Pagaste tú" : `Pagó ${firstName(g.pagado_por_nombre)}`, g.categoria_nombre, g.subplan_titulo].filter(Boolean).join(" · ");

  let sub: React.ReactNode = null;
  let muted = false;
  if (anulado) sub = <span className="inline-flex h-5 items-center rounded-full border border-app px-[7px] text-[11px] font-[var(--fw-semibold)] text-app">Anulado</span>;
  else if (paidByMe) sub = owed > 0.005 ? <span className="text-[var(--success)]">te deben {formatMoney(owed, g.moneda)}</span> : null;
  else if (myPart != null) sub = <>tu parte {formatMoney(myPart, g.moneda)}</>;
  else { sub = <>no participas</>; muted = true; }

  return (
    <button type="button" onClick={onOpen} aria-label={`${g.titulo}, ${formatMoney(g.total, g.moneda)}`} className="flex min-h-16 w-full items-center gap-3 border-b border-app py-2 text-left">
      <span className={paidByMe && !anulado ? "rounded-full ring-1 ring-[var(--primary)]" : ""}>
        <Avatar name={g.pagado_por_nombre ?? "Usuario"} src={g.pagado_por_foto} px={36} topMargin="" />
      </span>
      <div className="min-w-0 flex-1">
        <b className={`block truncate text-[15px] font-[var(--fw-semibold)] ${anulado ? "text-muted line-through" : "text-app"}`}>{g.titulo}</b>
        <span className="block truncate text-[13px] text-muted">{detail}</span>
      </div>
      <div className="shrink-0 text-right">
        <b className={`block text-[15px] tabular-nums ${anulado ? "font-[var(--fw-semibold)] text-muted line-through" : muted ? "font-[var(--fw-medium)] text-muted" : "font-[var(--fw-semibold)] text-app"}`}>{formatMoney(g.total, g.moneda)}</b>
        {sub && <span className="mt-0.5 block text-[12px] tabular-nums text-muted">{sub}</span>}
      </div>
    </button>
  );
}
