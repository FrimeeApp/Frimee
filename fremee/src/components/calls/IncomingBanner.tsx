"use client";

import { Phone, Video } from "lucide-react";
import { CallAvatar, CallControl, CallDots, HangUpIcon } from "./ui";

/**
 * Incoming call minimized (M5, D5): a 76 px card on top of the app. Phones: at the top, so it
 * never covers the bottom navigation. Desktop: top right, 380 px. Tapping the body opens the
 * full screen again. role="alert" so screen readers announce it.
 */
export default function IncomingBanner({ tipo, caller, onOpen, onAccept, onReject }: {
  tipo: "audio" | "video";
  caller: { id: string; nombre: string; foto?: string };
  onOpen: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="call-drop fixed inset-x-2 z-50 md:inset-x-auto md:right-6 md:top-6 md:w-[380px]" style={{ top: "calc(max(env(safe-area-inset-top), 44px) + 12px)" }}>
      <div role="alert" className="flex h-[76px] items-center gap-3 rounded-lg border border-[var(--call-border)] bg-[var(--surface)] px-3 shadow-[0_8px_24px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
        <button type="button" onClick={onOpen} aria-label={`Abrir llamada entrante de ${caller.nombre}`} className="flex h-[76px] min-w-0 flex-1 items-center gap-3 text-left">
          <div className="relative">
            <CallAvatar id={caller.id} nombre={caller.nombre} foto={caller.foto} size={44} />
            <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--call-accent-text)]">
              {tipo === "video" ? <Video className="size-3" aria-hidden /> : <Phone className="size-3" aria-hidden />}
            </span>
          </div>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{caller.nombre}</span>
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-[var(--text-secondary)]">
              {tipo === "video" ? "Videollamada entrante" : "Llamada entrante"}
              <CallDots />
            </span>
          </span>
        </button>
        <CallControl kind="reject" small ariaLabel="Rechazar llamada" tip="Rechazar" onClick={onReject}>
          <HangUpIcon size={20} />
        </CallControl>
        <CallControl kind="accept" small ariaLabel="Aceptar llamada" tip="Aceptar" onClick={onAccept}>
          {tipo === "video" ? <Video className="size-5" aria-hidden /> : <Phone className="size-5" aria-hidden />}
        </CallControl>
      </div>
    </div>
  );
}
