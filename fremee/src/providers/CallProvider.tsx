"use client";

import { createContext, useContext } from "react";
import { useCall, type CallState, type CallMiembro } from "@/hooks/useCall";
import CallRoom from "@/components/calls/CallRoom";
import IncomingCall from "@/components/calls/IncomingCall";

const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "wss://frimee-zxm2er85.livekit.cloud";

type CallContextValue = {
  callState: CallState;
  startCall: (chatId: string, tipo?: "audio" | "video", participanteNombre?: string, participanteFoto?: string, miembros?: CallMiembro[]) => Promise<void>;
  joinCall: (llamadaId: number, roomName: string, chatId: string, tipo: "audio" | "video", participanteNombre: string, participanteFoto: string | undefined, miembros: CallMiembro[]) => Promise<void>;
  endCall: (endForAll?: boolean) => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { callState, startCall, joinCall, acceptCall, endCall, markActive } = useCall();

  const isGroup = callState.status !== "idle" && "miembros" in callState && callState.miembros.length > 2;
  const isInitiator = callState.status !== "idle" && "isInitiator" in callState ? callState.isInitiator : false;

  return (
    <CallContext.Provider value={{ callState, startCall, joinCall, endCall }}>
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

      {(callState.status === "outgoing" || callState.status === "active") && (
        <CallRoom
          token={callState.token}
          livekitUrl={livekitUrl}
          tipo={callState.tipo}
          miembros={callState.miembros}
          participanteNombre={callState.participanteNombre}
          isActive={callState.status === "active"}
          isInitiator={isInitiator ?? false}
          isGroup={isGroup}
          onEnd={() => void endCall()}
          onEndForAll={() => void endCall(true)}
          onParticipantConnected={markActive}
        />
      )}
    </CallContext.Provider>
  );
}
