"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { vehicleTransport, type JourneyDay, type JourneyPosition } from "@/lib/album-journey";
import type { AlbumMiembro } from "@/services/api/endpoints/album.endpoint";
import { Vehicle } from "./Vehicle";
import styles from "./album.module.css";

const MAX_POLAROIDS = 3;
const TILTS = [-6, 4, -2];

type PolaroidStyle = CSSProperties & { "--tilt": string; "--delay": string };

/**
 * The group on the map. On arriving at a stop it bounces, a ring spreads from the stop and the
 * stop's photos drop next to it as polaroids (at most 3, then a "+N" badge). Keyed by stop, so
 * each arrival plays once; while travelling the pile is gone.
 */
export function GroupMarker({ day, position, miembros, currentUserId }: { day: JourneyDay; position: JourneyPosition; miembros: AlbumMiembro[]; currentUserId: string | null }) {
  const atStop = position.started && !position.finished && position.legT === 0;
  const stop = day.stops.at(position.stop);
  const fotos = atStop ? stop?.fotos ?? [] : [];
  const shown = fotos.slice(0, MAX_POLAROIDS);
  const extra = fotos.length - shown.length;
  const arrivalKey = atStop && stop ? `stop-${stop.key}` : "moving";
  const place = stop?.place ?? "";

  return (
    <div className={`${styles.pileAnchor} relative size-[38px]`}>
      {atStop && <span key={`halo-${arrivalKey}`} className={`${styles.halo} absolute inset-0 rounded-full border-2 border-[var(--primary)]`} aria-hidden />}
      <div key={arrivalKey} className={atStop ? styles.bounce : undefined}>
        <Vehicle transporte={vehicleTransport(day, position)} miembros={miembros} currentUserId={currentUserId} parked={position.finished} />
      </div>

      {shown.length > 0 && (
        <div key={`pile-${arrivalKey}`} className={`${styles.pile} pointer-events-none`} aria-hidden>
          <div className="relative h-[128px] w-[130px] lg:h-[210px] lg:w-[200px]">
            {shown.map((foto, i) => (
              <div
                key={foto.id}
                className={`${styles.polaroid} absolute w-[100px] rounded-[2px] lg:w-[160px] bg-[#f3efe6] px-[6px] pt-[6px] shadow-[0_8px_18px_rgba(0,0,0,0.38)]`}
                style={{ left: i * 14, top: i * 8, "--tilt": `${TILTS.at(i) ?? 0}deg`, "--delay": `${150 + i * 120}ms` } as PolaroidStyle}
              >
                <div className="relative h-[84px] overflow-hidden bg-[#24403b] lg:h-[140px]">
                  <Image src={foto.url} alt="" fill className="object-cover" sizes="100px" unoptimized referrerPolicy="no-referrer" />
                </div>
                <div className="flex h-[22px] items-center justify-center overflow-hidden px-[2px] text-[12px] italic lg:h-[34px] lg:text-[18px] text-[#1c1c22] [font-family:var(--font-display-face)]">
                  <span className="truncate">{place}</span>
                </div>
              </div>
            ))}
            {extra > 0 && (
              <span
                className={`${styles.polaroid} absolute flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--primary)] px-2 text-[12px] font-semibold text-[var(--al-base)]`}
                style={{ left: shown.length * 14 + 80, top: -6, "--tilt": "0deg", "--delay": `${150 + shown.length * 120}ms` } as PolaroidStyle}
              >
                +{extra}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
