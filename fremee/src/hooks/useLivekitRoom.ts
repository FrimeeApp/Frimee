"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  ConnectionQuality,
  ConnectionState,
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  VideoPresets,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalAudioTrack,
  type LocalVideoTrack,
} from "livekit-client";

export type ParticipantTile = {
  id: string;            // unique: identity or `${identity}:screen`
  identity: string;
  isLocal: boolean;
  isScreenShare: boolean;
  audioMuted: boolean;
  videoMuted: boolean;
};

export type LivekitRoomOptions = {
  token: string;
  livekitUrl: string;
  tipo: "audio" | "video";
  /** Publish the camera from the start (a video call answered with the camera off: false). */
  camera: boolean;
  isGroup: boolean;
  /** Someone else is in the room: the call is answered. */
  onParticipantConnected: () => void;
  /** The room closed (you or the other person hung up, or the connection is gone). */
  onEnd: () => void;
  /** The last person left a group call. */
  onEndForAll: () => void;
};

/** Everything the call screens read and control. One room per call, shared by every screen. */
export type LivekitRoomApi = {
  connected: boolean;
  reconnecting: boolean;
  /** Identities whose connection is poor right now ("Conexión inestable"). */
  unstable: Set<string>;
  tiles: ParticipantTile[];
  /** Identities talking right now. */
  speaking: Set<string>;
  /** Some participant has (or had) a camera on: the room shows video tiles. */
  hasAnyVideo: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  /** Attach a track to a <video>: "__local__", "<identity>", "<identity>:screen". */
  attachTrack: (trackKey: string, el: HTMLVideoElement | null) => void;
  toggleMute: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  /** The browser or the phone refused the microphone or the camera (boards M17, D17). */
  blocked: "mic" | "camera" | null;
  /** Ask for the blocked device again (after allowing it) and publish it. */
  retryMedia: () => Promise<void>;
  /** Go on without the camera ("Seguir solo con voz"). */
  dismissBlocked: () => void;
  /** Front / back camera (phones). */
  canFlipCamera: boolean;
  /** Switching between the front and the back camera. */
  flippingCamera: boolean;
  flipCamera: () => Promise<void>;
  /** Leave the room (ends the call through onEnd). */
  disconnect: () => void;
};

/**
 * The LiveKit room of the current call, outside any screen: the outgoing screen, the room and
 * the floating widget all read and control the same connection, which lives as long as the
 * call (null options = no call). Track keys:
 *   "__local__" local camera · "<identity>:screen" a screen share · "<identity>" a remote camera.
 */
/** A connection that does not come back within this time ends the call (board M18a). */
const RECONNECT_GIVE_UP_MS = 30_000;

const AUDIO_OPTIONS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } as const;

/** A refusal (the user or the system said no), not a missing or busy device. */
function isPermissionError(err: unknown) {
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = String((err as { message?: string } | null)?.message ?? "");
  return name === "NotAllowedError" || name === "PermissionDeniedError" || /permission/i.test(message);
}

export function useLivekitRoom(options: LivekitRoomOptions | null): LivekitRoomApi {
  const roomRef = useRef<Room | null>(null);
  const trackMap = useRef<Map<string, Track>>(new Map());
  const audioSinkRef = useRef<HTMLDivElement | null>(null);
  const attachedAudioElsRef = useRef<Map<string, HTMLMediaElement>>(new Map());
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [tiles, setTiles] = useState<ParticipantTile[]>([]);
  const [speaking, setSpeaking] = useState<Set<string>>(() => new Set());
  const [hasAnyVideo, setHasAnyVideo] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [unstable, setUnstable] = useState<Set<string>>(() => new Set());
  const [canFlipCamera, setCanFlipCamera] = useState(false);
  const [flippingCamera, setFlippingCamera] = useState(false);
  const [blocked, setBlocked] = useState<"mic" | "camera" | null>(null);
  const facingRef = useRef<"user" | "environment">("user");

  const token = options?.token ?? null;
  const livekitUrl = options?.livekitUrl ?? null;
  const tipo = options?.tipo ?? "audio";
  const camera = options?.camera ?? false;
  const isGroup = options?.isGroup ?? false;
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  });

  // Remote audio plays from hidden elements in the body: the room keeps sounding while
  // minimized or behind another screen.
  useEffect(() => {
    const sink = document.createElement("div");
    sink.setAttribute("aria-hidden", "true");
    sink.style.display = "none";
    document.body.appendChild(sink);
    audioSinkRef.current = sink;
    return () => sink.remove();
  }, []);

  // A remote camera may arrive before its tile: the tile starts with video if the track is there.
  const addTile = useCallback((id: string, identity: string, isLocal: boolean, isScreenShare: boolean) => {
    setTiles((prev) => prev.some((t) => t.id === id) ? prev : [
      ...prev,
      { id, identity, isLocal, isScreenShare, audioMuted: false, videoMuted: isScreenShare ? false : isLocal ? !camera : !trackMap.current.has(identity) },
    ]);
  }, [camera]);

  const removeTile = useCallback((id: string) => {
    setTiles((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const attachTrack = useCallback((trackKey: string, el: HTMLVideoElement | null) => {
    if (!el) return;
    const t = trackMap.current.get(trackKey);
    if (t) t.attach(el);
  }, []);

  const attachAudioTrack = useCallback((participantIdentity: string, track: Track) => {
    const existing = attachedAudioElsRef.current.get(participantIdentity);
    if (existing) {
      track.attach(existing);
      return;
    }
    const el = track.attach();
    el.autoplay = true;
    if (el instanceof HTMLVideoElement) el.playsInline = true;
    el.style.display = "none";
    audioSinkRef.current?.appendChild(el);
    attachedAudioElsRef.current.set(participantIdentity, el);
  }, []);

  const detachAudioTrack = useCallback((participantIdentity: string, track?: Track) => {
    const el = attachedAudioElsRef.current.get(participantIdentity);
    if (!el) return;
    if (track) track.detach(el);
    el.remove();
    attachedAudioElsRef.current.delete(participantIdentity);
  }, []);

  useEffect(() => {
    if (!token || !livekitUrl) return;
    let cancelled = false;
    const audioEls = attachedAudioElsRef.current;
    const tracks = trackMap.current;
    // Adaptive stream: each video arrives at the size it is shown. Dynacast: senders stop
    // encoding layers nobody watches. Camera at 540p with 180p/360p layers for small tiles.
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: VideoPresets.h540.resolution },
      publishDefaults: { simulcast: true, videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360] },
    });
    roomRef.current = room;
    // Warm up the connection (DNS, TLS, region) while the tracks are being created.
    void room.prepareConnection(livekitUrl, token).catch(() => {});

    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Video) {
        if (track.source === Track.Source.ScreenShare) {
          const tileId = `${participant.identity}:screen`;
          tracks.set(tileId, track);
          addTile(tileId, participant.identity, false, true);
          const el = document.querySelector<HTMLVideoElement>(`video[data-tile="${tileId}"]`);
          if (el) track.attach(el);
        } else {
          tracks.set(participant.identity, track);
          setHasAnyVideo(true);
          setTiles((prev) => prev.map((t) => t.id === participant.identity ? { ...t, videoMuted: pub.isMuted } : t));
          const el = document.querySelector<HTMLVideoElement>(`video[data-tile="${participant.identity}"]`);
          if (el) track.attach(el);
        }
      } else if (track.kind === Track.Kind.Audio) {
        attachAudioTrack(participant.identity, track);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
      if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
        removeTile(`${participant.identity}:screen`);
      } else if (track.kind === Track.Kind.Video) {
        tracks.delete(participant.identity);
        setTiles((prev) => prev.map((t) => t.id === participant.identity ? { ...t, videoMuted: true } : t));
      } else if (track.kind === Track.Kind.Audio) {
        detachAudioTrack(participant.identity, track);
      }
    });

    // Microphone and camera mute separately (a camera turned off is not a muted microphone).
    const setMuted = (source: Track.Source, identity: string, muted: boolean) => {
      if (source !== Track.Source.Microphone && source !== Track.Source.Camera) return;
      const field = source === Track.Source.Microphone ? "audioMuted" : "videoMuted";
      setTiles((prev) => prev.map((t) => t.identity === identity && !t.isScreenShare ? { ...t, [field]: muted } : t));
    };
    room.on(RoomEvent.TrackMuted, (pub, participant) => setMuted(pub.source, participant.identity, true));
    room.on(RoomEvent.TrackUnmuted, (pub, participant) => setMuted(pub.source, participant.identity, false));
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      setSpeaking(new Set(speakers.map((p) => p.identity)));
    });
    room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      const bad = quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost;
      setUnstable((prev) => {
        if (bad === prev.has(participant.identity)) return prev;
        const next = new Set(prev);
        if (bad) next.add(participant.identity);
        else next.delete(participant.identity);
        return next;
      });
    });
    // Reconnecting: LiveKit keeps trying; after 30 s the call ends.
    let giveUp: ReturnType<typeof setTimeout> | null = null;
    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      const isReconnecting = state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting;
      setReconnecting(isReconnecting);
      if (isReconnecting && !giveUp) {
        giveUp = setTimeout(() => room.disconnect(), RECONNECT_GIVE_UP_MS);
      } else if (!isReconnecting && giveUp) {
        clearTimeout(giveUp);
        giveUp = null;
      }
    });

    room.on(RoomEvent.Connected, () => {
      if (!cancelled) {
        setConnected(true);
        addTile(room.localParticipant.identity, room.localParticipant.identity, true, false);
      }
    });
    room.on(RoomEvent.Disconnected, () => {
      audioEls.forEach((el) => el.remove());
      audioEls.clear();
      if (!cancelled) { setConnected(false); callbacksRef.current?.onEnd(); }
    });
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (!cancelled) {
        addTile(participant.identity, participant.identity, false, false);
        callbacksRef.current?.onParticipantConnected();
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (!cancelled) {
        removeTile(participant.identity);
        removeTile(`${participant.identity}:screen`);
        if (room.remoteParticipants.size === 0) {
          if (isGroup) callbacksRef.current?.onEndForAll();
          else callbacksRef.current?.onEnd();
        }
      }
    });

    const connect = async () => {
      // Microphone (and camera) open while the room connects, not after: audio starts sooner.
      // Each on its own: a camera that fails must not take the microphone with it (and the other
      // way round). In the Android app they go one after the other: while the system asks for the
      // first permission, a second request at the same time is refused straight away.
      const audioTrack: Promise<LocalAudioTrack> = createLocalAudioTrack(AUDIO_OPTIONS);
      const videoTrack: Promise<LocalVideoTrack | null> = !camera ? Promise.resolve(null)
        : Capacitor.isNativePlatform() ? audioTrack.catch(() => null).then(() => createLocalVideoTrack())
          : createLocalVideoTrack();
      audioTrack.catch(() => {}); // handled below, after connecting
      videoTrack.catch(() => {});
      await room.connect(livekitUrl, token);
      if (cancelled) { room.disconnect(); return; }
      // Someone may have joined before this side finished connecting: no ParticipantConnected
      // event comes for them, so the call counts as answered right here.
      if (room.remoteParticipants.size > 0) callbacksRef.current?.onParticipantConnected();
      // Phones with a front and a back camera get the flip button.
      void Room.getLocalDevices("videoinput", false)
        .then((devices) => { if (!cancelled) setCanFlipCamera(devices.length > 1 && window.matchMedia("(pointer: coarse)").matches); })
        .catch(() => {});
      room.remoteParticipants.forEach((p) => {
        addTile(p.identity, p.identity, false, false);
        p.getTrackPublications().forEach((pub) => {
          if (pub.track && pub.source === Track.Source.ScreenShare) {
            const tileId = `${p.identity}:screen`;
            tracks.set(tileId, pub.track);
            addTile(tileId, p.identity, false, true);
          }
        });
      });

      // Audio and camera publish separately: a camera that fails (busy, slow to start) must not
      // leave the call without sound. The camera gets one more try.
      const [audioResult, videoResult] = await Promise.allSettled([audioTrack, videoTrack]);
      if (cancelled) {
        if (audioResult.status === "fulfilled") audioResult.value.stop();
        if (videoResult.status === "fulfilled") videoResult.value?.stop();
        room.disconnect();
        return;
      }
      if (audioResult.status === "fulfilled") {
        await room.localParticipant.publishTrack(audioResult.value).catch((err) => console.error("[call] publish audio", err));
      } else {
        console.error("[call] microphone", audioResult.reason);
        if (isPermissionError(audioResult.reason)) setBlocked("mic");
      }
      if (camera) {
        const publishVideo = async (track: LocalVideoTrack) => {
          await room.localParticipant.publishTrack(track);
          tracks.set("__local__", track);
          setTiles((prev) => prev.map((t) => t.isLocal && !t.isScreenShare ? { ...t, videoMuted: false } : t));
          document.querySelectorAll<HTMLVideoElement>(`video[data-tile="${room.localParticipant.identity}"], video[data-own-video]`).forEach((el) => track.attach(el));
        };
        try {
          if (videoResult.status !== "fulfilled" || !videoResult.value) throw videoResult.status === "rejected" ? videoResult.reason : new Error("sin cámara");
          await publishVideo(videoResult.value);
        } catch (first) {
          if (isPermissionError(first)) {
            // Refused: trying again now would fail the same way; the screen asks the user.
            setTiles((prev) => prev.map((t) => t.isLocal && !t.isScreenShare ? { ...t, videoMuted: true } : t));
            setBlocked((b) => b ?? "camera");
            return;
          }
          console.warn("[call] camera, retrying", first);
          await new Promise((r) => setTimeout(r, 600));
          if (cancelled) return;
          try {
            await publishVideo(await createLocalVideoTrack());
          } catch (err) {
            console.error("[call] camera", err);
            // No camera after all: your tile shows your avatar.
            setTiles((prev) => prev.map((t) => t.isLocal && !t.isScreenShare ? { ...t, videoMuted: true } : t));
          }
        }
      }
    };

    connect().catch(console.error);
    return () => {
      cancelled = true;
      if (giveUp) clearTimeout(giveUp);
      audioEls.forEach((el) => el.remove());
      audioEls.clear();
      tracks.clear();
      roomRef.current = null;
      room.disconnect();
      // Clean slate for the next call.
      setConnected(false);
      setTiles([]);
      setSpeaking(new Set());
      setReconnecting(false);
      setScreenSharing(false);
      setHasAnyVideo(false);
      setUnstable(new Set());
      setCanFlipCamera(false);
      setBlocked(null);
      facingRef.current = "user";
    };
  }, [token, livekitUrl, tipo, camera, isGroup, addTile, removeTile, attachAudioTrack, detachAudioTrack]);

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
          document.querySelectorAll<HTMLVideoElement>(`video[data-tile="${local.identity}"], video[data-own-video]`).forEach((el) => pub.track?.attach(el));
        }
        setHasAnyVideo(true);
        setTiles((prev) => prev.map((t) => t.isLocal && !t.isScreenShare ? { ...t, videoMuted: false } : t));
      } else {
        setTiles((prev) => prev.map((t) => t.isLocal && !t.isScreenShare ? { ...t, videoMuted: true } : t));
      }
    } catch (err) { console.error("[call] camera toggle error", err); }
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
    } catch (err) { console.error("[call] screen share error", err); }
  }, [screenSharing, addTile, removeTile]);

  const retryMedia = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const local = room.localParticipant;
    try {
      if (!local.getTrackPublication(Track.Source.Microphone)) {
        await local.publishTrack(await createLocalAudioTrack(AUDIO_OPTIONS));
        setTiles((prev) => prev.map((t) => t.isLocal && !t.isScreenShare ? { ...t, audioMuted: false } : t));
      }
      if (camera && !local.getTrackPublication(Track.Source.Camera)) {
        const video = await createLocalVideoTrack();
        await local.publishTrack(video);
        trackMap.current.set("__local__", video);
        setHasAnyVideo(true);
        setTiles((prev) => prev.map((t) => t.isLocal && !t.isScreenShare ? { ...t, videoMuted: false } : t));
        document.querySelectorAll<HTMLVideoElement>(`video[data-tile="${local.identity}"], video[data-own-video]`).forEach((el) => video.attach(el));
      }
      setBlocked(null);
    } catch (err) {
      console.error("[call] retry media", err);
      // Still refused: keep asking. The microphone first, then the camera.
      setBlocked(local.getTrackPublication(Track.Source.Microphone) ? "camera" : "mic");
    }
  }, [camera]);

  const dismissBlocked = useCallback(() => setBlocked(null), []);

  const flipCamera = useCallback(async () => {
    const pub = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track as LocalVideoTrack | undefined;
    if (!track) return;
    const next = facingRef.current === "user" ? "environment" : "user";
    setFlippingCamera(true);
    try {
      await track.restartTrack({ facingMode: next });
      facingRef.current = next;
      // The new camera's first frame: until then, the dots.
      const el = track.attachedElements[0] as HTMLVideoElement | undefined;
      if (el && "requestVideoFrameCallback" in el) {
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 2000);
          el.requestVideoFrameCallback(() => { clearTimeout(t); resolve(); });
        });
      }
    } catch (err) { console.error("[call] flip camera", err); }
    setFlippingCamera(false);
  }, []);

  const disconnect = useCallback(() => { roomRef.current?.disconnect(); }, []);

  const localTile = tiles.find((t) => t.isLocal && !t.isScreenShare);
  return {
    connected,
    reconnecting,
    unstable,
    tiles,
    speaking,
    hasAnyVideo: hasAnyVideo || (token !== null && tipo === "video"),
    micEnabled: !(localTile?.audioMuted ?? false),
    cameraEnabled: !(localTile?.videoMuted ?? true),
    screenSharing,
    attachTrack,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    blocked,
    retryMedia,
    dismissBlocked,
    canFlipCamera,
    flippingCamera,
    flipCamera,
    disconnect,
  };
}
