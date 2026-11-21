"use client";

import Image from "next/image";
import { Sheet, sheetPrimaryButton } from "@/components/chat/bitacora/Sheet";
import { VideoThumb } from "@/components/plans/VideoThumb";

export type RevisarGroup = {
  key: string;
  titulo: string;
  detalle: string | null;
  fotos: { id: number; url: string; aprox: boolean; video?: boolean }[];
  /** The ones the user can move (own photos, or any if admin). */
  movibles: number[];
};

/**
 * After an upload with doubts: the groups where something may be wrong (approximate time, or no
 * activity found), and the rest summed up in a line. Closing changes nothing; «Todo bien» says the
 * approximate times are right.
 */
export default function AlbumRevisar({
  total,
  grupos,
  enSuSitio,
  canConfirm,
  busy,
  error,
  onOpenPhoto,
  onMover,
  onTodoBien,
  onClose,
}: {
  total: number;
  grupos: RevisarGroup[];
  enSuSitio: number;
  canConfirm: boolean;
  busy: boolean;
  error: boolean;
  onOpenPhoto: (url: string) => void;
  onMover: (ids: number[]) => void;
  onTodoBien: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      title={total === 1 ? "Revisar 1 foto" : `Revisar ${total} fotos`}
      onClose={onClose}
      zIndex={1400}
      footer={
        <>
          {error && <p className="mb-2 text-[13px] text-[var(--error)]">No se pudo guardar. Inténtalo de nuevo.</p>}
          <button type="button" className={sheetPrimaryButton} disabled={busy} onClick={onTodoBien}>
            {canConfirm ? "Todo bien" : "Cerrar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        {grupos.map((g) => (
          <section key={g.key} aria-label={g.titulo}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-[600] text-app">{g.titulo}</p>
                {g.detalle && <p className="text-[13px] text-muted">{g.detalle}</p>}
              </div>
              {g.movibles.length > 0 && (
                <button type="button" onClick={() => onMover(g.movibles)} className="-mt-2 min-h-11 shrink-0 px-2 text-[14px] font-[600] text-[var(--primary)]">
                  {g.movibles.length === 1 ? "Mover a…" : `Mover ${g.movibles.length} a…`}
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {g.fotos.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onOpenPhoto(f.url)}
                  aria-label={`${f.video ? "Ver vídeo" : "Ver foto"}${f.aprox ? ", hora aproximada" : ""}`}
                  className="relative size-[72px] shrink-0 overflow-hidden rounded-md bg-[var(--surface-2)]"
                >
                  {f.video ? <VideoThumb src={f.url} small /> : <Image src={f.url} alt="" fill sizes="72px" className="object-cover" unoptimized referrerPolicy="no-referrer" />}
                  {f.aprox && (
                    <span className="pointer-events-none absolute bottom-1 left-1 inline-flex h-5 items-center gap-[3px] rounded-full bg-[rgba(17,17,17,.8)] pr-1.5 pl-1 text-[11px] font-[600] leading-none text-white">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="12" r="9.5" strokeDasharray="3.2 3" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      Aprox.
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
        {enSuSitio > 0 && (
          <p className="text-[14px] text-muted">{enSuSitio === 1 ? "La otra ya está en su sitio." : `Las otras ${enSuSitio} ya están en su sitio.`}</p>
        )}
      </div>
    </Sheet>
  );
}
