"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { AlertCircle, ChevronLeft, RefreshCw } from "lucide-react";
import { FOCUS, GHOST_BTN } from "@/components/plans/home/pieces";
import { PassportCover } from "@/components/profile/passport/PassportCover";
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

  const header = (
    <div className="mx-auto flex h-14 w-full max-w-[460px] items-center gap-1 px-1">
      <button type="button" aria-label="Volver al perfil" onClick={() => router.back()} className={`grid size-11 place-content-center rounded-[8px] text-app ${FOCUS}`}>
        <ChevronLeft className="size-[22px]" aria-hidden />
      </button>
      <h1 className="m-0 flex-1 text-[18px] font-[var(--fw-semibold)] leading-[1.3]">Pasaporte</h1>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--passport-table)] pt-mobile-safe-top text-app">
      {header}
      {failed ? (
        <div role="alert" className="mx-auto flex w-full max-w-[460px] flex-1 flex-col items-center justify-center gap-3 px-6 pb-24 text-center">
          <AlertCircle className="size-10 text-[var(--error)]" aria-hidden />
          <p className="m-0 text-[20px] font-[var(--fw-semibold)] leading-tight">No se pudo abrir el pasaporte</p>
          <p className="m-0 text-[16px] leading-[1.5] text-muted">Comprueba la conexión y vuelve a intentarlo. Tus sellos siguen guardados.</p>
          <button
            type="button"
            className={`${GHOST_BTN} mt-2`}
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            <RefreshCw className="size-[18px]" aria-hidden />
            Reintentar
          </button>
        </div>
      ) : (
        <div aria-busy="true" className="flex flex-1 flex-col items-center justify-center gap-6 pb-24">
          <PassportCover width={200} tilt={0} loading />
          <p role="status" className="m-0 text-[14px] leading-[1.5] text-muted">Abriendo tu pasaporte…</p>
        </div>
      )}
    </div>
  );
}
