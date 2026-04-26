import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Optional icon/illustration node rendered above the text */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional CTA button label */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-4 text-center ${className}`}>
      {icon && (
        <div className="flex size-16 items-center justify-center rounded-full border border-app">
          {icon}
        </div>
      )}
      <div>
        <p className="text-body font-[var(--fw-semibold)] text-app">{title}</p>
        {description && (
          <p className="mt-1 text-body-sm text-muted">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-body-sm font-[var(--fw-semibold)] text-[var(--contrast)] transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
