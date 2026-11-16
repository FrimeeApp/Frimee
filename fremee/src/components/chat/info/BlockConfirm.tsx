"use client";

import { useState } from "react";
import { Sheet } from "@/components/chat/bitacora/Sheet";

/** «¿Bloquear a Marcos?» — same sheet as «Vaciar el chat»: «Cancelar» and the action in red. */
export function BlockConfirm({ name, onClose, onConfirm }: {
  name: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      console.error("[bloquear] Error bloqueando:", (e as { message?: string } | null)?.message ?? String(e));
      setError(typeof navigator !== "undefined" && !navigator.onLine
        ? "Sin conexión. No se ha bloqueado."
        : "No se ha bloqueado. Inténtalo de nuevo.");
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={`¿Bloquear a ${name}?`}
      onClose={busy ? () => {} : onClose}
      maxWidth={400}
      footer={(
        <div className="flex gap-[8px]">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-[46px] flex-1 rounded-[8px] border border-app px-[16px] text-[15px] font-[var(--fw-semibold)] text-app hover:bg-[var(--surface-2)] disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => void run()} disabled={busy} className="min-h-[46px] flex-1 rounded-[8px] bg-[var(--error)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] hover:opacity-90 disabled:opacity-60">{busy ? "…" : "Bloquear"}</button>
        </div>
      )}
    >
      <p className="text-[15px] leading-[1.5] text-muted">No te llegarán sus mensajes, llamadas ni invitaciones. No se borra nada.</p>
      {error && <p role="alert" className="mt-[8px] text-[13px] text-[var(--error)]">{error}</p>}
    </Sheet>
  );
}
