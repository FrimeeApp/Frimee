"use client";

import { Capacitor } from "@capacitor/core";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { signInWithGoogleCapacitor } from "@/services/auth/google";

type Props = {
  label?: string;
  className?: string;
};

export default function GoogleAuthButton({
  label = "Continuar con Google",
  className,
}: Props) {
  const onGoogle = async () => {
    try {
      // ✅ detección fiable
      if (Capacitor.isNativePlatform()) {
        await signInWithGoogleCapacitor();
        return;
      }

      // 🌐 web normal
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) console.error("[google] web OAuth error:", error);
    } catch (e) {
      console.error("[google] sign-in exception:", e);
    }
  };

  return (
    <button
      type="button"
      onClick={onGoogle}
      className={
        className ??
        "flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-[#c0b8cb] bg-white text-xl font-medium text-[#555] cursor-pointer"
      }
    >
      <span aria-hidden>G</span>
      {label}
    </button>
  );
}