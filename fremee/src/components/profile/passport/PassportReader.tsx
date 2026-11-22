"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, List } from "lucide-react";
import { FOCUS } from "@/components/plans/home/pieces";
import { playClose, prefersReducedMotion } from "@/lib/passportOpen";
import { buildPages, groupTrips, type Sello } from "@/lib/passport";
import { ocultarSello } from "@/services/api/endpoints/pasaporte.endpoint";
import PassportIndex from "./PassportIndex";
import StampSheet from "./StampSheet";
import Libreta, { type LibretaIntro } from "./Libreta";

/**
 * El pasaporte abierto, como capa a pantalla completa. Desde el perfil se monta encima de él (así la tapa puede volar
 * desde su sitio); con un enlace directo no hay tapa de origen y solo hay un fundido corto.
 */
export default function PassportReader({
  nombre,
  sellos: sellosIniciales,
  fromCover = null,
  profile = null,
  closing = false,
  onRequestClose,
  onClosed,
}: {
  nombre: string;
  sellos: Sello[];
  /** La tapa pequeña del perfil desde la que se abre; sin ella no hay vuelo. */
  fromCover?: HTMLElement | null;
  /** Capa del perfil que se funde al abrir y vuelve al cerrar. */
  profile?: HTMLElement | null;
  closing?: boolean;
  onRequestClose: () => void;
  onClosed?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  // Ocultar un sello o decir «no fui» cambia el pasaporte al momento, sin volver a leerlo.
  const [sellos, setSellos] = useState(sellosIniciales);
  const [sheet, setSheet] = useState<Sello | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
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
      if (sheet) setSheet(null);
      else if (indexOpen) setIndexOpen(false);
      else onRequestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRequestClose, indexOpen, sheet]);

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Pasaporte" className="fixed inset-0 z-[70] overflow-y-auto text-app">
      <div ref={deskRef} aria-hidden="true" className="fixed inset-0 bg-[var(--passport-table)]" />
      <div className="relative px-safe pb-8 pt-mobile-safe-top md:px-8 md:py-[var(--space-8)]">
        <div ref={titleRef} className="mx-auto flex w-full max-w-[460px] items-center gap-1 pb-2 md:max-w-[1080px]">
          <button type="button" onClick={onRequestClose} aria-label="Volver al perfil" className={`inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
            <ChevronLeft className="size-[22px]" aria-hidden />
          </button>
          <h1 className="m-0 flex-1 font-sans text-[18px] font-[var(--fw-semibold)] leading-[1.3]">Pasaporte</h1>
          {hasStamps && (
            <button type="button" onClick={() => setIndexOpen(true)} aria-label="Índice del pasaporte" className={`inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
              <List className="size-[22px]" aria-hidden />
            </button>
          )}
        </div>
        <Libreta nombre={nombre} sellos={sellos} intro={intro} jumpTo={jump} onOpenStamp={setSheet} />
        {indexOpen && (
          <PassportIndex
            sellos={sellos}
            pages={pages}
            onClose={() => setIndexOpen(false)}
            onRestore={async (s) => {
              await ocultarSello(s.id, false);
              setSellos((all) => all.map((x) => (x.id === s.id ? { ...x, hidden: false } : x)));
            }}
            onPick={(page) => {
              setIndexOpen(false);
              setJump((j) => ({ page, nonce: (j?.nonce ?? 0) + 1 }));
            }}
          />
        )}
        {sheet && (
          <StampSheet
            sello={sheet}
            sellos={sellos}
            onClose={() => setSheet(null)}
            onHidden={(s) => {
              setSellos((all) => all.map((x) => (x.id === s.id ? { ...x, hidden: true } : x)));
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
