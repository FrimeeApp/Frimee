"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { TIPOS_TRANSPORTE } from "@/services/api/endpoints/subplanes.endpoint";

type Props = { subplanes: SubplanRow[] };

function isoDateOnly(iso: string) { return iso.slice(0, 10); }

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&v=weekly&libraries=places,geometry`;
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geocoder = new (window as any).google.maps.Geocoder();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geocoder.geocode({ address }, (results: any, status: string) => {
      if (status !== "OK" || !results?.[0]) { resolve(null); return; }
      const loc = results[0].geometry.location;
      resolve({ lat: loc.lat(), lng: loc.lng() });
    });
  });
}

function decodePath(encoded: string): { lat: number; lng: number }[] {
  const pts: { lat: number; lng: number }[] = [];
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

// Pop a marker in with a scale animation and pan map to it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function popMarker(marker: any, google: any, map: any, color: string, label: string, coord: { lat: number; lng: number }): Promise<void> {
  return new Promise((resolve) => {
    map.panTo(coord);
    let scale = 0;
    const target = 12;
    const interval = setInterval(() => {
      scale = Math.min(scale + 2, target);
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color, fillOpacity: 1,
        strokeColor: "#fff", strokeWeight: 2,
        scale,
      });
      marker.setLabel(scale >= target ? { text: label, color: "#000", fontWeight: "bold", fontSize: "11px" } : { text: " " });
      if (scale >= target) { clearInterval(interval); resolve(); }
    }, 16);
  });
}

// Calculate compass bearing (degrees clockwise from north) between two coords
function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// SVG airplane shape pointing north (up)
const PLANE_PATH = "M 0,-10 L 2.5,-2 L 10,3 L 2.5,1 L 2.5,7 L 5,9 L 0,8 L -5,9 L -2.5,7 L -2.5,1 L -10,3 L -2.5,-2 Z";

// Animate a plane icon flying from path[0] to path[last], with dashed arc trail
function animatePlane(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  google: any, map: any,
  path: { lat: number; lng: number }[],
  color: string,
  aborted: () => boolean,
): Promise<void> {
  return new Promise((resolve) => {
    if (path.length < 2) { resolve(); return; }

    // Show both endpoints so full route is visible
    const arcBounds = new google.maps.LatLngBounds();
    arcBounds.extend(path[0]);
    arcBounds.extend(path[path.length - 1]);
    map.fitBounds(arcBounds, 80);

    // Trail polyline — grows as the plane flies
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trail: any = new google.maps.Polyline({
      path: [], geodesic: true,
      strokeOpacity: 0, strokeWeight: 0,
      icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.5, strokeColor: color, scale: 3 }, offset: "0", repeat: "14px" }],
      map,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planeIcon = (coord: { lat: number; lng: number }, nextCoord: { lat: number; lng: number }) => ({
      path: PLANE_PATH,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 1.5,
      scale: 1.1,
      rotation: bearing(coord, nextCoord),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      anchor: new (google.maps as any).Point(0, 0),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planeMarker: any = new google.maps.Marker({
      position: path[0],
      map,
      icon: planeIcon(path[0], path[1]),
      zIndex: 10,
    });

    const total = path.length;
    const durationMs = Math.min(7000, Math.max(4000, total * 25));
    const fps = 60;
    const step = Math.max(1, Math.round(total / (fps * durationMs / 1000)));
    let idx = 0;

    const interval = setInterval(() => {
      if (aborted()) { clearInterval(interval); planeMarker.setMap(null); resolve(); return; }
      idx = Math.min(idx + step, total - 1);
      const coord = path[idx];
      const nextCoord = path[Math.min(idx + step, total - 1)];
      planeMarker.setPosition(coord);
      planeMarker.setIcon(planeIcon(coord, nextCoord));
      trail.setPath(path.slice(0, idx + 1));
      if (idx >= total - 1) { clearInterval(interval); resolve(); }
    }, 1000 / fps);
  });
}

// Draw a road polyline progressively, panning the map along the route
function animatePolyline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  google: any, map: any,
  path: { lat: number; lng: number }[],
  color: string,
  aborted: () => boolean,
): Promise<void> {
  return new Promise((resolve) => {
    if (path.length < 2) { resolve(); return; }

    const polyline = new google.maps.Polyline({
      path: [], geodesic: true,
      strokeColor: color, strokeOpacity: 0.85, strokeWeight: 3, map,
    });

    const total = path.length;
    const durationMs = Math.min(4000, Math.max(1200, total * 12));
    const fps = 60;
    const step = Math.max(1, Math.round(total / (fps * durationMs / 1000)));
    let idx = 0;
    let panThrottle = 0;

    const interval = setInterval(() => {
      if (aborted()) { clearInterval(interval); resolve(); return; }
      idx = Math.min(idx + step, total);
      polyline.setPath(path.slice(0, idx));
      panThrottle++;
      if (panThrottle % 8 === 0 && path[idx - 1]) map.panTo(path[idx - 1]);
      if (idx >= total) { clearInterval(interval); resolve(); }
    }, 1000 / fps);
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
    abortedRef.current = true; // abort any previous animation
    await delay(10);           // let previous intervals finish their tick
    abortedRef.current = false;

    setLoading(true);
    setError(null);

    try {
      await loadGoogleMaps();
      if (abortedRef.current || !mapRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;

      mapRef.current.innerHTML = "";
      const map = new google.maps.Map(mapRef.current, {
        mapTypeId: "roadmap", disableDefaultUI: true, zoomControl: true, styles: darkMapStyles,
      });
      const bounds = new google.maps.LatLngBounds();

      // ── Phase 1: geocode everything & build per-day data ──
      type DayData = {
        color: string;
        date: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        markers: { marker: any; coord: { lat: number; lng: number } | null; label: string }[];
        segments: { path: { lat: number; lng: number }[]; isArc: boolean }[];
      };

      const dayDataList: DayData[] = [];

      for (let di = 0; di < days.length; di++) {
        const date = days[di];
        const color = DAY_COLORS[di % DAY_COLORS.length];
        const items = subplanes
          .filter(s => isoDateOnly(s.inicio_at) === date && s.ubicacion_nombre)
          .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));

        type Point = { name: string; isDestination?: boolean; subplanIdx: number; coords: { lat: number; lng: number } | null };
        const points: Point[] = [];
        items.forEach((s, i) => {
          points.push({ name: s.ubicacion_nombre, subplanIdx: i, coords: s.ubicacion_lat != null ? { lat: s.ubicacion_lat, lng: s.ubicacion_lng! } : null });
          if (TIPOS_TRANSPORTE.includes(s.tipo) && s.ubicacion_fin_nombre)
            points.push({ name: s.ubicacion_fin_nombre, isDestination: true, subplanIdx: i, coords: s.ubicacion_fin_lat != null ? { lat: s.ubicacion_fin_lat, lng: s.ubicacion_fin_lng! } : null });
        });
        if (points.length === 0) continue;

        const coords = await Promise.all(points.map(p => p.coords ? Promise.resolve(p.coords) : geocode(p.name)));
        if (abortedRef.current) return;

        coords.forEach(c => { if (c) bounds.extend(c); });

        // Create invisible markers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markers: DayData["markers"] = coords.map((coord, i) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const marker: any = coord ? new google.maps.Marker({
            position: coord, map,
            label: { text: " " },
            icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 0, strokeColor: "transparent", strokeWeight: 0, scale: 0 },
            title: points[i].name,
          }) : null;
          return { marker, coord, label: String(i + 1) };
        });

        // Build segments
        const segments: DayData["segments"] = [];
        for (let i = 0; i < points.length - 1; i++) {
          const from = coords[i], to = coords[i + 1];
          if (!from || !to) { segments.push({ path: [], isArc: false }); continue; }
          const fromSubplan = items[points[i].subplanIdx];
          const isArc = TIPOS_TRANSPORTE.includes(fromSubplan?.tipo) && !!points[i + 1]?.isDestination;
          const destSubplan = items[points[i + 1].subplanIdx];
          let path: { lat: number; lng: number }[];
          if (isArc) {
            path = Array.from({ length: 241 }, (_, t) => ({ lat: from.lat + (to.lat - from.lat) * (t / 240), lng: from.lng + (to.lng - from.lng) * (t / 240) }));
          } else if (destSubplan?.ruta_polyline) {
            path = google.maps.geometry?.encoding ? google.maps.geometry.encoding.decodePath(destSubplan.ruta_polyline) : decodePath(destSubplan.ruta_polyline);
          } else {
            path = [from, to];
          }
          segments.push({ path, isArc });
        }

        dayDataList.push({ color, date, markers, segments });
      }

      if (abortedRef.current) return;

      // Zoom to first day's extent to start the animation
      const firstDay = dayDataList[0];
      if (firstDay) {
        const dayBounds = new google.maps.LatLngBounds();
        firstDay.markers.forEach(m => { if (m.coord) dayBounds.extend(m.coord); });
        if (!dayBounds.isEmpty()) map.fitBounds(dayBounds, 80);
        else map.fitBounds(bounds, 48);
      } else {
        map.fitBounds(bounds, 48);
      }
      setLoading(false); // show map — markers still invisible, animation starts now

      // ── Phase 2: animate days sequentially, each day's markers/routes in order ──
      const animateDay = async (dd: DayData) => {
        for (let i = 0; i < dd.markers.length; i++) {
          if (abortedRef.current) return;
          const { marker, coord, label } = dd.markers[i];
          if (marker && coord) await popMarker(marker, google, map, dd.color, label, coord);
          await delay(250);
          if (i < dd.segments.length && dd.segments[i].path.length > 0) {
            if (abortedRef.current) return;
            if (dd.segments[i].isArc) {
              await animatePlane(google, map, dd.segments[i].path, dd.color, () => abortedRef.current);
            } else {
              await animatePolyline(google, map, dd.segments[i].path, dd.color, () => abortedRef.current);
            }
            // After an arc, zoom in to the destination before continuing
            if (dd.segments[i].isArc) {
              const nextCoord = dd.markers[i + 1]?.coord;
              if (nextCoord) {
                map.setCenter(nextCoord);
                map.setZoom(12);
                await delay(600);
              }
            }
            await delay(250);
          }
        }
      };

      for (const dd of dayDataList) {
        if (abortedRef.current) return;
        await animateDay(dd);
        await delay(600);
      }

      // Zoom out to show the full trip once animation is complete
      if (!abortedRef.current) map.fitBounds(bounds, 48);

    } catch {
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
        <div ref={mapRef} className="absolute inset-0" />
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
                  <span className="text-[11px] text-white/80">{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
