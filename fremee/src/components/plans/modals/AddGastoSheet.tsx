"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BedDouble, Camera, CarFront, Check, CircleAlert, CircleEllipsis, LoaderCircle, Plus,
  ReceiptText, Search, ShoppingBag, Ticket, Trash2, Upload, UtensilsCrossed, X,
} from "lucide-react";
import {
  createGastoEndpoint,
  fetchPlanMiembrosEndpoint,
  type MetodoReparto,
  type PlanMiembro,
  type GastoItemInput,
} from "@/services/api/endpoints/gastos.endpoint";
import { fetchSubplanes, type SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import type { OcrResult } from "@/app/api/receipts/ocr/route";
import { todayISO } from "@/lib/form-helpers";
import { formatMoney } from "@/lib/formatters";
import { buildInternalApiUrl } from "@/config/external";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { DiscardChangesDialog } from "@/components/ui/DiscardChangesDialog";
import { Wizard, WizardSection, WizardSelect, WizardSummary } from "@/components/ui/Wizard";
import { useToast } from "@/components/ui/Toaster";

type CategoriaGasto = { id: number; nombre: string; icono: string | null; color: string | null };

const MONEDAS = ["EUR", "USD", "GBP", "MXN", "ARS", "COP", "CLP", "BRL"];
const STEPS = ["Qué y cuánto", "Quién paga", "Reparto"] as const;

/** The six visible groups; each keeps its detailed categories one tap below (nothing is removed). */
const GRUPOS: { key: string; label: string; Icon: LucideIcon; ids: number[] }[] = [
  { key: "comida",      label: "Comida",      Icon: UtensilsCrossed, ids: [13, 14, 15] },
  { key: "alojamiento", label: "Alojamiento", Icon: BedDouble,       ids: [9, 10, 11, 12] },
  { key: "transporte",  label: "Transporte",  Icon: CarFront,        ids: [1, 2, 3, 4, 5, 6, 7, 8] },
  { key: "actividades", label: "Actividades", Icon: Ticket,          ids: [16, 17, 18, 19] },
  { key: "compras",     label: "Compras",     Icon: ShoppingBag,     ids: [22, 23, 21] },
  { key: "otros",       label: "Otros",       Icon: CircleEllipsis,  ids: [0, 20, 24] },
];
const grupoDe = (id: number) => GRUPOS.find((g) => g.ids.includes(id)) ?? GRUPOS[GRUPOS.length - 1];

const METODOS: { value: MetodoReparto; label: string }[] = [
  { value: "IGUAL",      label: "A partes iguales" },
  { value: "PORCENTAJE", label: "Porcentaje" },
  { value: "CANTIDAD",   label: "Cantidades" },
  { value: "POR_ITEMS",  label: "Por ítems" },
];

type Item = { key: number; nombre: string; cantidad: number; subtotal: string; asignados: Set<string> };
type TicketState = "vacio" | "leyendo" | "leido" | "error";

/** «86,40» or «86.40» → 86.4 */
const num = (s: string) => {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
/** 86.4 → «86,40» for an input. */
const toInput = (n: number) => n.toFixed(2).replace(".", ",");
const firstName = (m: PlanMiembro | undefined) => (m?.nombre ?? m?.username ?? "").split(" ")[0] || "Alguien";

function Av({ m, me }: { m: PlanMiembro; me: boolean }) {
  const name = me ? "Tú" : firstName(m);
  return (
    <span className="wz-av" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- 28 px avatar */}
      {m.foto ? <img src={m.foto} alt="" /> : name[0]?.toUpperCase()}
    </span>
  );
}

type Props = {
  planId: number;
  userId: string;
  planName?: string;
  /** Pre-selected date (YYYY-MM-DD), e.g. a day of the itinerary. */
  initialDate?: string;
  onClose: () => void;
  onCreated: () => void;
};

export default function AddGastoSheet({ planId, userId, planName, initialDate, onClose, onCreated }: Props) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose);
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // ── step 1 ──
  const [titulo, setTitulo] = useState("");
  const [total, setTotal] = useState("");
  const [moneda, setMoneda] = useState("EUR");
  const [fechaGasto, setFechaGasto] = useState(initialDate ?? todayISO());
  const [categoriaId, setCategoriaId] = useState<number>(0);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [subplanes, setSubplanes] = useState<SubplanRow[]>([]);
  const [subplanId, setSubplanId] = useState<number | null>(null);
  /** Fields Frimee filled from the ticket and nobody has touched since. */
  const [delTicket, setDelTicket] = useState<Set<"importe" | "concepto" | "fecha">>(new Set());

  // ── ticket ──
  const [ticket, setTicket] = useState<TicketState>("vacio");
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ticketRun = useRef(0);

  // ── step 2 ──
  const [miembros, setMiembros] = useState<PlanMiembro[]>([]);
  const [pagadoPor, setPagadoPor] = useState(userId);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [buscar, setBuscar] = useState("");

  // ── step 3 ──
  const [metodo, setMetodo] = useState<MetodoReparto>("IGUAL");
  const [porcentajes, setPorcentajes] = useState<Record<string, string>>({});
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Item[]>([]);
  const itemKey = useRef(1);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  // ── load ──
  useEffect(() => {
    createBrowserSupabaseClient().from("categorias_gasto").select("id,nombre,icono,color").order("id")
      .then(({ data }) => { if (data) setCategorias(data as CategoriaGasto[]); });
    fetchSubplanes(planId).then(setSubplanes).catch(() => {});
    fetchPlanMiembrosEndpoint(planId)
      .then((data) => { setMiembros(data); setSeleccionados(new Set(data.map((m) => m.user_id))); })
      .catch(() => {});
  }, [planId]);

  const totalNum = r2(num(total));
  const nombreDe = (uid: string) => uid === userId ? "Tú" : firstName(miembros.find((m) => m.user_id === uid));
  const participantes = miembros.filter((m) => seleccionados.has(m.user_id));
  const n = participantes.length;
  const pagador = miembros.find((m) => m.user_id === pagadoPor);
  const fmt = (v: number) => formatMoney(v, moneda);

  // ── ticket ──
  async function leerTicket(file: File) {
    const run = ++ticketRun.current;
    setTicket("leyendo");
    setTicketError(null);
    try {
      const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
      let fileToSend: File | Blob = file;
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf && file.type.startsWith("image/")) {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        bitmap.close();
        fileToSend = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error("imagen")), "image/jpeg", 0.92));
      }
      const fd = new FormData();
      fd.append("file", fileToSend, isPdf ? file.name : "receipt.jpg");
      fd.append("plan_id", String(planId));
      fd.append("user_id", userId);
      const res = await fetch(buildInternalApiUrl("/api/receipts/ocr"), {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: fd,
      });
      const data = await res.json() as OcrResult | { error: string };
      if (run !== ticketRun.current) return;
      if (!res.ok || "error" in data) throw new Error("ocr");
      if (data.url) setReceiptUrl(data.url);
      if (!data.is_receipt) {
        setTicket("error");
        setTicketError("No parece un ticket");
        return;
      }
      // What the person already typed is never overwritten.
      const filled = new Set<"importe" | "concepto" | "fecha">();
      if (data.total != null && (!total.trim() || delTicket.has("importe"))) { setTotal(toInput(data.total)); filled.add("importe"); }
      if (data.comercio && (!titulo.trim() || delTicket.has("concepto"))) { setTitulo(data.comercio); filled.add("concepto"); }
      if (data.fecha) { setFechaGasto(data.fecha); filled.add("fecha"); }
      if (data.moneda && MONEDAS.includes(data.moneda)) setMoneda(data.moneda);
      setDelTicket(filled);
      if (data.items.length > 0) {
        setItems(data.items.map((it) => ({
          key: itemKey.current++, nombre: it.cantidad > 1 ? `${it.nombre} ×${it.cantidad}` : it.nombre,
          cantidad: 1, subtotal: toInput(it.subtotal), asignados: new Set(seleccionados),
        })));
        setMetodo("POR_ITEMS");
      }
      setTicket("leido");
    } catch {
      if (run !== ticketRun.current) return;
      setTicket("error");
      setTicketError(null);
    }
  }
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void leerTicket(f);
  };
  const quitarTicket = () => { ticketRun.current++; setTicket("vacio"); setReceiptUrl(null); setTicketError(null); };
  const itemsLeidos = items.length;

  // ── split maths ──
  const igualCada = n > 0 ? r2(totalNum / n) : 0;
  const redondeo = n > 0 ? Math.round((totalNum - igualCada * n) * 100) : 0;

  const pctSum = participantes.reduce((a, m) => a + num(porcentajes[m.user_id] ?? ""), 0);
  const pctFalta = r2(100 - pctSum);
  const cantSum = r2(participantes.reduce((a, m) => a + num(cantidades[m.user_id] ?? ""), 0));
  const cantFalta = r2(totalNum - cantSum);
  const itemsSum = r2(items.reduce((a, it) => a + num(it.subtotal), 0));
  const itemsFalta = r2(totalNum - itemsSum);
  const itemSinGente = items.some((it) => num(it.subtotal) > 0 && ![...it.asignados].some((u) => seleccionados.has(u)));

  /** What each person pays under the chosen method. */
  const porPersona = useMemo(() => {
    const out = new Map<string, number>();
    for (const m of participantes) out.set(m.user_id, 0);
    if (metodo === "IGUAL") for (const m of participantes) out.set(m.user_id, igualCada);
    if (metodo === "PORCENTAJE") for (const m of participantes) out.set(m.user_id, r2(totalNum * num(porcentajes[m.user_id] ?? "") / 100));
    if (metodo === "CANTIDAD") for (const m of participantes) out.set(m.user_id, num(cantidades[m.user_id] ?? ""));
    if (metodo === "POR_ITEMS") {
      for (const it of items) {
        const who = [...it.asignados].filter((u) => seleccionados.has(u));
        if (who.length === 0) continue;
        const each = num(it.subtotal) / who.length;
        for (const u of who) out.set(u, (out.get(u) ?? 0) + each);
      }
      for (const [k, v] of out) out.set(k, r2(v));
    }
    return out;
  }, [participantes, metodo, igualCada, totalNum, porcentajes, cantidades, items, seleccionados]);

  const cuadra =
    metodo === "IGUAL" ? n > 0 :
    metodo === "PORCENTAJE" ? Math.abs(pctFalta) < 0.01 :
    metodo === "CANTIDAD" ? Math.abs(cantFalta) < 0.01 :
    items.length > 0 && Math.abs(itemsFalta) < 0.01 && !itemSinGente;

  const igualar = () => {
    if (n === 0) return;
    const base = Math.floor((100 / n) * 100) / 100;
    const next: Record<string, string> = { ...porcentajes };
    participantes.forEach((m, i) => { next[m.user_id] = String(i === n - 1 ? r2(100 - base * (n - 1)) : base).replace(".", ","); });
    setPorcentajes(next);
  };
  const repartirFalta = () => {
    if (n === 0 || cantFalta <= 0) return;
    const each = Math.floor((cantFalta / n) * 100) / 100;
    const next = { ...cantidades };
    participantes.forEach((m, i) => {
      const add = i === n - 1 ? r2(cantFalta - each * (n - 1)) : each;
      next[m.user_id] = toInput(r2(num(cantidades[m.user_id] ?? "") + add));
    });
    setCantidades(next);
  };
  const elegirMetodo = (m: MetodoReparto) => {
    setMetodo(m);
    if (m === "PORCENTAJE" && pctSum === 0) igualar();
  };

  // ── items ──
  const updItem = (key: number, patch: Partial<Item>) => setItems((p) => p.map((it) => it.key === key ? { ...it, ...patch } : it));
  const toggleItemUser = (key: number, uid: string) => setItems((p) => p.map((it) => {
    if (it.key !== key) return it;
    const s = new Set(it.asignados);
    if (s.has(uid)) s.delete(uid); else s.add(uid);
    return { ...it, asignados: s };
  }));
  const addItem = (nombre = "", subtotal = "") =>
    setItems((p) => [...p, { key: itemKey.current++, nombre, cantidad: 1, subtotal, asignados: new Set(seleccionados) }]);

  // ── submit ──
  function buildParticipantes() {
    if (metodo === "IGUAL") return participantes.map((m) => ({ user_id: m.user_id }));
    if (metodo === "PORCENTAJE") return participantes.filter((m) => num(porcentajes[m.user_id] ?? "") > 0).map((m) => ({ user_id: m.user_id, porcentaje: num(porcentajes[m.user_id]) }));
    if (metodo === "CANTIDAD") return participantes.filter((m) => num(cantidades[m.user_id] ?? "") > 0).map((m) => ({ user_id: m.user_id, importe: num(cantidades[m.user_id]) }));
    return participantes.filter((m) => (porPersona.get(m.user_id) ?? 0) > 0).map((m) => ({ user_id: m.user_id }));
  }
  function buildItems(): GastoItemInput[] {
    return items.filter((it) => num(it.subtotal) > 0).map((it) => {
      const who = [...it.asignados].filter((u) => seleccionados.has(u));
      const sub = num(it.subtotal);
      return {
        nombre: it.nombre.trim() || "Ítem", precio_unitario: sub, cantidad: 1, subtotal: sub,
        usuarios: who.map((u) => ({ user_id: u, subtotal_asignado: r2(sub / who.length) })),
      };
    });
  }

  async function handleSubmit(forzarIgual = false) {
    if (saving) return;
    const m = forzarIgual ? "IGUAL" : metodo;
    if (forzarIgual) setMetodo("IGUAL");
    if (!forzarIgual && !cuadra) return;
    const parts = m === "IGUAL" ? participantes.map((p) => ({ user_id: p.user_id })) : buildParticipantes();
    if (parts.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createGastoEndpoint({
        plan_id: planId,
        titulo: titulo.trim(),
        pagado_por_user_id: pagadoPor,
        fecha_gasto: fechaGasto,
        total: totalNum,
        moneda,
        metodo_reparto: m,
        participantes: parts,
        descripcion: undefined,
        items: m === "POR_ITEMS" ? buildItems() : undefined,
        receipt_url: receiptUrl ?? undefined,
        categoria_id: categoriaId,
        subplan_id: subplanId ?? undefined,
      });
      const mio = m === "IGUAL" ? (seleccionados.has(userId) ? igualCada : 0) : (porPersona.get(userId) ?? 0);
      const msg = pagadoPor === userId
        ? (totalNum - mio > 0.005 ? `Gasto añadido · te deben ${fmt(r2(totalNum - mio))}` : "Gasto añadido")
        : (mio > 0.005 ? `Gasto añadido · debes ${fmt(mio)} a ${firstName(pagador)}` : "Gasto añadido");
      onCreated();
      toast(msg, "success");
      requestClose();
    } catch {
      setSaveError("No se pudo crear el gasto. Comprueba la conexión y vuelve a intentarlo. Lo que has escrito sigue aquí.");
      setSaving(false);
    }
  }

  // ── navigation ──
  const canStep1 = titulo.trim().length > 0 && totalNum > 0;
  const canStep2 = n > 0;
  const advance = () => {
    if (saving) return;
    if (step === 1 && canStep1) setStep(2);
    else if (step === 2 && canStep2) setStep(3);
    else if (step === 3) void handleSubmit();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const t = e.target as HTMLElement;
    if (t.tagName !== "INPUT" || t.closest("[data-no-enter]")) return;
    e.preventDefault();
    advance();
  };

  const hasProgress = step > 1 || titulo.trim() !== "" || total.trim() !== "" || ticket !== "vacio" || items.length > 0 || subplanId !== null;
  function requestDismiss() {
    if (saving || discardOpen) return;
    if (hasProgress) { setDiscardOpen(true); return; }
    requestClose();
  }

  const radioKeys = <T,>(e: React.KeyboardEvent, list: readonly T[], i: number, pick: (v: T) => void) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + list.length) % list.length;
    pick(list[j]);
    (e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus();
  };

  const grupo = grupoDe(categoriaId);
  const subcats = grupo.ids.map((id) => categorias.find((c) => c.id === id)).filter((c): c is CategoriaGasto => Boolean(c));
  const miembrosVisibles = miembros.length > 8 && buscar.trim()
    ? miembros.filter((m) => `${m.nombre ?? ""} ${m.username ?? ""}`.toLowerCase().includes(buscar.trim().toLowerCase()))
    : miembros;

  const summary = [
    { key: "c", label: titulo.trim() },
    { key: "i", label: fmt(totalNum) },
    ...(step >= 3 ? [
      { key: "p", label: <>{pagador && <Av m={pagador} me={pagadoPor === userId} />}{pagadoPor === userId ? "Pagaste tú" : `Pagó ${firstName(pagador)}`}</> },
      { key: "n", label: `${n} ${n === 1 ? "persona" : "personas"}` },
    ] : []),
  ];

  const footer = step === 1 ? (
    <>
      <button type="button" className="wz-tbtn mute" onClick={requestDismiss}>Cancelar</button>
      <button type="button" className="wz-fbtn" disabled={!canStep1} onClick={advance}>Continuar</button>
    </>
  ) : step === 2 ? (
    <>
      <button type="button" className="wz-tbtn" disabled={!canStep2 || saving} onClick={() => void handleSubmit(true)}>
        {saving ? "Creando…" : "Crear ya, a partes iguales"}
      </button>
      <button type="button" className="wz-fbtn" disabled={!canStep2} onClick={advance}>Ajustar reparto</button>
    </>
  ) : (
    <>
      <button type="button" className="wz-tbtn mute" disabled={saving} onClick={() => setStep(2)}>Atrás</button>
      <button type="button" className="wz-fbtn" disabled={saving || !cuadra} onClick={() => void handleSubmit()}>
        {saving ? <><LoaderCircle className="wz-spin size-[18px]" aria-hidden />Creando…</> : saveError ? "Reintentar" : "Crear gasto"}
      </button>
    </>
  );

  const Franja = ({ ok, children, action }: { ok: boolean; children: React.ReactNode; action?: React.ReactNode }) => (
    <div className={ok ? "wz-ok" : "wz-warn"} role="status">
      {ok ? <Check className="size-[16px] shrink-0" aria-hidden /> : <CircleAlert className="size-[16px] shrink-0 text-[var(--chat-missed)]" aria-hidden />}
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );

  return (
    <>
      <Wizard
        label="Nuevo gasto"
        headTitle={["Nuevo gasto", planName].filter(Boolean).join(" · ")}
        steps={STEPS}
        step={step}
        onStep={setStep}
        onBack={() => setStep((s) => Math.max(1, s - 1))}
        onDismiss={requestDismiss}
        isClosing={isClosing}
        busy={saving}
        zClass="z-[1310]"
        footer={footer}
      >
        <fieldset disabled={saving} className="contents" onKeyDown={onKeyDown}>
          {saveError && (
            <div role="alert" className="wz-ban">
              <CircleAlert className="mt-[1px] size-[18px] shrink-0" aria-hidden />
              <span>{saveError}</span>
            </div>
          )}

          {step === 1 && (
            <>
              <h2 className="wz-title" tabIndex={-1}>¿Qué es?</h2>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
              <div className="mt-4">
                {ticket === "vacio" && (
                  <div className="wz-ticket">
                    <ReceiptText className="size-[22px] shrink-0 text-[var(--text-secondary)]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold">¿Tienes el ticket?</div>
                      <div className="wz-tm">Frimee rellena concepto, importe, fecha e ítems</div>
                    </div>
                    <button type="button" className="wz-ib md:hidden" aria-label="Hacer foto al ticket" title="Hacer foto al ticket" onClick={() => cameraRef.current?.click()}>
                      <Camera className="size-[20px]" aria-hidden />
                    </button>
                    <button type="button" className="wz-ib" aria-label="Subir el ticket" title="Subir el ticket" onClick={() => fileRef.current?.click()}>
                      <Upload className="size-[20px]" aria-hidden />
                    </button>
                  </div>
                )}
                {ticket === "leyendo" && (
                  <div className="wz-ticket">
                    <LoaderCircle className="wz-spin size-[22px] shrink-0 text-[var(--chat-accent-text)]" aria-hidden />
                    <div className="min-w-0 flex-1" role="status">
                      <div className="text-[15px] font-semibold">Frimee está leyendo el ticket…</div>
                      <div className="wz-tm">Puedes ir rellenando a mano mientras tanto</div>
                    </div>
                    <button type="button" className="wz-ib s" aria-label="Quitar el ticket" title="Quitar el ticket" onClick={quitarTicket}>
                      <X className="size-[18px]" aria-hidden />
                    </button>
                  </div>
                )}
                {ticket === "leido" && (
                  <div className="wz-ticket ok">
                    <Check className="size-[22px] shrink-0 text-[var(--chat-accent-text)]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold">Ticket leído</div>
                      <div className="wz-tm">
                        Concepto, importe, fecha{itemsLeidos > 0 ? ` y ${itemsLeidos} ${itemsLeidos === 1 ? "ítem" : "ítems"}` : ""} · revísalos
                      </div>
                    </div>
                    {receiptUrl && <a href={receiptUrl} target="_blank" rel="noreferrer" className="wz-tbtn px-2">Ver</a>}
                    <button type="button" className="wz-ib s" aria-label="Quitar el ticket" title="Quitar el ticket" onClick={quitarTicket}>
                      <X className="size-[18px]" aria-hidden />
                    </button>
                  </div>
                )}
                {ticket === "error" && (
                  <div className="wz-ticket bad" role="alert">
                    <CircleAlert className="size-[22px] shrink-0 text-[var(--chat-missed)]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold">{ticketError ?? "No se pudo leer el ticket"}</div>
                      <div className="wz-tm">Hazle otra foto con más luz o rellénalo a mano</div>
                    </div>
                    <button type="button" className="wz-tbtn px-2" onClick={() => (window.matchMedia("(min-width: 768px)").matches ? fileRef : cameraRef).current?.click()}>
                      Otra foto
                    </button>
                  </div>
                )}
              </div>

              <WizardSection title="Importe" extra={delTicket.has("importe") ? <span className="wz-tag">Del ticket</span> : undefined} />
              <div className="wz-amount">
                <input
                  aria-label="Importe" inputMode="decimal" placeholder="0,00" value={total} data-autofocus=""
                  onChange={(e) => { setTotal(e.target.value.replace(/[^\d.,]/g, "")); setDelTicket((s) => { const x = new Set(s); x.delete("importe"); return x; }); }}
                  onBlur={() => { if (totalNum > 0) setTotal(toInput(totalNum)); }}
                />
                <WizardSelect compact label="Moneda" value={moneda} options={MONEDAS.map((m) => ({ value: m, label: m }))} onChange={setMoneda} />
              </div>

              <WizardSection title="Concepto" extra={delTicket.has("concepto") ? <span className="wz-tag">Del ticket</span> : undefined} />
              <div className="wz-fld">
                <input
                  aria-label="Concepto" placeholder="Ej.: Cena en Le Comptoir" value={titulo}
                  onChange={(e) => { setTitulo(e.target.value); setDelTicket((s) => { const x = new Set(s); x.delete("concepto"); return x; }); }}
                />
              </div>

              <WizardSection title="Fecha" extra={delTicket.has("fecha") ? <span className="wz-tag">Del ticket</span> : undefined} />
              <div data-no-enter="">
                <DatePickerField value={fechaGasto} onChange={(v) => { setFechaGasto(v); setDelTicket((s) => { const x = new Set(s); x.delete("fecha"); return x; }); }} />
              </div>

              <WizardSection title="Categoría" id="wz-cat" />
              <div role="radiogroup" aria-labelledby="wz-cat" className="wz-chips">
                {GRUPOS.map((g, i) => {
                  const on = grupo.key === g.key;
                  return (
                    <button
                      key={g.key} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className="wz-chip"
                      onClick={() => setCategoriaId(g.ids[0])}
                      onKeyDown={(e) => radioKeys(e, GRUPOS, i, (x) => setCategoriaId(x.ids[0]))}
                    >
                      <span className="ti"><g.Icon className="size-[18px]" aria-hidden /></span><span className="wz-chip-l">{g.label}</span>
                    </button>
                  );
                })}
              </div>
              {subcats.length > 1 && (
                <div className="wz-pills mt-2" role="radiogroup" aria-label={`Tipo de ${grupo.label.toLowerCase()}`}>
                  {subcats.map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={categoriaId === c.id} className="wz-pill" onClick={() => setCategoriaId(c.id)}>
                      {c.icono && <span aria-hidden>{c.icono}</span>}{c.nombre}
                    </button>
                  ))}
                </div>
              )}

              {subplanes.length > 0 && (
                <>
                  <WizardSection title="Actividad" optional />
                  <WizardSelect
                    label="Actividad del plan" value={subplanId ?? 0}
                    options={[{ value: 0, label: "Sin actividad" }, ...subplanes.map((s) => ({ value: s.id, label: s.titulo }))]}
                    onChange={(v) => setSubplanId(v || null)}
                  />
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="wz-title" tabIndex={-1}>¿Quién paga?</h2>
              <WizardSummary items={summary} />
              {miembros.length > 8 && (
                <div className="wz-fld mt-4" data-no-enter="">
                  <Search className="size-[18px] shrink-0 text-[var(--text-secondary)]" aria-hidden />
                  <input aria-label="Buscar personas" placeholder="Buscar personas" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
                </div>
              )}
              <WizardSection title="Pagó" id="wz-pago" />
              <div className="wz-pills" role="radiogroup" aria-labelledby="wz-pago">
                {miembrosVisibles.map((m, i) => {
                  const on = pagadoPor === m.user_id;
                  return (
                    <button
                      key={m.user_id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className="wz-pill pl-1"
                      onClick={() => setPagadoPor(m.user_id)}
                      onKeyDown={(e) => radioKeys(e, miembrosVisibles, i, (x) => setPagadoPor(x.user_id))}
                    >
                      <Av m={m} me={m.user_id === userId} />{m.user_id === userId ? "Tú" : firstName(m)}
                    </button>
                  );
                })}
              </div>

              <WizardSection
                title="Entre quién se reparte"
                extra={
                  <button
                    type="button" className="wz-link" aria-pressed={n === miembros.length}
                    onClick={() => setSeleccionados(n === miembros.length ? new Set() : new Set(miembros.map((m) => m.user_id)))}
                  >
                    {n === miembros.length ? "Todos" : "Elegir todos"} · {n} de {miembros.length}
                  </button>
                }
              />
              <div className="wz-pills" role="group" aria-label="Entre quién">
                {miembrosVisibles.map((m) => (
                  <button
                    key={m.user_id} type="button" aria-pressed={seleccionados.has(m.user_id)} className="wz-pill pl-1"
                    onClick={() => setSeleccionados((s) => { const x = new Set(s); if (x.has(m.user_id)) x.delete(m.user_id); else x.add(m.user_id); return x; })}
                  >
                    <Av m={m} me={m.user_id === userId} />{m.user_id === userId ? "Tú" : firstName(m)}
                  </button>
                ))}
              </div>
              <p className="wz-tm mt-3">
                {n > 0 ? `A partes iguales: ${fmt(igualCada)} cada uno. Puedes cambiarlo en el siguiente paso.` : "Elige al menos a una persona."}
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="wz-title" tabIndex={-1}>¿Cómo se reparte?</h2>
              <WizardSummary items={summary} />
              <div role="radiogroup" aria-label="Cómo se reparte" className="wz-pills mt-4">
                {METODOS.map((m, i) => (
                  <button
                    key={m.value} type="button" role="radio" aria-checked={metodo === m.value} tabIndex={metodo === m.value ? 0 : -1}
                    className="wz-pill" onClick={() => elegirMetodo(m.value)}
                    onKeyDown={(e) => radioKeys(e, METODOS, i, (x) => elegirMetodo(x.value))}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                {metodo === "IGUAL" && (
                  <>
                    <p className="text-[15px] font-semibold">Cada uno paga {fmt(igualCada)}</p>
                    {redondeo !== 0 && (
                      <p className="wz-tm mt-1">
                        {Math.abs(redondeo)} {Math.abs(redondeo) === 1 ? "céntimo" : "céntimos"} de redondeo para {pagadoPor === userId ? "ti" : firstName(pagador)}
                      </p>
                    )}
                  </>
                )}
                {metodo === "PORCENTAJE" && (
                  <Franja ok={Math.abs(pctFalta) < 0.01} action={<button type="button" className="wz-link" onClick={igualar}>Igualar</button>}>
                    {Math.abs(pctFalta) < 0.01 ? `Cuadra: 100 %`
                      : pctFalta > 0 ? `Falta un ${String(pctFalta).replace(".", ",")} % · ${fmt(r2(totalNum * pctFalta / 100))} sin asignar`
                      : `Sobra un ${String(-pctFalta).replace(".", ",")} % · ${fmt(r2(totalNum * -pctFalta / 100))} de más`}
                  </Franja>
                )}
                {metodo === "CANTIDAD" && (
                  <Franja ok={Math.abs(cantFalta) < 0.01} action={cantFalta > 0.005 ? <button type="button" className="wz-link" onClick={repartirFalta}>Repartir lo que falta</button> : undefined}>
                    {Math.abs(cantFalta) < 0.01 ? `Cuadra: ${fmt(cantSum)} de ${fmt(totalNum)}`
                      : cantFalta > 0 ? `Faltan ${fmt(cantFalta)} · las cantidades suman ${fmt(cantSum)}`
                      : `Sobran ${fmt(-cantFalta)} · las cantidades suman ${fmt(cantSum)}`}
                  </Franja>
                )}
                {metodo === "POR_ITEMS" && items.length > 0 && (
                  <Franja
                    ok={Math.abs(itemsFalta) < 0.01 && !itemSinGente}
                    action={itemsFalta > 0.005 ? <button type="button" className="wz-link" onClick={() => addItem("Resto (propina, servicio…)", toInput(itemsFalta))}>Repartir entre todos</button> : undefined}
                  >
                    {itemSinGente ? "Hay ítems sin nadie que los comparta"
                      : Math.abs(itemsFalta) < 0.01 ? `Los ítems suman ${fmt(itemsSum)}${ticket === "leido" ? ", igual que el ticket" : ""}`
                      : itemsFalta > 0 ? `Faltan ${fmt(itemsFalta)} · los ítems suman ${fmt(itemsSum)}`
                      : `Sobran ${fmt(-itemsFalta)} · los ítems suman ${fmt(itemsSum)}`}
                  </Franja>
                )}
              </div>

              {(metodo === "IGUAL" || metodo === "PORCENTAJE" || metodo === "CANTIDAD") && (
                <div className="mt-3">
                  {participantes.map((m) => (
                    <div key={m.user_id} className="wz-row">
                      <Av m={m} me={m.user_id === userId} />
                      <span className="min-w-0 flex-1 wz-ell text-[15px]">{m.user_id === userId ? "Tú" : firstName(m)}</span>
                      {metodo === "IGUAL" && <span className="wz-num-t text-[15px]">{fmt(igualCada)}</span>}
                      {metodo === "PORCENTAJE" && (
                        <>
                          <span className="wz-num-t wz-tm">{fmt(porPersona.get(m.user_id) ?? 0)}</span>
                          <label className="wz-num">
                            <input inputMode="decimal" aria-label={`Porcentaje de ${nombreDe(m.user_id)}`} value={porcentajes[m.user_id] ?? ""}
                              onChange={(e) => setPorcentajes((p) => ({ ...p, [m.user_id]: e.target.value.replace(/[^\d.,]/g, "") }))} />
                            <span className="wz-tm">%</span>
                          </label>
                        </>
                      )}
                      {metodo === "CANTIDAD" && (
                        <label className="wz-num">
                          <input inputMode="decimal" aria-label={`Cantidad de ${nombreDe(m.user_id)}`} placeholder="0,00" value={cantidades[m.user_id] ?? ""}
                            onChange={(e) => setCantidades((p) => ({ ...p, [m.user_id]: e.target.value.replace(/[^\d.,]/g, "") }))} />
                          <span className="wz-tm">€</span>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {metodo === "POR_ITEMS" && (
                <>
                  <WizardSection
                    title={ticket === "leido" && itemsLeidos > 0 ? `${itemsLeidos} ${itemsLeidos === 1 ? "ítem leído" : "ítems leídos"} del ticket` : "Ítems"}
                    extra={<button type="button" className="wz-link" onClick={() => addItem()}><Plus className="mr-1 size-[14px]" aria-hidden />Añadir ítem</button>}
                  />
                  {items.length === 0 && <p className="wz-tm">Añade lo que pidió cada uno y toca a quién le toca.</p>}
                  {items.map((it) => {
                    const who = [...it.asignados].filter((u) => seleccionados.has(u));
                    const sub = num(it.subtotal);
                    return (
                      <div key={it.key} className="wz-card mb-2 p-3">
                        <div className="flex items-center gap-2">
                          <input
                            aria-label="Nombre del ítem" placeholder="Nombre" value={it.nombre}
                            onChange={(e) => updItem(it.key, { nombre: e.target.value })}
                            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none"
                          />
                          <label className="wz-num">
                            <input inputMode="decimal" aria-label={`Precio de ${it.nombre || "ítem"}`} placeholder="0,00" value={it.subtotal}
                              onChange={(e) => updItem(it.key, { subtotal: e.target.value.replace(/[^\d.,]/g, "") })} />
                            <span className="wz-tm">€</span>
                          </label>
                          <button type="button" className="wz-ib s" aria-label={`Quitar ${it.nombre || "ítem"}`} title="Quitar" onClick={() => setItems((p) => p.filter((x) => x.key !== it.key))}>
                            <Trash2 className="size-[16px]" aria-hidden />
                          </button>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1" role="group" aria-label={`Quién comparte ${it.nombre || "el ítem"}`}>
                          {participantes.map((m) => {
                            const on = it.asignados.has(m.user_id);
                            return (
                              <button
                                key={m.user_id} type="button" className="wz-avbtn" aria-pressed={on}
                                aria-label={`${nombreDe(m.user_id)} ${on ? "comparte" : "no comparte"}`}
                                onClick={() => toggleItemUser(it.key, m.user_id)}
                              >
                                <Av m={m} me={m.user_id === userId} />
                              </button>
                            );
                          })}
                          <span className="wz-tm ml-auto">
                            {who.length === 0 ? "nadie" : who.length === 1 ? `solo ${who[0] === userId ? "tú" : nombreDe(who[0])}` : `${fmt(r2(sub / who.length))} cada uno`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {items.length > 0 && (
                    <>
                      <WizardSection title="Le toca a cada uno" />
                      <div className="wz-pills">
                        {participantes.map((m) => (
                          <span key={m.user_id} className="wz-pill pl-1"><Av m={m} me={m.user_id === userId} />{fmt(porPersona.get(m.user_id) ?? 0)}</span>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </fieldset>
      </Wizard>

      <DiscardChangesDialog
        open={discardOpen}
        title="¿Descartar el gasto?"
        message="Se perderá lo que has rellenado."
        cancelLabel="Seguir editando"
        onCancel={() => setDiscardOpen(false)}
        onDiscard={() => { setDiscardOpen(false); requestClose(); }}
      />
    </>
  );
}
