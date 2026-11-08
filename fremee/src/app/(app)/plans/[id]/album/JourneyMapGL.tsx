"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as MaplibreMap, Marker, GeoJSONSource, StyleSpecification, ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { LatLng } from "@/lib/polyline";
import { cameraFor, dashboardAt, legMidpoint, pendingLegs, positionFromProgress, vehicleAt, type JourneyDay, type JourneyPosition } from "@/lib/album-journey";
import type { Motion } from "@/lib/motion";
import { LegIcon } from "./LegIcon";
import type { AlbumMiembro } from "@/services/api/endpoints/album.endpoint";
import { GroupMarker } from "./GroupMarker";
import { pileSide } from "./pile-side";
import styles from "./album.module.css";

/**
 * OpenFreeMap "Dark" (free, no key, OpenStreetMap data): real river, coast, streets and
 * neighbourhood names in any city. Restyled to the album palette after it loads.
 */
const STYLE_URL = { dark: "https://tiles.openfreemap.org/styles/dark", light: "https://tiles.openfreemap.org/styles/positron" };
const WORKER_URL = "/vendor/maplibre-gl-worker.mjs";
const LOAD_TIMEOUT_MS = 10_000;
/** Map colours per theme (the album's palette; light from the design's light board). */
const PALETTE = {
  dark: { bg: "#141417", water: "#1e2227", place: "#8a8a93", primary: "#3cddc2", muted: "#6b6b75", base: "#111111", text: "#eeeeef", textMuted: "#a0a0a9", halo: "#141417", roads: 0.35 },
  light: { bg: "#f4f7f6", water: "#dbe7e4", place: "#60606b", primary: "#298e7d", muted: "#8a8a94", base: "#ffffff", text: "#1c1c22", textMuted: "#60606b", halo: "#f4f7f6", roads: 0.6 },
};
type Palette = (typeof PALETTE)["dark"];

const lngLat = (p: LatLng): [number, number] => [p.lng, p.lat];
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };

/** Pending legs (all), legs already travelled, the current leg whole, and the stops. */
function buildData(day: JourneyDay | undefined, position: JourneyPosition) {
  if (!day) return { pending: empty, trail: empty, current: empty, stops: empty };
  const pending: FeatureCollection = {
    type: "FeatureCollection",
    features: day.legs.flatMap((leg) =>
      leg.points ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: leg.points.map(lngLat) } }] : []),
  };
  const trail: FeatureCollection = {
    type: "FeatureCollection",
    features: day.legs.flatMap((leg, i) => {
      if (!leg.points || !position.started || !(i < position.stop || position.finished)) return [];
      return [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: leg.points.map(lngLat) } }];
    }),
  };
  const currentLeg = position.started && !position.finished ? day.legs.at(position.stop) : undefined;
  const current: FeatureCollection = currentLeg?.points
    ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: currentLeg.points.map(lngLat) } }] }
    : empty;
  const stops: FeatureCollection = {
    type: "FeatureCollection",
    features: day.stops.flatMap((stop, i) => {
      if (!stop.at) return [];
      const passed = position.started && (i <= position.stop || position.finished);
      const name = stop.place;
      return [{ type: "Feature" as const, properties: { passed, name }, geometry: { type: "Point" as const, coordinates: lngLat(stop.at) } }];
    }),
  };
  return { pending, trail, current, stops };
}

/** Album look on top of the OpenFreeMap dark style. */
function restyle(map: MaplibreMap, c: Palette) {
  const set = (layer: string, prop: Parameters<MaplibreMap["setPaintProperty"]>[1], value: Parameters<MaplibreMap["setPaintProperty"]>[2]) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };
  set("background", "background-color", c.bg);
  set("water", "fill-color", c.water);
  set("building", "fill-opacity", 0.5);
  // Motorways and bridges in near-black stood out more than the route: quiet them down.
  for (const layer of ["highway_motorway_casing", "highway_motorway_inner", "highway_motorway_subtle", "highway_major_casing", "highway_major_inner"]) {
    if (map.getLayer(layer)) map.setPaintProperty(layer, "line-opacity", c.roads);
  }
  // Street names, shields and water names (dark style ids, then light style ids).
  for (const layer of [
    "road_oneway", "road_oneway_opposite", "highway_name_other", "highway_name_motorway", "water_name",
    "highway-name-path", "highway-name-minor", "highway-name-major", "highway-shield-non-us",
    "highway-shield-us-interstate", "road_shield_us", "water_name_point_label", "water_name_line_label", "waterway_line_label",
  ]) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", "none");
  }
  // Neighbourhoods as quiet small caps, in their local name (Belém, not Belem).
  // Towns and cities in their local name too ("Lisboa", not "Lisbon"), in both styles.
  for (const layer of ["place_village", "place_town", "place_city", "place_city_large", "label_village", "label_town", "label_city", "label_city_capital"]) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "text-field", ["coalesce", ["get", "name"], ["get", "name_en"]]);
  }
  for (const layer of ["place_suburb", "place_other", "label_other"]) {
    if (!map.getLayer(layer)) continue;
    map.setLayoutProperty(layer, "text-field", ["coalesce", ["get", "name"], ["get", "name_en"]]);
    map.setLayoutProperty(layer, "text-transform", "uppercase");
    map.setLayoutProperty(layer, "text-letter-spacing", 0.15);
    map.setLayoutProperty(layer, "text-size", 10);
    map.setPaintProperty(layer, "text-color", c.place);
  }
}

function addAlbumLayers(map: MaplibreMap, c: Palette) {
  map.addSource("album-pending", { type: "geojson", data: empty });
  map.addSource("album-trail", { type: "geojson", data: empty });
  map.addSource("album-stops", { type: "geojson", data: empty });
  // lineMetrics: the current leg is painted up to a fraction of its length with a gradient.
  map.addSource("album-current", { type: "geojson", data: empty, lineMetrics: true });
  map.addLayer({
    id: "album-pending", type: "line", source: "album-pending",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": c.muted, "line-width": 2.5, "line-dasharray": [1.5, 2.5] },
  });
  map.addLayer({
    id: "album-trail-glow", type: "line", source: "album-trail",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": c.primary, "line-width": 10, "line-opacity": 0.18 },
  });
  map.addLayer({
    id: "album-trail", type: "line", source: "album-trail",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": c.primary, "line-width": 4 },
  });
  map.addLayer({
    id: "album-current-glow", type: "line", source: "album-current",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-width": 10, "line-opacity": 0.18, "line-gradient": ["step", ["line-progress"], "rgba(0,0,0,0)", 1, "rgba(0,0,0,0)"] },
  });
  map.addLayer({
    id: "album-current", type: "line", source: "album-current",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-width": 4, "line-gradient": ["step", ["line-progress"], "rgba(0,0,0,0)", 1, "rgba(0,0,0,0)"] },
  });
  map.addLayer({
    id: "album-stops", type: "circle", source: "album-stops",
    paint: {
      "circle-radius": 6,
      "circle-color": c.base,
      "circle-stroke-width": 3,
      "circle-stroke-color": ["case", ["get", "passed"], c.primary, c.muted],
    },
  });
  map.addLayer({
    id: "album-stop-names", type: "symbol", source: "album-stops",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-max-width": 12,
    },
    paint: {
      "text-color": ["case", ["get", "passed"], c.text, c.textMuted],
      "text-halo-color": c.halo,
      "text-halo-width": 1.5,
    },
  });
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** What changes the React-drawn parts (stops, badges, photo pile, camera): not every frame. */
function discreteKey(p: JourneyPosition) {
  return `${p.day}|${p.started}|${p.finished}|${p.stop}|${p.legT === 0}`;
}

/** Brand colour up to `t` of the line (by length), transparent after: the trail of the current leg. */
function trailGradient(color: string, t: number) {
  if (t <= 0) return ["step", ["line-progress"], "rgba(0,0,0,0)", 1, "rgba(0,0,0,0)"];
  if (t >= 1) return ["step", ["line-progress"], color, 1, color];
  return ["step", ["line-progress"], color, t, "rgba(0,0,0,0)"];
}

/**
 * The journey on a real map (MapLibre + OpenFreeMap). Calls `onFail` when the map cannot be
 * shown (no WebGL, offline, style not loaded in time) so the page falls back to the SVG map.
 *
 * Movement is imperative: `motion` (eased scroll progress) moves the group marker and the
 * current leg's trail every frame without re-rendering React; React only redraws when the
 * group reaches a stop, starts a leg or changes day.
 */
export function JourneyMapGL({
  day, base, motion, miembros, currentUserId, topPadding, dark, onFail,
}: {
  day: JourneyDay | undefined;
  /** Position from the scroll step (day, started, finished); the motion value refines it. */
  base: JourneyPosition;
  motion: Motion;
  miembros: AlbumMiembro[];
  currentUserId: string | null;
  topPadding: number;
  /** Theme at creation: the parent remounts the map (key) when it changes. */
  dark: boolean;
  onFail: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const tintRef = useRef<HTMLDivElement | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const legMarkersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [markerEl] = useState(() => (typeof document === "undefined" ? null : document.createElement("div")));
  const palette = dark ? PALETTE.dark : PALETTE.light;
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);

  // Discrete position for the React-drawn parts; updated only when its key changes.
  const [pos, setPos] = useState<JourneyPosition>(() => positionFromProgress(base, motion.get()));

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!hasWebGL() || (typeof navigator !== "undefined" && navigator.onLine === false)) {
      onFailRef.current();
      return;
    }
    let cancelled = false;
    let loaded = false;
    const timer = window.setTimeout(() => { if (!loaded) onFailRef.current(); }, LOAD_TIMEOUT_MS);

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled) return;
      maplibregl.setWorkerUrl(WORKER_URL);
      libRef.current = maplibregl;
      const map = new maplibregl.Map({
        container,
        style: (dark ? STYLE_URL.dark : STYLE_URL.light) as unknown as StyleSpecification,
        interactive: false,
        attributionControl: { compact: true },
        fadeDuration: 0,
      });
      mapRef.current = map;
      map.on("error", () => { if (!loaded) onFailRef.current(); });
      map.on("load", () => {
        loaded = true;
        window.clearTimeout(timer);
        const colours = dark ? PALETTE.dark : PALETTE.light;
        restyle(map, colours);
        addAlbumLayers(map, colours);
        // Time-of-day tint right above the map canvas, below the group and its photos.
        const tint = document.createElement("div");
        tint.className = styles.tint ?? "";
        map.getCanvas().after(tint);
        tintRef.current = tint;
        if (markerEl) markerRef.current = new maplibregl.Marker({ element: markerEl, anchor: "center" });
        // Keep the photo pile on screen while the camera flies between days.
        map.on("move", () => placePileRef.current());
        // The map is not interactive, so the compact attribution would stay open over the map:
        // fold it into its "i" button (the full credit is also printed at the end of the album).
        container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        setReady(true);
      });
    }).catch(() => onFailRef.current());

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      legMarkersRef.current.forEach((m) => m.remove());
      markerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [markerEl, dark]);

  // Every frame: move the group and stretch the current leg's trail, straight on the map.
  const posKeyRef = useRef(discreteKey(pos));
  const ambientRef = useRef<string>("");
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !day) return;
    const frame = (value: number) => {
      const p = positionFromProgress(base, value);
      const at = vehicleAt(day, p);
      const marker = markerRef.current;
      if (marker && at) marker.setLngLat(lngLat(at)).addTo(map);
      const t = p.started && !p.finished ? p.legT : 0;
      const gradient = trailGradient(palette.primary, t) as unknown as ExpressionSpecification;
      if (map.getLayer("album-current")) {
        map.setPaintProperty("album-current", "line-gradient", gradient);
        map.setPaintProperty("album-current-glow", "line-gradient", gradient);
      }
      const ambient = dashboardAt(day, p)?.ambient ?? "manana";
      if (tintRef.current && ambient !== ambientRef.current) {
        ambientRef.current = ambient;
        tintRef.current.dataset.ambient = ambient;
      }
      const key = discreteKey(p);
      if (key !== posKeyRef.current) {
        posKeyRef.current = key;
        setPos(p);
      }
    };
    frame(motion.get());
    return motion.subscribe(frame);
  }, [ready, day, base, motion, palette.primary]);

  // Stops, travelled legs and the current leg's geometry: only when the discrete position changes.
  const data = useMemo(() => buildData(day, pos), [day, pos]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource<GeoJSONSource>("album-pending")?.setData(data.pending);
    map.getSource<GeoJSONSource>("album-trail")?.setData(data.trail);
    map.getSource<GeoJSONSource>("album-current")?.setData(data.current);
    map.getSource<GeoJSONSource>("album-stops")?.setData(data.stops);
  }, [ready, data]);

  // Which side of the group the photo pile goes, so it stays inside the map.
  const placePileRef = useRef(() => {});
  const vehicle = vehicleAt(day, pos);
  useEffect(() => {
    placePileRef.current = () => {
      const map = mapRef.current;
      if (!map || !markerEl || !vehicle) return;
      const { x, y } = map.project(lngLat(vehicle));
      markerEl.dataset.side = pileSide(x, y, map.getContainer().clientWidth);
    };
    placePileRef.current();
  }, [markerEl, vehicle]);

  // Transport badges halfway along the legs still ahead.
  const legEls = useMemo(
    () => (typeof document === "undefined" || !day ? [] : day.legs.map(() => document.createElement("div"))),
    [day],
  );
  const pending = useMemo(() => (day ? pendingLegs(day, pos) : []), [day, pos]);
  const pendingKey = pending.join(",");
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib || !day) return;
    legMarkersRef.current.forEach((m) => m.remove());
    legMarkersRef.current = pendingKey
      .split(",")
      .filter(Boolean)
      .map(Number)
      .flatMap((i) => {
        const el = legEls.at(i);
        const leg = day.legs.at(i);
        const mid = leg ? legMidpoint(leg) : null;
        return el && mid ? [new lib.Marker({ element: el, anchor: "center" }).setLngLat(lngLat(mid)).addTo(map)] : [];
      });
  }, [ready, day, legEls, pendingKey]);

  // Camera: the framing only changes with its key (a new day, taking off, landing), not every frame.
  const coverFraming = !pos.started && day?.key === "trip";
  const camera = cameraFor(day, pos, coverFraming);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const cameraKey = camera.key;
  useEffect(() => {
    const map = mapRef.current;
    const bounds = cameraRef.current.bounds;
    if (!ready || !map || !bounds) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(bounds, {
      // Wide sides: stop names hang under their dots and must not be cut at the edges.
      padding: { top: topPadding, bottom: 64, left: 80, right: 80 },
      maxZoom: 16,
      duration: reduced ? 0 : 1400,
    });
  }, [ready, cameraKey, topPadding]);

  return (
    <div className={`absolute inset-0 bg-[var(--al-map)] ${styles.map}`}>
      {/* maplibre-gl.css sets the container to position: relative, so size it with h/w, not inset. */}
      <div ref={containerRef} className="h-full w-full" aria-label="Mapa del recorrido" role="img" />
      {ready && day && pending.map((i) => {
        const el = legEls.at(i);
        const transporte = day.legs.at(i)?.transporte;
        return el && transporte ? createPortal(<LegIcon transporte={transporte} />, el, `leg-${i}`) : null;
      })}
      {markerEl && ready && vehicle && day && createPortal(
        <GroupMarker day={day} position={pos} miembros={miembros} currentUserId={currentUserId} />,
        markerEl,
      )}
    </div>
  );
}
