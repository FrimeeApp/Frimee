"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import AppSidebar from "@/components/common/AppSidebar";
import Libreta from "@/components/profile/passport/Libreta";
import { FOCUS, GHOST_BTN } from "@/components/plans/home/pieces";
import { useAuth } from "@/providers/AuthProvider";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";
import { leerPasaporte } from "@/services/api/endpoints/pasaporte.endpoint";
import type { PasaporteLeido } from "@/lib/passport";
import { closePassportOpening } from "@/lib/passportOpen";
import { readPassportCache } from "@/lib/passportCache";

/** Tu pasaporte abierto: la libreta con sus páginas. Se llega desde «Abrir pasaporte» en tu perfil. */
export default function PassportClient() {
  const router = useRouter();
  const { user } = useAuth();
  // Si vienes del perfil, ya hay datos: la libreta aparece al instante y se refresca por detrás.
  const [data, setData] = useState<{ nombre: string; pasaporte: PasaporteLeido } | null>(() => readPassportCache());
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

  // La tapa que venía escalándose se funde cuando la libreta ya tiene algo que enseñar (datos o error).
  const ready = Boolean(data) || failed;
  const bookRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ready) closePassportOpening(() => bookRef.current?.querySelector<HTMLElement>("[data-passport-book]") ?? null, bookRef.current);
  }, [ready]);

  return (
    <div className="min-h-dvh bg-[var(--passport-table)] text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />
        <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-mobile-safe-top md:py-[var(--space-8)] md:pr-[var(--space-14)]">
          <div className="mx-auto flex w-full max-w-[460px] md:max-w-[1080px] items-center gap-1 pb-2">
            <button type="button" onClick={() => router.back()} aria-label="Volver al perfil" className={`inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
              <ChevronLeft className="size-[22px]" aria-hidden />
            </button>
            <h1 className="m-0 flex-1 font-sans text-[18px] font-[var(--fw-semibold)] leading-[1.3]">Pasaporte</h1>
          </div>

          {failed ? (
            <div role="alert" className="mx-auto flex max-w-[460px] md:max-w-[1080px] flex-col items-start gap-3 p-4">
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
          ) : !data ? (
            <div role="status" aria-label="Cargando el pasaporte" className="mx-auto max-w-[460px] md:max-w-[1080px]">
              <div className="skeleton-shimmer aspect-[358/590] w-full rounded-[8px]" />
            </div>
          ) : (
            <div ref={bookRef}>
              <Libreta nombre={data.nombre} sellos={data.pasaporte.sellos} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
