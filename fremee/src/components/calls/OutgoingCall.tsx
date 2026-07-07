"use client";

import Image from "next/image";
import { Capacitor } from "@capacitor/core";
import { PhoneOffIcon } from "@/components/icons";
import { Phone, Video } from "lucide-react";

type Props = {
  participantName: string;
  participantFoto?: string;
  tipo: "audio" | "video";
  statusText?: string;
  hasError?: boolean;
  onCancel: () => void;
};

export default function OutgoingCall({ participantName, participantFoto, tipo, statusText, hasError = false, onCancel }: Props) {
  const isNative = Capacitor.isNativePlatform();
  const label = tipo === "video" ? "Preparando videollamada" : "Preparando llamada de voz";
  const Icon = tipo === "video" ? Video : Phone;

  return (
    <div
      className="fixed inset-0 z-[1400] flex flex-col items-center justify-between bg-[#111] text-white"
      style={isNative ? { paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className={`flex flex-col items-center gap-[var(--space-3)] ${isNative ? "pt-[var(--space-12)]" : "pt-[var(--space-20)]"}`}>
        <p className="text-caption text-muted">{label}</p>
        <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-white/10">
          {participantFoto ? (
            <Image src={participantFoto} alt={participantName} width={96} height={96} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[40px] font-bold">
              {participantName?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <p className="text-[var(--font-h2)] font-[var(--fw-bold)]">{participantName}</p>
        <div className={`mt-[var(--space-2)] flex max-w-[260px] items-center justify-center gap-2 text-center text-caption ${hasError ? "text-red-200" : "text-muted"}`}>
          <Icon className="size-4 shrink-0" aria-hidden />
          <span>{statusText ?? "Conectando..."}</span>
        </div>
      </div>

      <div className={`${isNative ? "pb-[var(--space-8)]" : "pb-[var(--space-20)]"}`}>
        <div className="flex flex-col items-center gap-[var(--space-2)]">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Cancelar llamada"
          >
            <PhoneOffIcon />
          </button>
          <span className="text-caption text-muted">Cancelar</span>
        </div>
      </div>
    </div>
  );
}
