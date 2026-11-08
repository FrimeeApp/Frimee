"use client";

import { PhoneOff } from "lucide-react";

/** Guest call limit reached (M18d, D18b): bottom sheet on phones, dialog on desktop. */
export default function GuestLimitSheet({ onCreateAccount, onClose }: { onCreateAccount: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[var(--call-scrim)] md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-guest-limit-title"
        onClick={(e) => e.stopPropagation()}
        className="call-enter w-full rounded-t-2xl bg-[var(--surface)] px-5 pt-2 text-center text-[var(--text-primary)] md:w-[400px] md:rounded-lg md:border md:border-[var(--call-border)] md:p-7"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
      >
        <div aria-hidden="true" className="mx-auto mb-5 h-1 w-9 rounded-full bg-[var(--call-border)] md:hidden" />
        <div className="flex flex-col items-center">
          <div aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-[var(--call-pill-bg)] text-[var(--call-accent-text)]">
            <PhoneOff className="size-6" />
          </div>
          <h2 id="call-guest-limit-title" className="m-0 mt-4 text-[17px] font-semibold">Has llegado al límite de hoy</h2>
          <p className="m-0 mt-1.5 text-[14px] leading-[1.45] text-[var(--text-secondary)]">
            Has llegado al límite de llamadas de hoy del modo invitado. Crea una cuenta para seguir llamando.
          </p>
          <div className="mt-6 flex w-full flex-col gap-2">
            <button type="button" onClick={onCreateAccount} className="h-11 w-full rounded-lg bg-[var(--call-btn-fill)] text-[15px] font-semibold text-[var(--call-btn-fill-text)]">
              Crear cuenta
            </button>
            <button type="button" onClick={onClose} className="h-11 w-full rounded-lg bg-[var(--call-btn-neutral)] text-[15px] font-semibold text-[var(--text-primary)]">
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
