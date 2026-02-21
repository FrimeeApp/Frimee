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
        text: "Te hemos enviado un enlace para restablecer la contrasena.",
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
    <div className="mx-auto w-full max-w-[340px] space-y-7 text-[var(--color-text-primary)]">
      <h1 className="text-6xl font-medium tracking-tight text-[var(--color-text-strong)]">Recuperar</h1>

      <form className="space-y-6" onSubmit={onSubmit}>
        <fieldset className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3 pb-2 pt-0.5">
          <legend className="px-1 text-sm text-[var(--color-text-muted)]">E-mail*</legend>
          <input
            type="email"
            className="w-full bg-transparent text-base text-[var(--color-text-primary)] outline-none"
            aria-label="Correo electronico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </fieldset>

        {msg && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              msg.type === "ok"
                ? "border-[var(--color-border-success)] bg-[var(--color-bg-success-soft)] text-[var(--color-text-success)]"
                : "border-[var(--color-border-danger)] bg-[var(--color-bg-danger-soft)] text-[var(--color-text-danger)]"
            }`}
          >
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-[var(--color-button-primary-start)] to-[var(--color-button-primary-end)] text-lg font-medium text-white disabled:opacity-60"
        >
          {submitting ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>

      <div className="pt-2 text-center text-sm text-[var(--color-text-subtle)]">
        Ya la recordaste?{" "}
        <Link href="/login" className="font-medium text-[var(--color-text-accent)]">
          Volver a iniciar sesion
        </Link>
      </div>
    </div>
  );
}
