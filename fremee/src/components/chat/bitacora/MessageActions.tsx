"use client";

import { useEffect } from "react";
import { useIsPhone } from "./Sheet";
import { Drawer } from "vaul";
import { Copy, Forward, Pencil, Pin, PinOff, Reply, Star, StarOff, Trash2 } from "lucide-react";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙌", "🔥"] as const;

type Action = { key: string; label: string; icon: React.ReactNode; danger?: boolean; run: () => void };

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
  /** Desktop: where the menu opens (the message's menu button). */
  anchor: { x: number; y: number };
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onForward: () => void;
  onCopy: () => void;
  onPin: () => void;
  onStar: () => void;
  onDelete: () => void;
};

/**
 * Actions on a message (boards m-acciones / d-acciones): the message on top, a row of reactions,
 * then the actions. A bottom sheet on phones (drag down to close), a menu on desktop.
 */
export function MessageActions(props: MessageActionsProps) {
  const phone = useIsPhone();
  const { onClose } = props;

  const actions: Action[] = [
    { key: "reply", label: "Responder", icon: <Reply className="size-[18px]" />, run: props.onReply },
    ...(props.canEdit ? [{ key: "edit", label: "Editar", icon: <Pencil className="size-[18px]" />, run: props.onEdit }] : []),
    { key: "forward", label: "Reenviar", icon: <Forward className="size-[18px]" />, run: props.onForward },
    ...(props.canCopy ? [{ key: "copy", label: "Copiar", icon: <Copy className="size-[18px]" />, run: props.onCopy }] : []),
    { key: "pin", label: props.isPinned ? "Desfijar" : "Fijar", icon: props.isPinned ? <PinOff className="size-[18px]" /> : <Pin className="size-[18px]" />, run: props.onPin },
    { key: "star", label: props.isStarred ? "Quitar destacado" : "Destacar", icon: props.isStarred ? <StarOff className="size-[18px]" /> : <Star className="size-[18px]" />, run: props.onStar },
    ...(props.isMe ? [{ key: "delete", label: "Eliminar", icon: <Trash2 className="size-[18px]" />, danger: true, run: props.onDelete }] : []),
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

  const W = 280;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const H = 72 + actions.length * 48 + 8;
  const left = Math.max(8, Math.min(props.anchor.x - W / 2, vw - W - 8));
  const top = props.anchor.y + H > vh - 8 ? Math.max(8, props.anchor.y - H - 32) : props.anchor.y;

  return (
    <>
      <div className="fixed inset-0 z-[99]" onClick={onClose} aria-hidden />
      <div
        role="menu"
        aria-label="Acciones del mensaje"
        className="fixed z-[100] overflow-hidden rounded-[12px] border border-app bg-[var(--bg)] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        style={{ left, top, width: W }}
        onClick={(e) => e.stopPropagation()}
      >
        {reactions}
        <div className="border-t border-app">{list}</div>
      </div>
    </>
  );
}
