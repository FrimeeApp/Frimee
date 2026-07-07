"use client";

import Image from "next/image";
import { Capacitor } from "@capacitor/core";
import { PhoneOffIcon } from "@/components/icons";
import { Minimize2, Phone } from "lucide-react";

type Props = {
  callerName: string;
  callerFoto?: string;
  tipo: "audio" | "video";
  onAccept: () => void;
  onReject: () => void;
  onMinimize: () => void;
};

export default function IncomingCall({ callerName, callerFoto, tipo, onAccept, onReject, onMinimize }: Props) {
  const isNative = Capacitor.isNativePlatform();

  return (
    <div
      className="fixed inset-0 z-[1400] flex flex-col items-center justify-between bg-[#111] text-white"
      style={isNative ? { paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={tipo === "video" ? "Videollamada entrante" : "Llamada de voz entrante"}
    >
      <button
        type="button"
        onClick={onMinimize}
        className="absolute right-[max(16px,env(safe-area-inset-right))] top-[calc(env(safe-area-inset-top)+16px)] flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:scale-95"
        aria-label="Minimizar llamada entrante"
        title="Minimizar"
      >
        <Minimize2 className="size-5" aria-hidden />
      </button>

      <div className={`flex flex-col items-center gap-[var(--space-3)] ${isNative ? "pt-[var(--space-12)]" : "pt-[var(--space-20)]"}`}>
        <p className="text-caption text-muted">{tipo === "video" ? "Llamada de video entrante" : "Llamada de voz entrante"}</p>
        <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-white/10">
          {callerFoto ? (
            <Image src={callerFoto} alt={callerName} width={96} height={96} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[40px] font-bold">
              {callerName?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <p className="text-[var(--font-h2)] font-[var(--fw-bold)]">{callerName}</p>
      </div>

      <div className={`flex items-center gap-[var(--space-16)] ${isNative ? "pb-[var(--space-8)]" : "pb-[var(--space-20)]"}`}>
        <div className="flex flex-col items-center gap-[var(--space-2)]">
          <button
            type="button"
            onClick={onReject}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Rechazar llamada"
          >
            <PhoneOffIcon />
          </button>
          <span className="text-caption text-muted">Rechazar</span>
        </div>

        <div className="flex flex-col items-center gap-[var(--space-2)]">
          <button
            type="button"
            onClick={onAccept}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Aceptar llamada"
          >
            <PhoneIcon />
          </button>
          <span className="text-caption text-muted">Aceptar</span>
        </div>
      </div>
    </div>
  );
}

const PhoneIcon = () => <Phone className="size-6" aria-hidden />;
