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

type Props = {
  planId: number;
  currentUserId: string;
  isMember: boolean;
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4">
      <path d="M3 6H21M8 6V4H16V6M19 6L18 20H6L5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlaneEmptyIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="size-12 text-muted opacity-40">
      <path d="M42 32V28L26 18V7C26 5.34 24.66 4 23 4C21.34 4 20 5.34 20 7V18L4 28V32L20 27V38L16 41V44L23 42L30 44V41L26 38V27L42 32Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function PlanFotosTab({ planId, currentUserId, isMember }: Props) {
  const [fotos, setFotos] = useState<PlanFotoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
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
  }, [planId]);

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
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="px-[var(--page-margin-x)] pt-5 pb-8">
        <div className="columns-2 sm:columns-3 gap-2 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="break-inside-avoid aspect-square w-full animate-pulse rounded-xl bg-[var(--surface-raised)]"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-[var(--page-margin-x)] pt-5 pb-8">
      {/* Upload button */}
      {isMember && (
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-full border border-app px-4 h-9 text-[13px] font-[600] text-app transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
          >
            <PlusIcon />
            {uploading ? "Subiendo…" : "Añadir fotos"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
        </div>
      )}

      {/* Grid or empty state */}
      {fotos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <PlaneEmptyIcon />
          <p className="text-[14px] font-[600] text-muted">Aún no hay fotos</p>
          {isMember && (
            <p className="text-[13px] text-muted opacity-70">¡Sube la primera foto del plan!</p>
          )}
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 gap-2 space-y-2">
          {fotos.map((foto) => {
            const isOwn = foto.userId === currentUserId;
            const isDeleting = deletingId === foto.id;
            const isHovered = hoveredId === foto.id;

            return (
              <div
                key={foto.id}
                className="break-inside-avoid relative overflow-hidden rounded-xl"
                onMouseEnter={() => isOwn && setHoveredId(foto.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="relative w-full aspect-square">
                  <Image
                    src={foto.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                  {/* Delete overlay — own photo only */}
                  {isOwn && (isHovered || isDeleting) && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity">
                      <button
                        onClick={() => void handleDelete(foto)}
                        disabled={isDeleting}
                        className="flex items-center justify-center size-9 rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-red-500/80 transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
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
      )}
    </div>
  );
}
