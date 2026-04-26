// force-static allows this route to be included in static (Capacitor) builds.
// In Capacitor mode the client calls OpenSky directly; this route is only used in web.
export const dynamic = "force-static";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AIRPORTS, flightProgressFromPosition, flightProgressFromTime } from "@/lib/airports";
import { buildOpenSkyStatesUrl } from "@/config/external";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type FlightTrackResult = {
  callsign:         string;
  on_ground:        boolean;
  latitude:         number;
  longitude:        number;
  altitude_m:       number | null;
  velocity_ms:      number | null;
  heading:          number | null;
  origin:           { iata: string; city: string; lat: number; lon: number } | null;
  destination:      { iata: string; city: string; lat: number; lon: number } | null;
  progress:         number | null; // geodesic projection (GPS)
  progress_time:    number | null; // time-based fallback
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const callsign = searchParams.get("callsign")?.trim().toUpperCase();
  const from     = searchParams.get("from")?.trim().toUpperCase();
  const to       = searchParams.get("to")?.trim().toUpperCase();

  if (!callsign) {
    return NextResponse.json({ error: "callsign required" }, { status: 400 });
  }

  const url = buildOpenSkyStatesUrl(callsign);

  let osRes: Response;
  try {
    osRes = await fetch(url, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 30 }, // cache 30s
    });
  } catch {
    return NextResponse.json({ error: "OpenSky unavailable" }, { status: 502 });
  }

  if (!osRes.ok) {
    return NextResponse.json({ error: `OpenSky error ${osRes.status}` }, { status: 502 });
  }

  const data = await osRes.json() as { states: unknown[][] | null };

  if (!data.states || data.states.length === 0) {
    return NextResponse.json({ error: "Flight not found or not currently active" }, { status: 404 });
  }

  const s = data.states[0];
  const lat = s[6] as number | null;
  const lon = s[5] as number | null;

  if (lat == null || lon == null) {
    return NextResponse.json({ error: "No position data available yet" }, { status: 404 });
  }

  const startsAt = searchParams.get("starts_at");
  const endsAt   = searchParams.get("ends_at");

  const originAirport  = from ? (AIRPORTS[from] ?? null) : null;
  const destAirport    = to   ? (AIRPORTS[to]   ?? null) : null;
  const progressGps    = from && to ? flightProgressFromPosition(from, to, lat, lon) : null;
  const progressTime   = startsAt && endsAt ? flightProgressFromTime(startsAt, endsAt) : null;

  // Blend: GPS projection is primary; time is fallback when GPS unavailable
  const progress = progressGps ?? progressTime;

  const result: FlightTrackResult = {
    callsign:      (s[1] as string).trim(),
    on_ground:     s[8] as boolean,
    latitude:      lat,
    longitude:     lon,
    altitude_m:    s[7] as number | null,
    velocity_ms:   s[9] as number | null,
    heading:       s[10] as number | null,
    origin:        originAirport ? { iata: from!, ...originAirport } : null,
    destination:   destAirport   ? { iata: to!,   ...destAirport   } : null,
    progress,
    progress_time: progressTime,
  };

  // Write position to flight_positions so other clients get it via Realtime
  await supabaseAdmin.from("flight_positions").upsert({
    callsign:    result.callsign,
    latitude:    result.latitude,
    longitude:   result.longitude,
    altitude_m:  result.altitude_m,
    velocity_ms: result.velocity_ms,
    heading:     result.heading,
    on_ground:   result.on_ground,
    updated_at:  new Date().toISOString(),
  }, { onConflict: "callsign" });

  return NextResponse.json(result);
}
