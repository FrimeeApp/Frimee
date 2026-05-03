import Link from "next/link";
import { MapPin } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary-token/10">
        <MapPin className="size-8 text-primary-token" aria-hidden />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-[var(--fw-semibold)] text-heading-sm text-app">
          Página no encontrada
        </h1>
        <p className="max-w-xs text-body-sm text-muted">
          Esta página no existe o ha sido movida.
        </p>
      </div>

      <Link
        href="/calendar"
        className="rounded-[var(--radius-button)] bg-primary-token px-5 py-2.5 text-body-sm text-white transition-opacity hover:opacity-90"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
