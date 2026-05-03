"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function V3ScrollEffects() {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: false });
    let onLoad: (() => void) | null = null;

    const onRaf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onRaf);
    gsap.ticker.lagSmoothing(0);
    lenis.on("scroll", ScrollTrigger.update);

    const context = gsap.context(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const mockup = document.querySelector<HTMLElement>(".v3-hero-mockup");
      const shell = document.querySelector<HTMLElement>(".v3-hero-shell");

      if (mockup && shell) {
        ScrollTrigger.create({
          trigger: mockup,
          start: "bottom bottom",
          endTrigger: shell,
          end: "bottom bottom",
          pin: true,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        });
      }

      if (!reduceMotion) {
        gsap.set(".v3-story-copy", { autoAlpha: 0, y: 70 });

        gsap.utils.toArray<HTMLElement>(".v3-story-copy").forEach((item) => {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: item,
                start: "top 72%",
                end: "bottom 28%",
                scrub: 0.8,
              },
            })
            .to(item, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" })
            .to(item, { autoAlpha: 0, y: -70, duration: 0.35, ease: "power2.in" }, 0.65);
        });

        gsap.utils.toArray<HTMLElement>(".v3-animate-section").forEach((section) => {
          const children = gsap.utils.toArray<HTMLElement>(".v3-ac", section);
          if (!children.length) return;

          gsap.fromTo(
            children,
            { opacity: 0, y: 48, filter: "blur(4px)" },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              stagger: 0.09,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: section,
                start: "top 84%",
                toggleActions: "play none none none",
              },
            },
          );
        });
      }

      if (reduceMotion) {
        gsap.set(".v3-story-copy", { autoAlpha: 1, y: 0 });
      }

      ScrollTrigger.refresh();
      onLoad = () => ScrollTrigger.refresh();
      window.addEventListener("load", onLoad, { once: true });
    });

    return () => {
      context.revert();
      if (onLoad) {
        window.removeEventListener("load", onLoad);
      }
      lenis.destroy();
      gsap.ticker.remove(onRaf);
    };
  }, []);

  return null;
}
