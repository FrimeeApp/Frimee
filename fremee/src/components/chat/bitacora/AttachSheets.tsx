"use client";

import { useEffect, useState } from "react";
import { BedDouble, Bus, CalendarDays, LocateFixed, Plane, Ship, Ticket, Train, UtensilsCrossed } from "lucide-react";
import LocationAutocomplete, { type Coords } from "@/components/plans/LocationAutocomplete";
import { createGastoEndpoint } from "@/services/api/endpoints/gastos.endpoint";
import { fetchSubplanes, type SubplanRow, type TipoSubplan } from "@/services/api/endpoints/subplanes.endpoint";
import { fetchUserRelatedPlans, type PlanByIdRow } from "@/services/api/endpoints/plans.endpoint";
import type { CardKind, CardMoment, ExpenseMoment, PlaceMoment } from "./moments";
import { formatEuros } from "./moments";
import { Sheet, sheetField, sheetLabel, sheetPrimaryButton } from "./Sheet";

const errMsg = (e: unknown) => (e as { message?: string })?.message ?? String(e);

// ── Ubicación ─────────────────────────────────────────────────────────────────────────────────

/** Share a place: your current position or one you search. A point in time, never live. */
export function PlaceSheet({ onClose, onSend }: { onClose: () => void; onSend: (place: PlaceMoment) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{ nombre: string; coords: Coords } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (place: PlaceMoment) => {
    setBusy(true);
    setError(null);
    try {
      await onSend(place);
      onClose();
    } catch (e) {
      console.error("[chat] Error enviando sitio:", errMsg(e));
      setError("No se pudo enviar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const sendCurrent = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Este dispositivo no permite saber tu ubicación.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => void send({ type: "lugar", nombre: "Mi ubicación", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setBusy(false); setError("No hay permiso para usar tu ubicación. Puedes buscar el sitio arriba."); },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <Sheet
      title="Compartir un sitio"
      onClose={onClose}
      footer={
        <button type="button" className={sheetPrimaryButton} disabled={!picked || busy}
          onClick={() => picked && void send({ type: "lugar", nombre: picked.nombre.split(",")[0], direccion: picked.nombre.split(",").slice(1).join(",").trim() || null, lat: picked.coords.lat, lng: picked.coords.lng })}>
          {busy ? "Enviando…" : "Enviar sitio"}
        </button>
      }
    >
      <label className={sheetLabel} htmlFor="chat-place-search">Buscar un sitio</label>
      <LocationAutocomplete
        value={query}
        onChange={(v, coords) => { setQuery(v); setPicked(coords ? { nombre: v, coords } : null); }}
        placeholder="Un bar, una calle, un mirador…"
        className={sheetField}
        dropdownVariant="surface"
        autoFocus
      />
      <button type="button" onClick={sendCurrent} disabled={busy}
        className="mt-[12px] flex min-h-[48px] w-full items-center gap-[12px] rounded-[8px] px-[4px] text-left text-[15px] text-app hover:bg-[var(--surface-2)] disabled:opacity-50">
        <LocateFixed className="size-[18px] text-[var(--chat-accent-text)]" aria-hidden />
        Enviar dónde estoy ahora
      </button>
      <p className="mt-[4px] text-[12px] text-muted">Se envía el punto una vez; no se comparte en tiempo real.</p>
      {error && <p role="alert" className="mt-[8px] text-[13px] text-[var(--chat-missed)]">{error}</p>}
    </Sheet>
  );
}

// ── Gasto ─────────────────────────────────────────────────────────────────────────────────────

type Member = { id: string; nombre: string };

/** Records a plan expense split in equal parts and leaves it as a moment in the chat. */
export function ExpenseSheet({
  planId, members, currentUserId, onClose, onSent,
}: {
  planId: number;
  members: Member[];
  currentUserId: string;
  onClose: () => void;
  onSent: (moment: ExpenseMoment) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [importe, setImporte] = useState("");
  const [pagador, setPagador] = useState(currentUserId);
  const [entre, setEntre] = useState<Set<string>>(() => new Set(members.map((m) => m.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = parseFloat(importe.replace(",", "."));
  const valid = titulo.trim().length > 0 && Number.isFinite(total) && total > 0 && entre.size > 0;
  const nombre = (id: string) => (id === currentUserId ? "Tú" : members.find((m) => m.id === id)?.nombre.split(" ")[0] ?? "Alguien");

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createGastoEndpoint({
        plan_id: planId,
        titulo: titulo.trim(),
        pagado_por_user_id: pagador,
        fecha_gasto: new Date().toISOString(),
        total: Math.round(total * 100) / 100,
        metodo_reparto: "IGUAL",
        participantes: [...entre].map((user_id) => ({ user_id })),
      });
      const pagadorNombre = members.find((m) => m.id === pagador)?.nombre.split(" ")[0] ?? "Alguien";
      await onSent({ type: "gasto", titulo: titulo.trim(), total: Math.round(total * 100) / 100, pagado_por_nombre: pagadorNombre, participantes: entre.size });
      onClose();
    } catch (e) {
      console.error("[chat] Error registrando gasto:", errMsg(e));
      setError("No se pudo registrar el gasto. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Nuevo gasto"
      onClose={onClose}
      footer={
        <button type="button" className={sheetPrimaryButton} disabled={!valid || busy} onClick={() => void submit()}>
          {busy ? "Registrando…" : valid ? `Registrar ${formatEuros(total)}` : "Registrar gasto"}
        </button>
      }
    >
      <div className="flex flex-col gap-[14px]">
        <div>
          <label className={sheetLabel} htmlFor="gasto-titulo">Concepto</label>
          <input id="gasto-titulo" className={sheetField} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Cena, gasolina, entradas…" maxLength={80} autoFocus />
        </div>
        <div>
          <label className={sheetLabel} htmlFor="gasto-importe">Importe (€)</label>
          <input id="gasto-importe" className={`${sheetField} tabular-nums`} value={importe} onChange={(e) => setImporte(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="0,00" />
        </div>
        <div>
          <label className={sheetLabel} htmlFor="gasto-pagador">Pagó</label>
          <select id="gasto-pagador" className={sheetField} value={pagador} onChange={(e) => setPagador(e.target.value)}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.id === currentUserId ? "Yo" : m.nombre}</option>)}
          </select>
        </div>
        <fieldset>
          <legend className={sheetLabel}>A partes iguales entre</legend>
          <div className="flex flex-wrap gap-[8px]">
            {members.map((m) => {
              const on = entre.has(m.id);
              return (
                <button key={m.id} type="button" aria-pressed={on}
                  onClick={() => setEntre((prev) => { const n = new Set(prev); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}
                  className={`min-h-[44px] rounded-full border px-[14px] text-[14px] ${on ? "border-[var(--chat-me-border)] bg-[var(--chat-tint)] text-app" : "border-app text-muted"}`}>
                  {nombre(m.id)}
                </button>
              );
            })}
          </div>
          {valid && <p className="mt-[8px] text-[12px] text-muted">{formatEuros(total / entre.size)} cada uno</p>}
        </fieldset>
        {error && <p role="alert" className="text-[13px] text-[var(--chat-missed)]">{error}</p>}
      </div>
    </Sheet>
  );
}

// ── Del plan ──────────────────────────────────────────────────────────────────────────────────

const KIND_BY_TIPO: Record<TipoSubplan, CardKind> = {
  VUELO: "vuelo", BARCO: "barco", TREN: "tren", BUS: "bus", COCHE: "actividad",
  HOTEL: "alojamiento", RESTAURANTE: "restaurante", ACTIVIDAD: "actividad", OTRO: "actividad",
};
const ICON_BY_KIND: Record<CardKind, typeof Plane> = {
  plan: CalendarDays, vuelo: Plane, barco: Ship, tren: Train, bus: Bus,
  alojamiento: BedDouble, restaurante: UtensilsCrossed, actividad: Ticket,
};

export function cardFromSubplan(s: SubplanRow, planTitulo: string): CardMoment {
  return {
    type: "tarjeta",
    kind: KIND_BY_TIPO[s.tipo] ?? "actividad",
    plan_id: s.plan_id,
    plan_titulo: planTitulo,
    subplan_id: s.id,
    titulo: s.titulo,
    inicio_at: s.inicio_at,
    fin_at: s.fin_at,
    all_day: s.all_day,
    lugar: s.ubicacion_nombre || null,
    lugar_fin: s.ubicacion_fin_nombre,
    duracion: s.duracion_viaje,
  };
}

function cardFromPlan(p: { id: number; titulo: string; inicio_at: string; fin_at: string; ubicacion_nombre: string | null; foto_portada?: string | null }): CardMoment {
  return {
    type: "tarjeta", kind: "plan", plan_id: p.id, plan_titulo: p.titulo, titulo: p.titulo,
    inicio_at: p.inicio_at, fin_at: p.fin_at, lugar: p.ubicacion_nombre || null, foto: p.foto_portada ?? null,
  };
}

const whenLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");

/**
 * Share a card. In a plan's chat: the plan or one of its items. Elsewhere: one of your plans
 * (board k-momentos · Tarjetas).
 */
export function PlanItemSheet({
  plan, currentUserId, onClose, onSend,
}: {
  plan: { id: number; titulo: string; inicio_at: string; fin_at: string; ubicacion_nombre: string } | null;
  currentUserId: string;
  onClose: () => void;
  onSend: (card: CardMoment) => Promise<void>;
}) {
  const [items, setItems] = useState<SubplanRow[] | null>(null);
  const [plans, setPlans] = useState<PlanByIdRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = plan
      ? fetchSubplanes(plan.id).then((rows) => { if (!cancelled) setItems(rows.filter((r) => !r.parent_subplan_id).sort((a, b) => a.inicio_at.localeCompare(b.inicio_at))); })
      : fetchUserRelatedPlans({ userId: currentUserId, limit: 50 }).then((rows) => {
          if (cancelled) return;
          const now = Date.now();
          // Upcoming first, then the most recent past ones.
          setPlans([...rows].sort((a, b) => {
            const fa = new Date(a.fin_at).getTime() >= now;
            const fb = new Date(b.fin_at).getTime() >= now;
            if (fa !== fb) return fa ? -1 : 1;
            return fa ? a.inicio_at.localeCompare(b.inicio_at) : b.inicio_at.localeCompare(a.inicio_at);
          }));
        });
    load.catch((e) => { console.error("[chat] Error cargando el plan:", errMsg(e)); if (!cancelled) setError("No se pudo cargar. Inténtalo de nuevo."); });
    return () => { cancelled = true; };
  }, [plan, currentUserId]);

  const send = async (card: CardMoment) => {
    if (busy) return;
    setBusy(true);
    try {
      await onSend(card);
      onClose();
    } catch (e) {
      console.error("[chat] Error enviando tarjeta:", errMsg(e));
      setError("No se pudo enviar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ card, sub }: { card: CardMoment; sub: string }) => {
    const Icon = ICON_BY_KIND[card.kind];
    return (
      <li>
        <button type="button" disabled={busy} onClick={() => void send(card)}
          className="flex min-h-[56px] w-full items-center gap-[12px] rounded-[8px] px-[8px] py-[8px] text-left hover:bg-[var(--surface-2)] disabled:opacity-50">
          <span className="flex size-[36px] shrink-0 items-center justify-center rounded-[8px] border border-app bg-[var(--surface)] text-muted"><Icon className="size-[16px]" aria-hidden /></span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] text-app">{card.titulo}</span>
            <span className="block truncate text-[12px] text-muted">{sub}</span>
          </span>
        </button>
      </li>
    );
  };

  const loading = plan ? items === null : plans === null;

  return (
    <Sheet title={plan ? "Del plan" : "Compartir un plan"} onClose={onClose}>
      {error && <p role="alert" className="mb-[8px] text-[13px] text-[var(--chat-missed)]">{error}</p>}
      {loading && !error && <p className="py-[16px] text-[14px] text-muted">Cargando…</p>}
      {plan && items && (
        <ul className="flex flex-col">
          <Row card={cardFromPlan(plan)} sub={`El plan entero · ${whenLabel(plan.inicio_at)}`} />
          {items.map((s) => <Row key={s.id} card={cardFromSubplan(s, plan.titulo)} sub={`${whenLabel(s.inicio_at)}${s.ubicacion_nombre ? ` · ${s.ubicacion_nombre}` : ""}`} />)}
          {items.length === 0 && <li className="px-[8px] py-[12px] text-[14px] text-muted">El plan aún no tiene nada en el itinerario.</li>}
        </ul>
      )}
      {!plan && plans && (
        <ul className="flex flex-col">
          {plans.map((p) => <Row key={p.id} card={cardFromPlan(p)} sub={`${whenLabel(p.inicio_at)}${p.ubicacion_nombre ? ` · ${p.ubicacion_nombre}` : ""}`} />)}
          {plans.length === 0 && <li className="px-[8px] py-[12px] text-[14px] text-muted">Todavía no tienes planes.</li>}
        </ul>
      )}
    </Sheet>
  );
}
