import { DEFAULT_LIVEKIT_URL, DEFAULT_SUPABASE_PROFILE_IMAGES_BUCKET } from "@/config/app";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
export const GOOGLE_CALENDAR_API_BASE_URL = "https://www.googleapis.com/calendar/v3";
export const OPENAI_API_BASE_URL = "https://api.openai.com/v1";

export const GOOGLE_MAPS_SCRIPT_ID = "google-maps-script";
export const GOOGLE_MAPS_LIBRARIES = ["places", "geometry"] as const;

export const MAILBOX_PROVIDER_URLS: Record<string, string> = {
  "gmail.com": "https://mail.google.com",
  "outlook.com": "https://outlook.live.com/mail",
  "hotmail.com": "https://outlook.live.com/mail",
  "live.com": "https://outlook.live.com/mail",
  "yahoo.com": "https://mail.yahoo.com",
  "icloud.com": "https://www.icloud.com/mail",
};

export function resolveMailboxUrl(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? MAILBOX_PROVIDER_URLS[domain] ?? null : null;
}

export function getLivekitUrl() {
  return process.env.NEXT_PUBLIC_LIVEKIT_URL ?? DEFAULT_LIVEKIT_URL;
}

export function getProfileImagesBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET ?? DEFAULT_SUPABASE_PROFILE_IMAGES_BUCKET;
}

export function buildGoogleMapsScriptUrl(apiKey: string | undefined) {
  const params = new URLSearchParams({
    key: apiKey ?? "",
    v: "weekly",
    libraries: GOOGLE_MAPS_LIBRARIES.join(","),
  });
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

export function buildGoogleMapsDirectionsUrl(params: {
  origin: string;
  destination: string;
  waypoints?: string[];
  travelMode?: string;
}) {
  const search = new URLSearchParams({
    api: "1",
    origin: params.origin,
    destination: params.destination,
    travelmode: params.travelMode ?? "driving",
  });
  const waypoints = params.waypoints?.filter(Boolean) ?? [];
  if (waypoints.length > 0) {
    search.set("waypoints", waypoints.join("|"));
  }
  return `https://www.google.com/maps/dir/?${search.toString()}`;
}

export function buildWazeDirectionsUrl(destination: string) {
  const search = new URLSearchParams({
    q: destination,
    navigate: "yes",
  });
  return `https://waze.com/ul?${search.toString()}`;
}

export function buildOpenSkyStatesUrl(callsign: string) {
  const padded = callsign.trim().toUpperCase().padEnd(8, " ");
  const search = new URLSearchParams({ callsign: padded });
  return `https://opensky-network.org/api/states/all?${search.toString()}`;
}

export function buildAishubVesselUrl(username: string, mmsi: string) {
  const search = new URLSearchParams({
    username,
    format: "1",
    output: "json",
    compress: "0",
    mmsi,
  });
  return `https://data.aishub.net/ws.php?${search.toString()}`;
}
