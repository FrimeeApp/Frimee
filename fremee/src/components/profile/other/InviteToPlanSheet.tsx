"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { FOCUS, GHOST_BTN } from "@/components/plans/home/pieces";
import { listUserRelatedPlans } from "@/services/api/repositories/plans.repository";
import { invitePeople } from "@/services/api/repositories/invitations.repository";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { isPlanFinished } from "@/lib/plan-dates";

/** «Invitar a un plan»: tus planes que aún no han terminado y que creaste tú; un toque invita a esta persona. */

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export default function InviteToPlanSheet({ myId, userId, firstName, onClose }: { myId: string; userId: string; firstName: string; onClose: () => void }) {
  const [plans, setPlans] = useState<FeedPlanItemDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<Record<number, "sending" | "sent" | "error">>({});
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    listUserRelatedPlans({ userId: myId, limit: 100 })
      .then((all) => {
        if (!cancelled) setPlans(all.filter((p) => (p.ownerUserId ?? p.creator.id) === myId && !isPlanFinished(p.endsAt)).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
      })
      .catch((err) => {
        console.error("[perfil] Error cargando tus planes:", (err as { message?: string } | null)?.message ?? err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  useLayoutEffect(() => {
    ref.current?.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" });
  }, []);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const invite = async (p: FeedPlanItemDto) => {
    setState((s) => ({ ...s, [p.id]: "sending" }));
    try {
      await invitePeople(p.id, [userId]);
      setState((s) => ({ ...s, [p.id]: "sent" }));
    } catch (err) {
      console.error("[perfil] Error invitando al plan:", (err as { message?: string } | null)?.message ?? err);
      setState((s) => ({ ...s, [p.id]: "error" }));
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 md:items-center md:p-8" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Invitar a ${firstName} a un plan`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80dvh] w-full max-w-[460px] flex-col rounded-t-[8px] border border-app bg-surface text-app shadow-[0_12px_24px_rgba(0,0,0,0.3)] md:rounded-[8px]"
      >
        <div className="flex h-14 shrink-0 items-center pl-4 pr-1">
          <h2 className="m-0 flex-1 font-sans text-[18px] font-[var(--fw-semibold)] leading-[1.3]">Invitar a {firstName}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className={`inline-flex size-11 items-center justify-center rounded-[8px] ${FOCUS}`}>
            <X className="size-[22px]" aria-hidden />
          </button>
        </div>
        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto px-4 pb-4">
          {failed ? (
            <li role="alert" className="py-4 text-[14px] leading-[1.5] text-[var(--error)]">
              No se pudieron cargar tus planes. Inténtalo de nuevo.
            </li>
          ) : !plans ? (
            <li role="status" className="py-4 text-[14px] text-muted">
              Cargando tus planes…
            </li>
          ) : plans.length === 0 ? (
            <li className="py-4 text-[14px] leading-[1.5] text-muted">No tienes planes próximos creados por ti. Crea uno y podrás invitar a {firstName}.</li>
          ) : (
            plans.map((p, i) => {
              const st = state[p.id];
              return (
                <li key={p.id} className={`flex min-h-16 items-center gap-3 py-2 ${i ? "border-t border-app" : ""}`}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[16px] font-[var(--fw-semibold)] leading-[1.35]">{p.title}</span>
                    <span className="truncate text-[14px] leading-[1.5] tabular-nums text-muted">{st === "error" ? "No se pudo enviar. Reintenta." : when(p.startsAt)}</span>
                  </span>
                  {st === "sent" ? (
                    <span className="inline-flex h-11 items-center gap-1.5 px-2 text-[14px] font-[var(--fw-semibold)] text-muted">
                      <Check className="size-4" aria-hidden /> Invitado
                    </span>
                  ) : (
                    <button type="button" disabled={st === "sending"} onClick={() => void invite(p)} className={`${GHOST_BTN} !h-11 shrink-0 !px-3 !text-[14px]`}>
                      Invitar
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
