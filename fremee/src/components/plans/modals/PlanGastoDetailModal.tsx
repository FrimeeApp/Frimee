"use client";

import { useState } from "react";
import Image from "next/image";
import { deleteGastoEndpoint, type GastoRow } from "@/services/api/endpoints/gastos.endpoint";
import { formatMoney, formatLongDateTime, getInitial } from "@/lib/formatters";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { CloseButton } from "@/components/ui/IconButton";
import { DiscardChangesDialog } from "@/components/ui/DiscardChangesDialog";

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatExpenseDetailDate = formatLongDateTime;

// ── Sub-components ────────────────────────────────────────────────────────────

function PlanExpenseDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-[var(--space-2)]">
      <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="mt-[4px] text-body-sm font-[var(--fw-semibold)] text-app">{value}</p>
    </div>
  );
}

function PlanExpenseAvatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-app">
        <Image src={image} alt={name} fill sizes="44px" className="object-cover" unoptimized referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-app bg-surface-2 text-body-sm font-[var(--fw-semibold)] text-muted">
      {getInitial(name)}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

type PlanGastoDetailModalProps = {
  gasto: GastoRow | null;
  planName: string;
  currentUserId: string | null;
  onClose: () => void;
  /** Called after the expense is voided; omit to hide the delete button. */
  onDeleted?: () => void;
}

export function PlanGastoDetailModal({
  gasto,
  planName,
  currentUserId,
  onClose,
  onDeleted,
}: PlanGastoDetailModalProps) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  if (!gasto) return null;

  const handleDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGastoEndpoint(gasto.id);
      onDeleted?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error al eliminar el gasto");
    } finally {
      setDeleting(false);
    }
  };

  const payerName = gasto.pagado_por_nombre ?? "Usuario";
  const categoryLine = gasto.subplan_titulo ?? gasto.categoria_nombre ?? gasto.descripcion?.trim() ?? "Sin detalle";
  const categoryLabel = gasto.subplan_titulo
    ? "Actividad"
    : gasto.categoria_nombre
      ? "Categoría"
      : "Detalle";
  const yourShare = currentUserId
    ? gasto.partes?.find((parte) => parte.user_id === currentUserId)?.importe ?? null
    : null;

  return (
    <div
      data-closing={isClosing ? "true" : "false"}
      className="app-modal-overlay fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-[var(--space-4)] py-[var(--space-6)]"
      onClick={requestClose}
    >
      <div
        className="app-modal-panel w-full max-w-[560px] rounded-[18px] border border-app bg-app shadow-elev-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-[var(--space-4)] border-b border-app px-[var(--space-5)] py-[var(--space-4)]">
          <div className="min-w-0">
            <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
              {planName}
            </p>
            <h2 className="mt-[6px] truncate text-[var(--font-h3)] font-[var(--fw-bold)] leading-[1.15] text-app">
              {gasto.titulo}
            </h2>
          </div>
          <CloseButton onClick={requestClose} label="Cerrar detalle" />
        </div>

        <div className="space-y-[var(--space-5)] px-[var(--space-5)] py-[var(--space-5)]">
          <div className="flex items-start justify-between gap-[var(--space-4)]">
            <div>
              <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                Importe
              </p>
              <p className="mt-[6px] text-[32px] font-[var(--fw-bold)] leading-none text-app">
                {formatMoney(gasto.total, gasto.moneda)}
              </p>
            </div>
            {yourShare != null && (
              <div className="text-right">
                <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                  Tu parte
                </p>
                <p className="mt-[6px] text-body font-[var(--fw-semibold)] text-app">
                  {formatMoney(yourShare, gasto.moneda)}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
            <PlanExpenseDetailItem label="Pagado por" value={payerName} />
            <PlanExpenseDetailItem label="Fecha" value={formatExpenseDetailDate(gasto.fecha_gasto)} />
            <PlanExpenseDetailItem label={categoryLabel} value={categoryLine} />
          </div>

          {gasto.descripcion?.trim() && (
            <div>
              <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                Descripción
              </p>
              <p className="mt-[4px] text-body-sm text-app">{gasto.descripcion.trim()}</p>
            </div>
          )}

          <div>
            <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
              Repartido entre
            </p>
            <div className="mt-[var(--space-3)] divide-y divide-app">
              {(gasto.partes ?? []).map((parte) => {
                const partName = parte.user_id === currentUserId ? "Tú" : (parte.nombre ?? "Usuario");
                return (
                  <div key={`${gasto.id}-${parte.user_id}`} className="flex items-center gap-3 py-[var(--space-3)]">
                    <PlanExpenseAvatar name={partName} image={parte.foto ?? null} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{partName}</p>
                    </div>
                    <p className="shrink-0 text-body-sm font-[var(--fw-semibold)] text-app">
                      {formatMoney(parte.importe, gasto.moneda)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {onDeleted && (
          <div className="flex items-center justify-between gap-[var(--space-4)] border-t border-app px-[var(--space-5)] py-[var(--space-4)]">
            <button
              type="button"
              disabled={deleting}
              onClick={() => { setDeleteError(null); setConfirmOpen(true); }}
              className="text-body-sm font-[var(--fw-semibold)] text-[var(--error)] transition-opacity hover:opacity-60 disabled:opacity-[var(--disabled-opacity)]"
            >
              {deleting ? "Eliminando..." : "Eliminar gasto"}
            </button>
            {deleteError && <p className="text-body-sm text-[var(--error)]">{deleteError}</p>}
          </div>
        )}
      </div>

      <DiscardChangesDialog
        open={confirmOpen}
        title="Eliminar gasto"
        message={`Se anulará "${gasto.titulo}" y se recalcularán las deudas del plan para todos los participantes.`}
        confirmLabel="Eliminar"
        onCancel={() => setConfirmOpen(false)}
        onDiscard={() => void handleDelete()}
      />
    </div>
  );
}
