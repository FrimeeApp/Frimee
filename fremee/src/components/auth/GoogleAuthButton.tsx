"use client";

import { createBrowserSupabaseClient } from "@/services/supabase/client";

type Props = {
  label?: string;
  className?: string;
};

export default function GoogleAuthButton({
  label = "Continuar con Google",
  className,
}: Props) {
  const onGoogle = async () => {
    const supabase = createBrowserSupabaseClient();

    // Web: http(s)://.../auth/callback
    // Capacitor: capacitor://localhost/auth/callback (lo afinamos luego)
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) console.error(error);
  };

  return (
    <button
      type="button"
      onClick={onGoogle}
      className={
        `cursor-pointer ${
          className ??
          "flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-[#c0b8cb] bg-white text-xl font-medium text-[#555]"
        }`
      }
    >
      <span aria-hidden>G</span>
      {label}
    </button>
  );
}
