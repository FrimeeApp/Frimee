"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Drawer } from "vaul";
import { X } from "lucide-react";

export function useIsPhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/** A bottom sheet on phones (drag down to close) and a centred dialog on desktop. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  maxWidth = 440,
  zIndex = 1300,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Sticky bottom row (the main button), kept above the keyboard. */
  footer?: React.ReactNode;
  /** Desktop dialog width (px). */
  maxWidth?: number;
  /** Layer used by sheets opened above an intercepted route. */
  zIndex?: number;
}) {
  const phone = useIsPhone();

  useEffect(() => {
    if (phone) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phone, onClose]);

  const header = (
    <div className="flex items-center justify-between gap-[8px] px-[16px] pt-[8px]">
      <h2 className="[font-family:var(--font-display-face)] text-[24px] leading-[28px] text-app">{title}</h2>
      <button type="button" onClick={onClose} aria-label="Cerrar" className="flex size-[44px] items-center justify-center rounded-full text-muted hover:bg-[var(--surface-2)]">
        <X className="size-[18px]" />
      </button>
    </div>
  );

  if (phone) {
    return (
      <Drawer.Root open onOpenChange={(o) => { if (!o) onClose(); }} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/50" style={{ zIndex }} />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[90dvh] flex-col rounded-t-[16px] border-t border-app bg-[var(--bg)] outline-none"
            style={{ zIndex: zIndex + 1, paddingBottom: "calc(env(safe-area-inset-bottom) + var(--keyboard-height, 0px))" }}
          >
            <div aria-hidden className="mx-auto mt-[8px] h-[4px] w-[36px] rounded-full bg-[var(--border)]" />
            <Drawer.Title asChild><div>{header}</div></Drawer.Title>
            <div className="min-h-0 flex-1 overflow-y-auto px-[16px] pb-[12px] pt-[8px]">{children}</div>
            {footer && <div className="border-t border-app px-[16px] py-[10px]">{footer}</div>}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  // On body: the Messages page slides its panels with a transform, which would trap a fixed layer
  // inside the chat panel (the veil would not cover the sidebar).
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-[16px]" style={{ zIndex }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth }}
        className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-[16px] border border-app bg-[var(--bg)] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto px-[16px] pb-[12px] pt-[8px]">{children}</div>
        {footer && <div className="border-t border-app px-[16px] py-[10px]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export const sheetPrimaryButton =
  "min-h-[44px] w-full rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50";
export const sheetField =
  "min-h-[44px] w-full rounded-[8px] border border-app bg-[var(--surface-2)] px-[12px] text-[15px] text-app outline-none focus:border-[var(--chat-me-border)]";
export const sheetLabel = "mb-[6px] block text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted";
