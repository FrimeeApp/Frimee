"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import { useIsDarkTheme } from "@/hooks/useIsDarkTheme";
import type { PlaceMoment } from "./moments";
import { mapsUrl } from "./MomentCards";

const STYLE_URL = { dark: "https://tiles.openfreemap.org/styles/dark", light: "https://tiles.openfreemap.org/styles/positron" };
const WORKER_URL = "/vendor/maplibre-gl-worker.mjs";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * A small map as one more moment on the spine, never a background (board k-momentos · Sitios).
 * One point in time, no live location. The map only exists while the card is on screen: a long
 * chat with many places would otherwise run out of WebGL contexts.
 */
export function PlaceCard({
  data, title, time, canAddToPlan, onAddToPlan,
}: {
  data: PlaceMoment;
  /** «Lucía compartió un sitio» / «Compartiste un sitio». */
  title: string;
  time: string;
  canAddToPlan?: boolean;
  onAddToPlan?: () => void;
}) {
  const dark = useIsDarkTheme();
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const container = boxRef.current;
    if (!visible || !container || failed) return;
    if (!hasWebGL() || (typeof navigator !== "undefined" && navigator.onLine === false)) {
      setFailed(true);
      return;
    }
    let map: MaplibreMap | null = null;
    let cancelled = false;
    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled) return;
      maplibregl.setWorkerUrl(WORKER_URL);
      map = new maplibregl.Map({
        container,
        style: (dark ? STYLE_URL.dark : STYLE_URL.light) as unknown as StyleSpecification,
        center: [data.lng, data.lat],
        zoom: 15,
        interactive: false,
        attributionControl: { compact: true },
        fadeDuration: 0,
      });
      map.on("error", () => setFailed(true));
      map.on("load", () => {
        container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      });
    }).catch(() => setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [visible, dark, data.lat, data.lng, failed]);

  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-[8px] border border-app bg-[var(--surface)]">
      <div className="flex items-baseline gap-[8px] px-[14px] pt-[12px] text-[12px] text-muted">
        <span className="font-[var(--fw-semibold)] tracking-[.02em] text-app">{title}</span>
        <span className="tabular-nums">{time}</span>
      </div>
      <div className="relative mx-[14px] mt-[10px] h-[132px] overflow-hidden rounded-[6px] border border-app bg-[var(--surface-2)]">
        {!failed && <div ref={boxRef} className="absolute inset-0" aria-hidden />}
        {/* The pin sits over the map's centre, so it is there before the tiles arrive. */}
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 flex size-[28px] -translate-x-1/2 -translate-y-full items-center justify-center rounded-full bg-[var(--primary)] text-[var(--bg)] shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          <MapPin className="size-[15px]" strokeWidth={2.4} />
        </span>
      </div>
      <div className="px-[14px] pb-[4px] pt-[10px]">
        <p className="[font-family:var(--font-display-face)] text-[22px] leading-[26px] text-app">{data.nombre}</p>
        {data.direccion && <p className="mt-[2px] text-[12px] text-muted">{data.direccion}</p>}
      </div>
      <div className="flex min-h-[44px] items-center gap-[16px] px-[14px] text-[14px]">
        <a href={mapsUrl(data.lat, data.lng)} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] items-center font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">
          Abrir en Mapas
        </a>
        {canAddToPlan && onAddToPlan && (
          <button type="button" onClick={onAddToPlan} className="flex min-h-[44px] items-center font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">
            Añadir al plan
          </button>
        )}
      </div>
    </div>
  );
}
