"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchPlanByJoinCode, joinPlanByCode, type PlanByIdRow } from "@/services/api/endpoints/plans.endpoint";
import { useAuth } from "@/providers/AuthProvider";

export default function JoinPageClient() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [plan, setPlan] = useState<PlanByIdRow | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    fetchPlanByJoinCode(code)
      .then((result) => {
        if (!result) { setError("Este enlace de invitación no es válido o ha expirado."); setLoading(false); return; }
        if (result.alreadyMember) { router.replace(`/plans/${result.planId}`); return; }
        setPlan(result.plan);
        setPlanId(result.planId);
        setLoading(false);
      })
      .catch(() => { setError("No se pudo cargar el plan."); setLoading(false); });
  }, [code, router]);

  const handleJoin = async () => {
    if (!plan || !user) return;
    setJoining(true);
    try {
      const result = await joinPlanByCode(code);
      if ("error" in result) {
        setError("No se pudo unir al plan.");
        return;
      }
      router.replace(`/plans/${"plan_id" in result ? result.plan_id : planId}`);
    } catch {
      setError("No se pudo unir al plan.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-[24px] animate-spin rounded-full border-2 border-[var(--text-primary)] border-t-transparent" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-body text-muted">{error ?? "Enlace no válido."}</p>
        <button
          type="button"
          onClick={() => router.replace("/feed")}
          className="rounded-full bg-[var(--text-primary)] px-6 py-2.5 text-body-sm font-[var(--fw-semibold)] text-contrast-token"
        >
          Ir al inicio
        </button>
      </div>
    );
  }

  const coverStyle = plan.foto_portada
    ? { backgroundImage: `url(${plan.foto_portada})`, backgroundSize: "cover", backgroundPosition: "center" }
    : {};

  const startDate = new Date(plan.inicio_at).toLocaleDateString("es-ES", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="w-full max-w-[360px] overflow-hidden rounded-[20px] bg-[var(--bg)] shadow-elev-4">
        {/* Cover */}
        <div className="relative h-[160px] w-full bg-[var(--surface)]" style={coverStyle}>
          {!plan.foto_portada && (
            <div className="flex h-full items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="size-[40px] text-muted opacity-40">
                <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-4">
            <p className="text-[11px] font-[var(--fw-semibold)] uppercase tracking-wider text-white/70">
              Te han invitado a
            </p>
            <h1 className="text-[20px] font-[var(--fw-bold)] text-white leading-tight">{plan.titulo}</h1>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-2 border-b border-app">
          <div className="flex items-center gap-2 text-body-sm text-muted">
            <svg viewBox="0 0 24 24" fill="none" className="size-[15px] shrink-0">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <span>{startDate}</span>
          </div>
          {plan.ubicacion_nombre && (
            <div className="flex items-center gap-2 text-body-sm text-muted">
              <svg viewBox="0 0 24 24" fill="none" className="size-[15px] shrink-0">
                <path d="M12 21C12 21 5 13.5 5 9a7 7 0 1114 0c0 4.5-7 12-7 12z" stroke="currentColor" strokeWidth="1.6"/>
                <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6"/>
              </svg>
              <span>{plan.ubicacion_nombre}</span>
            </div>
          )}
          {plan.creador_nombre && (
            <div className="flex items-center gap-2 text-body-sm text-muted">
              <svg viewBox="0 0 24 24" fill="none" className="size-[15px] shrink-0">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span>Organizado por <strong className="text-[var(--text-primary)]">{plan.creador_nombre}</strong></span>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={joining}
            className="w-full rounded-full bg-[var(--text-primary)] py-3 text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {joining ? "Uniéndose..." : "Unirse al plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
