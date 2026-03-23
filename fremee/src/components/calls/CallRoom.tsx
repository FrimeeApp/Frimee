"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from "livekit-client";

type Props = {
  token: string;
  livekitUrl: string;
  tipo: "audio" | "video";
  participantes: { id: string; nombre: string; foto?: string }[];
  onEnd: () => void;
};

export default function CallRoom({ token, livekitUrl, tipo, participantes, onEnd }: Props) {
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; });

  useEffect(() => {
    if (!token || !livekitUrl) return;

    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind === Track.Kind.Video) {
        const el = remoteVideoRefs.current.get(participant.identity);
        if (el) track.attach(el);
      } else if (track.kind === Track.Kind.Audio) {
        track.attach();
      }
    });

    room.on(RoomEvent.Connected, () => { if (!cancelled) setConnected(true); });
    room.on(RoomEvent.Disconnected, () => { if (!cancelled) { setConnected(false); onEndRef.current(); } });

    const connect = async () => {
      await room.connect(livekitUrl, token);
      if (cancelled) { room.disconnect(); return; }
      const audioTrack = await createLocalAudioTrack();
      if (cancelled) { room.disconnect(); return; }
      await room.localParticipant.publishTrack(audioTrack);

      if (tipo === "video") {
        const videoTrack = await createLocalVideoTrack();
        if (cancelled) { room.disconnect(); return; }
        await room.localParticipant.publishTrack(videoTrack);
        if (localVideoRef.current) videoTrack.attach(localVideoRef.current);
      }
    };

    connect().catch(console.error);

    return () => {
      cancelled = true;
      room.disconnect();
    };
  }, [token, livekitUrl, tipo]);

  // Timer
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [connected]);

  const toggleMute = useCallback(async () => {
    const local = roomRef.current?.localParticipant;
    if (!local) return;
    await local.setMicrophoneEnabled(muted);
    setMuted(!muted);
  }, [muted]);

  const toggleVideo = useCallback(async () => {
    const local = roomRef.current?.localParticipant;
    if (!local) return;
    await local.setCameraEnabled(videoOff);
    setVideoOff(!videoOff);
  }, [videoOff]);

  const handleEnd = useCallback(() => {
    roomRef.current?.disconnect();
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-[#111] text-white pb-safe pt-safe">
      {/* Header */}
      <div className="flex flex-col items-center gap-[var(--space-2)] pt-[var(--space-14)]">
        <p className="text-caption text-muted">
          {connected ? formatDuration(duration) : "Conectando..."}
        </p>
        {participantes.length === 1 && (
          <div className="flex flex-col items-center gap-[var(--space-3)]">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-white/10">
              {participantes[0]?.foto ? (
                <img src={participantes[0].foto} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[32px] font-bold">
                  {participantes[0]?.nombre?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <p className="text-body font-[var(--fw-semibold)]">{participantes[0]?.nombre}</p>
          </div>
        )}
        {participantes.length > 1 && (
          <p className="text-body font-[var(--fw-semibold)]">{participantes.length} participantes</p>
        )}
      </div>

      {/* Video grid */}
      {tipo === "video" && (
        <div className="relative w-full flex-1">
          {/* Remote videos */}
          {participantes.map((p) => (
            <video
              key={p.id}
              ref={(el) => { if (el) remoteVideoRefs.current.set(p.id, el); }}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ))}
          {/* Local video (PiP) */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-[var(--space-4)] right-[var(--space-4)] h-32 w-24 rounded-[12px] object-cover border border-white/20"
          />
        </div>
      )}

      {/* Controls */}
      <div className="relative z-10 flex items-center gap-[var(--space-8)] pb-[var(--space-14)]">
        <button
          onClick={toggleMute}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
            muted ? "bg-white text-black" : "bg-white/10 text-white"
          }`}
        >
          {muted ? <MicOffIcon /> : <MicIcon />}
        </button>

        {tipo === "video" && (
          <button
            onClick={toggleVideo}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
              videoOff ? "bg-white text-black" : "bg-white/10 text-white"
            }`}
          >
            {videoOff ? <VideoOffIcon /> : <VideoIcon />}
          </button>
        )}

        <button
          onClick={handleEnd}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
        >
          <PhoneOffIcon />
        </button>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6" />
    </svg>
  );
}
function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7 7 0 0 0 19 10M5 10a7 7 0 0 0 12 5.27M15 9.34V5a3 3 0 0 0-5.68-1.33M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}
function VideoOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34" />
      <path d="M23 7l-7 5 7 5V7z" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
function PhoneOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8">
      <path d="M10.68 13.31a16 16 0 0 0 3.01 2.99l1.96-1.96a1 1 0 0 1 1.09-.22 11.3 11.3 0 0 0 3.57.73 1 1 0 0 1 .93 1v3.57a1 1 0 0 1-.9 1A17 17 0 0 1 3 5.9a1 1 0 0 1 1-.9h3.57a1 1 0 0 1 1 .92 11.3 11.3 0 0 0 .73 3.57 1 1 0 0 1-.22 1.09l-1.96 1.96" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
