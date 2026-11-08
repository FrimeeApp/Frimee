import { APP_GUEST_URL, APP_REGISTER_URL } from "@/config/links";

const buttonBase =
  "inline-flex h-11 items-center justify-center rounded-lg px-5 text-base font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 md:h-12";

/** Closing call to action. Replaced the waitlist section once the app opened to everyone. */
export default function StartSection() {
  return (
    <section className="v3-section v3-animate-section v3-waitlist-section">
      <div className="v3-waitlist-shell">
        <div className="mx-auto w-[min(100%-2rem,72rem)] py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="v3-ac mx-auto w-fit max-w-[16ch] text-center text-balance text-[clamp(2.5rem,5vw,5.5rem)] font-extrabold leading-[0.94]">
              Empieza a usar <span className="v3-brand-word">Frimee</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[30rem] text-pretty text-lg leading-7 text-[color:var(--v3-sub)]">
              Crea tu cuenta gratis o pruébala sin registrarte con un viaje de ejemplo.
            </p>
          </div>
          <div className="mx-auto mt-10 flex w-full max-w-[32rem] flex-col gap-3 sm:flex-row sm:justify-center md:mt-12">
            <a
              href={APP_REGISTER_URL}
              className={`${buttonBase} bg-black text-white hover:opacity-90 focus-visible:ring-black/30 dark:bg-white dark:text-black dark:focus-visible:ring-white/35`}
            >
              Crear cuenta gratis
            </a>
            <a
              href={APP_GUEST_URL}
              className={`${buttonBase} border border-black/15 text-[color:var(--v3-heading)] hover:bg-black/5 focus-visible:ring-black/20 dark:border-white/20 dark:hover:bg-white/10 dark:focus-visible:ring-white/20`}
            >
              Probar sin registro
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
