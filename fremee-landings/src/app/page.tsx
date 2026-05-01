"use client";

import Link from "next/link";
import { ReactLenis } from "lenis/react";
import { APP_REGISTER_URL } from "@/config/links";
import GradualBlur from "@/components/landing/GradualBlur";
import LandingScrollIndicator from "@/components/landing/LandingScrollIndicator";
import LightRays from "@/components/landing/LightRays";
import Navbar from "@/components/landing/Navbar";
import FlipWords from "@/components/ui/FlipWords";

export default function LandingPage() {
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
      <main className="landing-page min-h-dvh bg-[#fbfbfa] text-[var(--text-primary)] dark:bg-[#161616]">
        <Navbar />
        <LandingScrollIndicator />
        <section className="relative min-h-[80dvh] overflow-hidden">
          <LightRays
            raysOrigin="top-center"
            raysColor="#f4f4f5"
            raysSpeed={1}
            lightSpread={0.5}
            rayLength={3}
            followMouse
            mouseInfluence={0.1}
            noiseAmount={0}
            distortion={0}
            className="custom-rays"
            pulsating={false}
            fadeDistance={1}
            saturation={1}
          />
          <div className="relative z-10 mx-auto flex min-h-[80dvh] w-full max-w-5xl flex-col px-6 pb-8 pt-24 sm:px-8">
            <div className="flex flex-1 items-center justify-center py-16">
              <div className="w-full max-w-5xl text-center">
                <h1 className="[font-family:var(--font-sans)] text-4xl font-semibold leading-tight tracking-tight sm:text-6xl md:whitespace-nowrap">
                  Planifica mejor. Sin{" "}
                  <FlipWords
                    words={["caos", "ruido", "fricción"]}
                    intervalMs={3200}
                    className="[font-family:var(--font-display-face)] py-[0.08em] font-normal text-[var(--primary)]"
                  />
                </h1>
                <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
                  Una web para presentar Frimee, explicar la app y llevar a los usuarios al producto cuando quieran
                  crear su cuenta.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href={APP_REGISTER_URL}
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
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-px bg-black/10 dark:bg-white/10" />
          <GradualBlur position="bottom" height="7rem" strength={1.5} divCount={4} opacity={1} />
        </section>
        <section
          id="producto"
          className="relative z-30 flex min-h-[70dvh] items-start bg-transparent px-6 py-16 text-[var(--text-primary)] sm:px-8"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-[minmax(0,1fr)_minmax(280px,340px)_minmax(0,1fr)] md:items-start">
            <div className="pointer-events-none z-20 w-[min(72vw,300px)] -translate-y-24 justify-self-center md:col-start-2 md:w-full md:-translate-y-36">
              <div className="rounded-[1.85rem] border border-black/12 bg-neutral-950 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] dark:border-white/12 dark:bg-neutral-100 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                <div className="relative aspect-[9/19] overflow-hidden rounded-[1.45rem] bg-[#f4f4f2] dark:bg-[#101010]">
                  <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-neutral-950 dark:bg-neutral-100" />
                  <div className="absolute inset-x-0 top-0 border-b border-black/8 bg-white/45 px-5 pb-3 pt-9 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/35">
                    <p className="text-center text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
                      Grupo Lisboa
                    </p>
                    <p className="mt-0.5 text-center text-[9px] font-medium text-neutral-400">
                      6 amigos · 38 mensajes
                    </p>
                  </div>
                  <div className="absolute inset-x-4 top-20 grid gap-2.5 text-[10.5px] leading-snug">
                    <div className="max-w-[84%] rounded-[1rem] rounded-bl-sm bg-white px-3 py-2 text-neutral-700 shadow-sm dark:bg-neutral-800 dark:text-neutral-200">
                      ¿Entonces pillamos vuelos hoy?
                    </div>
                    <div className="ml-auto max-w-[76%] rounded-[1rem] rounded-br-sm bg-neutral-950 px-3 py-2 text-white dark:bg-white dark:text-neutral-950">
                      Yo puedo del 12 al 15.
                    </div>
                    <div className="max-w-[88%] rounded-[1rem] rounded-bl-sm bg-white px-3 py-2 text-neutral-700 shadow-sm dark:bg-neutral-800 dark:text-neutral-200">
                      Espera, Paula no podía ese finde.
                    </div>
                    <div className="ml-auto max-w-[72%] rounded-[1rem] rounded-br-sm bg-neutral-950 px-3 py-2 text-white dark:bg-white dark:text-neutral-950">
                      ¿Y el hotel?
                    </div>
                    <div className="max-w-[86%] rounded-[1rem] rounded-bl-sm bg-white px-3 py-2 text-neutral-700 shadow-sm dark:bg-neutral-800 dark:text-neutral-200">
                      El link está más arriba, creo.
                    </div>
                    <div className="max-w-[78%] rounded-[1rem] rounded-bl-sm bg-white px-3 py-2 text-neutral-700 shadow-sm dark:bg-neutral-800 dark:text-neutral-200">
                      ¿Al final quién confirma?
                    </div>
                    <div className="ml-auto max-w-[82%] rounded-[1rem] rounded-br-sm bg-neutral-950 px-3 py-2 text-white dark:bg-white dark:text-neutral-950">
                      No sé qué se ha decidido.
                    </div>
                  </div>
                  <div className="absolute inset-x-4 bottom-5 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[10px] font-medium text-neutral-400 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-800/70">
                    Escribe un mensaje...
                  </div>
                </div>
              </div>
            </div>
            <div className="-mt-14 text-center md:col-start-3 md:mt-0 md:pt-20 md:text-left">
              <h2 className="text-3xl font-normal leading-tight tracking-tight sm:text-5xl">
                Siempre pasa lo mismo.
              </h2>
            </div>
          </div>
        </section>
        <section
          id="como-funciona"
          className="relative flex min-h-[70dvh] items-center bg-transparent px-6 py-20 text-[var(--text-primary)] sm:px-8"
        >
          <div className="mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <h2 className="text-3xl font-normal leading-tight tracking-tight sm:text-5xl">
                Todo en un solo lugar.
              </h2>
            </div>
            <div className="grid gap-4 text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
              <p>Fechas, ideas, decisiones y enlaces dejan de vivir perdidos en el chat.</p>
              <p>Esta sección es temporal para validar ritmo, scroll y composición antes del contenido final.</p>
            </div>
          </div>
        </section>
        <section
          id="demo"
          className="relative flex min-h-[70dvh] items-center bg-transparent px-6 py-20 text-[var(--text-primary)] sm:px-8"
        >
          <div className="mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <h2 className="text-3xl font-normal leading-tight tracking-tight sm:text-5xl">
                Menos mensajes. Más decisiones.
              </h2>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/35 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <p className="text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
                Placeholder de demo para probar cómo respira la landing con varias secciones y preparar el espacio
                donde después irá una vista más visual del producto.
              </p>
            </div>
          </div>
        </section>
        <section className="relative flex min-h-[90dvh] items-center overflow-hidden bg-transparent px-6 py-24 text-[var(--text-primary)] sm:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-4xl font-normal leading-tight tracking-tight sm:text-6xl">
                Un viaje. Todo conectado.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
                Placeholder visual para mostrar cómo gastos, mensajes y decisiones orbitan alrededor del viaje.
              </p>
            </div>
            <div className="landing-orbit-scene mt-12 min-h-[520px]" aria-hidden="true">
              <div className="landing-world">
                <span className="landing-world-dot dot-1" />
                <span className="landing-world-dot dot-2" />
                <span className="landing-world-dot dot-3" />
              </div>
              <div className="landing-orbit-token token-1">EUR</div>
              <div className="landing-orbit-token token-2">USD</div>
              <div className="landing-orbit-token token-3">Split</div>
              <div className="landing-orbit-token token-4">Hotel</div>
              <div className="landing-orbit-token token-5">Plan</div>
            </div>
          </div>
        </section>
        <section className="relative flex min-h-[90dvh] items-center overflow-hidden bg-transparent px-6 py-24 text-[var(--text-primary)] sm:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="landing-orbit-scene min-h-[620px]" aria-hidden="true">
              <div className="landing-world landing-world-sm">
                <span className="landing-world-dot dot-1" />
                <span className="landing-world-dot dot-2" />
                <span className="landing-world-dot dot-3" />
              </div>
              <div className="landing-feature-card card-1">
                <span>Mensaje nuevo</span>
                <strong>Confirmamos alojamiento?</strong>
              </div>
              <div className="landing-feature-card card-2">
                <span>Gasto compartido</span>
                <strong>Hotel: 84 por persona</strong>
              </div>
              <div className="landing-feature-card card-3">
                <span>Decisión pendiente</span>
                <strong>Votar fechas del viaje</strong>
              </div>
              <div className="landing-feature-card card-4">
                <span>Recordatorio</span>
                <strong>Comprar vuelos antes del viernes</strong>
              </div>
              <div className="landing-orbit-token token-1">EUR</div>
              <div className="landing-orbit-token token-4">Link</div>
            </div>
          </div>
        </section>
      </main>
    </ReactLenis>
  );
}
