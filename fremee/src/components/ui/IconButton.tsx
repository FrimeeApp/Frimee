import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CloseX } from "@/components/ui/CloseX";

type IconButtonTone = "app" | "muted" | "light";
type IconButtonSize = "touch" | "compact";

type IconButtonProps = {
  children: ReactNode;
  tone?: IconButtonTone;
  size?: IconButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const TONE_CLASS: Record<IconButtonTone, string> = {
  app: "text-app hover:bg-surface",
  muted: "text-muted hover:bg-surface hover:text-app",
  light: "text-white hover:bg-white/20",
};

const SIZE_CLASS: Record<IconButtonSize, string> = {
  touch: "size-11",
  compact: "size-10",
};

export function IconButton({
  children,
  tone = "muted",
  size = "touch",
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-transparent transition-[background-color,color,opacity,transform] duration-150 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] disabled:pointer-events-none disabled:opacity-50 ${SIZE_CLASS[size]} ${TONE_CLASS[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

type CloseButtonProps = {
  label?: string;
  iconClassName?: string;
} & Omit<IconButtonProps, "children" | "aria-label">;

export function CloseButton({
  label = "Cerrar",
  iconClassName,
  tone = "muted",
  ...props
}: CloseButtonProps) {
  return (
    <IconButton aria-label={label} tone={tone} {...props}>
      <CloseX className={iconClassName} />
    </IconButton>
  );
}
