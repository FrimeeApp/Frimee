"use client";

import { useRef } from "react";
import { MicOff, Pin, SignalLow } from "lucide-react";
import type { ParticipantTile } from "@/hooks/useLivekitRoom";
import { CallAvatar } from "../ui";
import { firstName, useElementSize } from "./layout";

/** The track key of a tile in useLivekitRoom. */
export function trackKeyOf(tile: ParticipantTile) {
  if (tile.isScreenShare) return `${tile.identity}:screen`;
  return tile.isLocal ? "__local__" : tile.identity;
}

/**
 * One participant (board C2): video (cover; a screen share: contain) or their avatar, the name
 * label bottom left, "Conexión inestable" top left and "Fijado" top right. Tapping it opens the
 * focused view; a long press or a right click does the same.
 */
export default function RoomTile({
  tile,
  nombre,
  foto,
  avatarNombre,
  speaking,
  unstable,
  pinned,
  attach,
  onSelect,
  className = "",
  style,
}: {
  tile: ParticipantTile;
  /** Full name ("Tú" for yourself, "Pantalla de X" for a screen share). */
  nombre: string;
  foto?: string;
  /** The real name for the initials (your tile says "Tú"). */
  avatarNombre?: string;
  speaking: boolean;
  unstable: boolean;
  pinned?: boolean;
  attach: (trackKey: string, el: HTMLVideoElement | null) => void;
  onSelect?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const showVideo = tile.isScreenShare || !tile.videoMuted;
  const small = size.width > 0 && size.width < 150;
  const label = small && !tile.isLocal && !tile.isScreenShare ? firstName(nombre) : nombre;
  const minSide = Math.min(size.width, size.height) || 120;
  const avatarSize = Math.round(Math.min(112, Math.max(36, minSide * 0.34)));
  const muted = !tile.isScreenShare && tile.audioMuted;
  const ariaLabel = `${nombre}${muted ? ", silenciado" : ""}${onSelect ? ". Ampliar" : ""}`;

  const startPress = () => {
    longPressed.current = false;
    if (!onSelect) return;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onSelect();
    }, 500);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <div
      ref={sizeRef}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={ariaLabel}
      data-speaking={speaking && showVideo && !tile.isScreenShare ? "video" : undefined}
      className={`call-tile ${tile.isScreenShare ? "call-tile-screen" : ""} ${onSelect ? "cursor-pointer" : ""} ${className}`}
      style={style}
      onClick={(e) => {
        if (!onSelect) return;
        e.stopPropagation();
        if (longPressed.current) { longPressed.current = false; return; }
        onSelect();
      }}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(); }
      }}
      onContextMenu={(e) => {
        if (!onSelect) return;
        e.preventDefault();
        onSelect();
      }}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
    >
      <video
        data-tile={tile.id}
        autoPlay
        playsInline
        muted
        ref={(el) => attach(trackKeyOf(tile), el)}
        style={{ display: showVideo ? undefined : "none", transform: tile.isLocal && !tile.isScreenShare ? "scaleX(-1)" : undefined }}
      />

      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="call-tile-av" data-speaking={speaking ? "true" : "false"}>
            <CallAvatar id={tile.identity} nombre={avatarNombre ?? nombre} foto={foto} size={avatarSize} />
          </div>
        </div>
      )}

      {unstable && (
        <span className="call-tag call-tag-warn left-2 top-2" title="Conexión inestable">
          <SignalLow className="size-3.5 shrink-0" aria-hidden />
          {size.width >= 220 && <span>Conexión inestable</span>}
        </span>
      )}
      {pinned && (
        <span className="call-tag right-2 top-2">
          <Pin className="size-3.5 shrink-0" aria-hidden />
          <span>Fijado</span>
        </span>
      )}
      <span className="call-tag bottom-2 left-2">
        {muted && <MicOff className="size-3.5 shrink-0" aria-hidden />}
        <span>{label}</span>
      </span>
    </div>
  );
}
