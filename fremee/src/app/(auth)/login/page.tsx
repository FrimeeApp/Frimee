"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    let shouldUnlockOrientation = false;
    const supabase = createBrowserSupabaseClient();

    const lockOrientation = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        await ScreenOrientation.lock({ orientation: "portrait" });
        shouldUnlockOrientation = true;
      } catch (error) {
        console.warn("[login] No se pudo bloquear la orientacion:", error);
      }
    };

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.debug("[login] getSession", {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
      });

      if (session) router.replace("/feed");
    };

    lockOrientation();
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.debug("[login] onAuthStateChange", {
        event,
        hasSession: !!session,
      });
      if (session) router.replace("/feed");
    });

    return () => {
      subscription.unsubscribe();

      if (shouldUnlockOrientation) {
        ScreenOrientation.unlock().catch((error) => {
          console.warn("[login] No se pudo restaurar la orientacion:", error);
        });
      }
    };
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.replace("/feed");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error iniciando sesión.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
      // opcional: limpiar password en memoria
      setPassword("");
    }
  };

  return (
    <div className="flex h-full w-full max-w-[420px] flex-col py-[var(--space-6)] md:py-[var(--space-8)] text-app">
      <div className="flex flex-1 items-center">
        <div className="w-full">
        <h1 className="text-[var(--font-h1)] font-[var(--fw-semibold)] leading-[1.05] tracking-[-0.02em] text-app">
          Bienvenid@ de vuelta
        </h1>
        <h3 className="mt-[var(--space-1)] text-body text-muted">Inicia sesión con tu cuenta</h3>

        <GoogleAuthButton className="mt-[var(--space-6)] flex h-btn-primary w-full items-center justify-center gap-[var(--button-gap)] rounded-button border border-app bg-[var(--input-bg)] text-button-md font-[var(--fw-medium)] text-app transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] hover:bg-[var(--interactive-hover-surface)]" />

        <div className="flex items-center gap-[var(--space-4)] py-[var(--space-3)]">
          <div className="flex-1 border-t border-app" />
          <span className="text-body-sm font-[var(--fw-medium)] text-muted">o</span>
          <div className="flex-1 border-t border-app" />
        </div>

        <form className="space-y-[var(--space-3)]" onSubmit={onSubmit}>
          <div className="h-input rounded-input border border-app bg-[var(--input-bg)] px-[var(--input-padding-x)] transition-[border-color,box-shadow] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] focus-within:border-[var(--input-border-focus)] focus-within:shadow-[0_0_0_var(--focus-ring-width)_var(--focus-ring-color)]">
            <input
              type="email"
              className="h-full w-full bg-transparent text-body text-app outline-none placeholder:text-muted focus-visible:shadow-none"
              aria-label="Correo electronico"
              placeholder="Email*"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <div className="h-input rounded-input border border-app bg-[var(--input-bg)] px-[var(--input-padding-x)] transition-[border-color,box-shadow] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] focus-within:border-[var(--input-border-focus)] focus-within:shadow-[0_0_0_var(--focus-ring-width)_var(--focus-ring-color)]">
              <div className="flex h-full items-center gap-[var(--space-3)]">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full bg-transparent text-body text-app outline-none placeholder:text-muted focus-visible:shadow-none"
                  aria-label="Contraseña"
                  placeholder="Contraseña*"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="text-muted"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div className="pt-[var(--space-2)] text-right">
              <Link href="/forgot" className="text-body-sm text-muted transition-colors hover:text-app">
                ¿Has olvidado tu contraseña?
              </Link>
            </div>
          </div>

          {errorMsg && <p className="text-body-sm text-error-token">{errorMsg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-btn-primary w-full rounded-button bg-primary-token text-button-md font-[var(--fw-medium)] text-contrast-token transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] hover:bg-primary-hover-token disabled:opacity-[var(--disabled-opacity)]"
          >
            {loading ? "Entrando..." : "Iniciar sesión"}
          </button>
        </form>

        <p className="pt-[var(--space-4)] text-center text-body text-muted">
          ¿Todavía no tienes una cuenta?{" "}
          <Link href="/register" className="font-[var(--fw-semibold)] text-primary-token">
            Registrarse
          </Link>
        </p>
        </div>
      </div>

      <p className="mt-auto pb-[max(var(--space-2),env(safe-area-inset-bottom))] pt-[var(--space-6)] text-center text-caption text-tertiary md:pt-[var(--space-8)]">
        Al continuar, aceptas los{" "}
        <Link href="#" className="font-[var(--fw-semibold)] text-muted">
          Términos y <br /> Condiciones
        </Link>{" "}
        de Frimee
      </p>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      aria-hidden="true"
    >
      <path
        d="M2 12C3.8 8.6 7.4 6.5 12 6.5C16.6 6.5 20.2 8.6 22 12C20.2 15.4 16.6 17.5 12 17.5C7.4 17.5 3.8 15.4 2 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      {!open && <path d="M4 4L20 20" stroke="currentColor" strokeWidth="1.7" />}
    </svg>
  );
}
