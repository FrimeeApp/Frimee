"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);

    // 1. Fallback de rutas estáticas para Capacitor
    const staticFallback = resolveStaticFallback(url);
    if (staticFallback) {
      router.replace(staticFallback);
      return;
    }

    // 2. Vuelta de OAuth (Google, etc.)
    const hasOAuthParams =
      url.searchParams.has("code") ||
      url.searchParams.has("error") ||
      url.searchParams.has("error_description");
    if (hasOAuthParams) {
      router.replace(`/auth/callback${url.search}`);
      return;
    }

    // 3. App nativa (iOS / Android vía Capacitor)
    if (isNativeApp()) {
      router.replace("/feed");
      return;
    }

    // 4. Web: ir al login
    router.replace("/login");
  }, [router]);

  return null;
}
