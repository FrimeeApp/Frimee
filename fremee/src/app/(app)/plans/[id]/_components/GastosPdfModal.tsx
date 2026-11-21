"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Printer, Share2, X } from "lucide-react";
import {
  buildGastosPdf, renderGastosPdf, H, PAGE_H, PAGE_W, PAD_X, TOP, headHeight,
  type Block, type PdfInput, type PdfModel,
} from "@/lib/gastos-pdf";

/* Pantalla previa al PDF: las mismas páginas que se descargan, pintadas en HTML, y las acciones. */

const INK = "#1c1c22";
const MUTED = "#60606b";
const LINE = "#cdcdd2";
const SOFT = "#e4e4e7";
const SERIF = 'var(--font-display-face), "Instrument Serif", Georgia, serif';
const CAPS = { fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED } as const;

const mkH2 = (title: string, right?: string) => (
  <div style={{ height: H.h2 - 8, marginBottom: 8, borderBottom: `1.5px solid ${INK}`, display: "flex", alignItems: "baseline", gap: 8, fontSize: 15, fontWeight: 600, paddingTop: 2 }}>
    <span>{title}</span>
    {right && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, color: MUTED }}>{right}</span>}
  </div>
);
const Row = ({ h, cols, border = SOFT, children }: { h: number; cols?: string; border?: string; children: React.ReactNode }) => (
  <div style={{ height: h, borderBottom: `1px solid ${border}`, display: "grid", gridTemplateColumns: cols, alignItems: "center", fontSize: 11.5 }}>{children}</div>
);
const Head = ({ cols, labels, right = [] }: { cols: string; labels: string[]; right?: number[] }) => (
  <Row h={H.thead} cols={cols} border={LINE}>
    {labels.map((l, i) => <span key={i} style={{ ...CAPS, textAlign: right.includes(i) ? "right" : "left" }}>{l}</span>)}
  </Row>
);

function PageBlock({ b, m, last }: { b: Block; m: PdfModel; last: boolean }) {
  if (b.t === "pagos") {
    const cols = "170px 28px 1fr 110px 110px";
    return (
      <div style={{ marginBottom: H.gap }}>
        {mkH2("Pagos para quedar en paz", `${b.rows.length === 1 ? "1 pago" : `${b.rows.length} pagos`} · ${b.total}`)}
        <Head cols={cols} labels={["Paga", "", "A", "Importe", "Hecho"]} right={[3, 4]} />
        {b.rows.map((r, i) => (
          <Row key={i} h={H.payRow} cols={cols}>
            <b style={{ fontSize: 12.5 }}>{r.from}</b><span style={{ color: MUTED }}>→</span><b style={{ fontSize: 12.5 }}>{r.to}</b>
            <b style={{ textAlign: "right", fontSize: 12.5 }}>{r.amount}</b>
            <span style={{ justifySelf: "end", width: 13, height: 13, border: `1px solid ${INK}`, borderRadius: 2 }} aria-label="Pendiente" />
          </Row>
        ))}
      </div>
    );
  }
  if (b.t === "balance") {
    const cols = "150px 100px 100px 160px 1fr";
    return (
      <div style={{ marginBottom: H.gap }}>
        {mkH2("Balance por persona", "Pagó − le toca")}
        <Head cols={cols} labels={["Persona", "Pagó", "Le toca", "Saldo", ""]} right={[1, 2]} />
        {b.rows.map((r, i) => (
          <Row key={i} h={H.balRow} cols={cols}>
            <b>{r.name}</b>
            <span style={{ textAlign: "right" }}>{r.paid}</span>
            <span style={{ textAlign: "right" }}>{r.share}</span>
            <div style={{ display: "flex", alignItems: "center", height: 10 }}>
              <span style={{ width: 1, height: 12, background: INK }} />
              {r.saldo > 0.005 && <span style={{ height: 10, width: Math.max(2, r.ratio * 120), background: INK }} />}
              {r.saldo < -0.005 && <span style={{ height: 10, width: Math.max(2, r.ratio * 120), border: `1px solid ${INK}`, background: `repeating-linear-gradient(45deg, ${INK} 0 1px, #fff 1px 4px)` }} />}
            </div>
            <b style={{ textAlign: "right" }}>{r.text}</b>
          </Row>
        ))}
        {last && <p style={{ margin: 0, height: H.balNote, paddingTop: 6, fontSize: 10, color: MUTED }}>Barra llena: recibe dinero. Barra rayada: tiene que pagar.</p>}
      </div>
    );
  }
  if (b.t === "split") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 32, marginBottom: H.gap }}>
        {m.categories.length > 0 ? (
          <div>
            {mkH2("En qué se ha ido")}
            {m.categories.map((c, i) => (
              <div key={i} style={{ height: H.catRow, borderBottom: `1px solid ${SOFT}`, display: "grid", gridTemplateColumns: "90px 1fr 40px 78px", gap: 6, alignItems: "center", fontSize: 11.5 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                <div style={{ height: 10, background: "#ededef" }}><div style={{ height: 10, width: `${c.ratio * 100}%`, background: INK }} /></div>
                <span style={{ textAlign: "right", color: MUTED }}>{c.pct} %</span>
                <b style={{ textAlign: "right" }}>{c.amount}</b>
              </div>
            ))}
          </div>
        ) : <div />}
        {m.subplans.length > 0 ? (
          <div>
            {mkH2("Por subplan")}
            <Head cols="1fr 50px 78px" labels={["Subplan", "Gastos", "Importe"]} right={[1, 2]} />
            {m.subplans.map((s, i) => (
              <div key={i} style={{ height: H.subRow, borderBottom: `1px solid ${SOFT}`, display: "grid", gridTemplateColumns: "1fr 50px 78px", gap: 6, alignItems: "center", fontSize: 11.5 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                <span style={{ textAlign: "right" }}>{s.count}</span>
                <b style={{ textAlign: "right" }}>{s.amount}</b>
              </div>
            ))}
          </div>
        ) : <div />}
      </div>
    );
  }
  if (b.t === "gastos") {
    const cols = "74px 1fr 80px 120px 82px";
    return (
      <div>
        {mkH2("Todos los gastos", b.cont ? "continúa" : "En euros · por orden de fecha")}
        <Head cols={cols} labels={["Fecha", "Concepto", "Pagó", "Entre", "Importe"]} right={[4]} />
        {b.items.map((it, i) =>
          it.k === "group" ? (
            <div key={i} style={{ height: H.group, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", fontSize: 12, fontWeight: 600 }}>
              {it.title}<span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400, color: MUTED }}>{it.subtotal}</span>
            </div>
          ) : it.k === "row" ? (
            <div key={i} style={{ height: H.row, borderBottom: `1px solid ${SOFT}`, display: "grid", gridTemplateColumns: cols, alignItems: "start", paddingTop: 7, fontSize: 11.5, boxSizing: "border-box" }}>
              <span style={{ color: MUTED }}>{it.when}</span>
              <div style={{ minWidth: 0 }}>
                <b style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</b>
                {it.detail && <div style={{ color: MUTED, fontSize: 10, marginTop: 1 }}>{it.detail}</div>}
              </div>
              <span>{it.paid}</span>
              <span style={{ color: "#3a3a42" }}>{it.between}</span>
              <b style={{ textAlign: "right", fontWeight: 600 }}>{it.amount}</b>
            </div>
          ) : it.k === "total" ? (
            <div key={i} style={{ height: H.total, borderTop: `2px solid ${INK}`, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, boxSizing: "border-box" }}>
              {it.label}<span style={{ marginLeft: "auto", fontSize: 15, fontWeight: 700 }}>{it.amount}</span>
            </div>
          ) : (
            <p key={i} style={{ margin: 0, height: H.note, paddingTop: 6, fontSize: 10.5, color: MUTED }}>{it.text}</p>
          ),
        )}
      </div>
    );
  }
  return null;
}

function PageHead({ m }: { m: PdfModel }) {
  const partial = !!m.partialNote;
  return (
    <div style={{ height: headHeight(partial), position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: SERIF, fontSize: 20 }}>Frimee</span>
        <div style={{ textAlign: "right" }}>
          <p style={{ ...CAPS, margin: 0, color: INK }}>{m.kind}</p>
          <p style={{ fontSize: 10.5, color: MUTED, margin: "3px 0 0" }}>{m.generated}</p>
        </div>
      </div>
      <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 44, margin: "26px 0 0", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</h1>
      <p style={{ fontSize: 12.5, margin: "8px 0 0", color: "#3a3a42", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.subtitle}</p>
      {m.partialNote && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 86, height: 44, boxSizing: "border-box", border: `1.5px dashed ${INK}`, borderRadius: 6, padding: "0 12px", display: "flex", alignItems: "center", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}><b>Resumen parcial.</b> {m.partialNote}</span>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: partial ? 148 : 96, height: 66, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr", borderTop: `1.5px solid ${INK}`, borderBottom: `1px solid ${LINE}` }}>
        {m.stats.map((s, i) => (
          <div key={i} style={{ padding: `10px 0 0 ${i ? 14 : 0}px`, borderLeft: i ? `1px solid ${SOFT}` : undefined }}>
            <p style={{ ...CAPS, margin: 0 }}>{s.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: i === 0 ? 22 : 18, fontWeight: 600 }}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Page({ m, pi, scale }: { m: PdfModel; pi: number; scale: number }) {
  const blocks = m.pages[pi];
  const lastBalance = m.pages.flat().filter((b) => b.t === "balance").pop();
  return (
    <div style={{ width: PAGE_W * scale, height: PAGE_H * scale, flex: "none", background: "#fff", borderRadius: 4, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }}>
      <div style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative", boxSizing: "border-box", padding: `${TOP}px ${PAD_X}px 0`, color: INK, fontFamily: "Inter, system-ui, sans-serif", fontVariantNumeric: "tabular-nums" }}>
        {pi === 0 ? <PageHead m={m} /> : (
          <div style={{ height: 30, marginBottom: 20, borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: SERIF, fontSize: 16 }}>{m.title}</span><span style={{ ...CAPS, color: INK }}>{m.kind}</span>
          </div>
        )}
        {pi === 0 && <div style={{ height: H.gap }} />}
        {blocks.filter((b) => b.t !== "head").map((b, i) => <PageBlock key={i} b={b} m={m} last={b === lastBalance} />)}
        <div style={{ position: "absolute", left: PAD_X, right: PAD_X, top: 1070, borderTop: `1px solid ${LINE}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 9.5, color: MUTED }}>
          <span>Generado con Frimee · frimee.es</span><span>{m.footerLabel}</span><span>Página {pi + 1} de {m.pages.length}</span>
        </div>
      </div>
    </div>
  );
}

export function GastosPdfModal({ input, closing, onClose }: { input: Omit<PdfInput, "generatedAt">; closing: boolean; onClose: () => void }) {
  const [generatedAt] = useState(() => new Date());
  const model = useMemo(() => buildGastosPdf({ ...input, generatedAt }), [input, generatedAt]);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let alive = true;
    renderGastosPdf(model).then((b) => { if (alive) setBlob(b); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [model]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(1, Math.max(0.2, (width - (width > 600 ? 48 : 32)) / PAGE_W));
  const has = (t: Block["t"]) => model.pages.some((p) => p.some((b) => b.t === t));
  const pagesLabel = `${model.pages.length} ${model.pages.length === 1 ? "página" : "páginas"} · A4`;

  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = model.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const share = async () => {
    if (!blob) return;
    const file = new File([blob], model.fileName, { type: "application/pdf" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: model.title });
      else download();
    } catch (e) {
      if ((e as Error).name !== "AbortError") download();
    }
  };
  const print = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    w?.addEventListener("load", () => w.print());
  };

  const isPast = !model.partialNote;
  const subtitle = isPast ? "Plan terminado" : "El plan aún no ha terminado";
  const lead = isPast ? "Las cuentas del plan, listas para guardar o enviar." : `El plan termina el ${model.endLabel}. Cuando acabe, este documento pasa a ser la factura final.`;
  const btn = "inline-flex h-[46px] items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-[var(--fw-semibold)] disabled:opacity-50";

  return (
    <div className="app-modal-overlay fixed inset-0 z-[80] flex items-end justify-center md:items-center" data-closing={closing ? "true" : "false"} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={model.kind}
        className="app-modal-panel relative flex h-[100dvh] w-full flex-col overflow-hidden bg-app md:h-[min(780px,90dvh)] md:max-w-[1000px] md:flex-row md:rounded-[20px] md:shadow-elev-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-app px-1 md:hidden">
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex size-11 items-center justify-center rounded-lg text-app"><X className="size-[22px]" aria-hidden /></button>
          <div className="min-w-0">
            <h1 className="text-[17px] font-[var(--fw-semibold)] text-app">{model.kind}</h1>
            <p className="text-[12px] text-muted">{subtitle}</p>
          </div>
        </header>

        <div ref={boxRef} className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto bg-[var(--surface-inset)] px-4 py-4 md:px-6 md:py-6">
          {width > 0 && model.pages.map((_, pi) => <Page key={pi} m={model} pi={pi} scale={scale} />)}
        </div>

        <div className="hidden w-[320px] shrink-0 flex-col gap-3.5 p-6 md:flex">
          <div className="flex items-start gap-2">
            <div>
              <h2 className="text-[32px] leading-tight text-app" style={{ fontFamily: SERIF, fontWeight: 400 }}>{model.kind}</h2>
              <p className="mt-1.5 text-[14px] text-muted">{lead}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-app hover:bg-surface"><X className="size-[22px]" aria-hidden /></button>
          </div>
          <div className="rounded-lg border border-app bg-surface px-3.5 py-3 text-[14px]">
            <p className="font-[var(--fw-semibold)] text-app">Incluye</p>
            <ul className="mt-1 text-muted">
              {has("pagos") && <li>Pagos para quedar en paz</li>}
              <li>Balance por persona</li>
              {(has("split")) && <li>En qué se ha ido y por subplan</li>}
              <li>Los {model.gastosCount} gastos, por día</li>
            </ul>
          </div>
          <p className="text-[12px] tabular-nums text-muted">{pagesLabel} · {model.fileName}</p>
          {failed && <p className="text-[13px] text-[var(--warning)]">No se ha podido preparar el PDF. Cierra y vuelve a intentarlo.</p>}
          <div className="mt-auto flex flex-col gap-2">
            <button type="button" onClick={download} disabled={!blob} className={`${btn} w-full bg-primary-token text-contrast-token`}><Download className="size-[18px]" aria-hidden />Descargar PDF</button>
            <div className="flex gap-2">
              <button type="button" onClick={share} disabled={!blob} className={`${btn} flex-1 border border-app text-app`}><Share2 className="size-[18px]" aria-hidden />Compartir</button>
              <button type="button" onClick={print} disabled={!blob} className={`${btn} flex-1 border border-app text-app`}><Printer className="size-[18px]" aria-hidden />Imprimir</button>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-app px-4 pb-6 pt-2.5 md:hidden">
          <p className="mb-2 flex text-[12px] text-muted"><span>{pagesLabel}</span><span className="ml-auto tabular-nums">{model.fileName}</span></p>
          {failed && <p className="mb-2 text-[13px] text-[var(--warning)]">No se ha podido preparar el PDF.</p>}
          <div className="flex gap-2">
            <button type="button" onClick={share} disabled={!blob} className={`${btn} flex-1 border border-app text-app`}><Share2 className="size-[18px]" aria-hidden />Compartir</button>
            <button type="button" onClick={download} disabled={!blob} className={`${btn} flex-1 bg-primary-token text-contrast-token`}><Download className="size-[18px]" aria-hidden />Descargar</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
