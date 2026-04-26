"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

type InputProps = {
  error?: boolean;
  trailing?: ReactNode;
  wrapperClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ error, trailing, wrapperClassName = "", className = "", ...props }, ref) {
    const borderClass = error
      ? "border-error-token focus-within:border-error-token"
      : "border-app focus-within:border-[var(--input-border-focus)]";

    return (
      <div
        className={`h-input rounded-input border bg-[var(--input-bg)] px-[var(--input-padding-x)] transition-[border-color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] ${borderClass} ${wrapperClassName}`}
      >
        {trailing ? (
          <div className="flex h-full items-center gap-[var(--space-3)]">
            <input
              ref={ref}
              className={`w-full bg-transparent text-body text-app outline-none placeholder:text-muted focus-visible:shadow-none ${className}`}
              {...props}
            />
            {trailing}
          </div>
        ) : (
          <input
            ref={ref}
            className={`h-full w-full bg-transparent text-body text-app outline-none placeholder:text-muted focus-visible:shadow-none ${className}`}
            {...props}
          />
        )}
      </div>
    );
  }
);
