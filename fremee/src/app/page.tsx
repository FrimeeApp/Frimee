"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { APP_HOME_PATH } from "@/config/app";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import LoginPage from "@/app/(auth)/login/page";

// En Capacitor (exportación estática), todas las rutas aterrizan en "/" con el
// path real codificado en la URL. Este helper extrae el destino correcto.
function resolveStaticFallback(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "profile" && parts[1] !== "static") {
    return `/profile/static?id=${encodeURIComponent(parts[1])}`;
  }
  return null;
}

// Lo que lee quien llega sin conocer la app, y Google para verificar el inicio de sesión con su cuenta.
const APP_DESCRIPTION =
  "Frimee reúne en un solo plan las actividades de cada día, la ruta en el mapa, los gastos compartidos, las fotos del viaje y el chat del grupo. Si entras con Google, solo usa tu nombre, tu email y tu foto de perfil para crear tu cuenta.";

function isNativeApp(): boolean {
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(
    w.Capacitor &&
      typeof w.Capacitor.isNativePlatform === "function" &&
      w.Capacitor.isNativePlatform(),
  );
}

/**
 * Raíz de frimee.es: el inicio de sesión, con qué es Frimee y qué datos de Google usa en el HTML
 * del servidor (en el panel verde en escritorio, como pie en móvil). Con sesión, en la app nativa o a la vuelta de OAuth, se va directo a donde toca.
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
    <AuthSplitLayout description={APP_DESCRIPTION}>
      <LoginPage />
    </AuthSplitLayout>
  );
}
