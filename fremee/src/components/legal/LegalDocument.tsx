import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Shared layout for the Terms and the Privacy Policy: a readable column in the app's style.
 * The text comes in as children, exactly as reviewed (see the pages).
 */
export default function LegalDocument({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-app px-[var(--page-margin-x,16px)] pb-[max(var(--space-8),env(safe-area-inset-bottom))] pt-[max(var(--space-6),env(safe-area-inset-top))] text-app">
      <article className="mx-auto w-full max-w-[720px] text-body leading-7 text-muted">
        <Link href="/login" className="text-body-sm font-[var(--fw-semibold)] text-muted hover:text-app">
          ← Frimee
        </Link>
        <h1 className="mt-[var(--space-4)] font-sans text-[28px] font-[var(--fw-semibold)] leading-tight text-app">{title}</h1>
        <p className="mt-[var(--space-2)] text-body-sm text-muted">Última actualización: {updated}</p>
        <div className="mt-[var(--space-6)]">{children}</div>
        <nav className="mt-[var(--space-10,48px)] flex flex-wrap gap-x-[var(--space-4)] gap-y-[var(--space-2)] border-t border-app pt-[var(--space-4)] text-body-sm">
          <Link href="/terminos-y-condiciones" className="text-muted underline-offset-4 hover:underline">Términos y Condiciones</Link>
          <Link href="/politica-de-privacidad" className="text-muted underline-offset-4 hover:underline">Política de Privacidad</Link>
          <a href="mailto:contact@frimee.es" className="text-muted underline-offset-4 hover:underline">contact@frimee.es</a>
        </nav>
      </article>
    </main>
  );
}
