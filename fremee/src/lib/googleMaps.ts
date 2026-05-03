import { GOOGLE_MAPS_SCRIPT_ID, buildGoogleMapsScriptUrl } from "@/config/external";

type GoogleMapsWindow = Window & typeof globalThis & {
  google?: typeof google;
  __initGoogleMaps?: () => void;
};

const GOOGLE_MAPS_READY_TIMEOUT_MS = 15000;
const GOOGLE_MAPS_READY_POLL_MS = 50;
const GOOGLE_MAPS_CALLBACK_NAME = "__initGoogleMaps";

let googleMapsScriptPromise: Promise<void> | null = null;

function logGoogleMaps(message: string, details?: unknown) {
  if (details !== undefined) {
    console.info(`[GoogleMaps] ${message}`, details);
    return;
  }
  console.info(`[GoogleMaps] ${message}`);
}

function logGoogleMapsError(message: string, details?: unknown) {
  if (details !== undefined) {
    console.error(`[GoogleMaps] ${message}`, details);
    return;
  }
  console.error(`[GoogleMaps] ${message}`);
}

function getGoogleMapsWindow() {
  return window as GoogleMapsWindow;
}

function isGoogleMapsReady() {
  return typeof getGoogleMapsWindow().google?.maps?.Map === "function";
}

async function ensureGoogleMapsLibraries(): Promise<void> {
  const googleMaps = getGoogleMapsWindow().google?.maps;
  if (!googleMaps?.importLibrary) {
    return;
  }

  await Promise.all([
    googleMaps.importLibrary("maps"),
    googleMaps.importLibrary("places"),
    googleMaps.importLibrary("geometry"),
  ]);
}

function waitForGoogleMapsReady(timeoutMs = GOOGLE_MAPS_READY_TIMEOUT_MS): Promise<void> {
  if (isGoogleMapsReady()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      if (isGoogleMapsReady()) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        const error = new Error("Google Maps no estuvo disponible a tiempo");
        logGoogleMapsError("Timeout esperando google.maps.Map", {
          timeoutMs,
          hasGoogle: Boolean(getGoogleMapsWindow().google),
          hasMaps: Boolean(getGoogleMapsWindow().google?.maps),
          hasMapConstructor: typeof getGoogleMapsWindow().google?.maps?.Map,
          hasImportLibrary: typeof getGoogleMapsWindow().google?.maps?.importLibrary,
        });
        reject(error);
        return;
      }

      window.setTimeout(check, GOOGLE_MAPS_READY_POLL_MS);
    };

    check();
  });
}

export function getGoogleMaps(): typeof google.maps {
  const maps = getGoogleMapsWindow().google?.maps;
  if (!maps || typeof maps.Map !== "function") {
    throw new Error("Google Maps no esta disponible");
  }
  return maps;
}

export function loadGoogleMapsScript(): Promise<void> {
  if (isGoogleMapsReady()) {
    return Promise.resolve();
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const finish = () => {
      void ensureGoogleMapsLibraries()
        .then(() => waitForGoogleMapsReady())
        .then(resolve)
        .catch(reject);
    };

    const fail = () => {
      logGoogleMapsError("Fallo cargando el script de Google Maps", {
        src: buildGoogleMapsScriptUrl(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_CALLBACK_NAME),
      });
      reject(new Error("No se pudo cargar Google Maps"));
    };

    getGoogleMapsWindow()[GOOGLE_MAPS_CALLBACK_NAME] = () => {
      logGoogleMaps("Callback global de Google Maps ejecutado");
      finish();
    };

    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.gmapsStatus === "ready" || isGoogleMapsReady()) {
        finish();
        return;
      }

      if (existing.dataset.gmapsStatus === "error") {
        logGoogleMaps("Se detecto un script previo en error; se elimina y reintenta");
        existing.remove();
      } else {
        logGoogleMaps("Reutilizando script existente de Google Maps", {
          status: existing.dataset.gmapsStatus ?? "unknown",
        });
        existing.addEventListener("load", finish, { once: true });
        existing.addEventListener("error", fail, { once: true });
        return;
      }
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = buildGoogleMapsScriptUrl(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_CALLBACK_NAME);
    script.async = true;
    script.defer = true;
    script.dataset.gmapsStatus = "loading";
    script.onload = () => {
      logGoogleMaps("Script descargado; esperando callback/librerias");
    };
    script.onerror = () => {
      script.dataset.gmapsStatus = "error";
      fail();
    };
    logGoogleMaps("Insertando script de Google Maps", { src: script.src });
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsScriptPromise = null;
    logGoogleMapsError("loadGoogleMapsScript rechazo la carga", error);
    throw error;
  }).finally(() => {
    delete getGoogleMapsWindow()[GOOGLE_MAPS_CALLBACK_NAME];
  });

  return googleMapsScriptPromise;
}
