"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

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

      // Si quieres controlar a qué pantalla llega el usuario al clicar el email,
      // define redirectTo. En web, normalmente:
      // const redirectTo = `${window.location.origin}/reset`;
      //
      // En Capacitor, usarías un deep link (si lo tienes configurado):
      // const redirectTo = `fremee://auth/reset`;
      //
      // Si no pones redirectTo, Supabase usa el Site URL / configuración del proyecto.
      const redirectTo = `${window.location.origin}/reset/`;

      const { error } = await supabase.auth.resetPasswordForEmail(value, {
        redirectTo,
      });

      if (error) {
        console.error("[forgot] resetPasswordForEmail error", error);
        setMsg({
          type: "err",
          text: error.message || "No se pudo enviar el email. Inténtalo de nuevo.",
        });
        return;
      }

      setMsg({
        type: "ok",
        text: "Te hemos enviado un enlace para restablecer la contraseña.",
      });

      // volver a login
      setTimeout(() => router.replace("/login"), 1500);
    } catch (err) {
      console.error("[forgot] exception", err);
      setMsg({
        type: "err",
        text: "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[340px] space-y-7 text-[#535353]">
      <h1 className="text-6xl font-medium tracking-tight">Recuperar</h1>

      <form className="space-y-6" onSubmit={onSubmit}>
        <fieldset className="rounded-[12px] border border-[#9f9f9f] px-3 pb-2 pt-0.5">
          <legend className="px-1 text-sm text-[#8b8b8b]">E-mail*</legend>
          <input
            type="email"
            className="w-full bg-transparent text-base outline-none"
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
                ? "border-[#1FAF8B] bg-[#E6F6F2] text-[#116F59]"
                : "border-[#E5484D] bg-[#FDECEC] text-[#8A1F23]"
            }`}
          >
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-[#2ec8b0] to-[#1f8b77] text-lg font-medium text-white disabled:opacity-60"
        >
          {submitting ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>

      <div className="pt-2 text-center text-sm text-[#6b6b6b]">
        ¿Ya la recordaste?{" "}
        <Link href="/login" className="font-medium text-[#1dbf9a]">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
