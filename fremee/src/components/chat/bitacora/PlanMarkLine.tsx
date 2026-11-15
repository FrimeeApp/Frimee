import Link from "next/link";
import type { PlanMarkMoment } from "./moments";

/**
 * What was added to the plan from the chat, as a line on the spine with a filled diamond (board
 * g-proponer «Añadir directo»): «Añadiste «Taberna da Rua» al plan · Día 2, 21:00». It is a decided
 * milestone: the ruler counts it.
 */
export function PlanMarkLine({
  data, isMe, who, tripStart,
}: {
  data: PlanMarkMoment;
  isMe: boolean;
  /** First name of whoever added it (others). */
  who: string;
  /** Start of the chat's trip (plan chats): «Día 2»; otherwise the date. */
  tripStart?: string | null;
}) {
  const at = new Date(data.inicio_at);
  const time = at.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
  let when = `${at.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "")}, ${time}`;
  if (tripStart) {
    const s = new Date(tripStart);
    const day = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime()) / 86_400_000) + 1;
    if (day >= 1) when = `Día ${day}, ${time}`;
  }
  // In a chat without a plan, say which plan.
  const toPlan = tripStart ? "al plan" : `a «${data.plan_titulo ?? "un plan"}»`;
  return (
    <div className="relative flex min-h-[44px] items-center gap-[10px] pl-[56px] pr-[var(--space-4)]">
      <span aria-hidden className="absolute left-[22px] top-1/2 size-[9px] -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-[var(--primary)] bg-[var(--primary)]" />
      <p className="min-w-0 flex-1 text-[12px] text-muted">
        {isMe ? "Añadiste" : `${who} añadió`} «{data.titulo}» {toPlan} · {when}
      </p>
      <Link href={`/plans/${data.plan_id}?tab=itinerario`} className="min-h-[44px] shrink-0 content-center text-[13px] font-[var(--fw-semibold)] text-primary-token">
        Ver
      </Link>
    </div>
  );
}
