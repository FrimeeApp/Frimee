"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/polyline";
import { legMidpoint, pendingLegs, vehicleAt, type Ambient, type JourneyDay, type JourneyPosition } from "@/lib/album-journey";
import { LegIcon } from "./LegIcon";
import styles from "./album.module.css";
import type { AlbumMiembro } from "@/services/api/endpoints/album.endpoint";
import { GroupMarker } from "./GroupMarker";
import { pileSide } from "./pile-side";

const PAD = 48;
// Room for the floating controls on top of the map (back button, destination pill).
const PAD_TOP = 96;
const MUTED = "var(--al-pending)";

/** Fits a set of coordinates into a w×h frame (equirectangular, fine at city scale). */
function fit(points: LatLng[], w: number, h: number) {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * k, 1e-4);
  const spanY = Math.max(maxLat - minLat, 1e-4);
  const scale = Math.min((w - 2 * PAD) / spanX, (h - PAD_TOP - PAD) / spanY);
  const offX = (w - spanX * scale) / 2;
  const offY = PAD_TOP + (h - PAD_TOP - PAD - spanY * scale) / 2;
  return (p: LatLng) => ({ x: offX + (p.lng - minLng) * k * scale, y: offY + (maxLat - p.lat) * scale });
}

function pathOf(points: LatLng[], xy: (p: LatLng) => { x: number; y: number }) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${xy(p).x.toFixed(1)} ${xy(p).y.toFixed(1)}`).join(" ");
}

/**
 * The active day's map: done legs in the brand colour, the current one filling with the
 * scroll, the rest grey and dashed. SVG drawn from the saved routes, no map tiles.
 */
export function JourneyMap({ day, position, ambient, miembros, currentUserId }: { day: JourneyDay | undefined; position: JourneyPosition; ambient: Ambient | null; miembros: AlbumMiembro[]; currentUserId: string | null }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 400 });
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect;
      if (r && r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const xy = useMemo(() => {
    if (!day) return null;
    const points = [
      ...day.stops.flatMap((s) => (s.at ? [s.at] : [])),
      ...day.legs.flatMap((l) => l.points ?? []),
    ];
    return fit(points, size.w, size.h);
  }, [day, size]);

  const label = day ? `Mapa del día ${day.number}: ${day.stops.map((s) => s.place).join(", ")}` : "Mapa del recorrido";

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden bg-[var(--al-map)]">
      <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} role="img" aria-label={label} className="block">
        <defs>
          <pattern id="journey-dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="var(--al-map-dots)" />
          </pattern>
        </defs>
        <rect width={size.w} height={size.h} fill="url(#journey-dots)" />

        {day && xy && (
          <>
            {day.legs.map((leg, i) => {
              if (!leg.points) return null;
              const d = pathOf(leg.points, xy);
              const done = position.started && (i < position.stop || position.finished);
              const current = position.started && !position.finished && i === position.stop;
              return (
                <g key={i}>
                  {/* Pending route underneath: grey dashes. */}
                  <path d={d} fill="none" stroke={MUTED} strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" strokeLinejoin="round" />
                  {(done || current) && (
                    <>
                      <path
                        d={d}
                        pathLength={1}
                        fill="none"
                        stroke="var(--primary)"
                        strokeOpacity="0.18"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="1"
                        strokeDashoffset={done ? 0 : 1 - position.legT}
                      />
                      <path
                        d={d}
                        pathLength={1}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={leg.routed ? "1" : "0.02 0.025"}
                        strokeDashoffset={leg.routed ? (done ? 0 : 1 - position.legT) : 0}
                        opacity={leg.routed || done ? 1 : position.legT}
                      />
                    </>
                  )}
                </g>
              );
            })}

            {day.stops.map((stop, i) => {
              if (!stop.at) return null;
              const { x, y } = xy(stop.at);
              const visited = position.started && (i < position.stop || (i === position.stop && position.legT === 0) || position.finished);
              const here = position.started && !position.finished && i === position.stop && position.legT === 0;
              const passed = position.started && (i <= position.stop || position.finished);
              const anchorEnd = x > size.w - 150;
              return (
                <g key={stop.key}>
                  {here && <circle cx={x} cy={y} r="18" fill="var(--primary)" fillOpacity="0.16" />}
                  <circle
                    cx={x}
                    cy={y}
                    r={here ? 8 : 6}
                    fill={here ? "var(--primary)" : "var(--al-base)"}
                    stroke={passed || visited ? "var(--primary)" : MUTED}
                    strokeWidth={here ? 3 : 2.5}
                  />
                  <text
                    x={anchorEnd ? x - 12 : x + 12}
                    y={y + 4}
                    textAnchor={anchorEnd ? "end" : "start"}
                    fontSize="11"
                    fontWeight="500"
                    fill={passed ? "var(--al-text)" : "var(--al-muted)"}
                    stroke="var(--al-map)"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {stop.place}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </svg>
      <div className={styles.tint} data-ambient={ambient ?? "manana"} aria-hidden />
      {day && xy && pendingLegs(day, position).map((i) => {
        const leg = day.legs.at(i);
        const mid = leg ? legMidpoint(leg) : null;
        if (!leg?.transporte || !mid) return null;
        const { x, y } = xy(mid);
        return (
          <div key={`leg-${i}`} className="pointer-events-none absolute" style={{ left: x - 11, top: y - 11 }}>
            <LegIcon transporte={leg.transporte} />
          </div>
        );
      })}
      {day && xy && (() => {
        const at = vehicleAt(day, position);
        if (!at) return null;
        const { x, y } = xy(at);
        return (
          <div className="pointer-events-none absolute" style={{ left: x - 19, top: y - 19 }} data-side={pileSide(x, y, size.w)}>
            <GroupMarker day={day} position={position} miembros={miembros} currentUserId={currentUserId} />
          </div>
        );
      })()}
    </div>
  );
}
