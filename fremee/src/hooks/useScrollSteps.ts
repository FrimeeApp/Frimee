import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Which step of a story is on screen. Each step element registers with `register(i)`; the
 * page moves one step at a time (useStepPaging), so the active step is the last one whose
 * top has reached the line (`line()`, in px from the top of the viewport: below the sticky
 * map and header). How a step plays out is up to the page, not the scroll speed.
 *
 * `index` is React state (the page re-renders when the step changes); `onStep` is called
 * once per change, before the re-render, for the parts that animate outside React.
 */
export function useScrollSteps(count: number, line: () => number, onStep: (index: number) => void) {
  const elements = useRef<(HTMLElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  const onStepRef = useRef(onStep);
  const lineRef = useRef(line);
  useEffect(() => {
    onStepRef.current = onStep;
    lineRef.current = line;
  }, [onStep, line]);

  const register = useCallback((i: number) => (el: HTMLElement | null) => {
    elements.current[i] = el;
  }, []);

  useEffect(() => {
    let frame = 0;
    let current = -1;
    const measure = () => {
      frame = 0;
      // A few px of slack: a snapped step sits exactly on the line.
      const at = lineRef.current() + 8;
      let active = 0;
      for (let i = 0; i < count; i++) {
        const rect = elements.current[i]?.getBoundingClientRect();
        if (rect && rect.top <= at) active = i;
      }
      if (active === current) return;
      current = active;
      onStepRef.current(active);
      setIndex(active);
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
  }, [count]);

  const steps = useCallback(() => elements.current, []);
  return { index, register, steps };
}
