"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { AUTH_EMAIL_REGEX, focusInput, getAuthErrorMessage } from "@/components/auth/AuthFormUtils";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { Input } from "@/components/ui/Input";
import { EyeIcon } from "@/components/icons";
import { resolveMailboxUrl } from "@/config/external";

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
  const [invalidField, setInvalidField] = useState<"name" | "email" | "password" | "repeatPassword" | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const repeatPasswordRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInvalidField(null);

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName) {
      setErrorMsg("Introduce tu nombre.");
      setInvalidField("name");
      focusInput(nameRef);
      return;
    }

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
      setErrorMsg("Introduce una contraseña.");
      focusInput(passwordRef);
      return;
    }

    if (password.length < 6) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
      focusInput(passwordRef);
      return;
    }

    if (!repeatPassword) {
      setErrorMsg("Repite la contraseña.");
      focusInput(repeatPasswordRef);
      return;
    }

    if (password !== repeatPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      focusInput(repeatPasswordRef);
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { name: normalizedName },
        },
      });

      if (error) throw error;

      if (data.user?.identities?.length === 0) {
        setErrorMsg("Ya existe una cuenta con este email. Inicia sesión.");
        focusInput(emailRef);
        return;
      }

      setRegistrationComplete(true);
    } catch (err: unknown) {
      console.error("[register] signUp error", err);
      setErrorMsg(getAuthErrorMessage(err, "No se pudo crear la cuenta. Inténtalo de nuevo."));
      focusInput(emailRef);
    } finally {
      setLoading(false);
    }
  };

  const openMailbox = () => {
    const url = resolveMailboxUrl(email);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.href = `mailto:${email}`;
  };

  if (registrationComplete) {
    return (
      <div className="auth-page flex min-h-full w-full max-w-[420px] flex-col justify-center text-app">
        <div className="space-y-[var(--space-4)] rounded-modal border border-app bg-surface p-[var(--space-6)] shadow-elev-1">
          <h1 className="font-sans text-[var(--font-h2)] font-[var(--fw-semibold)] tracking-tight text-app">Registro completado</h1>
          <p className="text-body text-app">
            Tu cuenta ya está creada. Para activarla, confirma tu email desde el mensaje
            que te acabamos de enviar a <span className="font-[var(--fw-medium)]">{email}</span>.
          </p>
          <p className="text-body-sm text-muted">
            Si no ves el correo en la bandeja principal, revisa spam o promociones.
          </p>
          <button
            type="button"
            onClick={openMailbox}
            className="auth-solid-button h-btn-primary w-full rounded-button text-button-md font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)]"
          >
            Ir a mi correo
          </button>
          <Link href="/login" className="auth-link auth-link-primary block text-center text-body-sm font-[var(--fw-medium)]">
            Ya confirmé, ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page flex min-h-full w-full max-w-[420px] flex-col py-[var(--space-3)] text-app min-[800px]:py-[var(--space-8)]">
      <div className="flex flex-1 items-start min-[800px]:items-center">
        <div className="w-full">
          <h1 className="auth-title font-sans font-[var(--fw-semibold)] text-app">
            Empecemos
          </h1>
          <h3 className="font-sans mt-[var(--space-1)] text-body text-muted">Crea una cuenta</h3>

          <GoogleAuthButton className="auth-neutral-button mt-[var(--space-4)] flex h-btn-primary w-full items-center justify-center gap-[var(--button-gap)] rounded-button border border-app bg-[var(--input-bg)] text-button-md font-[var(--fw-medium)] text-app transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] min-[800px]:mt-[var(--space-6)]" />

          <div className="flex items-center gap-[var(--space-4)] py-[var(--space-3)]">
            <div className="flex-1 border-t border-app" />
            <span className="text-body-sm font-[var(--fw-medium)] text-muted">o</span>
            <div className="flex-1 border-t border-app" />
          </div>

          <form className="space-y-[var(--space-3)]" onSubmit={onSubmit} noValidate>
            <Input
              ref={nameRef}
              type="text"
              error={invalidField === "name"}
              aria-label="Nombre"
              autoComplete="name"
              placeholder="Nombre*"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (invalidField === "name") {
                  setInvalidField(null);
                  setErrorMsg(null);
                }
              }}
            />

            <Input
              ref={emailRef}
              type="email"
              error={invalidField === "email"}
              aria-label="Correo electrónico"
              autoComplete="email"
              placeholder="Email*"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (invalidField === "email") {
                  setInvalidField(null);
                  setErrorMsg(null);
                }
              }}
            />

            <Input
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              error={invalidField === "password"}
              aria-label="Contraseña"
              autoComplete="new-password"
              placeholder="Contraseña*"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (invalidField === "password") {
                  setInvalidField(null);
                  setErrorMsg(null);
                }
              }}
              trailing={
                <button
                  type="button"
                  className="text-muted"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  <EyeIcon open={showPassword} />
                </button>
              }
            />

            <Input
              ref={repeatPasswordRef}
              type={showRepeatPassword ? "text" : "password"}
              error={invalidField === "repeatPassword"}
              aria-label="Repetir contraseña"
              autoComplete="new-password"
              placeholder="Repetir contraseña*"
              value={repeatPassword}
              onChange={(e) => {
                setRepeatPassword(e.target.value);
                if (invalidField === "repeatPassword") {
                  setInvalidField(null);
                  setErrorMsg(null);
                }
              }}
              trailing={
                <button
                  type="button"
                  className="text-muted"
                  aria-label={showRepeatPassword ? "Ocultar repetir contraseña" : "Mostrar repetir contraseña"}
                  onClick={() => setShowRepeatPassword((prev) => !prev)}
                >
                  <EyeIcon open={showRepeatPassword} />
                </button>
              }
            />

            {errorMsg && <p className="text-body-sm text-error-token">{errorMsg}</p>}

            <button
              type="submit"
              disabled={loading}
              className="auth-solid-button h-btn-primary w-full rounded-button text-button-md font-[var(--fw-medium)] transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] disabled:opacity-[var(--disabled-opacity)]"
            >
              {loading ? "Creando cuenta..." : "Registrarse"}
            </button>
          </form>

          <p className="pt-[var(--space-3)] text-center text-body text-muted min-[800px]:pt-[var(--space-4)]">
            ¿Ya tienes una cuenta?{" "}
            <Link href="/login" className="auth-link auth-link-primary font-[var(--fw-semibold)]">
              Iniciar sesión
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
