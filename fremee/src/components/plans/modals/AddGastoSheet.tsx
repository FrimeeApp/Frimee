"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createGastoEndpoint,
  fetchPlanMiembrosEndpoint,
  type MetodoReparto,
  type PlanMiembro,
  type GastoItemInput,
} from "@/services/api/endpoints/gastos.endpoint";
import { fetchSubplanes, type SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import type { OcrResult, OcrItem } from "@/app/api/receipts/ocr/route";
import { todayISO, limitDecimals, adjustNumericString } from "@/lib/form-helpers";
import { Avatar } from "@/components/ui/Avatar";
import { FIELD_LINE_CLS } from "@/lib/styles";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { CloseX } from "@/components/ui/CloseX";
import { ModalFeedback, type ModalFeedbackState } from "@/components/ui/ModalFeedback";
import { DiscardChangesDialog } from "@/components/ui/DiscardChangesDialog";

type CategoriaGasto = { id: number; nombre: string; icono: string | null; color: string | null };

function StepperButtons({ onIncrement, onDecrement }: { onIncrement: () => void; onDecrement: () => void }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center">
      <button type="button" onClick={onIncrement} aria-label="Aumentar" className="flex h-3.5 w-3.5 items-center justify-center rounded text-muted hover:bg-surface hover:text-app transition-colors">
        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none"><path d="M3 7.5 6 4.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" onClick={onDecrement} aria-label="Disminuir" className="flex h-3.5 w-3.5 items-center justify-center rounded text-muted hover:bg-surface hover:text-app transition-colors">
        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none"><path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}

const MONEDAS = ["EUR", "USD", "GBP", "MXN", "ARS", "COP", "CLP", "BRL"];

const METODOS: { value: MetodoReparto; label: string; desc: string }[] = [
  { value: "IGUAL",      label: "A partes iguales", desc: "Cada uno paga lo mismo" },
  { value: "PORCENTAJE", label: "Por porcentaje",   desc: "Cada uno paga un % del total" },
  { value: "CANTIDAD",   label: "Cantidad fija",    desc: "Cada uno paga una cantidad exacta" },
  { value: "POR_ITEMS",  label: "Por ítems",        desc: "Cada uno paga los ítems que consume" },
];

const TOTAL_STEPS = 3;
const STEP_META = [
  { title: "¿Qué es?",        subtitle: "Concepto, importe y fecha" },
  { title: "¿Quién paga?",    subtitle: "Pagador y método de reparto" },
  { title: "¿Cómo se reparte?", subtitle: "Asigna las partes entre los participantes" },
];

type ItemAsignacion = OcrItem & { asignados: Record<string, boolean> };

type Props = {
  planId: number;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
};

// ── component ─────────────────────────────────────────────────────────────────

export default function AddGastoSheet({ planId, userId, onClose, onCreated }: Props) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose);
  const [step, setStep] = useState(1);

  // ── form state ──
  const [titulo, setTitulo] = useState("");
  const [total, setTotal] = useState("");
  const [moneda, setMoneda] = useState("EUR");
  const [fechaGasto, setFechaGasto] = useState(todayISO());
  const [pagadoPor, setPagadoPor] = useState(userId);
  const [metodo, setMetodo] = useState<MetodoReparto>("IGUAL");

  // ── participants ──
  const [miembros, setMiembros] = useState<PlanMiembro[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [porcentajes, setPorcentajes] = useState<Record<string, string>>({});
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [items, setItems] = useState<ItemAsignacion[]>([]);

  // ── OCR ──
  const [ocrLoading, setOcrLoading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [notAReceipt, setNotAReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── categorias ──
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [categoriaId, setCategoriaId] = useState<number>(0);
  const [categoriaOpen, setCategoriaOpen] = useState(false);
  const categoriaBtnRef = useRef<HTMLButtonElement>(null);

  // ── subplanes ──
  const [subplanes, setSubplanes] = useState<SubplanRow[]>([]);
  const [subplanId, setSubplanId] = useState<number | null>(null);
  const [subplanOpen, setSubplanOpen] = useState(false);
  const subplanBtnRef = useRef<HTMLButtonElement>(null);

  // ── UI ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<ModalFeedbackState | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [participantesExpanded, setParticipantesExpanded] = useState(true);
  const [participantesSearch, setParticipantesSearch] = useState("");
  const [pagadorOpen, setPagadorOpen] = useState(false);
  const [pagadorSearch, setPagadorSearch] = useState("");
  const [itemPopoverIdx, setItemPopoverIdx] = useState<number | null>(null);
  const [itemPopoverSearch, setItemPopoverSearch] = useState("");
  const pagadorBtnRef = useRef<HTMLButtonElement>(null);
  const itemPopoverBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // ── load data ──
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.from("categorias_gasto").select("id,nombre,icono,color").order("id")
      .then(({ data }) => { if (data) setCategorias(data as CategoriaGasto[]); });
  }, []);

  useEffect(() => {
    fetchSubplanes(planId).then(setSubplanes).catch(() => {});
  }, [planId]);

  useEffect(() => {
    fetchPlanMiembrosEndpoint(planId)
      .then((data) => {
        setMiembros(data);
        setSeleccionados(new Set(data.map((m) => m.user_id)));
        const basePct = parseFloat((100 / data.length).toFixed(2));
        const initPct: Record<string, string> = {};
        const initCant: Record<string, string> = {};
        data.forEach((m, i) => {
          initPct[m.user_id] = i === data.length - 1
            ? String(parseFloat((100 - basePct * (data.length - 1)).toFixed(2)))
            : String(basePct);
          initCant[m.user_id] = "";
        });
        setPorcentajes(initPct);
        setCantidades(initCant);
      })
      .catch(() => {});
  }, [planId]);

  // ── OCR ──
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setError(null);
    setNotAReceipt(false);
    try {
      let fileToSend: File | Blob = file;
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf && file.type.startsWith("image/")) {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        bitmap.close();
        fileToSend = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
      }
      const fd = new FormData();
      fd.append("file", fileToSend, isPdf ? file.name : "receipt.jpg");
      fd.append("plan_id", String(planId));
      fd.append("user_id", userId);
      const res = await fetch("/api/receipts/ocr", { method: "POST", body: fd });
      const data = await res.json() as OcrResult;
      if ("error" in data) throw new Error((data as { error: string }).error);
      if (!data.is_receipt) setNotAReceipt(true);
      if (data.comercio) setTitulo(data.comercio);
      if (data.total != null) setTotal(String(data.total));
      if (data.moneda) setMoneda(data.moneda);
      if (data.fecha) setFechaGasto(data.fecha);
      if (data.url) setReceiptUrl(data.url);
      if (data.items.length > 0) {
        setMetodo("POR_ITEMS");
        setItems(data.items.map((item) => ({ ...item, asignados: Object.fromEntries(miembros.map((m) => [m.user_id, false])) })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar el archivo");
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── items helpers ──
  function addItem() {
    setItems((prev) => [...prev, { nombre: "", precio_unitario: 0, cantidad: 1, subtotal: 0, asignados: Object.fromEntries(miembros.map((m) => [m.user_id, false])) }]);
  }

  function updateItem(idx: number, patch: Partial<ItemAsignacion>) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, ...patch };
      if ("precio_unitario" in patch || "cantidad" in patch) updated.subtotal = updated.precio_unitario * updated.cantidad;
      return updated;
    }));
  }

  function toggleItemUser(idx: number, uid: string) {
    setItems((prev) => prev.map((item, i) => i !== idx ? item : { ...item, asignados: { ...item.asignados, [uid]: !item.asignados[uid] } }));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── validation ──
  const totalNum = parseFloat(total) || 0;
  const itemsSum = items.reduce((acc, item) => acc + item.subtotal, 0);
  const itemsSumMismatch = metodo === "POR_ITEMS" && totalNum > 0 && items.length > 0 && Math.abs(itemsSum - totalNum) > 0.01;

  function canContinue(): boolean {
    if (step === 1) return titulo.trim().length > 0 && totalNum > 0;
    if (step === 2) return true;
    return true;
  }

  function buildParticipantes() {
    if (metodo === "IGUAL") return Array.from(seleccionados).map((uid) => ({ user_id: uid }));
    if (metodo === "PORCENTAJE") return miembros.filter((m) => parseFloat(porcentajes[m.user_id] || "0") > 0).map((m) => ({ user_id: m.user_id, porcentaje: parseFloat(porcentajes[m.user_id]) }));
    if (metodo === "CANTIDAD") return miembros.filter((m) => parseFloat(cantidades[m.user_id] || "0") > 0).map((m) => ({ user_id: m.user_id, importe: parseFloat(cantidades[m.user_id]) }));
    const uids = new Set<string>();
    items.forEach((item) => Object.keys(item.asignados).forEach((uid) => { if (item.asignados[uid]) uids.add(uid); }));
    return Array.from(uids).map((uid) => ({ user_id: uid }));
  }

  function buildItems(): GastoItemInput[] {
    return items.map((item) => {
      const assigned = miembros.filter((m) => item.asignados[m.user_id]);
      const perUser = assigned.length > 0 ? item.subtotal / assigned.length : 0;
      return { nombre: item.nombre, precio_unitario: item.precio_unitario, cantidad: item.cantidad, subtotal: item.subtotal, usuarios: assigned.map((m) => ({ user_id: m.user_id, subtotal_asignado: perUser })) };
    });
  }

  async function handleSubmit() {
    if (itemsSumMismatch) { setError(`La suma de ítems (${itemsSum.toFixed(2)}) no coincide con el total (${totalNum.toFixed(2)})`); return; }
    if (metodo === "PORCENTAJE") {
      const sum = miembros.filter(m => porcentajes[m.user_id] !== undefined).reduce((a, m) => a + (parseFloat(porcentajes[m.user_id] ?? "0") || 0), 0);
      if (Math.abs(sum - 100) > 0.01) { setError(`Los porcentajes deben sumar 100% (actual: ${sum.toFixed(1)}%)`); return; }
    }
    const participantes = buildParticipantes();
    if (participantes.length === 0) { setError("Selecciona al menos un participante"); return; }
    setSaving(true);
    setError(null);
    setFeedbackState({ type: "loading" });
    try {
      await createGastoEndpoint({
        plan_id: planId,
        titulo: titulo.trim(),
        pagado_por_user_id: pagadoPor,
        fecha_gasto: fechaGasto,
        total: totalNum,
        moneda,
        metodo_reparto: metodo,
        participantes,
        descripcion: undefined,
        items: metodo === "POR_ITEMS" ? buildItems() : undefined,
        receipt_url: receiptUrl ?? undefined,
        categoria_id: categoriaId,
        subplan_id: subplanId ?? undefined,
      });
      setFeedbackState({ type: "success", label: "Gasto creado" });
    } catch (err) {
      setFeedbackState({ type: "error", message: err instanceof Error ? err.message : "Error al guardar el gasto" });
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    setError(null);
    if (step < TOTAL_STEPS) setStep(s => s + 1);
    else void handleSubmit();
  }

  const meta = STEP_META[step - 1];
  const fieldLineCls = FIELD_LINE_CLS;
  const hasProgress =
    step > 1 ||
    titulo.trim().length > 0 ||
    total.trim().length > 0 ||
    receiptUrl !== null ||
    items.length > 0 ||
    subplanId !== null ||
    metodo !== "IGUAL";

  function requestDismiss() {
    if (saving || ocrLoading) return;
    if (hasProgress) {
      setDiscardOpen(true);
      return;
    }
    requestClose();
  }

  // ── shared dropdown renderer ──
  function Dropdown({ btnRef, open, onClose: closeDropdown, items: dropdownItems }: {
    btnRef: React.RefObject<HTMLButtonElement | null>;
    open: boolean;
    onClose: () => void;
    items: { key: string | number; label: React.ReactNode; active: boolean; onClick: () => void }[];
  }) {
    if (!open) return null;
    const r = btnRef.current?.getBoundingClientRect();
    const maxH = 224;
    const spaceBelow = r ? window.innerHeight - r.bottom - 8 : 0;
    const showAbove = spaceBelow < maxH && (r?.top ?? 0) > maxH;
    const top = showAbove ? undefined : (r ? r.bottom + 4 : 0);
    const bottom = showAbove ? (r ? window.innerHeight - r.top + 4 : 0) : undefined;
    const width = r?.width ?? 300;
    const left = r ? Math.min(r.left, window.innerWidth - width - 8) : 0;
    return createPortal(
      <>
        <div className="fixed inset-0 z-[9998]" onClick={closeDropdown} />
        <div className="fixed z-[9999] max-h-56 overflow-y-auto rounded-xl border border-app bg-[var(--surface)] shadow-elev-3" style={{ top, bottom, left, width }}>
          {dropdownItems.map(item => (
            <button key={item.key} type="button" onClick={item.onClick} className={`flex w-full items-center px-4 py-2.5 text-left text-body-sm transition-colors hover:bg-surface-2 ${item.active ? "text-[var(--primary,#298e7d)] font-[var(--fw-semibold)]" : "text-app"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </>,
      document.body
    );
  }

  return (
    <>
      <div data-closing={isClosing ? "true" : "false"} className="app-modal-overlay fixed inset-0 z-40" />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-[var(--space-4)]"
        onClick={(e) => { if (e.target !== e.currentTarget) return; if (window.matchMedia("(min-width: 768px)").matches) requestDismiss(); }}
      >
        <div
          data-closing={isClosing ? "true" : "false"}
          className="app-modal-panel relative flex h-full w-full flex-col overflow-hidden bg-app md:h-auto md:max-h-[92dvh] md:max-w-[620px] md:rounded-[22px] md:border md:border-app md:shadow-elev-4"
          onClick={(e) => e.stopPropagation()}
        >
          {feedbackState && (
            <ModalFeedback
              state={feedbackState}
              onSuccess={() => { onCreated(); requestClose(); }}
              onDismissError={() => setFeedbackState(null)}
            />
          )}
          {/* Progress bar */}
          <div className="h-[3px] w-full shrink-0 bg-[var(--surface-2)]">
            <div className="h-full bg-primary-token transition-all duration-[400ms] [transition-timing-function:var(--ease-standard)]" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>

          {/* Top nav */}
          <div className="flex shrink-0 items-center justify-between px-[var(--space-5)] py-[var(--space-3)]">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="flex size-9 items-center justify-center rounded-full text-app transition-colors hover:bg-surface"
                aria-label="Volver"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-[18px]"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ) : (
              <div className="size-9" aria-hidden="true" />
            )}
            <span className="text-caption font-[var(--fw-medium)] text-muted">{step} de {TOTAL_STEPS}</span>
            {/* OCR button — only on step 1 */}
            {false ? (
              <div>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={ocrLoading}
                  title="Leer ticket o factura"
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-caption font-[var(--fw-semibold)] transition-colors disabled:opacity-60 ${receiptUrl && !notAReceipt ? "border-success-token/30 bg-success-token/10 text-success-token" : "border-app bg-surface text-muted hover:border-primary-token hover:text-primary-token"}`}
                >
                  {ocrLoading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : receiptUrl && !notAReceipt ? <svg viewBox="0 0 24 24" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg> : <svg viewBox="0 0 24 24" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.8"><path d="M12 16v-8M8 12l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="3" width="18" height="18" rx="3"/></svg>}
                  {ocrLoading ? "Analizando…" : receiptUrl && !notAReceipt ? "Ticket leído" : "Leer ticket"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={requestDismiss}
                className="flex size-9 items-center justify-center rounded-full text-app transition-colors hover:bg-surface"
                aria-label="Cerrar"
              >
                <CloseX />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-[var(--space-6)] pb-[var(--space-8)] pt-[var(--space-2)]">
            {/* Step header */}
            <div className="mb-[var(--space-8)] flex items-start justify-between gap-[var(--space-4)]">
              <div className="min-w-0">
                <h2 className="font-[var(--fw-bold)] leading-tight text-app" style={{ fontSize: "clamp(22px, 5vw, 28px)" }}>{meta.title}</h2>
                <p className="mt-[var(--space-1)] text-body-sm text-muted">{meta.subtitle}</p>
              </div>
              {step === 1 && (
                <div className="shrink-0 pt-1">
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={ocrLoading}
                    title="Leer ticket o factura"
                    className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-app px-3 py-1.5 text-caption font-[var(--fw-medium)] transition-colors disabled:opacity-60 ${receiptUrl && !notAReceipt ? "bg-surface text-app" : "bg-neutral-100 text-muted hover:bg-neutral-200 hover:text-app dark:bg-neutral-800 dark:hover:bg-neutral-700"}`}
                  >
                    {ocrLoading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : receiptUrl && !notAReceipt ? <svg viewBox="0 0 24 24" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg> : <svg viewBox="0 0 24 24" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.8"><path d="M12 16v-8M8 12l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="3" width="18" height="18" rx="3"/></svg>}
                    {ocrLoading ? "Analizando..." : receiptUrl && !notAReceipt ? "Leido" : "Leer factura"}
                  </button>
                </div>
              )}
            </div>

            {/* ── Step 1: Concepto + importe ── */}
            {step === 1 && (
              <div className="space-y-[var(--space-6)]">
                <div className={`flex items-center gap-[var(--space-3)] ${fieldLineCls}`}>
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Concepto"
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-[22px] font-[var(--fw-semibold)] text-app outline-none placeholder:text-muted"
                  />
                </div>

                <div className="grid gap-[var(--space-5)] sm:grid-cols-2">
                  <div>
                    <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Importe</p>
                    <div className={`${fieldLineCls} flex items-center gap-[var(--space-3)]`}>
                      <input
                        type="number" min="0" step="0.01" value={total}
                        onChange={(e) => setTotal(limitDecimals(e.target.value))}
                        placeholder="0.00"
                        className="min-w-0 flex-1 bg-transparent text-body text-app outline-none placeholder:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="shrink-0 bg-transparent text-body text-app outline-none">
                        {MONEDAS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Fecha</p>
                    <div className={fieldLineCls}>
                      <input type="date" value={fechaGasto} onChange={(e) => setFechaGasto(e.target.value)} className="w-full bg-transparent text-body text-app outline-none" />
                    </div>
                  </div>
                </div>

                {categorias.length > 0 && (() => {
                  const selected = categorias.find(c => c.id === categoriaId);
                  return (
                    <div>
                      <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Categoría</p>
                      <button ref={categoriaBtnRef} type="button" onClick={() => setCategoriaOpen(o => !o)} className={`${fieldLineCls} flex w-full items-center justify-between py-1 outline-none`}>
                        <span className="text-app">{selected?.nombre ?? "Otros"}</span>
                        <svg className={`shrink-0 text-muted transition-transform duration-200 ${categoriaOpen ? "rotate-180" : ""}`} width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <Dropdown
                        btnRef={categoriaBtnRef}
                        open={categoriaOpen}
                        onClose={() => setCategoriaOpen(false)}
                        items={categorias.map(cat => ({ key: cat.id, label: <>{cat.icono && <span className="mr-2">{cat.icono}</span>}{cat.nombre}</>, active: categoriaId === cat.id, onClick: () => { setCategoriaId(cat.id); setCategoriaOpen(false); } }))}
                      />
                    </div>
                  );
                })()}

                {subplanes.length > 0 && (() => {
                  const selected = subplanes.find(s => s.id === subplanId);
                  return (
                    <div>
                      <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Subplan</p>
                      <button ref={subplanBtnRef} type="button" onClick={() => setSubplanOpen(o => !o)} className={`${fieldLineCls} flex w-full items-center justify-between py-1 outline-none`}>
                        <span className={selected ? "text-app" : "text-muted"}>{selected?.titulo ?? "Sin subplan"}</span>
                        <svg className={`shrink-0 text-muted transition-transform duration-200 ${subplanOpen ? "rotate-180" : ""}`} width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <Dropdown
                        btnRef={subplanBtnRef}
                        open={subplanOpen}
                        onClose={() => setSubplanOpen(false)}
                        items={[
                          { key: "none", label: "Sin subplan", active: subplanId === null, onClick: () => { setSubplanId(null); setSubplanOpen(false); } },
                          ...subplanes.map(s => ({ key: s.id, label: s.titulo, active: subplanId === s.id, onClick: () => { setSubplanId(s.id); setSubplanOpen(false); } })),
                        ]}
                      />
                    </div>
                  );
                })()}

                {false && (
                <div>
                  <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Descripción <span className="font-normal normal-case tracking-normal opacity-60">(opcional)</span></p>
                </div>

                )}

                {notAReceipt && (
                  <div className="flex items-start gap-[var(--space-2)] rounded-[12px] border border-[var(--warning,#f59e0b)]/30 bg-[var(--warning,#f59e0b)]/10 px-[var(--space-3)] py-[var(--space-2)]">
                    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 size-4 shrink-0 text-[var(--warning,#f59e0b)]" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <p className="text-caption text-[var(--warning,#f59e0b)]">La imagen no parece un recibo. Puedes seguir, pero revisa los campos.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Pagador + método ── */}
            {step === 2 && miembros.length > 0 && (
              <div className="space-y-[var(--space-8)]">
                {/* Pagador */}
                <div>
                  <p className="mb-[var(--space-3)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">¿Quién ha pagado?</p>
                  <button
                    ref={pagadorBtnRef}
                    type="button"
                    onClick={() => { setPagadorOpen(o => !o); setPagadorSearch(""); }}
                    className="flex w-full items-center gap-3 py-2 outline-none"
                  >
                    {(() => { const m = miembros.find(m => m.user_id === pagadoPor); return <Avatar src={m?.foto ?? null} name={m?.nombre ?? "?"} px={28} topMargin="" />; })()}
                    <span className="flex-1 text-left text-body text-app">{miembros.find(m => m.user_id === pagadoPor)?.nombre ?? "Seleccionar"}</span>
                    <svg className={`shrink-0 text-muted transition-transform duration-200 ${pagadorOpen ? "rotate-180" : ""}`} width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {pagadorOpen && (() => {
                    const r = pagadorBtnRef.current?.getBoundingClientRect();
                    const filtered = pagadorSearch ? miembros.filter(m => (m.nombre ?? "").toLowerCase().includes(pagadorSearch.toLowerCase())) : miembros;
                    return (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setPagadorOpen(false)} />
                        <div className="fixed z-50 mt-1 rounded-xl border border-app bg-[var(--surface)] shadow-elev-3" style={{ top: r ? r.bottom + 4 : 0, left: r?.left ?? 0, width: r?.width ?? 300 }}>
                          <div className="border-b border-app px-3 py-2">
                            <div className="flex h-9 items-center rounded-full border border-app bg-[var(--search-field-bg)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <input autoFocus value={pagadorSearch} onChange={e => setPagadorSearch(e.target.value)} placeholder="Buscar..." className="w-full bg-transparent text-body-sm text-app outline-none placeholder:text-muted" />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {filtered.map(m => (
                              <button key={m.user_id} type="button" onClick={() => { setPagadoPor(m.user_id); setPagadorOpen(false); }} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 ${pagadoPor === m.user_id ? "text-primary-token font-[var(--fw-semibold)]" : "text-app"}`}>
                                <Avatar src={m.foto} name={m.nombre ?? "?"} px={24} topMargin="" />
                                <span className="text-body-sm">{m.nombre ?? m.user_id.slice(0, 8)}</span>
                              </button>
                            ))}
                            {filtered.length === 0 && <p className="px-3 py-3 text-body-sm text-muted">Sin resultados</p>}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Método */}
                <div>
                  <p className="mb-[var(--space-3)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Método de reparto</p>
                  <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-4">
                    {METODOS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          setMetodo(m.value);
                          if (m.value === "PORCENTAJE" && miembros.length > 0) {
                            const pct = parseFloat((100 / miembros.length).toFixed(2));
                            const base: Record<string, string> = {};
                            miembros.forEach((mb, i) => { base[mb.user_id] = i === miembros.length - 1 ? String(parseFloat((100 - pct * (miembros.length - 1)).toFixed(2))) : String(pct); });
                            setPorcentajes(base);
                          }
                        }}
                        className={`rounded-[14px] border px-[var(--space-3)] py-[var(--space-3)] text-left text-body-sm transition-colors ${metodo === m.value ? "border-primary-token bg-primary-token/10 text-primary-token" : "border-app bg-app text-app hover:bg-surface"}`}
                      >
                        <span className="block font-[var(--fw-semibold)]">{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-[var(--space-2)] text-body-sm text-muted">{METODOS.find(m => m.value === metodo)?.desc}</p>
                </div>
              </div>
            )}

            {/* ── Step 3: Reparto ── */}
            {step === 3 && miembros.length > 0 && (
              <div className="space-y-[var(--space-4)]">

                {/* IGUAL */}
                {metodo === "IGUAL" && (
                  <div className="rounded-xl border border-app overflow-hidden">
                    <div className="flex items-center bg-[var(--surface-2)]">
                      <button type="button" onClick={() => setSeleccionados(seleccionados.size === miembros.length ? new Set() : new Set(miembros.map(m => m.user_id)))} className="flex flex-1 items-center justify-between px-3 py-2.5 text-body-sm font-[var(--fw-semibold)] text-app hover:bg-[var(--surface-inset)] transition-colors">
                        <span>{seleccionados.size === miembros.length ? "Deseleccionar todos" : "Seleccionar todos"}</span>
                        <span className="text-muted font-normal">{seleccionados.size}/{miembros.length}</span>
                      </button>
                      <button type="button" onClick={() => setParticipantesExpanded(v => !v)} className="flex size-9 shrink-0 items-center justify-center text-muted hover:text-app transition-colors border-l border-[var(--surface-inset)]">
                        {participantesExpanded ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                      </button>
                    </div>
                    {participantesExpanded && <div className="border-b border-[var(--surface-2)] px-3 py-2"><div className="flex h-9 items-center rounded-full border border-app bg-[var(--search-field-bg)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"><input value={participantesSearch} onChange={e => setParticipantesSearch(e.target.value)} placeholder="Buscar participante..." className="w-full bg-transparent text-body-sm text-app outline-none placeholder:text-muted" /></div></div>}
                    {participantesExpanded && (
                      <div className="max-h-[220px] overflow-y-auto divide-y divide-[var(--surface-2)]">
                        {miembros.filter(m => !participantesSearch || (m.nombre ?? "").toLowerCase().includes(participantesSearch.toLowerCase())).map((m) => {
                          const checked = seleccionados.has(m.user_id);
                          const part = checked && seleccionados.size > 0 ? totalNum / seleccionados.size : 0;
                          return (
                            <button key={m.user_id} type="button" onClick={() => setSeleccionados((prev) => { const next = new Set(prev); if (next.has(m.user_id)) next.delete(m.user_id); else next.add(m.user_id); return next; })} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${checked ? "bg-primary-token/5" : "hover:bg-[var(--surface-inset)]"}`}>
                              <div className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary-token bg-primary-token" : "border-app"}`}>{checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
                              <Avatar src={m.foto} name={m.nombre ?? "?"} px={24} topMargin="" />
                              <span className={`min-w-0 flex-1 truncate text-body-sm ${checked ? "text-app font-[var(--fw-medium)]" : "text-muted"}`}>{m.nombre ?? m.user_id.slice(0, 8)}</span>
                              {checked && totalNum > 0 && <span className="shrink-0 text-caption text-primary-token font-[var(--fw-semibold)]">{part.toFixed(2)} {moneda}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* PORCENTAJE */}
                {metodo === "PORCENTAJE" && (() => {
                  const sum = miembros.filter(m => porcentajes[m.user_id] !== undefined).reduce((a, m) => a + (parseFloat(porcentajes[m.user_id] ?? "0") || 0), 0);
                  const isOk = Math.abs(sum - 100) < 0.01;
                  return (
                    <div className="rounded-xl border border-app overflow-hidden">
                      <div className="flex items-center bg-[var(--surface-2)]">
                        <button type="button" onClick={() => { const pct = parseFloat((100 / miembros.length).toFixed(2)); const base: Record<string, string> = {}; miembros.forEach((m, i) => { base[m.user_id] = i === miembros.length - 1 ? String(parseFloat((100 - pct * (miembros.length - 1)).toFixed(2))) : String(pct); }); setPorcentajes(base); }} className="flex-1 px-3 py-2.5 text-left text-body-sm text-muted hover:text-primary-token transition-colors">Igualar</button>
                        <span className={`px-3 text-body-sm font-[var(--fw-semibold)] ${isOk ? "text-[var(--success,#15803d)]" : sum > 100 ? "text-[var(--error,#dc2626)]" : "text-muted"}`}>{sum.toFixed(1)}% / 100%</span>
                        <button type="button" onClick={() => setParticipantesExpanded(v => !v)} className="flex size-9 shrink-0 items-center justify-center text-muted hover:text-app transition-colors border-l border-[var(--surface-inset)]">
                          {participantesExpanded ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                        </button>
                      </div>
                      {participantesExpanded && <div className="border-b border-[var(--surface-2)] px-3 py-2"><div className="flex h-9 items-center rounded-full border border-app bg-[var(--search-field-bg)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"><input value={participantesSearch} onChange={e => setParticipantesSearch(e.target.value)} placeholder="Buscar participante..." className="w-full bg-transparent text-body-sm text-app outline-none placeholder:text-muted" /></div></div>}
                      {participantesExpanded && (
                        <div className="max-h-[220px] overflow-y-auto divide-y divide-[var(--surface-2)]">
                          {miembros.filter(m => !participantesSearch || (m.nombre ?? "").toLowerCase().includes(participantesSearch.toLowerCase())).map((m) => {
                            const pct = parseFloat(porcentajes[m.user_id] ?? "0") || 0;
                            const amount = totalNum * pct / 100;
                            const checked = porcentajes[m.user_id] !== undefined;
                            return (
                              <div key={m.user_id} className={`flex items-center gap-3 px-3 py-2.5 ${!checked ? "opacity-40" : ""}`}>
                                <button type="button" onClick={() => {
                                  if (checked) {
                                    setPorcentajes(prev => { const next = { ...prev }; delete next[m.user_id]; const remaining = miembros.filter(mb => next[mb.user_id] !== undefined); if (remaining.length > 0) { const pctEach = parseFloat((100 / remaining.length).toFixed(2)); remaining.forEach((mb, i) => { next[mb.user_id] = i === remaining.length - 1 ? String(parseFloat((100 - pctEach * (remaining.length - 1)).toFixed(2))) : String(pctEach); }); } return next; });
                                  } else {
                                    setPorcentajes(prev => { const next = { ...prev, [m.user_id]: "0" }; const participating = miembros.filter(mb => next[mb.user_id] !== undefined); const pctEach = parseFloat((100 / participating.length).toFixed(2)); participating.forEach((mb, i) => { next[mb.user_id] = i === participating.length - 1 ? String(parseFloat((100 - pctEach * (participating.length - 1)).toFixed(2))) : String(pctEach); }); return next; });
                                  }
                                }} className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary-token bg-primary-token" : "border-app"}`}>
                                  {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </button>
                                <Avatar src={m.foto} name={m.nombre ?? "?"} px={24} topMargin="" />
                                <span className="min-w-0 flex-1 truncate text-body-sm text-app">{m.nombre ?? m.user_id.slice(0, 8)}</span>
                                {pct > 0 && totalNum > 0 && <span className="shrink-0 text-caption text-primary-token font-[var(--fw-semibold)]">{amount.toFixed(2)} {moneda}</span>}
                                <div className="flex shrink-0 items-center gap-1">
                                  <input type="number" min="0" max="100" step="1" value={porcentajes[m.user_id] ?? ""} onChange={(e) => setPorcentajes((prev) => ({ ...prev, [m.user_id]: e.target.value }))} placeholder="0" inputMode="numeric" className="w-10 bg-transparent text-right text-body-sm text-app outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                                  <span className="text-caption text-muted">%</span>
                                  <StepperButtons onIncrement={() => setPorcentajes((prev) => ({ ...prev, [m.user_id]: adjustNumericString(prev[m.user_id] ?? "", 1, { min: 0, max: 100 }) }))} onDecrement={() => setPorcentajes((prev) => ({ ...prev, [m.user_id]: adjustNumericString(prev[m.user_id] ?? "", -1, { min: 0, max: 100 }) }))} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* CANTIDAD */}
                {metodo === "CANTIDAD" && (() => {
                  const sum = miembros.reduce((a, m) => a + (parseFloat(cantidades[m.user_id] || "0") || 0), 0);
                  const isOk = totalNum <= 0 || Math.abs(sum - totalNum) < 0.01;
                  const activeCount = miembros.filter(m => parseFloat(cantidades[m.user_id] || "0") > 0).length;
                  return (
                    <div className="rounded-xl border border-app overflow-hidden">
                      <div className="flex items-center bg-[var(--surface-2)]">
                        <span className="flex-1 px-3 py-2.5 text-body-sm text-muted">{activeCount} participante{activeCount !== 1 ? "s" : ""}</span>
                        <span className={`px-3 text-body-sm font-[var(--fw-semibold)] ${isOk && sum > 0 ? "text-[var(--success,#15803d)]" : sum > totalNum && totalNum > 0 ? "text-[var(--error,#dc2626)]" : "text-muted"}`}>{sum.toFixed(2)}{totalNum > 0 ? ` / ${totalNum.toFixed(2)}` : ""} {moneda}</span>
                        <button type="button" onClick={() => setParticipantesExpanded(v => !v)} className="flex size-9 shrink-0 items-center justify-center text-muted hover:text-app transition-colors border-l border-[var(--surface-inset)]">
                          {participantesExpanded ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                        </button>
                      </div>
                      {participantesExpanded && <div className="border-b border-[var(--surface-2)] px-3 py-2"><div className="flex h-9 items-center rounded-full border border-app bg-[var(--search-field-bg)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"><input value={participantesSearch} onChange={e => setParticipantesSearch(e.target.value)} placeholder="Buscar participante..." className="w-full bg-transparent text-body-sm text-app outline-none placeholder:text-muted" /></div></div>}
                      {participantesExpanded && (
                        <div className="max-h-[220px] overflow-y-auto divide-y divide-[var(--surface-2)]">
                          {miembros.filter(m => !participantesSearch || (m.nombre ?? "").toLowerCase().includes(participantesSearch.toLowerCase())).map((m) => {
                            const val = cantidades[m.user_id] ?? "";
                            const hasVal = parseFloat(val) > 0;
                            return (
                              <div key={m.user_id} className={`flex items-center gap-3 px-3 py-2.5 ${!hasVal ? "opacity-50" : ""}`}>
                                <Avatar src={m.foto} name={m.nombre ?? "?"} px={24} topMargin="" />
                                <span className="min-w-0 flex-1 truncate text-body-sm text-app">{m.nombre ?? m.user_id.slice(0, 8)}</span>
                                <div className="flex shrink-0 items-center gap-1">
                                  <input type="number" min="0" step="0.01" value={val} onChange={(e) => setCantidades((prev) => ({ ...prev, [m.user_id]: limitDecimals(e.target.value) }))} placeholder="0.00" inputMode="decimal" className="w-[52px] bg-transparent text-right text-body-sm text-app outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                                  <span className="text-caption text-muted">{moneda}</span>
                                  <StepperButtons onIncrement={() => setCantidades((prev) => ({ ...prev, [m.user_id]: adjustNumericString(prev[m.user_id] ?? "", 0.01, { min: 0, decimals: 2 }) }))} onDecrement={() => setCantidades((prev) => ({ ...prev, [m.user_id]: adjustNumericString(prev[m.user_id] ?? "", -0.01, { min: 0, decimals: 2 }) }))} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* POR_ITEMS */}
                {metodo === "POR_ITEMS" && (
                  <div className="space-y-[var(--space-3)]">
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm text-muted">{items.length} ítem{items.length !== 1 ? "s" : ""}</span>
                      <div className="flex items-center gap-[var(--space-3)]">
                        {items.length > 0 && <span className={`text-caption font-[var(--fw-semibold)] ${itemsSumMismatch ? "text-[var(--error)]" : "text-muted"}`}>{itemsSum.toFixed(2)} {moneda}{totalNum > 0 ? ` / ${totalNum.toFixed(2)} ${moneda}` : ""}</span>}
                        <button type="button" onClick={addItem} className="text-body-sm text-primary-token font-[var(--fw-medium)]">+ Añadir ítem</button>
                      </div>
                    </div>
                    {itemsSumMismatch && (
                      <div className="flex items-start gap-[var(--space-2)] rounded-[12px] border border-[var(--error)]/30 bg-[var(--error)]/10 px-[var(--space-3)] py-[var(--space-2)]">
                        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 size-4 shrink-0 text-[var(--error)]" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <p className="text-caption text-[var(--error)]">La suma de ítems ({itemsSum.toFixed(2)} {moneda}) no coincide con el total ({totalNum.toFixed(2)} {moneda}).</p>
                      </div>
                    )}
                    {items.length === 0 ? (
                      <p className="py-[var(--space-4)] text-center text-body-sm text-muted">Sube un ticket para detectar ítems o añádelos manualmente.</p>
                    ) : (
                      <div className="flex flex-col gap-[var(--space-3)]">
                        {items.map((item, idx) => (
                          <div key={idx} className="rounded-[16px] border border-app px-[var(--space-3)] py-[var(--space-3)] space-y-[var(--space-3)]">
                            <div className="flex items-center gap-[var(--space-2)]">
                              <input value={item.nombre} onChange={(e) => updateItem(idx, { nombre: e.target.value })} placeholder="Nombre del ítem" className="min-w-0 flex-1 bg-transparent text-body-sm font-[var(--fw-medium)] text-app outline-none" />
                              <button type="button" onClick={() => removeItem(idx)} className="text-muted hover:text-[var(--error)]"><svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg></button>
                            </div>
                            <div className="flex flex-wrap items-center gap-[var(--space-3)] text-caption text-muted">
                              <div className="flex items-center gap-1.5">
                                <span>×</span>
                                <input type="number" min="1" step="1" value={item.cantidad} onChange={(e) => updateItem(idx, { cantidad: parseInt(e.target.value) || 1 })} className="w-[36px] bg-transparent outline-none text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                                <StepperButtons onIncrement={() => updateItem(idx, { cantidad: item.cantidad + 1 })} onDecrement={() => updateItem(idx, { cantidad: Math.max(1, item.cantidad - 1) })} />
                                <span>ud</span>
                              </div>
                              <span>·</span>
                              <div className="flex items-center gap-1.5">
                                <input type="number" min="0" step="0.01" value={item.precio_unitario || ""} onChange={(e) => updateItem(idx, { precio_unitario: parseFloat(limitDecimals(e.target.value)) || 0 })} placeholder="0.00" className="w-[64px] bg-transparent outline-none text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                                <StepperButtons onIncrement={() => updateItem(idx, { precio_unitario: parseFloat((item.precio_unitario + 0.01).toFixed(2)) })} onDecrement={() => updateItem(idx, { precio_unitario: parseFloat(Math.max(0, item.precio_unitario - 0.01).toFixed(2)) })} />
                                <span>{moneda}</span>
                              </div>
                              <span>· Subtotal: <strong className="text-app">{item.subtotal.toFixed(2)} {moneda}</strong></span>
                            </div>
                            {/* Asignados */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {miembros.filter(m => item.asignados[m.user_id]).map(m => (
                                <button key={m.user_id} type="button" title={m.nombre ?? undefined} onClick={() => toggleItemUser(idx, m.user_id)} className="relative shrink-0 group">
                                  <Avatar src={m.foto} name={m.nombre ?? "?"} px={26} topMargin="" />
                                  <span className="absolute -top-0.5 -right-0.5 hidden group-hover:flex size-3.5 items-center justify-center rounded-full bg-[var(--error,#dc2626)] text-white"><svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></span>
                                </button>
                              ))}
                              <div className="relative">
                                <button ref={el => { itemPopoverBtnRefs.current[idx] = el; }} type="button" onClick={() => { setItemPopoverIdx(itemPopoverIdx === idx ? null : idx); setItemPopoverSearch(""); }} className="flex size-[26px] items-center justify-center rounded-full border border-dashed border-app text-muted hover:border-primary-token hover:text-primary-token transition-colors">
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                </button>
                                {itemPopoverIdx === idx && (() => {
                                  const r = itemPopoverBtnRefs.current[idx]?.getBoundingClientRect();
                                  const popoverH = 260;
                                  const spaceBelow = r ? window.innerHeight - r.bottom - 8 : 0;
                                  const showAbove = spaceBelow < popoverH;
                                  const top = showAbove ? undefined : (r ? r.bottom + 4 : 0);
                                  const bottom = showAbove ? (r ? window.innerHeight - r.top + 4 : 0) : undefined;
                                  const left = r ? Math.min(r.left, window.innerWidth - 220) : 0;
                                  const allChecked = miembros.every(m => !!item.asignados[m.user_id]);
                                  return (
                                    <>
                                      <div className="fixed inset-0 z-40" onClick={() => setItemPopoverIdx(null)} />
                                      <div className="fixed z-50 rounded-xl border border-app bg-[var(--surface)] shadow-elev-3" style={{ top, bottom, left, width: 210 }}>
                                        <div className="flex items-center justify-between border-b border-app px-3 py-2 gap-2">
                                          <div className="flex h-9 min-w-0 flex-1 items-center rounded-full border border-app bg-[var(--search-field-bg)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                          <input autoFocus value={itemPopoverSearch} onChange={e => setItemPopoverSearch(e.target.value)} placeholder="Buscar..." className="min-w-0 flex-1 bg-transparent text-body-sm text-app outline-none placeholder:text-muted" />
                                          </div>
                                          <button type="button" onClick={() => { const patch: Record<string, boolean> = {}; miembros.forEach(m => { patch[m.user_id] = !allChecked; }); updateItem(idx, { asignados: patch }); }} className="shrink-0 text-caption text-muted hover:text-primary-token transition-colors">{allChecked ? "Ninguno" : "Todos"}</button>
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto divide-y divide-[var(--surface-2)]">
                                          {miembros.filter(m => !itemPopoverSearch || (m.nombre ?? "").toLowerCase().includes(itemPopoverSearch.toLowerCase())).map(m => {
                                            const checked = !!item.asignados[m.user_id];
                                            return (
                                              <button key={m.user_id} type="button" onClick={() => toggleItemUser(idx, m.user_id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface-2)] transition-colors">
                                                <div className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary-token bg-primary-token" : "border-app"}`}>{checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
                                                <Avatar src={m.foto} name={m.nombre ?? "?"} px={20} topMargin="" />
                                                <span className="min-w-0 flex-1 truncate text-body-sm text-app">{m.nombre ?? m.user_id.slice(0, 8)}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                              {miembros.filter(m => item.asignados[m.user_id]).length === 0 && <span className="text-caption text-muted">Nadie asignado</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="mt-[var(--space-4)] text-body-sm text-[var(--error)]">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end border-t border-app px-[var(--page-margin-x)] py-[var(--space-4)]">
            <button
              type="button"
              onClick={handleNext}
              disabled={saving || ocrLoading || !canContinue()}
              className="rounded-[14px] bg-[var(--text-primary)] px-[var(--space-8)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-85 disabled:opacity-[var(--disabled-opacity)]"
            >
              {saving ? "Creando..." : step === TOTAL_STEPS ? "Crear gasto" : "Continuar"}
            </button>
          </div>
        </div>
      </div>
      <DiscardChangesDialog
        open={discardOpen}
        onCancel={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          requestClose();
        }}
      />
    </>
  );
}
