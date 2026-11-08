"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 1400;

/** easeOutCubic: fast start, gentle landing on the final number. */
const ease = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts from 0 up to `value` once `start` turns true. With reduced motion it shows the
 * final number straight away. The text is always the formatted final value for screen readers.
 */
export function CountUp({ value, format, start }: { value: number; format: (n: number) => string; start: boolean }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!start) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - t0) / DURATION_MS);
      setShown(value * ease(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, value]);

  return (
    <>
      <span aria-hidden>{format(start ? shown : 0)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
