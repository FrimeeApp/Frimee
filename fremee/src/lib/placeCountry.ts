import { getGoogleMaps, loadGoogleMapsScript } from "@/lib/googleMaps";

/**
 * Código de país (ISO 3166-1 alfa-2, «PT») de un sitio, por sus coordenadas o, si no las hay, por su nombre.
 * Va por geocodificación de Google Maps, que ya se carga en la web. Si no se puede saber devuelve null:
 * el pasaporte lo rellenará más tarde la Edge Function de países.
 */
export async function countryOfPlace(place: { lat?: number | null; lng?: number | null; text?: string | null }): Promise<string | null> {
  const text = place.text?.trim() ?? "";
  const hasCoords = typeof place.lat === "number" && typeof place.lng === "number";
  if (!hasCoords && !text) return null;
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
