"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingScreen from "@/components/common/LoadingScreen";
import { APP_HOME_PATH } from "@/config/app";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { startGuestSession } from "@/services/auth/guest";

/**
 * Entrada directa al modo invitado, para enlazarla desde la landing
 * (frimee-landing.es → frimee.es/invitado). Con una sesión ya abierta no crea
 * otro invitado: lleva a la app con esa sesión.
 */
export default function GuestEntryPage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
      if (session) {
        router.replace(APP_HOME_PATH);
        return;
      }
      try {
        const planId = await startGuestSession();
        router.replace(planId ? `/plans/${planId}` : APP_HOME_PATH);
      } catch (err) {
        console.error("[guest] No se pudo entrar como invitado:", err);
        setFailed(true);
      }
    })();
  }, [router]);

  if (failed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app px-[var(--space-6)] text-center">
        <div className="max-w-[380px]">
          <h1 className="text-[22px] font-[var(--fw-bold)] text-app">No se ha podido entrar como invitado</h1>
          <p className="mt-[var(--space-2)] text-body text-muted">Inténtalo de nuevo en unos minutos o crea una cuenta.</p>
          <Link href="/login" className="mt-[var(--space-5)] inline-block text-body-sm font-[var(--fw-semibold)] text-app underline underline-offset-2">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return <LoadingScreen />;
}
