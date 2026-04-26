import { NextRequest, NextResponse } from "next/server";
import { Client, TravelMode, UnitSystem, Language } from "@googlemaps/google-maps-services-js";
import { getGoogleMapsServerKey } from "@/config/env";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/services/supabase/server";

const client = new Client({});

// Round coords to 4 decimal places (~11m) for cache key stability
function r(n: number) { return Math.round(n * 1e4) / 1e4; }

type LatLng = { lat: number; lng: number };

type DirectionsRequestBody = {
  waypoints: string[];
  originCoords?: LatLng;
  destCoords?: LatLng;
  travelMode?: string;
};

type ApiErrorLike = {
  response?: {
    data?: {
      status?: string;
    };
  };
};

function isLatLng(value: unknown): value is LatLng {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.lat === "number" && typeof candidate.lng === "number";
}

function isDirectionsRequestBody(value: unknown): value is DirectionsRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const { waypoints, originCoords, destCoords, travelMode } = candidate;
  return (
    Array.isArray(waypoints) &&
    waypoints.every((item) => typeof item === "string") &&
    (originCoords === undefined || isLatLng(originCoords)) &&
    (destCoords === undefined || isLatLng(destCoords)) &&
    (travelMode === undefined || typeof travelMode === "string")
  );
}

function getApiStatus(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  return (error as ApiErrorLike).response?.data?.status;
}

export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json() as unknown;
    if (!isDirectionsRequestBody(body)) {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }
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
        language: Language.es,
        key: getGoogleMapsServerKey(),
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
    const apiStatus = getApiStatus(err);
    console.error("[directions]", msg, apiStatus);
    return NextResponse.json({ error: apiStatus ?? msg }, { status: 500 });
  }
}
