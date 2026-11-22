import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { countryOfPlace } from "@/lib/placeCountry";
import { parsePasaporte, type PasaporteLeido } from "@/lib/passport";
import type { TipoSubplan } from "./subplanes.endpoint";

/** Los transportes no dan sello de país (son trayectos de paso): no se gasta una geocodificación en ellos. */
const SIN_PAIS: ReadonlySet<TipoSubplan> = new Set<TipoSubplan>(["VUELO", "TREN", "BUS", "BARCO", "COCHE"]);

function logPais(what: string, err: unknown) {
  console.error(`[pais] ${what}:`, (err as { message?: string } | null)?.message ?? String(err));
}

/**
 * Guarda el país de un plan al crearlo o cambiarle el sitio. Se lanza sin esperar y sin avisar si falla:
 * crear el plan no puede depender de esto (lo que falte lo rellena la Edge Function de países).
 */
export function saveCountryOfPlan(planId: number, ubicacionNombre: string | null | undefined): void {
  const text = ubicacionNombre?.trim();
  if (!text || text.toLowerCase() === "por decidir") return;
  void (async () => {
    const code = await countryOfPlace({ text });
    if (!code) return;
    const { error } = await createBrowserSupabaseClient().rpc("fn_plan_set_pais", { p_plan_id: planId, p_country: code });
    if (error) logPais("No se guardó el país del plan", error);
  })();
}

/** Igual que saveCountryOfPlan, para una parada del itinerario (con sus coordenadas si las tiene). */
export function saveCountryOfSubplan(
  subplanId: number,
  place: { tipo?: TipoSubplan | null; nombre?: string | null; lat?: number | null; lng?: number | null },
): void {
  if (place.tipo && SIN_PAIS.has(place.tipo)) return;
  void (async () => {
    const code = await countryOfPlace({ lat: place.lat, lng: place.lng, text: place.nombre });
    if (!code) return;
    const { error } = await createBrowserSupabaseClient().rpc("fn_subplan_set_pais", { p_subplan_id: subplanId, p_country: code });
    if (error) logPais("No se guardó el país de la parada", error);
  })();
}

/** Sellos y ajustes del pasaporte (el tuyo, o el de otra persona si se pasa su id y puede verlo). */
export async function leerPasaporte(userId?: string): Promise<PasaporteLeido> {
  const { data, error } = await createBrowserSupabaseClient().rpc("fn_passport_leer", { p_user_id: userId ?? null });
  if (error) throw error;
  return parsePasaporte(data);
}

/** Quita la marca «Nuevo» de los sellos que ya has visto (se llama al abrir su página). */
export async function marcarSellosVistos(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createBrowserSupabaseClient().rpc("fn_passport_marcar_vistos", { p_stamp_ids: ids });
  if (error) throw error;
}

/** Oculta un sello (solo lo ves tú, en «Sellos ocultos») o vuelve a mostrarlo. */
export async function ocultarSello(stampId: number, oculto: boolean): Promise<void> {
  const { error } = await createBrowserSupabaseClient().rpc("fn_passport_ocultar", { p_stamp_id: stampId, p_oculto: oculto });
  if (error) throw error;
}

/** «No fui a este viaje»: quita tus sellos de ese plan y evita que vuelvan. */
export async function marcarNoFui(planId: number): Promise<void> {
  const { error } = await createBrowserSupabaseClient().rpc("fn_passport_no_fui", { p_plan_id: planId });
  if (error) throw error;
}
