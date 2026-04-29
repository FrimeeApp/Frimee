import Link from "next/link";
import FlipWords from "@/components/ui/FlipWords";
import GlobeHero from "@/components/landingv2/GlobeHero";

export default function LandingV2Hero() {
  return (
    <section className="relative z-20 flex h-[100dvh] min-h-[680px] overflow-visible px-5 pt-24 sm:px-8 sm:pt-28 lg:pt-32">
      <div className="pointer-events-none relative z-40 mx-auto flex w-full max-w-7xl flex-col items-center">
        <div className="pointer-events-auto mx-auto mt-20 max-w-5xl text-center sm:mt-24 lg:mt-32 xl:mt-36">
          <h1
            data-landing-v2-reveal
            className="[font-family:var(--font-sans)] text-4xl font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-6xl lg:text-7xl xl:whitespace-nowrap"
          >
            Planifica mejor. Sin{" "}
            <FlipWords
              words={["caos", "ruido", "fricción"]}
              intervalMs={3200}
              className="[font-family:var(--font-display-face)] py-[0.08em] font-normal text-[var(--primary)]"
            />
          </h1>
          <p
            data-landing-v2-reveal
            style={{ transitionDelay: "110ms" }}
            className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:mt-5 sm:text-lg sm:leading-8"
          >
            Organiza viajes en grupo, comparte planes y conecta con amigos en una red social todo en uno.
          </p>
          <div
            data-landing-v2-reveal
            style={{ transitionDelay: "190ms" }}
            className="mt-5 flex flex-col justify-center gap-3 sm:mt-6 sm:flex-row"
          >
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 dark:text-black"
            >
              Empezar gratis
            </Link>
            <Link
              href="#producto"
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-6 py-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              Ver el producto
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-1/2 z-30 w-screen -translate-x-1/2 translate-y-[58%]">
        <GlobeHero className="mx-auto" />
      </div>
    </section>
  );
}
