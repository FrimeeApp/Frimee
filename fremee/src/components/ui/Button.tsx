import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";

type ButtonVariant = "primary" | "secondary" | "ghost" | "icon" | "back";
type ButtonSize    = "sm" | "md" | "lg";

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
  /** Icon rendered before children */
  iconLeft?: ReactNode;
  /** Icon rendered after children */
  iconRight?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>

const BASE = "inline-flex items-center justify-center font-[var(--fw-semibold)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] disabled:opacity-[var(--disabled-opacity)] disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "rounded-button bg-[var(--primary)] text-[var(--contrast)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)]",
  secondary:
    "rounded-button border border-app bg-surface text-app hover:bg-surface-2 active:bg-surface-inset",
  ghost:
    "rounded-button text-muted hover:text-app",
  icon:
    "size-10 rounded-full border border-app text-app hover:bg-surface",
  back:
    "gap-2 text-body-sm text-muted hover:text-app",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 gap-1.5 text-button-md",
  md: "h-btn-primary px-[var(--button-padding-x)] gap-[var(--button-gap)] text-button-md",
  lg: "h-btn-primary px-[var(--button-padding-x)] gap-[var(--button-gap)] text-button-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  iconLeft,
  iconRight,
  className = "",
  ...rest
}: ButtonProps) {
  const sizeClass = variant === "icon" || variant === "back" ? "" : SIZES[size];

  return (
    <button
      type="button"
      className={`${BASE} ${VARIANTS[variant]} ${sizeClass} ${className}`}
      {...rest}
    >
      {variant === "back" && !iconLeft && (
        <ChevronLeftIcon className="size-[18px]" />
      )}
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
