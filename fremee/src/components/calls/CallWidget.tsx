"use client";

import Image from "next/image";

type Props = {
  participanteNombre: string;
  participanteFoto?: string;
  duration: number;
  isActive: boolean;
  onExpand: () => void;
  onEnd: () => void;
};

export default function CallWidget({ participanteNombre, participanteFoto, duration, isActive, onExpand, onEnd }: Props) {
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="fixed top-4 right-4 z-[200] flex items-center gap-2 rounded-[16px] bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 shadow-elev-4 px-3 py-2">
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
          {isActive ? formatDuration(duration) : "Llamando..."}
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
        <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="1.8">
          <path d="M10.68 13.31a16 16 0 0 0 3.01 2.99l1.96-1.96a1 1 0 0 1 1.09-.22 11.3 11.3 0 0 0 3.57.73 1 1 0 0 1 .93 1v3.57a1 1 0 0 1-.9 1A17 17 0 0 1 3 5.9a1 1 0 0 1 1-.9h3.57a1 1 0 0 1 1 .92 11.3 11.3 0 0 0 .73 3.57 1 1 0 0 1-.22 1.09l-1.96 1.96" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      </button>
    </div>
  );
}
