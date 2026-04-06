"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
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
        className="rounded-full object-cover"
        unoptimized
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="flex items-center justify-center rounded-full bg-primary-token/20 font-[var(--fw-semibold)] text-primary-token"
    >
      {initials}
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
  subplanes: SubplanRow[];
  onClose: () => void;
  onCreated: () => void;
};

// ── component ─────────────────────────────────────────────────────────────────

export default function AddGastoSheet({ planId, userId, subplanes, onClose, onCreated }: Props) {
  // ── form state ──
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [total, setTotal] = useState("");
  const [moneda, setMoneda] = useState("EUR");
  const [fechaGasto, setFechaGasto] = useState(todayISO());
  const [pagadoPor, setPagadoPor] = useState(userId);
  const [subplanId, setSubplanId] = useState<number | null>(null);
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
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("plan_id", String(planId));
      fd.append("user_id", userId);
      const res = await fetch("/api/receipts/ocr", { method: "POST", body: fd });
      const data = await res.json() as OcrResult;
      if ("error" in data) throw new Error((data as { error: string }).error);

      // Auto-fill fields from OCR
      if (data.comercio && !titulo) setTitulo(data.comercio);
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
        subplan_id: subplanId ?? undefined,
        items: metodo === "POR_ITEMS" ? buildItems() : undefined,
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

  const labelCls = "text-caption font-[var(--fw-semibold)] uppercase tracking-wider text-muted";
  const inputCls = "flex h-input w-full items-center rounded-input border border-app bg-surface-inset px-[var(--space-3)] text-body outline-none";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-[var(--space-4)]">
        <div className="flex w-full max-w-[540px] flex-col rounded-[20px] bg-surface shadow-elev-3 max-h-[90dvh] overflow-hidden">

          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
            {/* Scrollable body */}
            <div className="overflow-y-auto scrollbar-thin px-[var(--page-margin-x)] pt-[var(--space-5)] pb-[var(--space-2)] space-y-[var(--space-6)]">

              {/* Título + descripción */}
              <div>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Nombre del gasto"
                  className="w-full bg-transparent text-[22px] font-[var(--fw-semibold)] outline-none placeholder:text-muted"
                />
                <input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="mt-[var(--space-1)] w-full bg-transparent text-body-sm text-muted outline-none placeholder:text-muted/60"
                />
              </div>

              {/* Factura / OCR */}
              <div>
                <p className={`${labelCls} mb-[var(--space-2)]`}>Factura o ticket</p>
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
                  className="flex h-input w-full items-center gap-[var(--space-2)] rounded-input border border-dashed border-app bg-surface-inset px-[var(--space-3)] text-body-sm text-muted transition-colors hover:border-primary-token hover:text-primary-token disabled:opacity-60"
                >
                  {ocrLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Analizando...
                    </>
                  ) : receiptUrl ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" className="size-4 text-success-token" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-success-token">Factura detectada · Cambiar</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 16v-8M8 12l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                      </svg>
                      Subir factura (auto-rellena los campos)
                    </>
                  )}
                </button>
              </div>

              {/* Total + moneda */}
              <div>
                <p className={`${labelCls} mb-[var(--space-2)]`}>Importe</p>
                <div className="flex gap-[var(--space-2)]">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    placeholder="0.00"
                    className={`${inputCls} flex-1`}
                  />
                  <select
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value)}
                    className="h-input rounded-input border border-app bg-surface-inset px-[var(--space-2)] text-body outline-none"
                  >
                    {MONEDAS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Fecha */}
              <div>
                <p className={`${labelCls} mb-[var(--space-2)]`}>Fecha</p>
                <input
                  type="date"
                  value={fechaGasto}
                  onChange={(e) => setFechaGasto(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Pagado por */}
              {miembros.length > 0 && (
                <div>
                  <p className={`${labelCls} mb-[var(--space-2)]`}>Pagado por</p>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    {miembros.map((m) => (
                      <button
                        key={m.user_id}
                        type="button"
                        onClick={() => setPagadoPor(m.user_id)}
                        className={`flex items-center gap-[var(--space-2)] rounded-chip border px-[var(--space-3)] py-[var(--space-1)] text-body-sm transition-colors ${
                          pagadoPor === m.user_id
                            ? "border-primary-token bg-primary-token/15 text-primary-token"
                            : "border-app bg-surface-inset text-muted"
                        }`}
                      >
                        <Avatar foto={m.foto} nombre={m.nombre} size={20} />
                        {m.nombre ?? m.user_id.slice(0, 8)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subplan (opcional) */}
              {subplanes.length > 0 && (
                <div>
                  <p className={`${labelCls} mb-[var(--space-2)]`}>Actividad relacionada <span className="normal-case font-normal">(opcional)</span></p>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    <button
                      type="button"
                      onClick={() => setSubplanId(null)}
                      className={`rounded-chip border px-[var(--space-3)] py-[var(--space-1)] text-body-sm transition-colors ${
                        subplanId === null
                          ? "border-primary-token bg-primary-token/15 text-primary-token"
                          : "border-app bg-surface-inset text-muted"
                      }`}
                    >
                      Ninguna
                    </button>
                    {subplanes.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSubplanId(s.id)}
                        className={`rounded-chip border px-[var(--space-3)] py-[var(--space-1)] text-body-sm transition-colors ${
                          subplanId === s.id
                            ? "border-primary-token bg-primary-token/15 text-primary-token"
                            : "border-app bg-surface-inset text-muted"
                        }`}
                      >
                        {s.titulo}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Método de reparto */}
              <div>
                <p className={`${labelCls} mb-[var(--space-2)]`}>Cómo se divide</p>
                <div className="flex flex-col gap-[var(--space-2)]">
                  {METODOS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMetodo(m.value)}
                      className={`flex items-center justify-between rounded-input border px-[var(--space-3)] py-[var(--space-2)] text-left transition-colors ${
                        metodo === m.value
                          ? "border-primary-token bg-primary-token/10"
                          : "border-app bg-surface-inset"
                      }`}
                    >
                      <div>
                        <p className={`text-body-sm font-[var(--fw-medium)] ${metodo === m.value ? "text-primary-token" : ""}`}>{m.label}</p>
                        <p className="text-caption text-muted">{m.desc}</p>
                      </div>
                      {metodo === m.value && (
                        <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0 text-primary-token" stroke="currentColor" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Participantes según método ── */}

              {/* IGUAL */}
              {metodo === "IGUAL" && miembros.length > 0 && (
                <div>
                  <p className={`${labelCls} mb-[var(--space-2)]`}>Quién participa</p>
                  <div className="flex flex-col gap-[var(--space-2)]">
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
                          className={`flex items-center gap-[var(--space-3)] rounded-input border px-[var(--space-3)] py-[var(--space-2)] transition-colors ${
                            checked ? "border-primary-token bg-primary-token/10" : "border-app bg-surface-inset"
                          }`}
                        >
                          <Avatar foto={m.foto} nombre={m.nombre} size={28} />
                          <span className={`flex-1 text-left text-body-sm font-[var(--fw-medium)] ${checked ? "text-primary-token" : ""}`}>
                            {m.nombre ?? m.user_id.slice(0, 8)}
                          </span>
                          {checked && totalNum > 0 && (
                            <span className="text-body-sm text-primary-token font-[var(--fw-semibold)]">
                              {part.toFixed(2)} {moneda}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PORCENTAJE */}
              {metodo === "PORCENTAJE" && miembros.length > 0 && (
                <div>
                  <p className={`${labelCls} mb-[var(--space-2)]`}>Porcentaje por persona</p>
                  <div className="flex flex-col gap-[var(--space-2)]">
                    {miembros.map((m) => {
                      const pct = parseFloat(porcentajes[m.user_id] || "0");
                      const amount = totalNum * pct / 100;
                      return (
                        <div key={m.user_id} className="flex items-center gap-[var(--space-3)] rounded-input border border-app bg-surface-inset px-[var(--space-3)] py-[var(--space-2)]">
                          <Avatar foto={m.foto} nombre={m.nombre} size={28} />
                          <span className="flex-1 text-body-sm font-[var(--fw-medium)]">
                            {m.nombre ?? m.user_id.slice(0, 8)}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={porcentajes[m.user_id] ?? ""}
                            onChange={(e) => setPorcentajes((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                            placeholder="0"
                            className="w-[60px] bg-transparent text-right text-body-sm outline-none"
                          />
                          <span className="text-body-sm text-muted">%</span>
                          {pct > 0 && totalNum > 0 && (
                            <span className="w-[70px] text-right text-body-sm text-primary-token font-[var(--fw-semibold)]">
                              {amount.toFixed(2)}
                            </span>
                          )}
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
                </div>
              )}

              {/* CANTIDAD */}
              {metodo === "CANTIDAD" && miembros.length > 0 && (
                <div>
                  <p className={`${labelCls} mb-[var(--space-2)]`}>Cantidad por persona</p>
                  <div className="flex flex-col gap-[var(--space-2)]">
                    {miembros.map((m) => (
                      <div key={m.user_id} className="flex items-center gap-[var(--space-3)] rounded-input border border-app bg-surface-inset px-[var(--space-3)] py-[var(--space-2)]">
                        <Avatar foto={m.foto} nombre={m.nombre} size={28} />
                        <span className="flex-1 text-body-sm font-[var(--fw-medium)]">
                          {m.nombre ?? m.user_id.slice(0, 8)}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cantidades[m.user_id] ?? ""}
                          onChange={(e) => setCantidades((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                          placeholder="0.00"
                          className="w-[80px] bg-transparent text-right text-body-sm outline-none"
                        />
                        <span className="text-body-sm text-muted">{moneda}</span>
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
                </div>
              )}

              {/* POR_ITEMS */}
              {metodo === "POR_ITEMS" && (
                <div>
                  <div className="flex items-center justify-between mb-[var(--space-2)]">
                    <p className={labelCls}>Ítems del ticket</p>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-body-sm text-primary-token font-[var(--fw-medium)]"
                    >
                      + Añadir ítem
                    </button>
                  </div>
                  {items.length === 0 && (
                    <p className="text-body-sm text-muted text-center py-[var(--space-4)]">
                      Sube una factura para autodetectar los ítems, o añádelos manualmente
                    </p>
                  )}
                  <div className="flex flex-col gap-[var(--space-4)]">
                    {items.map((item, idx) => (
                      <div key={idx} className="rounded-input border border-app bg-surface-inset p-[var(--space-3)] space-y-[var(--space-2)]">
                        <div className="flex items-center gap-[var(--space-2)]">
                          <input
                            value={item.nombre}
                            onChange={(e) => updateItem(idx, { nombre: e.target.value })}
                            placeholder="Nombre del ítem"
                            className="flex-1 bg-transparent text-body-sm font-[var(--fw-medium)] outline-none"
                          />
                          <button type="button" onClick={() => removeItem(idx)} className="text-muted hover:text-[var(--error)]">
                            <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex gap-[var(--space-2)] text-caption text-muted">
                          <span>×</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.cantidad}
                            onChange={(e) => updateItem(idx, { cantidad: parseInt(e.target.value) || 1 })}
                            className="w-[40px] bg-transparent outline-none text-center"
                          />
                          <span>ud ·</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.precio_unitario || ""}
                            onChange={(e) => updateItem(idx, { precio_unitario: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="w-[60px] bg-transparent outline-none text-right"
                          />
                          <span>{moneda} · Subtotal: {item.subtotal.toFixed(2)} {moneda}</span>
                        </div>
                        {/* Assign to members */}
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
                </div>
              )}

              {error && <p className="text-body-sm text-[var(--error)]">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-app px-[var(--page-margin-x)] py-[var(--space-4)]">
              <button
                type="button"
                onClick={onClose}
                className="text-body-sm font-[var(--fw-medium)] text-[var(--error)] transition-opacity hover:opacity-70"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || ocrLoading}
                className="rounded-chip bg-primary-token px-[var(--space-6)] py-[var(--space-2)] text-body-sm font-[var(--fw-semibold)] text-contrast-token disabled:opacity-[var(--disabled-opacity)]"
              >
                {saving ? "Guardando..." : "Guardar gasto"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
