import { X } from "lucide-react";

type CloseXProps = {
  className?: string;
};

export function CloseX({ className = "size-[18px]" }: CloseXProps) {
  return <X className={`${className} text-muted`} strokeWidth={1.8} aria-hidden />;
}
