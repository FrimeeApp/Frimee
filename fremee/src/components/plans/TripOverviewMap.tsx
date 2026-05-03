"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { TIPOS_TRANSPORTE } from "@/services/api/endpoints/subplanes.endpoint";
import { getGoogleMaps, loadGoogleMapsScript } from "@/lib/googleMaps";

type Props = { subplanes: SubplanRow[] };
type Coord = google.maps.LatLngLiteral;
type GoogleMapsApi = typeof google.maps;
type Point = { name: string; isDestination?: boolean; subplanIdx: number; coords: Coord | null };

function logTripOverviewMap(message: string, details?: unknown) {
  if (details !== undefined) {
    console.error(`[TripOverviewMap] ${message}`, details);
    return;
  }
  console.error(`[TripOverviewMap] ${message}`);
}

function isoDateOnly(iso: string) { return iso.slice(0, 10); }

function toCoord(lat: number | null | undefined, lng: number | null | undefined): Coord | null {
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

async function geocode(address: string): Promise<Coord | null> {
  return new Promise((resolve) => {
    const maps = getGoogleMaps();
    const geocoder = new maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status !== "OK" || !results?.[0]) {
        logTripOverviewMap("Geocode sin resultado", { address, status });
        resolve(null);
        return;
      }
      const loc = results[0].geometry.location;
      resolve({ lat: loc.lat(), lng: loc.lng() });
    });
  });
}

function decodePath(encoded: string): Coord[] {
  const pts: Coord[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
}

const darkMapStyles = [
  { featureType: "all", elementType: "labels.text", stylers: [{ color: "#878787" }] },
  { featureType: "all", elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "all", stylers: [{ color: "#f9f5ed" }] },
  { featureType: "road.highway", elementType: "all", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "all", stylers: [{ color: "#aee0f4" }] },
];

const DAY_COLORS = ["#00C9A7", "#FF6B6B", "#4ECDC4", "#FFE66D", "#A855F7", "#F97316", "#3B82F6", "#EC4899"];

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

function waitForMapIdle(map: google.maps.Map): Promise<void> {
  return new Promise((resolve) => {
    google.maps.event.addListenerOnce(map, "idle", () => resolve());
  });
}

function drawRoute(
  maps: GoogleMapsApi,
  map: google.maps.Map,
  path: Coord[],
  color: string,
  isArc: boolean,
) {
  if (path.length < 2) return;

  if (isArc) {
    new maps.Polyline({
      path,
      geodesic: true,
      strokeOpacity: 0,
      strokeWeight: 0,
      icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.5, strokeColor: color, scale: 3 }, offset: "0", repeat: "14px" }],
      map,
    });
    return;
  }

  new maps.Polyline({
    path,
    geodesic: true,
    strokeColor: color,
    strokeOpacity: 0.85,
    strokeWeight: 3,
    map,
  });
}

export default function TripOverviewMap({ subplanes }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const abortedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = [...new Set(subplanes.filter(s => s.ubicacion_nombre).map(s => isoDateOnly(s.inicio_at)))].sort();
  const hasPoints = days.length > 0;

  const renderMap = useCallback(async () => {
    if (!hasPoints || !mapRef.current) return;
    abortedRef.current = true;
    await delay(10);
    abortedRef.current = false;

    setLoading(true);
    setError(null);

    try {
      await loadGoogleMapsScript();
      if (abortedRef.current || !mapRef.current) return;
      const maps = getGoogleMaps();

      mapRef.current.innerHTML = "";
      const map = new maps.Map(mapRef.current, {
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        styles: darkMapStyles,
      });
      const bounds = new maps.LatLngBounds();

      for (let di = 0; di < days.length; di++) {
        const date = days[di];
        const color = DAY_COLORS[di % DAY_COLORS.length];
        const items = subplanes
          .filter(s => isoDateOnly(s.inicio_at) === date && s.ubicacion_nombre)
          .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));

        const points: Point[] = [];
        items.forEach((s, i) => {
          points.push({ name: s.ubicacion_nombre, subplanIdx: i, coords: toCoord(s.ubicacion_lat, s.ubicacion_lng) });
          if (TIPOS_TRANSPORTE.includes(s.tipo) && s.ubicacion_fin_nombre) {
            points.push({ name: s.ubicacion_fin_nombre, isDestination: true, subplanIdx: i, coords: toCoord(s.ubicacion_fin_lat, s.ubicacion_fin_lng) });
          }
        });
        if (points.length === 0) continue;

        const coords = await Promise.all(points.map(p => p.coords ? Promise.resolve(p.coords) : geocode(p.name)));
        if (abortedRef.current) return;

        coords.forEach((coord, i) => {
          if (!coord) return;
          bounds.extend(coord);
          new maps.Marker({
            position: coord,
            map,
            label: { text: String(i + 1), color: "#000", fontWeight: "bold", fontSize: "14px" },
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
              scale: 12,
            },
            title: points[i]?.name ?? "",
          });
        });

        for (let i = 0; i < points.length - 1; i++) {
          const from = coords[i];
          const to = coords[i + 1];
          if (!from || !to) continue;

          const fromSubplan = items[points[i].subplanIdx];
          const isArc = TIPOS_TRANSPORTE.includes(fromSubplan?.tipo) && !!points[i + 1]?.isDestination;
          const destSubplan = items[points[i + 1].subplanIdx];

          let path: Coord[];
          if (isArc) {
            path = Array.from({ length: 241 }, (_, t) => ({
              lat: from.lat + (to.lat - from.lat) * (t / 240),
              lng: from.lng + (to.lng - from.lng) * (t / 240),
            }));
          } else if (destSubplan?.ruta_polyline) {
            path = maps.geometry?.encoding
              ? maps.geometry.encoding.decodePath(destSubplan.ruta_polyline).map((point) => ({ lat: point.lat(), lng: point.lng() }))
              : decodePath(destSubplan.ruta_polyline);
          } else {
            path = [from, to];
          }

          drawRoute(maps, map, path, color, isArc);
        }
      }

      if (abortedRef.current) return;
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 48);
        await waitForMapIdle(map);
      }
      if (abortedRef.current) return;
      setLoading(false);
    } catch (error) {
      logTripOverviewMap("Error renderizando mapa general", {
        error,
        totalSubplanes: subplanes.length,
        totalDays: days.length,
      });
      if (!abortedRef.current) setError("No se pudo cargar el mapa");
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subplanes]);

  useEffect(() => {
    renderMap();
    return () => { abortedRef.current = true; };
  }, [renderMap]);

  if (!hasPoints) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-card border border-app bg-surface-inset text-body-sm text-muted">
        Sin ubicaciones registradas en el plan
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-app">
      <div className="relative h-[600px] w-full bg-surface-inset">
        <div ref={mapRef} className={`absolute inset-0 ${loading ? "opacity-0" : "opacity-100"}`} />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-inset text-body-sm text-muted">
            Cargando mapa del viaje...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-inset text-body-sm text-[var(--error)]">
            {error}
          </div>
        )}
        {days.length > 1 && !loading && (
          <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-[8px] bg-[#1a1a2e]/90 px-3 py-2 backdrop-blur-sm">
            {days.map((date, i) => {
              const d = new Date(date + "T12:00:00");
              const label = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
              return (
                <div key={date} className="flex items-center gap-2">
                  <span className="size-[10px] shrink-0 rounded-full" style={{ backgroundColor: DAY_COLORS[i % DAY_COLORS.length] }} />
                  <span className="text-[14px] text-white/80">{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
