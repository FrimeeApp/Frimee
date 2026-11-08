import { transportInfo } from "./transport";

/** Small transport badge in the middle of a leg still ahead (grey, like the pending route). */
export function LegIcon({ transporte }: { transporte: string }) {
  const t = transportInfo(transporte);
  if (!t) return null;
  return (
    <span
      className="flex size-[22px] items-center justify-center rounded-full border-[1.5px] border-[var(--al-pending)] bg-[var(--al-base)] text-[var(--al-muted)]"
      role="img"
      aria-label={t.label}
    >
      <t.Icon className="size-[12px]" strokeWidth={2.2} aria-hidden />
    </span>
  );
}
