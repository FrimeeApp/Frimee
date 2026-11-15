import { loadGoogleMapsScript } from "@/lib/googleMaps";

/**
 * Finds a place by name on Google Places (the same search the location fields use) and returns
 * the first result with its coordinates, or null. `query` can carry the trip's destination to bias
 * it: «Time Out Market, Lisboa».
 */
export async function resolvePlace(query: string): Promise<{ nombre: string; lat: number; lng: number } | null> {
  try {
    await loadGoogleMapsScript();
    const { suggestions } = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: query });
    const first = suggestions?.[0]?.placePrediction;
    if (!first) return null;
    const place = first.toPlace();
    await place.fetchFields({ fields: ["location"] });
    if (!place.location) return null;
    return { nombre: first.text.toString(), lat: place.location.lat(), lng: place.location.lng() };
  } catch {
    return null;
  }
}
