"use client";

import Image from "next/image";
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
  isGroup?: boolean;
  onEnd: () => void;
  onEndForAll?: () => void;
  onParticipantConnected?: () => void;
  onMinimize?: () => void;
};

type ParticipantTile = {
  id: string;            // unique: identity or `${identity}:screen`
  identity: string;
  isLocal: boolean;
  isScreenShare: boolean;
  audioMuted: boolean;
  videoMuted: boolean;
};

export default function CallRoom({ token, livekitUrl, tipo, miembros, participanteNombre, isActive, isGroup, onEnd, onEndForAll, onParticipantConnected, onMinimize }: Props) {
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [tiles, setTiles] = useState<ParticipantTile[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [, setCameraOn] = useState(false);
  const [hasAnyVideo, setHasAnyVideo] = useState(tipo === "video");
  const [duration, setDuration] = useState(0);

  const onParticipantConnectedRef = useRef(onParticipantConnected);
  useEffect(() => { onParticipantConnectedRef.current = onParticipantConnected; });
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; });
  const onEndForAllRef = useRef(onEndForAll);
  useEffect(() => { onEndForAllRef.current = onEndForAll; });

  // trackMap keys:
  //   "__local__"        → local camera track
  //   "__local__:screen" → local screen share track
  //   "{identity}"       → remote camera track
  //   "{identity}:screen"→ remote screen share track
  const trackMap = useRef<Map<string, Track>>(new Map());

  const addTile = useCallback((id: string, identity: string, isLocal: boolean, isScreenShare: boolean) => {
    setTiles((prev) => prev.some((t) => t.id === id) ? prev : [
      ...prev,
      { id, identity, isLocal, isScreenShare, audioMuted: false, videoMuted: isScreenShare ? false : tipo !== "video" },
    ]);
  }, [tipo]);

  const removeTile = useCallback((id: string) => {
    setTiles((prev) => prev.filter((t) => t.id !== id));
    setFocusedId((prev) => prev === id ? null : prev);
  }, []);

  const attachTrack = useCallback((trackKey: string, el: HTMLVideoElement | null) => {
    if (!el) return;
    const t = trackMap.current.get(trackKey);
    if (t) t.attach(el);
  }, []);

  useEffect(() => {
    if (!token || !livekitUrl) return;
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind === Track.Kind.Video) {
        if (track.source === Track.Source.ScreenShare) {
          const tileId = `${participant.identity}:screen`;
          trackMap.current.set(tileId, track);
          addTile(tileId, participant.identity, false, true);
          // attach if element already mounted
          const el = document.querySelector<HTMLVideoElement>(`video[data-tile="${tileId}"]`);
          if (el) track.attach(el);
        } else {
          trackMap.current.set(participant.identity, track);
          setHasAnyVideo(true);
          setTiles((prev) => prev.map((t) => t.id === participant.identity ? { ...t, videoMuted: false } : t));
          const el = document.querySelector<HTMLVideoElement>(`video[data-tile="${participant.identity}"]`);
          if (el) track.attach(el);
        }
      } else if (track.kind === Track.Kind.Audio) {
        track.attach();
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
      if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
        removeTile(`${participant.identity}:screen`);
      }
    });

    room.on(RoomEvent.TrackMuted, (_pub, participant) => {
      setTiles((prev) => prev.map((t) => t.identity === participant.identity && !t.isScreenShare ? { ...t, audioMuted: true } : t));
    });
    room.on(RoomEvent.TrackUnmuted, (_pub, participant) => {
      setTiles((prev) => prev.map((t) => t.identity === participant.identity && !t.isScreenShare ? { ...t, audioMuted: false } : t));
    });

    room.on(RoomEvent.Connected, () => {
      if (!cancelled) {
        setConnected(true);
        addTile(room.localParticipant.identity, room.localParticipant.identity, true, false);
      }
    });
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) { setConnected(false); onEndRef.current(); }
    });
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (!cancelled) {
        addTile(participant.identity, participant.identity, false, false);
        onParticipantConnectedRef.current?.();
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (!cancelled) {
        removeTile(participant.identity);
        removeTile(`${participant.identity}:screen`);
        if (room.remoteParticipants.size === 0) {
          if (isGroup) onEndForAllRef.current?.();
          else onEndRef.current();
        }
      }
    });

    const connect = async () => {
      await room.connect(livekitUrl, token);
      if (cancelled) { room.disconnect(); return; }
      room.remoteParticipants.forEach((p) => {
        addTile(p.identity, p.identity, false, false);
        // attach any already-published screen share
        p.getTrackPublications().forEach((pub) => {
          if (pub.track && pub.source === Track.Source.ScreenShare) {
            const tileId = `${p.identity}:screen`;
            trackMap.current.set(tileId, pub.track);
            addTile(tileId, p.identity, false, true);
          }
        });
      });

      try {
        const audioTrack = await createLocalAudioTrack();
        if (cancelled) { room.disconnect(); return; }
        await room.localParticipant.publishTrack(audioTrack);

        if (tipo === "video") {
          const videoTrack = await createLocalVideoTrack();
          if (cancelled) { room.disconnect(); return; }
          await room.localParticipant.publishTrack(videoTrack);
          trackMap.current.set("__local__", videoTrack);
          const el = document.querySelector<HTMLVideoElement>(`video[data-tile="${room.localParticipant.identity}"]`);
          if (el) videoTrack.attach(el);
        }
      } catch (err) {
        if (!cancelled) console.error("[CallRoom] publish error", err);
      }
    };

    connect().catch(console.error);
    return () => { cancelled = true; room.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setTiles((prev) => prev.map((t) => t.isLocal && !t.isScreenShare ? { ...t, audioMuted: muted } : t));
  }, []);

  const toggleVideo = useCallback(async () => {
    const local = roomRef.current?.localParticipant;
    if (!local) return;
    const enabled = local.isCameraEnabled;
    try {
      await local.setCameraEnabled(!enabled);
      if (!enabled) {
        const pub = local.getTrackPublication(Track.Source.Camera);
        if (pub?.track) {
          trackMap.current.set("__local__", pub.track);
          const el = document.querySelector<HTMLVideoElement>(`video[data-tile="${local.identity}"]`);
          if (el) pub.track.attach(el);
        }
        setHasAnyVideo(true);
        setCameraOn(true);
        setTiles((prev) => prev.map((t) => t.isLocal && !t.isScreenShare ? { ...t, videoMuted: false } : t));
      } else {
        setCameraOn(false);
        setTiles((prev) => prev.map((t) => t.isLocal && !t.isScreenShare ? { ...t, videoMuted: true } : t));
      }
    } catch (err) { console.error("[CallRoom] camera toggle error", err); }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const local = roomRef.current?.localParticipant;
    if (!local) return;
    try {
      if (!screenSharing) {
        await local.setScreenShareEnabled(true);
        const pub = local.getTrackPublication(Track.Source.ScreenShare);
        if (pub?.track) {
          const tileId = `${local.identity}:screen`;
          trackMap.current.set(tileId, pub.track);
          addTile(tileId, local.identity, true, true);
          const el = document.querySelector<HTMLVideoElement>(`video[data-tile="${tileId}"]`);
          if (el) pub.track.attach(el);
        }
        setScreenSharing(true);
      } else {
        await local.setScreenShareEnabled(false);
        removeTile(`${local.identity}:screen`);
        setScreenSharing(false);
      }
    } catch (err) { console.error("[CallRoom] screen share error", err); }
  }, [screenSharing, addTile, removeTile]);

  const handleEnd = useCallback(() => { roomRef.current?.disconnect(); }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const getMiembro = (identity: string) => miembros.find((m) => m.id === identity);
  const localTile = tiles.find((t) => t.isLocal && !t.isScreenShare);
  const localMuted = localTile?.audioMuted ?? false;
  const localVideoOff = localTile?.videoMuted ?? true;
  const showVideo = hasAnyVideo;

  const renderTile = (tile: ParticipantTile, fullscreen = false) => {
    const miembro = getMiembro(tile.identity);
    const baseName = tile.isLocal ? "Tú" : (miembro?.nombre ?? tile.identity);
    const nombre = tile.isScreenShare ? `Pantalla de ${baseName}` : baseName;
    const foto = tile.isLocal ? undefined : miembro?.foto;
    const trackKey = tile.isScreenShare
      ? (tile.isLocal ? `${tile.identity}:screen` : `${tile.identity}:screen`)
      : (tile.isLocal ? "__local__" : tile.identity);

    return (
      <div
        key={tile.id}
        onClick={() => setFocusedId(fullscreen ? null : tile.id)}
        className={`relative overflow-hidden rounded-2xl bg-black flex items-center justify-center cursor-pointer ${fullscreen ? "w-full h-full" : tile.isScreenShare ? "col-span-2 aspect-video" : "aspect-square"}`}
      >
        {/* Video element — always rendered for screen share, conditional for camera */}
        {(tile.isScreenShare || showVideo) && (
          <video
            data-tile={tile.id}
            autoPlay
            playsInline
            muted={tile.isLocal}
            ref={(el) => { if (el) attachTrack(trackKey, el); }}
            className={`absolute inset-0 h-full w-full ${tile.isScreenShare ? "object-contain bg-black" : "object-cover"} ${!tile.isScreenShare && tile.videoMuted ? "hidden" : ""}`}
          />
        )}

        {/* Avatar — only for non-screen-share tiles when video is off */}
        {!tile.isScreenShare && (!showVideo || tile.videoMuted) && (
          <div className="flex flex-col items-center gap-2 z-10">
            <div className="h-14 w-14 overflow-hidden rounded-full bg-white/10 border border-white/10">
              {foto ? (
                <Image src={foto} alt={baseName} width={56} height={56} className="h-full w-full object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold">
                  {baseName[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Screen share icon overlay (top-left badge) */}
        {tile.isScreenShare && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1">
            <ScreenShareIcon small />
          </div>
        )}

        {/* Bottom bar: name + mic status */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
          <span className="text-xs font-medium truncate drop-shadow">{nombre}</span>
          {!tile.isScreenShare && tile.audioMuted && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60">
              <MicOffSmallIcon />
            </div>
          )}
        </div>
      </div>
    );
  };

  const focusedTile = focusedId ? tiles.find((t) => t.id === focusedId) : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#1a1a1a] text-white">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{participanteNombre}</span>
          <span className="text-xs text-white/50">
            {isActive ? formatDuration(duration) : connected ? "Llamando..." : "Conectando..."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {focusedId && (
            <button onClick={() => setFocusedId(null)} className="text-xs text-white/60 flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              Todos
            </button>
          )}
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="flex size-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
              aria-label="Minimizar"
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-hidden px-2 pb-2">
        {focusedTile ? (
          <div className="h-full w-full">
            {renderTile(focusedTile, true)}
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {tiles.map((tile) => renderTile(tile, false))}
              {tiles.length === 0 && miembros.map((m) => (
                <div key={m.id} className="aspect-square overflow-hidden rounded-2xl bg-[#2a2a2a] flex flex-col items-center justify-center gap-2 opacity-50">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-white/10">
                    {m.foto ? <Image src={m.foto} alt={m.nombre} width={56} height={56} className="h-full w-full object-cover" unoptimized /> : (
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
        <button onClick={() => void toggleVideo()} className={`flex h-13 w-13 items-center justify-center rounded-full transition-all ${!localVideoOff ? "bg-white text-black" : "bg-white/15 text-white"}`}>
          {localVideoOff ? <VideoOffIcon /> : <VideoIcon />}
        </button>
        <button onClick={() => void toggleScreenShare()} className={`flex h-13 w-13 items-center justify-center rounded-full transition-all ${screenSharing ? "bg-white text-black" : "bg-white/15 text-white"}`}>
          {screenSharing ? <ScreenShareOffIcon /> : <ScreenShareIcon />}
        </button>
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
function ScreenShareIcon({ small }: { small?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" className={small ? "size-3" : "size-6"} stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /><path d="M10 9l2-2 2 2M12 7v6" /></svg>;
}
function ScreenShareOffIcon() {
  return <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8"><path d="M2 3l20 18M13.5 17H8m4-4.5V17m6-3V5a2 2 0 0 0-2-2H4.5" /><path d="M22 17a2 2 0 0 1-2 2H6" /><path d="M8 21h8" /></svg>;
}
