"use client";

import { useEffect, useState } from "react";
import { CalendarDays, LocateFixed } from "lucide-react";
import LocationAutocomplete, { type Coords } from "@/components/plans/LocationAutocomplete";
import { fetchPlanUserRol, fetchUserRelatedPlans, type PlanByIdRow } from "@/services/api/endpoints/plans.endpoint";
import type { CardMoment, PlaceMoment } from "./moments";
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
  members, currentUserId, onClose, onRegister, initial,
}: {
  members: Member[];
  currentUserId: string;
  onClose: () => void;
  /** Registers the expense and its card in the chat, in one go (fn_chat_registrar_gasto). */
  onRegister: (input: { clientId: string; titulo: string; total: number; pagadoPor: string; participantes: string[] }) => Promise<void>;
  /** From a message («Registrar como gasto»): what @frimee read in it, to review before saving. */
  initial?: { titulo?: string; importe?: number; pagador?: string | null };
}) {
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [importe, setImporte] = useState(initial?.importe ? String(initial.importe).replace(".", ",") : "");
  const [pagador, setPagador] = useState(initial?.pagador && members.some((m) => m.id === initial.pagador) ? initial.pagador : currentUserId);
  const [entre, setEntre] = useState<Set<string>>(() => new Set(members.map((m) => m.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One id per opened sheet: trying again after an error never registers it twice.
  const [clientId] = useState(() => crypto.randomUUID());

  const total = parseFloat(importe.replace(",", "."));
  const valid = titulo.trim().length > 0 && Number.isFinite(total) && total > 0 && entre.size > 0;
  const nombre = (id: string) => (id === currentUserId ? "Tú" : members.find((m) => m.id === id)?.nombre.split(" ")[0] ?? "Alguien");

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onRegister({ clientId, titulo: titulo.trim(), total: Math.round(total * 100) / 100, pagadoPor: pagador, participantes: [...entre] });
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

// ── Invitar a un plan ─────────────────────────────────────────────────────────────────────────

const whenLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");

/**
 * Invite someone to one of your plans from a chat that is not the plan's: the card carries the
 * plan's join code, so whoever receives it can join in one tap. Only plans that have not ended.
 */
export function InvitePlanSheet({
  currentUserId, onClose, onSend,
}: {
  currentUserId: string;
  onClose: () => void;
  onSend: (card: CardMoment) => Promise<void>;
}) {
  const [plans, setPlans] = useState<PlanByIdRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchUserRelatedPlans({ userId: currentUserId, limit: 100 })
      .then((rows) => {
        if (cancelled) return;
        const now = Date.now();
        setPlans(rows
          .filter((p) => p.join_code && new Date(p.fin_at).getTime() >= now)
          .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at)));
      })
      .catch((e) => { console.error("[chat] Error cargando planes:", errMsg(e)); if (!cancelled) setError("No se pudieron cargar tus planes. Inténtalo de nuevo."); });
    return () => { cancelled = true; };
  }, [currentUserId]);

  const send = async (p: PlanByIdRow) => {
    if (busy) return;
    setBusy(true);
    try {
      await onSend({
        type: "tarjeta", kind: "plan", plan_id: p.id, plan_titulo: p.titulo, titulo: p.titulo,
        inicio_at: p.inicio_at, fin_at: p.fin_at, lugar: p.ubicacion_nombre || null,
        foto: p.foto_portada, join_code: p.join_code,
      });
      onClose();
    } catch (e) {
      console.error("[chat] Error enviando invitación:", errMsg(e));
      setError("No se pudo enviar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Invitar a un plan" onClose={onClose}>
      {error && <p role="alert" className="mb-[8px] text-[13px] text-[var(--chat-missed)]">{error}</p>}
      {plans === null && !error && <p className="py-[16px] text-[14px] text-muted">Cargando…</p>}
      {plans && (
        <ul className="flex flex-col">
          {plans.map((p) => (
            <li key={p.id}>
              <button type="button" disabled={busy} onClick={() => void send(p)}
                className="flex min-h-[56px] w-full items-center gap-[12px] rounded-[8px] px-[8px] py-[8px] text-left hover:bg-[var(--surface-2)] disabled:opacity-50">
                <span className="flex size-[36px] shrink-0 items-center justify-center rounded-[8px] border border-app bg-[var(--surface)] text-muted"><CalendarDays className="size-[16px]" aria-hidden /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-app">{p.titulo}</span>
                  <span className="block truncate text-[12px] text-muted">{whenLabel(p.inicio_at)}{p.ubicacion_nombre ? ` · ${p.ubicacion_nombre}` : ""}</span>
                </span>
              </button>
            </li>
          ))}
          {plans.length === 0 && <li className="px-[8px] py-[12px] text-[14px] text-muted">No tienes planes por delante a los que invitar.</li>}
        </ul>
      )}
    </Sheet>
  );
}

/**
 * «¿Dónde la guardo?» (board m-grupo-plan): in a chat without a plan, «Añadir al plan» asks which of
 * your plans ahead to add it to. Only a plan's admins can add activities, so the others are shown
 * but disabled. Creating a plan from the chat itself comes later (it needs its own backend).
 */
export function ChoosePlanSheet({
  currentUserId, activity, onClose, onChoose,
}: {
  currentUserId: string;
  /** What is being saved, e.g. «Calzada Romana · sábado 29, 10:00». */
  activity: string;
  onClose: () => void;
  onChoose: (planId: number) => void;
}) {
  const [plans, setPlans] = useState<Array<PlanByIdRow & { admin: boolean }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUserRelatedPlans({ userId: currentUserId, limit: 100 })
      .then(async (rows) => {
        const now = Date.now();
        const ahead = rows.filter((p) => new Date(p.fin_at).getTime() >= now).sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
        const roles = await Promise.all(ahead.map((p) => fetchPlanUserRol(p.id, currentUserId).catch(() => null)));
        if (!cancelled) setPlans(ahead.map((p, i) => ({ ...p, admin: roles[i] === "ADMIN" })));
      })
      .catch((e) => { console.error("[chat] Error cargando planes:", errMsg(e)); if (!cancelled) setError("No se pudieron cargar tus planes. Inténtalo de nuevo."); });
    return () => { cancelled = true; };
  }, [currentUserId]);

  return (
    <Sheet title="¿Dónde la guardo?" onClose={onClose}>
      <p className="mb-[12px] rounded-[8px] bg-[var(--chat-surface)] px-[12px] py-[10px] text-[14px] text-app">{activity}</p>
      {error && <p role="alert" className="mb-[8px] text-[13px] text-[var(--chat-missed)]">{error}</p>}
      {plans === null && !error && <p className="py-[16px] text-[14px] text-muted">Cargando…</p>}
      {plans && (
        <ul className="flex flex-col">
          {plans.map((p) => (
            <li key={p.id}>
              <button type="button" disabled={!p.admin} onClick={() => onChoose(p.id)}
                className="flex min-h-[56px] w-full items-center gap-[12px] rounded-[8px] px-[8px] py-[8px] text-left hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent">
                <span className="flex size-[36px] shrink-0 items-center justify-center rounded-[8px] border border-app bg-[var(--surface)] text-muted"><CalendarDays className="size-[16px]" aria-hidden /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-app">{p.titulo}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {p.admin ? `${whenLabel(p.inicio_at)}${p.ubicacion_nombre ? ` · ${p.ubicacion_nombre}` : ""}` : "Solo los admins del plan pueden añadir"}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {plans.length === 0 && <li className="px-[8px] py-[12px] text-[14px] text-muted">No tienes planes por delante. Pronto podrás crear uno desde aquí.</li>}
        </ul>
      )}
    </Sheet>
  );
}
