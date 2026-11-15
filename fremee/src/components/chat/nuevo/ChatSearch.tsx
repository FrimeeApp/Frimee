"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatChatTime, resolveChatAvatar, resolveChatName, type ChatListItem } from "@/services/api/repositories/chat.repository";
import { amigosSugeridosEndpoint, buscarMensajesEndpoint, type MensajeEncontrado } from "@/services/api/endpoints/chat.endpoint";
import { foldText, highlightParts, matchesText } from "@/lib/text-search";
import { CopyInviteLink, FriendsStatus, PersonAvatar, firstName, type Friend, type FriendsState } from "./people";

/** How many «Amigos con los que hablar» the empty search suggests (the rest, by typing). */
const SUGGESTED = 5;

type Option = { key: string; run: () => void; node: ReactNode };
type Group = { title: string; options: Option[]; after?: ReactNode };

/**
 * The Messages search (boards nc-m-buscar0, nc-m-buscar, nc-d-buscar). Focused and empty it
 * suggests friends to talk to (only those without a chat yet) and recent chats; typing, it shows
 * three blocks: Chats, Amigos (friends without a chat: «Empezar chat») and Mensajes. A friend who
 * already has a chat only shows up under Chats. Arrows move through the results, Enter opens,
 * Escape cancels.
 */
export function ChatSearch({
  active, onActiveChange, chats, userId, friends, onLoadFriends, onOpenChat, onStartChat,
}: {
  active: boolean;
  onActiveChange: (active: boolean) => void;
  chats: ChatListItem[];
  userId: string;
  friends: FriendsState;
  onLoadFriends: (force?: boolean) => void;
  onOpenChat: (chatId: string, mensajeId?: number) => void;
  onStartChat: (friend: Friend) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const q = query.trim();

  // Messages: from 2 letters, a moment after the last key.
  const [found, setFound] = useState<{ q: string; rows: MensajeEncontrado[] } | { q: string; error: true } | null>(null);
  useEffect(() => {
    if (!active || q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      buscarMensajesEndpoint(q)
        .then((rows) => { if (!cancelled) setFound({ q, rows }); })
        .catch((e) => {
          console.error("[mensajes] Error buscando mensajes:", (e as { message?: string })?.message ?? String(e));
          if (!cancelled) setFound({ q, error: true });
        });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [active, q]);
  const messagesFor = found && found.q === q ? found : null;

  // «Amigos con los que hablar»: 5, the most relevant (shared plans and groups first), asked each
  // time the search opens since a new chat changes who is left. If it fails, the first 5 A–Z.
  const [suggested, setSuggested] = useState<Friend[] | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    amigosSugeridosEndpoint(SUGGESTED)
      .then((rows) => { if (!cancelled) setSuggested(rows); })
      .catch((e) => {
        console.error("[mensajes] Error leyendo amigos sugeridos:", (e as { message?: string })?.message ?? String(e));
        if (!cancelled) setSuggested(null);
      });
    return () => { cancelled = true; };
  }, [active]);
  const searchingMessages = q.length >= 2 && !messagesFor;

  // Friends who already have a 1 a 1 chat with me (they show up as chats, never as «Empezar chat»).
  const withChat = useMemo(() => {
    const ids = new Set<string>();
    for (const c of chats) {
      if (c.tipo !== "DIRECTO") continue;
      for (const m of c.miembros) if (m.id !== userId) ids.add(m.id);
    }
    return ids;
  }, [chats, userId]);
  const friendList = friends.status === "ready" ? friends.friends : [];
  const newFriends = friendList.filter((f) => !withChat.has(f.id));
  const chatById = useMemo(() => new Map(chats.map((c) => [c.chat_id, c])), [chats]);

  const close = () => {
    setQuery("");
    setActiveIdx(0);
    onActiveChange(false);
    inputRef.current?.blur();
  };
  const openChat = (chatId: string, mensajeId?: number) => { close(); onOpenChat(chatId, mensajeId); };
  const startChat = (f: Friend) => { close(); onStartChat(f); };

  const chatOption = (c: ChatListItem): Option => {
    const name = resolveChatName(c, userId);
    const preview = c.last_message && !c.last_message.startsWith("{") ? c.last_message : "";
    return {
      key: `c-${c.chat_id}`,
      run: () => openChat(c.chat_id),
      node: (
        <>
          <PersonAvatar name={name} src={resolveChatAvatar(c, userId)} group={c.tipo !== "DIRECTO"} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-[var(--fw-semibold)] text-app"><Hl text={name} q={q} /></span>
            {preview && <span className="block truncate text-[14px] text-muted">{preview}</span>}
          </span>
        </>
      ),
    };
  };
  const friendOption = (f: Friend): Option => ({
    key: `f-${f.id}`,
    run: () => startChat(f),
    node: (
      <>
        <PersonAvatar name={f.nombre} src={f.profile_image} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-[var(--fw-semibold)] text-app"><Hl text={f.nombre} q={q} /></span>
          <span className="flex items-center gap-[5px] text-[14px] font-[var(--fw-semibold)] text-primary-token">
            <MessageCircle className="size-[14px]" aria-hidden />Empezar chat
          </span>
        </span>
      </>
    ),
  });
  const messageOption = (m: MensajeEncontrado): Option | null => {
    const c = chatById.get(m.chat_id);
    if (!c) return null;
    const chatName = resolveChatName(c, userId);
    const who = m.sender_id === userId ? "Tú" : firstName(m.sender_nombre ?? "");
    const title = c.tipo === "DIRECTO" ? chatName : `${chatName} · ${who}`;
    return {
      key: `m-${m.mensaje_id}`,
      run: () => openChat(m.chat_id, m.mensaje_id),
      node: (
        <>
          <PersonAvatar name={chatName} src={resolveChatAvatar(c, userId)} group={c.tipo !== "DIRECTO"} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-[8px]">
              <span className="truncate text-[15px] font-[var(--fw-semibold)] text-app">{title}</span>
              <span className="ml-auto shrink-0 text-[12px] tabular-nums text-muted">{formatChatTime(m.created_at)}</span>
            </span>
            <span className="block truncate text-[14px] text-muted"><Hl text={excerpt(m.texto, q)} q={q} /></span>
          </span>
        </>
      ),
    };
  };

  const groups: Group[] = [];
  let emptyResult: ReactNode = null;
  if (!q) {
    if (friends.status !== "ready" || friendList.length === 0) {
      groups.push({ title: "Amigos con los que hablar", options: [], after: <FriendsStatus state={friends} onRetry={() => onLoadFriends(true)} /> });
    } else {
      const toTalk = (suggested ?? newFriends).filter((f) => !withChat.has(f.id)).slice(0, SUGGESTED);
      if (toTalk.length > 0) groups.push({ title: "Amigos con los que hablar", options: toTalk.map(friendOption) });
    }
    if (chats.length > 0) groups.push({ title: "Chats recientes", options: chats.slice(0, 5).map(chatOption) });
  } else {
    const chatHits = chats.filter((c) => matchesText(resolveChatName(c, userId), q));
    const friendHits = newFriends.filter((f) => matchesText(f.nombre, q) || (f.username ? matchesText(f.username, q) : false));
    const msgHits = messagesFor && "rows" in messagesFor
      ? messagesFor.rows.map(messageOption).filter((o): o is Option => o !== null)
      : [];
    if (chatHits.length) groups.push({ title: "Chats", options: chatHits.slice(0, 8).map(chatOption) });
    if (friendHits.length) groups.push({ title: "Amigos", options: friendHits.slice(0, 8).map(friendOption) });
    if (friends.status === "error" || friends.status === "loading") {
      groups.push({ title: "Amigos", options: [], after: <FriendsStatus state={friends} onRetry={() => onLoadFriends(true)} /> });
    }
    if (msgHits.length) groups.push({ title: "Mensajes", options: msgHits });
    else if (messagesFor && "error" in messagesFor) {
      groups.push({ title: "Mensajes", options: [], after: <p className="px-[12px] py-[8px] text-[14px] text-muted">No se pudieron buscar los mensajes.</p> });
    }
    if (groups.length === 0 && !searchingMessages && friends.status === "ready") {
      emptyResult = (
        <div className="px-[12px] py-[16px]">
          <p className="text-[15px] font-[var(--fw-semibold)] text-app">No encontramos a «{q}»</p>
          <p className="mt-[2px] text-[14px] text-muted">Solo puedes escribir a tus amigos en Frimee. Pásale un enlace para que se una.</p>
          <CopyInviteLink />
        </div>
      );
    }
  }
  const flat = groups.flatMap((g) => g.options);
  const current = flat.length ? Math.min(activeIdx, flat.length - 1) : -1;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && flat.length) { e.preventDefault(); setActiveIdx((current + 1) % flat.length); }
    else if (e.key === "ArrowUp" && flat.length) { e.preventDefault(); setActiveIdx((current - 1 + flat.length) % flat.length); }
    else if (e.key === "Enter" && current >= 0) { e.preventDefault(); flat[current].run(); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };
  useEffect(() => {
    if (current < 0) return;
    document.getElementById(`ns-opt-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  let n = -1;
  return (
    <div
      className={active ? "flex min-h-0 flex-1 flex-col" : ""}
      onBlur={(e) => {
        // Leaving the search with nothing typed closes it (tap outside; there is no «Cancelar»).
        if (!q && !e.currentTarget.contains(e.relatedTarget as Node | null)) onActiveChange(false);
      }}
    >
      <div className="flex items-center gap-[8px] px-[var(--space-4)] pb-[var(--space-3)]">
        <SearchInput
          ref={inputRef}
          value={query}
          onChange={(v) => { setQuery(v); setActiveIdx(0); }}
          placeholder="Buscar chats, amigos y mensajes"
          className={`h-[44px] min-w-0 flex-1 ${active ? "ring-2 ring-[var(--primary)]" : ""}`}
          inputProps={{
            "aria-label": "Buscar chats, amigos y mensajes",
            role: "combobox",
            "aria-expanded": active,
            "aria-controls": "ns-results",
            "aria-autocomplete": "list",
            "aria-activedescendant": active && current >= 0 ? `ns-opt-${current}` : undefined,
            onFocus: () => { if (!active) { onActiveChange(true); onLoadFriends(); } },
            onKeyDown,
          }}
        />
      </div>
      {active && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[4px] pb-[var(--space-4)]">
          <div id="ns-results" role="listbox" aria-label={q ? `Resultados de «${q}»` : "Sugerencias"}>
            {groups.map((g) => (
              <div key={g.title} role="group" aria-label={g.title}>
                <p className="px-[12px] pb-[4px] pt-[14px] text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">{g.title}</p>
                {g.options.map((o) => {
                  n += 1;
                  const idx = n;
                  return (
                    <button
                      key={o.key}
                      id={`ns-opt-${idx}`}
                      type="button"
                      role="option"
                      aria-selected={idx === current}
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={o.run}
                      className={`flex min-h-[64px] w-full items-center gap-[12px] rounded-[8px] px-[12px] py-[8px] text-left ${idx === current ? "bg-[var(--chat-surface)]" : ""}`}
                    >
                      {o.node}
                    </button>
                  );
                })}
                {g.after}
              </div>
            ))}
            {searchingMessages && (
              <p role="status" className="px-[12px] py-[10px] text-[13px] text-muted">Buscando en tus mensajes…</p>
            )}
            {emptyResult}
          </div>
        </div>
      )}
    </div>
  );
}

/** The match in bold (board: «<b>Lu</b>cía»). */
function Hl({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlightParts(text, q).map((p, i) => (p.hit
        ? <mark key={i} className="bg-transparent font-[700] text-app">{p.text}</mark>
        : <span key={i}>{p.text}</span>))}
    </>
  );
}

/** A long message cut so the match is visible: «…el lunes quedamos para el trabajo?». */
function excerpt(text: string, q: string): string {
  const flat = text.replace(/\s+/g, " ");
  const at = foldText(flat).indexOf(foldText(q));
  if (at <= 30) return flat;
  return `…${flat.slice(at - 20)}`;
}
