"use client";

import { useState } from "react";
import type { ProposalMoment } from "./moments";

const ACCEPT_LABEL: Record<ProposalMoment["kind"], string> = {
  actividad: "Añadir al plan",
  gasto: "Registrar gasto",
  encuesta: "Crear encuesta",
  tarea: "Crear tarea",
};
const HEADING: Record<ProposalMoment["kind"], string> = {
  actividad: "Propuesta para el plan",
  gasto: "Registrar gasto",
  encuesta: "Crear encuesta",
  tarea: "Nueva tarea",
};
const DONE_VERB: Record<ProposalMoment["kind"], string> = {
  actividad: "añadió",
  gasto: "registró",
  encuesta: "creó la encuesta",
  tarea: "creó la tarea",
};

/**
 * @frimee never looks like a person: what it says, then a proposal block. The plan only changes
 * when someone accepts (board k-momentos · @frimee). Once resolved, a quiet line says who did what.
 */
export function FrimeeProposal({
  data,
  canAccept,
  cannotAcceptReason,
  onAccept,
  onDismiss,
}: {
  data: ProposalMoment;
  canAccept: boolean;
  /** Shown instead of the buttons when this person cannot accept it (e.g. only admins). */
  cannotAcceptReason?: string;
  onAccept: () => Promise<void>;
  onDismiss: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"accept" | "dismiss" | null>(null);
  const run = async (which: "accept" | "dismiss") => {
    if (busy) return;
    setBusy(which);
    try {
      await (which === "accept" ? onAccept() : onDismiss());
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {data.reply && <p className="whitespace-pre-line break-words text-[15px] leading-[1.45] text-app">{data.reply}</p>}
      <div className={`${data.reply ? "mt-[10px]" : ""} rounded-[6px] border border-app bg-[var(--bg)] p-[12px]`}>
        <p className="text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-[var(--chat-accent-text)]">{HEADING[data.kind]}</p>
        <p className="mt-[4px] break-words text-[15px] font-[var(--fw-semibold)] text-app">{data.titulo}</p>
        {data.detalle && <p className="mt-[2px] break-words text-[13px] text-muted">{data.detalle}</p>}

        {data.estado === "pendiente" ? (
          canAccept ? (
            <div className="mt-[10px] flex flex-wrap gap-[8px]">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("accept")}
                className="min-h-[44px] rounded-[8px] bg-[var(--primary)] px-[16px] text-[14px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy === "accept" ? "Un momento…" : ACCEPT_LABEL[data.kind]}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("dismiss")}
                className="min-h-[44px] rounded-[8px] px-[12px] text-[14px] font-[var(--fw-semibold)] text-muted hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                Ahora no
              </button>
            </div>
          ) : (
            <p className="mt-[10px] text-[12px] text-muted">{cannotAcceptReason ?? "Pendiente de que alguien lo acepte."}</p>
          )
        ) : (
          <p className="mt-[10px] flex items-center gap-[8px] text-[12px] text-muted">
            <span aria-hidden className={`size-[7px] rotate-45 ${data.estado === "aceptada" ? "bg-[var(--primary)]" : "border border-[var(--text-secondary)]"}`} />
            {data.estado === "aceptada"
              ? `${data.resuelta_por_nombre ?? "Alguien"} ${DONE_VERB[data.kind]}${data.kind === "actividad" ? ` «${data.titulo}» al plan` : ""}${data.resultado ? ` · ${data.resultado}` : ""}`
              : `${data.resuelta_por_nombre ?? "Alguien"} lo dejó para otro momento`}
          </p>
        )}
      </div>
    </div>
  );
}
