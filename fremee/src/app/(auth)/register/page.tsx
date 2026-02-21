"use client";

import { useState } from "react";
import Link from "next/link";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== repeatPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) throw error;

      setRegistrationComplete(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error registrando usuario.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const openMailbox = () => {
    const domain = email.split("@")[1]?.toLowerCase();
    const providers: Record<string, string> = {
      "gmail.com": "https://mail.google.com",
      "outlook.com": "https://outlook.live.com/mail",
      "hotmail.com": "https://outlook.live.com/mail",
      "live.com": "https://outlook.live.com/mail",
      "yahoo.com": "https://mail.yahoo.com",
      "icloud.com": "https://www.icloud.com/mail",
    };

    const url = domain ? providers[domain] : null;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.href = `mailto:${email}`;
  };

  if (registrationComplete) {
    return (
      <div className="mx-auto w-full max-w-[340px] space-y-7 text-[var(--color-text-primary)]">
        <h1 className="text-5xl font-medium tracking-tight text-[var(--color-text-strong)]">Registro completado</h1>
        <div className="space-y-4 rounded-2xl border border-[var(--color-border-surface)] bg-[var(--color-bg-surface)] p-6">
          <p className="text-base leading-7 text-[var(--color-text-primary)]">
            Tu cuenta ya esta creada. Para activarla, confirma tu email desde el mensaje
            que te acabamos de enviar a <span className="font-medium">{email}</span>.
          </p>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            Si no ves el correo en la bandeja principal, revisa spam o promociones.
          </p>
          <button
            type="button"
            onClick={openMailbox}
            className="h-11 w-full cursor-pointer rounded-xl bg-gradient-to-r from-[var(--color-button-primary-start)] to-[var(--color-button-primary-end)] text-sm font-medium text-white"
          >
            Ir a mi correo
          </button>
          <Link href="/login" className="block text-center text-sm font-medium text-[var(--color-text-accent)]">
            Ya confirme, ir a iniciar sesion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-[340px] flex-col justify-center text-[var(--color-text-primary)] lg:min-h-0 lg:block">
      <h1 className="text-[34px] font-medium leading-[0.98] tracking-normal text-[var(--color-text-strong)] sm:text-3xl">Empecemos</h1>
      <h3 className="mb-5 font-medium tracking-tight text-[var(--color-text-subtle)]">Crea una cuenta</h3>

      <GoogleAuthButton />

      <div className="flex items-center gap-4 py-1.5">
        <div className="flex-1 border-t border-[var(--color-border-muted)]" />
        <span className="text-sm font-medium text-[var(--color-text-divider)]">o</span>
        <div className="flex-1 border-t border-[var(--color-border-muted)]" />
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <fieldset className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3 pb-2 pt-0.5">
          <legend className="px-1 text-sm text-[var(--color-text-muted)]">Nombre*</legend>
          <input
            type="text"
            className="w-full bg-transparent text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)]"
            aria-label="Nombre"
            autoComplete="name"
            placeholder="Nombre*"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </fieldset>

        <fieldset className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3 pb-2 pt-0.5">
          <legend className="px-1 text-sm text-[var(--color-text-muted)]">E-mail*</legend>
          <input
            type="email"
            className="w-full bg-transparent text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)]"
            aria-label="Correo electronico"
            autoComplete="email"
            placeholder="Email*"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </fieldset>

        <fieldset className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3 pb-2 pt-0.5">
          <legend className="px-1 text-sm text-[var(--color-text-muted)]">Contrasena*</legend>
          <div className="flex items-center gap-3">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full bg-transparent text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)]"
              aria-label="Contrasena"
              autoComplete="new-password"
              placeholder="Contraseña*"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              placeholder="Repetir contraseña*"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
            />
            <button
              type="button"
              className="cursor-pointer text-[var(--color-text-muted)]"
              aria-label={
                showRepeatPassword ? "Ocultar repetir contrasena" : "Mostrar repetir contrasena"
              }
              onClick={() => setShowRepeatPassword((prev) => !prev)}
            >
              <EyeIcon open={showRepeatPassword} />
            </button>
          </div>
        </fieldset>

        {errorMsg && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full cursor-pointer rounded-xl bg-gradient-to-r from-[var(--color-button-primary-start)] to-[var(--color-button-primary-end)] text-lg font-medium text-white disabled:opacity-60"
        >
          {loading ? "Creando cuenta..." : "Registrarse"}
        </button>
      </form>

      <p className="pt-3 text-center text-base text-[var(--color-text-secondary)]">
        ¿Ya tienes una cuenta?{" "}
        <Link href="/login" className="font-medium text-[var(--color-text-accent)]">
          Iniciar sesión
        </Link>
      </p>

      <p className="pt-10 text-center text-sm leading-[1.35] text-[var(--color-text-muted)]">
        Al continuar, aceptas los <span className="font-semibold text-[var(--color-text-subtle)]">Términos y</span>
        <br />
        <span className="font-semibold text-[var(--color-text-subtle)]">Condiciones</span> de Frimee
      </p>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="size-7" aria-hidden="true">
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
