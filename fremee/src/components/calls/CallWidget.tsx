"use client";

import Image from "next/image";
import { HangUpIcon } from "./ui";
import { Capacitor } from "@capacitor/core";

type Props = {
  participanteNombre: string;
  participanteFoto?: string;
  duration: number;
  isActive: boolean;
  statusLabel?: string;
  onExpand: () => void;
  onEnd: () => void;
};

export default function CallWidget({ participanteNombre, participanteFoto, duration, isActive, statusLabel, onExpand, onEnd }: Props) {
  const isNative = Capacitor.isNativePlatform();
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div
      className="fixed right-4 z-[200] flex items-center gap-2 rounded-[16px] bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 shadow-elev-4 px-3 py-2"
      style={isNative ? { top: "calc(env(safe-area-inset-top) + 16px)" } : { top: "16px" }}
    >
      {/* Avatar */}
      <div className="size-8 shrink-0 overflow-hidden rounded-full bg-white/10 border border-white/10">
        {participanteFoto ? (
          <Image src={participanteFoto} alt={participanteNombre} width={32} height={32} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
            {participanteNombre[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Info + expand */}
      <button
        onClick={onExpand}
        className="flex flex-col items-start leading-none text-left"
      >
        <span className="text-[14px] font-semibold text-white truncate max-w-[120px]">{participanteNombre}</span>
        <span className="text-[14px] text-white/50 mt-[2px]">
          {statusLabel ?? (isActive ? formatDuration(duration) : "Llamando...")}
        </span>
      </button>

      {/* Pulsing green dot (active indicator) */}
      {isActive && (
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-green-500" />
        </span>
      )}

      {/* Hang up */}
      <button
        onClick={onEnd}
        className="ml-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
        aria-label="Colgar"
      >
        <HangUpIcon size={16} />
      </button>
    </div>
  );
}
