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

export function firstName(nombre: string) {
  return nombre.trim().split(/\s+/)[0] || nombre;
}
