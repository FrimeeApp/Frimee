"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, ChevronRight, Eye, EyeOff, Lock, Share2, X } from "lucide-react";
import { FOCUS } from "@/components/plans/home/pieces";
import type { PasaporteAjustes } from "@/lib/passport";
import { guardarAjustesPasaporte } from "@/services/api/endpoints/pasaporte.endpoint";

/**
 * «Quién ve tu pasaporte» (tablero «Privacidad»). Escritorio: diálogo centrado de 480 px con velo; móvil: hoja inferior.
 * Los cambios se guardan solos al tocarlos; si falla, se deshace el cambio y se avisa.
 */

const DEFAULTS: PasaporteAjustes = { passport_visibility: "AMISTADES", show_plan_stamps: true, show_companions: true };

const OPTIONS: { value: PasaporteAjustes["passport_visibility"]; title: string; text: string }[] = [
  { value: "TODOS", title: "Cualquiera en Frimee", text: "Aparece en tu perfil para todo el mundo." },
  { value: "AMISTADES", title: "Tus amistades", text: "Solo quien ya es tu amistad en Frimee." },
  { value: "SOLO_YO", title: "Solo tú", text: "Los demás no verán la libreta en tu perfil." },
];

/* Radio: anillo de border-strong; marcado, anillo primary con punto. Nunca relleno blanco. */
const radioCls =
  "appearance-none m-0 grid size-[22px] shrink-0 place-content-center rounded-full border-2 border-[var(--border-strong)] bg-transparent " +
  "checked:border-[var(--primary)] before:size-[10px] before:scale-0 before:rounded-full before:bg-[var(--primary)] before:transition-transform before:duration-[120ms] before:content-[''] " +
  "checked:before:scale-100 motion-reduce:before:transition-none " +
  FOCUS;

export default function PassportPrivacySheet({
  ajustes,
  hiddenCount = 0,
  shareUrl,
  onChange,
  onOpenHidden,
  onPreview,
  onClose,
}: {
  ajustes: PasaporteAjustes | null;
  hiddenCount?: number;
  shareUrl?: string;
  onChange: (a: PasaporteAjustes) => void;
  /** Sin él, la fila «Sellos ocultos» no sale (solo existe dentro del lector). */
  onOpenHidden?: () => void;
  /** Sin él, no sale «Ver como tus amistades». */
  onPreview?: () => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<PasaporteAjustes>(ajustes ?? DEFAULTS);
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "copied">("idle");
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const ids = { plans: useId(), plansD: useId(), comp: useId(), compD: useId() };
  const [isDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const onlyMe = v.passport_visibility === "SOLO_YO";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const frames: Keyframe[] = reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : isDesktop
        ? [{ opacity: 0, transform: "translate(-50%, -50%) scale(0.96)" }, { opacity: 1, transform: "translate(-50%, -50%)" }]
        : [{ transform: "translateY(100%)" }, { transform: "none" }];
    el.animate(frames, { duration: reduced || isDesktop ? 160 : 240, easing: reduced ? "linear" : "cubic-bezier(0.2, 0, 0, 1)" });
  }, [isDesktop, reduced]);

  // Foco: al abrir, a la opción marcada; al cerrar, de vuelta a quien abrió. El fondo no se desplaza.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input:checked")?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, []);

  // Esc y foco atrapado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !ref.current) return;
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled)")).filter((el) => !(el instanceof HTMLInputElement && el.type === "radio" && !el.checked));
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
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (next: PasaporteAjustes) => {
    const before = v;
    setV(next);
    setStatus("saving");
    try {
      await guardarAjustesPasaporte(next);
      onChange(next);
      setStatus("idle");
    } catch (err) {
      console.error("[pasaporte] No se guardaron los ajustes:", (err as { message?: string } | null)?.message ?? err);
      setV(before);
      setStatus("error");
    }
  };

  const share = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Mi pasaporte en Frimee", url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setStatus("copied");
      }
    } catch {
      // Cancelar el menú de compartir no es un error.
    }
  };

  const row = "flex min-h-16 items-center gap-4 py-2";
  const btn2 = `inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[var(--border-strong)] bg-surface-2 px-4 text-[14px] font-[var(--fw-semibold)] text-app disabled:opacity-[var(--disabled-opacity)] ${FOCUS}`;

  return createPortal(
    <>
      {/* Velo sólido, sin desenfoque. */}
      <div aria-hidden="true" className="fixed inset-0 z-[89] bg-black/60" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={
          isDesktop
            ? "fixed left-1/2 top-1/2 z-[90] flex max-h-[calc(100dvh-48px)] w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[8px] border border-app bg-surface text-app shadow-[0_12px_24px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)]"
            : "fixed inset-x-0 bottom-0 z-[90] mx-auto flex max-h-[90dvh] w-full max-w-[460px] flex-col rounded-t-[8px] border-t border-app bg-surface text-app shadow-[0_12px_24px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)]"
        }
      >
        <header className="flex items-center gap-2 pb-1 pl-6 pr-2 pt-3">
          <h2 id={titleId} className="m-0 flex-1 font-sans text-[20px] font-[var(--fw-semibold)] leading-tight">
            Quién ve tu pasaporte
          </h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className={`grid size-11 place-content-center rounded-[8px] ${FOCUS}`}>
            <X className="size-[22px]" aria-hidden />
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 pb-4 pt-2">
          <fieldset className="m-0 flex flex-col border-0 p-0">
            <legend className="p-0 pb-1 text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">QUIÉN PUEDE VERLO</legend>
            {OPTIONS.map((o, i) => (
              <label key={o.value} className={`${row} cursor-pointer ${i ? "border-t border-app" : ""}`}>
                <input type="radio" name="passport-visibility" value={o.value} checked={v.passport_visibility === o.value} onChange={() => void save({ ...v, passport_visibility: o.value })} className={radioCls} />
                <span className="flex flex-col">
                  <span className="text-[16px] font-[var(--fw-semibold)]">{o.title}</span>
                  <span className="text-[14px] text-muted">{o.text}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {/* Con «Solo tú» nadie más lo ve: no hay nada que elegir. */}
          <fieldset className="m-0 flex flex-col border-0 p-0 disabled:opacity-[var(--disabled-opacity)]" disabled={onlyMe}>
            <legend className="p-0 pb-1 text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">QUÉ SE MUESTRA</legend>
            <div className={row}>
              <span className="flex flex-1 flex-col">
                <span id={ids.plans} className="text-[16px] font-[var(--fw-semibold)]">
                  Sellos de planes
                </span>
                <span id={ids.plansD} className="text-[14px] text-muted">
                  Además de los países, el nombre y las fechas de cada viaje.
                </span>
              </span>
              <Switch checked={v.show_plan_stamps} onChange={(b) => void save({ ...v, show_plan_stamps: b })} labelId={ids.plans} descId={ids.plansD} />
            </div>
            <div className={`${row} border-t border-app`}>
              <span className="flex flex-1 flex-col">
                <span id={ids.comp} className="text-[16px] font-[var(--fw-semibold)]">
                  Con quién viajaste
                </span>
                <span id={ids.compD} className="text-[14px] text-muted">
                  Las personas del plan, si ellas también muestran su pasaporte.
                </span>
              </span>
              <Switch checked={v.show_companions} onChange={(b) => void save({ ...v, show_companions: b })} labelId={ids.comp} descId={ids.compD} />
            </div>
          </fieldset>

          <p className="m-0 flex gap-2.5 rounded-[8px] bg-surface-2 px-3.5 py-3 text-[14px]">
            <Lock className="size-[18px] shrink-0 text-muted" strokeWidth={2} aria-hidden />
            Los viajes que aún no han terminado nunca aparecen.
          </p>

          {onOpenHidden && (
            <button type="button" onClick={onOpenHidden} className={`flex min-h-14 items-center gap-3 border-y border-app text-left ${FOCUS}`}>
              <EyeOff className="size-5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
              <span className="flex-1 text-[16px] font-[var(--fw-semibold)]">Sellos ocultos</span>
              <span className="text-[14px] tabular-nums text-muted">{hiddenCount}</span>
              <ChevronRight className="size-[18px] shrink-0 text-muted" aria-hidden />
            </button>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-app px-6 py-4">
          <span role="status" className={`inline-flex min-w-[140px] flex-1 items-center gap-1.5 text-[14px] ${status === "error" ? "text-[var(--error)]" : "text-muted"}`}>
            {status === "error" ? (
              <>
                <AlertCircle className="size-4 shrink-0" aria-hidden /> No se pudo guardar. Vuelve a intentarlo.
              </>
            ) : status === "saving" ? (
              "Guardando…"
            ) : status === "copied" ? (
              "Enlace copiado."
            ) : (
              <>
                <Check className="size-4 shrink-0" aria-hidden /> Se guarda solo
              </>
            )}
          </span>
          {onPreview && (
            <button type="button" className={btn2} onClick={onPreview} disabled={onlyMe}>
              <Eye className="size-[18px] shrink-0" strokeWidth={2} aria-hidden /> Ver como tus amistades
            </button>
          )}
          {shareUrl && (
            <button type="button" className={btn2} onClick={() => void share()}>
              <Share2 className="size-[18px] shrink-0" strokeWidth={2} aria-hidden /> Compartir
            </button>
          )}
        </footer>
      </div>
    </>,
    document.body,
  );
}

function Switch({ checked, onChange, labelId, descId }: { checked: boolean; onChange: (v: boolean) => void; labelId: string; descId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={descId}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors duration-[120ms] motion-reduce:transition-none ${checked ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"} ${FOCUS}`}
    >
      {/* área táctil de 44 px */}
      <span aria-hidden="true" className="absolute inset-x-0 -inset-y-[9px]" />
      <span aria-hidden="true" className={`absolute left-[3px] top-[3px] grid size-5 place-content-center rounded-full bg-white transition-transform duration-[160ms] motion-reduce:transition-none ${checked ? "translate-x-[18px]" : ""}`}>
        {checked && <Check className="size-3 text-[var(--primary)]" strokeWidth={3} aria-hidden />}
      </span>
    </button>
  );
}
