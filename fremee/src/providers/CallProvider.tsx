"use client";

import { createContext, useContext } from "react";
import { useCall, type CallState } from "@/hooks/useCall";
import CallRoom from "@/components/calls/CallRoom";
import IncomingCall from "@/components/calls/IncomingCall";

const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "wss://frimee-zxm2er85.livekit.cloud";

type CallContextValue = {
  callState: CallState;
  startCall: (chatId: string, tipo?: "audio" | "video") => Promise<void>;
  endCall: () => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { callState, startCall, acceptCall, endCall } = useCall();

  return (
    <CallContext.Provider value={{ callState, startCall, endCall }}>
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
          participantes={[]}
          onEnd={() => void endCall()}
        />
      )}
    </CallContext.Provider>
  );
}
