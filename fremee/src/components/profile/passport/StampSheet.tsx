"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { FILL_BTN, FOCUS, GHOST_BTN, SERIF, TEXT_BTN } from "@/components/plans/home/pieces";
import { countryName, countryOrdinal, dateLabel, planDays, planRangeLabel, type Sello } from "@/lib/passport";
import { marcarNoFui, ocultarSello } from "@/services/api/endpoints/pasaporte.endpoint";
import { CountryStamp, HITO_NAME, HitoStamp, PlanStamp } from "./stamps";

/** Hoja del sello (tablero «Sello abierto»): el sello en grande, de qué viaje es y sus acciones. Solo para el dueño del pasaporte. */

const planPath = (id: number) => (Capacitor.isNativePlatform() ? `/plans/static?id=${id}` : `/plans/${id}`);
const albumPath = (id: number) => (Capacitor.isNativePlatform() ? `/plans/static/album?id=${id}` : `/plans/${id}/album`);

export default function StampSheet({
  sello,
  sellos,
  onClose,
  onHidden,
  onNoFui,
}: {
  sello: Sello;
  sellos: Sello[];
  onClose: () => void;
  onHidden: (s: Sello) => void;
  onNoFui: (planId: number) => void;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    panelRef.current?.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" });
  }, []);
  useEffect(() => closeRef.current?.focus(), []);

  // El plan del viaje: el sello de plan lo lleva; los de país y hito, el sello de plan hermano si lo hay.
  const planSello = sello.kind === "plan" ? sello : sellos.find((s) => s.plan_id === sello.plan_id && s.kind === "plan" && s.plan) ?? null;
  const plan = sello.plan ?? planSello?.plan ?? null;
  const titulo = sello.kind === "pais" ? countryName(sello.country_code ?? "") : sello.kind === "hito" ? HITO_NAME[sello.hito!] : plan?.titulo ?? "Viaje";

  // «21–25 NOV 2026 · 5 días · tu 2.º sello de Portugal»
  const countrySello = sello.kind === "pais" ? sello : sellos.find((s) => s.plan_id === sello.plan_id && s.kind === "pais") ?? null;
  const ordinal = countrySello?.country_code ? countryOrdinal(sellos, countrySello.country_code, countrySello.id) : 0;
  const parts = [
    plan ? planRangeLabel(plan) : dateLabel(sello.stamped_at),
    plan ? `${planDays(plan)} ${planDays(plan) === 1 ? "día" : "días"}` : null,
    ordinal > 0 && countrySello?.country_code ? `tu ${ordinal}.º sello de ${countryName(countrySello.country_code)}` : null,
  ].filter(Boolean);

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

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 md:items-center md:p-8" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-dvh w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-t-[16px] border border-app bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom))] text-app md:rounded-[8px]"
      >
        <div className="flex justify-end">
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className={`-mr-1 -mt-1 inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
            <X className="size-[22px]" aria-hidden />
          </button>
        </div>

        <div className="-mt-6 flex h-[200px] items-center justify-center rounded-[8px] bg-surface-2">
          {sello.kind === "plan" ? (
            <PlanStamp sello={sello} size={220} tilt={-4} />
          ) : sello.kind === "pais" ? (
            <CountryStamp sello={sello} size={168} tilt={6} />
          ) : (
            <HitoStamp hito={sello.hito!} id={sello.id} size={168} tilt={-3} />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h2 className={`m-0 text-[28px] leading-[1.15] ${SERIF}`}>{titulo}</h2>
          <p className="m-0 text-[14px] leading-[1.5] text-muted">{parts.join(" · ")}</p>
        </div>

        {confirming ? (
          <div role="alertdialog" aria-label="Confirmar «No fui a este viaje»" className="flex flex-col gap-3 rounded-[8px] border border-app p-3">
            <p className="m-0 text-[14px] leading-[1.5]">Se quitan todos tus sellos de «{plan?.titulo ?? "este viaje"}» y no se vuelven a poner solos.</p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={`${GHOST_BTN} flex-1`}>
                Cancelar
              </button>
              <button type="button" disabled={busy} onClick={() => void run(() => marcarNoFui(sello.plan_id), () => onNoFui(sello.plan_id))} className={`${FILL_BTN} flex-1`}>
                Quitar sellos
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => router.push(planPath(sello.plan_id))} className={`${FILL_BTN} w-full`}>
              Ver el plan
            </button>
            <button type="button" onClick={() => router.push(albumPath(sello.plan_id))} className={`${GHOST_BTN} w-full`}>
              Ver el álbum
            </button>
            <div className="flex flex-col items-stretch">
              <button type="button" disabled={busy} onClick={() => void run(() => ocultarSello(sello.id, true), () => onHidden(sello))} className={`${TEXT_BTN} min-h-11 justify-center`}>
                Ocultar este sello
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={`${TEXT_BTN} min-h-11 justify-center !text-[var(--text-secondary)]`}>
                No fui a este viaje
              </button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="m-0 text-[14px] leading-[1.5] text-[var(--error)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
