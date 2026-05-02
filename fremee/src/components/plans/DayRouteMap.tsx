"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { TIPOS_TRANSPORTE } from "@/services/api/endpoints/subplanes.endpoint";
import { loadGoogleMapsScript } from "@/lib/googleMaps";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

type Props = {
  subplanes: SubplanRow[];
  selectedDate: string; // "YYYY-MM-DD"
  ubicacionNombre?: string; // plan destination used as fallback map center
  onViajeComputed?: (subplanId: number, duracion: string, distancia: string, polyline: string) => void;
  heightClassName?: string;
  containerClassName?: string;
};

function isoDateOnly(iso: string) { return iso.slice(0, 10); }

// Geocode an address → {lat, lng}
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results: Array<{ geometry: { location: { lat: () => number; lng: () => number } } }> | null, status: string) => {
      if (status !== "OK" || !results?.[0]) { resolve(null); return; }
      const loc = results[0].geometry.location;
      resolve({ lat: loc.lat(), lng: loc.lng() });
    });
  });
}

// Simple polyline decoder fallback
function decodePath(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
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
  const renderGenRef = useRef(0); // increments on each render attempt; stale renders abort
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & sort subplanes for the selected day that have a location
  const daySubplanes = subplanes
    .filter((s) => isoDateOnly(s.inicio_at) === selectedDate && s.ubicacion_nombre)
    .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));

  // Build location points: each subplan contributes origin (+ destination if transport)
  type Point = {
    name: string; label: string; subplanIdx: number; isDestination?: boolean;
    coords?: { lat: number; lng: number } | null;
  };
  const points: Point[] = [];
  daySubplanes.forEach((s, i) => {
    points.push({
      name: s.ubicacion_nombre, label: s.titulo, subplanIdx: i,
      coords: s.ubicacion_lat != null && s.ubicacion_lng != null ? { lat: s.ubicacion_lat, lng: s.ubicacion_lng } : null,
    });
    if (TIPOS_TRANSPORTE.includes(s.tipo) && s.ubicacion_fin_nombre) {
      points.push({
        name: s.ubicacion_fin_nombre, label: `Destino: ${s.titulo}`, subplanIdx: i, isDestination: true,
        coords: s.ubicacion_fin_lat != null && s.ubicacion_fin_lng != null ? { lat: s.ubicacion_fin_lat, lng: s.ubicacion_fin_lng } : null,
      });
    }
  });

  // Fallback map: show plan destination when < 2 points
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
        mapTypeId: "roadmap", disableDefaultUI: true, zoomControl: true, styles: darkMapStyles,
        center: { lat: 0, lng: 0 }, zoom: 2, gestureHandling: "cooperative",
      });
      const coord = await geocode(ubicacionNombre);
      if (gen !== renderGenRef.current || !fallbackMapRef.current) return;
      if (coord) {
        map.setCenter(coord);
        map.setZoom(points.length > 0 ? 11 : 5);
        // Show subplane markers — geocode if no stored coords
        const resolvedCoords = await Promise.all(
          points.map((p) => p.coords ? Promise.resolve(p.coords) : geocode(p.name))
        );
        if (gen !== renderGenRef.current || !fallbackMapRef.current) return;
        resolvedCoords.forEach((c, i) => {
          if (!c) return;
          new google.maps.Marker({
            position: c, map,
            label: { text: String(i + 1), color: "#000", fontWeight: "bold", fontSize: "14px" },
            icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: "#00C9A7", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 12 },
            title: points[i].label,
          });
        });
        // Re-center on first subplan marker if available
        if (resolvedCoords[0]) { map.setCenter(resolvedCoords[0]); map.setZoom(13); }
      }
    } catch { /* ignore */ }
    finally { if (gen === renderGenRef.current) setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, subplanes, ubicacionNombre]);

  const renderMap = useCallback(async () => {
    if (points.length < 2 || !mapRef.current) return;
    const gen = ++renderGenRef.current;
    setLoading(true);
    setError(null);

    try {
      await loadGoogleMapsScript();
      if (gen !== renderGenRef.current || !mapRef.current) return; // stale
      const google = window.google;

      // Clear previous map content
      mapRef.current.innerHTML = "";

      const map = new google.maps.Map(mapRef.current, {
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        styles: darkMapStyles,
        gestureHandling: "cooperative",
      });

      const bounds = new google.maps.LatLngBounds();

      // Use stored coords when available, geocode only when missing
      const coords = await Promise.all(
        points.map((p) => p.coords ? Promise.resolve(p.coords) : geocode(p.name))
      );
      if (gen !== renderGenRef.current || !mapRef.current) return; // stale

      // Add numbered markers
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

      // Draw segments between consecutive points
      for (let i = 0; i < points.length - 1; i++) {
        const from = coords[i];
        const to   = coords[i + 1];
        if (!from || !to) continue;

        const fromSubplan = daySubplanes[points[i].subplanIdx];
        const isArcSegment =
          TIPOS_TRANSPORTE.includes(fromSubplan?.tipo) && points[i + 1]?.isDestination;

        if (isArcSegment) {
          // Geodesic arc for flights/boats
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

          // arc segment — no duration to store
        } else {
          const destSubplan = daySubplanes[points[i + 1].subplanIdx];

          const drawPolyline = (encoded: string) => {
            const path = google.maps.geometry?.encoding
              ? google.maps.geometry.encoding.decodePath(encoded)
              : decodePath(encoded);
            new google.maps.Polyline({
              path, geodesic: true,
              strokeColor: "#00C9A7", strokeOpacity: 0.85, strokeWeight: 3, map,
            });
          };

          if (destSubplan?.ruta_polyline) {
            // ── Polyline stored in DB — zero API calls ──
            drawPolyline(destSubplan.ruta_polyline);
          } else {
            // ── First time: call server-side directions API ──
            try {
              const fromCoord = coords[i];
              const toCoord   = coords[i + 1];
              const waypoints = [
                fromCoord ? `${fromCoord.lat},${fromCoord.lng}` : points[i].name,
                toCoord   ? `${toCoord.lat},${toCoord.lng}`     : points[i + 1].name,
              ];

              const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
              const res = await fetch("/api/directions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({
                  waypoints,
                  originCoords: fromCoord ?? undefined,
                  destCoords:   toCoord   ?? undefined,
                  travelMode:   destSubplan?.transporte_llegada ?? "COCHE",
                }),
              });
              const data = await res.json() as { polyline?: string; legs?: { distance?: string; duration?: string }[]; error?: string };

              if (data.polyline) {
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
            } catch { /* skip failed segment */ }
          }
        }
      }

      map.fitBounds(bounds, 48);
    } catch {
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
              Añade al menos 2 actividades con ubicación para ver la ruta
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${containerClassName ?? "rounded-[12px] border border-app"}`} style={containerClassName ? undefined : { clipPath: "inset(0 round 12px)" }}>
      {/* Wrapper: mapRef is a leaf div React never renders children into */}
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
