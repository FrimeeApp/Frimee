"use client";

import { useEffect } from "react";
import type { CallMiembro } from "@/hooks/useCall";
import { AvatarStack, CallAvatar } from "./ui";

/** How long "Llamada finalizada" stays (board T1 · Movimiento). */
const ENDED_MS = 1500;

export type EndedCall = {
  title: string;
  persona?: { id: string; nombre: string; foto?: string };
  /** Group: the people in it (without you). */
  group?: CallMiembro[];
  /** Seconds from answering to hanging up. */
  duration: number;
  /** You left a group call others are still in: how many. */
  stillInside: number;
};

function formatDuration(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

/**
 * End of a call (boards M16a, M16b, D16), on the dark stage. A call that is over says
 * "Llamada finalizada" for 1.5 s and closes. Leaving a group call that goes on stays, with
 * "Volver a entrar".
 */
export default function CallEnded({ call, onClose, onRejoin }: { call: EndedCall; onClose: () => void; onRejoin?: () => void }) {
  const leftGroup = call.stillInside > 0;
  useEffect(() => {
    if (leftGroup) return;
    const t = setTimeout(onClose, ENDED_MS);
    return () => clearTimeout(t);
  }, [leftGroup, onClose]);

  return (
    <div
      role="dialog"
      aria-label={leftGroup ? "Has salido de la llamada" : "Llamada finalizada"}
      className="call-stage call-enter fixed inset-0 z-[60] flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
      onClick={leftGroup ? undefined : onClose}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="opacity-60">
          {call.group && call.group.length > 1
            ? <AvatarStack miembros={call.group} size={60} ring="var(--stage-bg)" max={3} />
            : <CallAvatar id={call.persona?.id ?? call.title} nombre={call.persona?.nombre ?? call.title} foto={call.persona?.foto} size={120} />}
        </div>
        <h2 className="call-serif m-0 mt-6 text-[36px] leading-[1.1]">{call.title}</h2>
        <p role="status" className="call-num m-0 mt-3 text-[15px] text-[var(--stage-text-2)]">
          {leftGroup ? "Has salido de la llamada" : "Llamada finalizada"} · {formatDuration(call.duration)}
        </p>
        {leftGroup && (
          <p className="m-0 mt-1 text-[13px] text-[var(--stage-text-2)]">
            Siguen {call.stillInside} {call.stillInside === 1 ? "persona" : "personas"} dentro
          </p>
        )}
      </div>
      {leftGroup && (
        <div className="mx-auto flex w-full max-w-[420px] gap-3 px-6">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg bg-[var(--stage-control)] text-[15px] font-semibold text-white hover:bg-[var(--stage-control-hover)]">
            Cerrar
          </button>
          {onRejoin && (
            <button type="button" onClick={onRejoin} className="h-12 flex-1 rounded-lg bg-[var(--stage-control-on)] text-[15px] font-semibold text-[var(--stage-control-on-icon)] hover:brightness-95">
              Volver a entrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
