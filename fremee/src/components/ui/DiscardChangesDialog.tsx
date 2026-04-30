"use client";

import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";

type DiscardChangesDialogProps = {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onDiscard: () => void;
};

export function DiscardChangesDialog({
  open,
  title = "Descartar cambios",
  message = "Si cierras ahora, se perdera la informacion que has completado.",
  confirmLabel = "Descartar",
  cancelLabel = "Cancelar",
  onCancel,
  onDiscard,
}: DiscardChangesDialogProps) {
  const { isClosing, requestClose } = useModalCloseAnimation(onCancel, open);

  if (!open) return null;

  return (
    <div
      data-closing={isClosing ? "true" : "false"}
      className="app-modal-overlay fixed inset-0 z-[1400] flex items-end justify-center px-4 pb-[max(var(--space-6),env(safe-area-inset-bottom))] sm:items-center"
      onClick={(e) => {
        e.stopPropagation();
        requestClose();
      }}
    >
      <div
        className="app-modal-panel w-full max-w-[360px] rounded-[18px] bg-app p-5 shadow-elev-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[18px] font-[700] leading-tight text-app">{title}</h3>
        <p className="mt-2 text-[14px] leading-snug text-muted">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={requestClose}
            className="flex-1 rounded-full border border-app py-[10px] text-[14px] font-[600] text-app transition-colors hover:bg-surface"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="flex-1 rounded-full bg-[var(--error,#dc2626)] py-[10px] text-[14px] font-[700] text-white transition-opacity hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
