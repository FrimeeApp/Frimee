"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react";
import { useCall, GuestLimitError, type CallState, type CallMiembro } from "@/hooks/useCall";
import CallRoom from "@/components/calls/CallRoom";
import IncomingCall from "@/components/calls/IncomingCall";
import OutgoingCall, { type OutgoingPhase } from "@/components/calls/OutgoingCall";
import IncomingBanner from "@/components/calls/IncomingBanner";
import GuestLimitSheet from "@/components/calls/GuestLimitSheet";
import CallPill from "@/components/calls/CallPill";
import CallEnded, { type EndedCall } from "@/components/calls/CallEnded";
import PermissionSheet from "@/components/calls/PermissionSheet";
import { useAuth } from "@/providers/AuthProvider";
import { Capacitor } from "@capacitor/core";
import { startRingback, stopRingback } from "@/lib/ringback";
import { canChooseCallOutput, resetCallAudio, setCallSpeaker } from "@/services/native/callNative";
import { cancelIncomingCall, onCallNotificationAction, parseCallUrl, startRinging, stopRinging, startOngoingCall, stopOngoingCall, takePendingCallLink, updateOngoingCall } from "@/services/native/callNative";
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
  const { callState, startCall: startCallInternal, joinCall, acceptCall, endCall, markActive, openFromNotification, activeSince, endReason, clearEndReason } = useCall();
  // The last outgoing call: its screen stays after it ends to say why, and "Volver a llamar" repeats it.
  const [lastTarget, setLastTarget] = useState<{ chatId: string; nombre: string; foto?: string; tipo: "audio" | "video"; miembros: CallMiembro[] } | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [incomingMinimized, setIncomingMinimized] = useState(false);
  const [outgoingPending, setOutgoingPending] = useState<{ chatId: string; error?: boolean } | null>(null);
  const [guestLimit, setGuestLimit] = useState(false);
  const cancelledOutgoingChatRef = useRef<string | null>(null);
  const previousCallStatusRef = useRef(callState.status);
  const { profile, user } = useAuth();
  const myId = profile?.id ?? null;
  // The session (not only the cached profile): needed to read and answer a call.
  const sessionUserId = user?.id ?? null;
  // The end-of-call screen (M16, D16), from what the call looked like just before it ended.
  const [ended, setEnded] = useState<(EndedCall & { rejoin?: Parameters<CallContextValue["joinCall"]> }) | null>(null);
  const lastActiveRef = useRef<{ snapshot: EndedCall; rejoin: Parameters<CallContextValue["joinCall"]>; since: number | null; remotes: number } | null>(null);
  const iHungUpRef = useRef(false);

  const isGroup = callState.status !== "idle" && "miembros" in callState && callState.miembros.length > 2;

  // Reset minimized when call ends
  useEffect(() => {
    const previousStatus = previousCallStatusRef.current;
    previousCallStatusRef.current = callState.status;
    if (callState.status !== "idle" || previousStatus === "idle") return;

    const last = previousStatus === "active" ? lastActiveRef.current : null;
    const iHungUp = iHungUpRef.current;
    iHungUpRef.current = false;
    lastActiveRef.current = null;
    const resetTimer = setTimeout(() => {
      if (last) {
        const duration = last.since ? Math.max(0, Math.floor((Date.now() - last.since) / 1000)) : 0;
        const stillInside = last.snapshot.group && iHungUp ? last.remotes : 0;
        setEnded({ ...last.snapshot, duration, stillInside, rejoin: stillInside > 0 ? last.rejoin : undefined });
      }
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

  // You hang up (room, pill, permission sheet): noted, so leaving a group call that goes on
  // shows "Has salido de la llamada" instead of "Llamada finalizada".
  const hangUp = useCallback(() => {
    iHungUpRef.current = true;
    if (callState.status === "active") room.disconnect();
    else void endCall();
  }, [callState.status, room, endCall]);
  const roomApi = useMemo(() => ({ ...room, disconnect: hangUp }), [room, hangUp]);

  const remoteTiles = room.tiles.filter((t) => !t.isLocal && !t.isScreenShare);
  const others = inCall ? callState.miembros.filter((m) => m.id !== myId) : [];
  const persona = !isGroup && inCall ? {
    id: remoteTiles[0]?.identity ?? others[0]?.id ?? callState.chatId,
    nombre: participanteNombre,
    foto: participanteFoto,
  } : undefined;
  useEffect(() => {
    if (callState.status !== "active") return;
    lastActiveRef.current = {
      snapshot: { title: participanteNombre, persona, group: isGroup ? others : undefined, duration: 0, stillInside: 0 },
      rejoin: [callState.llamadaId ?? 0, callState.roomName, callState.chatId, callState.tipo, participanteNombre, participanteFoto, callState.miembros],
      since: activeSince,
      remotes: remoteTiles.length,
    };
  });

  // ── Android (board M19) ──
  // Opened from the call notification: fremee://call/incoming|answer?llamada=… The native side
  // keeps the link (Capacitor's launch URL can only be read once, and another screen reads it);
  // it is taken on start and every time Frimee comes to the front. Kept here until the session
  // is there: a cold start loads it after the link arrives.
  const [pendingCallLink, setPendingCallLink] = useState<{ llamadaId: number; answer: boolean } | null>(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const take = (url: string | null) => {
      const link = parseCallUrl(url);
      if (link) setPendingCallLink(link);
    };
    const check = () => {
      if (document.visibilityState === "visible") void takePendingCallLink().then(take);
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);
  useEffect(() => {
    if (!pendingCallLink || !sessionUserId) return;
    const link = pendingCallLink;
    const t = setTimeout(() => {
      setPendingCallLink(null);
      void openFromNotification(link.llamadaId, link.answer);
    }, 0);
    return () => clearTimeout(t);
  }, [pendingCallLink, sessionUserId, openFromNotification]);

  // The app took the call: answered, or ringing on its own screen while Frimee is on screen. In the
  // background the notification stays (the app's screen is not seen; realtime still runs there).
  const ringingId = callState.status === "incoming" ? callState.llamadaId : null;
  const answeredId = callState.status === "active" ? callState.llamadaId : null;
  useEffect(() => {
    if (answeredId) void cancelIncomingCall(answeredId);
  }, [answeredId]);
  // Frimee shows the ringing call: it rings itself (the notification, and its sound, go away).
  // Once ringing it keeps on in the background too, until the call stops ringing here.
  useEffect(() => {
    if (!ringingId) return;
    let ringing = false;
    const takeOver = () => {
      if (document.visibilityState !== "visible") return;
      void cancelIncomingCall(ringingId);
      if (!ringing) {
        ringing = true;
        void startRinging();
      }
    };
    takeOver();
    document.addEventListener("visibilitychange", takeOver);
    return () => {
      document.removeEventListener("visibilitychange", takeOver);
      if (ringing) void stopRinging();
    };
  }, [ringingId]);

  // The caller hears a ringback tone while the other side rings; it stops as soon as the call
  // leaves "outgoing" (answered, rejected, busy, no answer or hung up).
  const outgoingId = callState.status === "outgoing" ? callState.llamadaId : null;
  useEffect(() => {
    if (!outgoingId) return;
    startRingback();
    return () => stopRingback();
  }, [outgoingId]);

  // Where the call is heard (Android app): a voice call starts at the ear, a video call on the
  // loudspeaker, as on a phone; the speaker button changes it for this call.
  const activeRoomName = callState.status === "active" ? callState.roomName : null;
  const activeTipo = callState.status === "active" ? callState.tipo : null;
  const [speakerChoice, setSpeakerChoice] = useState<{ roomName: string; on: boolean } | null>(null);
  const speakerOn = speakerChoice && speakerChoice.roomName === activeRoomName ? speakerChoice.on : activeTipo === "video";
  const toggleSpeaker = useCallback(() => {
    if (activeRoomName) setSpeakerChoice({ roomName: activeRoomName, on: !speakerOn });
  }, [activeRoomName, speakerOn]);
  useEffect(() => {
    if (!activeRoomName) return;
    void setCallSpeaker(speakerOn);
    // The WebView switches the loudspeaker back on when it (re)opens the microphone or camera:
    // apply it again once the media has settled.
    const again = setTimeout(() => void setCallSpeaker(speakerOn), 1500);
    return () => clearTimeout(again);
  }, [activeRoomName, speakerOn, room.micEnabled, room.cameraEnabled]);
  useEffect(() => {
    if (!activeRoomName) return;
    return () => void resetCallAudio();
  }, [activeRoomName]);

  // In a call: the ongoing-call notification and its foreground service, so Android keeps the
  // microphone working when you leave the app (M19b).
  const ongoingRef = useRef(false);
  const ongoing = callState.status === "active" ? {
    title: isGroup ? `Llamada con ${participanteNombre}` : participanteNombre,
    subtitle: isGroup ? `${remoteTiles.length + 1} personas · Toca para volver` : "Toca para volver",
    video: room.cameraEnabled,
    muted: !room.micEnabled,
  } : null;
  const ongoingKey = ongoing ? JSON.stringify(ongoing) : null;
  useEffect(() => {
    if (!ongoingKey) {
      if (ongoingRef.current) {
        ongoingRef.current = false;
        void stopOngoingCall();
      }
      return;
    }
    const options = JSON.parse(ongoingKey) as Parameters<typeof startOngoingCall>[0];
    if (ongoingRef.current) void updateOngoingCall(options);
    else {
      ongoingRef.current = true;
      void startOngoingCall(options);
    }
  }, [ongoingKey]);

  // "Silenciar" / "Colgar" in that notification.
  const notificationActionsRef = useRef({ toggleMute: room.toggleMute, hangUp });
  useEffect(() => { notificationActionsRef.current = { toggleMute: room.toggleMute, hangUp }; });
  useEffect(() => onCallNotificationAction((action) => {
    if (action === "mute") void notificationActionsRef.current.toggleMute();
    else notificationActionsRef.current.hangUp();
  }), []);

  // The app's "+" button goes up while the pill is on screen (phones), so they do not overlap.
  const pillVisible = inCall && minimized;
  useEffect(() => {
    if (!pillVisible) return;
    document.body.setAttribute("data-call-pill", "true");
    return () => document.body.removeAttribute("data-call-pill");
  }, [pillVisible]);

  const closeOutgoing = useCallback(() => {
    if (callState.status === "outgoing") {
      void endCall();
      return;
    }
    if (outgoingPending) cancelledOutgoingChatRef.current = outgoingPending.chatId;
    setOutgoingPending(null);
    clearEndReason();
  }, [callState.status, endCall, outgoingPending, clearEndReason]);

  const closeEnded = useCallback(() => setEnded(null), []);

  const retryOutgoing = useCallback(() => {
    if (!lastTarget) return;
    void startCall(lastTarget.chatId, lastTarget.tipo, lastTarget.nombre, lastTarget.foto, lastTarget.miembros);
  }, [lastTarget, startCall]);

  // Any call screen open (room, ringing, end of call, permission sheet): the app hides its
  // bottom navigation and floating buttons, which sit above everything else.
  const endedVisible = !!ended && callState.status === "idle";
  const permissionOpen = inCall && !!room.blocked;
  useEffect(() => {
    if ((!inCall || minimized) && !incomingExpanded && !outgoingPhase && !endedVisible && !permissionOpen) return;

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
  }, [inCall, incomingExpanded, minimized, outgoingPhase, endedVisible, permissionOpen]);

  return (
    <CallContext.Provider value={{ callState, startCall, joinCall, endCall, minimized, minimize: () => setMinimized(true), expand: () => setMinimized(false) }}>
    <CallRoomContext.Provider value={roomApi}>
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
            speakerOn={speakerOn}
            onToggleSpeaker={canChooseCallOutput() ? toggleSpeaker : undefined}
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
          waitingPermission={room.blocked === "mic"}
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

      {/* Minimized: the pill (C3, M13, D13). */}
      {pillVisible && (
        <CallPill
          title={participanteNombre}
          persona={persona}
          group={isGroup ? others : undefined}
          activeSince={activeSince}
          muted={!room.micEnabled}
          reconnecting={room.reconnecting}
          sharing={room.screenSharing}
          onExpand={() => setMinimized(false)}
          onEnd={hangUp}
        />
      )}

      {/* The browser or the phone refused the microphone or the camera (M17, D17). */}
      {inCall && room.blocked && (
        <PermissionSheet
          kind={room.blocked}
          tipo={callState.tipo}
          onRetry={() => void room.retryMedia()}
          onDismiss={room.blocked === "mic" ? hangUp : room.dismissBlocked}
        />
      )}

      {ended && endedVisible && (
        <CallEnded
          call={ended}
          onClose={closeEnded}
          onRejoin={ended.rejoin ? () => {
            const args = ended.rejoin!;
            setEnded(null);
            void joinCall(...args);
          } : undefined}
        />
      )}
    </CallRoomContext.Provider>
    </CallContext.Provider>
  );
}
