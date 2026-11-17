import Link from "next/link";

/**
 * Lo que debe leer quien llega a frimee.es sin conocer la app (y Google, para el inicio de sesión
 * con su cuenta): qué es Frimee, qué datos usa y las páginas legales. Va en el HTML del servidor,
 * fuera del formulario, que se pinta en el navegador.
 */
export default function PublicInfo() {
  return (
    <footer className="shrink-0 px-[max(var(--space-5),env(safe-area-inset-left))] pb-[max(var(--space-4),env(safe-area-inset-bottom))] pt-[var(--space-2)] text-center text-caption text-tertiary">
      <p className="mx-auto max-w-[420px]">
        Frimee reúne en un solo plan las actividades de cada día, la ruta en el mapa, los gastos
        compartidos, las fotos del viaje y el chat del grupo. Si entras con Google, solo usa tu
        nombre, tu email y tu foto de perfil para crear tu cuenta.
      </p>
      <nav aria-label="Información legal" className="mt-[var(--space-2)] flex flex-wrap justify-center gap-x-[var(--space-4)] gap-y-[var(--space-1)]">
        <Link href="/politica-de-privacidad" className="underline underline-offset-2">Política de privacidad</Link>
        <Link href="/terminos-y-condiciones" className="underline underline-offset-2">Términos y condiciones</Link>
        <Link href="/politica-de-cookies" className="underline underline-offset-2">Política de cookies</Link>
      </nav>
    </footer>
  );
}
