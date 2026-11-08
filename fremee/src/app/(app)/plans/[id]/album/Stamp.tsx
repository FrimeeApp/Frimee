/** Round ink stamp, like a passport stamp: two short lines split by a rule. */
export function Stamp({ top, bottom, size = 64, tilt = -10 }: { top: string; bottom: string; size?: number; tilt?: number }) {
  return (
    <div
      aria-hidden
      className="flex shrink-0 flex-col items-center justify-center gap-[2px] rounded-full border-2 border-[var(--primary)] text-[var(--primary)] opacity-85"
      style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }}
    >
      <span className="font-semibold tracking-[0.15em]" style={{ fontSize: Math.round(size * 0.135) }}>{top}</span>
      <span className="h-px w-3/5 bg-[var(--primary)]" />
      <span className="tracking-[0.1em]" style={{ fontSize: Math.round(size * 0.125) }}>{bottom}</span>
    </div>
  );
}

/** "15·11·26" for an ISO date, in local time. */
export function stampDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}·${d.getMonth() + 1}·${String(d.getFullYear()).slice(2)}`;
}
