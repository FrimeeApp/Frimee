"use client";

type Props = {
  callerName: string;
  callerFoto?: string;
  tipo: "audio" | "video";
  onAccept: () => void;
  onReject: () => void;
};

export default function IncomingCall({ callerName, callerFoto, tipo, onAccept, onReject }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-[#111] text-white pb-safe pt-safe">
      <div className="flex flex-col items-center gap-[var(--space-3)] pt-[var(--space-20)]">
        <p className="text-caption text-muted">{tipo === "video" ? "Llamada de vídeo entrante" : "Llamada de voz entrante"}</p>
        <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-white/10">
          {callerFoto ? (
            <img src={callerFoto} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[40px] font-bold">
              {callerName?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <p className="text-[var(--font-h2)] font-[var(--fw-bold)]">{callerName}</p>
      </div>

      <div className="flex items-center gap-[var(--space-16)] pb-[var(--space-20)]">
        <div className="flex flex-col items-center gap-[var(--space-2)]">
          <button
            onClick={onReject}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white"
          >
            <PhoneOffIcon />
          </button>
          <span className="text-caption text-muted">Rechazar</span>
        </div>

        <div className="flex flex-col items-center gap-[var(--space-2)]">
          <button
            onClick={onAccept}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white"
          >
            <PhoneIcon />
          </button>
          <span className="text-caption text-muted">Aceptar</span>
        </div>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.08 6.08l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
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
