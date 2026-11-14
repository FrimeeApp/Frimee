"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { TIPOS_TRANSPORTE } from "@/services/api/endpoints/subplanes.endpoint";
import { loadGoogleMapsScript } from "@/lib/googleMaps";
import { decodePolyline } from "@/lib/polyline";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { buildInternalApiUrl } from "@/config/external";
import { formatCompactRouteDistance, formatCompactRouteDuration } from "@/lib/route-formatters";
import RouteMapLoader from "@/components/plans/RouteMapLoader";

type Props = {
  subplanes: SubplanRow[];
  selectedDate: string;
  ubicacionNombre?: string;
  onViajeComputed?: (subplanId: number, duracion: string, distancia: string, polyline: string) => void;
  /** True while the map is being built and still hidden behind the loader. */
  onLoadingChange?: (loading: boolean) => void;
  /** The full-screen map uses the tall loader (board M2). */
  loaderVariant?: "embedded" | "fullscreen";
  heightClassName?: string;
  containerClassName?: string;
};

type Coord = { lat: number; lng: number };
type DirectionsResultShape = {
  polyline?: string;
  legs?: { distance?: string; duration?: string }[];
  error?: string;
};

function logDayRouteMap(message: string, details?: unknown) {
  if (details !== undefined) {
    console.error(`[DayRouteMap] ${message}`, details);
    return;
  }
  console.error(`[DayRouteMap] ${message}`);
}

function isoDateOnly(iso: string) { return iso.slice(0, 10); }
function roundCoord(n: number) { return Math.round(n * 1e4) / 1e4; }

// Same key as route_cache.modo (route_cache_modo() in SQL and cacheMode in /api/directions).
function cacheModeFor(travelMode?: string | null): string {
  const known = ["APIE", "COCHE", "BUS", "METRO", "TREN"];
  return travelMode && known.includes(travelMode) ? travelMode : "COCHE";
}

// Preferred vehicle for public transport, like transit_mode in /api/directions.
function transitPreference(travelMode?: string | null): google.maps.TransitMode | undefined {
  if (travelMode === "BUS") return google.maps.TransitMode.BUS;
  if (travelMode === "METRO") return google.maps.TransitMode.SUBWAY;
  if (travelMode === "TREN") return google.maps.TransitMode.TRAIN;
  return undefined;
}

function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

function mapTravelMode(travelMode?: string): google.maps.TravelMode {
  switch (travelMode) {
    case undefined:
    case "APIE":
      return travelMode === "APIE" ? google.maps.TravelMode.WALKING : google.maps.TravelMode.DRIVING;
    case "BUS":
    case "METRO":
    case "TREN":
      return google.maps.TravelMode.TRANSIT;
    case "COCHE":
    case "TAXI":
    default:
      return google.maps.TravelMode.DRIVING;
  }
}

async function requestDirectionsFromGoogleClient(params: {
  from: Coord;
  to: Coord;
  travelMode?: string | null;
}): Promise<DirectionsResultShape> {
  await loadGoogleMapsScript(); // the itinerary can call this before any map has loaded the script
  const service = new window.google.maps.DirectionsService();
  const preferred = transitPreference(params.travelMode);
  const result = await service.route({
    origin: params.from,
    destination: params.to,
    travelMode: mapTravelMode(params.travelMode ?? undefined),
    unitSystem: google.maps.UnitSystem.METRIC,
    ...(preferred ? { transitOptions: { modes: [preferred] } } : {}),
  });

  const route = result.routes[0];
  const leg = route?.legs?.[0];

  return {
    polyline: route?.overview_polyline,
    legs: leg
      ? [{
          distance: leg.distance?.text,
          duration: leg.duration?.text,
        }]
      : undefined,
  };
}

type DirectionsParams = {
  waypoints: string[];
  from: Coord;
  to: Coord;
  travelMode?: string | null;
  accessToken?: string;
};

// The itinerary and the map ask for the same missing legs at the same time: share the request.
const inFlightDirections = new Map<string, Promise<DirectionsResultShape>>();

/** Route for one leg: shared cache (native), then /api/directions, then Google in the browser. Also used by the itinerary. */
export function requestDirections(params: DirectionsParams): Promise<DirectionsResultShape> {
  const key = [
    roundCoord(params.from.lat), roundCoord(params.from.lng),
    roundCoord(params.to.lat), roundCoord(params.to.lng),
    params.travelMode ?? "COCHE",
  ].join("|");
  const pending = inFlightDirections.get(key);
  if (pending) return pending;
  const request = fetchDirections(params).finally(() => inFlightDirections.delete(key));
  inFlightDirections.set(key, request);
  return request;
}

async function fetchDirections(params: DirectionsParams): Promise<DirectionsResultShape> {
  // In the app, try the shared cache first: it saves a round trip to our API.
  // On a miss, fall through to /api/directions like the web does (it accepts the
  // Bearer token since 5d73025), so the route is drawn even if nobody computed it before.
  if (isNativePlatform()) {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("route_cache")
      .select("polyline, distance, duration")
      .eq("origin_lat", roundCoord(params.from.lat))
      .eq("origin_lng", roundCoord(params.from.lng))
      .eq("dest_lat", roundCoord(params.to.lat))
      .eq("dest_lng", roundCoord(params.to.lng))
      .eq("modo", cacheModeFor(params.travelMode))
      .maybeSingle();

    if (error) {
      const errorCode = typeof error === "object" && error && "code" in error ? String(error.code) : null;
      if (errorCode !== "PGRST205") {
        logDayRouteMap("Error leyendo route_cache en nativo", {
          error,
          from: params.from,
          to: params.to,
        });
      }
    } else if (data?.polyline) {
      return {
        polyline: data.polyline,
        legs: [{
          distance: data.distance ?? undefined,
          duration: data.duration ?? undefined,
        }],
      };
    }
  }

  try {
    const res = await fetch(buildInternalApiUrl("/api/directions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(params.accessToken ? { Authorization: `Bearer ${params.accessToken}` } : {}),
      },
      body: JSON.stringify({
        waypoints: params.waypoints,
        originCoords: params.from,
        destCoords: params.to,
        travelMode: params.travelMode ?? "COCHE",
      }),
    });

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Respuesta no JSON de /api/directions (${res.status})`);
    }

    const data = await res.json() as DirectionsResultShape;
    if (res.ok && !data.error) {
      return data;
    }

    logDayRouteMap("Fallo /api/directions; usando fallback cliente", {
      status: res.status,
      responseError: data.error ?? null,
      from: params.from,
      to: params.to,
      travelMode: params.travelMode ?? "COCHE",
    });
  } catch (error) {
    logDayRouteMap("Excepcion en /api/directions; usando fallback cliente", {
      error,
      from: params.from,
      to: params.to,
      travelMode: params.travelMode ?? "COCHE",
    });
  }

  return requestDirectionsFromGoogleClient({
    from: params.from,
    to: params.to,
    travelMode: params.travelMode,
  });
}

async function geocode(address: string): Promise<Coord | null> {
  return new Promise((resolve) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results: Array<{ geometry: { location: { lat: () => number; lng: () => number } } }> | null, status: string) => {
      if (status !== "OK" || !results?.[0]) {
        logDayRouteMap("Geocode sin resultado", { address, status });
        resolve(null);
        return;
      }
      const loc = results[0].geometry.location;
      resolve({ lat: loc.lat(), lng: loc.lng() });
    });
  });
}

const geocodeCache = new Map<string, Promise<Coord | null>>();
const renderedRouteMapKeys = new Set<string>();
const renderedFallbackMapKeys = new Set<string>();
const MAP_RENDER_CACHE_LIMIT = 24;

function rememberRenderedMap(cache: Set<string>, key: string) {
  if (!key) return;
  cache.delete(key);
  cache.add(key);
  while (cache.size > MAP_RENDER_CACHE_LIMIT) {
    const oldestKey = cache.values().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

function geocodeCached(address: string): Promise<Coord | null> {
  const key = address.trim().toLowerCase();
  if (!key) return Promise.resolve(null);

  const cached = geocodeCache.get(key);
  if (cached) return cached;

  const request = geocode(address).catch((error) => {
    geocodeCache.delete(key);
    throw error;
  });
  geocodeCache.set(key, request);
  return request;
}

const darkMapStyles = [
  { featureType: "all", elementType: "labels.text", stylers: [{ color: "#878787" }] },
  { featureType: "all", elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "all", stylers: [{ color: "#f9f5ed" }] },
  { featureType: "road.highway", elementType: "all", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "all", stylers: [{ color: "#aee0f4" }] },
];

/** Resolves when the map has drawn its tiles, or after `ms` if they never report it. */
function waitForTiles(map: google.maps.Map, ms = 1500): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    google.maps.event.addListenerOnce(map, "tilesloaded", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export default function DayRouteMap({
  subplanes,
  selectedDate,
  ubicacionNombre,
  onViajeComputed,
  onLoadingChange,
  loaderVariant = "embedded",
  heightClassName = "h-[300px] md:h-[240px]",
  containerClassName = "",
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const fallbackMapRef = useRef<HTMLDivElement>(null);
  const renderGenRef = useRef(0);
  // Legs this map computed itself, so a redraw (another day, back) does not ask again.
  const computedPolylinesRef = useRef(new Map<string, string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const daySubplanes = useMemo(
    () =>
      subplanes
        .filter((s) => isoDateOnly(s.inicio_at) === selectedDate && s.ubicacion_nombre)
        .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at)),
    [selectedDate, subplanes],
  );

  type Point = {
    name: string;
    label: string;
    subplanIdx: number;
    isDestination?: boolean;
    coords?: Coord | null;
  };

  const points: Point[] = useMemo(() => {
    const nextPoints: Point[] = [];
    daySubplanes.forEach((s, i) => {
      nextPoints.push({
        name: s.ubicacion_nombre,
        label: s.titulo,
        subplanIdx: i,
        coords: s.ubicacion_lat != null && s.ubicacion_lng != null ? { lat: s.ubicacion_lat, lng: s.ubicacion_lng } : null,
      });
      if (TIPOS_TRANSPORTE.includes(s.tipo) && s.ubicacion_fin_nombre) {
        nextPoints.push({
          name: s.ubicacion_fin_nombre,
          label: `Destino: ${s.titulo}`,
          subplanIdx: i,
          isDestination: true,
          coords: s.ubicacion_fin_lat != null && s.ubicacion_fin_lng != null ? { lat: s.ubicacion_fin_lat, lng: s.ubicacion_fin_lng } : null,
        });
      }
    });
    return nextPoints;
  }, [daySubplanes]);

  // What the map shows. The saved polyline is left out on purpose: when this map (or the
  // itinerary) computes a leg and the plan stores it, the map must not rebuild itself.
  // Changing a leg's transport or a place changes the key, and that does redraw it.
  const mapRenderKey = useMemo(() => {
    const pointKey = points
      .map((point) => [
        point.name,
        point.label,
        point.coords?.lat ?? "",
        point.coords?.lng ?? "",
        point.isDestination ? "dest" : "origin",
      ].join(":"))
      .join(";");
    const routeKey = daySubplanes
      .map((subplan) => [
        subplan.id,
        subplan.transporte_llegada ?? "",
        subplan.ubicacion_lat ?? "",
        subplan.ubicacion_lng ?? "",
        subplan.ubicacion_fin_lat ?? "",
        subplan.ubicacion_fin_lng ?? "",
      ].join(":"))
      .join(";");

    return `${selectedDate}|${ubicacionNombre ?? ""}|${pointKey}|${routeKey}`;
  }, [daySubplanes, points, selectedDate, ubicacionNombre]);

  const mapAlreadyRendered = points.length < 2
    ? renderedFallbackMapKeys.has(mapRenderKey)
    : renderedRouteMapKeys.has(mapRenderKey);
  const showLoader = loading && !mapAlreadyRendered;

  useEffect(() => {
    onLoadingChange?.(showLoader);
  }, [onLoadingChange, showLoader]);
  useEffect(() => () => onLoadingChange?.(false), [onLoadingChange]);

  // The loader fades out (is-ready) and is unmounted afterwards, so its loop stops running.
  const [loaderMounted, setLoaderMounted] = useState(showLoader);
  useEffect(() => {
    if (showLoader) {
      setLoaderMounted(true);
      return;
    }
    const timer = setTimeout(() => setLoaderMounted(false), 250);
    return () => clearTimeout(timer);
  }, [showLoader]);
  const shellClassName = `map-shell relative w-full bg-surface-inset ${heightClassName}${showLoader ? "" : " is-ready"}`;

  const renderFallbackMap = async () => {
    if (!ubicacionNombre || !fallbackMapRef.current) {
      setLoading(false); // nothing to draw: show the hint, not an endless loader
      return;
    }
    const gen = ++renderGenRef.current;
    const alreadyRendered = renderedFallbackMapKeys.has(mapRenderKey);
    setLoading(!alreadyRendered);
    setError(null);

    try {
      await loadGoogleMapsScript();
      if (gen !== renderGenRef.current || !fallbackMapRef.current) return;
      const google = window.google;
      fallbackMapRef.current.innerHTML = "";

      const map = new google.maps.Map(fallbackMapRef.current, {
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        styles: darkMapStyles,
        center: { lat: 0, lng: 0 },
        zoom: 2,
        gestureHandling: "cooperative",
      });

      const coord = await geocodeCached(ubicacionNombre);
      if (gen !== renderGenRef.current || !fallbackMapRef.current) return;
      if (!coord) return;

      map.setCenter(coord);
      map.setZoom(points.length > 0 ? 11 : 5);

      const resolvedCoords = await Promise.all(points.map((p) => p.coords ? Promise.resolve(p.coords) : geocodeCached(p.name)));
      if (gen !== renderGenRef.current || !fallbackMapRef.current) return;

      resolvedCoords.forEach((c, i) => {
        if (!c) return;
        new google.maps.Marker({
          position: c,
          map,
          label: { text: String(i + 1), color: "#000", fontWeight: "bold", fontSize: "14px" },
          icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: "#00C9A7", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 12 },
          title: points[i].label,
        });
      });

      if (resolvedCoords[0]) {
        map.setCenter(resolvedCoords[0]);
        map.setZoom(13);
      }
      if (!alreadyRendered) await waitForTiles(map);
      rememberRenderedMap(renderedFallbackMapKeys, mapRenderKey);
    } catch (error) {
      logDayRouteMap("Error renderizando mapa fallback", {
        error,
        selectedDate,
        ubicacionNombre,
        points: points.length,
      });
    } finally {
      if (gen === renderGenRef.current) setLoading(false);
    }
  };

  const renderMap = async () => {
    if (points.length < 2 || !mapRef.current) return;
    const gen = ++renderGenRef.current;
    const alreadyRendered = renderedRouteMapKeys.has(mapRenderKey);
    setLoading(!alreadyRendered);
    setError(null);
    const computedLegs: { subplanId: number; duracion: string; distancia: string; polyline: string }[] = [];

    try {
      await loadGoogleMapsScript();
      if (gen !== renderGenRef.current || !mapRef.current) return;
      const google = window.google;

      mapRef.current.innerHTML = "";

      const map = new google.maps.Map(mapRef.current, {
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        styles: darkMapStyles,
        gestureHandling: "cooperative",
      });

      const bounds = new google.maps.LatLngBounds();
      const coords = await Promise.all(points.map((p) => p.coords ? Promise.resolve(p.coords) : geocodeCached(p.name)));
      if (gen !== renderGenRef.current || !mapRef.current) return;

      coords.forEach((coord, i) => {
        if (!coord) return;
        bounds.extend(coord);
        new google.maps.Marker({
          position: coord,
          map,
          label: { text: String(i + 1), color: "#000", fontWeight: "bold", fontSize: "14px" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#00C9A7",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
            scale: 12,
          },
          title: points[i].label,
        });
      });

      const drawPolyline = (encoded: string) => {
        const path = google.maps.geometry?.encoding
          ? google.maps.geometry.encoding.decodePath(encoded)
          : decodePolyline(encoded);
        new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#00C9A7",
          strokeOpacity: 0.85,
          strokeWeight: 3,
          map,
        });
      };

      // Draw what is already known and ask for every missing leg at once: the map shows up
      // complete, after the slowest leg, instead of being rebuilt leg by leg.
      const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
      const missing: Promise<void>[] = [];

      for (let i = 0; i < points.length - 1; i++) {
        const from = coords[i];
        const to = coords[i + 1];
        if (!from || !to) continue;

        const fromSubplan = daySubplanes[points[i].subplanIdx];
        const isArcSegment = TIPOS_TRANSPORTE.includes(fromSubplan?.tipo) && points[i + 1]?.isDestination;

        if (isArcSegment) {
          new google.maps.Polyline({
            path: [from, to],
            geodesic: true,
            strokeColor: "#00C9A7",
            strokeOpacity: 0,
            strokeWeight: 0,
            icons: [{
              icon: { path: "M 0,-1 0,1", strokeOpacity: 0.8, strokeColor: "#00C9A7", scale: 3 },
              offset: "0",
              repeat: "12px",
            }],
            map,
          });
          continue;
        }

        const destSubplan = daySubplanes[points[i + 1].subplanIdx];
        const travelMode = destSubplan?.transporte_llegada ?? "COCHE";
        const routeKey = [
          destSubplan?.id ?? "",
          travelMode,
          `${from.lat},${from.lng}`,
          `${to.lat},${to.lng}`,
        ].join("|");

        const saved = destSubplan?.ruta_polyline || computedPolylinesRef.current.get(routeKey);
        if (saved) {
          drawPolyline(saved);
          continue;
        }

        missing.push((async () => {
          try {
            const data = await requestDirections({
              waypoints: [`${from.lat},${from.lng}`, `${to.lat},${to.lng}`],
              from,
              to,
              travelMode,
              accessToken: session?.access_token,
            });
            if (!data.polyline) return;
            computedPolylinesRef.current.set(routeKey, data.polyline);
            if (gen !== renderGenRef.current) return;
            drawPolyline(data.polyline);
            const leg = data.legs?.[0];
            if (leg?.duration && destSubplan?.id) {
              computedLegs.push({
                subplanId: destSubplan.id,
                duracion: formatCompactRouteDuration(leg.duration),
                distancia: formatCompactRouteDistance(leg.distance),
                polyline: data.polyline,
              });
            }
          } catch (error) {
            logDayRouteMap("Excepcion calculando segmento de ruta", {
              error,
              routeKey,
              from,
              to,
              destSubplanId: destSubplan?.id ?? null,
            });
          }
        })());
      }

      await Promise.all(missing);
      if (gen !== renderGenRef.current) return;

      map.fitBounds(bounds, 48);
      if (!alreadyRendered) await waitForTiles(map);
      rememberRenderedMap(renderedRouteMapKeys, mapRenderKey);
    } catch (error) {
      logDayRouteMap("Error renderizando mapa diario", {
        error,
        selectedDate,
        daySubplanes: daySubplanes.length,
        points: points.length,
      });
      if (gen === renderGenRef.current) setError("No se pudo cargar el mapa");
    } finally {
      if (gen === renderGenRef.current) setLoading(false);
      // Report after the map is shown: storing them updates the plan, which no longer redraws it.
      computedLegs.forEach((leg) => onViajeComputed?.(leg.subplanId, leg.duracion, leg.distancia, leg.polyline));
    }
  };

  // Redraw only when what the map shows changes (mapRenderKey), not on every new subplanes
  // array: a realtime reload or a saved leg used to rebuild the whole map.
  const renderRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    renderRef.current = points.length < 2 ? renderFallbackMap : renderMap;
  });
  useEffect(() => {
    void renderRef.current();
  }, [mapRenderKey]);

  if (points.length < 2) {
    return (
      <div className={`overflow-hidden ${containerClassName ?? "rounded-[12px] border border-app"}`} style={containerClassName ? undefined : { clipPath: "inset(0 round 12px)" }}>
        <div className={shellClassName} aria-busy={showLoader}>
          <div ref={fallbackMapRef} className="map-canvas absolute inset-0" />
          {loaderMounted && <RouteMapLoader variant={loaderVariant} />}
          {!loading && !ubicacionNombre && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-body-sm text-muted">
              Anade al menos 2 actividades con ubicacion para ver la ruta
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${containerClassName ?? "rounded-[12px] border border-app"}`} style={containerClassName ? undefined : { clipPath: "inset(0 round 12px)" }}>
      <div className={shellClassName} aria-busy={showLoader}>
        <div ref={mapRef} className="map-canvas absolute inset-0" />
        {loaderMounted && <RouteMapLoader variant={loaderVariant} />}
        {error && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-surface-inset text-body-sm text-[var(--error)]">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
