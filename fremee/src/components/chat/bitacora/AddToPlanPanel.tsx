"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import LocationAutocomplete, { type Coords } from "@/components/plans/LocationAutocomplete";
import { fetchPlanUserRol, fetchUserRelatedPlans } from "@/services/api/endpoints/plans.endpoint";
import { resolvePlace } from "@/lib/places";
import { Sheet, useIsPhone } from "./Sheet";

/**
 * «Añadir al plan» from the chat (boards m-anadir, d-anadir, e-anadir, g-proponer): a panel that
 * opens at once when the diamond is pressed and fills in with what @frimee read in the message.
 * States: thinking (the diamond traces its outline, grey blocks), filling (fields arrive; «Buscando
 * el sitio…»), ready (the diamond seals; what @frimee deduced says «Sugerido»), slow (> 8 s: keep
 * waiting or fill it by hand) and failed (empty fields to fill by hand). Every field can be changed.
 * It adds the activity directly from the chat; «Más opciones en Planes» opens the full sheet.
 * A popover over the message's bar on desktop, a bottom sheet on phones.
 */
export type PanelPlan = { id: number; titulo: string; inicio_at: string; fin_at: string; ubicacion_nombre?: string | null };
export type PanelPrefill = { titulo?: string; fecha?: string; hora?: string; tipo?: string; lugar?: string; lat?: number; lng?: number };
export type PanelValues = { planId: number; titulo: string; tipo: string; inicio: string; fin: string; ubicacionNombre: string; lat: number | null; lng: number | null };

const TIPOS: Array<[string, string]> = [
  ["ACTIVIDAD", "Actividad"], ["RESTAURANTE", "Restaurante"], ["HOTEL", "Alojamiento"], ["VUELO", "Vuelo"],
  ["TREN", "Tren"], ["BUS", "Autobús"], ["BARCO", "Barco"], ["COCHE", "Coche"], ["OTRO", "Otro"],
];
const SLOW_MS = 8000;
const NO_FLICKER_MS = 300;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayTile = (iso: string) => {
  const d = new Date(iso);
  return { day: d.getDate(), month: d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "") };
};

/** The plan's days, as «Sáb 13 dic · Día 2». */
function planDays(plan: PanelPlan | null): Array<{ key: string; label: string }> {
  if (!plan) return [];
  const start = new Date(plan.inicio_at);
  const end = new Date(plan.fin_at);
  const out: Array<{ key: string; label: string }> = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 0; d <= end && i < 60; i++, d.setDate(d.getDate() + 1)) {
    const wd = d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
    const mo = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
    out.push({ key: dayKey(d), label: `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d.getDate()} ${mo} · Día ${i + 1}` });
  }
  return out;
}

function Rombo({ state }: { state: "thinking" | "still" | "ready" | "failed" }) {
  const d = "M12 2.5 L21.5 12 L12 21.5 L2.5 12 Z";
  if (state === "ready") {
    return <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" className="rombo-sello shrink-0"><path d={d} fill="var(--primary)" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" /></svg>;
  }
  if (state === "failed") {
    return <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" className="shrink-0"><path d={d} fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinejoin="round" /></svg>;
  }
  return (
    <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" className={`shrink-0 ${state === "thinking" ? "rombo-trazo" : ""}`}>
      <path d={d} fill="none" stroke="var(--chat-me-border)" strokeWidth="2" strokeLinejoin="round" />
      <path className="rombo-seg" d={d} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={state === "still" ? "28 28" : undefined} />
    </svg>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center gap-[12px] border-t border-app">
      <span className="w-[72px] shrink-0 text-[12px] text-muted">{label}</span>
      <div className="min-w-0 flex-1 text-[15px] text-app">{children}</div>
    </div>
  );
}
const Skel = ({ w }: { w: string }) => <span aria-hidden className="skel-live block h-[16px]" style={{ width: w }} />;
const Sugerido = () => <span className="ml-[8px] shrink-0 text-[11px] font-[var(--fw-semibold)] text-primary-token">Sugerido</span>;
const fieldCls = "h-[40px] w-full min-w-0 bg-transparent text-[15px] text-app outline-none placeholder:text-muted";

export function AddToPlanPanel({
  status, prefill, suggested, plan, currentUserId, personas, anchor, onClose, onAdd, onMoreOptions,
}: {
  /** thinking: @frimee is still reading; ready: there is data; failed: it found nothing to use. */
  status: "thinking" | "ready" | "failed";
  prefill: PanelPrefill | null;
  /** The data comes from @frimee (not from a card): those fields say «Sugerido» until changed. */
  suggested: boolean;
  /** The chat's plan; null in a chat without a plan (then you pick one of yours). */
  plan: PanelPlan | null;
  currentUserId: string;
  /** Informative for now: «4 · todo el grupo», «2 · Ana y tú». */
  personas: string;
  /** Desktop: over the message's bar (x = its right edge, y = its top). */
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  onAdd: (values: PanelValues) => Promise<void>;
  onMoreOptions: (planId: number, prefill: PanelPrefill) => void;
}) {
  const phone = useIsPhone();
  const [manual, setManual] = useState(status === "failed");
  const [slow, setSlow] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState<Set<string>>(new Set());

  // Plans to pick from (chats without a plan): yours ahead, the ones you can add to (admin).
  const [plans, setPlans] = useState<PanelPlan[] | null>(plan ? [plan] : null);
  const [planId, setPlanId] = useState<number | null>(plan?.id ?? null);
  useEffect(() => {
    if (plan) return;
    let cancelled = false;
    void fetchUserRelatedPlans({ userId: currentUserId, limit: 100 }).then(async (rows) => {
      const now = Date.now();
      const ahead = rows.filter((p) => new Date(p.fin_at).getTime() >= now).sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      const roles = await Promise.all(ahead.map((p) => fetchPlanUserRol(p.id, currentUserId).catch(() => null)));
      const mine = ahead.filter((_, i) => roles[i] === "ADMIN").map((p) => ({ id: p.id, titulo: p.titulo, inicio_at: p.inicio_at, fin_at: p.fin_at, ubicacion_nombre: p.ubicacion_nombre }));
      if (cancelled) return;
      setPlans(mine);
      setPlanId((cur) => cur ?? mine[0]?.id ?? null);
    }).catch(() => { if (!cancelled) setPlans([]); });
    return () => { cancelled = true; };
  }, [plan, currentUserId]);
  const target = plans?.find((p) => p.id === planId) ?? null;
  const days = useMemo(() => planDays(target), [target]);

  // The fields: filled once from the prefill (when it arrives), then yours.
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("ACTIVIDAD");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [sitio, setSitio] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const filledRef = useRef(false);
  useEffect(() => {
    if (filledRef.current || status !== "ready" || !prefill) return;
    filledRef.current = true;
    setTitulo(prefill.titulo ?? "");
    if (prefill.tipo && TIPOS.some(([k]) => k === prefill.tipo)) setTipo(prefill.tipo);
    if (prefill.hora && /^\d{2}:\d{2}$/.test(prefill.hora)) setHora(prefill.hora);
    if (prefill.lugar) setSitio(prefill.lugar);
    if (prefill.lat != null && prefill.lng != null) setCoords({ lat: prefill.lat, lng: prefill.lng });
    else if (prefill.lugar) {
      // A name read from the message: find it near the trip («Buscando el sitio…»).
      setPlaceBusy(true);
      void resolvePlace(target?.ubicacion_nombre ? `${prefill.lugar}, ${target.ubicacion_nombre}` : prefill.lugar).then((r) => {
        if (r) { setSitio(r.nombre); setCoords({ lat: r.lat, lng: r.lng }); }
      }).finally(() => setPlaceBusy(false));
    }
  }, [status, prefill, target]);
  // The day: the suggested one if it is within the plan, else the first.
  useEffect(() => {
    if (days.length === 0) return;
    setDia((cur) => (cur && days.some((d) => d.key === cur) ? cur : prefill?.fecha && days.some((d) => d.key === prefill.fecha) ? prefill.fecha : days[0].key));
  }, [days, prefill]);

  // Thinking: animate only after 300 ms (no flicker); after 8 s, say it is taking long.
  useEffect(() => {
    if (status !== "thinking" || manual) { setAnimate(false); setSlow(false); return; }
    const a = setTimeout(() => setAnimate(true), NO_FLICKER_MS);
    const s = setTimeout(() => setSlow(true), SLOW_MS);
    return () => { clearTimeout(a); clearTimeout(s); };
  }, [status, manual]);
  useEffect(() => { if (status === "failed") setManual(true); }, [status]);

  const waiting = status === "thinking" && !manual;
  const ready = !waiting;
  const mark = (k: string) => setEdited((s) => new Set(s).add(k));
  const sug = (k: string) => suggested && status === "ready" && !manual && !edited.has(k);
  const valid = ready && Boolean(target) && titulo.trim().length > 0 && Boolean(dia) && /^\d{2}:\d{2}$/.test(hora);

  const add = async () => {
    if (!valid || !target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const start = new Date(`${dia}T${hora}:00`);
      // An hour by default, within the day; it can be changed in the plan.
      const end = new Date(Math.min(start.getTime() + 3_600_000, new Date(`${dia}T23:59:00`).getTime()));
      await onAdd({ planId: target.id, titulo: titulo.trim(), tipo, inicio: start.toISOString(), fin: end.toISOString(), ubicacionNombre: sitio.trim(), lat: coords?.lat ?? null, lng: coords?.lng ?? null });
      onClose();
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "";
      setError(/autoriz/i.test(msg) ? "Solo los admins del plan pueden añadir actividades." : "No se pudo añadir. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const phrase = placeBusy ? "Buscando el sitio…" : status === "thinking" ? "Leyendo el mensaje…" : "Poniendo día y hora…";
  const header = (
    <div className="flex items-center gap-[12px]">
      <Rombo state={waiting || placeBusy ? (animate || placeBusy ? "thinking" : "still") : manual ? "failed" : "ready"} />
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-[var(--fw-semibold)] text-app">
          {waiting || placeBusy ? "Frimee está preparando el plan" : manual ? "Añadir al plan" : "Listo para añadir"}
        </div>
        <div className="flex items-center gap-[4px] text-[12px] text-muted" aria-live="polite">
          {waiting || placeBusy ? (<>{phrase}<span className="dots-live ml-[2px]" aria-hidden><i /><i /><i /></span></>)
            : manual ? "Rellénalo tú" : "Revísalo; puedes cambiar cualquier dato"}
        </div>
      </div>
      {!phone && (
        <button type="button" onClick={onClose} aria-label="Cerrar" title="Cerrar" className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-muted hover:bg-[var(--surface-2)]">
          <X className="size-[20px]" />
        </button>
      )}
    </div>
  );

  const body = (
    <>
      {header}
      <div className="mt-[12px]">
        <Row label="Qué">{waiting ? <Skel w="60%" /> : (
          <span className="flex items-center"><input aria-label="Qué" className={fieldCls} value={titulo} placeholder="Cena, visita, entradas…" maxLength={80} onChange={(e) => { setTitulo(e.target.value); mark("titulo"); }} />{sug("titulo") && <Sugerido />}</span>
        )}</Row>
        <Row label="Tipo">{waiting ? <Skel w="40%" /> : (
          <span className="flex items-center">
            <select aria-label="Tipo" className={`${fieldCls} cursor-pointer`} value={tipo} onChange={(e) => { setTipo(e.target.value); mark("tipo"); }}>
              {TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>{sug("tipo") && <Sugerido />}
          </span>
        )}</Row>
        <Row label="Sitio">{waiting || placeBusy ? <Skel w="75%" /> : (
          <LocationAutocomplete value={sitio} onChange={(v, c) => { setSitio(v); setCoords(c ?? null); mark("sitio"); }} placeholder="Busca un sitio" className={fieldCls} dropdownVariant="surface" />
        )}</Row>
        <Row label="Día">{waiting ? <Skel w="55%" /> : (
          <span className="flex items-center">
            <select aria-label="Día" className={`${fieldCls} cursor-pointer`} value={dia} onChange={(e) => { setDia(e.target.value); mark("fecha"); }} disabled={days.length === 0}>
              {days.length === 0 && <option value="">Elige un plan</option>}
              {days.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>{sug("fecha") && prefill?.fecha === dia && <Sugerido />}
          </span>
        )}</Row>
        <Row label="Hora">{waiting ? <Skel w="30%" /> : (
          <span className="flex items-center"><input aria-label="Hora" type="time" className={fieldCls} value={hora} onChange={(e) => { setHora(e.target.value); mark("hora"); }} />{sug("hora") && hora && <Sugerido />}</span>
        )}</Row>
        <Row label="Personas">{waiting ? <Skel w="45%" /> : <span className="text-[15px]">{personas}</span>}</Row>
        <Row label="Plan">
          {plans === null ? <Skel w="50%" /> : plans.length === 0 ? (
            <span className="text-[13px] text-muted">No tienes planes por delante que administres.</span>
          ) : (
            <span className="flex items-center gap-[8px]">
              {target && (
                <span aria-hidden className="flex size-[34px] shrink-0 flex-col items-center justify-center gap-[2px] rounded-[8px] border border-app bg-[var(--surface)]">
                  <span className="[font-family:var(--font-display-face)] text-[14px] leading-[14px] tabular-nums">{dayTile(target.inicio_at).day}</span>
                  <span className="text-[8px] font-[var(--fw-semibold)] uppercase leading-[8px] tracking-[.06em] text-muted">{dayTile(target.inicio_at).month}</span>
                </span>
              )}
              {plan || plans.length === 1 ? <span className="truncate">{target?.titulo}</span> : (
                <select aria-label="Plan" className={`${fieldCls} cursor-pointer`} value={planId ?? ""} onChange={(e) => setPlanId(Number(e.target.value))}>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                </select>
              )}
            </span>
          )}
        </Row>
      </div>

      {waiting && slow && (
        <div role="status" className="mt-[12px] rounded-[8px] border border-app bg-[var(--bg)] px-[12px] py-[10px]">
          <div className="text-[14px] font-[var(--fw-semibold)] text-app">Está tardando más de lo normal</div>
          <div className="mt-[2px] flex gap-[16px]">
            <button type="button" className="min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-primary-token" onClick={() => setSlow(false)}>Seguir esperando</button>
            <button type="button" className="min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-primary-token" onClick={() => setManual(true)}>Rellenar a mano</button>
          </div>
        </div>
      )}
      {status === "failed" && (
        <div role="alert" className="mt-[12px] rounded-[8px] border border-app bg-[var(--bg)] px-[12px] py-[10px] text-[14px] leading-[1.45] text-app">
          No he podido sacar los datos del mensaje. Rellénalos tú.
        </div>
      )}
      {error && <p role="alert" className="mt-[10px] text-[13px] text-[var(--chat-missed)]">{error}</p>}

      <div className="mt-[14px] flex gap-[8px]">
        <button type="button" disabled={!valid || busy} onClick={() => void add()}
          className="flex h-[44px] flex-1 items-center justify-center rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90 disabled:bg-[var(--surface-2)] disabled:text-muted">
          {busy ? "Añadiendo…" : "Añadir al plan"}
        </button>
      </div>
      <div className="mt-[2px] flex items-center justify-between">
        <button type="button" onClick={onClose} className="min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-muted">Cancelar</button>
        {target && (
          <button type="button" className="min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-primary-token"
            onClick={() => onMoreOptions(target.id, { titulo, fecha: dia || undefined, hora: hora || undefined, tipo, lugar: sitio || undefined, lat: coords?.lat, lng: coords?.lng })}>
            Más opciones en Planes
          </button>
        )}
      </div>
    </>
  );

  if (phone) return <Sheet title="Añadiendo al plan" onClose={onClose}>{body}</Sheet>;
  return <DesktopPopover anchor={anchor} onClose={onClose}>{body}</DesktopPopover>;
}

/** Over the message's bar, right-aligned to it; under it when there is no room on top. */
function DesktopPopover({ anchor, onClose, children }: { anchor: { x: number; y: number } | null; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const W = 390;
  // Placed straight on the element (no state): again whenever it grows as the fields arrive.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const H = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const x = anchor?.x ?? vw / 2 + W / 2;
      const y = anchor?.y ?? vh / 2 + H / 2;
      const top = y - H - 8 >= 8 ? y - H - 8 : Math.min(y + 48, vh - H - 8);
      el.style.left = `${Math.max(8, Math.min(x - W, vw - W - 8))}px`;
      el.style.top = `${Math.max(8, top)}px`;
      el.style.visibility = "visible";
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => { ro.disconnect(); window.removeEventListener("resize", place); };
  }, [anchor?.x, anchor?.y]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <>
      <div className="fixed inset-0 z-[99]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-label="Añadir al plan"
        className="fixed z-[100] rounded-[8px] border border-app bg-[var(--bg)] p-[16px] shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        style={{ left: 0, top: 0, width: W, visibility: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
