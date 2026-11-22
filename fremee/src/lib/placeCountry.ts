import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { getGoogleMaps, loadGoogleMapsScript } from "@/lib/googleMaps";

/**
 * Código de país (ISO 3166-1 alfa-2, «PT») de un sitio. Con coordenadas se calcula en la base de datos con
 * fronteras propias (fn_pais_de_punto, sin Google). Solo si eso no da país, o si no hay coordenadas, se usa la
 * geocodificación de Google Maps con el nombre. Si no se puede saber devuelve null: el pasaporte lo rellenará
 * más tarde la Edge Function de países.
 */
export async function countryOfPlace(place: { lat?: number | null; lng?: number | null; text?: string | null }): Promise<string | null> {
  const text = place.text?.trim() ?? "";
  const hasCoords = typeof place.lat === "number" && typeof place.lng === "number";
  if (!hasCoords && !text) return null;
  if (hasCoords) {
    const { data, error } = await createBrowserSupabaseClient().rpc("fn_pais_de_punto", { p_lat: place.lat as number, p_lng: place.lng as number });
    if (!error && typeof data === "string" && /^[A-Z]{2}$/.test(data)) return data;
  }
  try {
    await loadGoogleMapsScript();
    const geocoder = new (getGoogleMaps().Geocoder)();
    const { results } = await geocoder.geocode(hasCoords ? { location: { lat: place.lat as number, lng: place.lng as number } } : { address: text });
    for (const r of results ?? []) {
      const country = r.address_components?.find((c) => c.types.includes("country"));
      const code = country?.short_name?.toUpperCase();
      if (code && /^[A-Z]{2}$/.test(code)) return code;
    }
  } catch (err) {
    // ZERO_RESULTS es normal (un nombre que no existe): no es un error que registrar.
    const status = (err as { code?: string } | null)?.code;
    if (status !== "ZERO_RESULTS") console.error("[pais] No se pudo geocodificar:", (err as { message?: string })?.message ?? status ?? "");
  }
  return null;
}
