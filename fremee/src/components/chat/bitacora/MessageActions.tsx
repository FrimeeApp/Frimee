"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsPhone } from "./Sheet";
import { Drawer } from "vaul";
import { Copy, Forward, Pencil, Pin, PinOff, Reply, Star, StarOff, Trash2 } from "lucide-react";

/** The milestone diamond (Bitácora): what the group decides and goes to the plan. */
export function DiamondIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`${className} text-primary-token`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" />
    </svg>
  );
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙌", "🔥"] as const;

type Action = { key: string; label: string; icon: React.ReactNode; danger?: boolean; shortcut?: string; run: () => void };

export type MessageActionsProps = {
  /** Who wrote it and a one-line preview, shown on top of the sheet. */
  author: string;
  preview: string;
  /** «Tu mensaje · 09:24 · visto por Ana» / «Ana · 09:24». */
  meta: string;
  isMe: boolean;
  canEdit: boolean;
  canCopy: boolean;
  isPinned: boolean;
  isStarred: boolean;
  myReaction: string | null;
  /**
   * Desktop: where the menu opens. «above»: over the message's action bar, right-aligned to it
   * (x = its right edge, y = its top). «cursor»: at the pointer (right click).
   */
  anchor: { x: number; y: number; place?: "above" | "cursor" };
  /** Desktop «Reaccionar» in the action bar: only the row of reactions. */
  reactionsOnly?: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onForward: () => void;
  onCopy: () => void;
  onPin: () => void;
  onStar: () => void;
  onDelete: () => void;
  /** «Añadir al plan» (P): only in a plan's chat, for its admins. */
  onAddToPlan?: () => void;
};

/**
 * Actions on a message (boards m-acciones / d-acciones): the message on top, a row of reactions,
 * then the actions. A bottom sheet on phones (drag down to close), a menu on desktop.
 */
export function MessageActions(props: MessageActionsProps) {
  const phone = useIsPhone();
  const { onClose } = props;

  const actions: Action[] = [
    { key: "reply", label: "Responder", icon: <Reply className="size-[18px]" />, shortcut: "R", run: props.onReply },
    ...(props.onAddToPlan ? [{ key: "plan", label: "Añadir al plan", icon: <DiamondIcon />, shortcut: "P", run: props.onAddToPlan }] : []),
    ...(props.canEdit ? [{ key: "edit", label: "Editar", icon: <Pencil className="size-[18px]" />, shortcut: "E", run: props.onEdit }] : []),
    { key: "forward", label: "Reenviar", icon: <Forward className="size-[18px]" />, shortcut: "F", run: props.onForward },
    ...(props.canCopy ? [{ key: "copy", label: "Copiar", icon: <Copy className="size-[18px]" />, shortcut: "Ctrl C", run: props.onCopy }] : []),
    { key: "pin", label: props.isPinned ? "Desfijar" : "Fijar", icon: props.isPinned ? <PinOff className="size-[18px]" /> : <Pin className="size-[18px]" />, run: props.onPin },
    { key: "star", label: props.isStarred ? "Quitar destacado" : "Destacar", icon: props.isStarred ? <StarOff className="size-[18px]" /> : <Star className="size-[18px]" />, shortcut: "S", run: props.onStar },
    ...(props.isMe ? [{ key: "delete", label: "Eliminar", icon: <Trash2 className="size-[18px]" />, danger: true, shortcut: "Supr", run: props.onDelete }] : []),
  ];

  const reactions = (
    <div className="flex items-center justify-between gap-[4px] px-[12px] py-[8px]" role="group" aria-label="Reaccionar">
      {QUICK_REACTIONS.map((emoji) => {
        const mine = props.myReaction === emoji;
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={mine}
            aria-label={mine ? `Quitar reacción ${emoji}` : `Reaccionar con ${emoji}`}
            onClick={() => props.onReact(mine ? "" : emoji)}
            className={`flex size-[44px] items-center justify-center rounded-full text-[22px] transition-transform hover:scale-110 ${mine ? "bg-[var(--chat-tint)]" : "hover:bg-[var(--surface-2)]"}`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );

  const list = (
    <ul className="py-[4px]">
      {actions.map((a) => (
        <li key={a.key}>
          <button
            type="button"
            onClick={a.run}
            className={`flex min-h-[48px] w-full items-center gap-[14px] px-[18px] text-left text-[15px] transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none ${a.danger ? "text-[var(--chat-missed)]" : "text-app"}`}
          >
            <span className={a.danger ? "" : "text-muted"}>{a.icon}</span>
            {a.label}
          </button>
        </li>
      ))}
    </ul>
  );

  // Desktop menu: Escape closes; a click outside closes (the overlay below).
  useEffect(() => {
    if (phone) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phone, onClose]);

  if (phone) {
    return (
      <Drawer.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/50" />
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[85dvh] flex-col rounded-t-[16px] border-t border-app bg-[var(--bg)] pb-[env(safe-area-inset-bottom)] outline-none"
            aria-describedby={undefined}
          >
            <div aria-hidden className="mx-auto mt-[8px] h-[4px] w-[36px] rounded-full bg-[var(--border)]" />
            <Drawer.Title className="sr-only">Acciones del mensaje</Drawer.Title>
            <div className="mx-[16px] mt-[12px] rounded-[8px] bg-[var(--surface)] px-[12px] py-[10px]">
              <p className="text-[13px] font-[var(--fw-semibold)] text-app">{props.author}</p>
              <p className="line-clamp-3 break-words text-[15px] leading-[1.45] text-app">{props.preview}</p>
              <p className="mt-[4px] text-[12px] tabular-nums text-muted">{props.meta}</p>
            </div>
            {reactions}
            <div className="overflow-y-auto border-t border-app">{list}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return <DesktopMenu {...props} actions={actions} />;
}

/**
 * Desktop menu (board d-acciones): 280 wide, radius 8, padding 6; reactions in a row of 36 px
 * buttons over a line, then 40 px rows with the keyboard shortcut on the right and a line before
 * deleting. Opens over the action bar, or at the pointer; measured so it never leaves the screen.
 */
function DesktopMenu(props: MessageActionsProps & { actions: Action[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const W = 280;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const H = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { x, y, place = "above" } = props.anchor;
    let left: number;
    let top: number;
    if (place === "cursor") {
      left = x + W > vw - 8 ? x - W : x;
      top = y + H > vh - 8 ? y - H : y;
    } else {
      // Right-aligned to the bar, 8 px over it; under the bar's row when there is no room on top.
      left = x - W;
      top = y - H - 8 >= 8 ? y - H - 8 : y + 48;
    }
    setPos({
      left: Math.max(8, Math.min(left, vw - W - 8)),
      top: Math.max(8, Math.min(top, vh - H - 8)),
    });
  }, [props.anchor, props.reactionsOnly]);

  const deleteAt = props.actions.findIndex((a) => a.danger);
  // In a portal: an ancestor of the chat has a transform, which would make «fixed» relative to it.
  return createPortal(
    <>
      <div className="fixed inset-0 z-[99]" onClick={props.onClose} onContextMenu={(e) => { e.preventDefault(); props.onClose(); }} aria-hidden />
      <div
        ref={ref}
        role="menu"
        aria-label={props.reactionsOnly ? "Reaccionar" : "Más acciones"}
        className="fixed z-[100] rounded-[8px] border border-app bg-[var(--bg)] p-[6px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: props.reactionsOnly ? undefined : W }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex justify-between gap-[2px] px-[2px] ${props.reactionsOnly ? "" : "mb-[4px] border-b border-app pb-[6px] pt-[2px]"}`} role="group" aria-label="Reaccionar">
          {QUICK_REACTIONS.map((emoji) => {
            const mine = props.myReaction === emoji;
            return (
              <button
                key={emoji}
                type="button"
                aria-pressed={mine}
                aria-label={mine ? `Quitar reacción ${emoji}` : `Reaccionar con ${emoji}`}
                onClick={() => props.onReact(mine ? "" : emoji)}
                className={`flex size-[36px] items-center justify-center rounded-full text-[18px] transition-colors ${mine ? "bg-[var(--chat-tint)]" : "hover:bg-[var(--surface-2)]"}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
        {!props.reactionsOnly && (
          <ul>
            {props.actions.map((a, i) => (
              <li key={a.key}>
                {i === deleteAt && i > 0 && <div role="separator" className="my-[4px] h-px bg-[var(--border)]" />}
                <button
                  type="button"
                  role="menuitem"
                  onClick={a.run}
                  className={`flex h-[40px] w-full items-center gap-[12px] rounded-[6px] px-[10px] text-left text-[14px] transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none ${a.danger ? "text-[var(--chat-missed)]" : "text-app"}`}
                >
                  {a.icon}
                  <span className="flex-1">{a.label}</span>
                  {a.shortcut && <kbd className="font-[inherit] text-[12px] text-muted">{a.shortcut}</kbd>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>,
    document.body,
  );
}
