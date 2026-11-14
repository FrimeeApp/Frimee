import type { ChapterLabel } from "./timeline";

/** A day of the conversation, as a chapter on the timeline's spine (board «Bitácora»). */
export function DayChapter({ label }: { label: ChapterLabel }) {
  return (
    <div className="relative pb-[6px] pl-[56px] pr-[var(--space-4)] pt-[18px]">
      <span
        aria-hidden
        className="absolute left-[22px] top-[27px] size-[11px] rounded-full border-2 border-[var(--text-secondary)] bg-[var(--bg)]"
      />
      <h3 className="flex flex-wrap items-baseline gap-x-[8px] font-normal">
        <span className="font-[family-name:var(--font-display)] text-[24px] leading-[28px] text-app">{label.title}</span>
        <span className="text-[12px] text-muted">{label.subtitle}</span>
      </h3>
    </div>
  );
}
