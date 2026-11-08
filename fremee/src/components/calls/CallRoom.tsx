"use client";

import Image from "next/image";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import type { CallMiembro } from "@/hooks/useCall";
import type { ParticipantTile } from "@/hooks/useLivekitRoom";
import { useCallRoom } from "@/providers/CallProvider";
import { PhoneOffIcon } from "@/components/icons";
import { Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, ChevronLeft, Minus } from "lucide-react";

type Props = {
  miembros: CallMiembro[];
  participanteNombre: string;
  isActive?: boolean;
  /** When the call was answered (ms since epoch), for the timer. */
  activeSince?: number | null;
  onMinimize?: () => void;
};

/** The room on screen. The connection itself lives in CallProvider (useCallRoom). */
export default function CallRoom({ miembros, participanteNombre, isActive, activeSince, onMinimize }: Props) {
  const isNative = Capacitor.isNativePlatform();
  const {
    connected, reconnecting, tiles, speaking, hasAnyVideo, micEnabled, cameraEnabled, screenSharing,
    attachTrack, toggleMute, toggleVideo, toggleScreenShare, disconnect,
  } = useCallRoom();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const handleEnd = disconnect;

  const getMiembro = (identity: string) => miembros.find((m) => m.id === identity);
  const localMuted = !micEnabled;
  const localVideoOff = !cameraEnabled;
  const showVideo = hasAnyVideo;
  const visibleTileCount = tiles.length > 0 ? tiles.length : miembros.length;

  const getGridConfig = (count: number) => {
    if (count <= 1) return { columns: 1, rows: 1 };
    if (count === 2) return { columns: 2, rows: 1 };
    if (count <= 4) return { columns: 2, rows: 2 };
    if (count <= 6) return { columns: 2, rows: 3 };
    if (count <= 9) return { columns: 3, rows: 3 };
    return { columns: 4, rows: Math.ceil(count / 4) };
  };

  const gridConfig = getGridConfig(visibleTileCount);

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
        className={`relative overflow-hidden rounded-2xl bg-black flex min-h-0 items-center justify-center cursor-pointer ${fullscreen ? "w-full h-full" : "h-full w-full"} ${!tile.isScreenShare && speaking.has(tile.identity) && !tile.audioMuted ? "ring-2 ring-[var(--primary)]" : ""}`}
        style={!fullscreen && tile.isScreenShare ? { gridColumn: `span ${gridConfig.columns}` } : undefined}
      >
        {/* Video element — always rendered for screen share, conditional for camera */}
        {(tile.isScreenShare || showVideo) && (
          <video
            data-tile={tile.id}
            autoPlay
            playsInline
            muted={tile.isLocal}
            ref={(el) => { if (el) attachTrack(trackKey, el); }}
            className={`absolute inset-0 h-full w-full ${tile.isScreenShare ? "object-contain bg-black" : "object-cover"} ${tile.isLocal && !tile.isScreenShare ? "-scale-x-100" : ""} ${!tile.isScreenShare && tile.videoMuted ? "hidden" : ""}`}
          />
        )}

        {/* Avatar — only for non-screen-share tiles when video is off */}
        {!tile.isScreenShare && (!showVideo || tile.videoMuted) && (
          <div className="flex flex-col items-center gap-2 z-10">
            <div className="h-14 w-14 overflow-hidden rounded-full bg-white/10 border border-white/10">
              {foto ? (
                <Image src={foto} alt={baseName} width={56} height={56} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
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
          <span className="text-sm font-medium truncate drop-shadow">{nombre}</span>
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
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#1a1a1a] text-white"
      style={isNative ? { paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" } : undefined}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{participanteNombre}</span>
          <span className="text-sm text-white/50">
            {reconnecting ? "Reconectando…" : isActive && activeSince ? <CallTimer since={activeSince} /> : connected ? "Llamando..." : "Conectando..."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {focusedId && (
            <button onClick={() => setFocusedId(null)} className="flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <ChevronLeft className="size-4" aria-hidden />
              Todos
            </button>
          )}
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="flex size-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
              aria-label="Minimizar"
            >
              <Minus className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className={`flex-1 overflow-hidden pb-2 ${isNative ? "px-1" : "px-2"}`}>
        {focusedTile ? (
          <div className="h-full w-full">
            {renderTile(focusedTile, true)}
          </div>
        ) : (
          <div
            className="grid h-full min-h-0 gap-2"
            style={{
              gridTemplateColumns: `repeat(${gridConfig.columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridConfig.rows}, minmax(0, 1fr))`,
            }}
          >
              {tiles.map((tile) => renderTile(tile, false))}
              {tiles.length === 0 && miembros.map((m) => (
                <div key={m.id} className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#2a2a2a] opacity-50">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-white/10">
                    {m.foto ? <Image src={m.foto} alt={m.nombre} width={56} height={56} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" /> : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-bold">{m.nombre[0]?.toUpperCase()}</div>
                    )}
                  </div>
                  <span className="text-sm text-white/40">Llamando...</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={`shrink-0 flex items-center justify-center gap-4 pt-3 px-4 ${isNative ? "pb-2" : "pb-10"}`}>
        <button onClick={() => void toggleMute()} aria-label={localMuted ? "Activar micrófono" : "Silenciar micrófono"} aria-pressed={localMuted} className={`flex h-13 w-13 items-center justify-center rounded-full transition-all ${localMuted ? "bg-white text-black" : "bg-white/15 text-white"}`}>
          {localMuted ? <MicOffIcon /> : <MicIcon />}
        </button>
        <button onClick={() => void toggleVideo()} aria-label={localVideoOff ? "Activar cámara" : "Apagar cámara"} aria-pressed={!localVideoOff} className={`flex h-13 w-13 items-center justify-center rounded-full transition-all ${!localVideoOff ? "bg-white text-black" : "bg-white/15 text-white"}`}>
          {localVideoOff ? <VideoOffIcon /> : <VideoIcon />}
        </button>
        <button onClick={() => void toggleScreenShare()} aria-label={screenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"} aria-pressed={screenSharing} className={`flex h-13 w-13 items-center justify-center rounded-full transition-all ${screenSharing ? "bg-white text-black" : "bg-white/15 text-white"}`}>
          {screenSharing ? <ScreenShareOffIcon /> : <ScreenShareIcon />}
        </button>
        <button onClick={handleEnd} aria-label="Colgar" className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40 transition-all hover:bg-red-600 hover:scale-105 active:scale-95">
          <PhoneOffIcon />
        </button>
      </div>
    </div>
  );
}

const MicIcon = () => <Mic className="size-6" aria-hidden />;
const MicOffIcon = () => <MicOff className="size-6" aria-hidden />;
const MicOffSmallIcon = () => <MicOff className="size-3" aria-hidden />;
const VideoIcon = () => <Video className="size-6" aria-hidden />;
const VideoOffIcon = () => <VideoOff className="size-6" aria-hidden />;
const ScreenShareIcon = ({ small }: { small?: boolean }) => <ScreenShare className={small ? "size-3" : "size-6"} aria-hidden />;
const ScreenShareOffIcon = () => <ScreenShareOff className="size-6" aria-hidden />;

/** Call time since it was answered. Its own component: ticking every second must not redraw the room. */
function CallTimer({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const total = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const sec = (total % 60).toString().padStart(2, "0");
  return <>{h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`}</>;
}
