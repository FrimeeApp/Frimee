"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import LoadingScreen from "@/components/common/LoadingScreen";
import { APP_HOME_PATH } from "@/config/app";

export default function AuthCallbackPage() {
  const router = useRouter();
  const hasStartedRef = useRef(false);
  const [confirmedElsewhere, setConfirmedElsewhere] = useState(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const run = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorDesc =
          url.searchParams.get("error_description") || url.searchParams.get("error");
        console.debug("[callback] loaded", {
          href: window.location.href,
          hasCode: !!code,
          errorDesc,
        });

        if (errorDesc) {
          console.error("OAuth error:", errorDesc);
          router.replace("/login");
          return;
        }

        if (!code) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            router.replace(APP_HOME_PATH);
            return;
          }
          router.replace("/login");
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("exchangeCodeForSession error:", error);
          // Link opened in another browser/window than the one that started the flow
          // (typical for "Guardar mi cuenta"): Supabase already confirmed the email,
          // only this window cannot get that session. Tell the user, even if this
          // window happens to be logged in with another account.
          if (error.name === "AuthPKCECodeVerifierMissingError") {
            setConfirmedElsewhere(true);
            return;
          }
          const {
            data: { session: maybeSession },
          } = await supabase.auth.getSession();
          if (!maybeSession) {
            router.replace("/login");
            return;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        console.log("[callback] exchange success", {
          hasSession: !!session,
          userId: session?.user?.id ?? null,
        });

        router.replace(APP_HOME_PATH);
      } catch (e) {
        console.error("Auth callback exception:", e);
        router.replace("/login");
      }
    };

    run();
  }, [router]);

  if (confirmedElsewhere) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app px-[var(--space-6)] text-center">
        <div className="max-w-[380px]">
          <h1 className="text-[22px] font-[var(--fw-bold)] text-app">Email confirmado</h1>
          <p className="mt-[var(--space-2)] text-body text-muted">
            Vuelve a la ventana o al dispositivo donde estabas guardando tu cuenta: allí podrás
            poner tu contraseña.
          </p>
          <Link href="/login" className="mt-[var(--space-5)] inline-block text-body-sm font-[var(--fw-semibold)] text-app underline underline-offset-2">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return <LoadingScreen />;

}
