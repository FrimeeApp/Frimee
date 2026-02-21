import type { ReactNode } from "react";
import Image from "next/image";

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-[var(--color-bg-app)]">
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[46%_54%]">
        {/* LEFT / BRAND PANEL */}
        <section className="relative hidden overflow-hidden bg-[var(--color-bg-brand)] text-white lg:block lg:h-dvh">
          {/* Top brand */}
          <div className="absolute left-0 top-0 z-10 w-full px-10 pt-12 lg:px-20 lg:pt-14">
            <div className="text-4xl font-medium tracking-tight text-white/80">
              Frimee
            </div>
          </div>

          {/* Copy block */}
          <div className="relative z-20 flex min-h-[480px] flex-col justify-center px-10 pb-52 pt-24 lg:min-h-dvh lg:px-20 lg:pb-56 lg:pt-24">
            <h1 className="max-w-xl text-3xl font-semibold leading-[1.24] tracking-tight lg:text-[50px]">
              <span className="block text-white">Organiza.</span>
              <span className="block whitespace-nowrap text-[var(--color-bg-brand-muted)]">
                Sin preocupaciones.
              </span>
              <span className="block text-white">Comparte.</span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-7 text-white/80">
              Coordina viajes, gastos y actividades en un solo lugar <br />
              para que tu grupo avance sin caos
            </p>
          </div>

          {/* Plane illustration (bottom, anchored to section edge) */}
          <div className="pointer-events-none absolute bottom-0 left-0 z-10 h-[240px] w-full lg:h-[360px]">
            <PlaneSwoosh />
          </div>
        </section>

        {/* RIGHT / CONTENT SLOT */}
        <main className="flex min-h-dvh items-start bg-[var(--color-bg-auth-main)] px-7 pb-8 pt-6 lg:items-center lg:justify-center lg:px-16 lg:py-8">
          <div className="w-full max-w-md">{children}</div>
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
