import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Scroll position of a story made of steps. Each step element registers with `register(i)`.
 * The active step is the last one whose top has crossed the anchor line (a fraction of the
 * viewport, measured below `cover` when it is a full-width sticky element on top, like the map
 * on phones; beside the story on desktop it takes no height). `t` is how far the anchor line is
 * through the active step (0–1), which drives movement along a leg.
 *
 * Only `index` is React state (the page re-renders when the step changes). The continuous
 * position goes to `onMeasure` on every frame, for the parts that move (map, progress bars).
 */
export function useScrollSteps(
  count: number,
  anchor: number,
  cover: RefObject<HTMLElement | null>,
  onMeasure: (index: number, t: number) => void,
) {
  const elements = useRef<(HTMLElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  const onMeasureRef = useRef(onMeasure);
  useEffect(() => {
    onMeasureRef.current = onMeasure;
  }, [onMeasure]);

  const register = useCallback((i: number) => (el: HTMLElement | null) => {
    elements.current[i] = el;
  }, []);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const coverRect = cover.current?.getBoundingClientRect();
      const topInset = coverRect && coverRect.width > window.innerWidth * 0.8 ? Math.max(0, coverRect.bottom) : 0;
      const line = topInset + (window.innerHeight - topInset) * anchor;
      let active = 0;
      let t = 0;
      for (let i = 0; i < count; i++) {
        const rect = elements.current[i]?.getBoundingClientRect();
        if (!rect) continue;
        if (rect.top <= line) {
          active = i;
          t = rect.height > 0 ? Math.min(1, Math.max(0, (line - rect.top) / rect.height)) : 1;
        }
      }
      onMeasureRef.current(active, t);
      setIndex((prev) => (prev === active ? prev : active));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [count, anchor, cover]);

  return { index, register };
}
