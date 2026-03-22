import { NextRequest, NextResponse } from "next/server";
import { Client, TravelMode, UnitSystem } from "@googlemaps/google-maps-services-js";
import { createSupabaseServiceClient } from "@/services/supabase/server";

const client = new Client({});

// Round coords to 4 decimal places (~11m) for cache key stability
function r(n: number) { return Math.round(n * 1e4) / 1e4; }

type LatLng = { lat: number; lng: number };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      waypoints: string[];
      originCoords?: LatLng;
      destCoords?: LatLng;
      travelMode?: string;
    };
    const { waypoints, originCoords, destCoords, travelMode } = body;

    const TRAVEL_MODE_MAP: Record<string, TravelMode> = {
      APIE:  TravelMode.walking,
      COCHE: TravelMode.driving,
      TAXI:  TravelMode.driving,
      BUS:   TravelMode.transit,
      METRO: TravelMode.transit,
      TREN:  TravelMode.transit,
    };
    const mode = (travelMode && TRAVEL_MODE_MAP[travelMode]) ? TRAVEL_MODE_MAP[travelMode] : TravelMode.driving;

    if (!waypoints || waypoints.length < 2) {
      return NextResponse.json({ error: "Se necesitan al menos 2 ubicaciones" }, { status: 400 });
    }

    // ── Cache lookup (only when both endpoints have stored coords) ──
    if (originCoords && destCoords) {
      try {
        const supabase = createSupabaseServiceClient();
        const oLat = r(originCoords.lat), oLng = r(originCoords.lng);
        const dLat = r(destCoords.lat),   dLng = r(destCoords.lng);

        const { data: cached } = await supabase
          .from("route_cache")
          .select("polyline, distance, duration")
          .eq("origin_lat", oLat).eq("origin_lng", oLng)
          .eq("dest_lat",   dLat).eq("dest_lng",   dLng)
          .maybeSingle();

        if (cached) {
          return NextResponse.json({
            polyline: cached.polyline,
            legs: [{ distance: cached.distance, duration: cached.duration }],
            cached: true,
          });
        }
      } catch { /* cache unavailable — continue to Google API */ }
    }

    // ── Call Google Directions API ──
    const origin      = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const stops       = waypoints.slice(1, -1);

    const response = await client.directions({
      params: {
        origin,
        destination,
        waypoints: stops,
        optimize: false,
        mode,
        units: UnitSystem.metric,
        language: "es",
        key: process.env.GOOGLE_MAPS_SERVER_KEY!,
      },
    });

    if (response.data.status !== "OK") {
      return NextResponse.json({ error: response.data.status }, { status: 400 });
    }

    const route    = response.data.routes[0];
    const polyline = route.overview_polyline.points;
    const legs     = route.legs.map((leg) => ({
      distance: leg.distance?.text,
      duration: leg.duration?.text,
      start:    leg.start_address,
      end:      leg.end_address,
    }));

    // ── Store in cache ──
    if (originCoords && destCoords) {
      try {
        const supabase = createSupabaseServiceClient();
        await supabase.from("route_cache").upsert({
          origin_lat: r(originCoords.lat), origin_lng: r(originCoords.lng),
          dest_lat:   r(destCoords.lat),   dest_lng:   r(destCoords.lng),
          polyline,
          distance: legs[0]?.distance ?? null,
          duration: legs[0]?.duration ?? null,
        }, { onConflict: "origin_lat,origin_lng,dest_lat,dest_lng" });
      } catch { /* cache write failed — not critical */ }
    }

    return NextResponse.json({ polyline, legs, bounds: route.bounds });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiStatus = (err as any)?.response?.data?.status;
    console.error("[directions]", msg, apiStatus);
    return NextResponse.json({ error: apiStatus ?? msg }, { status: 500 });
  }
}
