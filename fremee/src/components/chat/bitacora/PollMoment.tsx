"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { pollGetVotes, pollVote } from "@/services/api/repositories/chat.repository";
import type { PollMoment as PollData } from "./moments";

// Module-level emitter: the chat's broadcast channel tells every PollMoment of a message to refetch.
const pollVoteCallbacks = new Map<number, Set<() => void>>();
export function emitPollVote(mensajeId: number) {
  pollVoteCallbacks.get(mensajeId)?.forEach((fn) => fn());
}
function subscribePollVote(mensajeId: number, fn: () => void): () => void {
  if (!pollVoteCallbacks.has(mensajeId)) pollVoteCallbacks.set(mensajeId, new Set());
  pollVoteCallbacks.get(mensajeId)!.add(fn);
  return () => { pollVoteCallbacks.get(mensajeId)?.delete(fn); };
}

const closesLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(".", "");

/**
 * A poll is a milestone (board k-momentos · Encuestas): it breaks the column and leaves a diamond on
 * the spine. Results stay hidden until you vote; once closed (or past its date) it becomes a stamp
 * with the decision. Sealing it into the plan comes in phase 5.
 */
export function PollMoment({
  mensajeId,
  poll,
  askedBy,
  members,
  onVote,
}: {
  mensajeId: number;
  poll: PollData;
  /** «Marcos pregunta» / «Preguntas tú». */
  askedBy: string;
  members: number;
  onVote?: (idx: number) => void;
}) {
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [myVote, setMyVote] = useState<number | null>(null);
  const [fetched, setFetched] = useState(false);
  const [showVotes, setShowVotes] = useState(false);
  const sending = mensajeId < 0;

  const fetchVotes = useCallback(async () => {
    if (sending) return;
    try {
      const data = await pollGetVotes(mensajeId);
      const map: Record<number, number> = {};
      let mine: number | null = null;
      for (const row of data) {
        map[row.option_index] = Number(row.vote_count);
        if (row.voted_by_me) mine = row.option_index;
      }
      setVotes(map);
      setMyVote(mine);
    } catch (e) {
      console.error("[chat] Error leyendo votos:", (e as { message?: string })?.message ?? String(e));
    } finally {
      setFetched(true);
    }
  }, [mensajeId, sending]);

  useEffect(() => {
    if (sending) { setFetched(true); return; }
    void fetchVotes();
    return subscribePollVote(mensajeId, () => { void fetchVotes(); });
  }, [fetchVotes, mensajeId, sending]);

  const handleVote = async (idx: number) => {
    if (sending || myVote === idx) return;
    const prevVote = myVote;
    const prevVotes = votes;
    const next = { ...votes };
    if (prevVote !== null) next[prevVote] = Math.max(0, (next[prevVote] ?? 0) - 1);
    next[idx] = (next[idx] ?? 0) + 1;
    setMyVote(idx);
    setVotes(next);
    try {
      await pollVote(mensajeId, idx);
      onVote?.(idx);
    } catch {
      setMyVote(prevVote);
      setVotes(prevVotes);
    }
  };

  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const expired = Boolean(poll.expires_at && new Date(poll.expires_at) < new Date());
  const decided = Boolean(poll.closed || expired);
  const voted = myVote !== null;
  const showResults = decided || voted || showVotes;
  const votersLine = `${total} de ${Math.max(members, total)} han votado`;
  const pct = (i: number) => (total > 0 ? Math.round(((votes[i] ?? 0) / total) * 100) : 0);

  // Copied into a plan's chat (board cp-sistema · Encuesta copiada): a snapshot of the results,
  // with neutral bars because nobody can vote here.
  if (poll.copiada_at) {
    const at = new Date(poll.copiada_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
    return (
      <div className="rounded-[8px] border border-app bg-[var(--surface)] p-[14px]">
        <p className="text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">Encuesta copiada · cerrada</p>
        <p className="mt-[6px] [font-family:var(--font-display-face)] text-[26px] leading-[30px] text-app">{poll.question}</p>
        <ul className="mt-[12px] flex flex-col gap-[8px]">
          {poll.options.map((opt, i) => (
            <li key={i} className="relative flex min-h-[44px] items-center justify-between gap-[8px] overflow-hidden rounded-[8px] border border-app px-[12px] py-[10px] text-[15px] text-app">
              <span aria-hidden className="absolute inset-y-0 left-0 rounded-[8px] bg-[var(--surface-2)]" style={{ width: `${pct(i)}%` }} />
              <span className="relative min-w-0 break-words">{opt}</span>
              <span className="relative shrink-0 tabular-nums text-muted">{votes[i] ?? 0}<span className="sr-only"> votos</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-[10px] text-[12px] text-muted">
          Resultados a {at} · {total} {total === 1 ? "voto" : "votos"}. Para votar de nuevo, crea otra encuesta.
        </p>
      </div>
    );
  }

  if (decided && fetched) {
    const max = Math.max(0, ...poll.options.map((_, i) => votes[i] ?? 0));
    const winners = poll.options.filter((_, i) => max > 0 && (votes[i] ?? 0) === max);
    const headline = winners.length === 1 ? winners[0] : winners.length > 1 ? `Empate: ${winners.join(" o ")}` : "Sin votos";
    return (
      <div className="rounded-[8px] border border-app bg-[var(--surface)] p-[14px]">
        <p className="text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-[var(--chat-accent-text)]">Decidido</p>
        <p className="mt-[4px] [font-family:var(--font-display-face)] text-[28px] leading-[32px] text-app">{headline}</p>
        <p className="mt-[6px] text-[12px] text-muted">
          {poll.question} · {total} de {Math.max(members, total)} votos{poll.expires_at ? ` · cerrada el ${closesLabel(poll.expires_at)}` : " · cerrada"}
        </p>
        <button type="button" onClick={() => setShowVotes((v) => !v)} className="mt-[10px] min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]" aria-expanded={showVotes}>
          {showVotes ? "Ocultar votos" : "Ver votos"}
        </button>
        {showVotes && <PollBars poll={poll} pct={pct} votes={votes} myVote={myVote} />}
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-app bg-[var(--surface)] p-[14px]">
      <p className="flex flex-wrap gap-x-[8px] text-[12px] text-muted">
        <span className="font-[var(--fw-semibold)] tracking-[.02em] text-app">Encuesta</span>
        <span>{askedBy}</span>
        {poll.expires_at && <span>· Cierra el {closesLabel(poll.expires_at)}</span>}
      </p>
      <p className="mt-[6px] [font-family:var(--font-display-face)] text-[26px] leading-[30px] text-app">{poll.question}</p>
      {showResults ? (
        <PollBars poll={poll} pct={pct} votes={votes} myVote={myVote} onVote={fetched && !sending ? (i) => void handleVote(i) : undefined} />
      ) : (
        <div className="mt-[12px] flex flex-col gap-[8px]">
          {poll.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={!fetched || sending}
              onClick={() => void handleVote(i)}
              className="min-h-[44px] rounded-[8px] border border-app bg-[var(--bg)] px-[12px] py-[10px] text-left text-[15px] text-app transition-colors hover:border-[var(--chat-me-border)] disabled:opacity-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      <p className="mt-[10px] text-[12px] text-muted">
        {votersLine}{!voted && !showVotes ? " · vota para ver resultados" : ""}
      </p>
    </div>
  );
}

function PollBars({
  poll, pct, votes, myVote, onVote,
}: {
  poll: PollData;
  pct: (i: number) => number;
  votes: Record<number, number>;
  myVote: number | null;
  onVote?: (i: number) => void;
}) {
  return (
    <ul className="mt-[12px] flex flex-col gap-[8px]">
      {poll.options.map((opt, i) => {
        const p = pct(i);
        const mine = myVote === i;
        const row = (
          <>
            <span aria-hidden className="absolute inset-y-0 left-0 rounded-[8px] bg-[var(--chat-tint)] transition-[width] duration-500" style={{ width: `${p}%` }} />
            <span className="relative flex min-w-0 items-center gap-[6px]">
              {mine && <Check className="size-[14px] shrink-0 text-[var(--chat-accent-text)]" strokeWidth={2.5} aria-label="Tu voto" />}
              <span className="min-w-0 break-words">{opt}</span>
            </span>
            <span className="relative shrink-0 tabular-nums text-muted">{p} %<span className="sr-only">, {votes[i] ?? 0} votos</span></span>
          </>
        );
        const cls = `relative flex min-h-[44px] w-full items-center justify-between gap-[8px] overflow-hidden rounded-[8px] border px-[12px] py-[10px] text-left text-[15px] text-app ${mine ? "border-[var(--chat-me-border)]" : "border-app"}`;
        return (
          <li key={i}>
            {onVote ? <button type="button" onClick={() => onVote(i)} className={cls}>{row}</button> : <div className={cls}>{row}</div>}
          </li>
        );
      })}
    </ul>
  );
}
