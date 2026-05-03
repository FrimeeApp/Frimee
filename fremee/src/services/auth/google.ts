"use client";

import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { APP_AUTH_CALLBACK_PATH, APP_AUTH_CALLBACK_URI, APP_DEEP_LINK_SCHEME } from "@/config/app";
import { GOOGLE_CALENDAR_SCOPE } from "@/config/external";

/**
 * Debes registrar este redirect en Supabase -> Auth -> URL Configuration -> Redirect URLs
 * y configurar deep links en Android/iOS.
 */
export const CAPACITOR_REDIRECT_URI = APP_AUTH_CALLBACK_URI;

const AUTH_CALLBACK_HOST = "auth";
const AUTH_CALLBACK_HOST_PATH = APP_AUTH_CALLBACK_PATH.replace(`/${AUTH_CALLBACK_HOST}`, "") || "/";

function isOurCallbackUrl(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    const pathname = u.pathname.replace(/\/+$/, "");
    if (u.protocol !== `${APP_DEEP_LINK_SCHEME}:`) return false;

    // fremee://auth/callback
    if (u.host === AUTH_CALLBACK_HOST && pathname === AUTH_CALLBACK_HOST_PATH) return true;

    // fremee:///auth/callback (algunos entornos devuelven host vacío)
    if (!u.host && pathname === APP_AUTH_CALLBACK_PATH) return true;

    return false;
  } catch {
    return false;
  }
}

export async function signInWithGoogleCapacitor() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("signInWithGoogleCapacitor called outside native platform");
  }

  const supabase = createBrowserSupabaseClient();
  console.debug("[google] starting OAuth (capacitor)", CAPACITOR_REDIRECT_URI);

  // 1) Generar URL de OAuth sin redirigir automáticamente
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: CAPACITOR_REDIRECT_URI,
      skipBrowserRedirect: true,
      scopes: GOOGLE_CALENDAR_SCOPE,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      },
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("No OAuth URL returned from Supabase");

  // 2) Escuchar deep link de vuelta
  let handled = false;

  const sub = await App.addListener("appUrlOpen", async ({ url }) => {
    // Solo procesamos el deep link que nos interesa
    if (!isOurCallbackUrl(url)) {
      console.debug("[google] ignoring appUrlOpen", { url });
      return;
    }

    try {
      const u = new URL(url);
      const errorDesc =
        u.searchParams.get("error_description") || u.searchParams.get("error");
      const code = u.searchParams.get("code");

      console.debug("[google] appUrlOpen callback received", { url, code, errorDesc });

      handled = true;

      // Cerrar el browser embebido
      await Browser.close();

      if (errorDesc) {
        throw new Error(String(errorDesc));
      }

      if (!code) {
        throw new Error("No code returned in callback URL");
      }

      // 3) Canjear code -> session usando el PKCE verifier guardado en Preferences
      const { error: exchError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchError) throw exchError;

      console.debug("[google] exchangeCodeForSession success");

      // 4) Navegar dentro de tu app
      window.location.replace("/feed");
    } catch (e) {
      console.error("[google] OAuth error:", e);
      // Fallback: vete a login si algo falla
      window.location.replace("/login");
    } finally {
      // Limpia listener una vez gestionado
      if (handled) sub.remove();
    }
  });

  // 5) Abrir OAuth en navegador embebido
  await Browser.addListener("browserFinished", () => {
    console.debug("[google] browserFinished");
  });

  await Browser.open({ url: data.url, windowName: "_self" });
}
