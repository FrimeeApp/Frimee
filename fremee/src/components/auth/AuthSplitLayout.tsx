"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-surface">
      <div className="grid h-full grid-cols-4 gap-0 overflow-hidden min-[1025px]:grid-cols-12">
        <section className="relative hidden overflow-hidden bg-primary-token text-contrast-token min-[1025px]:col-span-6 min-[1025px]:block min-[1025px]:h-full">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[-12%] top-[-8%] h-[260px] w-[260px] rounded-full bg-white/10 blur-3xl" />
            <div className="absolute right-[-14%] top-[18%] h-[220px] w-[220px] rounded-full bg-[#111827]/18 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-[#0a1510]/22 to-transparent" />
          </div>

          <div className="relative z-20 flex h-full flex-col px-[clamp(28px,4vw,56px)] pb-[var(--space-24)] pt-[var(--space-6)] md:px-[clamp(40px,5vw,72px)] md:pt-[var(--space-8)] lg:px-[clamp(52px,5.5vw,88px)]">
            <div className="shrink-0 pb-[var(--space-6)]">
              <div className="invisible w-full max-w-[420px] text-center text-[1.5rem] leading-none">Frimee</div>
            </div>
            <div className="flex flex-1 items-start">
              <div className="w-full px-[clamp(36px,7vw,88px)]">
                <div className="mx-auto flex min-h-[320px] max-w-[430px] flex-col justify-start md:min-h-[360px] lg:min-h-[400px]">
                  <div className="relative left-1/2 w-[min(540px,calc(100%+112px))] -translate-x-1/2">
                    <h1 className="[font-family:var(--font-display-face)] text-[clamp(2.3rem,4vw,4rem)] leading-[1.02] tracking-[-0.015em] text-white dark:text-[#102018]">
                      Organiza mejor.
                      <span className="mt-[22px] block font-sans text-[clamp(1.2rem,1.8vw,1.55rem)] font-[var(--fw-medium)] leading-[1.28] tracking-[-0.02em] text-white/88 dark:text-[#102018]/82">
                        Comparte planes, gastos y decisiones sin fricción.
                      </span>
                    </h1>
                  </div>
                  <div className="mt-[calc(var(--space-8)+96px)]">
                    <div className="relative left-1/2 w-[min(540px,calc(100%+112px))] -translate-x-1/2 pb-[34px]">
                      <div className="overflow-hidden rounded-[16px] border border-white/18 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
                        <Image
                          src="/mapa.png"
                          alt="Mapa de ruta del plan"
                          width={798}
                          height={580}
                          className="h-auto w-full object-cover"
                          priority
                        />
                      </div>

                      <div className="absolute bottom-0 left-1/2 w-[calc(100%-40px)] -translate-x-1/2 rounded-[18px] bg-[linear-gradient(90deg,rgba(255,255,255,0.88),rgba(255,255,255,0.76)_56%,rgba(84,215,255,0.52))] px-[20px] py-[14px] font-sans text-[#111827] shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-md dark:bg-[linear-gradient(90deg,rgba(243,248,245,0.94),rgba(243,248,245,0.86)_56%,rgba(84,215,255,0.34))]">
                        <div className="flex items-center gap-[14px]">
                          <div className="flex items-center justify-center text-[#111827]">
                            <MapPin className="size-[20px]" strokeWidth={2.2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[1.02rem] font-[var(--fw-semibold)] leading-none">Tu siguiente plan empieza YA.</p>
                            <p className="mt-[3px] text-[0.78rem] leading-none text-[#111827]/68">Creado por Frimee</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </section>

        <main className="col-span-full overflow-hidden bg-surface min-[1025px]:col-span-6">
          <div className="flex h-full flex-col px-[max(var(--space-5),env(safe-area-inset-left))] pb-[var(--space-8)] pt-[var(--space-6)] min-[800px]:py-[var(--space-8)] lg:px-[clamp(44px,4vw,72px)]">
            <div className="sticky top-[max(var(--space-12),env(safe-area-inset-top))] z-10 flex justify-center pb-[var(--space-6)]">
              <div className="w-full max-w-[420px] text-center [font-family:var(--font-display-face)] text-[1.95rem] leading-none text-primary-token">
                Frimee
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
