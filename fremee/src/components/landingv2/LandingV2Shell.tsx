"use client";

import { useEffect, type ReactNode } from "react";
import { ReactLenis } from "lenis/react";

type LandingV2ShellProps = {
  children: ReactNode;
};

export default function LandingV2Shell({ children }: LandingV2ShellProps) {
  useEffect(() => {
    const revealElements = Array.from(document.querySelectorAll<HTMLElement>("[data-landing-v2-reveal]"));
    if (revealElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.12,
      },
    );

    revealElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return (
    <ReactLenis
      root
      options={{
        autoRaf: true,
        anchors: {
          offset: -88,
        },
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      }}
    >
      {children}
    </ReactLenis>
  );
}
