"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from "livekit-client";
import type { CallMiembro } from "@/hooks/useCall";

type Props = {
  token: string;
  livekitUrl: string;
  tipo: "audio" | "video";
  miembros: CallMiembro[];
  participanteNombre: string;
  isActive?: boolean;
  isInitiator?: boolean;
  isGroup?: boolean;
  onEnd: () => void;
  onEndForAll?: () => void;
  onParticipantConnected?: () => void;
};

type ParticipantTile = {
  identity: string;
  isLocal: boolean;
  audioMuted: boolean;
  videoMuted: boolean;
};

export default function CallRoom({ token, livekitUrl, tipo, miembros, participanteNombre, isActive, isInitiator, isGroup, onEnd, onEndForAll, onParticipantConnected }: Props) {
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [tiles, setTiles] = useState<ParticipantTile[]>([]);
  const [focusedIdentity, setFocusedIdentity] = useState<string | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [cameraOn, setCameraOn] = useState(false); // camera for audio calls
  const [hasAnyVideo, setHasAnyVideo] = useState(tipo === "video"); // show video grid
  const [remoteScreenActive, setRemoteScreenActive] = useState(false);
  const [duration, setDuration] = useState(0);

  const onParticipantConnectedRef = useRef(onParticipantConnected);
  useEffect(() => { onParticipantConnectedRef.current = onParticipantConnected; });
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; });
  const onEndForAllRef = useRef(onEndForAll);
  useEffect(() => { onEndForAllRef.current = onEndForAll; });

  // Stored tracks so we can re-attach when elements remount (grid ↔ focus toggle)
  const trackMap = useRef<Map<string, Track>>(new Map());
  const remoteScreenRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const attachVideo = useCallback((identity: string, el: HTMLVideoElement | null, isLocal: boolean) => {
    if (!el) return;
    if (isLocal) {
      localVideoRef.current = el;
      const t = trackMap.current.get("__local__");
      if (t) t.attach(el);
    } else {
      const t = trackMap.current.get(identity);
      if (t) t.attach(el);
    }
  }, []);

  useEffect(() => {
    if (!token || !livekitUrl) return;

    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    const addTile = (identity: string, isLocal: boolean) => {
      setTiles((prev) => prev.some((t) => t.identity === identity) ? prev : [...prev, { identity, isLocal, audioMuted: false, videoMuted: tipo !== "video" }]);
    };
    const removeTile = (identity: string) => {
      setTiles((prev) => prev.filter((t) => t.identity !== identity));
      setFocusedIdentity((prev) => prev === identity ? null : prev);
    };

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind === Track.Kind.Video) {
        if (track.source === Track.Source.ScreenShare) {
          if (remoteScreenRef.current) track.attach(remoteScreenRef.current);
          setRemoteScreenActive(true);
        } else {
          trackMap.current.set(participant.identity, track);
          setHasAnyVideo(true);
          setTiles((prev) => prev.map((t) => t.identity === participant.identity ? { ...t, videoMuted: false } : t));
          const existingEl = document.querySelector<HTMLVideoElement>(`video[data-identity="${participant.identity}"]`);
          if (existingEl) track.attach(existingEl);
        }
      } else if (track.kind === Track.Kind.Audio) {
        track.attach();
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
        setRemoteScreenActive(false);
      }
    });

    room.on(RoomEvent.TrackMuted, (_pub, participant) => {
      setTiles((prev) => prev.map((t) => t.identity === participant.identity ? { ...t, audioMuted: true } : t));
    });
    room.on(RoomEvent.TrackUnmuted, (_pub, participant) => {
      setTiles((prev) => prev.map((t) => t.identity === participant.identity ? { ...t, audioMuted: false } : t));
    });

    room.on(RoomEvent.Connected, () => {
      if (!cancelled) {
        setConnected(true);
        addTile(room.localParticipant.identity, true);
      }
    });
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) { setConnected(false); onEndRef.current(); }
    });
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (!cancelled) {
        addTile(participant.identity, false);
        onParticipantConnectedRef.current?.();
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (!cancelled) {
        removeTile(participant.identity);
        if (room.remoteParticipants.size === 0) {
          if (isGroup) {
            // Last person left — end for all so the banner clears
            onEndForAllRef.current?.();
          } else {
            onEndRef.current();
          }
        }
      }
    });

    const connect = async () => {
      await room.connect(livekitUrl, token);
      if (cancelled) { room.disconnect(); return; }
      room.remoteParticipants.forEach((p) => addTile(p.identity, false));

      try {
        const audioTrack = await createLocalAudioTrack();
        if (cancelled) { room.disconnect(); return; }
        await room.localParticipant.publishTrack(audioTrack);

        if (tipo === "video") {
          const videoTrack = await createLocalVideoTrack();
          if (cancelled) { room.disconnect(); return; }
          await room.localParticipant.publishTrack(videoTrack);
          trackMap.current.set("__local__", videoTrack);
          if (localVideoRef.current) videoTrack.attach(localVideoRef.current);
        }
      } catch (err) {
        if (!cancelled) console.error("[CallRoom] publish error", err);
      }
    };

    connect().catch(console.error);
    return () => { cancelled = true; room.disconnect(); };
  }, [token, livekitUrl, tipo]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const toggleMute = useCallback(async () => {
    const local = roomRef.current?.localParticipant;
    if (!local) return;
    const muted = local.isMicrophoneEnabled;
    await local.setMicrophoneEnabled(!muted);
    setTiles((prev) => prev.map((t) => t.isLocal ? { ...t, audioMuted: muted } : t));
  }, []);

  const toggleVideo = useCallback(async () => {
    const local = roomRef.current?.localParticipant;
    if (!local) return;
    const enabled = local.isCameraEnabled;
    try {
      await local.setCameraEnabled(!enabled);
      if (!enabled) {
        // Camera just turned on — attach local video track
        const pub = local.getTrackPublication(Track.Source.Camera);
        if (pub?.track && localVideoRef.current) pub.track.attach(localVideoRef.current);
        trackMap.current.set("__local__", pub?.track as Track);
        setHasAnyVideo(true);
        setCameraOn(true);
      } else {
        setCameraOn(false);
      }
    } catch (err) { console.error("[CallRoom] camera toggle error", err); }
    setTiles((prev) => prev.map((t) => t.isLocal ? { ...t, videoMuted: enabled } : t));
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const local = roomRef.current?.localParticipant;
    if (!local) return;
    await local.setScreenShareEnabled(!screenSharing);
    setScreenSharing(!screenSharing);
  }, [screenSharing]);

  const handleEnd = useCallback(() => { roomRef.current?.disconnect(); }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const getMiembro = (identity: string) => miembros.find((m) => m.id === identity);
  const localMuted = tiles.find((t) => t.isLocal)?.audioMuted ?? false;
  const localVideoOff = tiles.find((t) => t.isLocal)?.videoMuted ?? true;
  const showVideo = hasAnyVideo; // show video grid whenever any participant has video

  const renderTile = (tile: ParticipantTile, fullscreen = false) => {
    const miembro = getMiembro(tile.identity);
    const nombre = tile.isLocal ? "Tú" : (miembro?.nombre ?? tile.identity);
    const foto = tile.isLocal ? undefined : miembro?.foto;

    return (
      <div
        key={tile.identity}
        onClick={() => setFocusedIdentity(fullscreen ? null : tile.identity)}
        className={`relative overflow-hidden rounded-2xl bg-[#2a2a2a] flex items-center justify-center cursor-pointer ${fullscreen ? "w-full h-full" : "aspect-square"}`}
      >
        {showVideo && (
          <video
            data-identity={tile.isLocal ? "__local__" : tile.identity}
            autoPlay
            playsInline
            muted={tile.isLocal}
            ref={(el) => {
              if (el) {
                if (tile.isLocal) {
                  localVideoRef.current = el;
                  const t = trackMap.current.get("__local__");
                  if (t) t.attach(el);
                } else {
                  const t = trackMap.current.get(tile.identity);
                  if (t) t.attach(el);
                }
              }
            }}
            className={`absolute inset-0 h-full w-full object-cover ${tile.videoMuted ? "hidden" : ""}`}
          />
        )}

        {(!showVideo || tile.videoMuted) && (
          <div className="flex flex-col items-center gap-2 z-10">
            <div className="h-14 w-14 overflow-hidden rounded-full bg-white/10 border border-white/10">
              {foto ? (
                <img src={foto} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold">
                  {nombre[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
          <span className="text-xs font-medium truncate drop-shadow">{nombre}</span>
          {tile.audioMuted && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60">
              <MicOffSmallIcon />
            </div>
          )}
        </div>
      </div>
    );
  };

  const focusedTile = focusedIdentity ? tiles.find((t) => t.identity === focusedIdentity) : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#1a1a1a] text-white">
      {/* Remote screen share overlay */}
      {remoteScreenActive && (
        <div className="absolute inset-0 z-10 bg-black">
          <video ref={remoteScreenRef} autoPlay playsInline className="h-full w-full object-contain" />
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{participanteNombre}</span>
          <span className="text-xs text-white/50">
            {isActive ? formatDuration(duration) : connected ? "Llamando..." : "Conectando..."}
          </span>
        </div>
        {focusedIdentity && (
          <button onClick={() => setFocusedIdentity(null)} className="text-xs text-white/60 flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            Todos
          </button>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-hidden px-2 pb-2">
        {focusedTile ? (
          // Focused / zoomed tile
          <div className="h-full w-full">
            {renderTile(focusedTile, true)}
          </div>
        ) : (
          // 2-col square grid
          <div className="h-full overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {tiles.map((tile) => renderTile(tile, false))}
              {tiles.length === 0 && miembros.map((m) => (
                <div key={m.id} className="aspect-square overflow-hidden rounded-2xl bg-[#2a2a2a] flex flex-col items-center justify-center gap-2 opacity-50">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-white/10">
                    {m.foto ? <img src={m.foto} className="h-full w-full object-cover" /> : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-bold">{m.nombre[0]?.toUpperCase()}</div>
                    )}
                  </div>
                  <span className="text-xs text-white/40">Llamando...</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 flex items-center justify-center gap-4 pb-10 pt-3 px-4">
        <button onClick={() => void toggleMute()} className={`flex h-13 w-13 items-center justify-center rounded-full transition-all ${localMuted ? "bg-white text-black" : "bg-white/15 text-white"}`}>
          {localMuted ? <MicOffIcon /> : <MicIcon />}
        </button>
        <button onClick={() => void toggleVideo()} className={`flex h-13 w-13 items-center justify-center rounded-full transition-all ${localVideoOff ? "bg-white/15 text-white" : "bg-white text-black"}`}>
          {localVideoOff ? <VideoOffIcon /> : <VideoIcon />}
        </button>
        <button onClick={() => void toggleScreenShare()} className={`flex h-13 w-13 items-center justify-center rounded-full transition-all ${screenSharing ? "bg-white text-black" : "bg-white/15 text-white"}`}>
          {screenSharing ? <ScreenShareOffIcon /> : <ScreenShareIcon />}
        </button>
        {isGroup && isInitiator && (
          <button onClick={() => onEndForAll?.()} className="flex h-12 items-center justify-center rounded-full bg-red-500/20 text-red-400 px-4 text-xs font-medium transition-all hover:bg-red-500/30">
            Terminar
          </button>
        )}
        <button onClick={handleEnd} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40 transition-all hover:bg-red-600 hover:scale-105 active:scale-95">
          <PhoneOffIcon />
        </button>
      </div>
    </div>
  );
}

function MicIcon() {
  return <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6" /></svg>;
}
function MicOffIcon() {
  return <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8"><line x1="2" y1="2" x2="22" y2="22" /><path d="M18.89 13.23A7 7 0 0 0 19 10M5 10a7 7 0 0 0 12 5.27M15 9.34V5a3 3 0 0 0-5.68-1.33M9 9v3a3 3 0 0 0 5.12 2.12" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="9" y1="22" x2="15" y2="22" /></svg>;
}
function MicOffSmallIcon() {
  return <svg viewBox="0 0 24 24" fill="none" className="size-3" stroke="currentColor" strokeWidth="2"><line x1="2" y1="2" x2="22" y2="22" /><path d="M18.89 13.23A7 7 0 0 0 19 10M5 10a7 7 0 0 0 12 5.27M15 9.34V5a3 3 0 0 0-5.68-1.33M9 9v3a3 3 0 0 0 5.12 2.12" /></svg>;
}
function VideoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>;
}
function VideoOffIcon() {
  return <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34" /><path d="M23 7l-7 5 7 5V7z" /><line x1="2" y1="2" x2="22" y2="22" /></svg>;
}
function PhoneOffIcon() {
  return <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8"><path d="M10.68 13.31a16 16 0 0 0 3.01 2.99l1.96-1.96a1 1 0 0 1 1.09-.22 11.3 11.3 0 0 0 3.57.73 1 1 0 0 1 .93 1v3.57a1 1 0 0 1-.9 1A17 17 0 0 1 3 5.9a1 1 0 0 1 1-.9h3.57a1 1 0 0 1 1 .92 11.3 11.3 0 0 0 .73 3.57 1 1 0 0 1-.22 1.09l-1.96 1.96" /><line x1="2" y1="2" x2="22" y2="22" /></svg>;
}
function ScreenShareIcon() {
  return <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /><path d="M10 9l2-2 2 2M12 7v6" /></svg>;
}
function ScreenShareOffIcon() {
  return <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8"><path d="M2 3l20 18M13.5 17H8m4-4.5V17m6-3V5a2 2 0 0 0-2-2H4.5" /><path d="M22 17a2 2 0 0 1-2 2H6" /><path d="M8 21h8" /></svg>;
}
