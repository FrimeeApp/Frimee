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
        "flex h-btn-primary w-full items-center justify-center gap-[var(--button-gap)] rounded-button border border-app bg-surface text-button-lg text-app transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] hover:bg-[var(--interactive-hover-surface)]"
      }
    >
      <GoogleGIcon />
      {label}
    </button>
  );
}

function GoogleGIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#fbbc04" d="M43.611 20.083H42V20H24v8h11.303C33.651 32.657 29.215 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#ea4335" d="M6.306 14.691l6.571 4.819C14.655 16.108 19.007 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.268 4 24 4c-7.682 0-14.36 4.337-17.694 10.691z"/>
      <path fill="#34a853" d="M24 44c5.115 0 9.81-1.967 13.328-5.173l-6.153-5.207C29.167 35.091 26.715 36 24 36c-5.189 0-9.61-3.317-11.271-7.946l-6.52 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#4285f4" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.27-2.253 4.189-4.128 5.62l.003-.002 6.153 5.207C36.897 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}
