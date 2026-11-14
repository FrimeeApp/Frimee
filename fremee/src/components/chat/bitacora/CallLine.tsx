import { Phone, PhoneMissed, Video } from "lucide-react";

const formatDuration = (s: number) => {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m} min ${sec} s` : `${sec} s`;
};

/**
 * A call is a line on the spine, not a bubble (board k-momentos · Llamadas). Red only for a call you
 * missed; a call nobody answered on your side reads neutral.
 */
export function CallLine({
  tipo,
  duracion,
  time,
  isMe,
  otherName,
  onCallBack,
}: {
  tipo: string;
  duracion: number;
  time: string;
  /** I started the call. */
  isMe: boolean;
  otherName: string;
  onCallBack?: () => void;
}) {
  const isVideo = tipo.includes("video");
  const missed = tipo.includes("missed") || tipo === "call_cancel";
  const missedByMe = missed && !isMe;
  const kind = isVideo ? "Videollamada" : "Llamada de voz";
  const title = missedByMe
    ? `${isVideo ? "Videollamada perdida" : "Llamada perdida"} de ${otherName}`
    : missed
      ? `${kind} sin respuesta`
      : `${kind}${duracion > 0 ? ` · ${formatDuration(duracion)}` : ""}`;
  const meta = missed ? time : `${time} · ${isMe ? "saliente" : "entrante"}`;
  const Icon = missedByMe ? PhoneMissed : isVideo ? Video : Phone;

  return (
    <div className="relative flex min-h-[44px] items-center gap-[10px] pl-[56px] pr-[var(--space-4)]">
      <span
        aria-hidden
        className={`absolute left-[16px] top-1/2 flex size-[22px] -translate-y-1/2 items-center justify-center rounded-full border ${
          missedByMe ? "border-[var(--chat-missed)] bg-[var(--chat-missed-bg)] text-[var(--chat-missed)]" : "border-app bg-[var(--bg)] text-muted"
        }`}
      >
        <Icon className="size-[12px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] font-[var(--fw-semibold)] ${missedByMe ? "text-[var(--chat-missed)]" : "text-app"}`}>{title}</p>
        <p className="text-[12px] tabular-nums text-muted">{meta}</p>
      </div>
      {missedByMe && onCallBack && (
        <button
          type="button"
          onClick={onCallBack}
          className="min-h-[44px] shrink-0 rounded-[8px] px-[12px] text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)] hover:bg-[var(--surface-2)]"
        >
          Devolver
        </button>
      )}
    </div>
  );
}
