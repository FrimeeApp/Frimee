import Navbar from "@/components/landing/Navbar";
import LandingV2Hero from "@/components/landingv2/LandingV2Hero";
import LandingV2Shell from "@/components/landingv2/LandingV2Shell";

const productCards = [
  {
    title: "Organiza",
    body: "Bloque base para desarrollar copy, capturas, animaciones o casos de uso de la nueva landing.",
  },
  {
    title: "Decide",
    body: "Bloque base para desarrollar copy, capturas, animaciones o casos de uso de la nueva landing.",
  },
  {
    title: "Comparte",
    body: "Bloque base para desarrollar copy, capturas, animaciones o casos de uso de la nueva landing.",
  },
];

const flowSteps = ["Crear el viaje", "Invitar al grupo", "Votar fechas", "Cerrar gastos"];

export default function LandingV2() {
  return (
    <LandingV2Shell>
      <main className="landing-page landing-v2-page min-h-dvh bg-[#fbfbfa] text-[var(--text-primary)] dark:bg-[#161616]">
        <Navbar />
        <LandingV2Hero />

        <section id="producto" className="relative z-10 border-y border-black/10 bg-transparent px-5 py-16 dark:border-white/10 sm:px-8">
          <div className="mx-auto grid w-full max-w-7xl gap-8 md:grid-cols-3">
            {productCards.map((card, index) => (
              <article
                key={card.title}
                data-landing-v2-reveal
                style={{ transitionDelay: `${index * 90}ms` }}
                className="rounded-[1.5rem] border border-black/10 bg-white/35 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
              >
                <span className="text-sm font-semibold text-[#20a769]">0{index + 1}</span>
                <h2 className="mt-5 text-3xl font-semibold tracking-normal">{card.title}</h2>
                <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="flujo" className="px-5 py-20 sm:px-8">
          <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div data-landing-v2-reveal>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Flujo</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
                Espacio listo para probar narrativa y scroll.
              </h2>
            </div>
            <div className="grid gap-3">
              {flowSteps.map((step, index) => (
                <div
                  key={step}
                  data-landing-v2-reveal
                  style={{ transitionDelay: `${index * 80}ms` }}
                  className="flex items-center justify-between border-b border-black/10 py-5 dark:border-white/10"
                >
                  <span className="text-xl font-medium">{step}</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#20a769]" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="app" className="px-5 pb-20 sm:px-8">
          <div
            data-landing-v2-reveal
            className="mx-auto flex min-h-[360px] w-full max-w-7xl items-end overflow-hidden rounded-[2rem] bg-neutral-950 p-8 text-white dark:bg-neutral-100 dark:text-neutral-950 sm:p-10"
          >
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/44 dark:text-black/44">
                Siguiente iteración
              </p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
                Aquí puedes montar una demo más visual sin tocar la landing original.
              </h2>
            </div>
          </div>
        </section>
      </main>
    </LandingV2Shell>
  );
}
