"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APP_HOME_PATH } from "@/config/app";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

// En Capacitor (exportación estática), todas las rutas aterrizan en "/" con el
// path real codificado en la URL. Este helper extrae el destino correcto.
function resolveStaticFallback(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "profile" && parts[1] !== "static") {
    return `/profile/static?id=${encodeURIComponent(parts[1])}`;
  }
  return null;
}

function isNativeApp(): boolean {
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(
    w.Capacitor &&
      typeof w.Capacitor.isNativePlatform === "function" &&
      w.Capacitor.isNativePlatform(),
  );
}

/**
 * Portada pública de frimee.es. Quien no tiene sesión en la web ve qué es Frimee, qué datos
 * de Google usa y las páginas legales (lo que revisa Google para el inicio de sesión con su
 * cuenta, y lo primero que ve quien llega sin conocerla). Con sesión, en la app nativa o
 * a la vuelta de OAuth, se va directo a donde toca. El texto va en el HTML del servidor.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);

    const staticFallback = resolveStaticFallback(url);
    if (staticFallback) {
      router.replace(staticFallback);
      return;
    }

    const hasOAuthParams =
      url.searchParams.has("code") ||
      url.searchParams.has("error") ||
      url.searchParams.has("error_description");
    if (hasOAuthParams) {
      router.replace(`/auth/callback${url.search}`);
      return;
    }

    if (isNativeApp()) {
      router.replace(APP_HOME_PATH);
      return;
    }

    void createBrowserSupabaseClient().auth.getSession().then(({ data }) => {
      if (data.session) router.replace(APP_HOME_PATH);
    });
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-[var(--space-6)] py-[var(--space-12)] text-app">
      <div className="w-full max-w-[560px]">
        <h1 className="text-[40px] font-[var(--fw-bold)] leading-tight">Frimee</h1>
        <p className="mt-[var(--space-4)] text-[18px] leading-relaxed">
          Frimee junta en un solo plan lo que un grupo necesita para organizar un viaje o una
          quedada: las actividades de cada día, la ruta en el mapa, los gastos compartidos y quién
          debe a quién, las fotos del viaje y un chat con llamadas.
        </p>
        <p className="mt-[var(--space-3)] text-body text-muted">
          Funciona en la web y en Android. Si entras con tu cuenta de Google, Frimee solo usa tu
          nombre, tu email y tu foto de perfil para crear tu cuenta.
        </p>

        <div className="mt-[var(--space-8)] flex flex-col gap-[var(--space-3)] sm:flex-row">
          <Link
            href="/login"
            className="auth-solid-button flex h-btn-primary flex-1 items-center justify-center rounded-button text-button-md font-[var(--fw-medium)]"
          >
            Entrar
          </Link>
          <Link
            href="/invitado"
            className="flex h-btn-primary flex-1 items-center justify-center rounded-button border border-app text-button-md font-[var(--fw-medium)] text-app"
          >
            Probar sin cuenta
          </Link>
        </div>

        <nav aria-label="Información legal" className="mt-[var(--space-10)] flex flex-wrap gap-x-[var(--space-5)] gap-y-[var(--space-2)] text-body-sm text-muted">
          <Link href="/politica-de-privacidad" className="underline underline-offset-2">Política de privacidad</Link>
          <Link href="/terminos-y-condiciones" className="underline underline-offset-2">Términos y condiciones</Link>
          <Link href="/politica-de-cookies" className="underline underline-offset-2">Política de cookies</Link>
        </nav>
      </div>
    </main>
  );
}
