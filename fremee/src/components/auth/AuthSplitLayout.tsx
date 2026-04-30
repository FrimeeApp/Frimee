"use client";

import type { ReactNode } from "react";
import Image from "next/image";

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-surface min-[1025px]:fixed min-[1025px]:inset-0">
      <div className="grid min-h-[100dvh] grid-cols-4 gap-0 overflow-hidden min-[1025px]:h-full min-[1025px]:grid-cols-12">
        <section className="relative hidden overflow-hidden bg-primary-token text-contrast-token min-[1025px]:col-span-6 min-[1025px]:block min-[1025px]:h-full">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.16),transparent_42%),linear-gradient(0deg,rgba(10,21,16,0.18),transparent_48%)]" />
          </div>

          <div className="relative z-20 flex h-full flex-col px-[clamp(28px,4vw,56px)] pb-[var(--space-24)] pt-[var(--space-6)] md:px-[clamp(40px,5vw,72px)] md:pt-[var(--space-8)] lg:px-[clamp(52px,5.5vw,88px)]">
            <div className="shrink-0 pb-[var(--space-6)]">
              <div className="invisible w-full max-w-[420px] text-center text-[1.5rem] leading-none">Frimee</div>
            </div>
            <div className="flex flex-1 items-center">
              <div className="w-full px-[clamp(36px,7vw,88px)]">
                <div className="mx-auto flex w-full max-w-[520px] flex-col items-center justify-center gap-[clamp(2px,0.5vh,6px)]">
                  <div className="relative w-full px-[clamp(16px,3vw,32px)]">
                    <Image
                      src="/Frimee_personaje.png"
                      alt="Personaje de Frimee preparando un plan"
                      width={650}
                      height={780}
                      className="relative z-10 mx-auto h-auto max-h-[min(54vh,500px)] w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.18)]"
                      priority
                      unoptimized
                    />
                  </div>

                  <div className="mt-[clamp(-72px,-5.5vh,-34px)] w-full text-center">
                    <h1 className="font-sans text-[clamp(1.55rem,2.45vw,2.55rem)] font-[var(--fw-bold)] leading-[1.12] text-white dark:text-[#102018]">
                      Organiza tus planes
                      <span className="block">sin perder el hilo</span>
                    </h1>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </section>

        <main className="col-span-full flex min-h-[100dvh] flex-col bg-surface pt-[env(safe-area-inset-top)] min-[1025px]:col-span-6 min-[1025px]:h-full min-[1025px]:overflow-hidden">
          <div className="shrink-0 flex justify-center px-[max(var(--space-5),env(safe-area-inset-left))] pb-[var(--space-2)] pt-[var(--space-3)] min-[800px]:pt-[var(--space-6)] min-[800px]:pb-[var(--space-5)] lg:px-[clamp(44px,4vw,72px)]">
            <div className="flex w-full max-w-[420px] items-center justify-center gap-[8px] text-center [font-family:var(--font-display-face)] text-[1.45rem] leading-none text-primary-token min-[800px]:text-[1.7rem]">
              <Image
                src="/Frimee_personaje.png"
                alt=""
                width={52}
                height={62}
                className="h-[36px] w-auto object-contain min-[800px]:h-[40px] min-[1025px]:hidden"
                priority
                unoptimized
              />
              <span>Frimee</span>
            </div>
          </div>
          <div className="flex flex-1 items-start justify-center overflow-y-auto px-[max(var(--space-5),env(safe-area-inset-left))] pb-[max(var(--space-5),env(safe-area-inset-bottom))] pt-[var(--space-2)] min-[800px]:items-center min-[800px]:pb-[var(--space-8)] min-[800px]:pt-0 lg:px-[clamp(44px,4vw,72px)]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
