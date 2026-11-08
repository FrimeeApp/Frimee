"use client";

import type { ReactNode } from "react";
import { ChevronDown, Minimize2, Phone, Video } from "lucide-react";
import type { CallMiembro } from "@/hooks/useCall";
import { AvatarStack, CallAvatar } from "./ui";

/**
 * The ringing screens (preparing, outgoing, incoming, no answer, busy): boards M2–M4,
 * D2–D4, M18b–c. Phones: full screen in the user's theme. Desktop: a 400 px card over the
 * app with a veil. A video call can show your own camera behind (phones: blurred, under a
 * 72 % veil) or as a 16:9 preview at the top of the card (desktop).
 */
export function CallScreen({
  tipo,
  hero,
  title,
  status,
  extra,
  aboveButtons,
  buttons,
  ariaLabel,
  ownVideo,
  onMinimize,
}: {
  tipo: "audio" | "video";
  hero: { kind: "person"; id: string; nombre: string; foto?: string; pulse?: boolean; dim?: boolean } | { kind: "group"; miembros: CallMiembro[] };
  title: string;
  /** Under the name: "Llamando ···", "te está llamando", an error… */
  status: ReactNode;
  /** Between the status and the buttons (plan chip, "Contestar sin cámara"…). */
  extra?: ReactNode;
  /** Just above the buttons on phones, under the status on desktop ("Contestar sin cámara"). */
  aboveButtons?: ReactNode;
  buttons: ReactNode;
  ariaLabel: string;
  /** Your camera, attached by the caller (ref callback). */
  ownVideo?: (el: HTMLVideoElement | null) => void;
  onMinimize?: () => void;
}) {
  const chip = (
    <div className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--call-btn-neutral)] px-2.5 text-[13px] font-medium text-[var(--text-secondary)]">
      {tipo === "video" ? <Video className="size-4" aria-hidden /> : <Phone className="size-4" aria-hidden />}
      <span>{tipo === "video" ? "Videollamada" : "Llamada de voz"}</span>
    </div>
  );

  const heroVisual = (size: number) => {
    if (hero.kind === "group") return <AvatarStack miembros={hero.miembros} size={Math.round(size * 0.6)} ring="var(--bg)" />;
    return (
      <div className="relative" style={{ width: size, height: size, opacity: hero.dim ? 0.55 : 1 }}>
        {hero.pulse && (
          <>
            <span className="call-pulse" style={{ background: "var(--call-accept)" }} />
            <span className="call-pulse call-pulse-2" style={{ background: "var(--call-accept)" }} />
          </>
        )}
        <CallAvatar id={hero.id} nombre={hero.nombre} foto={hero.foto} size={size} />
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-[70] md:flex md:items-center md:justify-center md:bg-[var(--call-scrim)]"
    >
      {/* Phones: full screen. */}
      <div className="call-enter absolute inset-0 overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] md:hidden">
        {ownVideo && (
          <>
            <video ref={ownVideo} data-own-video autoPlay playsInline muted aria-hidden="true" className="absolute inset-0 size-full -scale-x-100 object-cover" style={{ filter: "blur(28px)", transform: "scaleX(-1) scale(1.2)" }} />
            <div aria-hidden="true" className="absolute inset-0" style={{ background: "color-mix(in srgb, var(--bg) 72%, transparent)" }} />
          </>
        )}
        <div className="absolute inset-x-2 z-[3] flex h-11 items-center justify-between" style={{ top: "calc(max(env(safe-area-inset-top), 44px) + 10px)" }}>
          {onMinimize ? (
            <button type="button" onClick={onMinimize} aria-label="Minimizar llamada" className="flex size-11 items-center justify-center rounded-lg text-[var(--text-primary)]">
              <ChevronDown className="size-[22px]" aria-hidden />
            </button>
          ) : (
            <div className="w-11" />
          )}
          {chip}
          <div className="w-11" />
        </div>
        <div className="absolute inset-x-6 z-[2] flex flex-col items-center text-center" style={{ top: "calc(max(env(safe-area-inset-top), 44px) + 132px)" }}>
          {heroVisual(120)}
          <h1 className="call-serif m-0 mt-7 text-[44px] leading-[1.08]">{title}</h1>
          <div className="mt-2.5 text-[16px] text-[var(--text-secondary)]">{status}</div>
          {extra}
        </div>
        <div className="absolute inset-x-0 z-[2] flex flex-col items-center gap-5" style={{ bottom: "calc(max(env(safe-area-inset-bottom), 34px) + 40px)" }}>
          {aboveButtons}
          <div className="flex items-start justify-center gap-8">{buttons}</div>
        </div>
      </div>

      {/* Desktop: a card over the app. */}
      <div className="call-enter relative hidden w-[400px] overflow-hidden rounded-lg border border-[var(--call-border)] bg-[var(--surface)] text-[var(--text-primary)] md:block">
        {onMinimize && (
          <div className="absolute right-3 top-3">
            <button type="button" onClick={onMinimize} aria-label="Minimizar aviso de llamada" className="flex size-11 items-center justify-center rounded-lg">
              <Minimize2 className="size-[22px]" aria-hidden />
            </button>
          </div>
        )}
        {ownVideo && (
          <div className="relative mx-3 mt-3 h-[198px] overflow-hidden rounded-lg bg-[var(--stage-tile)]">
            <video ref={ownVideo} data-own-video autoPlay playsInline muted aria-hidden="true" className="absolute inset-0 size-full -scale-x-100 object-cover" />
            <span className="absolute bottom-2 left-2 inline-flex h-6 items-center rounded-md bg-[var(--stage-label)] px-2 text-[12px] font-medium text-white">Tu cámara</span>
          </div>
        )}
        <div className="flex flex-col items-center px-6 py-7 text-center">
          {chip}
          <div className="mt-7 flex flex-col items-center">
            {heroVisual(96)}
            <h1 className="call-serif m-0 mt-6 text-[36px] leading-[1.08]">{title}</h1>
            <div className="mt-2.5 text-[16px] text-[var(--text-secondary)]">{status}</div>
          </div>
          {extra}
          {aboveButtons && <div className="mt-6">{aboveButtons}</div>}
          <div className="mt-8 flex items-start gap-8">{buttons}</div>
        </div>
      </div>
    </div>
  );
}
