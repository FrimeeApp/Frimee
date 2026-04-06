"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { AUTH_EMAIL_REGEX, focusInput, getAuthErrorMessage } from "@/components/auth/AuthFormUtils";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/feed";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"email" | "password" | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) router.replace(redirectTo);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace(redirectTo);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [redirectTo, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInvalidField(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMsg("Introduce tu email.");
      setInvalidField("email");
      focusInput(emailRef);
      return;
    }

    if (!AUTH_EMAIL_REGEX.test(normalizedEmail)) {
      setErrorMsg("Introduce un email válido.");
      focusInput(emailRef);
      return;
    }

    if (!password) {
      setErrorMsg("Introduce tu contraseña.");
      focusInput(passwordRef);
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) throw error;

      router.replace(redirectTo);
    } catch (err: unknown) {
      setErrorMsg(getAuthErrorMessage(err, "No se pudo iniciar sesión. Inténtalo de nuevo."));
      focusInput(emailRef);
    } finally {
      setLoading(false);
      setPassword("");
    }
  };

  return (
    <div className="auth-page flex h-full w-full max-w-[420px] flex-col py-[var(--space-6)] text-app md:py-[var(--space-8)]">
      <div className="flex flex-1 items-center">
        <div className="w-full">
          <h1 className="auth-title font-sans font-[var(--fw-semibold)] text-app">
            Bienvenid@ de vuelta
          </h1>
          <h3 className="font-sans mt-[var(--space-1)] text-body text-muted">Inicia sesión con tu cuenta</h3>

          <GoogleAuthButton className="auth-neutral-button mt-[var(--space-6)] flex h-btn-primary w-full items-center justify-center gap-[var(--button-gap)] rounded-button border border-app bg-[var(--input-bg)] text-button-md font-[var(--fw-medium)] text-app transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)]" />

          <div className="flex items-center gap-[var(--space-4)] py-[var(--space-3)]">
            <div className="flex-1 border-t border-app" />
            <span className="text-body-sm font-[var(--fw-medium)] text-muted">o</span>
            <div className="flex-1 border-t border-app" />
          </div>

          <form className="space-y-[var(--space-3)]" onSubmit={onSubmit} noValidate>
            <div className={`h-input rounded-input border bg-[var(--input-bg)] px-[var(--input-padding-x)] transition-[border-color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] ${invalidField === "email" ? "border-error-token focus-within:border-error-token" : "border-app focus-within:border-[var(--input-border-focus)]"}`}>
              <input
                ref={emailRef}
                type="email"
                className="h-full w-full bg-transparent text-body text-app outline-none placeholder:text-muted focus-visible:shadow-none"
                aria-label="Correo electrónico"
                placeholder="Email*"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (invalidField === "email") {
                    setInvalidField(null);
                    setErrorMsg(null);
                  }
                }}
              />
            </div>

            <div>
              <div className={`h-input rounded-input border bg-[var(--input-bg)] px-[var(--input-padding-x)] transition-[border-color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] ${invalidField === "password" ? "border-error-token focus-within:border-error-token" : "border-app focus-within:border-[var(--input-border-focus)]"}`}>
                <div className="flex h-full items-center gap-[var(--space-3)]">
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-transparent text-body text-app outline-none placeholder:text-muted focus-visible:shadow-none"
                    aria-label="Contraseña"
                    placeholder="Contraseña*"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (invalidField === "password") {
                        setInvalidField(null);
                        setErrorMsg(null);
                      }
                    }}
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
                <Link href="/forgot" className="auth-link auth-link-muted text-body-sm text-muted">
                  ¿Has olvidado tu contraseña?
                </Link>
              </div>
            </div>

            {errorMsg && <p className="text-body-sm text-error-token">{errorMsg}</p>}

            <button
              type="submit"
              disabled={loading}
              className="auth-solid-button h-btn-primary w-full rounded-button text-button-md font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] disabled:opacity-[var(--disabled-opacity)]"
            >
              {loading ? "Entrando..." : "Iniciar sesión"}
            </button>
          </form>

          <p className="pt-[var(--space-4)] text-center text-body text-muted">
            ¿Todavía no tienes una cuenta?{" "}
            <Link href="/register" className="auth-link auth-link-primary font-[var(--fw-semibold)]">
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
