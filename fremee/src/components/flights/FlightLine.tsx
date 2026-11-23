"use client";
/**
 * Frimee · Vuelos de amistades (tablero «Vuelos»).
 *
 *  - <FlightLine>   línea fija arriba del chat 1 a 1 (plegada 56 px / desplegada ~206 px)
 *  - <FlightCard>   la misma pieza, siempre desplegada, para el perfil de tu amistad
 *  - <FlightBadge>  avión pequeño en el avatar de la lista de chats
 *
 * El avión recorre un arco con `offset-path` y la nariz sigue la curva. Nada se mueve en bucle salvo el
 * punto de «En directo». Los colores salen de las variables --fl-* (styles/components/flight-line.css).
 */

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp, Plane, PlaneLanding, PlaneTakeoff, X } from "lucide-react";
import { PLANE_PATH } from "@/components/flights/plane-path";
import {
  duration, flightProgress, flightStateAt, hhmm, useNow,
  type FlightState, type FriendFlight,
} from "@/components/flights/flight-data";

const SERIF = "[font-family:var(--font-display-face)] font-normal";
const EASE = "cubic-bezier(0.2,0,0,1)";

/* ---------------- preferencias del navegador ---------------- */

const noop = () => () => {};

function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function useOffsetPathSupport() {
  return useSyncExternalStore(noop, () => typeof CSS !== "undefined" && !!CSS.supports?.("offset-path", 'path("M0 0 L1 1")'), () => true);
}

/* ---------------- avión ---------------- */

/** viewBox recortado al dibujo para que el centro del avión caiga en la ruta. */
function PlaneSvg({ size = 34, outline = false }: { size?: number; outline?: boolean }) {
  return (
    <svg viewBox="20 30 480 145" width={size} height={size * (145 / 480)} aria-hidden="true" className="block">
      <path d={PLANE_PATH} fill={outline ? "none" : "var(--fl-tx)"} stroke={outline ? "var(--fl-tx)" : "none"} strokeWidth={outline ? 10 : 0} />
    </svg>
  );
}

const ARC_H = 64;
const PLANE_W = 34;

function arcPath(w: number, h = ARC_H) {
  // De punto a anillo, 10 px de margen; la curva sube por encima del alto del bloque.
  return `M 10 ${h - 10} Q ${Math.round(w / 2)} ${Math.round(-h * 0.35)} ${w - 10} ${h - 10}`;
}

/**
 * Al desplegar, el avión sale del origen y llega a su sitio en 1600 ms; cada actualización avanza en 1200 ms.
 * Con movimiento reducido aparece ya en su sitio.
 */
function FlightArc({ progress, estimated, active }: { progress: number; estimated: boolean; active: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  const [shown, setShown] = useState(0); // progreso pintado (0..1)
  const [settled, setSettled] = useState(false);
  const reduced = useReducedMotion();
  const offsetOk = useOffsetPathSupport();

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setTrackW(Math.round(e[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 0 → progreso en el siguiente frame, para que haya transición. Plegada: vuelve a 0 y al desplegar sale otra vez del origen.
  useEffect(() => {
    if (!trackW) return;
    const id = requestAnimationFrame(() => {
      setShown(active ? progress : 0);
      if (!active) setSettled(false);
    });
    const t = active ? setTimeout(() => setSettled(true), 1700) : null;
    return () => { cancelAnimationFrame(id); if (t) clearTimeout(t); };
  }, [progress, trackW, active]);

  const d = trackW ? arcPath(trackW) : "";
  const pct = Math.round(shown * 1000) / 10;
  const dur = reduced || !active ? 0 : settled ? 1200 : 1600;
  const tr = dur ? `${dur}ms ${EASE}` : "none";

  return (
    <div ref={trackRef} className="relative w-full" style={{ height: ARC_H }} aria-hidden="true">
      {trackW > 0 && (
        <>
          <svg width={trackW} height={ARC_H} className="absolute inset-0 overflow-visible">
            {/* lo que falta: a puntos */}
            <path d={d} fill="none" stroke="var(--fl-tx2)" strokeWidth={1.5} strokeDasharray="1 7" strokeLinecap="round" opacity={0.7} />
            {/* lo hecho: continuo (pathLength=100 → mismo % que offset-distance) */}
            <path d={d} pathLength={100} fill="none" stroke="var(--fl-pr)" strokeWidth={2} strokeLinecap="round" opacity={estimated ? 0.6 : 1}
              style={{ strokeDasharray: `${pct} 100`, transition: dur ? `stroke-dasharray ${tr}` : undefined }} />
            {/* hitos: punto de origen, anillo de destino */}
            <circle cx={10} cy={ARC_H - 10} r={3.5} fill="var(--fl-pr)" />
            <circle cx={trackW - 10} cy={ARC_H - 10} r={5} fill="var(--fl-bg)" stroke="var(--fl-tx2)" strokeWidth={2} />
          </svg>
          {offsetOk && (
            <div className="absolute left-0 top-0"
              style={{
                offsetPath: `path('${d}')`,
                offsetDistance: `${pct}%`,
                offsetRotate: "auto",
                offsetAnchor: "50% 50%",
                transition: dur ? `offset-distance ${tr}` : undefined,
                willChange: "offset-distance",
              }}>
              <PlaneSvg size={PLANE_W} outline={estimated} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- textos por estado ---------------- */

type Copy = { Icon: typeof Plane; title: React.ReactNode; sub: string; mute?: boolean };

function copyFor(f: FriendFlight, state: FlightState, now: number, live: boolean): Copy {
  const route = <span className="font-medium text-[var(--fl-tx2)]"> · {f.from.iata} → {f.to.iata}</span>;
  const local = f.to.tz !== f.from.tz ? " hora local" : "";
  switch (state) {
    case "scheduled":
      return { Icon: PlaneTakeoff, mute: true, title: <>{f.friendName} vuela pronto{route}</>,
        sub: `Sale a las ${hhmm(f.depAt, f.from.tz)} · dentro de ${duration(new Date(f.depAt).getTime() - now)}` };
    case "airborne":
      return { Icon: Plane, title: <>{f.friendName} está volando{route}</>,
        sub: live
          ? `Quedan ${duration(new Date(f.arrAt).getTime() - now)} · llega ${hhmm(f.arrAt, f.to.tz)}${local}`
          : `Estimado · llega sobre las ${hhmm(f.arrAt, f.to.tz)}` };
    case "landed":
      return { Icon: PlaneLanding, title: <>{f.friendName} ya está en {f.to.city}</>,
        sub: `Aterrizó a las ${hhmm(f.arrAt, f.to.tz)}${local}` };
  }
}

/** «(6 h menos)» de diferencia horaria del destino respecto a ti. */
function tzDiffLabel(tz: string, now: number) {
  const wall = (zone?: string) => new Date(new Date(now).toLocaleString("en-US", { timeZone: zone })).getTime();
  const diffH = Math.round((wall(tz) - wall(undefined)) / 3600000);
  if (diffH === 0) return null;
  return diffH > 0 ? `${diffH} h más` : `${-diffH} h menos`;
}

function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  return m < 1 ? "Actualizado ahora" : `Actualizado hace ${m} min`;
}

/* ---------------- cuerpo desplegado ---------------- */

function FlightBody({ flight: f, p, live, now, active = true, aligned = false }: {
  flight: FriendFlight; p: number; live: boolean; now: number; active?: boolean;
  /** En el chat: el contenido empieza donde empiezan los mensajes (56 px) y acaba donde acaban las burbujas. */
  aligned?: boolean;
}) {
  const diff = f.to.tz !== f.from.tz ? tzDiffLabel(f.to.tz, now) : null;
  return (
    <div className={`${aligned ? "pl-[56px] pr-4" : "px-4"} pb-4 pt-1`}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className={`${SERIF} text-[28px] leading-[30px] tabular-nums text-[var(--fl-tx)]`}>{f.from.iata}</div>
          <div className="text-[12px] text-[var(--fl-tx2)]">{f.from.city}</div>
          <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--fl-tx)]">{hhmm(f.depAt, f.from.tz)}</div>
        </div>
        <div className="whitespace-nowrap pb-0.5 text-center text-[12px] text-[var(--fl-tx2)]">
          {f.flightNumber ? `${f.flightNumber} · ` : ""}{live ? "en directo" : "estimado"}
        </div>
        <div className="text-right">
          <div className={`${SERIF} text-[28px] leading-[30px] tabular-nums text-[var(--fl-tx)]`}>{f.to.iata}</div>
          <div className="text-[12px] text-[var(--fl-tx2)]">{f.to.city}</div>
          <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--fl-tx)]">
            {hhmm(f.arrAt, f.to.tz)}
            {diff && <span className="text-[12px] font-normal text-[var(--fl-tx2)]" title={`Hora de ${f.to.city} (${diff})`}> hora local</span>}
          </div>
        </div>
      </div>

      <div className="mt-1">
        <FlightArc progress={p} estimated={!live} active={active} />
      </div>

      {live && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--fl-bd)] px-2.5 text-[12px] font-semibold text-[var(--fl-tx)]">
            <span className="fl-live size-[7px] rounded-full bg-[var(--fl-pr)]" aria-hidden="true" />En directo
          </span>
          <span className="text-[12px] text-[var(--fl-tx2)]">{ago(f.updatedAt, now)}</span>
        </div>
      )}
    </div>
  );
}

/* ---------------- línea del chat ---------------- */

const openKey = (chatId: string, flightId: string) => `frimee:vuelo:${chatId}:${flightId}`;
const dismissKey = (flightId: string) => `frimee:vuelo-quitado:${flightId}`;

function readFlag(key: string) {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}
function writeFlag(key: string, on: boolean) {
  try { if (on) localStorage.setItem(key, "1"); else localStorage.removeItem(key); } catch { /* sin almacenamiento */ }
}

function IconBubble({ Icon, mute }: { Icon: typeof Plane; mute?: boolean }) {
  return (
    <span className={`flex size-8 flex-none items-center justify-center rounded-full border ${
      mute ? "border-[var(--fl-bd)] bg-[var(--fl-sf2)] text-[var(--fl-tx2)]" : "border-[var(--fl-meb)] bg-[var(--fl-tint)] text-[var(--fl-prtx)]"}`}>
      <Icon size={16} aria-hidden="true" />
    </span>
  );
}

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--fl-pr)] focus-visible:ring-inset";

export function FlightLine({ flight, chatId }: {  flight: FriendFlight;  /** Para recordar si estaba desplegada en este chat hasta que aterrice. */  chatId: string;}) {
  const now = useNow();
  const reduced = useReducedMotion();
  const bodyId = useId();
  const [open, setOpen] = useState(() => readFlag(openKey(chatId, flight.id)));
  const [dismissed, setDismissed] = useState(() => readFlag(dismissKey(flight.id)));

  const state = flightStateAt(flight, now);
  useEffect(() => {
    if (state === "landed") writeFlag(openKey(chatId, flight.id), false);
  }, [state, chatId, flight.id]);

  if (dismissed) return null;

  const toggle = () => {
    writeFlag(openKey(chatId, flight.id), !open);
    setOpen(!open);
  };

  const { p, live } = flightProgress(flight, now);
  const c = copyFor(flight, state, now, live);
  const canExpand = state === "airborne";

  const head = (
    <div className="flex min-h-14 items-center gap-[13px] pl-[11px] pr-1">
      <IconBubble Icon={c.Icon} mute={c.mute} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[14px] font-semibold text-[var(--fl-tx)]">{c.title}</span>
        <span className="mt-px block truncate text-[12px] tabular-nums text-[var(--fl-tx2)]">{c.sub}</span>
      </span>
      {state === "landed" ? (
        <button type="button" aria-label="Quitar el aviso del vuelo"
          onClick={() => { writeFlag(dismissKey(flight.id), true); setDismissed(true); }}
          className={`flex size-11 flex-none items-center justify-center rounded-lg text-[var(--fl-tx2)] ${FOCUS_RING}`}>
          <X size={18} aria-hidden="true" />
        </button>
      ) : canExpand ? (
        <span className="flex size-11 flex-none items-center justify-center text-[var(--fl-tx2)]" aria-hidden="true">
          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      ) : null}
    </div>
  );

  return (
    <section aria-label={`Vuelo de ${flight.friendName}`} className="flex-none border-b border-[var(--fl-bd)] bg-[var(--fl-bg)]">
      {/* Misma columna que los mensajes de la Bitácora: el icono cae sobre su línea vertical (27 px) y el texto empieza en 56 px. */}
      <div className="mx-auto w-full max-w-[780px]">
        {canExpand ? (
          <button type="button" onClick={toggle} aria-expanded={open} aria-controls={bodyId} className={`relative block w-full ${FOCUS_RING}`}>
            <span className="sr-only">{open ? "Ocultar el vuelo" : "Ver el vuelo"}</span>
            {head}
            {!open && <ProgressBar p={p} estimated={!live} reduced={reduced} />}
          </button>
        ) : (
          <div className="relative">{head}</div>
        )}

        {/* Desplegar con grid 0fr → 1fr: anima la altura sin medirla. Siempre montado para que también se anime al plegar. */}
        {canExpand && (
          <div id={bodyId} className="grid" style={{ gridTemplateRows: open ? "1fr" : "0fr", transition: reduced ? undefined : `grid-template-rows 240ms ${EASE}` }}>
            <div className="min-h-0 overflow-hidden" aria-hidden={!open} inert={!open}>
              <FlightBody flight={flight} p={p} live={live} now={now} active={open} aligned />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ProgressBar({ p, estimated, reduced }: { p: number; estimated: boolean; reduced: boolean }) {
  return (
    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--fl-bd)]">
      <span className="absolute inset-y-0 left-0 origin-left"
        style={{
          width: "100%",
          transform: `scaleX(${p})`,
          transition: reduced ? undefined : `transform 1200ms ${EASE}`,
          background: estimated ? "repeating-linear-gradient(90deg,var(--fl-pr) 0 6px,transparent 6px 10px)" : "var(--fl-pr)",
        }} />
    </span>
  );
}

/* ---------------- perfil de tu amistad ---------------- */

/** Encima del pasaporte, solo mientras vuela. Siempre desplegada, sin chevron. */
export function FlightCard({ flight }: { flight: FriendFlight }) {
  const now = useNow();
  if (flightStateAt(flight, now) !== "airborne") return null;
  const { p, live } = flightProgress(flight, now);
  const c = copyFor(flight, "airborne", now, live);
  return (
    <section aria-label={`Vuelo de ${flight.friendName}`} className="overflow-hidden rounded-lg border border-[var(--fl-bd)] bg-[var(--fl-bg)]">
      <div className="flex min-h-14 items-center gap-3 px-4">
        <IconBubble Icon={c.Icon} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-[var(--fl-tx)]">{c.title}</span>
          <span className="mt-px block truncate text-[12px] tabular-nums text-[var(--fl-tx2)]">{c.sub}</span>
        </span>
      </div>
      <FlightBody flight={flight} p={p} live={live} now={now} />
    </section>
  );
}

/* ---------------- insignia del avatar (lista) ---------------- */

/** Envuelve el avatar: <span className="relative">{avatar}<FlightBadge state="airborne" /></span> */
export function FlightBadge({ state }: { state: FlightState }) {
  if (state === "landed") return null;
  const air = state === "airborne";
  return (
    <span aria-hidden="true"
      className={`absolute -bottom-[3px] -right-[3px] flex size-[22px] items-center justify-center rounded-full border-2 border-[var(--fl-bg)] ${
        air ? "bg-[var(--fl-fill)] text-[var(--fl-onfill)]"
            : "bg-[var(--fl-sf2)] text-[var(--fl-prtx)] shadow-[inset_0_0_0_1px_var(--fl-meb)]"}`}>
      {air ? <Plane size={12} /> : <PlaneTakeoff size={12} />}
    </span>
  );
}
