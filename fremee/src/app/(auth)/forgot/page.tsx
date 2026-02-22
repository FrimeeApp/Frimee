"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const value = email.trim().toLowerCase();
    if (!value) {
      setMsg({ type: "err", text: "Introduce tu email." });
      return;
    }

    try {
      setSubmitting(true);
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/reset/`;

      const { error } = await supabase.auth.resetPasswordForEmail(value, {
        redirectTo,
      });

      if (error) {
        console.error("[forgot] resetPasswordForEmail error", error);
        setMsg({
          type: "err",
          text: error.message || "No se pudo enviar el email. Intentalo de nuevo.",
        });
        return;
      }

      setMsg({
        type: "ok",
        text: "Te hemos enviado un enlace para restablecer la contraseña.",
      });

      setTimeout(() => router.replace("/login"), 1500);
    } catch (err) {
      console.error("[forgot] exception", err);
      setMsg({
        type: "err",
        text: "Ha ocurrido un error inesperado. Intentalo de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full max-w-[420px] flex-col py-[var(--space-6)] text-app md:py-[var(--space-8)]">
      <div className="flex flex-1 items-center">
        <div className="w-full">
          <h1 className="text-[var(--font-h1)] font-[var(--fw-semibold)] leading-[1.05] tracking-[-0.02em] text-app">
            Recuperar
          </h1>
          <h3 className="mt-[var(--space-1)] text-body text-muted">
            Te enviaremos un enlace para restablecer tu contraseña
          </h3>

          <form className="mt-[var(--space-6)] space-y-[var(--space-3)]" onSubmit={onSubmit}>
            <div className="h-input rounded-input border border-app bg-[var(--input-bg)] px-[var(--input-padding-x)] transition-[border-color,box-shadow] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] focus-within:border-[var(--input-border-focus)] focus-within:shadow-[0_0_0_var(--focus-ring-width)_var(--focus-ring-color)]">
              <input
                type="email"
                className="h-full w-full bg-transparent text-body text-app outline-none placeholder:text-muted focus-visible:shadow-none"
                aria-label="Correo electronico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="Email*"
              />
            </div>

            {msg && (
              <div
                className={`rounded-input border px-[var(--space-3)] py-[var(--space-2)] text-body-sm ${
                  msg.type === "ok"
                    ? "border-success-token bg-[color-mix(in_srgb,var(--success)_14%,var(--surface)_86%)] text-success-token"
                    : "border-error-token bg-[color-mix(in_srgb,var(--error)_12%,var(--surface)_88%)] text-error-token"
                }`}
              >
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="h-btn-primary w-full rounded-button bg-primary-token text-button-md font-[var(--fw-medium)] text-contrast-token transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] hover:bg-primary-hover-token disabled:opacity-[var(--disabled-opacity)]"
            >
              {submitting ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>

          <p className="pt-[var(--space-4)] text-center text-body text-muted">
            ¿Ya la recordaste?{" "}
            <Link href="/login" className="font-[var(--fw-semibold)] text-primary-token">
              Volver a iniciar sesión
            </Link>
          </p>
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
