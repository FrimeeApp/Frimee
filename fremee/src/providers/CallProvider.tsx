"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react";
import { useCall, GuestLimitError, type CallState, type CallMiembro } from "@/hooks/useCall";
import CallRoom from "@/components/calls/CallRoom";
import IncomingCall from "@/components/calls/IncomingCall";
import OutgoingCall, { type OutgoingPhase } from "@/components/calls/OutgoingCall";
import IncomingBanner from "@/components/calls/IncomingBanner";
import GuestLimitSheet from "@/components/calls/GuestLimitSheet";
import CallWidget from "@/components/calls/CallWidget";
import { getLivekitUrl } from "@/config/external";
import { useLivekitRoom, type LivekitRoomApi } from "@/hooks/useLivekitRoom";

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
const CallRoomContext = createContext<LivekitRoomApi | null>(null);

/** The LiveKit room of the current call (connection, participants, controls). */
export function useCallRoom() {
  const ctx = useContext(CallRoomContext);
  if (!ctx) throw new Error("useCallRoom must be used within CallProvider");
  return ctx;
}

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { callState, startCall: startCallInternal, joinCall, acceptCall, endCall, markActive, activeSince, endReason, clearEndReason } = useCall();
  // The last outgoing call: its screen stays after it ends to say why, and "Volver a llamar" repeats it.
  const [lastTarget, setLastTarget] = useState<{ chatId: string; nombre: string; foto?: string; tipo: "audio" | "video"; miembros: CallMiembro[] } | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [incomingMinimized, setIncomingMinimized] = useState(false);
  const [outgoingPending, setOutgoingPending] = useState<{ chatId: string; error?: boolean } | null>(null);
  const [guestLimit, setGuestLimit] = useState(false);
  const cancelledOutgoingChatRef = useRef<string | null>(null);
  const previousCallStatusRef = useRef(callState.status);
  const [now, setNow] = useState(() => Date.now());

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
    clearEndReason();
    setLastTarget({ chatId, nombre: participanteNombre, foto: participanteFoto, tipo, miembros });
    setOutgoingPending({ chatId });
    try {
      await startCallInternal(chatId, tipo, participanteNombre, participanteFoto, miembros);
    } catch (error) {
      console.error("[call] start failed:", error);
      if (error instanceof GuestLimitError) {
        setOutgoingPending(null);
        setGuestLimit(true);
        return;
      }
      setOutgoingPending((pending) => (pending?.chatId === chatId ? { ...pending, error: true } : pending));
    }
  }, [startCallInternal, clearEndReason]);

  useEffect(() => {
    if (callState.status !== "outgoing") return;
    if (cancelledOutgoingChatRef.current !== callState.chatId) return;
    cancelledOutgoingChatRef.current = null;
    void endCall();
  }, [callState, endCall]);

  // The widget shows the real call time (since it was answered), refreshed while minimized.
  useEffect(() => {
    if (!minimized || !isActive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [minimized, isActive]);
  const widgetDuration = activeSince ? Math.max(0, Math.floor((now - activeSince) / 1000)) : 0;

  const inCall = callState.status === "outgoing" || callState.status === "active";
  // The outgoing screen: from preparing to ringing, then why it did not go through.
  const outgoingPhase: OutgoingPhase | null =
    callState.status === "idle" && endReason ? (endReason === "no-answer" ? "no-answer" : endReason)
      : outgoingPending && callState.status !== "incoming" && callState.status !== "active"
        ? outgoingPending.error ? "error" : callState.status === "outgoing" ? "ringing" : "connecting"
        : null;
  const incomingExpanded = callState.status === "incoming" && !incomingMinimized;
  // One LiveKit room per call, shared by the outgoing screen, the room and the widget.
  const roomToken = inCall ? callState.token : null;
  const roomTipo = inCall ? callState.tipo : "audio";
  const roomCamera = inCall ? callState.camera : false;
  const roomOptions = useMemo(() => roomToken ? {
    token: roomToken,
    livekitUrl,
    tipo: roomTipo,
    camera: roomCamera,
    isGroup,
    onParticipantConnected: markActive,
    onEnd: () => void endCall(),
    onEndForAll: () => void endCall(true),
  } : null, [roomToken, roomTipo, roomCamera, isGroup, markActive, endCall]);
  const room = useLivekitRoom(roomOptions);
  const participanteNombre = inCall && "participanteNombre" in callState ? callState.participanteNombre : "";
  const participanteFoto = inCall && "participanteFoto" in callState ? callState.participanteFoto : undefined;
  const attachOwnVideo = useCallback((el: HTMLVideoElement | null) => room.attachTrack("__local__", el), [room]);

  const closeOutgoing = useCallback(() => {
    if (callState.status === "outgoing") {
      void endCall();
      return;
    }
    if (outgoingPending) cancelledOutgoingChatRef.current = outgoingPending.chatId;
    setOutgoingPending(null);
    clearEndReason();
  }, [callState.status, endCall, outgoingPending, clearEndReason]);

  const retryOutgoing = useCallback(() => {
    if (!lastTarget) return;
    void startCall(lastTarget.chatId, lastTarget.tipo, lastTarget.nombre, lastTarget.foto, lastTarget.miembros);
  }, [lastTarget, startCall]);

  useEffect(() => {
    if ((!inCall || minimized) && !incomingExpanded && !outgoingPhase) return;

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
  }, [inCall, incomingExpanded, minimized, outgoingPhase]);

  return (
    <CallContext.Provider value={{ callState, startCall, joinCall, endCall, minimized, minimize: () => setMinimized(true), expand: () => setMinimized(false) }}>
    <CallRoomContext.Provider value={room}>
      {children}

      {/* CallRoom: mounted for the whole call; hidden while it rings (the outgoing screen is on
          top) and while minimized. The connection lives in useLivekitRoom either way. */}
      {inCall && (
        <div style={{ display: minimized || callState.status === "outgoing" ? "none" : "block" }}>
          <CallRoom
            miembros={callState.miembros}
            participanteNombre={participanteNombre}
            tipo={callState.tipo}
            isGroup={isGroup}
            activeSince={activeSince}
            onMinimize={() => setMinimized(true)}
          />
        </div>
      )}

      {outgoingPhase && lastTarget && (
        <OutgoingCall
          phase={outgoingPhase}
          tipo={lastTarget.tipo}
          target={{ id: lastTarget.chatId, nombre: lastTarget.nombre, foto: lastTarget.foto }}
          group={lastTarget.miembros.length > 2 ? lastTarget.miembros : undefined}
          micEnabled={room.micEnabled}
          cameraEnabled={room.cameraEnabled}
          onToggleMic={() => void room.toggleMute()}
          onToggleCamera={() => void room.toggleVideo()}
          ownVideo={attachOwnVideo}
          onCancel={closeOutgoing}
          onClose={closeOutgoing}
          onRetry={retryOutgoing}
        />
      )}

      {callState.status === "incoming" && !incomingMinimized && (
        <IncomingCall
          tipo={callState.tipo}
          caller={{ id: callState.callerId, nombre: callState.callerName, foto: callState.callerFoto }}
          plan={callState.chatTipo === "PLAN" ? callState.chatNombre : null}
          group={callState.chatTipo === "GRUPO" ? callState.miembros : null}
          onAccept={(withCamera) => {
            setIncomingMinimized(false);
            void acceptCall(withCamera);
          }}
          onReject={() => void endCall()}
          onMinimize={() => setIncomingMinimized(true)}
        />
      )}

      {callState.status === "incoming" && incomingMinimized && (
        <IncomingBanner
          tipo={callState.tipo}
          caller={{ id: callState.callerId, nombre: callState.callerName, foto: callState.callerFoto }}
          onOpen={() => setIncomingMinimized(false)}
          onAccept={() => {
            setIncomingMinimized(false);
            void acceptCall(true);
          }}
          onReject={() => void endCall()}
        />
      )}

      {guestLimit && (
        <GuestLimitSheet
          onClose={() => setGuestLimit(false)}
          onCreateAccount={() => {
            setGuestLimit(false);
            window.dispatchEvent(new Event("frimee:save-account"));
          }}
        />
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
    </CallRoomContext.Provider>
    </CallContext.Provider>
  );
}
