"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Up to 9 people per page; more go to the next page (M9e, D9e). */
export const PAGE_SIZE = 9;

/**
 * Grid for n tiles (design rule): 2 = halves · 3–4 = 2×2 · 5–6 = 2×3 standing, 3×2 lying ·
 * 7–9 = 3×3.
 */
export function gridShape(n: number, landscape: boolean): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return landscape ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return landscape ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
  return { cols: 3, rows: 3 };
}

export function paginate<T>(items: T[], size = PAGE_SIZE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages.length > 0 ? pages : [[]];
}

/** The size of an element, kept up to date (ResizeObserver). */
export function useElementSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    observerRef.current = observer;
  }, []);
  useEffect(() => () => observerRef.current?.disconnect(), []);
  return [ref, size] as const;
}

/**
 * Height of the bottom safe area (Android's buttons, the iPhone's home bar) in px: CSS knows it as
 * env(safe-area-inset-bottom); the room needs it in numbers to place your camera and the grid.
 */
export function useSafeAreaBottom() {
  const [bottom, setBottom] = useState(0);
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;bottom:0;height:0;padding-bottom:env(safe-area-inset-bottom)";
    document.body.appendChild(probe);
    const read = () => setBottom(parseFloat(getComputedStyle(probe).paddingBottom) || 0);
    read();
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("resize", read);
      probe.remove();
    };
  }, []);
  return bottom;
}

export function firstName(nombre: string) {
  return nombre.trim().split(/\s+/)[0] || nombre;
}
