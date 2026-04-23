"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { focusInput, getAuthErrorMessage } from "@/components/auth/AuthFormUtils";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

export default function ResetPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [invalidField, setInvalidField] = useState<"password" | "repeatPassword" | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const repeatPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const validateRecoveryLink = async () => {
      const supabase = createBrowserSupabaseClient();

      try {
        const url = new URL(window.location.href);
        const queryError =
          url.searchParams.get("error_description") || url.searchParams.get("error");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const code = url.searchParams.get("code");

        if (queryError) {
          setMsg({ type: "err", text: "El enlace no es válido o ha expirado." });
          setCanReset(false);
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setMsg({ type: "err", text: "El enlace no es válido o ha expirado." });
            setCanReset(false);
            return;
          }
        }

        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });

          if (error) {
            setMsg({ type: "err", text: "El enlace no es válido o ha expirado." });
            setCanReset(false);
            return;
          }
        }

        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : "";
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setMsg({ type: "err", text: "El enlace no es válido o ha expirado." });
            setCanReset(false);
            return;
          }

          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setMsg({ type: "err", text: "No hay una sesión de recuperación activa." });
          setCanReset(false);
          return;
        }

        setCanReset(true);
      } catch (error) {
        console.error("[reset] validateRecoveryLink error", error);
        setMsg({
          type: "err",
          text: "No se pudo validar el enlace de recuperación. Inténtalo de nuevo.",
        });
        setCanReset(false);
      } finally {
        setCheckingLink(false);
      }
    };

    validateRecoveryLink();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setInvalidField(null);

    if (!canReset) {
      setMsg({ type: "err", text: "No hay una sesión de recuperación activa." });
      return;
    }

    if (!password) {
      setMsg({ type: "err", text: "Introduce una contraseña nueva." });
      focusInput(passwordRef);
      return;
    }

    if (password.length < 6) {
      setMsg({ type: "err", text: "La contraseña debe tener al menos 6 caracteres." });
      focusInput(passwordRef);
      return;
    }

    if (!repeatPassword) {
      setMsg({ type: "err", text: "Repite la contraseña nueva." });
      focusInput(repeatPasswordRef);
      return;
    }

    if (password !== repeatPassword) {
      setMsg({ type: "err", text: "Las contraseñas no coinciden." });
      focusInput(repeatPasswordRef);
      return;
    }

    try {
      setSubmitting(true);
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMsg({
        type: "ok",
        text: "Contraseña actualizada. Te llevamos a iniciar sesión.",
      });

      setTimeout(() => router.replace("/login"), 1200);
    } catch (error) {
      console.error("[reset] updateUser error", error);
      setMsg({
        type: "err",
        text: getAuthErrorMessage(error, "No se pudo cambiar la contraseña. Inténtalo de nuevo."),
      });
      focusInput(passwordRef);
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingLink) {
    return (
      <div className="auth-page flex h-full w-full max-w-[420px] flex-col py-[var(--space-6)] text-app md:py-[var(--space-8)]">
        <div className="flex flex-1 items-center">
          <div className="w-full">
            <h1 className="auth-title font-sans font-[var(--fw-semibold)] text-app">
              Nueva contraseña
            </h1>
            <h3 className="font-sans mt-[var(--space-1)] text-body text-muted">Validando enlace...</h3>
          </div>
        </div>

        <p className="mt-auto pb-[max(var(--space-2),env(safe-area-inset-bottom))] pt-[var(--space-6)] text-center text-caption text-tertiary md:pt-[var(--space-8)]">
          Al continuar, aceptas los{" "}
          <span className="font-[var(--fw-semibold)] text-muted">Términos y</span>
          <br />
          <span className="font-[var(--fw-semibold)] text-muted">Condiciones</span> de Frimee
        </p>
      </div>
    );
  }

  return (
    <div className="auth-page flex h-full w-full max-w-[420px] flex-col py-[var(--space-6)] text-app md:py-[var(--space-8)]">
      <div className="flex flex-1 items-center">
        <div className="w-full">
          <h1 className="auth-title font-sans font-[var(--fw-semibold)] text-app">
            Nueva contraseña
          </h1>
          <h3 className="font-sans mt-[var(--space-1)] text-body text-muted">Crea una nueva contraseña segura</h3>

          {msg && (
            <div
              className={`mt-[var(--space-4)] rounded-input border px-[var(--space-3)] py-[var(--space-2)] text-body-sm ${
                msg.type === "ok"
                  ? "border-success-token bg-[color-mix(in_srgb,var(--success)_14%,var(--surface)_86%)] text-success-token"
                  : "border-error-token bg-[color-mix(in_srgb,var(--error)_12%,var(--surface)_88%)] text-error-token"
              }`}
            >
              {msg.text}
            </div>
          )}

          {!canReset ? (
            <div className="pt-[var(--space-4)] text-body text-muted">
              <p>Pide un nuevo enlace para volver a intentarlo.</p>
              <Link href="/forgot" className="auth-link auth-link-primary font-[var(--fw-semibold)]">
                Volver a recuperar contraseña
              </Link>
            </div>
          ) : (
            <form className="mt-[var(--space-6)] space-y-[var(--space-3)]" onSubmit={onSubmit} noValidate>
              <div className={`h-input rounded-input border bg-[var(--input-bg)] px-[var(--input-padding-x)] transition-[border-color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] ${invalidField === "password" ? "border-error-token focus-within:border-error-token" : "border-app focus-within:border-[var(--input-border-focus)]"}`}>
                <div className="flex h-full items-center gap-[var(--space-3)]">
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-transparent text-body text-app outline-none placeholder:text-muted focus-visible:shadow-none"
                    aria-label="Contraseña nueva"
                    autoComplete="new-password"
                    placeholder="Contraseña nueva*"
                    value={password}
                    onChange={(e) => {
                    setPassword(e.target.value);
                    if (invalidField === "password") {
                      setInvalidField(null);
                      setMsg(null);
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

              <div className={`h-input rounded-input border bg-[var(--input-bg)] px-[var(--input-padding-x)] transition-[border-color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] ${invalidField === "repeatPassword" ? "border-error-token focus-within:border-error-token" : "border-app focus-within:border-[var(--input-border-focus)]"}`}>
                <div className="flex h-full items-center gap-[var(--space-3)]">
                  <input
                    ref={repeatPasswordRef}
                    type={showRepeatPassword ? "text" : "password"}
                    className="w-full bg-transparent text-body text-app outline-none placeholder:text-muted focus-visible:shadow-none"
                    aria-label="Repetir contraseña"
                    autoComplete="new-password"
                    placeholder="Repetir contraseña*"
                    value={repeatPassword}
                    onChange={(e) => {
                    setRepeatPassword(e.target.value);
                    if (invalidField === "repeatPassword") {
                      setInvalidField(null);
                      setMsg(null);
                    }
                  }}
                  />
                  <button
                    type="button"
                    className="text-muted"
                    aria-label={
                      showRepeatPassword
                        ? "Ocultar repetir contraseña"
                        : "Mostrar repetir contraseña"
                    }
                    onClick={() => setShowRepeatPassword((prev) => !prev)}
                  >
                    <EyeIcon open={showRepeatPassword} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="auth-solid-button h-btn-primary w-full rounded-button text-button-md font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] disabled:opacity-[var(--disabled-opacity)]"
              >
                {submitting ? "Guardando..." : "Cambiar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="mt-auto pb-[max(var(--space-2),env(safe-area-inset-bottom))] pt-[var(--space-6)] text-center text-caption text-tertiary md:pt-[var(--space-8)]">
        Al continuar, aceptas los{" "}
        <span className="font-[var(--fw-semibold)] text-muted">Términos y</span>
        <br />
        <span className="font-[var(--fw-semibold)] text-muted">Condiciones</span> de Frimee
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
