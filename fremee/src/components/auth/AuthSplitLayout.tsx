import type { ReactNode } from "react";
import Image from "next/image";

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-surface">
      <div className="grid h-full grid-cols-4 gap-0 overflow-hidden min-[800px]:grid-cols-8 lg:grid-cols-12">
        {/* LEFT / BRAND PANEL */}
        <section className="relative hidden overflow-hidden bg-primary-token text-contrast-token min-[800px]:col-span-4 min-[800px]:block min-[800px]:h-full lg:col-span-5">
          <div className="relative z-20 h-full px-safe pb-[var(--space-24)] pt-[var(--space-10)] md:pt-[var(--space-12)] lg:pt-[var(--space-14)]">
            {/* Top brand */}
            <div className="md:pl-[25%] lg:pl-[20%]">
              <div className="text-[var(--font-h1)] font-[var(--fw-semibold)] leading-[var(--lh-h1)] tracking-tight text-contrast-token opacity-85">
                Frimee
              </div>
            </div>

            {/* Copy block */}
            <div className="mt-[11vh] md:mt-[12vh] md:pl-[25%] lg:mt-[7vh] lg:pl-[20%]">
              <div className="md:w-[72%] lg:w-[82%]">
                <h1 className="text-[clamp(2.35rem,5vw,3.125rem)] font-[var(--fw-semibold)] leading-[1.2] tracking-tight text-contrast-token">
                  <span className="block">Organiza.</span>
                  <span className="block opacity-80">Sin preocupaciones.</span>
                  <span className="block">Comparte.</span>
                </h1>

                <p className="mt-[var(--space-6)] w-full text-body text-contrast-token opacity-80">
                  Coordina viajes, gastos y actividades en un solo lugar para que tu grupo avance sin caos
                </p>
              </div>
            </div>
          </div>

          {/* Plane illustration (bottom, anchored to section edge) */}
          <div className="pointer-events-none absolute bottom-0 left-0 z-10 h-[240px] w-full lg:h-[360px]">
            <PlaneSwoosh />
          </div>
        </section>

        {/* RIGHT / CONTENT SLOT */}
        <main className="col-span-full overflow-hidden bg-surface min-[800px]:col-span-4 lg:col-span-7">
          <div className="grid h-full grid-cols-4 gap-0 px-safe pb-[var(--space-8)] pt-[var(--space-6)] min-[800px]:grid-cols-4 min-[800px]:py-[var(--space-8)] lg:grid-cols-7">
            <div className="col-span-full min-[800px]:col-span-4 lg:col-span-4 lg:col-start-2">
              <div className="flex h-full w-full justify-center">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function PlaneSwoosh() {
  return (
    <Image
      src="/plane-swoosh.svg"
      alt=""
      fill
      className="origin-left scale-x-110 object-contain object-left-bottom lg:scale-x-150"
    />
  );
}
