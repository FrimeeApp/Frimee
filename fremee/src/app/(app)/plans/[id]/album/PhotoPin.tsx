"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { Map as MaplibreMap } from "maplibre-gl";
import type { LatLng } from "@/lib/polyline";
import type { AlbumFoto } from "@/services/api/endpoints/album.endpoint";
import { pileSide } from "./pile-side";
import styles from "./album.module.css";

const TILTS = [-6, 4, -2];

/**
 * A photo taken on the way, pinned to the map where the group was when it dropped: it stays there
 * while the group moves on. A CSS animation never started on markers moved every frame, so it
 * appears with a plain transition. `extra` is the «+N» of the photos that did not fit, on its corner.
 */
export function PhotoPin({ map, lib, at, foto, index, place, extra }: {
  map: MaplibreMap;
  lib: typeof import("maplibre-gl");
  at: LatLng;
  foto: AlbumFoto;
  index: number;
  place: string;
  extra: number;
}) {
  const [element] = useState(() => document.createElement("div"));
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const { x, y } = map.project([at.lng, at.lat]);
    element.setAttribute("data-side", pileSide(x, y, map.getContainer().clientWidth));
    const marker = new lib.Marker({ element, anchor: "center" }).setLngLat([at.lng, at.lat]).addTo(map);
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      marker.remove();
    };
  }, [map, lib, at, element]);

  const tilt = TILTS.at(index % TILTS.length) ?? 0;
  return createPortal(
    <div className={`${styles.pileAnchor} relative size-[10px]`}>
      <span className="absolute inset-0 rounded-full border-2 border-[var(--primary)] bg-[var(--al-base)]" aria-hidden />
      <div className={`${styles.pile} pointer-events-none`} aria-hidden>
        <div
          className="relative w-[100px] rounded-[2px] bg-[#f3efe6] px-[6px] pt-[6px] shadow-[0_8px_18px_rgba(0,0,0,0.38)] lg:w-[160px]"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? `rotate(${tilt}deg)` : "translateY(-40px) rotate(-10deg)",
            transition: "opacity 400ms ease-out, transform 600ms cubic-bezier(0.2, 0.7, 0.2, 1)",
          }}
        >
          <div className="relative h-[84px] overflow-hidden bg-[#24403b] lg:h-[140px]">
            <Image src={foto.url} alt="" fill className="object-cover" sizes="100px" unoptimized referrerPolicy="no-referrer" />
          </div>
          <div className="flex h-[22px] items-center justify-center overflow-hidden px-[2px] text-[12px] italic lg:h-[34px] lg:text-[18px] text-[#1c1c22] [font-family:var(--font-display-face)]">
            <span className="truncate">{place}</span>
          </div>
          {extra > 0 && (
            <span className="absolute -right-[22px] -top-3 z-10 flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--primary)] px-2 text-[12px] font-semibold text-[var(--al-base)]">
              +{extra}
            </span>
          )}
        </div>
      </div>
    </div>,
    element,
  );
}
