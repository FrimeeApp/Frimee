"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { TIPOS_TRANSPORTE } from "@/services/api/endpoints/subplanes.endpoint";
import { loadGoogleMapsScript } from "@/lib/googleMaps";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { buildInternalApiUrl } from "@/config/external";

type Props = {
  subplanes: SubplanRow[];
  selectedDate: string;
  ubicacionNombre?: string;
  onViajeComputed?: (subplanId: number, duracion: string, distancia: string, polyline: string) => void;
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

function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

function mapTravelMode(travelMode?: string): google.maps.TravelMode {
  switch (travelMode) {
    case "APIE":
      return google.maps.TravelMode.WALKING;
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
  const service = new window.google.maps.DirectionsService();
  const result = await service.route({
    origin: params.from,
    destination: params.to,
    travelMode: mapTravelMode(params.travelMode ?? undefined),
    unitSystem: google.maps.UnitSystem.METRIC,
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

async function requestDirections(params: {
  waypoints: string[];
  from: Coord;
  to: Coord;
  travelMode?: string | null;
  accessToken?: string;
}): Promise<DirectionsResultShape> {
  if (isNativePlatform()) {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("route_cache")
      .select("polyline, distance, duration")
      .eq("origin_lat", roundCoord(params.from.lat))
      .eq("origin_lng", roundCoord(params.from.lng))
      .eq("dest_lat", roundCoord(params.to.lat))
      .eq("dest_lng", roundCoord(params.to.lng))
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
      return {};
    }

    return data
      ? {
          polyline: data.polyline ?? undefined,
          legs: [{
            distance: data.distance ?? undefined,
            duration: data.duration ?? undefined,
          }],
        }
      : {};
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

function decodePath(encoded: string): Coord[] {
  const points: Coord[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

const darkMapStyles = [
  { featureType: "all", elementType: "labels.text", stylers: [{ color: "#878787" }] },
  { featureType: "all", elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "all", stylers: [{ color: "#f9f5ed" }] },
  { featureType: "road.highway", elementType: "all", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "all", stylers: [{ color: "#aee0f4" }] },
];

export default function DayRouteMap({
  subplanes,
  selectedDate,
  ubicacionNombre,
  onViajeComputed,
  heightClassName = "h-[300px] md:h-[240px]",
  containerClassName = "",
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const fallbackMapRef = useRef<HTMLDivElement>(null);
  const renderGenRef = useRef(0);
  const inFlightRouteKeysRef = useRef(new Set<string>());
  const computedRouteKeysRef = useRef(new Set<string>());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daySubplanes = subplanes
    .filter((s) => isoDateOnly(s.inicio_at) === selectedDate && s.ubicacion_nombre)
    .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));

  type Point = {
    name: string;
    label: string;
    subplanIdx: number;
    isDestination?: boolean;
    coords?: Coord | null;
  };

  const points: Point[] = [];
  daySubplanes.forEach((s, i) => {
    points.push({
      name: s.ubicacion_nombre,
      label: s.titulo,
      subplanIdx: i,
      coords: s.ubicacion_lat != null && s.ubicacion_lng != null ? { lat: s.ubicacion_lat, lng: s.ubicacion_lng } : null,
    });
    if (TIPOS_TRANSPORTE.includes(s.tipo) && s.ubicacion_fin_nombre) {
      points.push({
        name: s.ubicacion_fin_nombre,
        label: `Destino: ${s.titulo}`,
        subplanIdx: i,
        isDestination: true,
        coords: s.ubicacion_fin_lat != null && s.ubicacion_fin_lng != null ? { lat: s.ubicacion_fin_lat, lng: s.ubicacion_fin_lng } : null,
      });
    }
  });

  const renderFallbackMap = useCallback(async () => {
    if (!ubicacionNombre || !fallbackMapRef.current) return;
    const gen = ++renderGenRef.current;
    setLoading(true);
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

      const coord = await geocode(ubicacionNombre);
      if (gen !== renderGenRef.current || !fallbackMapRef.current) return;
      if (!coord) return;

      map.setCenter(coord);
      map.setZoom(points.length > 0 ? 11 : 5);

      const resolvedCoords = await Promise.all(points.map((p) => p.coords ? Promise.resolve(p.coords) : geocode(p.name)));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, subplanes, ubicacionNombre]);

  const renderMap = useCallback(async () => {
    if (points.length < 2 || !mapRef.current) return;
    const gen = ++renderGenRef.current;
    setLoading(true);
    setError(null);

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
      const coords = await Promise.all(points.map((p) => p.coords ? Promise.resolve(p.coords) : geocode(p.name)));
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
        const routeKey = destSubplan?.id
          ? [
              destSubplan.id,
              destSubplan.transporte_llegada ?? "COCHE",
              `${from.lat},${from.lng}`,
              `${to.lat},${to.lng}`,
            ].join("|")
          : null;

        const drawPolyline = (encoded: string) => {
          const path = google.maps.geometry?.encoding
            ? google.maps.geometry.encoding.decodePath(encoded)
            : decodePath(encoded);
          new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#00C9A7",
            strokeOpacity: 0.85,
            strokeWeight: 3,
            map,
          });
        };

        if (destSubplan?.ruta_polyline) {
          if (routeKey) computedRouteKeysRef.current.add(routeKey);
          drawPolyline(destSubplan.ruta_polyline);
          continue;
        }

        if (routeKey && (computedRouteKeysRef.current.has(routeKey) || inFlightRouteKeysRef.current.has(routeKey))) {
          continue;
        }

        try {
          if (routeKey) inFlightRouteKeysRef.current.add(routeKey);
          const fromCoord = coords[i];
          const toCoord = coords[i + 1];
          if (!fromCoord || !toCoord) {
            continue;
          }
          const waypoints = [
            `${fromCoord.lat},${fromCoord.lng}`,
            `${toCoord.lat},${toCoord.lng}`,
          ];

          const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
          const data = await requestDirections({
            waypoints,
            from: fromCoord,
            to: toCoord,
            travelMode: destSubplan?.transporte_llegada ?? "COCHE",
            accessToken: session?.access_token,
          });

          if (data.polyline) {
            if (routeKey) computedRouteKeysRef.current.add(routeKey);
            drawPolyline(data.polyline);
            const leg = data.legs?.[0];
            if (leg?.duration && destSubplan?.id && onViajeComputed) {
              onViajeComputed(
                destSubplan.id,
                leg.duration,
                leg.distance ?? "",
                data.polyline,
              );
            }
          }
        } catch (error) {
          logDayRouteMap("Excepcion calculando segmento de ruta", {
            error,
            routeKey,
            from,
            to,
            destSubplanId: destSubplan?.id ?? null,
          });
        } finally {
          if (routeKey) inFlightRouteKeysRef.current.delete(routeKey);
        }
      }

      map.fitBounds(bounds, 48);
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, subplanes]);

  useEffect(() => {
    if (points.length < 2) renderFallbackMap();
    else renderMap();
  }, [renderMap, renderFallbackMap, points.length]);

  if (points.length < 2) {
    return (
      <div className={`overflow-hidden ${containerClassName ?? "rounded-[12px] border border-app"}`} style={containerClassName ? undefined : { clipPath: "inset(0 round 12px)" }}>
        <div className={`relative w-full bg-surface-inset ${heightClassName}`}>
          <div ref={fallbackMapRef} className="absolute inset-0" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-inset text-body-sm text-muted">
              Cargando mapa...
            </div>
          )}
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
      <div className={`relative w-full bg-surface-inset ${heightClassName}`}>
        <div ref={mapRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-inset text-body-sm text-muted">
            Calculando ruta...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-inset text-body-sm text-[var(--error)]">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
