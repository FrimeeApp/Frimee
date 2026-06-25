type CountBadgeProps = {
  count: number;
  max?: number;
  ariaLabel?: string;
  className?: string;
};

export function CountBadge({ count, max = 99, ariaLabel, className = "" }: CountBadgeProps) {
  const label = count > max ? `${max}+` : String(count);

  return (
    <span
      className={`inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 box-border items-center justify-center rounded-full bg-[var(--warning)] px-[0.3125rem] text-center text-[0.6875rem] font-[var(--fw-semibold)] leading-none text-white [font-variant-numeric:tabular-nums] ${className}`}
      aria-label={ariaLabel ?? label}
    >
      {label}
    </span>
  );
}
