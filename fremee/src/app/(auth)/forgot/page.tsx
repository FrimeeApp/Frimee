"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AUTH_EMAIL_REGEX, focusInput, getAuthErrorMessage } from "@/components/auth/AuthFormUtils";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [invalidField, setInvalidField] = useState<"email" | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setInvalidField(null);

    const value = email.trim().toLowerCase();
    if (!value) {
      setMsg({ type: "err", text: "Introduce tu email." });
      setInvalidField("email");
      focusInput(emailRef);
      return;
    }

    if (!AUTH_EMAIL_REGEX.test(value)) {
      setMsg({ type: "err", text: "Introduce un email válido." });
      focusInput(emailRef);
      return;
    }

    try {
      setSubmitting(true);
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/reset/`;

      const { error } = await supabase.auth.resetPasswordForEmail(value, {
        redirectTo,
      });

      if (error) throw error;

      setMsg({
        type: "ok",
        text: "Te hemos enviado un enlace para restablecer tu contraseña.",
      });

      setTimeout(() => router.replace("/login"), 1500);
    } catch (err) {
      console.error("[forgot] exception", err);
      setMsg({
        type: "err",
        text: getAuthErrorMessage(err, "No se pudo enviar el email. Inténtalo de nuevo."),
      });
      setInvalidField("email");
      focusInput(emailRef);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page flex min-h-full w-full max-w-[420px] flex-col py-[var(--space-3)] text-app min-[800px]:py-[var(--space-8)]">
      <div className="flex flex-1 items-start min-[800px]:items-center">
        <div className="w-full">
          <h1 className="auth-title font-sans font-[var(--fw-semibold)] text-app">
            Recuperar
          </h1>
          <h3 className="font-sans mt-[var(--space-1)] text-body text-muted">
            Te enviaremos un enlace para restablecer tu contraseña
          </h3>

          <form className="mt-[var(--space-4)] space-y-[var(--space-3)] min-[800px]:mt-[var(--space-6)]" onSubmit={onSubmit} noValidate>
            <div className={`h-input rounded-input border bg-[var(--input-bg)] px-[var(--input-padding-x)] transition-[border-color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] ${invalidField === "email" ? "border-error-token focus-within:border-error-token" : "border-app focus-within:border-[var(--input-border-focus)]"}`}>
              <input
                ref={emailRef}
                type="email"
                className="h-full w-full bg-transparent text-body text-app outline-none placeholder:text-muted focus-visible:shadow-none"
                aria-label="Correo electrónico"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (invalidField === "email") {
                    setInvalidField(null);
                    setMsg(null);
                  }
                }}
                autoComplete="email"
                placeholder="Email*"
              />
            </div>

            {msg && (
              <p className={`text-body-sm ${msg.type === "ok" ? "text-success-token" : "text-error-token"}`}>
                {msg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="auth-solid-button h-btn-primary w-full rounded-button text-button-md font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] disabled:opacity-[var(--disabled-opacity)]"
            >
              {submitting ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>

          <p className="pt-[var(--space-3)] text-center text-body text-muted min-[800px]:pt-[var(--space-4)]">
            ¿Ya la recordaste?{" "}
            <Link href="/login" className="auth-link auth-link-primary font-[var(--fw-semibold)]">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>

      <p className="mt-auto pb-[max(var(--space-2),env(safe-area-inset-bottom))] pt-[var(--space-4)] text-center text-caption text-tertiary min-[800px]:pt-[var(--space-8)]">
        Al continuar, aceptas los{" "}
        <span className="font-[var(--fw-semibold)] text-muted">Términos y</span>
        <br />
        <span className="font-[var(--fw-semibold)] text-muted">Condiciones</span> de Frimee
      </p>
    </div>
  );
}
