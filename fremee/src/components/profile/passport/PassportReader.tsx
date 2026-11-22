"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, List, MoreHorizontal } from "lucide-react";
import { FOCUS } from "@/components/plans/home/pieces";
import { playClose, prefersReducedMotion } from "@/lib/passportOpen";
import { buildPages, groupTrips, type PasaporteAjustes, type Sello } from "@/lib/passport";
import { ocultarSello } from "@/services/api/endpoints/pasaporte.endpoint";
import PassportIndex, { type Tab as IndexTab } from "./PassportIndex";
import PassportPrivacySheet from "./PassportPrivacySheet";
import StampPopover from "./StampPopover";
import Libreta, { type LibretaIntro } from "./Libreta";

/**
 * El pasaporte abierto, como capa a pantalla completa. Desde el perfil se monta encima de él (así la tapa puede volar
 * desde su sitio); con un enlace directo no hay tapa de origen y solo hay un fundido corto.
 */
export default function PassportReader({
  nombre,
  sellos: sellosIniciales,
  ajustes: ajustesIniciales = null,
  userId,
  onAjustesChange,
  readOnly = false,
  title = "Pasaporte",
  fromCover = null,
  profile = null,
  closing = false,
  startPage,
  onRequestClose,
  onClosed,
}: {
  nombre: string;
  sellos: Sello[];
  /** Quién ve tu pasaporte (los lee el perfil junto con los sellos). */
  ajustes?: PasaporteAjustes | null;
  userId?: string;
  onAjustesChange?: (a: PasaporteAjustes) => void;
  /** El pasaporte de otra persona: sin ajustes, sin ocultos y sin acciones sobre los sellos. */
  readOnly?: boolean;
  title?: string;
  /** La tapa pequeña del perfil desde la que se abre; sin ella no hay vuelo. */
  fromCover?: HTMLElement | null;
  /** Capa del perfil que se funde al abrir y vuelve al cerrar. */
  profile?: HTMLElement | null;
  closing?: boolean;
  /** Página (desde 1) por la que se abre el libro. */
  startPage?: number;
  onRequestClose: () => void;
  onClosed?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  // Ocultar un sello o decir «no fui» cambia el pasaporte al momento, sin volver a leerlo.
  const [sellos, setSellos] = useState(sellosIniciales);
  const [sheet, setSheet] = useState<{ sello: Sello; el: HTMLElement } | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [indexTab, setIndexTab] = useState<IndexTab>("paises");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  // «Ver tu pasaporte como lo ven los demás»: el pasaporte tal como lo ven los demás (sin ocultos y, si lo quitaste, sin sellos de plan).
  const [preview, setPreview] = useState(false);
  const [ajustes, setAjustes] = useState(ajustesIniciales);
  const [jump, setJump] = useState<{ page: number; nonce: number } | null>(null);
  const pages = useMemo(() => buildPages(groupTrips(sellos)), [sellos]);
  const hasStamps = sellos.some((s) => !s.hidden);
  const flight = Boolean(fromCover) && !reduced;

  const intro = useMemo<LibretaIntro | undefined>(
    () => (flight && fromCover ? { fromCover, profile, deskRef, chromeRefs: [titleRef] } : undefined),
    [flight, fromCover, profile],
  );

  // Sin vuelo (enlace directo o movimiento reducido): el lector aparece con un fundido de 160 ms.
  useLayoutEffect(() => {
    if (flight) return;
    rootRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "linear" });
  }, [flight]);

  useEffect(() => {
    if (!closing || !rootRef.current) return;
    void playClose(rootRef.current, profile).then(() => onClosed?.());
  }, [closing, profile, onClosed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc cierra primero el índice y luego el pasaporte.
      // La hoja de privacidad es un portal propio: su Esc lo gestiona ella.
      if (privacyOpen) setPrivacyOpen(false);
      else if (sheet) setSheet(null);
      else if (indexOpen) setIndexOpen(false);
      else onRequestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRequestClose, indexOpen, sheet, privacyOpen]);

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Pasaporte" className="fixed inset-0 z-[70] overflow-y-auto text-app">
      <div ref={deskRef} aria-hidden="true" className="fixed inset-0 bg-[var(--passport-table)]" />
      <div className="relative px-safe pb-8 pt-mobile-safe-top md:px-8 md:py-[var(--space-8)]">
        <div ref={titleRef} className="mx-auto flex w-full max-w-[460px] items-center gap-1 pb-2 md:max-w-[1080px]">
          <button type="button" onClick={onRequestClose} aria-label="Volver al perfil" className={`inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
            <ChevronLeft className="size-[22px]" aria-hidden />
          </button>
          <h1 className="m-0 flex-1 font-sans text-[18px] font-[var(--fw-semibold)] leading-[1.3]">{title}</h1>
          {hasStamps && (
            <button type="button" onClick={() => { setIndexTab("paises"); setIndexOpen(true); }} aria-label="Índice del pasaporte" className={`inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
              <List className="size-[22px]" aria-hidden />
            </button>
          )}
          {!readOnly && (
          <button type="button" onClick={() => setPrivacyOpen(true)} aria-label="Más opciones" className={`inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
            <MoreHorizontal className="size-[22px]" aria-hidden />
          </button>
          )}
        </div>
        {preview ? (
          <>
            <div role="status" className="mx-auto mb-3 flex w-full max-w-[460px] items-center gap-3 rounded-[8px] border border-app bg-surface px-3 py-2 md:max-w-[1080px]">
              <span className="flex-1 text-[14px] leading-[1.5]">{ajustes?.passport_visibility === "TODOS" ? "Así ve tu pasaporte cualquiera en Frimee." : "Así ven tu pasaporte tus amistades."}</span>
              <button
                type="button"
                onClick={() => {
                  // Mirar, cambiar algo y volver a mirar: se vuelve al diálogo de privacidad, no al lector.
                  setPreview(false);
                  setPrivacyOpen(true);
                }}
                className={`min-h-11 px-2 text-[14px] font-[var(--fw-semibold)] text-[var(--primary)] ${FOCUS}`}>
                Salir de la vista previa
              </button>
            </div>
            <Libreta key="preview" nombre={nombre} sellos={sellos.filter((x) => !x.hidden && ((ajustes?.show_plan_stamps ?? true) || x.kind === "pais"))} />
          </>
        ) : (
          <Libreta nombre={nombre} sellos={sellos} intro={intro} jumpTo={jump} startPage={startPage} onOpenStamp={readOnly ? undefined : (sello, el) => setSheet({ sello, el })} />
        )}
        {privacyOpen && (
          <PassportPrivacySheet
            ajustes={ajustes}
            hiddenCount={sellos.filter((x) => x.hidden && x.kind === "plan").length}
            shareUrl={userId && typeof window !== "undefined" ? `${window.location.origin}/profile/${userId}` : undefined}
            onChange={(a) => {
              setAjustes(a);
              onAjustesChange?.(a);
            }}
            onOpenHidden={() => {
              setPrivacyOpen(false);
              setIndexTab("ocultos");
              setIndexOpen(true);
            }}
            onPreview={() => {
              setPrivacyOpen(false);
              setSheet(null);
              setPreview(true);
            }}
            onClose={() => setPrivacyOpen(false)}
          />
        )}
        {indexOpen && (
          <PassportIndex
            initialTab={indexTab}
            sellos={sellos}
            pages={pages}
            onClose={() => setIndexOpen(false)}
            onRestore={readOnly ? undefined : async (s) => {
              await Promise.all(sellos.filter((x) => x.plan_id === s.plan_id && x.hidden).map((x) => ocultarSello(x.id, false)));
              setSellos((all) => all.map((x) => (x.plan_id === s.plan_id ? { ...x, hidden: false } : x)));
            }}
            onPick={(page) => {
              setIndexOpen(false);
              setJump((j) => ({ page, nonce: (j?.nonce ?? 0) + 1 }));
            }}
          />
        )}
        {sheet && (
          <StampPopover
            sello={sheet.sello}
            anchor={sheet.el}
            sellos={sellos}
            onClose={() => setSheet(null)}
            // Ocultar un sello oculta su viaje entero: plan, países y hitos.
            onHide={async (planId) => {
              await Promise.all(sellos.filter((x) => x.plan_id === planId && !x.hidden).map((x) => ocultarSello(x.id, true)));
            }}
            onHidden={(planId) => {
              setSellos((all) => all.map((x) => (x.plan_id === planId ? { ...x, hidden: true } : x)));
              setSheet(null);
            }}
            onNoFui={(planId) => {
              setSellos((all) => all.filter((x) => x.plan_id !== planId));
              setSheet(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
