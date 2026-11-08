"use client";

import { Footprints, SquareParking } from "lucide-react";
import type { AlbumMiembro } from "@/services/api/endpoints/album.endpoint";
import { transportInfo } from "./transport";

// One colour per traveller (brand, warning, success, quiet): told apart at a glance.
export const TRAVELLER_COLORS = ["#3cddc2", "#fbbf24", "#4ade80", "#a0a0a9"];

/**
 * The group travelling: a brand circle with the transport's icon and the travellers on top.
 */
export function Vehicle({ transporte, miembros, currentUserId, parked }: { transporte: string | null; miembros: AlbumMiembro[]; currentUserId: string | null; parked: boolean }) {
  // Same order and colours as the cover: everyone else first, you last as "Tú".
  const ordered = [...miembros.filter((m) => m.id !== currentUserId), ...miembros.filter((m) => m.id === currentUserId)];
  const info = transportInfo(transporte);
  const Icon = parked ? SquareParking : info?.Icon ?? Footprints;
  const label = parked ? "Aparcado" : info?.label ?? "A pie";
  return (
    <div className="relative size-[38px]" aria-label={`El grupo · ${label}`} role="img">
      <div className="absolute bottom-[34px] left-1/2 flex -translate-x-1/2 items-center">
        {ordered.slice(0, 4).map((m, i) => (
          <span
            key={m.id}
            className={`flex size-5 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--al-base)] text-[8px] font-semibold text-[var(--al-base)] ${i > 0 ? "-ml-1.5" : ""}`}
            style={{ background: TRAVELLER_COLORS.at(i % TRAVELLER_COLORS.length) }}
          >
            {m.foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- tiny avatar inside a map marker
              <img src={m.foto} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              m.id === currentUserId ? "Tú" : (m.nombre.trim()[0] ?? "?").toUpperCase()
            )}
          </span>
        ))}
      </div>
      <div className="flex size-[38px] items-center justify-center rounded-full border-[3px] border-[var(--al-base)] bg-[var(--primary)] shadow-[0_4px_12px_rgba(0,0,0,0.45)]">
        <Icon key={label} className="size-[19px] text-[var(--al-on-primary)]" strokeWidth={2.2} aria-hidden />
      </div>
    </div>
  );
}
