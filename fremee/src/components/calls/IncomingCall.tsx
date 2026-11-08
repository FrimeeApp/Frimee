"use client";

import { Phone, Video } from "lucide-react";
import type { CallMiembro } from "@/hooks/useCall";
import { CallScreen } from "./CallScreen";
import { CallControl, HangUpIcon } from "./ui";

/**
 * Incoming call, full screen (M4, D4). Decline on the left, accept on the right, 120 px apart.
 * Video calls can be answered without the camera. From a plan: who calls and the plan's name.
 */
type Props = {
  tipo: "audio" | "video";
  caller: { id: string; nombre: string; foto?: string };
  /** The call comes from a plan's chat: its name. */
  plan?: string | null;
  /** A group chat (not a plan): its members, shown stacked. */
  group?: CallMiembro[] | null;
  onAccept: (withCamera: boolean) => void;
  onReject: () => void;
  onMinimize: () => void;
};

export default function IncomingCall({ tipo, caller, plan, group, onAccept, onReject, onMinimize }: Props) {
  const isGroup = Boolean(group && group.length > 2 && !plan);
  const status = plan ? "te llama desde el plan" : isGroup ? "llamada de grupo" : "te está llamando";

  return (
    <CallScreen
      tipo={tipo}
      ariaLabel={`${tipo === "video" ? "Videollamada" : "Llamada"} entrante de ${caller.nombre}`}
      hero={isGroup && group ? { kind: "group", miembros: group } : { kind: "person", id: caller.id, nombre: caller.nombre, foto: caller.foto, pulse: true }}
      title={caller.nombre}
      status={status}
      onMinimize={onMinimize}
      extra={
        <>
          {plan && (
            <div className="mt-5 inline-flex h-11 items-center gap-2.5 rounded-full bg-[var(--call-pill-bg)] pl-1.5 pr-3.5 text-[var(--text-primary)]">
              <span aria-hidden="true" className="call-serif flex size-8 items-center justify-center rounded-lg text-[19px] text-[var(--call-accent-text)]">
                {plan.trim()[0]?.toUpperCase()}
              </span>
              <span className="text-[14px] font-semibold">{plan}</span>
            </div>
          )}
        </>
      }
      aboveButtons={
        tipo === "video" ? (
          <button
            type="button"
            onClick={() => onAccept(false)}
            className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-[14px] font-semibold text-[var(--call-accent-text)]"
          >
            <Phone className="size-[18px]" aria-hidden />
            <span>Contestar sin cámara</span>
          </button>
        ) : undefined
      }
      buttons={
        <>
          <CallControl kind="reject" label="Rechazar" ariaLabel="Rechazar llamada" onClick={onReject}>
            <HangUpIcon size={28} />
          </CallControl>
          <div className="w-14" aria-hidden="true" />
          <CallControl kind="accept" label="Aceptar" ariaLabel={tipo === "video" ? "Aceptar videollamada" : "Aceptar llamada"} onClick={() => onAccept(tipo === "video")}>
            {tipo === "video" ? <Video className="size-7" aria-hidden /> : <Phone className="size-7" aria-hidden />}
          </CallControl>
        </>
      }
    />
  );
}
