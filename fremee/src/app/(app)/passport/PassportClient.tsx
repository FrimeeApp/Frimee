"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { GHOST_BTN } from "@/components/plans/home/pieces";
import { useAuth } from "@/providers/AuthProvider";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";
import { leerPasaporte } from "@/services/api/endpoints/pasaporte.endpoint";
import { buildPages, groupTrips, tripPageNumber, type PasaporteLeido } from "@/lib/passport";

/** El lector es una capa que se abre al pulsar: solo se carga en el cliente (no depende de la hora ni del tamaño de ventana del servidor). */
const PassportReader = dynamic(() => import("@/components/profile/passport/PassportReader"), { ssr: false });

/** Entrada directa al pasaporte (enlaces y avisos). Desde el perfil se abre como capa encima de él, sin pasar por aquí. */
export default function PassportClient() {
  const router = useRouter();
  const { user } = useAuth();
  // ?plan=<id>: abre el libro por la página de ese viaje (así llegas desde «Sello nuevo»).
  const planParam = Number(useSearchParams().get("plan")) || null;
  const [data, setData] = useState<{ nombre: string; pasaporte: PasaporteLeido } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([getPublicUserProfile(userId), leerPasaporte()])
      .then(([profile, pasaporte]) => {
        if (!cancelled) setData({ nombre: (profile as { nombre?: string } | null)?.nombre ?? "Viajero", pasaporte });
      })
      .catch((err) => {
        const { message, code } = (err ?? {}) as { message?: string; code?: string };
        console.error("[pasaporte] Error cargando el pasaporte:", message ?? err, code ?? "");
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  if (data) {
    const startPage = planParam ? tripPageNumber(buildPages(groupTrips(data.pasaporte.sellos)), planParam) ?? undefined : undefined;
    return <PassportReader nombre={data.nombre} sellos={data.pasaporte.sellos} ajustes={data.pasaporte.ajustes} userId={userId} startPage={startPage} onRequestClose={() => router.back()} />;
  }

  return (
    <div className="min-h-dvh bg-[var(--passport-table)] px-4 pt-mobile-safe-top text-app">
      {failed ? (
        <div role="alert" className="mx-auto flex max-w-[460px] flex-col items-start gap-3 p-4">
          <p className="m-0 text-[16px] font-[var(--fw-semibold)]">No se pudo abrir tu pasaporte</p>
          <p className="m-0 text-[14px] leading-[1.5] text-muted">Comprueba la conexión y vuelve a intentarlo.</p>
          <button
            type="button"
            className={GHOST_BTN}
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div role="status" aria-label="Cargando el pasaporte" className="mx-auto max-w-[460px] pt-14">
          <div className="skeleton-shimmer aspect-[358/590] w-full rounded-[8px]" />
        </div>
      )}
    </div>
  );
}
