import type { ReactNode } from "react";
import Link from "next/link";

export type LegalSection = { title: string; body: ReactNode };

/** Shared layout for the Terms and the Privacy Policy: readable column, numbered sections. */
export default function LegalDocument({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-dvh bg-app px-[var(--page-margin-x,16px)] pb-[max(var(--space-8),env(safe-area-inset-bottom))] pt-[max(var(--space-6),env(safe-area-inset-top))] text-app">
      <article className="mx-auto w-full max-w-[720px]">
        <Link href="/login" className="text-body-sm font-[var(--fw-semibold)] text-muted hover:text-app">
          ← Frimee
        </Link>
        <h1 className="mt-[var(--space-4)] font-sans text-[28px] font-[var(--fw-semibold)] leading-tight">{title}</h1>
        <p className="mt-[var(--space-2)] text-body-sm text-muted">Última actualización: {updated}</p>
        <div className="mt-[var(--space-6)] space-y-[var(--space-3)] text-body leading-7 text-muted">{intro}</div>
        {sections.map((section, index) => (
          <section key={section.title} className="mt-[var(--space-8)]">
            <h2 className="font-sans text-[19px] font-[var(--fw-semibold)] text-app">
              {index + 1}. {section.title}
            </h2>
            <div className="mt-[var(--space-3)] space-y-[var(--space-3)] text-body leading-7 text-muted">
              {section.body}
            </div>
          </section>
        ))}
        <nav className="mt-[var(--space-10,48px)] flex flex-wrap gap-x-[var(--space-4)] gap-y-[var(--space-2)] border-t border-app pt-[var(--space-4)] text-body-sm">
          <Link href="/terminos-y-condiciones" className="text-muted underline-offset-4 hover:underline">Términos y Condiciones</Link>
          <Link href="/politica-de-privacidad" className="text-muted underline-offset-4 hover:underline">Política de Privacidad</Link>
          <a href="mailto:contact@frimee.es" className="text-muted underline-offset-4 hover:underline">contact@frimee.es</a>
        </nav>
      </article>
    </main>
  );
}

/** A list inside a legal section. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-[var(--space-1)] pl-[1.25rem]">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}
