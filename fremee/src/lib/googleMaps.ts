import { GOOGLE_MAPS_SCRIPT_ID, buildGoogleMapsScriptUrl } from "@/config/external";

type GoogleMapsWindow = Window & typeof globalThis & {
  google?: typeof google;
};

export function getGoogleMaps(): typeof google.maps {
  const maps = (window as GoogleMapsWindow).google?.maps;
  if (!maps) {
    throw new Error("Google Maps no está disponible");
  }
  return maps;
}

export function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve) => {
    const googleMaps = (window as GoogleMapsWindow).google?.maps;

    if (googleMaps) {
      resolve();
      return;
    }

    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = buildGoogleMapsScriptUrl(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}
