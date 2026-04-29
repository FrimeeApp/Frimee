"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ComponentType, type MutableRefObject } from "react";
import { MeshPhongMaterial } from "three";
import type { GlobeMethods, GlobeProps } from "react-globe.gl";
import type { Feature, Geometry } from "geojson";

type Arc = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
};

type CityPoint = {
  lat: number;
  lng: number;
  color: string;
};

type CountryFeature = Feature<Geometry>;

type GlobeHeroProps = {
  className?: string;
};

const Globe = dynamic(async () => (await import("react-globe.gl")).default, {
  ssr: false,
}) as ComponentType<GlobeProps & { ref?: MutableRefObject<GlobeMethods | undefined> }>;

const arcColors = ["#ffffff", "rgba(255,255,255,0.9)", "rgba(255,255,255,0.78)", "rgba(255,255,255,0.66)"];

const sampleArcs: Arc[] = [
  { order: 1, startLat: 40.4168, startLng: -3.7038, endLat: 38.7223, endLng: -9.1393, arcAlt: 0.16, color: arcColors[3] },
  { order: 1, startLat: 38.7223, startLng: -9.1393, endLat: 48.8566, endLng: 2.3522, arcAlt: 0.18, color: arcColors[0] },
  { order: 2, startLat: 48.8566, startLng: 2.3522, endLat: 41.9028, endLng: 12.4964, arcAlt: 0.2, color: arcColors[1] },
  { order: 2, startLat: 51.5072, startLng: -0.1276, endLat: 40.7128, endLng: -74.006, arcAlt: 0.35, color: arcColors[2] },
  { order: 3, startLat: 34.0522, startLng: -118.2437, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.5, color: arcColors[0] },
  { order: 3, startLat: 22.3193, startLng: 114.1694, endLat: 1.3521, endLng: 103.8198, arcAlt: 0.18, color: arcColors[2] },
  { order: 4, startLat: -33.8688, startLng: 151.2093, endLat: 22.3193, endLng: 114.1694, arcAlt: 0.3, color: arcColors[1] },
  { order: 4, startLat: -34.6037, startLng: -58.3816, endLat: -22.9068, endLng: -43.1729, arcAlt: 0.22, color: arcColors[3] },
  { order: 5, startLat: 52.52, startLng: 13.405, endLat: 38.7223, endLng: -9.1393, arcAlt: 0.24, color: arcColors[0] },
  { order: 5, startLat: 28.6139, startLng: 77.209, endLat: 3.139, endLng: 101.6869, arcAlt: 0.28, color: arcColors[2] },
  { order: 6, startLat: -1.2921, startLng: 36.8219, endLat: 25.2048, endLng: 55.2708, arcAlt: 0.26, color: arcColors[1] },
  { order: 6, startLat: 37.7749, startLng: -122.4194, endLat: 21.3099, endLng: -157.8581, arcAlt: 0.25, color: arcColors[3] },
];

const cityPoints: CityPoint[] = [
  { lat: 40.4168, lng: -3.7038, color: "#ffffff" },
  { lat: 38.7223, lng: -9.1393, color: "#ffffff" },
  { lat: 48.8566, lng: 2.3522, color: "#ffffff" },
  { lat: 40.7128, lng: -74.006, color: "#ffffff" },
  { lat: 35.6762, lng: 139.6503, color: "#ffffff" },
  { lat: -33.8688, lng: 151.2093, color: "#ffffff" },
];

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 560, height: 560 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.max(320, Math.round(rect.width)),
        height: Math.max(360, Math.round(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

function configureGlobe(globe: GlobeMethods) {
  globe.pointOfView({ lat: 18, lng: 8, altitude: 1.85 }, 0);

  const controls = globe.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.enableRotate = true;
  controls.enableZoom = false;
  controls.enablePan = false;

  const distance = controls.getDistance();
  controls.minDistance = distance;
  controls.maxDistance = distance;
  controls.update();
}

export default function GlobeHero({ className = "" }: GlobeHeroProps) {
  const globeRef = useRef<GlobeMethods>();
  const { ref: wrapperRef, size } = useElementSize<HTMLDivElement>();
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const globeMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        color: "#062056",
        emissive: "#062056",
        emissiveIntensity: 0.18,
        shininess: 0.9,
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    fetch("/landingv2-countries.geojson")
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load countries: ${response.status}`);
        return response.json() as Promise<{ features?: CountryFeature[] }>;
      })
      .then((data) => {
        if (!cancelled) setCountries(data.features ?? []);
      })
      .catch(() => {
        if (!cancelled) setCountries([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleGlobeReady() {
    const globe = globeRef.current;
    if (!globe) return;

    configureGlobe(globe);
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      const globe = globeRef.current;
      if (!globe) return;

      configureGlobe(globe);
      window.clearInterval(interval);
    }, 100);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`relative aspect-square w-[clamp(480px,82vw,860px)] max-w-none overflow-visible ${className}`}
    >
      <div className="absolute inset-0 left-1/2 z-10 w-full -translate-x-1/2">
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          globeOffset={[0, 0]}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={globeMaterial}
          showAtmosphere
          atmosphereColor="#ffffff"
          atmosphereAltitude={0.055}
          showGraticules={false}
          hexPolygonsData={countries}
          hexPolygonGeoJsonGeometry="geometry"
          hexPolygonColor={() => "rgba(255,255,255,0.72)"}
          hexPolygonAltitude={0.004}
          hexPolygonResolution={3}
          hexPolygonMargin={0.38}
          hexPolygonCurvatureResolution={2}
          hexPolygonsTransitionDuration={1000}
          arcsData={sampleArcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcAltitude="arcAlt"
          arcColor="color"
          arcDashLength={0.92}
          arcDashGap={0.95}
          arcDashAnimateTime={1400}
          arcStroke={1.25}
          arcsTransitionDuration={700}
          pointsData={cityPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude={0.01}
          pointRadius={0.55}
          pointResolution={18}
          onGlobeReady={handleGlobeReady}
        />
      </div>
    </div>
  );
}
