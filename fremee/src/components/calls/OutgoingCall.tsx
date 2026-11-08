"use client";

import { MessageSquare, Mic, MicOff, Phone, RefreshCw, Video, VideoOff, X } from "lucide-react";
import type { CallMiembro } from "@/hooks/useCall";
import { CallScreen } from "./CallScreen";
import { CallControl, CallDots, HangUpIcon } from "./ui";

/** Outgoing call, from preparing to ringing, and why it did not go through (M2, M3, M18b–c). */
export type OutgoingPhase = "connecting" | "error" | "ringing" | "no-answer" | "busy" | "rejected";

type Props = {
  phase: OutgoingPhase;
  tipo: "audio" | "video";
  /** Who you call: a person, or the group/plan name with its members. */
  target: { id: string; nombre: string; foto?: string };
  group?: CallMiembro[];
  micEnabled: boolean;
  cameraEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  ownVideo?: (el: HTMLVideoElement | null) => void;
  onCancel: () => void;
  onClose: () => void;
  onRetry: () => void;
};

const firstName = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre;

export default function OutgoingCall({ phase, tipo, target, group, micEnabled, cameraEnabled, onToggleMic, onToggleCamera, ownVideo, onCancel, onClose, onRetry }: Props) {
  const isGroup = Boolean(group && group.length > 2);
  const others = isGroup ? (group ?? []).length - 1 : 1;
  const ended = phase === "no-answer" || phase === "busy" || phase === "rejected" || phase === "error";

  const mic = (
    <CallControl kind="app" label="Silenciar" ariaLabel={micEnabled ? "Silenciar micro" : "Activar micro"} pressed={!micEnabled} onClick={onToggleMic}>
      {micEnabled ? <Mic className="size-6" aria-hidden /> : <MicOff className="size-6" aria-hidden />}
    </CallControl>
  );
  const camera = (
    <CallControl kind="app" label="Cámara" ariaLabel={cameraEnabled ? "Apagar cámara" : "Activar cámara"} pressed={cameraEnabled} onClick={onToggleCamera}>
      {/* A voice call offers the camera (D3a); a video call with it turned off shows it crossed out. */}
      {cameraEnabled || tipo === "audio" ? <Video className="size-6" aria-hidden /> : <VideoOff className="size-6" aria-hidden />}
    </CallControl>
  );
  const cancel = (
    <CallControl kind="reject" label="Cancelar" ariaLabel="Cancelar llamada" onClick={onCancel}>
      <HangUpIcon size={28} />
    </CallControl>
  );
  const close = (
    <CallControl kind="app" label="Cerrar" ariaLabel="Cerrar" onClick={onClose}>
      <X className="size-6" aria-hidden />
    </CallControl>
  );

  let status: React.ReactNode;
  let detail: string | null = null;
  let buttons: React.ReactNode;
  switch (phase) {
    case "connecting":
      status = (<span className="inline-flex items-center gap-2"><CallDots /><span>Conectando…</span></span>);
      detail = tipo === "video" ? "Si el navegador te lo pide, permite el acceso al micrófono y a la cámara." : "Si el navegador te lo pide, permite el acceso al micrófono.";
      buttons = (<>{mic}{cancel}</>);
      break;
    case "ringing":
      status = (<span className="inline-flex items-center gap-2"><span>{isGroup ? `Llamando a ${others} personas` : "Llamando"}</span><CallDots /></span>);
      buttons = (<>{mic}{cancel}{camera}</>);
      break;
    case "error":
      status = <span className="text-[17px] font-semibold text-[var(--text-primary)]">No se pudo iniciar la llamada</span>;
      detail = "Comprueba tu conexión y vuelve a intentarlo.";
      buttons = (<>{close}<CallControl kind="accept" label="Reintentar" ariaLabel="Reintentar" onClick={onRetry}><RefreshCw className="size-7" aria-hidden /></CallControl></>);
      break;
    case "no-answer":
    case "busy":
    case "rejected": {
      const nombre = firstName(target.nombre);
      const [titulo, texto] = phase === "busy"
        ? ["Línea ocupada", `${nombre} está en otra llamada. Prueba en unos minutos.`]
        : phase === "rejected"
          ? ["Ha rechazado la llamada", `${nombre} no puede hablar ahora. Prueba más tarde.`]
          : [`${nombre} no contesta`, "Déjale un mensaje o prueba más tarde."];
      status = <span className="text-[17px] font-semibold text-[var(--text-primary)]">{titulo}</span>;
      detail = texto;
      buttons = (
        <>
          {close}
          <CallControl kind="accept" label="Volver a llamar" ariaLabel="Volver a llamar" onClick={onRetry}>
            {tipo === "video" ? <Video className="size-7" aria-hidden /> : <Phone className="size-7" aria-hidden />}
          </CallControl>
          <CallControl kind="app" label="Mensaje" ariaLabel="Enviar un mensaje" onClick={onClose}>
            <MessageSquare className="size-6" aria-hidden />
          </CallControl>
        </>
      );
    }
  }

  return (
    <CallScreen
      tipo={tipo}
      ariaLabel={`Llamada a ${target.nombre}`}
      hero={isGroup && group ? { kind: "group", miembros: group } : { kind: "person", id: target.id, nombre: target.nombre, foto: target.foto, pulse: phase === "ringing", dim: phase === "error" }}
      title={target.nombre}
      status={<div role="status" aria-live="polite">{status}</div>}
      extra={detail ? <p className={`m-0 max-w-[280px] text-[14px] leading-[1.45] text-[var(--text-secondary)] ${ended ? "mt-1.5" : "mt-5"}`}>{detail}</p> : undefined}
      buttons={buttons}
      ownVideo={tipo === "video" && cameraEnabled && phase === "ringing" ? ownVideo : undefined}
    />
  );
}
