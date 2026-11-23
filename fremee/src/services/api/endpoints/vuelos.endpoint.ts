import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type FlightVisibility = "AMISTADES" | "NADIE";

/** Quién ve que estás volando: tus amistades (por defecto) o nadie. */
export async function fetchFlightVisibility(): Promise<FlightVisibility> {
  const { data, error } = await createBrowserSupabaseClient().rpc("fn_vuelos_visibilidad_get");
  if (error) throw error;
  return data === "NADIE" ? "NADIE" : "AMISTADES";
}

export async function saveFlightVisibility(visibility: FlightVisibility): Promise<void> {
  const { error } = await createBrowserSupabaseClient().rpc("fn_vuelos_visibilidad_set", { p_visibilidad: visibility });
  if (error) throw error;
}
