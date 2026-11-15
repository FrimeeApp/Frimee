"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, ChevronUp, Copy, Loader2, Minus, Search, TriangleAlert } from "lucide-react";
import {
  copiaRecuentoEndpoint,
  listMensajesEndpoint,
  pedirUnirmeEndpoint,
  puedoVerChatEndpoint,
  planDesdeChatEndpoint,
  sugerirPlanNuevoEndpoint,
  type ChatListItem,
  type MensajeRow,
  type PlanDesdeChatResult,
} from "@/services/api/endpoints/chat.endpoint";
import { fetchUserRelatedPlans, type PlanByIdRow } from "@/services/api/endpoints/plans.endpoint";
import { Sugerido } from "@/components/ui/TimePicker";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { momentPreview, type CopyMoment, type PlanCreatedMoment } from "./moments";
import { Sheet, sheetField, useIsPhone } from "./Sheet";
import { Rombo } from "./AddToPlanPanel";
import LocationAutocomplete from "@/components/plans/LocationAutocomplete";

/**
 * «Crear plan» from a chat without a plan (canvas «Frimee · Chat · Bitácora», boards cp-*). The chat
 * stays as it is: the plan is born with its own chat, which starts with a copy of this conversation
 * (all of it, or from one message). One call does everything (fn_plan_desde_chat), so a failure
 * leaves nothing half made and a second tap never makes two plans.
 */

const TOPE = 5000;

/** What @frimee or the «Añadir al plan» panel wanted to save, kept in the new plan once it exists. */
export type Guarda = {
  titulo: string;
  /** yyyy-mm-dd */
  fecha?: string;
  /** HH:MM */
  hora?: string;
  durMin?: number;
  tipo?: string;
  lugar?: string;
  lat?: number | null;
  lng?: number | null;
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(".", "");
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
const fmtSince = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
const fmtRange = (a: string, b: string) => {
  const s = new Date(a);
  const e = new Date(b);
  const month = (d: Date) => d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  if (s.toDateString() === e.toDateString()) return `${s.getDate()} ${month(s)}`;
  return s.getMonth() === e.getMonth() ? `${s.getDate()}–${e.getDate()} ${month(e)}` : `${s.getDate()} ${month(s)} – ${e.getDate()} ${month(e)}`;
};
/** Supabase errors are plain objects: log their message (a bare object shows as «{}»). */
const errText = (e: unknown) => (e as { message?: string })?.message || String(e);
/** «Finde en Cercedilla» and «finde en cercedilla » are the same plan name. */
const normTitulo = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const firstName = (n: string) => n.split(" ")[0] || n;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-ES")} ${n === 1 ? one : many}`;
const msgLine = (m: MensajeRow) =>
  momentPreview(m.texto) ??
  (m.audio_url ? "Nota de voz" : m.image_url ? (m.image_type?.startsWith("video/") ? "Vídeo" : "Foto") : m.document_url ? m.document_name ?? "Documento" : m.texto);

type Desde = { id: number; quien: string; at: string; total: number } | null;

/**
 * The whole flow: the sheet and, from it, the picker. The picker replaces the sheet while it is
 * open (a modal sheet blocks everything outside it), and the form keeps what you typed.
 */
export function CreatePlanFlow({
  chat, currentUserId, guarda, inicial, origenId, onClose, onCreated,
}: {
  chat: ChatListItem;
  currentUserId: string;
  guarda?: Guarda | null;
  /** What @frimee read in the message whose diamond opened this (name, first day, place). */
  inicial?: { titulo?: string; fecha?: string; lugar?: string } | null;
  /** The message whose diamond opened this: it loses its diamond once the plan exists. */
  origenId?: number | null;
  onClose: () => void;
  /** After it exists: open its chat (and save what was being added, if anything). */
  onCreated: (r: PlanDesdeChatResult, guarda: Guarda | null) => void;
}) {
  const isGroup = chat.tipo === "GRUPO";
  // You first, then everyone else alphabetically (boards cp-m-gente / cp-d-gente).
  const others = useMemo(
    () => chat.miembros.filter((m) => m.id !== currentUserId).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [chat.miembros, currentUserId],
  );
  const big = chat.miembros.length >= 7;
  // The name is known from the start (the message's, or the group's) and never waits for @frimee.
  const tituloInicial = inicial?.titulo || (isGroup ? chat.nombre ?? "" : "");
  const [titulo, setTitulo] = useState(tituloInicial);
  const [inicio, setInicio] = useState(guarda?.fecha ?? inicial?.fecha ?? "");
  const [fin, setFin] = useState(guarda?.fecha ?? inicial?.fecha ?? "");
  const [donde, setDonde] = useState(guarda?.lugar ?? inicial?.lugar ?? "");
  // Fields @frimee filled (from the message, then from the conversation): «Sugerido» until changed.
  const [sug, setSug] = useState<Set<"titulo" | "fechas" | "donde">>(() => new Set([
    ...(inicial?.titulo ? ["titulo" as const] : []),
    ...(inicial?.fecha && !guarda?.fecha ? ["fechas" as const] : []),
    ...(inicial?.lugar && !guarda?.lugar ? ["donde" as const] : []),
  ]));
  // @frimee reading the conversation (at most 8 s, like «Añadir al plan»): one line under the title,
  // and a skeleton bar in the empty Fechas and Dónde, which stay usable. What you touch is never
  // overwritten. If it finds no dates, the empty date field says so until you touch it.
  const [leyendo, setLeyendo] = useState(true);
  const [sinFechas, setSinFechas] = useState(false);
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const esperando = (k: "fechas" | "donde") => leyendo && !tocados.has(k) && !(k === "fechas" ? inicio : donde);
  // The range @frimee suggested (dashed days in the calendar) and «Crear» pressed without dates.
  const [sugFechas, setSugFechas] = useState<{ inicio: string; fin: string } | null>(
    () => (inicial?.fecha && !guarda?.fecha ? { inicio: inicial.fecha, fin: inicial.fecha } : null));
  const [faltanFechas, setFaltanFechas] = useState(false);
  const touched = useRef<Set<string>>(new Set());
  const [fuera, setFuera] = useState<Set<string>>(new Set());
  // «Copiar la conversación» (switch); from the start unless a message was chosen («Desde»).
  const [copiar, setCopiar] = useState(true);
  const [desde, setDesde] = useState<Desde>(null);
  const modo: "toda" | "desde" | "nada" = !copiar ? "nada" : desde ? "desde" : "toda";
  const [recuento, setRecuento] = useState<{ total: number; desde_at: string | null } | null>(null);
  const [view, setView] = useState<"form" | "gente">("form");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One id per sheet: a retry or a double tap returns the same plan.
  const clientId = useRef(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    copiaRecuentoEndpoint(chat.chat_id)
      .then((r) => {
        if (cancelled) return;
        setRecuento(r);
        if (r.total === 0) setCopiar(false);
      })
      .catch(() => { if (!cancelled) setRecuento({ total: 0, desde_at: null }); });
    return () => { cancelled = true; };
  }, [chat.chat_id]);

  // Name, place and dates read from the conversation; only into fields you have not touched.
  useEffect(() => {
    let cancelled = false;
    const tope = window.setTimeout(() => { cancelled = true; setLeyendo(false); }, 8000);
    sugerirPlanNuevoEndpoint(chat.chat_id)
      .then((p) => {
        if (cancelled) return;
        if (!p?.fecha_inicio) setSinFechas(true);
        if (!p) return;
        const next = new Set<"titulo" | "fechas" | "donde">();
        if (p.titulo && !tituloInicial && !touched.current.has("titulo")) { setTitulo(p.titulo); next.add("titulo"); }
        if (p.fecha_inicio) setSugFechas({ inicio: p.fecha_inicio, fin: p.fecha_fin || p.fecha_inicio });
        if (p.fecha_inicio && !touched.current.has("fechas") && !guarda?.fecha) {
          setInicio(p.fecha_inicio);
          setFin(p.fecha_fin || p.fecha_inicio);
          next.add("fechas");
        }
        if (p.destino && !touched.current.has("donde") && !guarda?.lugar) { setDonde(p.destino); next.add("donde"); }
        setSug((cur) => new Set([...cur, ...next]));
      })
      .catch((e) => console.error("[chat] sugerir plan:", errText(e)))
      .finally(() => { window.clearTimeout(tope); if (!cancelled) setLeyendo(false); });
    return () => { cancelled = true; window.clearTimeout(tope); };
  }, [chat.chat_id, guarda?.fecha, guarda?.lugar, tituloInicial]);
  // Your plans, to warn (never block) when you already have this one: same name, overlapping days.
  const [misPlanes, setMisPlanes] = useState<PlanByIdRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchUserRelatedPlans({ userId: currentUserId })
      .then((ps) => { if (!cancelled) setMisPlanes(ps); })
      .catch((e) => console.error("[chat] mis planes:", errText(e)));
    return () => { cancelled = true; };
  }, [currentUserId]);
  const repetido = useMemo(() => {
    const t = normTitulo(titulo);
    if (!t || !inicio || !fin) return null;
    const a = new Date(`${inicio}T00:00:00`).getTime();
    const b = new Date(`${fin}T23:59:00`).getTime();
    return misPlanes.find((p) => normTitulo(p.titulo) === t
      && new Date(p.inicio_at).getTime() <= b && new Date(p.fin_at).getTime() >= a) ?? null;
  }, [misPlanes, titulo, inicio, fin]);

  const touch = (k: "titulo" | "fechas" | "donde") => {
    touched.current.add(k);
    setTocados((s) => (s.has(k) ? s : new Set([...s, k])));
    setSug((s) => { if (!s.has(k)) return s; const n = new Set(s); n.delete(k); return n; });
  };

  const demasiados = (recuento?.total ?? 0) > TOPE;
  const aCopiar = modo === "nada" ? 0 : modo === "desde" ? desde?.total ?? 0 : recuento?.total ?? 0;
  const valid = titulo.trim().length > 0 && recuento !== null
    && (modo === "nada" || (modo === "toda" ? !demasiados : Boolean(desde) && desde!.total <= TOPE));
  const guardaLine = guarda?.titulo
    ? [guarda.titulo, guarda.fecha && guarda.hora ? `${fmtDay(`${guarda.fecha}T${guarda.hora}:00`)}, ${guarda.hora}` : null].filter(Boolean).join(" · ")
    : null;
  const fueraNames = others.filter((m) => fuera.has(m.id)).map((m) => firstName(m.nombre));
  const entran = chat.miembros.length - fuera.size;
  const thisChat = isGroup ? "El chat del grupo no cambia." : "Este chat no cambia.";
  const toggle = (id: string) => setFuera((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const create = async () => {
    if (!valid || busy) return;
    // Board fe-sistema · Error: only on pressing without dates; red field and the focus goes to it.
    if (!inicio || !fin) {
      setFaltanFechas(true);
      document.querySelector<HTMLButtonElement>('[aria-label^="Fechas del plan"]')?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await planDesdeChatEndpoint({
        clientId: clientId.current,
        chatId: chat.chat_id,
        titulo: titulo.trim(),
        inicioAt: new Date(`${inicio}T00:00:00`).toISOString(),
        finAt: new Date(`${fin}T23:59:00`).toISOString(),
        ubicacion: donde.trim(),
        miembros: others.filter((m) => !fuera.has(m.id)).map((m) => m.id),
        desdeId: modo === "desde" ? desde?.id ?? null : null,
        copiar: modo !== "nada",
        origenId: origenId ?? null,
      });
      onCreated(r, guarda ?? null);
    } catch (e) {
      console.error("[chat] crear plan desde el chat:", errText(e));
      const msg = (e as { message?: string })?.message ?? "";
      setError(/demasiados/i.test(msg)
        ? "Hay demasiados mensajes para copiar. Elige desde qué mensaje."
        : `No se pudo crear el plan. No se ha creado nada a medias: ${isGroup ? "tu grupo sigue igual" : "el chat sigue igual"}. Comprueba la conexión y vuelve a intentarlo.`);
      setBusy(false);
    }
  };

  if (picking) {
    return (
      <CopyFromPicker
        chat={chat}
        currentUserId={currentUserId}
        initialId={desde?.id ?? null}
        onCancel={() => setPicking(false)}
        onPick={(d) => { setDesde(d); setPicking(false); }}
      />
    );
  }

  // «Quién entra» (groups of 7 or more): inside the sheet, with a search and «Marcar a todos».
  if (view === "gente") {
    return (
      <Sheet title="Quién entra" onClose={onClose} maxWidth={560}
        footer={(
          <button type="button" onClick={() => setView("form")}
            className="flex min-h-[46px] w-full items-center justify-center rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90">
            Listo · {plural(entran, "persona", "personas")}
          </button>
        )}>
        <PeoplePicker others={others} fuera={fuera} setFuera={setFuera} total={chat.miembros.length} onBack={() => setView("form")} />
      </Sheet>
    );
  }

  const footer = (
    <div>
      <button
        type="button"
        disabled={!valid || busy}
        onClick={() => void create()}
        className="flex min-h-[46px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90 disabled:bg-[var(--surface-2)] disabled:text-muted"
      >
        {busy ? (<><Loader2 className="size-[18px] animate-spin motion-reduce:animate-none" aria-hidden />Creando el plan…</>)
          : error ? "Reintentar"
          : modo === "nada" ? "Crear plan con un chat nuevo"
          : "Crear plan y copiar la conversación"}
      </button>
      <p role="status" className="mt-[6px] text-center text-[12px] text-muted">
        {busy && aCopiar > 0 ? `Copiando ${plural(aCopiar, "mensaje", "mensajes")}. Tarda unos segundos.` : thisChat}
      </p>
    </div>
  );

  return (
    <Sheet title="Crear plan" onClose={busy ? () => {} : onClose} footer={footer} maxWidth={560}>
      {error && (
        <div role="alert" className="mb-[12px] flex gap-[10px] rounded-[8px] border border-[var(--chat-missed)] bg-[var(--surface)] p-[12px] text-[14px] leading-[1.4] text-app">
          <TriangleAlert className="mt-[2px] size-[16px] shrink-0 text-[var(--chat-missed)]" aria-hidden />
          {error}
        </div>
      )}

      {leyendo && (
        <p role="status" className="-mt-[4px] mb-[10px] flex items-center gap-[8px] text-[13px] text-muted">
          <span className="flex size-[16px] shrink-0 items-center justify-center [&>svg]:size-[16px]"><Rombo state="thinking" /></span>
          Frimee está leyendo la conversación…
        </p>
      )}
      <div className="flex flex-col">
        <FieldRow label="Nombre" htmlFor="cp-nombre">
          <input id="cp-nombre" className={`${rowField} text-[17px] font-[var(--fw-semibold)]`} value={titulo} maxLength={80} disabled={busy}
            placeholder="Ponle nombre al plan" onChange={(e) => { setTitulo(e.target.value); touch("titulo"); }} />
          {sug.has("titulo") && <Sugerido />}
        </FieldRow>
        <FieldRow label="Fechas">
          {/* Board fe-*: one field; dropdown on desktop, sheet on phones. */}
          <DateRangePicker
            inicio={inicio}
            fin={fin}
            sugerido={sugFechas}
            invalid={faltanFechas}
            disabled={busy}
            leyendo={esperando("fechas")}
            vacio={sinFechas && !tocados.has("fechas") ? "Frimee no ha encontrado fechas en la conversación" : undefined}
            onChange={(a, b) => { setInicio(a); setFin(b); setFaltanFechas(false); touch("fechas"); }}
          />
          {sug.has("fechas") && inicio && <Sugerido />}
        </FieldRow>
        <FieldRow label="Dónde">
          <span className="relative flex min-w-0 flex-1 items-center">
            {/* While @frimee reads: a bar where the place will go; typing takes over. Places search
                like «Crear plan» in Planes (only the name is kept); empty = «Por decidir». */}
            {esperando("donde") && <span aria-hidden className="skel-live pointer-events-none absolute left-0 z-[1] h-[16px] w-[45%]" />}
            <LocationAutocomplete value={donde} onChange={(v) => { setDonde(v.slice(0, 120)); touch("donde"); }}
              placeholder={esperando("donde") ? "" : "Busca un sitio o déjalo por decidir"} dropdownVariant="surface"
              className="flex h-[44px] min-w-0 items-center text-[15px] text-app" />
          </span>
          {sug.has("donde") && <Sugerido />}
        </FieldRow>
        {guardaLine && (
          <FieldRow label="Guarda">
            <span className="min-w-0 flex-1 truncate text-[15px] text-app">{guardaLine}</span>
          </FieldRow>
        )}
        <div aria-hidden className="border-t border-app" />
      </div>
      {repetido && (
        <p role="status" className="mt-[10px] flex items-start gap-[8px] text-[13px] leading-[1.45] text-app">
          <TriangleAlert className="mt-[2px] size-[15px] shrink-0 text-[var(--warning)]" aria-hidden />
          <span className="min-w-0 flex-1">
            Ya tienes «{repetido.titulo}» esos días ({fmtRange(repetido.inicio_at, repetido.fin_at)}). Puedes crearlo igualmente.{" "}
            <Link href={`/plans/${repetido.id}`} onClick={onClose} className="font-[var(--fw-semibold)] text-primary-token">Abrir</Link>
          </span>
        </p>
      )}

      <h3 className="mb-[6px] mt-[18px] flex items-baseline gap-[8px]">
        <span className="text-[14px] font-[var(--fw-semibold)] text-app">Quién entra</span>
        <span className="text-[12px] text-muted">desmarca a quien no vaya</span>
      </h3>
      {big ? (
        <div className="flex min-h-[56px] items-center gap-[12px] rounded-[8px] border border-app px-[12px] py-[8px]">
          <span aria-hidden className="flex shrink-0 -space-x-[8px]">
            {[{ id: currentUserId, nombre: "Tú", profile_image: null }, ...others.filter((m) => !fuera.has(m.id))].slice(0, 5).map((m) => (
              <Avatar key={m.id} name={m.nombre} src={m.profile_image} small />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-[var(--fw-semibold)] text-app">{entran} de {chat.miembros.length} entran</span>
            <span className="block truncate text-[12px] text-muted">
              {fueraNames.length === 0 ? "Todo el grupo"
                : fueraNames.length === 1 ? `Falta ${fueraNames[0]}`
                : fueraNames.length <= 3 ? `Faltan ${listaY(fueraNames)}`
                : `Faltan ${fueraNames.slice(0, 2).join(", ")} y ${fueraNames.length - 2} más`}
            </span>
          </span>
          <button type="button" onClick={() => setView("gente")} disabled={busy} className="min-h-[44px] shrink-0 text-[14px] font-[var(--fw-semibold)] text-primary-token">
            Elegir
          </button>
        </div>
      ) : (
        <ul className="flex flex-col">
          <li><MeRow /></li>
          {others.map((m) => (
            <li key={m.id}><MemberRow m={m} dentro={!fuera.has(m.id)} disabled={busy} onToggle={() => toggle(m.id)} /></li>
          ))}
        </ul>
      )}
      {fueraNames.length > 0 && modo !== "nada" && (
        <p className="mt-[4px] text-[13px] leading-[1.45] text-muted">
          {big ? `Los mensajes de ${listaY(fueraNames.length > 3 ? [...fueraNames.slice(0, 2), `${fueraNames.length - 2} más`] : fueraNames)} se copian con su nombre.`
            : fueraNames.length === 1 ? `${fueraNames[0]} no estará en el plan. Sus mensajes se copian con su nombre.`
            : `${listaY(fueraNames)} no estarán en el plan. Sus mensajes se copian con su nombre.`}
        </p>
      )}

      <h3 className="mb-[6px] mt-[18px] text-[14px] font-[var(--fw-semibold)] text-app">Qué conversación se copia</h3>
      {/* Boards cp-m-swon / cp-m-swoff: one card. The switch, and below it (when on) «Desde». */}
      <div className="rounded-[8px] border border-[var(--border)]">
        <button
          type="button"
          role="switch"
          aria-checked={copiar}
          disabled={busy || recuento?.total === 0}
          onClick={() => setCopiar((c) => !c)}
          className="flex min-h-[56px] w-full items-center gap-[12px] px-[12px] py-[6px] text-left disabled:opacity-50"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-[var(--fw-semibold)] text-app">Copiar la conversación</span>
            <span className="block text-[13px] tabular-nums text-muted">
              {recuento === null ? "Contando…"
                : recuento.total === 0 ? "Todavía no hay mensajes"
                : !copiar ? "El chat del plan empezará vacío"
                : plural(desde ? desde.total : recuento.total, "mensaje", "mensajes")}
            </span>
          </span>
          <span aria-hidden className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${copiar ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}>
            <span className={`absolute top-[3px] size-[20px] rounded-full transition-[left] duration-150 motion-reduce:transition-none ${copiar ? "left-[21px] bg-[var(--bg)]" : "left-[3px] bg-[var(--surface)]"}`} />
          </span>
        </button>
        {copiar && recuento !== null && recuento.total > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPicking(true)}
            aria-label={desde
              ? `Copiar desde el mensaje de ${desde.quien}, ${fmtDay(desde.at)} ${fmtTime(desde.at)}. Elegir otro mensaje`
              : demasiados ? "Elegir desde qué mensaje copiar" : "Copiar desde el principio. Elegir otro mensaje"}
            className="flex min-h-[52px] w-full items-center gap-[12px] border-t border-app py-[6px] pl-[12px] pr-[4px] text-left"
          >
            <span className="w-[48px] shrink-0 text-[12px] text-muted">Desde</span>
            <span className="min-w-0 flex-1">
              {desde ? (
                <>
                  <span className="block text-[15px] text-app">{desde.quien === "ti" ? "Tu mensaje" : desde.quien}</span>
                  <span className="block text-[12px] tabular-nums text-muted">{fmtDay(desde.at)}, {fmtTime(desde.at)}</span>
                </>
              ) : demasiados ? (
                <>
                  <span className="block text-[15px] text-[var(--chat-missed)]">Elige desde dónde</span>
                  <span className="block text-[12px] tabular-nums text-muted">Tiene {recuento.total.toLocaleString("es-ES")} mensajes; se copian hasta {TOPE.toLocaleString("es-ES")}</span>
                </>
              ) : (
                <>
                  <span className="block text-[15px] text-app">El principio</span>
                  {recuento.desde_at && <span className="block text-[12px] tabular-nums text-muted">{fmtSince(recuento.desde_at)}</span>}
                </>
              )}
            </span>
            <span className="flex min-h-[44px] shrink-0 items-center gap-[2px] pr-[4px] text-[14px] font-[var(--fw-semibold)] text-primary-token">
              Elegir mensaje<ChevronUp className="size-[16px] rotate-90" aria-hidden />
            </span>
          </button>
        )}
      </div>
      <p className="mt-[10px] flex gap-[8px] text-[13px] leading-[1.45] text-muted">
        <Copy className="mt-[2px] size-[14px] shrink-0" aria-hidden />
        {modo === "nada"
          ? `Empezará con el hito «Plan creado» y un enlace a ${isGroup ? "este grupo" : "este chat"}.`
          : "Se copian los mensajes con su autor y su fecha, las fotos, las notas de voz y las encuestas (cerradas, con sus resultados). No se copian reacciones, fijados ni destacados."}
      </p>
    </Sheet>
  );
}

/** Fields of the sheet's rows (boards cp-*): no box, the text sits on the row. */
const rowField = "h-[44px] w-full min-w-0 bg-transparent text-[15px] text-app outline-none placeholder:text-muted [color-scheme:inherit] focus-visible:underline focus-visible:decoration-[var(--primary)] focus-visible:underline-offset-4";

const listaY = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

type Member = ChatListItem["miembros"][number];

function MeRow() {
  return (
    <div className="flex min-h-[52px] items-center gap-[12px] px-[4px]">
      <Avatar name="Tú" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-app">Tú</span>
        <span className="block text-[12px] text-muted">Creas el plan</span>
      </span>
      <span aria-hidden className="flex size-[22px] items-center justify-center rounded-[6px] bg-[var(--surface-2)] text-muted"><Check className="size-[14px]" strokeWidth={3} /></span>
    </div>
  );
}

function MemberRow({ m, dentro, disabled, onToggle }: { m: Member; dentro: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <label className="flex min-h-[52px] cursor-pointer items-center gap-[12px] rounded-[8px] px-[4px] hover:bg-[var(--surface)]">
      <Avatar name={m.nombre} src={m.profile_image} />
      <span className="min-w-0 flex-1 truncate text-[15px] text-app">{m.nombre}</span>
      <input type="checkbox" className="peer sr-only" checked={dentro} disabled={disabled} onChange={onToggle} />
      <Box state={dentro ? "on" : "off"} />
    </label>
  );
}

function Box({ state }: { state: "on" | "off" | "mixed" }) {
  return (
    <span aria-hidden className={`flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)] ${state === "off" ? "border-[var(--border)]" : "border-[var(--primary)] bg-[var(--primary)] text-[var(--bg)]"}`}>
      {state === "on" && <Check className="size-[14px]" strokeWidth={3} />}
      {state === "mixed" && <Minus className="size-[14px]" strokeWidth={3} />}
    </span>
  );
}

/** «Quién entra» for big groups: fixed search, «Marcar a todos» (mixed state) and the list. */
function PeoplePicker({
  others, fuera, setFuera, total, onBack,
}: {
  others: Member[];
  fuera: Set<string>;
  setFuera: (f: Set<string>) => void;
  total: number;
  onBack: () => void;
}) {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const shown = q.trim() ? others.filter((m) => norm(m.nombre).includes(norm(q.trim()))) : others;
  const all = fuera.size === 0 ? "on" : fuera.size === others.length ? "off" : "mixed";
  const allRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (allRef.current) allRef.current.indeterminate = all === "mixed"; }, [all]);
  return (
    <div>
      <div className="sticky -top-[8px] z-[1] -mx-[16px] bg-[var(--bg)] px-[16px] pb-[8px] pt-[8px]">
        <div className="flex items-center gap-[4px]">
          <button type="button" onClick={onBack} aria-label="Volver a crear plan" className="-ml-[12px] flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-app hover:bg-[var(--surface)]">
            <ChevronUp className="size-[20px] -rotate-90" aria-hidden />
          </button>
          <p className="text-[13px] text-muted">{total - fuera.size} de {total} · desmarca a quien no vaya</p>
        </div>
        <label className="relative mt-[4px] block">
          <span className="sr-only">Buscar en el grupo</span>
          <Search aria-hidden className="pointer-events-none absolute left-[12px] top-1/2 size-[16px] -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el grupo" className={`${sheetField} pl-[36px]`} />
        </label>
        <label className="mt-[4px] flex min-h-[48px] cursor-pointer items-center gap-[12px] px-[4px]">
          <span className="flex-1 text-[15px] font-[var(--fw-semibold)] text-app">Marcar a todos</span>
          <input ref={allRef} type="checkbox" className="peer sr-only" checked={all === "on"}
            onChange={() => setFuera(all === "on" ? new Set(others.map((m) => m.id)) : new Set())} />
          <Box state={all} />
        </label>
      </div>
      <ul className="flex flex-col" aria-label="Miembros del grupo">
        {!q.trim() && <li><MeRow /></li>}
        {shown.map((m) => (
          <li key={m.id}>
            <MemberRow m={m} dentro={!fuera.has(m.id)} onToggle={() => {
              const n = new Set(fuera);
              if (n.has(m.id)) n.delete(m.id); else n.add(m.id);
              setFuera(n);
            }} />
          </li>
        ))}
        {shown.length === 0 && <li className="px-[4px] py-[12px] text-[14px] text-muted">Nadie con ese nombre.</li>}
      </ul>
    </div>
  );
}

function FieldRow({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[48px] items-center gap-[12px] border-t border-app py-[2px] first:border-t-0">
      {htmlFor ? <label htmlFor={htmlFor} className="w-[64px] shrink-0 text-[12px] text-muted">{label}</label>
        : <span className="w-[64px] shrink-0 text-[12px] text-muted">{label}</span>}
      {children}
    </div>
  );
}

function Avatar({ name, src, small }: { name: string; src?: string | null; small?: boolean }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-[var(--surface-2)] font-[var(--fw-semibold)] text-app ${small ? "size-[28px] text-[11px] ring-2 ring-[var(--bg)]" : "size-[34px] text-[13px]"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (name[0] ?? "?").toUpperCase()}
    </span>
  );
}

/**
 * «Elige desde dónde copiar» (boards cp-m-elegir, cp-d-elegir): the conversation as it is; what is
 * before the chosen message fades and a line says «Se copia desde aquí». Arrows ↑ ↓ and Enter on
 * desktop.
 */
function CopyFromPicker({
  chat, currentUserId, initialId, onCancel, onPick,
}: {
  chat: ChatListItem;
  currentUserId: string;
  initialId: number | null;
  onCancel: () => void;
  onPick: (d: NonNullable<Desde>) => void;
}) {
  const phone = useIsPhone();
  const [msgs, setMsgs] = useState<MensajeRow[] | null>(null);
  const [more, setMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sel, setSel] = useState<number | null>(initialId);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const firstLoad = useRef(true);

  const load = async (cursor: number | null) => {
    const rows = await listMensajesEndpoint({ chatId: chat.chat_id, limit: 60, cursorId: cursor });
    setMore(rows.length === 60);
    return rows.slice().reverse();
  };
  useEffect(() => {
    let cancelled = false;
    load(null).then((rows) => { if (!cancelled) setMsgs(rows); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.chat_id]);
  // Start at the bottom, like the chat.
  useEffect(() => {
    if (!msgs || !firstLoad.current) return;
    firstLoad.current = false;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);
  useEffect(() => {
    if (sel == null) { setCount(null); return; }
    let cancelled = false;
    setCount(null);
    copiaRecuentoEndpoint(chat.chat_id, sel).then((r) => { if (!cancelled) setCount(r.total); }).catch(() => {});
    return () => { cancelled = true; };
  }, [chat.chat_id, sel]);

  const older = async () => {
    if (!msgs || loadingMore || msgs.length === 0) return;
    setLoadingMore(true);
    const el = listRef.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    try {
      const rows = await load(msgs[0].id);
      setMsgs((cur) => [...rows, ...(cur ?? [])]);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - before; });
    } catch { /* the button stays to try again */ } finally {
      setLoadingMore(false);
    }
  };

  const ids = useMemo(() => (msgs ?? []).map((m) => m.id), [msgs]);
  const onKey = (e: React.KeyboardEvent) => {
    if (!ids.length) return;
    const i = sel == null ? ids.length : ids.indexOf(sel);
    if (e.key === "ArrowUp") { e.preventDefault(); setSel(ids[Math.max(0, i - 1)]); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel(ids[Math.min(ids.length - 1, i + 1)]); }
    else if (e.key === "Enter" && chosen && count != null) { e.preventDefault(); pick(); }
    else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  };
  useEffect(() => {
    if (sel != null) document.getElementById(`cp-opt-${sel}`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const chosen = msgs?.find((m) => m.id === sel) ?? null;
  const pick = () => {
    if (!chosen || count == null) return;
    onPick({ id: chosen.id, quien: chosen.sender_id === currentUserId ? "ti" : firstName(chosen.sender_nombre), at: chosen.created_at, total: count });
  };
  const rest = chat.tipo === "GRUPO" ? "lo anterior se queda en el grupo" : "lo anterior se queda en el chat";

  let lastDay = "";
  // On body: the Messages page slides its panels with a transform, which would move a fixed layer.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Elige desde dónde copiar" className="fixed inset-0 z-[110] flex flex-col bg-[var(--bg)] md:items-center md:justify-center md:bg-black/50 md:p-[16px]">
      <div className="flex min-h-0 w-full flex-1 flex-col bg-[var(--bg)] md:max-h-[85dvh] md:max-w-[560px] md:flex-none md:rounded-[16px] md:border md:border-app md:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <header className="flex min-h-[56px] items-center gap-[4px] border-b border-app px-[4px] pt-mobile-safe-top md:pt-0">
          <button type="button" onClick={onCancel} aria-label="Volver a crear plan" className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-app hover:bg-[var(--surface)]">
            <ChevronUp className="size-[22px] -rotate-90" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 py-[6px]">
            <h2 className="text-[17px] font-[var(--fw-semibold)] text-app">Elige desde dónde copiar</h2>
            <p className="text-[12px] text-muted">{phone ? "Toca el primer mensaje que quieres en el plan" : "Elige el primer mensaje · flechas ↑ ↓ e Intro"}</p>
          </div>
        </header>

        <div ref={listRef} role="listbox" aria-label="Mensajes" tabIndex={0} onKeyDown={onKey}
          aria-activedescendant={sel != null ? `cp-opt-${sel}` : undefined}
          className="relative min-h-0 flex-1 overflow-y-auto py-[12px] outline-none md:min-h-[360px]">
          <span aria-hidden className="absolute bottom-0 left-[27px] top-0 w-px bg-[var(--border)]" />
          {error && <p role="alert" className="px-[56px] py-[16px] text-[14px] text-[var(--chat-missed)]">No se pudieron cargar los mensajes.</p>}
          {msgs === null && !error && <p className="px-[56px] py-[16px] text-[14px] text-muted">Cargando…</p>}
          {more && msgs && msgs.length > 0 && (
            <div className="pl-[56px] pr-[16px]">
              <button type="button" onClick={() => void older()} disabled={loadingMore} className="min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-primary-token">
                {loadingMore ? "Cargando…" : "Ver mensajes anteriores"}
              </button>
            </div>
          )}
          {msgs?.map((m) => {
            const day = new Date(m.created_at).toDateString();
            const newDay = day !== lastDay;
            lastDay = day;
            const before = sel != null && m.id < sel;
            const isSel = m.id === sel;
            const mine = m.sender_id === currentUserId;
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className={`relative pb-[4px] pl-[56px] pr-[16px] pt-[14px] ${before ? "opacity-40" : ""}`}>
                    <span aria-hidden className="absolute left-[22px] top-[23px] size-[11px] rounded-full border-2 border-[var(--text-secondary)] bg-[var(--bg)]" />
                    <h3 className="flex items-baseline gap-[8px] font-normal">
                      <span className="[font-family:var(--font-display-face)] text-[22px] leading-[26px] text-app">
                        {new Date(m.created_at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric" }).replace(/^\w/, (c) => c.toUpperCase())}
                      </span>
                      <span className="text-[12px] text-muted">{new Date(m.created_at).toLocaleDateString("es-ES", { month: "long" })}</span>
                    </h3>
                  </div>
                )}
                {isSel && (
                  <div role="presentation" className="relative flex min-h-[36px] items-center pl-[56px] pr-[16px]">
                    <span aria-hidden className="absolute left-0 right-[16px] top-1/2 h-[2px] bg-[var(--primary)]" />
                    <span className="relative ml-auto inline-flex h-[28px] items-center gap-[6px] rounded-full bg-[var(--primary)] px-[10px] text-[12px] font-[var(--fw-semibold)] text-[var(--bg)]">
                      <ChevronUp className="size-[14px]" aria-hidden />Se copia desde aquí
                    </span>
                  </div>
                )}
                <div
                  id={`cp-opt-${m.id}`}
                  role="option"
                  aria-selected={isSel}
                  onClick={() => setSel(m.id)}
                  className={`relative mt-[6px] cursor-pointer ${isSel ? "mx-[8px] rounded-[8px] bg-[var(--chat-me)] py-[8px] pl-[48px] pr-[8px] outline outline-2 -outline-offset-2 outline-[var(--primary)]" : "pl-[56px] pr-[16px] hover:bg-[var(--surface)]"} ${before ? "opacity-40" : ""}`}
                >
                  <div className="flex items-baseline gap-[8px]">
                    <span className="text-[13px] font-[var(--fw-semibold)] text-app">{mine ? "Tú" : m.sender_nombre}</span>
                    <span className="text-[12px] tabular-nums text-muted">{fmtTime(m.created_at)}</span>
                  </div>
                  <p className="mt-[2px] line-clamp-3 break-words text-[15px] leading-[1.45] text-app">{msgLine(m)}</p>
                </div>
              </Fragment>
            );
          })}
        </div>

        <div className="border-t border-app bg-[var(--bg)] px-[16px] pb-[calc(12px+env(safe-area-inset-bottom))] pt-[12px] md:rounded-b-[16px] md:pb-[12px]">
          <p className="mb-[8px] text-[12px] tabular-nums text-muted" aria-live="polite">
            {chosen
              ? count == null ? "Contando…"
                : count > TOPE ? `${plural(count, "mensaje", "mensajes")}: se pueden copiar hasta ${TOPE.toLocaleString("es-ES")}. Elige uno más reciente.`
                : `${plural(count, "mensaje", "mensajes")} · desde ${fmtDay(chosen.created_at)}, ${fmtTime(chosen.created_at)} · ${rest}`
              : "Toca el primer mensaje que quieres en el plan"}
          </p>
          <div className="flex gap-[8px]">
            {!phone && (
              <button type="button" onClick={onCancel} className="min-h-[46px] rounded-[8px] border border-app px-[16px] text-[15px] font-[var(--fw-semibold)] text-app">Cancelar</button>
            )}
            <button type="button" onClick={pick} disabled={!chosen || count == null || count > TOPE}
              className="min-h-[46px] flex-1 rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] disabled:bg-[var(--surface-2)] disabled:text-muted">
              Copiar desde aquí
            </button>
          </div>
        </div>
      </div>
    </div>
  ,
    document.body,
  );
}

/**
 * The plans you are in now. The «Plan creado» mark keeps who entered at creation; whoever joined
 * later (an accepted «Pedir unirme», an invite) must see «Abrir el plan» too. Remembered for 30 s
 * so the marks of one chat ask once.
 */
let misPlanesCache: { userId: string; at: number; p: Promise<Set<number>> } | null = null;
function misPlanIds(userId: string): Promise<Set<number>> {
  if (misPlanesCache && misPlanesCache.userId === userId && Date.now() - misPlanesCache.at < 30_000) return misPlanesCache.p;
  const p = fetchUserRelatedPlans({ userId }).then((ps) => new Set(ps.map((x) => x.id)));
  p.catch(() => { misPlanesCache = null; });
  misPlanesCache = { userId, at: Date.now(), p };
  return p;
}
export function useMisPlanIds(userId: string, enabled = true) {
  const [ids, setIds] = useState<Set<number> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    misPlanIds(userId)
      .then((v) => { if (!cancelled) setIds(v); })
      .catch((e) => console.error("[chat] mis planes:", errText(e)));
    return () => { cancelled = true; };
  }, [userId, enabled]);
  return ids;
}

/** Whether you are still in the original chat (null while asking, or if asking failed). */
function useVeChat(chatId: string, enabled = true) {
  const [ve, setVe] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    puedoVerChatEndpoint(chatId)
      .then((v) => { if (!cancelled) setVe(v); })
      .catch((e) => console.error("[chat] comprobar el chat original:", (e as { message?: string })?.message ?? String(e)));
    return () => { cancelled = true; };
  }, [chatId, enabled]);
  return ve;
}

/**
 * «Antes del plan» (boards cp-m-plan, cp-sistema): the first entry of a plan's chat made from
 * another chat. A chapter in serif with a copy node; the link only works for who is in that chat.
 */
export function CopySeparator({ data, onOpenChat }: { data: CopyMoment; onOpenChat?: (chatId: string) => void }) {
  const cuando = fmtSince(data.copiado_at);
  // Someone who joined the plan later (or left the group) cannot open that chat: no link then.
  const ve = useVeChat(data.origen_chat_id);
  return (
    <div className="relative pb-[6px] pl-[56px] pr-[var(--space-4)] pt-[18px]">
      <span aria-hidden className="absolute left-[18px] top-[22px] flex size-[20px] items-center justify-center rounded-full border border-app bg-[var(--bg)] text-muted">
        <Copy className="size-[11px]" />
      </span>
      <h3 className="[font-family:var(--font-display-face)] text-[24px] font-normal leading-[28px] text-app">Antes del plan</h3>
      <p className="mt-[2px] text-[13px] leading-[1.45] text-muted">
        Conversación copiada de «{data.origen_nombre}» el {cuando} · {plural(data.copiados, "mensaje", "mensajes")}. Las reacciones y los fijados se quedan en el otro chat.
      </p>
      {ve !== true ? null : onOpenChat ? (
        <button type="button" onClick={() => onOpenChat(data.origen_chat_id)} className="min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-primary-token">
          Ir al chat original
        </button>
      ) : (
        <Link href={`/messages?chat=${data.origen_chat_id}`} className="inline-flex min-h-[44px] items-center text-[14px] font-[var(--fw-semibold)] text-primary-token">
          Ir al chat original
        </Link>
      )}
    </div>
  );
}

/**
 * «Plan creado» (boards cp-m-grupo, cp-m-plan, cp-m-planlimpio): a filled-diamond milestone, written
 * for whoever reads it («Ana, Lucía y tú» / «Ana, Lucía y Cayetano»). It never says who was left
 * out. In the original chat: «Abrir el plan», or «Pedir unirme» for who is not in it. In the plan's
 * chat it closes the copied part; with nothing copied it opens the chat and links back.
 */
export function PlanCreatedMark({
  data, currentUserId, inPlanChat, chatId, onOpenChat,
}: {
  data: PlanCreatedMoment;
  currentUserId: string;
  inPlanChat: boolean;
  /** The chat this mark is in (to ask to join from it). */
  chatId: string;
  onOpenChat?: (chatId: string) => void;
}) {
  const router = useRouter();
  const [pedido, setPedido] = useState<"idle" | "enviando" | "enviado" | "error">("idle");
  const yo = data.creador_id === currentUserId;
  const quien = yo ? "Tú" : data.creador_nombre || "Alguien";
  const otros = data.miembros.filter((m) => m.id !== data.creador_id).map((m) => (m.id === currentUserId ? "contigo" : m.nombre));
  // «tú» goes last, as people say it.
  const gente = listaY([
    ...data.miembros.filter((m) => m.id !== currentUserId).map((m) => m.nombre),
    ...(data.miembros.some((m) => m.id === currentUserId) ? ["tú"] : []),
  ]);
  const misPlanes = useMisPlanIds(currentUserId, !inPlanChat);
  const dentro = data.miembros.some((m) => m.id === currentUserId) || Boolean(misPlanes?.has(data.plan_id));
  const sinCopia = inPlanChat && data.copiados === 0;
  const ve = useVeChat(data.origen_chat_id, sinCopia);
  const titulo = inPlanChat
    ? `${quien} ${yo ? "creaste" : "creó"} el plan${otros.length ? ` con ${listaY(otros)}` : ""}`
    : `${quien} ${yo ? "creaste" : "creó"} «${data.titulo}» con esta conversación`;

  const pedir = async () => {
    setPedido("enviando");
    try {
      const r = await pedirUnirmeEndpoint(data.plan_id, chatId);
      if (r === "ya_miembro") { router.push(`/plans/${data.plan_id}`); return; }
      setPedido("enviado");
    } catch (e) {
      console.error("[chat] pedir unirme:", errText(e));
      setPedido("error");
    }
  };

  const back = ve !== true ? null : onOpenChat ? (
    <button type="button" onClick={() => onOpenChat(data.origen_chat_id)} className="mt-[6px] inline-flex min-h-[44px] items-center gap-[6px] text-[14px] font-[var(--fw-semibold)] text-primary-token">
      Ir al chat original<span aria-hidden>→</span>
    </button>
  ) : (
    <Link href={`/messages?chat=${data.origen_chat_id}`} className="mt-[6px] inline-flex min-h-[44px] items-center gap-[6px] text-[14px] font-[var(--fw-semibold)] text-primary-token">
      Ir al chat original<span aria-hidden>→</span>
    </Link>
  );

  return (
    <>
      <div role="note" className="relative mx-[12px] mt-[14px] rounded-[8px] border border-app bg-[var(--surface)] py-[14px] pl-[44px] pr-[16px]">
        <span aria-hidden className="absolute left-[16px] top-[18px] size-[13px] rotate-45 rounded-[2px] bg-[var(--primary)]" />
        <p className="text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-[var(--chat-accent-text)]">Plan creado</p>
        <p className="mt-[4px] text-[16px] font-[var(--fw-semibold)] leading-[1.35] text-app">{titulo}</p>
        <p className="mt-[2px] text-[12px] leading-[1.45] text-muted">
          {sinCopia
            ? `A partir de «${data.origen_nombre}», sin copiar la conversación.`
            : `${fmtRange(data.inicio_at, data.fin_at)}${inPlanChat ? "" : ` · ${gente}`}`}
        </p>
        {sinCopia ? back : !inPlanChat && (dentro ? (
          <Link href={`/plans/${data.plan_id}`} className="mt-[6px] inline-flex min-h-[44px] items-center gap-[6px] text-[14px] font-[var(--fw-semibold)] text-primary-token">
            Abrir el plan<span aria-hidden>→</span>
          </Link>
        ) : (
          <div className="mt-[6px] flex min-h-[44px] items-center gap-[10px]">
            {pedido === "enviado" ? (
              <span role="status" className="text-[14px] text-muted">Solicitud enviada. Te avisaremos.</span>
            ) : (
              <button type="button" disabled={pedido === "enviando"} onClick={() => void pedir()}
                className="inline-flex min-h-[44px] items-center gap-[6px] text-[14px] font-[var(--fw-semibold)] text-primary-token disabled:opacity-50">
                {pedido === "enviando" ? "Enviando…" : "Pedir unirme"}
              </button>
            )}
            {pedido === "error" && <span role="alert" className="text-[12px] text-[var(--chat-missed)]">No se pudo enviar. Inténtalo otra vez.</span>}
          </div>
        ))}
      </div>
    </>
  );
}
