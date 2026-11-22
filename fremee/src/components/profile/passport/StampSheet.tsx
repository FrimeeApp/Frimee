"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { EyeOff, Images, MapPin, X } from "lucide-react";
import { FILL_BTN, FOCUS, GHOST_BTN, SERIF } from "@/components/plans/home/pieces";
import { countryName, countryOrdinal, dateLabel, planDays, planRangeLabel, type Sello } from "@/lib/passport";
import { marcarNoFui, ocultarSello } from "@/services/api/endpoints/pasaporte.endpoint";
import { CountryStamp, HITO_NAME, HitoStamp, PlanStamp } from "./stamps";

/** Hoja del sello (tablero «Sello abierto»): hoja inferior con los sellos del viaje, su título y las acciones. Solo para el dueño del pasaporte. */

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

  // El viaje del sello: su plan, su sello de plan y su sello de país (los de la misma hoja del diseño).
  const planSello = sello.kind === "plan" ? sello : sellos.find((s) => s.plan_id === sello.plan_id && s.kind === "plan") ?? null;
  const plan = sello.plan ?? planSello?.plan ?? null;
  const countrySello = sello.kind === "pais" ? sello : sellos.find((s) => s.plan_id === sello.plan_id && s.kind === "pais") ?? null;
  const titulo = sello.kind === "hito" ? HITO_NAME[sello.hito!] : plan?.titulo ?? (countrySello?.country_code ? countryName(countrySello.country_code) : "Viaje");

  // «21–25 nov 2026 · 5 días · tu 2.º sello de Portugal»
  const ordinal = countrySello?.country_code ? countryOrdinal(sellos, countrySello.country_code, countrySello.id) : 0;
  const parts = [
    plan ? planRangeLabel(plan).toLowerCase() : dateLabel(sello.stamped_at),
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/[0.62]" onClick={onClose}>
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Sello de ${titulo}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-dvh w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-t-[8px] border-t border-app bg-surface px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2 text-app shadow-[0_12px_24px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)]"
      >
        <div className="relative flex h-7 shrink-0 justify-center">
          <span aria-hidden="true" className="mt-1 h-1 w-9 rounded-full bg-[var(--border-strong)]" />
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className={`absolute -right-2 -top-1 inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
            <X className="size-[22px]" aria-hidden />
          </button>
        </div>

        <div className="flex h-[150px] shrink-0 items-center justify-center gap-1">
          {sello.kind === "hito" ? (
            <HitoStamp hito={sello.hito!} id={sello.id} size={140} tilt={-3} />
          ) : (
            <>
              {(planSello ?? null) && <PlanStamp sello={planSello!} size={190} tilt={-4} />}
              {countrySello && <CountryStamp sello={countrySello} size={120} tilt={8} />}
            </>
          )}
        </div>

        <div className="text-center">
          <h2 className={`m-0 text-[32px] leading-[1.15] ${SERIF}`}>{titulo}</h2>
          <p className="m-0 mt-1 text-[14px] leading-[1.5] tabular-nums text-muted">{parts.join(" · ")}</p>
        </div>

        {confirming ? (
          <div role="alertdialog" aria-label="Confirmar «No fui a este viaje»" className="flex flex-col gap-3 rounded-[8px] border border-app p-3">
            <p className="m-0 text-[14px] leading-[1.5]">Se quitan todos tus sellos de «{plan?.titulo ?? "este viaje"}» y no se vuelven a poner solos.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={`${GHOST_BTN} !text-[14px]`}>
                Cancelar
              </button>
              <button type="button" disabled={busy} onClick={() => void run(() => marcarNoFui(sello.plan_id), () => onNoFui(sello.plan_id))} className={`${FILL_BTN} !text-[14px]`}>
                Quitar sellos
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => router.push(planPath(sello.plan_id))} className={`${GHOST_BTN} bg-surface-2 !text-[14px] leading-[1.2]`}>
                <MapPin className="size-[18px]" aria-hidden />
                Ver el plan
              </button>
              <button type="button" onClick={() => router.push(albumPath(sello.plan_id))} className={`${GHOST_BTN} bg-surface-2 !text-[14px] leading-[1.2]`}>
                <Images className="size-[18px]" aria-hidden />
                Ver el álbum
              </button>
            </div>
            <div className="flex flex-col">
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => ocultarSello(sello.id, true), () => onHidden(sello))}
                className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] text-[14px] font-[var(--fw-semibold)] leading-[1.2] text-muted ${FOCUS}`}
              >
                <EyeOff className="size-[18px]" aria-hidden />
                Ocultar este sello
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
                className={`inline-flex h-11 w-full items-center justify-center rounded-[8px] text-[14px] font-[var(--fw-semibold)] leading-[1.2] text-muted ${FOCUS}`}
              >
                No fui a este viaje
              </button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="m-0 text-center text-[14px] leading-[1.5] text-[var(--error)]">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
