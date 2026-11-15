import { Fragment } from "react";

/** http(s)://… and www.… up to a space; trailing punctuation stays as text («mira esto: x.com/a.»). */
const LINK_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING = /[),.;:!?»”'"]+$/;

/**
 * A message's text with its links clickable (board gi-41): they open in a new tab and never trigger
 * the message's own tap (menu, reply…).
 */
export function LinkifiedText({ text }: { text: string }) {
  const parts: Array<{ link: boolean; text: string }> = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const raw = m[0];
    const link = raw.replace(TRAILING, "");
    const start = m.index ?? 0;
    if (start > last) parts.push({ link: false, text: text.slice(last, start) });
    parts.push({ link: true, text: link });
    last = start + link.length;
  }
  if (last < text.length) parts.push({ link: false, text: text.slice(last) });
  if (!parts.some((p) => p.link)) return <>{text}</>;

  return (
    <>
      {parts.map((p, i) => p.link ? (
        <a
          key={i}
          href={p.text.startsWith("www.") ? `https://${p.text}` : p.text}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="break-all text-[var(--chat-accent-text)] underline underline-offset-2 hover:opacity-80"
        >
          {p.text}
        </a>
      ) : <Fragment key={i}>{p.text}</Fragment>)}
    </>
  );
}
