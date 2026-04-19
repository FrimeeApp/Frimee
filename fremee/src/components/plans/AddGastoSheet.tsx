"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  createGastoEndpoint,
  fetchPlanMiembrosEndpoint,
  type MetodoReparto,
  type PlanMiembro,
  type GastoItemInput,
} from "@/services/api/endpoints/gastos.endpoint";
import type { OcrResult, OcrItem } from "@/app/api/receipts/ocr/route";

// ── helpers ───────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function clampNumber(value: number, min?: number, max?: number) {
  if (typeof min === "number" && value < min) return min;
  if (typeof max === "number" && value > max) return max;
  return value;
}

function adjustNumericString(
  current: string,
  delta: number,
  { min, max, decimals = 0 }: { min?: number; max?: number; decimals?: number } = {},
) {
  const base = Number.parseFloat(current || "0");
  const next = clampNumber((Number.isFinite(base) ? base : 0) + delta, min, max);
  return decimals > 0 ? next.toFixed(decimals) : String(next);
}

function Avatar({ foto, nombre, size = 32 }: { foto: string | null; nombre: string | null; size?: number }) {
  const initials = (nombre ?? "?").slice(0, 1).toUpperCase();
  if (foto) {
    return (
      <Image
        src={foto}
        alt={nombre ?? ""}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full border border-app object-cover"
        unoptimized
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="flex items-center justify-center rounded-full border border-app bg-primary-token/20 font-[var(--fw-semibold)] text-primary-token"
    >
      {initials}
    </div>
  );
}

function StepperButtons({
  onIncrement,
  onDecrement,
}: {
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center">
      <button
        type="button"
        onClick={onIncrement}
        aria-label="Aumentar valor"
        className="flex h-3.5 w-3.5 items-center justify-center rounded text-muted transition-colors hover:bg-surface hover:text-app"
      >
        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 7.5 6 4.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDecrement}
        aria-label="Disminuir valor"
        className="flex h-3.5 w-3.5 items-center justify-center rounded text-muted transition-colors hover:bg-surface hover:text-app"
      >
        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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

// ── types ─────────────────────────────────────────────────────────────────────

type ItemAsignacion = OcrItem & {
  asignados: Record<string, boolean>; // user_id → checked
};

type Props = {
  planId: number;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
};

// ── component ─────────────────────────────────────────────────────────────────

export default function AddGastoSheet({ planId, userId, onClose, onCreated }: Props) {
  // ── form state ──
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [total, setTotal] = useState("");
  const [moneda, setMoneda] = useState("EUR");
  const [fechaGasto, setFechaGasto] = useState(todayISO());
  const [pagadoPor, setPagadoPor] = useState(userId);
  const [metodo, setMetodo] = useState<MetodoReparto>("IGUAL");

  // ── participants state ──
  const [miembros, setMiembros] = useState<PlanMiembro[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());        // IGUAL
  const [porcentajes, setPorcentajes] = useState<Record<string, string>>({});         // PORCENTAJE
  const [cantidades, setCantidades] = useState<Record<string, string>>({});           // CANTIDAD
  const [items, setItems] = useState<ItemAsignacion[]>([]);                           // POR_ITEMS

  // ── OCR state ──
  const [ocrLoading, setOcrLoading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [notAReceipt, setNotAReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Load plan members
  useEffect(() => {
    fetchPlanMiembrosEndpoint(planId)
      .then((data) => {
        setMiembros(data);
        // Default: all members selected for IGUAL
        setSeleccionados(new Set(data.map((m) => m.user_id)));
        const initPct: Record<string, string> = {};
        const initCant: Record<string, string> = {};
        data.forEach((m) => {
          initPct[m.user_id] = "";
          initCant[m.user_id] = "";
        });
        setPorcentajes(initPct);
        setCantidades(initCant);
      })
      .catch(() => {/* ignore */});
  }, [planId]);

  // ── OCR ──────────────────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setError(null);
    setNotAReceipt(false);
    try {
      // Normalise image to JPEG so OpenAI always gets a supported format.
      // PDFs are left as-is (handled server-side with text extraction).
      let fileToSend: File | Blob = file;
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf && file.type.startsWith("image/")) {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
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

      if (!data.is_receipt) {
        setNotAReceipt(true);
      }

      // Auto-fill fields from OCR — always overwrite with the new receipt
      if (data.comercio) setTitulo(data.comercio);
      if (data.total != null) setTotal(String(data.total));
      if (data.moneda) setMoneda(data.moneda);
      if (data.fecha) setFechaGasto(data.fecha);
      if (data.url) setReceiptUrl(data.url);

      // Pre-fill items for POR_ITEMS
      if (data.items.length > 0) {
        setMetodo("POR_ITEMS");
        setItems(
          data.items.map((item) => ({
            ...item,
            asignados: Object.fromEntries(miembros.map((m) => [m.user_id, false])),
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar el archivo");
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── items helpers (POR_ITEMS) ─────────────────────────────────────────────
  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        nombre: "",
        precio_unitario: 0,
        cantidad: 1,
        subtotal: 0,
        asignados: Object.fromEntries(miembros.map((m) => [m.user_id, false])),
      },
    ]);
  }

  function updateItem(idx: number, patch: Partial<ItemAsignacion>) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, ...patch };
      // Recalculate subtotal when price/qty changes
      if ("precio_unitario" in patch || "cantidad" in patch) {
        updated.subtotal = updated.precio_unitario * updated.cantidad;
      }
      return updated;
    }));
  }

  function toggleItemUser(idx: number, uid: string) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, asignados: { ...item.asignados, [uid]: !item.asignados[uid] } };
    }));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── validation & submit ───────────────────────────────────────────────────
  const totalNum = parseFloat(total) || 0;
  const itemsSum = items.reduce((acc, item) => acc + item.subtotal, 0);
  const itemsSumMismatch = metodo === "POR_ITEMS" && totalNum > 0 && items.length > 0 && Math.abs(itemsSum - totalNum) > 0.01;

  function buildParticiantes() {
    if (metodo === "IGUAL") {
      return Array.from(seleccionados).map((uid) => ({ user_id: uid }));
    }
    if (metodo === "PORCENTAJE") {
      return miembros
        .filter((m) => parseFloat(porcentajes[m.user_id] || "0") > 0)
        .map((m) => ({ user_id: m.user_id, porcentaje: parseFloat(porcentajes[m.user_id]) }));
    }
    if (metodo === "CANTIDAD") {
      return miembros
        .filter((m) => parseFloat(cantidades[m.user_id] || "0") > 0)
        .map((m) => ({ user_id: m.user_id, importe: parseFloat(cantidades[m.user_id]) }));
    }
    // POR_ITEMS: collect all users that appear in at least one item
    const uids = new Set<string>();
    items.forEach((item) => Object.keys(item.asignados).forEach((uid) => {
      if (item.asignados[uid]) uids.add(uid);
    }));
    return Array.from(uids).map((uid) => ({ user_id: uid }));
  }

  function buildItems(): GastoItemInput[] {
    return items.map((item) => {
      const assigned = miembros.filter((m) => item.asignados[m.user_id]);
      const perUser = assigned.length > 0 ? item.subtotal / assigned.length : 0;
      return {
        nombre: item.nombre,
        precio_unitario: item.precio_unitario,
        cantidad: item.cantidad,
        subtotal: item.subtotal,
        usuarios: assigned.map((m) => ({ user_id: m.user_id, subtotal_asignado: perUser })),
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || totalNum <= 0) {
      setError("Introduce un título y el importe total");
      return;
    }
    if (itemsSumMismatch) {
      setError(`La suma de los ítems (${itemsSum.toFixed(2)} ${moneda}) no coincide con el total (${totalNum.toFixed(2)} ${moneda})`);
      return;
    }
    const participantes = buildParticiantes();
    if (participantes.length === 0) {
      setError("Selecciona al menos un participante");
      return;
    }
    setSaving(true);
    setError(null);
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
        descripcion: descripcion.trim() || undefined,
        items: metodo === "POR_ITEMS" ? buildItems() : undefined,
        receipt_url: receiptUrl ?? undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el gasto");
    } finally {
      setSaving(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const labelCls = "text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted md:text-muted [color:color-mix(in_oklab,var(--text-primary)_72%,transparent)] dark:text-muted";
  const fieldLineCls = "border-b-2 border-app pb-[var(--space-2)] transition-colors focus-within:border-primary-token";
  const activeMetodo = METODOS.find((m) => m.value === metodo);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-[var(--space-4)]"
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          if (window.matchMedia("(min-width: 768px)").matches) onClose();
        }}
      >
        <div
          className="flex h-full w-full flex-col overflow-hidden bg-app md:h-auto md:max-h-[92dvh] md:max-w-[620px] md:rounded-[22px] md:border md:border-app md:shadow-elev-4"
          onClick={(e) => e.stopPropagation()}
        >

          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between px-[var(--space-5)] py-[var(--space-3)]">
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-app transition-colors hover:bg-surface"
                aria-label="Cerrar"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <div className="size-9" aria-hidden="true" />
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-[var(--space-6)] pb-[var(--space-8)] pt-[var(--space-2)] space-y-[var(--space-6)]">
              <div className="mb-[var(--space-3)]">
                <h2 className="font-[var(--fw-bold)] leading-tight text-app" style={{ fontSize: "clamp(22px, 5vw, 28px)" }}>
                  ¿Qué es?
                </h2>
              </div>

              <section className="space-y-[var(--space-4)]">
                <div className={fieldLineCls}>
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Concepto"
                    className="w-full bg-transparent text-[22px] font-[var(--fw-semibold)] text-app outline-none placeholder:text-muted"
                  />
                </div>

                <div className="grid gap-[var(--space-5)] sm:grid-cols-2">
                  <div>
                    <p className="mb-[var(--space-2)] text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted [color:color-mix(in_oklab,var(--text-primary)_72%,transparent)] dark:text-muted">Importe</p>
                    <div className={`${fieldLineCls} flex items-center gap-[var(--space-3)]`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={total}
                        onChange={(e) => setTotal(e.target.value)}
                        placeholder="0.00"
                        className="min-w-0 flex-1 bg-transparent text-body text-app outline-none placeholder:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <select
                        value={moneda}
                        onChange={(e) => setMoneda(e.target.value)}
                        className="shrink-0 bg-transparent text-body text-app outline-none"
                      >
                        {MONEDAS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <p className="mb-[var(--space-2)] text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted [color:color-mix(in_oklab,var(--text-primary)_72%,transparent)] dark:text-muted">Fecha</p>
                    <div className={fieldLineCls}>
                      <input
                        type="date"
                        value={fechaGasto}
                        onChange={(e) => setFechaGasto(e.target.value)}
                        className="w-full bg-transparent text-body text-app outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={ocrLoading}
                    className={`inline-flex items-center gap-[var(--space-2)] rounded-[14px] border px-[var(--space-4)] py-[10px] text-body-sm font-[var(--fw-semibold)] transition-colors disabled:opacity-60 ${
                      receiptUrl && !notAReceipt
                        ? "border-success-token/30 bg-success-token/10 text-success-token hover:bg-success-token/15"
                        : "border-app bg-surface text-app hover:border-primary-token hover:text-primary-token"
                    }`}
                  >
                    {ocrLoading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Analizando...
                      </>
                    ) : receiptUrl && !notAReceipt ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" className="size-4 text-success-token" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Ticket leído · Campos e ítems detectados
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="1.8">
                          <path d="M12 16v-8M8 12l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                          <rect x="3" y="3" width="18" height="18" rx="3" />
                        </svg>
                        {notAReceipt ? "Subir otro archivo" : "Leer ticket o factura"}
                      </>
                    )}
                  </button>
                  <p className="text-caption text-muted">
                    * Rellena los campos automáticamente y detecta los ítems del ticket.
                  </p>
                </div>
                {notAReceipt && (
                  <div className="flex items-start gap-[var(--space-2)] rounded-[12px] border border-[var(--warning,#f59e0b)]/30 bg-[var(--warning,#f59e0b)]/10 px-[var(--space-3)] py-[var(--space-2)]">
                    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 size-4 shrink-0 text-[var(--warning,#f59e0b)]" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-caption text-[var(--warning,#f59e0b)]">
                      La imagen no parece un recibo o factura. Puedes seguir, pero revisa los campos manualmente.
                    </p>
                  </div>
                )}
              </section>

              {miembros.length > 0 && (
                <section className="space-y-[var(--space-3)] border-t border-app pt-[var(--space-5)]">
                  <p className={labelCls}>¿Quién ha pagado?</p>
                  <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-3">
                    {miembros.map((m) => (
                      <button
                        key={m.user_id}
                        type="button"
                        onClick={() => setPagadoPor(m.user_id)}
                        className={`flex w-full items-center gap-[var(--space-2)] rounded-[12px] border px-[var(--space-2)] py-[10px] text-left transition-colors ${
                          pagadoPor === m.user_id
                            ? "border-primary-token bg-primary-token/10"
                            : "border-app bg-app hover:bg-surface"
                        }`}
                      >
                        <Avatar foto={m.foto} nombre={m.nombre} size={24} />
                        <span className={`min-w-0 flex-1 truncate text-body-sm font-[var(--fw-medium)] ${pagadoPor === m.user_id ? "text-primary-token" : "text-app"}`}>
                          {m.nombre ?? m.user_id.slice(0, 8)}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-[var(--space-4)] border-t border-app pt-[var(--space-5)]">
                <p className={labelCls}>Se reparte entre</p>

                <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-4">
                  {METODOS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMetodo(m.value)}
                      className={`rounded-[14px] border px-[var(--space-3)] py-[var(--space-3)] text-left text-body-sm transition-colors ${
                        metodo === m.value
                          ? "border-primary-token bg-primary-token/10 text-primary-token"
                          : "border-app bg-app text-app hover:bg-surface"
                      }`}
                    >
                      <span className="block font-[var(--fw-semibold)]">{m.label}</span>
                    </button>
                  ))}
                </div>

                <p className="text-body-sm text-muted">{activeMetodo?.desc}</p>

                {metodo === "IGUAL" && miembros.length > 0 && (
                  <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-3">
                    {miembros.map((m) => {
                      const checked = seleccionados.has(m.user_id);
                      const count = seleccionados.size;
                      const part = checked && count > 0 ? totalNum / count : 0;
                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => setSeleccionados((prev) => {
                            const next = new Set(prev);
                            if (next.has(m.user_id)) next.delete(m.user_id);
                            else next.add(m.user_id);
                            return next;
                          })}
                          className={`flex w-full items-center gap-[var(--space-2)] rounded-[12px] border px-[var(--space-2)] py-[10px] text-left transition-colors ${
                            checked ? "border-primary-token bg-primary-token/10" : "border-app bg-app hover:bg-surface"
                          }`}
                        >
                          <Avatar foto={m.foto} nombre={m.nombre} size={24} />
                          <span className={`min-w-0 flex-1 truncate text-body-sm font-[var(--fw-medium)] ${checked ? "text-primary-token" : "text-app"}`}>
                            {m.nombre ?? m.user_id.slice(0, 8)}
                          </span>
                          {checked && totalNum > 0 && (
                            <span className="shrink-0 text-caption text-primary-token font-[var(--fw-semibold)]">
                              {part.toFixed(2)} {moneda}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {metodo === "PORCENTAJE" && miembros.length > 0 && (
                  <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-3">
                    {miembros.map((m) => {
                      const pct = parseFloat(porcentajes[m.user_id] || "0");
                      const amount = totalNum * pct / 100;
                      return (
                        <div key={m.user_id} className="flex items-center gap-[var(--space-2)] rounded-[12px] border border-app px-[var(--space-2)] py-[10px]">
                          <Avatar foto={m.foto} nombre={m.nombre} size={24} />
                          <span className="min-w-0 flex-1 truncate text-body-sm font-[var(--fw-medium)] text-app">
                            {m.nombre ?? m.user_id.slice(0, 8)}
                          </span>
                          {pct > 0 && totalNum > 0 && (
                            <span className="shrink-0 text-caption font-[var(--fw-semibold)] text-primary-token">
                              {amount.toFixed(2)} {moneda}
                            </span>
                          )}
                          <div className="flex shrink-0 items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={porcentajes[m.user_id] ?? ""}
                              onChange={(e) => setPorcentajes((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                              placeholder="0"
                              inputMode="numeric"
                              className="w-[32px] appearance-none bg-transparent text-right text-body-sm text-app outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <span className="shrink-0 text-caption text-app">%</span>
                            <StepperButtons
                              onIncrement={() =>
                                setPorcentajes((prev) => ({
                                  ...prev,
                                  [m.user_id]: adjustNumericString(prev[m.user_id] ?? "", 1, { min: 0, max: 100 }),
                                }))
                              }
                              onDecrement={() =>
                                setPorcentajes((prev) => ({
                                  ...prev,
                                  [m.user_id]: adjustNumericString(prev[m.user_id] ?? "", -1, { min: 0, max: 100 }),
                                }))
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                    {(() => {
                      const sum = Object.values(porcentajes).reduce((a, v) => a + (parseFloat(v) || 0), 0);
                      return sum !== 0 && sum !== 100 ? (
                        <p className="text-caption text-[var(--error)]">Los porcentajes deben sumar 100% (actual: {sum}%)</p>
                      ) : null;
                    })()}
                  </div>
                )}

                {metodo === "CANTIDAD" && miembros.length > 0 && (
                  <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-3">
                    {miembros.map((m) => (
                      <div key={m.user_id} className="flex items-center gap-[var(--space-2)] rounded-[12px] border border-app px-[var(--space-2)] py-[10px]">
                        <Avatar foto={m.foto} nombre={m.nombre} size={24} />
                        <span className="min-w-0 flex-1 truncate text-body-sm font-[var(--fw-medium)] text-app">
                          {m.nombre ?? m.user_id.slice(0, 8)}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cantidades[m.user_id] ?? ""}
                            onChange={(e) => setCantidades((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                            placeholder="0.00"
                            inputMode="decimal"
                            className="w-[46px] appearance-none bg-transparent text-right text-body-sm text-app outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <span className="shrink-0 text-caption text-app">{moneda}</span>
                          <StepperButtons
                            onIncrement={() =>
                              setCantidades((prev) => ({
                                ...prev,
                                [m.user_id]: adjustNumericString(prev[m.user_id] ?? "", 0.01, { min: 0, decimals: 2 }),
                              }))
                            }
                            onDecrement={() =>
                              setCantidades((prev) => ({
                                ...prev,
                                [m.user_id]: adjustNumericString(prev[m.user_id] ?? "", -0.01, { min: 0, decimals: 2 }),
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                    {(() => {
                      const sum = Object.values(cantidades).reduce((a, v) => a + (parseFloat(v) || 0), 0);
                      return totalNum > 0 && Math.abs(sum - totalNum) > 0.01 ? (
                        <p className="text-caption text-[var(--error)]">
                          Las cantidades suman {sum.toFixed(2)} {moneda} (total: {totalNum.toFixed(2)} {moneda})
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}

                {metodo === "POR_ITEMS" && (
                  <div className="space-y-[var(--space-3)]">
                    <div className="flex items-center justify-between">
                      <p className={labelCls}>Ítems</p>
                      <div className="flex items-center gap-[var(--space-3)]">
                        {items.length > 0 && (
                          <span className={`text-caption font-[var(--fw-semibold)] ${itemsSumMismatch ? "text-[var(--error)]" : "text-muted"}`}>
                            {itemsSum.toFixed(2)} {moneda}{totalNum > 0 ? ` / ${totalNum.toFixed(2)} ${moneda}` : ""}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={addItem}
                          className="text-body-sm text-primary-token font-[var(--fw-medium)]"
                        >
                          + Añadir ítem
                        </button>
                      </div>
                    </div>
                    {itemsSumMismatch && (
                      <div className="flex items-start gap-[var(--space-2)] rounded-[12px] border border-[var(--error)]/30 bg-[var(--error)]/10 px-[var(--space-3)] py-[var(--space-2)]">
                        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 size-4 shrink-0 text-[var(--error)]" stroke="currentColor" strokeWidth="2">
                          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <p className="text-caption text-[var(--error)]">
                          La suma de ítems ({itemsSum.toFixed(2)} {moneda}) no coincide con el total ({totalNum.toFixed(2)} {moneda}). Ajusta los ítems o el total.
                        </p>
                      </div>
                    )}
                    {items.length === 0 ? (
                      <p className="text-body-sm text-muted text-center py-[var(--space-4)]">
                        Sube un ticket para detectar ítems o añádelos manualmente.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-[var(--space-3)]">
                        {items.map((item, idx) => (
                          <div key={idx} className="rounded-[16px] border border-app px-[var(--space-3)] py-[var(--space-3)] space-y-[var(--space-3)]">
                            <div className="flex items-center gap-[var(--space-2)]">
                              <input
                                value={item.nombre}
                                onChange={(e) => updateItem(idx, { nombre: e.target.value })}
                                placeholder="Nombre del ítem"
                                className="min-w-0 flex-1 bg-transparent text-body-sm font-[var(--fw-medium)] text-app outline-none"
                              />
                              <button type="button" onClick={() => removeItem(idx)} className="text-muted hover:text-[var(--error)]">
                                <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                                </svg>
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-[var(--space-3)] text-caption text-muted">
                              <div className="flex items-center gap-1.5">
                                <span>×</span>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.cantidad}
                                  onChange={(e) => updateItem(idx, { cantidad: parseInt(e.target.value) || 1 })}
                                  className="w-[36px] bg-transparent outline-none text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <StepperButtons
                                  onIncrement={() => updateItem(idx, { cantidad: item.cantidad + 1 })}
                                  onDecrement={() => updateItem(idx, { cantidad: Math.max(1, item.cantidad - 1) })}
                                />
                                <span>ud</span>
                              </div>
                              <span>·</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.precio_unitario || ""}
                                  onChange={(e) => updateItem(idx, { precio_unitario: parseFloat(e.target.value) || 0 })}
                                  placeholder="0.00"
                                  className="w-[64px] bg-transparent outline-none text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <StepperButtons
                                  onIncrement={() => updateItem(idx, { precio_unitario: parseFloat((item.precio_unitario + 0.01).toFixed(2)) })}
                                  onDecrement={() => updateItem(idx, { precio_unitario: parseFloat(Math.max(0, item.precio_unitario - 0.01).toFixed(2)) })}
                                />
                                <span>{moneda}</span>
                              </div>
                              <span>· Subtotal: <strong className="text-app">{item.subtotal.toFixed(2)} {moneda}</strong></span>
                            </div>

                            <div>
                              <p className="text-caption text-muted mb-[var(--space-1)]">¿Quién lo consume?</p>
                              <div className="flex flex-wrap gap-[var(--space-1)]">
                                {miembros.map((m) => (
                                  <button
                                    key={m.user_id}
                                    type="button"
                                    onClick={() => toggleItemUser(idx, m.user_id)}
                                    className={`flex items-center gap-1 rounded-chip border px-2 py-0.5 text-caption transition-colors ${
                                      item.asignados[m.user_id]
                                        ? "border-primary-token bg-primary-token/15 text-primary-token"
                                        : "border-app text-muted"
                                    }`}
                                  >
                                    <Avatar foto={m.foto} nombre={m.nombre} size={14} />
                                    {m.nombre ?? m.user_id.slice(0, 6)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {error && <p className="text-body-sm text-[var(--error)]">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-app px-[var(--page-margin-x)] py-[var(--space-4)]">
              <button
                type="submit"
                disabled={saving || ocrLoading}
                className="rounded-[14px] bg-[var(--text-primary)] px-[var(--space-8)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-85 disabled:opacity-[var(--disabled-opacity)]"
              >
                {saving ? "Creando..." : "Crear gasto"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
