"use client";

import { useEffect, useState } from "react";

export default function LandingScrollIndicator() {
  const [progress, setProgress] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setIsScrollable(maxScroll > 1);
      setProgress(maxScroll > 0 ? window.scrollY / maxScroll : 0);
    };

    const requestUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  if (!isScrollable) return null;

  return (
    <div
      className="pointer-events-none fixed right-3 top-1/2 z-40 hidden h-28 w-px -translate-y-1/2 sm:block"
      aria-hidden="true"
    >
      <div
        className="absolute left-1/2 h-8 w-[2px] -translate-x-1/2 rounded-full bg-black/45 transition-colors duration-200 dark:bg-white/55"
        style={{ transform: `translate(-50%, ${progress * 80}px)` }}
      />
    </div>
  );
}
