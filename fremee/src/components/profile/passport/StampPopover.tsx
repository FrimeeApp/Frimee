"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { CircleX, EyeOff, Images, MapPin, Upload, X } from "lucide-react";
import { countryName, countryOrdinal, dateLabel, gentePhrase, planRangeLabel, type Sello } from "@/lib/passport";
import { marcarNoFui } from "@/services/api/endpoints/pasaporte.endpoint";
import { BOOK, PAPER_VARS, PaperGuilloche } from "./Libreta";
import { CountryStamp, HITO_NAME, HitoStamp, PlanStamp, noFuiQuita } from "./stamps";

/**
 * Ficha de un sello (plan, país o hito), con el aspecto de una hoja del pasaporte.
 * Escritorio (≥ 768 px): ficha de 344 px junto al sello pulsado, con un piquito que apunta a él.
 * Va a la derecha; si no cabe, a la izquierda; si tampoco, debajo. Siempre dentro de la pantalla.
 * Móvil: hoja inferior con velo sólido. Se cierra con la X, Esc o pulsando fuera; el foco entra en el
 * primer botón, se queda dentro y vuelve al sello al cerrar. Solo en tu propio pasaporte.
 */

const planPath = (id: number) => (Capacitor.isNativePlatform() ? `/plans/static?id=${id}` : `/plans/${id}`);
const albumPath = (id: number) => (Capacitor.isNativePlatform() ? `/plans/static/album?id=${id}` : `/plans/${id}/album`);

const CARD_W = 344;
const GAP = 14; // separación entre sello y ficha
const MARGIN = 12; // margen mínimo con el borde de la pantalla

const C = {
  ink: BOOK.text,
  soft: BOOK.label,
  edge: "#C3CCBF",
  leather: BOOK.cover,
  leatherText: "#F1F3EC",
  perforation: "#AEB8AA",
  mrzBg: "rgba(214,220,210,0.35)",
  mrzLine: "#D6DCD2",
  veil: "rgba(10,20,16,0.55)",
} as const;
const SERIF = "var(--font-display-face), Georgia, serif";
const MONO = '"IBM Plex Mono", "Courier New", monospace';
const FOCUS_PAPER = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c6a5d]";

function useMedia(query: string) {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return m;
}

type Placement = { left: number; top: number; side: "right" | "left" | "bottom"; arrow: number };
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Derecha del sello si cabe; si no, izquierda; si no, debajo. Siempre dentro de la pantalla. */
function place(anchor: DOMRect, h: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cy = anchor.top + anchor.height / 2;
  const clampTop = (t: number) => clamp(t, MARGIN, Math.max(MARGIN, vh - h - MARGIN));
  if (anchor.right + GAP + CARD_W <= vw - MARGIN) {
    const top = clampTop(cy - h / 2);
    return { side: "right", left: anchor.right + GAP, top, arrow: clamp(cy - top, 24, h - 24) };
  }
  if (anchor.left - GAP - CARD_W >= MARGIN) {
    const top = clampTop(cy - h / 2);
    return { side: "left", left: anchor.left - GAP - CARD_W, top, arrow: clamp(cy - top, 24, h - 24) };
  }
  const cx = anchor.left + anchor.width / 2;
  const left = clamp(cx - CARD_W / 2, MARGIN, vw - CARD_W - MARGIN);
  return { side: "bottom", left, top: clampTop(anchor.bottom + GAP), arrow: clamp(cx - left, 24, CARD_W - 24) };
}

const originFor = (p: Placement) => (p.side === "right" ? `0 ${p.arrow}px` : p.side === "left" ? `100% ${p.arrow}px` : `${p.arrow}px 0`);

/** Piquito que apunta al sello. */
function Arrow({ pos }: { pos: Placement }) {
  const edge = `1px solid ${C.edge}`;
  const base = { background: BOOK.paper } as const;
  const style =
    pos.side === "right"
      ? { ...base, left: -8, top: pos.arrow - 7, borderLeft: edge, borderBottom: edge }
      : pos.side === "left"
        ? { ...base, right: -8, top: pos.arrow - 7, borderRight: edge, borderTop: edge }
        : { ...base, top: -8, left: pos.arrow - 7, borderLeft: edge, borderTop: edge };
  return <span aria-hidden="true" className="pointer-events-none absolute z-[1] h-3.5 w-3.5 rotate-45" style={style} />;
}

/** Texto de la zona de lectura mecánica: mayúsculas, sin tildes, «<» de relleno. */
const mrz = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "<");
const yymmdd = (d: string) => d.replace(/-/g, "").slice(2, 8);
const pad40 = (t: string) => (t + "<".repeat(40)).slice(0, 40);

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-2" : ""}`}>
      <p className="m-0 text-[10px] font-semibold uppercase leading-[1.3] tracking-[0.1em]" style={{ color: C.soft }}>
        {label}
      </p>
      <p className="m-0 mt-0.5 text-[15px] leading-[1.35] tabular-nums" style={{ color: C.ink }}>
        {children}
      </p>
    </div>
  );
}

function LeatherButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold transition-colors hover:bg-[#13403a] active:bg-[#0a2420] ${FOCUS_PAPER}`}
      style={{ background: C.leather, color: C.leatherText, border: `1px solid ${C.leather}` }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-1 rounded-[5px] border border-dashed border-[rgba(241,243,236,0.38)]" />
      {icon}
      {children}
    </button>
  );
}

function OutlineButton({ onClick, icon, children }: { onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-transparent px-4 text-base font-semibold transition-colors hover:bg-[rgba(14,47,42,0.06)] ${FOCUS_PAPER}`}
      style={{ color: C.leather, border: `1px solid ${C.leather}` }}
    >
      {icon}
      {children}
    </button>
  );
}

function GhostButton({ onClick, icon, children, danger, disabled }: { onClick: () => void; icon?: React.ReactNode; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 text-sm font-semibold transition-colors hover:bg-[#ECF0E8] disabled:opacity-[var(--disabled-opacity)] ${FOCUS_PAPER}`}
      style={{ color: danger ? "var(--error)" : C.soft }}
    >
      {icon}
      {children}
    </button>
  );
}

const Perforation = () => <div aria-hidden="true" className="-mx-5 mt-4 h-0" style={{ borderTop: `2px dotted ${C.perforation}` }} />;

export default function StampPopover({
  sello,
  anchor,
  sellos,
  onClose,
  onHidden,
  onNoFui,
  onHide,
}: {
  sello: Sello;
  /** El sello pulsado: coloca la ventana y recupera el foco al cerrar. */
  anchor: HTMLElement;
  sellos: Sello[];
  onClose: () => void;
  /** Tras ocultar el viaje (todos sus sellos), para quitarlos de la libreta. */
  onHidden: (planId: number) => void;
  onNoFui: (planId: number) => void;
  /** Oculta todos los sellos de un viaje en el servidor. */
  onHide: (planId: number) => Promise<void>;
}) {
  const router = useRouter();
  const isDesktop = useMedia("(min-width: 768px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [pos, setPos] = useState<Placement | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Colocar (solo escritorio) antes de pintar, para que no salte.
  const replace = useCallback(() => {
    if (!ref.current) return;
    setPos(place(anchor.getBoundingClientRect(), ref.current.offsetHeight));
  }, [anchor]);
  useLayoutEffect(() => {
    if (isDesktop) replace();
  }, [isDesktop, replace, sello, confirming]);
  useEffect(() => {
    if (!isDesktop) return;
    window.addEventListener("resize", replace);
    return () => window.removeEventListener("resize", replace);
  }, [isDesktop, replace]);

  // Animación: 160 ms en escritorio, 240 ms la hoja en móvil; con movimiento reducido, solo opacidad.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const frames: Keyframe[] = reduced ? [{ opacity: 0 }, { opacity: 1 }] : isDesktop ? [{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }] : [{ transform: "translateY(100%)" }, { transform: "none" }];
    el.animate(frames, { duration: reduced ? 160 : isDesktop ? 160 : 240, easing: reduced ? "linear" : "cubic-bezier(0.2, 0, 0, 1)" });
  }, [isDesktop, reduced]);

  // Foco al primer control tras la X; al cerrar, de vuelta al sello.
  useEffect(() => {
    const all = ref.current?.querySelectorAll<HTMLElement>("button");
    (all?.[1] ?? all?.[0])?.focus();
    return () => anchor.focus();
  }, [anchor]);

  // Tab atrapado dentro y clic fuera (Esc lo gestiona el lector).
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !ref.current) return;
    const f = ref.current.querySelectorAll<HTMLElement>("button:not(:disabled)");
    if (!f.length) return;
    const a = f[0];
    const z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) {
      e.preventDefault();
      z.focus();
    } else if (!e.shiftKey && document.activeElement === z) {
      e.preventDefault();
      a.focus();
    }
  }, []);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && !anchor.contains(t)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", down);
    };
  }, [onKeyDown, onClose, anchor]);

  const run = async (fn: () => Promise<void>, after: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after();
    } catch (err) {
      console.error("[pasaporte] No se pudo completar la acción:", (err as { message?: string } | null)?.message ?? err);
      setError("No se pudo completar. Comprueba la conexión y vuelve a intentarlo.");
      setBusy(false);
    }
  };

  // ---- contenido según el tipo de sello
  const planSello = sello.kind === "plan" ? sello : sellos.find((s) => s.plan_id === sello.plan_id && s.kind === "plan") ?? null;
  const plan = sello.plan ?? planSello?.plan ?? null;
  const paisDelViaje = sellos.find((s) => s.plan_id === sello.plan_id && s.kind === "pais" && s.country_code) ?? null;
  const goPlan = () => router.push(planPath(sello.plan_id));

  let label: string;
  let title: string;
  let art: React.ReactNode;
  let fields: React.ReactNode;
  let body: React.ReactNode;
  let mrzA: string;
  let mrzB: string;
  const when = yymmdd(sello.stamped_at);

  if (sello.kind === "plan") {
    const cc = paisDelViaje?.country_code ?? "";
    const n = paisDelViaje?.country_code ? countryOrdinal(sellos, paisDelViaje.country_code, paisDelViaje.id) : 0;
    const gente = gentePhrase(sello.gente);
    label = "Viaje / Trip";
    title = plan?.titulo ?? "Viaje";
    art = <PlanStamp sello={sello} size={84} tilt={6} />;
    fields = (
      <>
        <Field label="Fechas / Dates" wide>
          {plan ? planRangeLabel(plan) : dateLabel(sello.stamped_at)}
        </Field>
        {cc && <Field label="País / Country">{countryName(cc)}</Field>}
        {sello.ruta && (
          <Field label="Ruta / Route">
            {sello.ruta.desde} → {sello.ruta.hasta}
          </Field>
        )}
        {n > 0 && cc && (
          <Field label="Sello / Stamp" wide>
            {n}.<sup className="text-[0.7em]">{n === 1 || n === 3 ? "er" : "º"}</sup> sello de {countryName(cc)}
          </Field>
        )}
        {gente && (
          <Field label="Con / With" wide>
            {gente.replace(/^Con /, "")}
          </Field>
        )}
      </>
    );
    body = confirming ? (
      <div role="alertdialog" aria-label="Confirmar «No fui a este viaje»" className="mt-4 flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: C.edge }}>
        <p className="m-0 text-[14px] leading-[1.5]">
          ¿Quitar «{plan?.titulo ?? "este viaje"}» de tu pasaporte? Se quitarán {noFuiQuita(sellos, sello.plan_id)}. Puedes volver a añadirlo desde el plan.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <OutlineButton onClick={() => setConfirming(false)}>Cancelar</OutlineButton>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => marcarNoFui(sello.plan_id), () => onNoFui(sello.plan_id))}
            className={`inline-flex h-[46px] items-center justify-center rounded-lg bg-[var(--error)] px-4 text-base font-semibold text-[var(--error-contrast)] disabled:opacity-[var(--disabled-opacity)] ${FOCUS_PAPER}`}
          >
            Quitar
          </button>
        </div>
      </div>
    ) : (
      <>
        <div className="mt-[18px] flex flex-col gap-2">
          <LeatherButton onClick={goPlan} icon={<MapPin className="size-5 shrink-0" strokeWidth={2} aria-hidden />}>
            Ver el plan
          </LeatherButton>
          {/* El recuento llega con el sello: ni comprobación aparte ni saltos. */}
          <OutlineButton
            onClick={() => router.push(albumPath(sello.plan_id))}
            icon={sello.fotos === 0 ? <Upload className="size-5 shrink-0" strokeWidth={2} aria-hidden /> : <Images className="size-5 shrink-0" strokeWidth={2} aria-hidden />}
          >
            {sello.fotos === 0 ? "Subir fotos al álbum" : `Ver el álbum${sello.fotos ? ` · ${sello.fotos}` : ""}`}
          </OutlineButton>
        </div>
        <Perforation />
        {/* «Ocultar» (reversible) a la izquierda; «No fui» (quita sellos) a la derecha y en rojo. */}
        <div className="-mx-2.5 flex items-center justify-between pt-0.5">
          <GhostButton disabled={busy} onClick={() => void run(() => onHide(sello.plan_id), () => onHidden(sello.plan_id))} icon={<EyeOff className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />}>
            Ocultar
          </GhostButton>
          <GhostButton danger disabled={busy} onClick={() => setConfirming(true)} icon={<CircleX className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />}>
            No fui a este viaje
          </GhostButton>
        </div>
      </>
    );
    mrzA = `V<${cc}${mrz(title)}<<${sello.ruta ? `${mrz(sello.ruta.desde)}<${mrz(sello.ruta.hasta)}` : ""}`;
    mrzB = `FRIMEE<<${when}`;
  } else if (sello.kind === "pais") {
    const code = sello.country_code ?? "";
    const delPais = sellos.filter((s) => !s.hidden && s.kind === "pais" && s.country_code === code).sort((a, b) => (a.stamped_at < b.stamped_at ? 1 : a.stamped_at > b.stamped_at ? -1 : b.id - a.id));
    label = "País / Country";
    title = countryName(code);
    art = <CountryStamp sello={sello} size={84} tilt={6} />;
    fields = (
      <>
        <Field label="Sellos / Stamps">{delPais.length}</Field>
        <Field label="Código / Code">{code}</Field>
      </>
    );
    // Un país no se oculta: se ocultan los viajes.
    body = (
      <>
        <Perforation />
        <p className="m-0 mt-3 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.soft }}>
          Viajes / Trips
        </p>
        <ul className="m-0 mt-1 flex list-none flex-col p-0 pb-2">
          {delPais.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => router.push(planPath(s.plan_id))}
                className={`-mx-2.5 flex min-h-11 w-[calc(100%+20px)] items-center justify-between gap-3 rounded-lg bg-transparent px-2.5 text-left transition-colors hover:bg-[#ECF0E8] ${FOCUS_PAPER}`}
                style={{ color: C.ink }}
              >
                <span className="truncate text-[15px]">{s.plan?.titulo ?? "Viaje"}</span>
                <span className="shrink-0 text-sm tabular-nums" style={{ color: C.soft }}>
                  {s.plan ? planRangeLabel(s.plan).toLowerCase() : dateLabel(s.stamped_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </>
    );
    mrzA = `V<${code}${mrz(title)}`;
    mrzB = `FRIMEE<<${String(delPais.length).padStart(2, "0")}<${when}`;
  } else {
    label = "Hito / Milestone";
    title = HITO_NAME[sello.hito!];
    art = <HitoStamp hito={sello.hito!} id={sello.id} size={76} tilt={6} />;
    fields = (
      <>
        {plan?.titulo && (
          <Field label="Viaje / Trip" wide>
            {plan.titulo}
          </Field>
        )}
        <Field label="Fecha / Date">{dateLabel(sello.stamped_at)}</Field>
      </>
    );
    // Los hitos se ocultan junto con su viaje, no por separado.
    body = (
      <div className="mt-[18px] pb-4">
        <LeatherButton onClick={goPlan} icon={<MapPin className="size-5 shrink-0" strokeWidth={2} aria-hidden />}>
          Ver el plan
        </LeatherButton>
      </div>
    );
    mrzA = `H<${mrz(title)}<<${mrz(plan?.titulo ?? "")}`;
    mrzB = `FRIMEE<<${when}`;
  }

  const closeBtn = (
    <button type="button" aria-label="Cerrar" onClick={onClose} className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 transition-colors hover:bg-[#ECF0E8] ${FOCUS_PAPER}`} style={{ color: C.ink }}>
      <X className="size-[22px]" aria-hidden />
    </button>
  );

  const card = (
    <div
      ref={ref}
      role="dialog"
      aria-modal={!isDesktop}
      aria-labelledby={titleId}
      className={
        isDesktop
          ? "fixed z-[1060] rounded-[4px] px-5 pt-4 text-left"
          : "fixed inset-x-0 bottom-0 z-[1060] mx-auto max-h-dvh w-full max-w-[460px] overflow-y-auto rounded-t-xl px-5 pt-2 text-left"
      }
      style={{
        ...PAPER_VARS,
        ...(isDesktop ? { width: CARD_W, left: pos?.left ?? -9999, top: pos?.top ?? -9999, transformOrigin: pos ? originFor(pos) : undefined } : {}),
        background: BOOK.paper,
        color: C.ink,
        border: `1px solid ${C.edge}`,
        boxShadow: isDesktop ? "0 1px 0 #d6dbd2, 0 2px 0 #e9ece4, 0 10px 22px rgba(10,20,16,0.26), 0 3px 6px rgba(10,20,16,0.14)" : "0 -8px 24px rgba(10,20,16,0.24)",
      }}
    >
      {isDesktop && pos && <Arrow pos={pos} />}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <PaperGuilloche w={isDesktop ? CARD_W : 460} h={420} seed={sello.id} soft />
      </span>
      <div className="relative z-[2]">
        {!isDesktop && <div aria-hidden="true" className="mx-auto mb-1 h-1 w-10 rounded-full" style={{ background: C.edge }} />}
        <div className="-mr-3 flex items-center justify-between">
          <p className="m-0 text-[11px] font-semibold leading-[1.4] tracking-[0.08em]" style={{ color: C.soft }}>
            {sello.kind === "hito" ? "HITO · MILESTONE" : "VISADO · VISA"}
          </p>
          {closeBtn}
        </div>
        <div aria-hidden="true" className="mb-3 mt-0.5 h-0" style={{ borderTop: `1px solid ${C.edge}` }} />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-semibold uppercase leading-[1.3] tracking-[0.1em]" style={{ color: C.soft }}>
              {label}
            </p>
            <h2 id={titleId} className="m-0 mt-0.5 text-[30px] font-normal leading-[1.1]" style={{ fontFamily: SERIF, color: C.ink }}>
              {title}
            </h2>
          </div>
          <span aria-hidden="true" className="-mr-1.5 -mt-1.5 shrink-0 leading-none opacity-[0.92]">
            {art}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5">{fields}</div>
        {body}
        {error && (
          <p role="alert" className="m-0 mt-3 text-[14px] leading-[1.5] text-[var(--error)]">
            {error}
          </p>
        )}
        <div
          aria-hidden="true"
          className="-mx-5 mt-1 overflow-hidden whitespace-pre rounded-b-[4px] px-5 pb-2.5 pt-2 text-[10.5px] font-medium leading-[1.5] tracking-[0.1em]"
          style={{ fontFamily: MONO, color: C.soft, background: C.mrzBg, borderTop: `1px solid ${C.mrzLine}` }}
        >
          {pad40(mrzA)}
          {"\n"}
          {pad40(mrzB)}
        </div>
        {!isDesktop && <div className="h-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>
  );

  return createPortal(
    isDesktop ? (
      card
    ) : (
      <>
        {/* Velo: color sólido, sin desenfoque. */}
        <div aria-hidden="true" className="fixed inset-0 z-[1059]" style={{ background: C.veil }} onClick={onClose} />
        {card}
      </>
    ),
    document.body,
  );
}
