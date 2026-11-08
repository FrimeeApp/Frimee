"use client";

import { useState } from "react";
import Image from "next/image";
import { useInView } from "@/hooks/useInView";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { DEMO_PHOTO_CREDITS } from "@/config/demo-photos";
import type { AlbumFoto, AlbumMiembro } from "@/services/api/endpoints/album.endpoint";

// Small alternating tilts: a pile of prints rather than a grid of thumbnails.
const TILTS = [-1.6, 1.3, -0.9, 1.8, -1.2, 0.8];
const STAGGER_MS = 110;

/** Grid cell per position: the first photo big, the next two beside it, the rest three per row. */
function cellClass(index: number, count: number) {
  if (count === 1) return "col-span-6 row-span-2";
  if (count === 2) return "col-span-3 row-span-2";
  if (index === 0) return "col-span-4 row-span-2";
  if (index < 3) return "col-span-2 row-span-1";
  return "col-span-2 row-span-1";
}

export function PhotoCollage({ fotos, miembros }: { fotos: AlbumFoto[]; miembros: AlbumMiembro[] }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  const [open, setOpen] = useState<string | null>(null);
  const names = new Map(miembros.map((m) => [m.id, m.nombre.split(" ")[0]]));
  const credits = fotos.map((f) => DEMO_PHOTO_CREDITS[f.url]).filter((c) => c !== undefined);

  return (
    <div className="mt-[var(--space-6)]">
      <div ref={ref} className="grid auto-rows-[118px] grid-cols-6 gap-3 sm:auto-rows-[150px] sm:gap-4">
        {fotos.map((foto, i) => {
          const tilt = TILTS.at(i % TILTS.length) ?? 0;
          const autor = names.get(foto.user_id);
          return (
            <button
              key={foto.id}
              type="button"
              onClick={() => setOpen(foto.url)}
              aria-label={autor ? `Ver foto de ${autor}` : "Ver foto"}
              className={`${cellClass(i, fotos.length)} group relative rounded-[4px] bg-[#f6f3ec] p-[6px] pb-[22px] shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition-[opacity,transform] duration-500 ease-out hover:z-10 hover:!rotate-0 hover:scale-[1.02] motion-reduce:transition-none`}
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? `rotate(${tilt}deg)` : `translateY(16px) rotate(${tilt * 2}deg)`,
                transitionDelay: inView ? `${i * STAGGER_MS}ms` : "0ms",
              }}
            >
              <span className="relative block h-full w-full overflow-hidden bg-[#e4e0d6]">
                <Image
                  src={foto.url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 66vw, 480px"
                  unoptimized
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </span>
              {autor && (
                <span className="absolute bottom-[4px] left-[8px] text-[11px] italic text-[#6b6458]">{autor}</span>
              )}
            </button>
          );
        })}
      </div>

      {credits.length > 0 && (
        <p className="mt-[var(--space-4)] text-[11px] leading-relaxed text-muted">
          Fotos de ejemplo de Wikimedia Commons:{" "}
          {credits.map((c, i) => (
            <span key={c.fuente}>
              {i > 0 && " · "}
              <a href={c.fuente} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                {c.autor}
              </a>{" "}
              {c.licenciaUrl ? (
                <a href={c.licenciaUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  ({c.licencia})
                </a>
              ) : (
                `(${c.licencia})`
              )}
            </span>
          ))}
        </p>
      )}

      {open && <ImageLightbox url={open} imageUrls={fotos.map((f) => f.url)} onClose={() => setOpen(null)} />}
    </div>
  );
}
