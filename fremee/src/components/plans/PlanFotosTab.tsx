"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { uploadPlanAlbumFile } from "@/services/firebase/upload";
import {
  getPlanFotos,
  addPlanFoto,
  removePlanFoto,
  type PlanFotoDto,
} from "@/services/api/repositories/plan-fotos.repository";
import { Plus, Trash2, Plane, Loader2 } from "lucide-react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { DEMO_PHOTO_CREDITS } from "@/config/demo-photos";

/** Author and licence of an example-trip photo (Wikimedia Commons); real uploads have none. */
function DemoPhotoCaption({ url }: { url: string }) {
  const credit = DEMO_PHOTO_CREDITS[url];
  if (!credit) return null;
  return (
    <>
      Foto:{" "}
      <a href={credit.fuente} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        {credit.autor}
      </a>{" "}
      ·{" "}
      {credit.licenciaUrl ? (
        <a href={credit.licenciaUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {credit.licencia}
        </a>
      ) : (
        credit.licencia
      )}
    </>
  );
}

type Props = {
  planId: number;
  currentUserId: string;
  isMember: boolean;
  refreshKey?: number;
};

const PlusIcon = () => <Plus className="size-5" aria-hidden />;
const TrashIcon = () => <Trash2 className="size-4" aria-hidden />;
const PlaneEmptyIcon = () => <Plane className="size-12 text-muted opacity-40" aria-hidden />;

export default function PlanFotosTab({ planId, currentUserId, isMember, refreshKey = 0 }: Props) {
  const [fotos, setFotos] = useState<PlanFotoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPlanFotos({ planId })
      .then((data) => {
        if (!cancelled) setFotos(data);
      })
      .catch((e) => console.error("[PlanFotosTab]", e?.code, e?.message, e?.details, e?.hint))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [planId, refreshKey]);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";

    setUploading(true);
    try {
      const uploads = await Promise.all(
        files.map(async (file) => {
          const { filePath, downloadUrl } = await uploadPlanAlbumFile({ file, planId });
          return addPlanFoto({
            planId,
            userId: currentUserId,
            url: downloadUrl,
            storagePath: filePath,
          });
        })
      );
      setFotos((prev) => [...uploads, ...prev]);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(foto: PlanFotoDto) {
    if (foto.userId !== currentUserId) return;
    setDeletingId(foto.id);
    try {
      await removePlanFoto({ id: foto.id, userId: currentUserId });
      setFotos((prev) => prev.filter((f) => f.id !== foto.id));
      setLightboxUrl((prev) => (prev === foto.url ? null : prev));
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="px-[var(--page-margin-x)] pt-5 pb-8">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square w-full animate-pulse rounded-xl bg-[var(--surface-2)]"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-[var(--page-margin-x)] pt-5 pb-8">
      {isMember && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {/* Add tile: first square of the grid, like "Añadir actividad" lives inside the itinerary. */}
          {isMember && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-app text-muted transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-wait"
            >
              {uploading ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <PlusIcon />}
              <span className="text-[14px] font-[600]">{uploading ? "Subiendo..." : "Añadir fotos"}</span>
            </button>
          )}
          {fotos.map((foto) => {
            const isOwn = foto.userId === currentUserId;
            const isDeleting = deletingId === foto.id;
            const isHovered = hoveredId === foto.id;

            return (
              <div
                key={foto.id}
                className="relative overflow-hidden rounded-xl"
                onMouseEnter={() => isOwn && setHoveredId(foto.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setLightboxUrl(foto.url)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setLightboxUrl(foto.url);
                    }
                  }}
                  className="relative block w-full aspect-square cursor-pointer"
                >
                  <FotoImage src={foto.url} />
                  {isOwn && (isHovered || isDeleting) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(foto);
                        }}
                        disabled={isDeleting}
                        className="flex size-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-red-500/80 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <TrashIcon />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Members already see the add tile; the empty message is for everyone else. */}
      {fotos.length === 0 && !isMember && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <PlaneEmptyIcon />
          <p className="text-[14px] font-[600] text-muted">Aún no hay fotos</p>
        </div>
      )}

      {fotos.some((foto) => DEMO_PHOTO_CREDITS[foto.url]) && (
        <p className="mt-[var(--space-3)] text-[12px] text-tertiary">
          Fotos de ejemplo de Wikimedia Commons; al abrir cada una verás su autor y licencia.
        </p>
      )}

      {lightboxUrl && (
        <ImageLightbox
          url={lightboxUrl}
          imageUrls={fotos.map((foto) => foto.url)}
          onClose={() => setLightboxUrl(null)}
          caption={(url) => (DEMO_PHOTO_CREDITS[url] ? <DemoPhotoCaption url={url} /> : null)}
        />
      )}
    </div>
  );
}

/** Photo tile: a pulsing placeholder until the full-size image arrives, then a short fade-in. */
function FotoImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-[var(--surface-2)]" aria-hidden />}
      <Image
        src={src}
        alt=""
        fill
        className={`object-cover transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
        sizes="(max-width: 640px) 50vw, 33vw"
        unoptimized
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </>
  );
}
