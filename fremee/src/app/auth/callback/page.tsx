"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import LoadingScreen from "@/components/common/LoadingScreen";

export default function AuthCallbackPage() {
  const router = useRouter();
  const hasStartedRef = useRef(false);

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
            router.replace("/feed");
            return;
          }
          router.replace("/login");
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("exchangeCodeForSession error:", error);
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

        router.replace("/feed");
      } catch (e) {
        console.error("Auth callback exception:", e);
        router.replace("/login");
      }
    };

    run();
  }, [router]);

  return <LoadingScreen />;

}
