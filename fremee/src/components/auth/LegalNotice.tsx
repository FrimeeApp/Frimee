import Link from "next/link";

/** Footer of the auth screens: links to the Terms and the Privacy Policy. */
export default function LegalNotice() {
  return (
    <p className="mt-auto pb-[max(var(--space-2),env(safe-area-inset-bottom))] pt-[var(--space-4)] text-center text-caption text-tertiary min-[800px]:pt-[var(--space-8)]">
      Al continuar, aceptas los{" "}
      <Link href="/terminos-y-condiciones" className="font-[var(--fw-semibold)] text-muted underline-offset-2 hover:underline">
        Términos y Condiciones
      </Link>
      <br />y la{" "}
      <Link href="/politica-de-privacidad" className="font-[var(--fw-semibold)] text-muted underline-offset-2 hover:underline">
        Política de Privacidad
      </Link>{" "}
      de Frimee
    </p>
  );
}
