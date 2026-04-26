"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type CameraModalProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function CameraModal({ onCapture, onClose }: CameraModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<Blob | null>(null);
  const [capturedVideoUrl, setCapturedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  const videoRefCallback = useCallback((el: HTMLVideoElement | null) => { setVideoEl(el); }, []);

  useEffect(() => {
    if (!videoEl) return;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        videoEl.srcObject = stream;
      })
      .catch((e: unknown) => setError(`No se pudo acceder a la cámara: ${(e as Error).message ?? String(e)}`));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [videoEl]);

  const handleCapturePhoto = () => {
    const video = videoEl;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
  };

  const handleStartVideo = () => {
    const stream = streamRef.current;
    if (!stream) return;
    videoChunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setCapturedVideo(blob);
      setCapturedVideoUrl(url);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setRecSeconds(0);
    recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
  };

  const handleStopVideo = () => {
    recorderRef.current?.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
  };

  const handleSendPhoto = () => {
    if (!captured) return;
    const byteString = atob(captured.split(",")[1]);
    const buffer = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) buffer[i] = byteString.charCodeAt(i);
    onCapture(new File([buffer], `foto_${Date.now()}.jpg`, { type: "image/jpeg" }));
  };

  const handleSendVideo = () => {
    if (!capturedVideo) return;
    if (capturedVideoUrl) URL.revokeObjectURL(capturedVideoUrl);
    onCapture(new File([capturedVideo], `video_${Date.now()}.webm`, { type: "video/webm" }));
  };

  const handleRepeat = () => {
    if (capturedVideoUrl) { URL.revokeObjectURL(capturedVideoUrl); setCapturedVideoUrl(null); }
    setCaptured(null);
    setCapturedVideo(null);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const hasCapture = captured ?? capturedVideo;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Cerrar */}
      <button type="button" onClick={onClose} className="absolute right-[16px] top-[16px] z-10 flex size-[36px] items-center justify-center rounded-full bg-black/40 text-white">
        <svg viewBox="0 0 24 24" fill="none" className="size-[18px]"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>

      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="px-8 text-center text-white/80">{error}</p>
        </div>
      ) : hasCapture ? (
        <>
          <div className="relative flex-1 overflow-hidden">
            {captured ? (
               
              <NextImage src={captured} alt="Captura" width={1200} height={900} className="h-full w-full object-contain" unoptimized />
            ) : (
              <video src={capturedVideoUrl ?? undefined} controls autoPlay className="h-full w-full object-contain" />
            )}
          </div>
          <div className="flex items-center justify-center gap-[16px] py-[28px]">
            <button type="button" onClick={handleRepeat} className="rounded-full border border-white/50 px-[24px] py-[10px] text-white">
              Repetir
            </button>
            <button type="button" onClick={captured ? handleSendPhoto : handleSendVideo} className="rounded-full bg-white px-[28px] py-[10px] font-semibold text-black">
              Enviar
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRefCallback} autoPlay playsInline muted onCanPlay={() => setReady(true)} className="h-full w-full object-cover" />
            {!ready && <div className="absolute inset-0 flex items-center justify-center"><span className="text-sm text-white/60">Iniciando cámara...</span></div>}
            {recording && (
              <div className="absolute left-[16px] top-[16px] flex items-center gap-[6px] rounded-full bg-black/50 px-[12px] py-[4px]">
                <span className="size-[8px] animate-pulse rounded-full bg-red-500" />
                <span className="text-[14px] text-white">{fmt(recSeconds)}</span>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <div className="flex items-center justify-center gap-[40px] py-[28px]">
            <div className="flex rounded-full bg-white/15 p-[3px]">
              <button type="button" onClick={() => setMode("photo")} className={`rounded-full px-[14px] py-[6px] text-[14px] font-medium transition-colors ${mode === "photo" ? "bg-white text-black" : "text-white"}`}>
                Foto
              </button>
              <button type="button" onClick={() => setMode("video")} className={`rounded-full px-[14px] py-[6px] text-[14px] font-medium transition-colors ${mode === "video" ? "bg-white text-black" : "text-white"}`}>
                Vídeo
              </button>
            </div>

            {mode === "photo" ? (
              <button type="button" onClick={handleCapturePhoto} disabled={!ready}
                className="flex size-[64px] items-center justify-center rounded-full border-[3px] border-white bg-white/20 transition-opacity disabled:opacity-40 hover:bg-white/30">
                <div className="size-[48px] rounded-full bg-white" />
              </button>
            ) : (
              <button type="button" onClick={recording ? handleStopVideo : handleStartVideo} disabled={!ready}
                className={`flex size-[64px] items-center justify-center rounded-full border-[3px] transition-all disabled:opacity-40 ${recording ? "border-red-500 bg-red-500/20" : "border-white bg-white/20 hover:bg-white/30"}`}>
                <div className={`rounded-full bg-red-500 transition-all ${recording ? "size-[24px] rounded-[6px]" : "size-[48px]"}`} />
              </button>
            )}

            <div className="w-[80px]" />
          </div>
        </>
      )}
    </div>
  );
}
