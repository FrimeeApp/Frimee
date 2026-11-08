import { useEffect, useRef } from "react";
import { requestDirections } from "@/components/plans/DayRouteMap";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { formatCompactRouteDistance, formatCompactRouteDuration } from "@/lib/route-formatters";
import type { LatLng } from "@/lib/polyline";

/** One activity of a day, as the leg finder needs it. */
export type LegStop = {
  id: number;
  /** A transport activity (flight, ferry) ends at `end`: the next leg starts there. */
  isTransport: boolean;
  /** How you get here from the previous activity; null = no leg to compute. */
  transporte: string | null;
  /** The leg into this stop is already saved (time or distance). */
  hasLeg: boolean;
  at: LatLng | null;
  end: LatLng | null;
};

export type LegRequest = { destId: number; key: string; from: LatLng; to: LatLng; mode: string };

/** Legs with a chosen transport but no saved time or distance, per day (activities in order). */
export function findMissingLegs(days: LegStop[][]): LegRequest[] {
  const legs: LegRequest[] = [];
  for (const stops of days) {
    stops.forEach((dest, idx) => {
      if (idx === 0 || !dest.transporte || dest.hasLeg || !dest.at) return;
      const prev = stops.at(idx - 1);
      const from = prev ? (prev.isTransport && prev.end ? prev.end : prev.at) : null;
      if (!from) return;
      const key = [dest.id, dest.transporte, `${from.lat},${from.lng}`, `${dest.at.lat},${dest.at.lng}`].join("|");
      legs.push({ destId: dest.id, key, from, to: dest.at, mode: dest.transporte });
    });
  }
  return legs;
}

/**
 * Computes the given legs (shared cache first, then /api/directions) and reports each result.
 * Each leg is requested once per page load, also when it fails, so a broken leg never loops.
 * `onComputed` should save the leg (updateSubplanViaje) so other screens and members get it.
 */
export function useComputeMissingLegs(
  legs: LegRequest[],
  onComputed: (destId: number, duracion: string, distancia: string, polyline: string) => void,
) {
  const onComputedRef = useRef(onComputed);
  useEffect(() => {
    onComputedRef.current = onComputed;
  }, [onComputed]);
  const requestedRef = useRef(new Set<string>());

  useEffect(() => {
    const pending = legs.filter((leg) => !requestedRef.current.has(leg.key));
    if (pending.length === 0) return;
    pending.forEach((leg) => requestedRef.current.add(leg.key));

    void (async () => {
      const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
      for (const leg of pending) {
        try {
          const data = await requestDirections({
            waypoints: [`${leg.from.lat},${leg.from.lng}`, `${leg.to.lat},${leg.to.lng}`],
            from: leg.from,
            to: leg.to,
            travelMode: leg.mode,
            accessToken: session?.access_token,
          });
          const result = data.legs?.[0];
          if (data.polyline && result?.duration) {
            onComputedRef.current(
              leg.destId,
              formatCompactRouteDuration(result.duration),
              formatCompactRouteDistance(result.distance),
              data.polyline,
            );
          }
        } catch (error) {
          console.warn("[trayectos] No se pudo calcular el tramo", leg.key, error);
        }
      }
    })();
  }, [legs]);
}
