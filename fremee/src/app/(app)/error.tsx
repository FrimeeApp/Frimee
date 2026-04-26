"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: Props) {
  const router = useRouter();

  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-[var(--error)]/10">
        <AlertTriangle className="size-8 text-[var(--error)]" aria-hidden />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-[var(--fw-semibold)] text-heading-sm text-app">
          Algo ha salido mal
        </h1>
        <p className="max-w-xs text-body-sm text-muted">
          Ha ocurrido un error inesperado. Puedes intentarlo de nuevo o volver al inicio.
        </p>
        {error.digest && (
          <p className="text-body-xs text-muted/60">Código: {error.digest}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-[var(--radius-button)] border border-app bg-surface px-4 py-2 text-body-sm text-app transition-colors hover:bg-surface-2"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 rounded-[var(--radius-button)] bg-primary-token px-4 py-2 text-body-sm text-white transition-colors hover:opacity-90"
        >
          <RefreshCw className="size-4" aria-hidden />
          Reintentar
        </button>
      </div>
    </div>
  );
}
