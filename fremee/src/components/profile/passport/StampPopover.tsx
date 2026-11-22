"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { EyeOff, Images, MapPin, X } from "lucide-react";
import { FOCUS, GHOST_BTN } from "@/components/plans/home/pieces";
import { countryName, countryOrdinal, dateLabel, planRangeLabel, type Sello } from "@/lib/passport";
import { marcarNoFui } from "@/services/api/endpoints/pasaporte.endpoint";
import { HITO_NAME, noFuiQuita } from "./stamps";

/**
 * Ventana de un sello (plan, país o hito), tablero «Sello abierto».
 * Escritorio (≥ 768 px): ventanita junto al sello pulsado. Móvil: hoja inferior con velo.
 * Se cierra con la X, Esc o pulsando fuera; el foco va al primer botón y vuelve al sello al cerrar.
 * Solo en tu propio pasaporte.
 */

const planPath = (id: number) => (Capacitor.isNativePlatform() ? `/plans/static?id=${id}` : `/plans/${id}`);
const albumPath = (id: number) => (Capacitor.isNativePlatform() ? `/plans/static/album?id=${id}` : `/plans/${id}/album`);

const GAP = 12; // separación entre sello y ventana
const MARGIN = 16; // margen mínimo con el borde de la pantalla

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

/** Derecha del sello si cabe; si no, izquierda; si no, debajo. Siempre dentro de la pantalla. */
function place(anchor: DOMRect, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchor.right + GAP;
  let top = anchor.top + anchor.height / 2 - h / 2;
  if (left + w > vw - MARGIN) left = anchor.left - GAP - w;
  if (left < MARGIN) {
    left = anchor.left + anchor.width / 2 - w / 2;
    top = anchor.bottom + GAP;
  }
  left = Math.min(Math.max(left, MARGIN), vw - w - MARGIN);
  top = Math.min(Math.max(top, MARGIN), vh - h - MARGIN);
  return { left, top };
}

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
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Colocar (solo escritorio) antes de pintar, para que no salte.
  useLayoutEffect(() => {
    if (!isDesktop || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos(place(anchor.getBoundingClientRect(), r.width, r.height));
  }, [isDesktop, anchor, sello, confirming]);
  useEffect(() => {
    if (!isDesktop) return;
    const on = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      setPos(place(anchor.getBoundingClientRect(), r.width, r.height));
    };
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [isDesktop, anchor]);

  // Animación: 160 ms en escritorio, 240 ms la hoja en móvil; con movimiento reducido, solo opacidad.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const frames: Keyframe[] = reduced ? [{ opacity: 0 }, { opacity: 1 }] : isDesktop ? [{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }] : [{ transform: "translateY(100%)" }, { transform: "none" }];
    el.animate(frames, { duration: reduced ? 160 : isDesktop ? 160 : 240, easing: reduced ? "linear" : "cubic-bezier(0.2, 0, 0, 1)" });
  }, [isDesktop, reduced]);

  // Foco al primer botón; al cerrar, de vuelta al sello.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
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
  const btn = `${GHOST_BTN} bg-surface-2 !h-11 !px-3 !text-[14px] leading-[1.2]`;

  let title: string;
  let sub: string;
  let body: React.ReactNode;

  if (sello.kind === "plan") {
    const pais = sellos.find((s) => s.plan_id === sello.plan_id && s.kind === "pais" && s.country_code);
    const n = pais?.country_code ? countryOrdinal(sellos, pais.country_code, pais.id) : 0;
    title = plan?.titulo ?? "Viaje";
    sub = [plan ? planRangeLabel(plan).toLowerCase() : dateLabel(sello.stamped_at), n > 1 && pais?.country_code ? `${n}.º sello de ${countryName(pais.country_code)}` : null].filter(Boolean).join(" · ");
    body = confirming ? (
      <div role="alertdialog" aria-label="Confirmar «No fui a este viaje»" className="flex flex-col gap-3 rounded-[8px] border border-app p-3">
        <p className="m-0 text-[14px] leading-[1.5]">
          ¿Quitar «{plan?.titulo ?? "este viaje"}» de tu pasaporte? Se quitarán {noFuiQuita(sellos, sello.plan_id)}. Puedes volver a añadirlo desde el plan.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={`${GHOST_BTN} !h-11 !text-[14px]`}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => marcarNoFui(sello.plan_id), () => onNoFui(sello.plan_id))}
            className={`inline-flex h-11 items-center justify-center rounded-[8px] bg-[var(--error)] px-4 text-[14px] font-[var(--fw-semibold)] text-[var(--error-contrast)] disabled:opacity-[var(--disabled-opacity)] ${FOCUS}`}
          >
            Quitar
          </button>
        </div>
      </div>
    ) : (
      <>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={btn} onClick={() => router.push(planPath(sello.plan_id))}>
            <MapPin className="size-[18px] shrink-0" strokeWidth={2} aria-hidden /> Ver el plan
          </button>
          <button type="button" className={btn} onClick={() => router.push(albumPath(sello.plan_id))}>
            <Images className="size-[18px] shrink-0" strokeWidth={2} aria-hidden /> Ver el álbum
          </button>
        </div>
        {/* «Ocultar» (reversible) a la izquierda; «No fui» (quita sellos) a la derecha y en rojo. */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => onHide(sello.plan_id), () => onHidden(sello.plan_id))}
            className={`inline-flex h-11 items-center gap-2 rounded-[8px] px-1 text-[14px] font-[var(--fw-semibold)] leading-[1.2] text-muted hover:text-app ${FOCUS}`}
          >
            <EyeOff className="size-[18px] shrink-0" strokeWidth={2} aria-hidden /> Ocultar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            className={`inline-flex h-11 items-center rounded-[8px] px-1 text-[14px] font-[var(--fw-semibold)] leading-[1.2] text-[var(--error)] ${FOCUS}`}
          >
            No fui a este viaje
          </button>
        </div>
      </>
    );
  } else if (sello.kind === "pais") {
    const code = sello.country_code ?? "";
    const delPais = sellos.filter((s) => !s.hidden && s.kind === "pais" && s.country_code === code).sort((a, b) => (a.stamped_at < b.stamped_at ? 1 : a.stamped_at > b.stamped_at ? -1 : b.id - a.id));
    title = countryName(code);
    sub = `${delPais.length} ${delPais.length === 1 ? "sello" : "sellos"}`;
    // Un país no se oculta: se ocultan los viajes.
    body = (
      <ul className="m-0 flex list-none flex-col p-0">
        {delPais.map((s) => (
          <li key={s.id} className="border-t border-app">
            <button type="button" onClick={() => router.push(planPath(s.plan_id))} className={`flex min-h-14 w-full flex-col justify-center rounded-[8px] py-2 text-left text-app ${FOCUS}`}>
              <span className="text-[16px] font-[var(--fw-semibold)]">{s.plan?.titulo ?? "Viaje"}</span>
              <span className="text-[14px] tabular-nums text-muted">{s.plan ? planRangeLabel(s.plan).toLowerCase() : dateLabel(s.stamped_at)}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  } else {
    title = HITO_NAME[sello.hito!];
    sub = `${plan?.titulo ? `Lo conseguiste con ${plan.titulo}` : "Hito del pasaporte"} · ${dateLabel(sello.stamped_at)}`;
    // Los hitos se ocultan junto con su viaje, no por separado.
    body = (
      <button type="button" className={btn} onClick={() => router.push(planPath(sello.plan_id))}>
        <MapPin className="size-[18px] shrink-0" strokeWidth={2} aria-hidden /> Ver el plan
      </button>
    );
  }

  const content = (
    <>
      <div className="pr-10">
        <h2 id={titleId} className="m-0 text-[16px] font-[var(--fw-semibold)] leading-snug text-app">
          {title}
        </h2>
        <p className="m-0 text-[14px] leading-[1.5] tabular-nums text-muted">{sub}</p>
      </div>
      {body}
      {error && (
        <p role="alert" className="m-0 text-[14px] leading-[1.5] text-[var(--error)]">
          {error}
        </p>
      )}
    </>
  );
  const closeBtn = (
    <button type="button" aria-label="Cerrar" onClick={onClose} className={`absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
      <X className="size-[22px]" aria-hidden />
    </button>
  );

  return createPortal(
    isDesktop ? (
      <div
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        style={{ position: "fixed", left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
        className="relative z-[80] flex w-[320px] flex-col gap-3 rounded-[8px] border border-app bg-surface p-4 text-app shadow-[0_4px_12px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.2)]"
      >
        {closeBtn}
        {content}
      </div>
    ) : (
      <>
        {/* Velo: color sólido, sin desenfoque. */}
        <div aria-hidden="true" className="fixed inset-0 z-[79] bg-black/60" onClick={onClose} />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-x-0 bottom-0 z-[80] mx-auto flex max-h-dvh w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-t-[8px] border-t border-app bg-surface px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 text-app shadow-[0_12px_24px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)]"
        >
          <div className="relative flex h-7 shrink-0 justify-center">
            <span aria-hidden="true" className="mt-1 h-1 w-9 rounded-full bg-[var(--border-strong)]" />
            {closeBtn}
          </div>
          {content}
        </div>
      </>
    ),
    document.body,
  );
}
