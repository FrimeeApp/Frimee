"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Input } from "@/components/ui/Input";
import { AUTH_EMAIL_REGEX, getAuthErrorMessage } from "@/components/auth/AuthFormUtils";
import { requestGuestAccountSave, setSavedAccountPassword } from "@/services/auth/guest";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";

type Stage = "guest" | "pending_email" | "pending_password";

/**
 * Pastilla del modo invitado y formulario de "Guardar mi cuenta".
 * guest: anónimo → pide nombre y email.
 * pending_email: anónimo con el cambio de email pendiente de confirmar.
 * pending_password: email ya confirmado, falta la contraseña (metadato pending_password).
 */
export function GuestBanner() {
  const { user } = useAuth();

  const stage: Stage | null = !user
    ? null
    : user.is_anonymous
      ? user.new_email ? "pending_email" : "guest"
      : user.user_metadata?.pending_password ? "pending_password" : null;

  // Back from the confirmation link: ask for the password straight away instead
  // of waiting for the user to notice the pill (on load or when the stage changes).
  const [open, setOpen] = useState(stage === "pending_password");
  const [prevStage, setPrevStage] = useState(stage);
  if (stage !== prevStage) {
    setPrevStage(stage);
    if (stage === "pending_password") setOpen(true);
  }

  // The confirmation link is often opened in another window or device, where the
  // PKCE exchange fails even though the email was confirmed server-side. This
  // window still holds the old (anonymous) token: refresh it when the user comes
  // back so the confirmed account shows up here.
  useEffect(() => {
    if (stage !== "pending_email") return;
    const supabase = createBrowserSupabaseClient();
    const refresh = () => {
      if (document.visibilityState === "visible") void supabase.auth.refreshSession();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [stage]);

  if (!stage) return null;

  const label = {
    guest: "Estás en modo invitado",
    pending_email: `Confirma el email que te hemos enviado a ${user?.new_email}`,
    pending_password: "Falta poner tu contraseña",
  }[stage];
  const action = { guest: "Guardar mi cuenta", pending_email: "Cambiar email", pending_password: "Ponerla" }[stage];

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+var(--space-2))] z-[60] flex justify-center px-[var(--space-4)]">
        <div className="pointer-events-auto flex max-w-full items-center gap-[var(--space-3)] rounded-full border border-app bg-app py-[6px] pl-[var(--space-4)] pr-[6px] text-body-sm shadow-elev-2">
          <span className="truncate text-muted">{label}</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-full bg-[var(--text-primary)] px-[var(--space-3)] py-[4px] font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-85"
          >
            {action}
          </button>
        </div>
      </div>
      {open && (
        <SaveAccountDialog
          stage={stage === "pending_password" ? "password" : "email"}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function SaveAccountDialog({ stage, onClose }: { stage: "email" | "password"; onClose: () => void }) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (stage === "email") {
      const normalizedEmail = email.trim().toLowerCase();
      if (!nombre.trim()) return setError("Introduce tu nombre.");
      if (!AUTH_EMAIL_REGEX.test(normalizedEmail)) return setError("Introduce un email válido.");
      setSaving(true);
      try {
        await requestGuestAccountSave({ nombre: nombre.trim(), email: normalizedEmail });
        setSentTo(normalizedEmail);
      } catch (err) {
        setError(getAuthErrorMessage(err, "No se pudo guardar la cuenta. Inténtalo de nuevo."));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    setSaving(true);
    try {
      await setSavedAccountPassword(password);
      requestClose();
    } catch (err) {
      setError(getAuthErrorMessage(err, "No se pudo guardar la contraseña. Inténtalo de nuevo."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-closing={isClosing ? "true" : "false"}
      className="app-modal-overlay fixed inset-0 z-[1400] flex items-end justify-center px-4 pb-[max(var(--space-6),env(safe-area-inset-bottom))] sm:items-center"
      onClick={requestClose}
    >
      <div
        className="app-modal-panel w-full max-w-[400px] rounded-[18px] bg-app p-5 shadow-elev-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {sentTo ? (
          <>
            <h3 className="text-[18px] font-[700] leading-tight text-app">Revisa tu email</h3>
            <p className="mt-2 text-[14px] leading-snug text-muted">
              Te hemos enviado un enlace a <strong className="text-app">{sentTo}</strong>. Ábrelo
              en este mismo navegador para confirmar tu cuenta; después podrás poner tu contraseña.
            </p>
            <button
              type="button"
              onClick={requestClose}
              className="mt-5 w-full rounded-full bg-[var(--text-primary)] py-[10px] text-[14px] font-[700] text-contrast-token"
            >
              Entendido
            </button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <h3 className="text-[18px] font-[700] leading-tight text-app">
              {stage === "email" ? "Guardar mi cuenta" : "Pon tu contraseña"}
            </h3>
            <p className="mt-2 text-[14px] leading-snug text-muted">
              {stage === "email"
                ? "Conservarás tus planes, gastos y mensajes. Sin guardarla, la cuenta de invitado se borra a los 7 días."
                : "Tu email ya está confirmado. Con esta contraseña podrás entrar desde cualquier dispositivo."}
            </p>
            <div className="mt-4 space-y-[var(--space-3)]">
              {stage === "email" ? (
                <>
                  <Input
                    aria-label="Nombre"
                    placeholder="Nombre*"
                    autoComplete="name"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                  <Input
                    type="email"
                    aria-label="Correo electrónico"
                    placeholder="Email*"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </>
              ) : (
                <Input
                  type="password"
                  aria-label="Contraseña"
                  placeholder="Contraseña*"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </div>
            {error && <p className="mt-3 text-body-sm text-error-token">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={requestClose}
                className="flex-1 rounded-full border border-app py-[10px] text-[14px] font-[600] text-app transition-colors hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-full bg-[var(--text-primary)] py-[10px] text-[14px] font-[700] text-contrast-token transition-opacity hover:opacity-90 disabled:opacity-[var(--disabled-opacity)]"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
