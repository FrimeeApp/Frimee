export const AUTH_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function focusInput(ref: { current: HTMLInputElement | null }) {
  ref.current?.focus();
  ref.current?.select?.();
}

export function getAuthErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "El email o la contraseña no son correctos.";
  }

  if (message.includes("email not confirmed")) {
    return "Debes confirmar tu email antes de continuar.";
  }

  if (message.includes("user already registered")) {
    return "Ya existe una cuenta con este email. Inicia sesión.";
  }

  if (message.includes("password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  if (message.includes("unable to validate email address")) {
    return "El email no es válido.";
  }

  return error.message || fallback;
}
