"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CloseX } from "@/components/ui/CloseX";

type ImageLightboxProps = {
  url: string;
  imageUrls: string[];
  onClose: () => void;
};

export function ImageLightbox({ url, imageUrls, onClose }: ImageLightboxProps) {
  const [current, setCurrent] = useState(url);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const idx = imageUrls.indexOf(current);
  const hasPrev = idx > 0;
  const hasNext = idx < imageUrls.length - 1;

  useEffect(() => {
    setCurrent(url);
  }, [url]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) setCurrent(imageUrls[idx - 1]);
      if (e.key === "ArrowRight" && hasNext) setCurrent(imageUrls[idx + 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasNext, hasPrev, idx, imageUrls, onClose]);

  useEffect(() => {
    const el = thumbsRef.current?.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ inline: "center", behavior: "smooth" });
  }, [idx]);

  const goPrev = () => {
    if (hasPrev) setCurrent(imageUrls[idx - 1]);
  };

  const goNext = () => {
    if (hasNext) setCurrent(imageUrls[idx + 1]);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const touch = event.changedTouches[0];

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (startX == null || startY == null) return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const horizontalThreshold = 48;
    const verticalAllowance = 32;

    if (Math.abs(deltaX) < horizontalThreshold || Math.abs(deltaY) > verticalAllowance) return;

    if (deltaX < 0) {
      goNext();
      return;
    }

    goPrev();
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black" onClick={onClose}>
      <div
        className="flex shrink-0 items-center justify-end px-3 pb-3 pt-[max(12px,calc(env(safe-area-inset-top)+12px))]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="rounded-full p-2 text-white hover:bg-white/10">
          <CloseX className="size-6" />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {hasPrev && (
          <button type="button" onClick={goPrev} className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <ChevronLeft className="size-6" aria-hidden />
          </button>
        )}
        <Image src={current} alt="Imagen" width={1600} height={1200} className="max-h-full max-w-full object-contain" unoptimized referrerPolicy="no-referrer" />
        {hasNext && (
          <button type="button" onClick={goNext} className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <ChevronRight className="size-6" aria-hidden />
          </button>
        )}
      </div>

      {imageUrls.length > 1 && (
        <div
          ref={thumbsRef}
          className="flex shrink-0 gap-2 overflow-x-auto scrollbar-hide px-0 pt-3 pb-[max(12px,calc(env(safe-area-inset-bottom)+12px))]"
          style={{ paddingInline: "calc(50% - 28px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {imageUrls.map((imageUrl, imageIndex) => (
            <button
              key={imageUrl}
              type="button"
              onClick={() => setCurrent(imageUrl)}
              className={`shrink-0 overflow-hidden rounded-[6px] border-2 transition-all ${imageUrl === current ? "border-white" : "border-transparent opacity-50 hover:opacity-80"}`}
              style={{ width: 56, height: 56 }}
            >
              <Image src={imageUrl} alt={`Imagen ${imageIndex + 1}`} width={56} height={56} className="size-full object-cover" unoptimized referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
