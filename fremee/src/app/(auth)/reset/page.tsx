"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
          setMsg({ type: "err", text: "El enlace no es valido o ha expirado." });
          setCanReset(false);
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setMsg({ type: "err", text: "El enlace no es valido o ha expirado." });
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
            setMsg({ type: "err", text: "El enlace no es valido o ha expirado." });
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
            setMsg({ type: "err", text: "El enlace no es valido o ha expirado." });
            setCanReset(false);
            return;
          }

          // Limpia tokens de la URL tras validar.
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setMsg({ type: "err", text: "No hay una sesion de recuperacion activa." });
          setCanReset(false);
          return;
        }

        setCanReset(true);
      } catch (error) {
        console.error("[reset] validateRecoveryLink error", error);
        setMsg({
          type: "err",
          text: "No se pudo validar el enlace de recuperacion. Intentalo de nuevo.",
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

    if (!canReset) {
      setMsg({ type: "err", text: "No hay una sesion de recuperacion activa." });
      return;
    }

    if (password.length < 6) {
      setMsg({ type: "err", text: "La contrasena debe tener al menos 6 caracteres." });
      return;
    }

    if (password !== repeatPassword) {
      setMsg({ type: "err", text: "Las contrasenas no coinciden." });
      return;
    }

    try {
      setSubmitting(true);
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMsg({ type: "err", text: error.message || "No se pudo cambiar la contrasena." });
        return;
      }

      setMsg({
        type: "ok",
        text: "Contrasena actualizada. Te llevamos a iniciar sesion.",
      });

      setTimeout(() => router.replace("/login"), 1200);
    } catch (error) {
      console.error("[reset] updateUser error", error);
      setMsg({
        type: "err",
        text: "Ha ocurrido un error inesperado. Intentalo de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingLink) {
    return (
      <div className="mx-auto w-full max-w-[340px] space-y-7 text-[var(--color-text-primary)]">
        <h1 className="text-6xl font-medium tracking-tight text-[var(--color-text-strong)]">Nueva contrasena</h1>
        <p className="text-base text-[var(--color-text-subtle)]">Validando enlace...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[340px] space-y-7 text-[var(--color-text-primary)]">
      <h1 className="text-6xl font-medium tracking-tight text-[var(--color-text-strong)]">Nueva contrasena</h1>

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

      {!canReset ? (
        <div className="space-y-2 text-sm text-[var(--color-text-subtle)]">
          <p>Pide un nuevo enlace para volver a intentarlo.</p>
          <Link href="/forgot" className="font-medium text-[var(--color-text-accent-strong)] underline">
            Volver a recuperar contrasena
          </Link>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={onSubmit}>
          <fieldset className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3 pb-2 pt-0.5">
            <legend className="px-1 text-sm text-[var(--color-text-muted)]">Contrasena nueva*</legend>
            <div className="flex items-center gap-3">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full bg-transparent text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)]"
                aria-label="Contrasena nueva"
                autoComplete="new-password"
                placeholder="Escribe tu nueva contrasena"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="cursor-pointer text-[var(--color-text-muted)]"
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </fieldset>

          <fieldset className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3 pb-2 pt-0.5">
            <legend className="px-1 text-sm text-[var(--color-text-muted)]">Repetir contrasena*</legend>
            <div className="flex items-center gap-3">
              <input
                type={showRepeatPassword ? "text" : "password"}
                className="w-full bg-transparent text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)]"
                aria-label="Repetir contrasena"
                autoComplete="new-password"
                placeholder="Repite tu nueva contrasena"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="cursor-pointer text-[var(--color-text-muted)]"
                aria-label={
                  showRepeatPassword
                    ? "Ocultar repetir contrasena"
                    : "Mostrar repetir contrasena"
                }
                onClick={() => setShowRepeatPassword((prev) => !prev)}
              >
                <EyeIcon open={showRepeatPassword} />
              </button>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full cursor-pointer rounded-xl bg-gradient-to-r from-[var(--color-button-primary-start)] to-[var(--color-button-primary-end)] text-lg font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Guardando..." : "Cambiar contrasena"}
          </button>
        </form>
      )}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className="size-7"
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
