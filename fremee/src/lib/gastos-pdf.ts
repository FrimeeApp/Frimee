import type { BalanceRow, GastoRow } from "@/services/api/endpoints/gastos.endpoint";
import { formatMoney } from "@/lib/formatters";

/* Resumen / factura de gastos de un plan.
 * buildGastosPdf() prepara los datos y los reparte en páginas A4 (794 × 1123 px);
 * renderGastosPdf() los dibuja con jsPDF y la vista previa del modal los pinta en HTML con las mismas páginas. */

export const PAGE_W = 794;
export const PAGE_H = 1123;
export const PAD_X = 60;
export const TOP = 56;
const BOTTOM = 1050; // por debajo va el pie
export const CONTENT_W = PAGE_W - PAD_X * 2;

export type PdfInput = {
  planTitulo: string;
  ubicacion: string | null;
  inicioAt: string;
  finAt: string;
  isPast: boolean;
  gastos: GastoRow[];
  balances: BalanceRow[];
  currency: string;
  generatedAt: Date;
};

export type Payment = { from: string; to: string; amount: string };
export type BalanceLine = { name: string; paid: string; share: string; saldo: number; text: string; ratio: number };
export type CatLine = { label: string; pct: number; amount: string; ratio: number };
export type SubLine = { label: string; count: number; amount: string };
export type Item =
  | { k: "group"; title: string; subtotal: string }
  | { k: "row"; when: string; title: string; detail: string; paid: string; between: string; amount: string }
  | { k: "total"; label: string; amount: string }
  | { k: "note"; text: string };

export type Block =
  | { t: "head" }
  | { t: "pagos"; rows: Payment[]; total: string; cont: boolean }
  | { t: "balance"; rows: BalanceLine[]; cont: boolean; note: boolean }
  | { t: "split" }
  | { t: "gastos"; items: Item[]; cont: boolean };

export type PdfModel = {
  kind: "Factura final" | "Resumen parcial";
  title: string;
  subtitle: string;
  generated: string;
  partialNote: string | null;
  endLabel: string;
  stats: { label: string; value: string }[];
  categories: CatLine[];
  subplans: SubLine[];
  pages: Block[][];
  fileName: string;
  footerLabel: string;
  gastosCount: number;
};

/* Alturas (px) compartidas por la paginación, el dibujo y la vista previa */
export const H = { h2: 38, thead: 26, payRow: 34, balRow: 34, balNote: 22, catRow: 28, subRow: 30, group: 28, row: 40, total: 40, note: 34, gap: 28, runHead: 50 };
export const headHeight = (partial: boolean) => (partial ? 270 : 218);

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const first = (n: string | null | undefined) => (n ?? "Usuario").trim().split(" ")[0] || "Usuario";
const dayKey = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : new Date(iso).toISOString().slice(0, 10));

function joinList(xs: string[]) {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}
function range(a: Date, b: Date) {
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return sameMonth
    ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}
function slug(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plan";
}

export function buildGastosPdf(input: PdfInput): PdfModel {
  const { currency, isPast } = input;
  const money = (n: number, c = currency) => formatMoney(n, c);
  const confirmed = input.gastos.filter((g) => g.estado === "CONFIRMADO");
  const total = confirmed.reduce((s, g) => s + g.total, 0);

  /* Personas */
  const people = new Map<string, string>();
  confirmed.forEach((g) => {
    people.set(g.pagado_por_user_id, first(g.pagado_por_nombre));
    g.partes?.forEach((p) => people.set(p.user_id, first(p.nombre)));
  });
  const names = [...people.values()];
  const start = new Date(input.inicioAt);
  const end = new Date(input.finAt);
  const kind = isPast ? "Factura final" : "Resumen parcial";

  const stats = [
    { label: "Total gastado", value: money(total) },
    { label: "Gastos", value: String(confirmed.length) },
    { label: "Personas", value: String(people.size) },
    { label: "Por persona", value: money(people.size ? total / people.size : 0) },
  ];

  /* Pagos para quedar en paz */
  const payments: Payment[] = [...input.balances]
    .sort((a, b) => first(a.from_nombre).localeCompare(first(b.from_nombre)) || b.importe - a.importe)
    .map((b) => ({ from: first(b.from_nombre), to: first(b.to_nombre), amount: money(b.importe) }));
  const paymentsTotal = money(input.balances.reduce((s, b) => s + b.importe, 0));

  /* Balance por persona */
  const per = new Map<string, { name: string; paid: number; share: number }>();
  people.forEach((name, id) => per.set(id, { name, paid: 0, share: 0 }));
  confirmed.forEach((g) => {
    per.get(g.pagado_por_user_id)!.paid += g.total;
    g.partes?.forEach((p) => { per.get(p.user_id)!.share += p.importe; });
  });
  const rawBal = [...per.values()].map((p) => ({ ...p, saldo: p.paid - p.share })).sort((a, b) => b.saldo - a.saldo);
  const maxAbs = Math.max(0.01, ...rawBal.map((b) => Math.abs(b.saldo)));
  const balance: BalanceLine[] = rawBal.map((b) => ({
    name: b.name,
    paid: money(b.paid),
    share: money(b.share),
    saldo: b.saldo,
    ratio: Math.abs(b.saldo) / maxAbs,
    text: b.saldo > 0.005 ? `recibe ${money(b.saldo)}` : b.saldo < -0.005 ? `paga ${money(-b.saldo)}` : "en paz",
  }));

  /* En qué se ha ido / por subplan */
  const cat = new Map<string, number>();
  confirmed.forEach((g) => cat.set(g.categoria_nombre ?? "Otros", (cat.get(g.categoria_nombre ?? "Otros") ?? 0) + g.total));
  const catSorted = [...cat.entries()].sort((a, b) => b[1] - a[1]);
  const categories: CatLine[] =
    catSorted.length === 1 && catSorted[0][0] === "Otros"
      ? []
      : catSorted.map(([label, amount]) => ({ label, amount: money(amount), pct: Math.round((amount / (total || 1)) * 100), ratio: amount / catSorted[0][1] }));

  const sub = new Map<string, { count: number; amount: number }>();
  let noSub = { count: 0, amount: 0 };
  confirmed.forEach((g) => {
    if (g.subplan_titulo) {
      const s = sub.get(g.subplan_titulo) ?? { count: 0, amount: 0 };
      sub.set(g.subplan_titulo, { count: s.count + 1, amount: s.amount + g.total });
    } else noSub = { count: noSub.count + 1, amount: noSub.amount + g.total };
  });
  const subplans: SubLine[] = sub.size
    ? [
        ...[...sub.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([label, s]) => ({ label, count: s.count, amount: money(s.amount) })),
        ...(noSub.count ? [{ label: "Sin subplan", count: noSub.count, amount: money(noSub.amount) }] : []),
      ]
    : [];

  /* Todos los gastos, por día */
  const startKey = dayKey(input.inicioAt);
  const groups = new Map<string, GastoRow[]>();
  [...confirmed]
    .sort((a, b) => a.fecha_gasto.localeCompare(b.fecha_gasto) || a.created_at.localeCompare(b.created_at))
    .forEach((g) => {
      const k = dayKey(g.fecha_gasto);
      const key = k < startKey ? "antes" : k;
      groups.set(key, [...(groups.get(key) ?? []), g]);
    });
  const order = [...(groups.has("antes") ? ["antes"] : []), ...[...groups.keys()].filter((k) => k !== "antes").sort()];
  const items: Item[] = [];
  order.forEach((key) => {
    const list = groups.get(key)!;
    let title = "Antes del viaje";
    if (key !== "antes") {
      const d = new Date(`${key}T12:00:00`);
      const n = Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${startKey}T00:00:00Z`)) / 86400000);
      title = `${WDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · Día ${n + 1}`;
    }
    items.push({ k: "group", title, subtotal: money(list.reduce((s, g) => s + g.total, 0)) });
    list.forEach((g) => {
      const d = new Date(g.fecha_gasto.length > 10 ? g.fecha_gasto : `${g.fecha_gasto}T12:00:00`);
      const when = `${d.getDate()} ${MONTHS[d.getMonth()]}${g.fecha_gasto.length > 10 ? `, ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : ""}`;
      const partes = (g.partes ?? []).map((p) => first(p.nombre));
      items.push({
        k: "row",
        when,
        title: g.titulo,
        detail: [g.categoria_nombre, g.subplan_titulo].filter(Boolean).join(" · "),
        paid: first(g.pagado_por_nombre),
        between: !partes.length ? "—" : partes.length >= people.size && people.size > 1 ? `los ${people.size}` : partes.join(", "),
        amount: money(g.total, g.moneda),
      });
    });
  });
  items.push({ k: "total", label: `Total · ${confirmed.length} ${confirmed.length === 1 ? "gasto" : "gastos"}`, amount: money(total) });
  const out = [
    ...input.gastos.filter((g) => g.estado === "BORRADOR").map((g) => `«${g.titulo}» (borrador, sin repartir)`),
    ...input.gastos.filter((g) => g.estado === "ANULADO").map((g) => `«${g.titulo}» (anulado)`),
  ];
  if (out.length) items.push({ k: "note", text: `No cuentan: ${joinList(out)}.` });

  /* Paginación */
  const pages: Block[][] = [[{ t: "head" }]];
  let y = TOP + headHeight(!isPast) + H.gap;
  const room = () => BOTTOM - y;
  const newPage = () => { pages.push([]); y = TOP + H.runHead; };
  const add = (b: Block, h: number) => { pages[pages.length - 1].push(b); y += h; };

  const flowRows = <T,>(rows: T[], rowH: number, head: number, make: (chunk: T[], cont: boolean) => Block, tail = 0) => {
    let i = 0;
    let cont = false;
    while (i < rows.length) {
      const fit = Math.floor((room() - head - tail) / rowH);
      const want = rows.length - i;
      if (fit < Math.min(2, want)) { newPage(); continue; }
      const n = Math.min(want, Math.max(fit, 1));
      add(make(rows.slice(i, i + n), cont), head + n * rowH + (i + n >= rows.length ? tail + H.gap : 0));
      i += n;
      cont = true;
      if (i < rows.length) newPage();
    }
  };

  if (payments.length) flowRows(payments, H.payRow, H.h2 + H.thead, (rows, cont) => ({ t: "pagos", rows, total: paymentsTotal, cont }));
  if (balance.length) flowRows(balance, H.balRow, H.h2 + H.thead, (rows, cont) => ({ t: "balance", rows, cont, note: false }), H.balNote);
  const splitH = H.h2 + Math.max(categories.length * H.catRow, subplans.length ? H.thead + subplans.length * H.subRow : 0) + H.gap;
  if (categories.length || subplans.length) {
    if (room() < splitH) newPage();
    add({ t: "split" }, splitH);
  }

  /* Los gastos empiezan siempre en página nueva */
  newPage();
  let from = 0;
  let cont = false;
  while (from < items.length) {
    const avail = room() - H.h2 - H.thead;
    let h = 0;
    let n = 0;
    while (from + n < items.length) {
      const it = items[from + n];
      const ih = it.k === "group" ? H.group : it.k === "row" ? H.row : it.k === "total" ? H.total : H.note;
      const next = items[from + n + 1];
      // un encabezado de día no se queda solo al final de la página
      const need = it.k === "group" && next ? ih + H.row : ih;
      if (h + need > avail && n > 0) break;
      h += ih;
      n++;
    }
    if (n === 0) { newPage(); continue; }
    pages[pages.length - 1].push({ t: "gastos", items: items.slice(from, from + n), cont });
    from += n;
    cont = true;
    if (from < items.length) newPage();
  }

  return {
    kind,
    title: input.planTitulo,
    subtitle: [input.ubicacion, range(start, end), joinList(names)].filter(Boolean).join(" · "),
    generated: `Generado el ${input.generatedAt.getDate()} ${MONTHS[input.generatedAt.getMonth()]} ${input.generatedAt.getFullYear()}, ${pad2(input.generatedAt.getHours())}:${pad2(input.generatedAt.getMinutes())}`,
    partialNote: isPast ? null : `El plan termina el ${end.getDate()} ${MONTHS[end.getMonth()]} y aún se pueden añadir gastos: las cifras de este documento pueden cambiar.`,
    endLabel: `${end.getDate()} ${MONTHS[end.getMonth()]}`,
    stats,
    categories,
    subplans,
    pages,
    fileName: `${slug(input.planTitulo)}-${isPast ? "factura" : "resumen"}.pdf`,
    footerLabel: `${input.planTitulo} · ${kind.toLowerCase()}`,
    gastosCount: confirmed.length,
  };
}

/* ───────────── dibujo con jsPDF ───────────── */

type RGB = [number, number, number];
const INK: RGB = [28, 28, 34];
const MUTED: RGB = [96, 96, 107];
const TEXT2: RGB = [58, 58, 66];
const LINE: RGB = [205, 205, 210];
const SOFT: RGB = [228, 228, 231];
const TRACK: RGB = [237, 237, 239];

export async function renderGastosPdf(m: PdfModel): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const S = doc.internal.pageSize.getWidth() / PAGE_W;
  const L = PAD_X;
  const R = PAGE_W - PAD_X;

  const font = (px: number, style: "normal" | "bold" = "normal", fam: "helvetica" | "times" = "helvetica", color: RGB = INK) => {
    doc.setFont(fam, style);
    doc.setFontSize(px * S);
    doc.setTextColor(...color);
  };
  const txt = (s: string, x: number, y: number, align: "left" | "right" | "center" = "left") => doc.text(s, x * S, y * S, { align });
  const fit = (s: string, w: number) => {
    if (doc.getTextWidth(s) <= w * S) return s;
    let t = s;
    while (t.length > 1 && doc.getTextWidth(`${t}…`) > w * S) t = t.slice(0, -1);
    return `${t}…`;
  };
  const hl = (x1: number, x2: number, y: number, w: number, c: RGB) => {
    doc.setDrawColor(...c);
    doc.setLineWidth(w * S);
    doc.line(x1 * S, y * S, x2 * S, y * S);
  };
  const box = (x: number, y: number, w: number, h: number, fill?: RGB, stroke?: RGB, sw = 1) => {
    if (fill) doc.setFillColor(...fill);
    if (stroke) { doc.setDrawColor(...stroke); doc.setLineWidth(sw * S); }
    doc.rect(x * S, y * S, w * S, h * S, fill && stroke ? "FD" : fill ? "F" : "S");
  };
  const caps = (s: string, x: number, y: number, align: "left" | "right" = "left") => {
    font(9.5, "bold", "helvetica", MUTED);
    doc.setCharSpace(0.6 * S);
    txt(s.toUpperCase(), x, y, align);
    doc.setCharSpace(0);
  };
  const h2 = (title: string, y: number, right?: string) => {
    font(15, "bold");
    txt(title, L, y + 17);
    if (right) { font(11, "normal", "helvetica", MUTED); txt(right, R, y + 17, "right"); }
    hl(L, R, y + 28, 1.5, INK);
    return y + H.h2;
  };
  const thead = (cols: { s: string; x: number; a?: "left" | "right" }[], y: number) => {
    cols.forEach((c) => caps(c.s, c.x, y + 17, c.a));
    hl(L, R, y + H.thead, 1, LINE);
    return y + H.thead;
  };
  const hatch = (x: number, y: number, w: number, h: number) => {
    box(x, y, w, h, [255, 255, 255], INK, 1);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.6 * S);
    for (let k = -h; k < w; k += 4) {
      const x1 = Math.max(0, k);
      const x2 = Math.min(w, k + h);
      if (x2 <= x1) continue;
      doc.line((x + x1) * S, (y + h - (x1 - k)) * S, (x + x2) * S, (y + h - (x2 - k)) * S);
    }
  };

  m.pages.forEach((blocks, pi) => {
    if (pi > 0) doc.addPage();
    let y = TOP;

    if (pi === 0) {
      font(20, "normal", "times");
      txt("Frimee", L, y + 18);
      caps(m.kind, R, y + 8, "right");
      font(10.5, "normal", "helvetica", MUTED);
      txt(m.generated, R, y + 24, "right");
      font(44, "normal", "times");
      txt(fit(m.title, CONTENT_W), L, y + 96);
      font(12.5, "normal", "helvetica", TEXT2);
      txt(fit(m.subtitle, CONTENT_W), L, y + 130);
      let sy = y + 152;
      if (m.partialNote) {
        doc.setLineDashPattern([3 * S, 2 * S], 0);
        doc.setDrawColor(...INK);
        doc.setLineWidth(1.5 * S);
        doc.roundedRect(L * S, (y + 142) * S, CONTENT_W * S, 44 * S, 5 * S, 5 * S, "S");
        doc.setLineDashPattern([], 0);
        font(11.5, "bold");
        txt("Resumen parcial.", L + 12, y + 168);
        const w = doc.getTextWidth("Resumen parcial. ") / S;
        font(11.5);
        txt(fit(m.partialNote, CONTENT_W - 24 - w), L + 12 + w, y + 168);
        sy = y + 204;
      }
      hl(L, R, sy, 1.5, INK);
      const fr = [1.4, 1, 1, 1.2];
      const sum = fr.reduce((a, b) => a + b, 0);
      let cx = L;
      m.stats.forEach((s, i) => {
        const w = (CONTENT_W * fr[i]) / sum;
        if (i > 0) {
          doc.setDrawColor(...SOFT);
          doc.setLineWidth(1 * S);
          doc.line(cx * S, sy * S, cx * S, (sy + 66) * S);
        }
        const px = cx + (i ? 14 : 0);
        caps(s.label, px, sy + 22);
        font(i === 0 ? 22 : 18, "bold");
        txt(s.value, px, sy + 52);
        cx += w;
      });
      hl(L, R, sy + 66, 1, LINE);
      y = TOP + headHeight(!!m.partialNote) + H.gap;
    } else {
      font(16, "normal", "times");
      txt(fit(m.title, 480), L, y + 20);
      caps(m.kind, R, y + 20, "right");
      hl(L, R, y + 30, 1, LINE);
      y = TOP + H.runHead;
    }

    blocks.forEach((b) => {
      if (b.t === "pagos") {
        y = h2("Pagos para quedar en paz", y, `${b.rows.length === 1 ? "1 pago" : `${b.rows.length} pagos`} · ${b.total}`);
        y = thead([{ s: "Paga", x: L }, { s: "A", x: L + 198 }, { s: "Importe", x: L + 564, a: "right" }, { s: "Hecho", x: R, a: "right" }], y);
        b.rows.forEach((r) => {
          font(12.5, "bold");
          txt(fit(r.from, 160), L, y + 21);
          hl(L + 172, L + 184, y + 17, 1, MUTED);
          doc.setDrawColor(...MUTED); doc.setLineWidth(1 * S);
          doc.line((L + 180) * S, (y + 13.5) * S, (L + 184) * S, (y + 17) * S);
          doc.line((L + 180) * S, (y + 20.5) * S, (L + 184) * S, (y + 17) * S);
          txt(fit(r.to, 160), L + 198, y + 21);
          txt(r.amount, L + 564, y + 21, "right");
          box(R - 13, y + 10, 13, 13, undefined, INK, 1);
          hl(L, R, y + H.payRow, 1, SOFT);
          y += H.payRow;
        });
        y += H.gap;
      } else if (b.t === "balance") {
        y = h2("Balance por persona", y, "Pagó − le toca");
        y = thead([{ s: "Persona", x: L }, { s: "Pagó", x: L + 230, a: "right" }, { s: "Le toca", x: L + 330, a: "right" }, { s: "Saldo", x: L + 350 }], y);
        b.rows.forEach((r) => {
          font(11.5, "bold");
          txt(fit(r.name, 140), L, y + 21);
          font(11.5);
          txt(r.paid, L + 230, y + 21, "right");
          txt(r.share, L + 330, y + 21, "right");
          hl(L + 350, L + 351, y + 12, 1, INK);
          doc.setDrawColor(...INK); doc.setLineWidth(1 * S); doc.line((L + 350) * S, (y + 11) * S, (L + 350) * S, (y + 23) * S);
          const w = Math.max(2, r.ratio * 120);
          if (r.saldo > 0.005) box(L + 352, y + 12, w, 10, INK);
          else if (r.saldo < -0.005) hatch(L + 352, y + 12, w, 10);
          font(11.5, "bold");
          txt(r.text, R, y + 21, "right");
          hl(L, R, y + H.balRow, 1, SOFT);
          y += H.balRow;
        });
        if (b.rows.length && m.pages.flat().filter((x) => x.t === "balance").pop() === b) {
          font(10, "normal", "helvetica", MUTED);
          txt("Barra llena: recibe dinero. Barra rayada: tiene que pagar.", L, y + 16);
          y += H.balNote;
        }
        y += H.gap;
      } else if (b.t === "split") {
        const colW = ((CONTENT_W - 32) * 1.6) / 2.6;
        const sx = L + colW + 32;
        if (m.categories.length) {
          h2("En qué se ha ido", y);
          let cy = y + H.h2;
          m.categories.forEach((c) => {
            font(11.5);
            txt(fit(c.label, 90), L, cy + 18);
            box(L + 96, cy + 9, colW - 96 - 40 - 78 - 12, 10, TRACK);
            box(L + 96, cy + 9, Math.max(2, (colW - 96 - 40 - 78 - 12) * c.ratio), 10, INK);
            font(11.5, "normal", "helvetica", MUTED);
            txt(`${c.pct} %`, L + colW - 78 - 6, cy + 18, "right");
            font(11.5, "bold");
            txt(c.amount, L + colW, cy + 18, "right");
            hl(L, L + colW, cy + H.catRow, 1, SOFT);
            cy += H.catRow;
          });
        }
        if (m.subplans.length) {
          const w = R - sx;
          font(15, "bold"); txt("Por subplan", sx, y + 17);
          hl(sx, R, y + 28, 1.5, INK);
          let sy2 = y + H.h2;
          caps("Subplan", sx, sy2 + 17); caps("Gastos", sx + w - 82, sy2 + 17, "right"); caps("Importe", R, sy2 + 17, "right");
          hl(sx, R, sy2 + H.thead, 1, LINE);
          sy2 += H.thead;
          m.subplans.forEach((s) => {
            font(11.5);
            txt(fit(s.label, w - 150), sx, sy2 + 19);
            txt(String(s.count), sx + w - 82, sy2 + 19, "right");
            font(11.5, "bold");
            txt(s.amount, R, sy2 + 19, "right");
            hl(sx, R, sy2 + H.subRow, 1, SOFT);
            sy2 += H.subRow;
          });
        }
        y += H.h2 + Math.max(m.categories.length * H.catRow, m.subplans.length ? H.thead + m.subplans.length * H.subRow : 0) + H.gap;
      } else if (b.t === "gastos") {
        y = h2("Todos los gastos", y, b.cont ? "continúa" : "En euros · por orden de fecha");
        y = thead([{ s: "Fecha", x: L }, { s: "Concepto", x: L + 84 }, { s: "Pagó", x: L + 402 }, { s: "Entre", x: L + 482 }, { s: "Importe", x: R, a: "right" }], y);
        b.items.forEach((it) => {
          if (it.k === "group") {
            font(12, "bold"); txt(it.title, L, y + 19);
            font(11, "normal", "helvetica", MUTED); txt(it.subtotal, R, y + 19, "right");
            hl(L, R, y + H.group, 1, LINE);
            y += H.group;
          } else if (it.k === "row") {
            font(11.5, "normal", "helvetica", MUTED); txt(it.when, L, y + 19);
            font(11.5, "bold"); txt(fit(it.title, 300), L + 84, y + 19);
            if (it.detail) { font(10, "normal", "helvetica", MUTED); txt(fit(it.detail, 300), L + 84, y + 32); }
            font(11.5); txt(fit(it.paid, 74), L + 402, y + 19);
            font(11.5, "normal", "helvetica", TEXT2); txt(fit(it.between, 110), L + 482, y + 19);
            font(11.5, "bold"); txt(it.amount, R, y + 19, "right");
            hl(L, R, y + H.row, 1, SOFT);
            y += H.row;
          } else if (it.k === "total") {
            hl(L, R, y + 1, 2, INK);
            font(13, "bold"); txt(it.label, L, y + 26);
            font(15, "bold"); txt(it.amount, R, y + 26, "right");
            y += H.total;
          } else {
            font(10.5, "normal", "helvetica", MUTED);
            doc.splitTextToSize(it.text, CONTENT_W * S).slice(0, 2).forEach((ln: string, i: number) => doc.text(ln, L * S, (y + 14 + i * 13) * S));
            y += H.note;
          }
        });
      }
    });

    hl(L, R, 1070, 1, LINE);
    font(9.5, "normal", "helvetica", MUTED);
    txt("Generado con Frimee · frimee.es", L, 1087);
    txt(fit(m.footerLabel, 300), PAGE_W / 2, 1087, "center");
    txt(`Página ${pi + 1} de ${m.pages.length}`, R, 1087, "right");
  });

  return doc.output("blob");
}
