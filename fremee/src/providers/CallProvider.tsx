"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useCall, type CallState, type CallMiembro } from "@/hooks/useCall";
import CallRoom from "@/components/calls/CallRoom";
import IncomingCall from "@/components/calls/IncomingCall";
import CallWidget from "@/components/calls/CallWidget";

const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "wss://frimee-zxm2er85.livekit.cloud";

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
  const { callState, startCall, joinCall, acceptCall, endCall, markActive } = useCall();
  const [minimized, setMinimized] = useState(false);
  const [widgetDuration, setWidgetDuration] = useState(0);

  const isGroup = callState.status !== "idle" && "miembros" in callState && callState.miembros.length > 2;
  const isInitiator = (callState.status !== "idle" && "isInitiator" in callState && callState.isInitiator) ?? false;
  const isActive = callState.status === "active";

  // Reset minimized when call ends
  useEffect(() => {
    if (callState.status === "idle") {
      setMinimized(false);
      setWidgetDuration(0);
    }
  }, [callState.status]);

  // Drive widget timer independently when minimized
  useEffect(() => {
    if (!minimized || !isActive) return;
    const interval = setInterval(() => setWidgetDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [minimized, isActive]);

  const inCall = callState.status === "outgoing" || callState.status === "active";
  const participanteNombre = inCall && "participanteNombre" in callState ? callState.participanteNombre : "";
  const participanteFoto = inCall && "participanteFoto" in callState ? callState.participanteFoto : undefined;

  return (
    <CallContext.Provider value={{ callState, startCall, joinCall, endCall, minimized, minimize: () => setMinimized(true), expand: () => setMinimized(false) }}>
      {children}

      {callState.status === "incoming" && (
        <IncomingCall
          callerName={callState.callerName}
          callerFoto={callState.callerFoto}
          tipo={callState.tipo}
          onAccept={() => void acceptCall()}
          onReject={() => void endCall()}
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
            isInitiator={isInitiator ?? false}
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
