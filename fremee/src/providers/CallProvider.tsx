"use client";

import { createContext, useCallback, useContext, useRef, useState, useEffect } from "react";
import { useCall, type CallState, type CallMiembro } from "@/hooks/useCall";
import CallRoom from "@/components/calls/CallRoom";
import IncomingCall from "@/components/calls/IncomingCall";
import OutgoingCall from "@/components/calls/OutgoingCall";
import CallWidget from "@/components/calls/CallWidget";
import { getLivekitUrl } from "@/config/external";

const livekitUrl = getLivekitUrl();

type CallContextValue = {
  callState: CallState;
  startCall: (chatId: string, tipo?: "audio" | "video", participanteNombre?: string, participanteFoto?: string, miembros?: CallMiembro[]) => Promise<void>;
  joinCall: (llamadaId: number, roomName: string, chatId: string, tipo: "audio" | "video", participanteNombre: string, participanteFoto: string | undefined, miembros: CallMiembro[]) => Promise<void>;
  endCall: (endForAll?: boolean) => Promise<void>;
  minimized: boolean;
  minimize: () => void;
  expand: () => void;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { callState, startCall: startCallInternal, joinCall, acceptCall, endCall, markActive } = useCall();
  const [minimized, setMinimized] = useState(false);
  const [incomingMinimized, setIncomingMinimized] = useState(false);
  const [outgoingPending, setOutgoingPending] = useState<{
    chatId: string;
    tipo: "audio" | "video";
    participanteNombre: string;
    participanteFoto?: string;
    error?: string;
  } | null>(null);
  const cancelledOutgoingChatRef = useRef<string | null>(null);
  const previousCallStatusRef = useRef(callState.status);
  const [widgetDuration, setWidgetDuration] = useState(0);

  const isGroup = callState.status !== "idle" && "miembros" in callState && callState.miembros.length > 2;
  const isActive = callState.status === "active";

  // Reset minimized when call ends
  useEffect(() => {
    const previousStatus = previousCallStatusRef.current;
    previousCallStatusRef.current = callState.status;
    if (callState.status !== "idle" || previousStatus === "idle") return;

    const resetTimer = setTimeout(() => {
      setMinimized(false);
      setIncomingMinimized(false);
      setOutgoingPending(null);
      cancelledOutgoingChatRef.current = null;
      setWidgetDuration(0);
    }, 0);
    return () => clearTimeout(resetTimer);
  }, [callState.status]);

  const startCall = useCallback<CallContextValue["startCall"]>(async (
    chatId,
    tipo = "audio",
    participanteNombre = "Usuario",
    participanteFoto,
    miembros = [],
  ) => {
    cancelledOutgoingChatRef.current = null;
    setOutgoingPending({ chatId, tipo, participanteNombre, participanteFoto });
    try {
      await startCallInternal(chatId, tipo, participanteNombre, participanteFoto, miembros);
    } catch (error) {
      console.error("[call] start failed:", error);
      setOutgoingPending((pending) =>
        pending?.chatId === chatId
          ? {
              ...pending,
              error: "No se pudo conectar la llamada. Revisa la conexion e intentalo de nuevo.",
            }
          : pending,
      );
    }
  }, [startCallInternal]);

  useEffect(() => {
    if (callState.status !== "outgoing") return;
    if (cancelledOutgoingChatRef.current !== callState.chatId) return;
    cancelledOutgoingChatRef.current = null;
    void endCall();
  }, [callState, endCall]);

  // Drive widget timer independently when minimized
  useEffect(() => {
    if (!minimized || !isActive) return;
    const interval = setInterval(() => setWidgetDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [minimized, isActive]);

  const inCall = callState.status === "outgoing" || callState.status === "active";
  const preparingOutgoing = outgoingPending !== null && callState.status !== "incoming" && callState.status !== "active";
  const incomingExpanded = callState.status === "incoming" && !incomingMinimized;
  const participanteNombre = inCall && "participanteNombre" in callState ? callState.participanteNombre : "";
  const participanteFoto = inCall && "participanteFoto" in callState ? callState.participanteFoto : undefined;

  useEffect(() => {
    if ((!inCall || minimized) && !incomingExpanded && !preparingOutgoing) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const hadCallOverlayOpen = document.body.hasAttribute("data-call-overlay-open");

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.setAttribute("data-call-overlay-open", "true");

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      if (!hadCallOverlayOpen) {
        document.body.removeAttribute("data-call-overlay-open");
      }
    };
  }, [inCall, incomingExpanded, minimized, preparingOutgoing]);

  return (
    <CallContext.Provider value={{ callState, startCall, joinCall, endCall, minimized, minimize: () => setMinimized(true), expand: () => setMinimized(false) }}>
      {children}

      {outgoingPending && callState.status !== "incoming" && callState.status !== "active" && (
        <OutgoingCall
          participantName={outgoingPending.participanteNombre}
          participantFoto={outgoingPending.participanteFoto}
          tipo={outgoingPending.tipo}
          statusText={outgoingPending.error ?? (callState.status === "outgoing" ? "Llamando..." : "Conectando...")}
          hasError={Boolean(outgoingPending.error)}
          onCancel={() => {
            if (callState.status === "outgoing") {
              void endCall();
              return;
            }
            cancelledOutgoingChatRef.current = outgoingPending.chatId;
            setOutgoingPending(null);
          }}
        />
      )}

      {callState.status === "incoming" && !incomingMinimized && (
        <IncomingCall
          callerName={callState.callerName}
          callerFoto={callState.callerFoto}
          tipo={callState.tipo}
          onAccept={() => {
            setIncomingMinimized(false);
            void acceptCall();
          }}
          onReject={() => void endCall()}
          onMinimize={() => setIncomingMinimized(true)}
        />
      )}

      {callState.status === "incoming" && incomingMinimized && (
        <CallWidget
          participanteNombre={callState.callerName}
          participanteFoto={callState.callerFoto}
          duration={0}
          isActive={false}
          statusLabel={callState.tipo === "video" ? "Videollamada entrante" : "Llamada entrante"}
          onExpand={() => setIncomingMinimized(false)}
          onEnd={() => void endCall()}
        />
      )}

      {/* CallRoom: always mounted when in call, hidden via CSS when minimized so LiveKit stays connected */}
      {inCall && (
        <div style={{ display: minimized ? "none" : "block" }}>
          <CallRoom
            token={callState.token}
            livekitUrl={livekitUrl}
            tipo={callState.tipo}
            miembros={callState.miembros}
            participanteNombre={participanteNombre}
            isActive={isActive}
            isGroup={isGroup}
            onEnd={() => void endCall()}
            onEndForAll={() => void endCall(true)}
            onParticipantConnected={markActive}
            onMinimize={() => setMinimized(true)}
          />
        </div>
      )}

      {/* Floating widget when minimized */}
      {inCall && minimized && (
        <CallWidget
          participanteNombre={participanteNombre}
          participanteFoto={participanteFoto}
          duration={widgetDuration}
          isActive={isActive}
          onExpand={() => setMinimized(false)}
          onEnd={() => void endCall()}
        />
      )}
    </CallContext.Provider>
  );
}
