import { createBrowserSupabaseClient } from "@/services/supabase/client";

/**
 * Entra como invitado (usuario anónimo de Supabase) y le crea el plan de ejemplo.
 * Devuelve el id del plan, o null si la sesión se creó pero el ejemplo falló:
 * en ese caso el invitado entra igualmente, con la cuenta vacía.
 */
export async function startGuestSession(): Promise<number | null> {
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;

  const { data: planId, error: seedError } = await supabase.rpc("fn_guest_seed_demo");
  if (seedError) {
    console.error("[guest] No se pudo crear el plan de ejemplo:", seedError.message);
    return null;
  }
  return planId as number;
}

/**
 * Paso 1 de "Guardar mi cuenta": Supabase manda un email de confirmación. Al
 * confirmarlo la cuenta deja de ser anónima y el trigger de auth.users cambia
 * el email y el nombre de relleno por estos. El id no cambia: se conservan los datos.
 * La contraseña solo se puede poner después de confirmar el email, así que se
 * deja marcada como pendiente en los metadatos.
 */
export async function requestGuestAccountSave(params: { nombre: string; email: string }): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    email: params.email,
    data: { full_name: params.nombre, pending_password: true },
  });
  if (error) throw error;
}

/** Paso 2 de "Guardar mi cuenta", con el email ya confirmado. */
export async function setSavedAccountPassword(password: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    password,
    data: { pending_password: null },
  });
  if (error) throw error;
}
