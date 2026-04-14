"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { publishPlanAsPost } from "@/services/api/repositories/post.repository";
import type { PlanByIdRow } from "@/services/api/endpoints/plans.endpoint";

type Props = {
  plan: PlanByIdRow;
  onClose: () => void;
};

const MAX_CAPTION = 280;

function formatDateRange(startsAt: string, endsAt: string, allDay: boolean): string {
  if (!startsAt) return "";
  const fmt = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };
  const s = fmt(startsAt);
  const e = fmt(endsAt);
  return s === e ? s : `${s} – ${e}`;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 52 52" fill="none" className="size-[52px]">
      <circle cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="2" />
      <path d="M14 27L22 35L38 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapPinSmall() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5 shrink-0">
      <path d="M8 1.5C5.79 1.5 4 3.29 4 5.5C4 8.5 8 14 8 14C8 14 12 8.5 12 5.5C12 3.29 10.21 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function CalSmall() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5 shrink-0">
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 2V4M11 2V4M2 7H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function PublishPlanModal({ plan, onClose }: Props) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [step, setStep] = useState<"compose" | "success">("compose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === "success") {
      timerRef.current = setTimeout(() => {
        onClose();
      }, 4000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, onClose]);

  const dateLabel = formatDateRange(plan.inicio_at, plan.fin_at, plan.all_day);
  const infoLine = [plan.ubicacion_nombre, dateLabel].filter(Boolean).join("  ·  ");

  async function handlePublish() {
    if (!user || !profile) return;
    setLoading(true);
    setError(null);
    try {
      await publishPlanAsPost({
        id: plan.id,
        title: plan.titulo,
        description: plan.descripcion ?? "",
        locationName: plan.ubicacion_nombre ?? "",
        startsAt: plan.inicio_at,
        endsAt: plan.fin_at,
        allDay: plan.all_day,
        visibility: plan.visibilidad,
        coverImage: plan.foto_portada ?? null,
        ownerUserId: plan.owner_user_id,
        caption: caption.trim() || null,
        creator: {
          id: user.id,
          name: profile.nombre,
          profileImage: profile.profile_image,
        },
      });
      setStep("success");
    } catch (err) {
      console.error("[PublishPlanModal] publish error:", err);
      setError("No se pudo publicar. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-[2px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-[22px] bg-app shadow-elev-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "compose" ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <span className="text-[15px] font-[700] text-app tracking-[-0.01em]">Publicar en el feed</span>
              <button
                onClick={onClose}
                className="flex items-center justify-center size-8 rounded-full text-muted hover:text-app hover:bg-app-hover transition-colors"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Plan preview card */}
            <div className="mx-5 mb-4 rounded-[14px] border border-app overflow-hidden">
              {plan.foto_portada ? (
                <div className="relative w-full h-[180px]">
                  <Image
                    src={plan.foto_portada}
                    alt={plan.titulo}
                    fill
                    className="object-cover"
                    sizes="(max-width: 460px) 100vw, 460px"
                  />
                  {/* subtle gradient for text legibility */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[13px] font-[700] text-white leading-tight line-clamp-1">{plan.titulo}</p>
                    {infoLine && (
                      <p className="mt-0.5 text-[11px] text-white/80 leading-tight line-clamp-1">{infoLine}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3.5 bg-[var(--surface-raised)]">
                  <p className="text-[13px] font-[700] text-app leading-tight line-clamp-2">{plan.titulo}</p>
                  {infoLine && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {plan.ubicacion_nombre && (
                        <span className="flex items-center gap-1 text-[11px] text-muted">
                          <MapPinSmall /> {plan.ubicacion_nombre}
                        </span>
                      )}
                      {dateLabel && (
                        <span className="flex items-center gap-1 text-[11px] text-muted">
                          <CalSmall /> {dateLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Caption textarea */}
            <div className="relative mx-5 mb-1">
              <textarea
                ref={textareaRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                placeholder="Escribe algo sobre este plan..."
                rows={3}
                className="w-full resize-none rounded-[12px] bg-[var(--surface-raised)] px-4 py-3 text-[14px] text-app placeholder:text-muted outline-none focus:ring-1 focus:ring-[var(--border-focus,var(--border))] transition-shadow"
              />
              {caption.length > 200 && (
                <span className={`absolute bottom-3 right-3 text-[11px] tabular-nums ${caption.length >= MAX_CAPTION ? "text-red-500" : "text-muted"}`}>
                  {MAX_CAPTION - caption.length}
                </span>
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="mx-5 mt-1 text-[12px] text-red-500">{error}</p>
            )}

            {/* Footer */}
            <div className="px-5 pt-3 pb-5">
              <button
                onClick={() => void handlePublish()}
                disabled={loading}
                className="w-full h-11 rounded-full bg-primary-token text-white text-[14px] font-[700] tracking-[-0.01em] transition-opacity disabled:opacity-60 hover:opacity-90 active:opacity-80"
              >
                {loading ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </>
        ) : (
          /* Success step */
          <div className="flex flex-col items-center px-8 py-10 gap-4 publish-success">
            <div className="text-[var(--color-success,#22c55e)] animate-publish-check">
              <CheckIcon />
            </div>
            <div className="text-center">
              <p className="text-[18px] font-[800] text-app tracking-[-0.02em]">¡Plan publicado!</p>
              <p className="mt-1 text-[13px] text-muted">Ya aparece en el feed para todos.</p>
            </div>
            <button
              onClick={() => router.push("/feed")}
              className="mt-2 h-10 px-6 rounded-full bg-primary-token text-white text-[13px] font-[700] transition-opacity hover:opacity-90"
            >
              Ver en el feed
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes publish-check-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        .animate-publish-check {
          animation: publish-check-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>
    </div>
  );
}
