"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EyeOff, Info, Share2, X } from "lucide-react";
import { FOCUS, GHOST_BTN } from "@/components/plans/home/pieces";
import type { PasaporteAjustes } from "@/lib/passport";
import { guardarAjustesPasaporte } from "@/services/api/endpoints/pasaporte.endpoint";

/** «Quién ve tu pasaporte» (tablero «Privacidad»): hoja inferior con la visibilidad y los dos interruptores. Se guarda al cambiar. */

const DEFAULTS: PasaporteAjustes = { passport_visibility: "AMISTADES", show_plan_stamps: true, show_companions: true };

const OPTIONS: { value: PasaporteAjustes["passport_visibility"]; title: string; text: string }[] = [
  { value: "TODOS", title: "Cualquiera en Frimee", text: "Aparece en tu perfil para todo el mundo." },
  { value: "AMISTADES", title: "Tus amistades", text: "Solo quien ya es tu amistad en Frimee." },
  { value: "SOLO_YO", title: "Solo tú", text: "Los demás no verán la libreta en tu perfil." },
];

export default function PassportPrivacySheet({
  ajustes,
  hiddenCount = 0,
  shareUrl,
  onChange,
  onOpenHidden,
  onClose,
}: {
  ajustes: PasaporteAjustes | null;
  /** Viajes ocultos; con ellos aparece «Sellos ocultos (N)». */
  hiddenCount?: number;
  shareUrl?: string;
  onChange: (a: PasaporteAjustes) => void;
  onOpenHidden?: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState<PasaporteAjustes>(ajustes ?? DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    panelRef.current?.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(0.2, 0, 0, 1)" });
  }, []);
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Se guarda al cambiar; si falla, vuelve al valor anterior.
  const save = async (next: PasaporteAjustes) => {
    const before = value;
    setValue(next);
    setError(null);
    try {
      await guardarAjustesPasaporte(next);
      onChange(next);
    } catch (err) {
      console.error("[pasaporte] No se guardaron los ajustes:", (err as { message?: string } | null)?.message ?? err);
      setValue(before);
      setError("No se pudo guardar. Comprueba la conexión y vuelve a intentarlo.");
    }
  };

  const share = async () => {
    if (!shareUrl) return;
    setNotice(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Mi pasaporte en Frimee", url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setNotice("Enlace copiado.");
      }
    } catch {
      // Cancelar el menú de compartir no es un error.
    }
  };

  const row = "flex min-h-[60px] cursor-pointer items-center gap-3.5 border-t border-app";
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50" onClick={onClose}>
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quién ve tu pasaporte"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-dvh w-full max-w-[460px] flex-col gap-3 overflow-y-auto rounded-t-[8px] bg-surface px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 text-app shadow-[0_12px_24px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)]"
      >
        <div className="flex h-11 shrink-0 items-center justify-between">
          <h2 className="m-0 font-sans text-[18px] font-[var(--fw-semibold)] leading-[1.3]">Quién ve tu pasaporte</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className={`-mr-2 inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
            <X className="size-[22px]" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <fieldset className="m-0 flex flex-col border-0 p-0">
            <legend className="p-0 pb-1 text-[12px] font-[var(--fw-semibold)] leading-[1.4] tracking-[0.02em] text-muted">QUIÉN PUEDE VERLO</legend>
            {OPTIONS.map((o, i) => (
              <label key={o.value} className={`${row} ${i === 0 ? "!border-t-0" : ""}`}>
                <input
                  type="radio"
                  name="passport-visibility"
                  checked={value.passport_visibility === o.value}
                  onChange={() => void save({ ...value, passport_visibility: o.value })}
                  className="m-0 size-[22px] shrink-0 accent-[var(--primary)]"
                />
                <span className="flex flex-col">
                  <span className="text-[16px] leading-[1.35]">{o.title}</span>
                  <span className="text-[14px] leading-[1.5] text-muted">{o.text}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col">
            <Switch
              title="Sellos de planes"
              text="Además de los países, el nombre y las fechas de cada viaje."
              on={value.show_plan_stamps}
              onChange={(on) => void save({ ...value, show_plan_stamps: on })}
            />
            <Switch
              title="Con quién viajaste"
              text="Las personas del plan, si ellas también muestran su pasaporte."
              on={value.show_companions}
              onChange={(on) => void save({ ...value, show_companions: on })}
            />
          </div>

          <p className="m-0 flex gap-2 text-[14px] leading-[1.5] text-muted">
            <Info className="mt-0.5 size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            Los viajes que aún no han terminado nunca aparecen.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {onOpenHidden && hiddenCount > 0 ? (
              <button type="button" onClick={onOpenHidden} className={`${GHOST_BTN} bg-surface-2 !text-[14px] leading-[1.2]`}>
                <EyeOff className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
                Sellos ocultos ({hiddenCount})
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
            {shareUrl && (
              <button type="button" onClick={() => void share()} className={`${GHOST_BTN} bg-surface-2 !text-[14px] leading-[1.2]`}>
                <Share2 className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
                Compartir
              </button>
            )}
          </div>
          {notice && (
            <p role="status" className="m-0 text-center text-[14px] leading-[1.5] text-muted">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="m-0 text-center text-[14px] leading-[1.5] text-[var(--error)]">
              {error}
            </p>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function Switch({ title, text, on, onChange }: { title: string; text: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`flex min-h-[60px] w-full items-center gap-3.5 border-t border-app text-left ${FOCUS}`}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] leading-[1.35]">{title}</span>
        <span className="text-[14px] leading-[1.5] text-muted">{text}</span>
      </span>
      <span aria-hidden="true" className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors motion-reduce:transition-none ${on ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"}`}>
        <span className={`absolute top-[3px] size-5 rounded-full bg-white transition-[left] duration-150 motion-reduce:transition-none ${on ? "left-[21px]" : "left-[3px]"}`} />
      </span>
    </button>
  );
}
