"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, ChevronLeft } from "lucide-react";
import { PersonAvatar, firstName, type Friend } from "./people";

/**
 * A 1 a 1 chat that does not exist yet (boards nc-m-amigo, nc-d-uno): the conversation is empty and
 * the composer is ready. The chat is created when the first message is sent; leaving without
 * writing leaves nothing behind.
 */
export function DraftDirectChat({
  friend, onBack, onSend,
}: {
  friend: Friend;
  onBack: () => void;
  /** Creates the chat and sends the text. Throws if it could not; the text stays in the box. */
  onSend: (texto: string) => Promise<void>;
}) {
  const nombre = firstName(friend.nombre);
  return (
    <div className="flex h-full flex-col pt-[var(--space-2)]" style={{ paddingBottom: "var(--keyboard-height, 0px)" }}>
      <header className="flex min-h-[56px] items-center gap-[10px] border-b border-app px-[var(--space-3)] pt-mobile-safe-top md:pt-0">
        <button type="button" onClick={onBack} aria-label="Volver" className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-app hover:bg-[var(--surface)] md:hidden">
          <ChevronLeft className="size-[22px]" aria-hidden />
        </button>
        <PersonAvatar name={friend.nombre} src={friend.profile_image} size={36} />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-[var(--fw-semibold)] text-app">{friend.nombre}</p>
          <p className="truncate text-[12px] text-muted">Aún no habéis hablado</p>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-[10px] px-[var(--space-6)] text-center">
        <PersonAvatar name={friend.nombre} src={friend.profile_image} size={64} />
        <h2 className="[font-family:var(--font-display-face)] text-[28px] leading-[1.15] text-app">Escribe a {nombre}</h2>
        <p className="max-w-[320px] text-[14px] text-muted">Aún no habéis hablado. El chat se crea cuando envíes el primer mensaje.</p>
      </div>
      <Composer placeholder={`Escribe a ${nombre}`} onSend={onSend} />
    </div>
  );
}

/** Text box + send, for chats that do not exist yet (a new 1 a 1 chat or a new group). */
export function Composer({ placeholder, onSend, disabled }: { placeholder: string; onSend: (texto: string) => Promise<void>; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  /** Why the last send failed, said in one quiet line above the box (the text stays to retry). */
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  // Ready to type on desktop, but only on arrival: becoming enabled later (a new group gets its
  // name and its second person) must not pull the focus away from where the person is typing.
  const enabledOnMount = useRef(!disabled);
  useEffect(() => {
    if (enabledOnMount.current && window.matchMedia("(min-width: 768px)").matches) ref.current?.focus();
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight leaves out the border (box-sizing: border-box): add it, or a 2 px scroll appears.
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = "auto";
    const full = el.scrollHeight + border;
    el.style.height = `${Math.min(full, 120)}px`;
    el.style.overflowY = full > 120 ? "auto" : "hidden";
  }, [text]);
  const send = async () => {
    const t = text.trim();
    if (!t || sending || disabled) return;
    setSending(true);
    setError(null);
    try {
      await onSend(t);
      setText("");
    } catch (e) {
      // The text stays so it can be sent again; an empty message means the caller already said it.
      const msg = (e as { message?: string } | null)?.message;
      if (msg) setError(msg);
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="border-t border-app px-[var(--space-3)] py-[var(--space-2)] pb-[calc(var(--space-2)+env(safe-area-inset-bottom))]">
      {error && (
        <p role="alert" className="mb-[6px] flex items-center gap-[6px] px-[4px] text-[13px] text-[var(--error)]">
          <AlertCircle className="size-[14px] shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <div className="flex items-end gap-[8px]">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        disabled={disabled || sending}
        onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded-[22px] border border-transparent bg-[var(--surface-2)] px-[16px] py-[11px] text-[15px] leading-[1.4] text-app outline-none placeholder:text-muted focus:border-[var(--border-strong)] disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={!text.trim() || sending || disabled}
        aria-label="Enviar"
        className="flex size-[44px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--bg)] transition-opacity disabled:bg-[var(--surface-2)] disabled:text-muted"
      >
        {sending
          ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          : <ArrowUp className="size-[20px]" aria-hidden />}
      </button>
      </div>
    </div>
  );
}
