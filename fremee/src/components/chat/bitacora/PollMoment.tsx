"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, BarChart3, Check, Dices, Lock, MoreHorizontal, RotateCcw } from "lucide-react";
import {
  closePoll,
  pollDecidir,
  pollDesempatar,
  pollReabrir,
  pollSortear,
  pollVote,
  pollVotos,
  type PollCierre,
  type PollDesempate,
  type PollVoteResult,
  type PollVoto,
} from "@/services/api/repositories/chat.repository";
import type { PollMoment as PollData } from "./moments";
import { DrawBoard } from "./DrawBoard";

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

export type PollState = "abierta" | "decidida" | "empate" | "sin_votos" | "cerrada";

/**
 * Where a poll is (board po-sistema). `cerrada`: closed before results were saved (or past its
 * date), so the card works the result out from the votes.
 */
export function pollState(poll: PollData): PollState {
  if (poll.resultado) return poll.resultado;
  const expired = Boolean(poll.expires_at && new Date(poll.expires_at) < new Date());
  return poll.closed || expired ? "cerrada" : "abierta";
}

/** The winning option of a decided poll, or null. */
export function pollWinner(poll: PollData): string | null {
  return poll.resultado === "decidida" && poll.ganadora != null ? poll.options[poll.ganadora] ?? null : null;
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(".", "");
const votesLabel = (n: number) => `${n} ${n === 1 ? "voto" : "votos"}`;

/**
 * Text buttons (po-sistema): no fill or border; colour says it can be pressed (grey for Cancelar,
 * accent for the action). Hover underlines, pressing dims to 0.7, keyboard focus gets a 2 px accent
 * ring (focus-visible only, so the focus moved to «Cerrar» does not paint it), 44 px touch area.
 */
const TEXT_BTN = "inline-flex min-h-[44px] items-center gap-[6px] rounded-[6px] px-[6px] text-[14px] font-[var(--fw-semibold)] underline-offset-[3px] outline-none hover:underline active:opacity-70 focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50 disabled:no-underline";
const SMALL_BTN = `${TEXT_BTN} text-muted`;
const SMALL_BTN_OK = `${TEXT_BTN} text-[var(--chat-accent-text)]`;

/** «Lucía y Marcos», «Ana, Lucía y Marcos», «Ana, Lucía y 3 más». */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${names.slice(0, 2).join(", ")} y ${names.length - 2} más`;
}

/** «Vamos a Madrid» when the question asks where to go; otherwise the option as it is. */
function decisionHeadline(question: string, option: string): string {
  return /^¿?\s*(a\s+)?d[oó]nde\s+(vamos|nos vamos|ir|viajamos)\b/i.test(question) ? `Vamos a ${option}` : option;
}

export type PollPlanAction =
  | { kind: "add"; label: string; onClick: () => void }
  | { kind: "done"; label: string; onOpen: () => void };

/**
 * A poll (boards po-*, k-momentos · Encuestas). Open: vote, change your vote, who is missing, and
 * «Cerrar encuesta» for whoever can. Closed: a milestone with its result — decided (filled diamond),
 * a tie (hollow, «Desempatar» / «Decidir yo»), or no votes (grey, dashed). The result lives here,
 * never in a text message.
 */
export function PollMoment({
  mensajeId,
  poll,
  author,
  time,
  members,
  currentUserId,
  canManage,
  canDecide,
  planAction,
  onVoted,
  onChanged,
  onDesempate,
  onJumpTo,
  onRepeat,
  drawHost,
}: {
  mensajeId: number;
  poll: PollData;
  /** «Tú» / «Ana» / «Frimee» over an open poll. */
  author: string;
  time: string;
  members: Array<{ id: string; nombre: string }>;
  currentUserId: string;
  /** Who created it or an admin (anyone if @frimee made it): «Cerrar encuesta». */
  canManage: boolean;
  /** Who created it or an admin: «Decidir yo» after a tie. */
  canDecide: boolean;
  /** Decided: «Añadir al plan» / «Crear plan a Madrid», or «En el plan» once added. */
  planAction?: PollPlanAction | null;
  /** After my vote (it may have closed the poll: then the result comes with it). */
  onVoted: (idx: number, r: PollVoteResult) => void;
  /** Closed or decided by me: the poll's new texto and the hidden «poll_cerrada». */
  onChanged: (r: PollCierre) => void;
  onDesempate: (r: PollDesempate) => void;
  onJumpTo: (mensajeId: number) => void;
  /** «Repetir la encuesta» (closed without votes). */
  onRepeat: () => void;
  /** Where the draw's departures board goes (the chat column). */
  drawHost: HTMLElement | null;
}) {
  const [votos, setVotos] = useState<PollVoto[]>([]);
  const [fetched, setFetched] = useState(false);
  const [showVotes, setShowVotes] = useState(false);
  const [changing, setChanging] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [deciding, setDeciding] = useState(false);
  // «Sortear» (boards po-*-cine): when the draw arrives while the chat is open, the departures board
  // plays over the chat, for everyone at the same time (the server's result comes by Realtime). Who
  // opens the chat later sees the milestone directly. «Volver a verlo» replays it locally: same result.
  const [drawing, setDrawing] = useState(false);
  const drawSeen = useRef(poll.decision === "sorteo");
  const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (poll.decision !== "sorteo" || drawSeen.current) return;
    drawSeen.current = true;
    const fresh = poll.decidida_at ? Date.now() - Date.parse(poll.decidida_at) < 20_000 : true;
    if (fresh && !reducedMotion()) setDrawing(true);
    // Only when the poll becomes a draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll.decision]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = mensajeId < 0;
  const confirmRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirmClose) confirmRef.current?.focus(); }, [confirmClose]);
  const cancelClose = () => { setConfirmClose(false); requestAnimationFrame(() => closeBtnRef.current?.focus()); };

  const fetchVotes = useCallback(async () => {
    if (sending) return;
    try {
      setVotos(await pollVotos(mensajeId));
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

  // Results saved at close win (votes can no longer change); otherwise count what there is.
  const counts = poll.options.map((_, i) => votos.filter((v) => v.option_index === i).length);
  const shown = poll.votos && poll.votos.length === poll.options.length ? poll.votos : counts;
  const total = shown.reduce((a, b) => a + b, 0);
  const myVote = votos.find((v) => v.user_id === currentUserId)?.option_index ?? null;
  const memberCount = Math.max(members.length, total);
  const voters = new Set(votos.map((v) => v.user_id));
  const missing = members.filter((m) => !voters.has(m.id));
  const missingMe = missing.some((m) => m.id === currentUserId);
  const missingOthers = missing.filter((m) => m.id !== currentUserId).map((m) => m.nombre.split(" ")[0] || "Alguien");

  let state = pollState(poll);
  let winnerIdx = poll.ganadora ?? null;
  let tied = poll.empatadas ?? [];
  if (state === "cerrada" && fetched) {
    // Closed before results were saved: work it out from the votes.
    const max = Math.max(0, ...shown);
    const top = shown.map((n, i) => (n === max && max > 0 ? i : -1)).filter((i) => i >= 0);
    state = top.length === 0 ? "sin_votos" : top.length === 1 ? "decidida" : "empate";
    winnerIdx = top.length === 1 ? top[0] : null;
    tied = top.length > 1 ? top : [];
  }

  const run = async (fn: () => Promise<void>, fail: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      console.error("[chat] Encuesta:", (e as { message?: string })?.message ?? String(e));
      setError(fail);
    } finally {
      setBusy(false);
    }
  };

  const vote = (idx: number) => {
    if (sending || !fetched || busy) return;
    if (myVote === idx) { setChanging(false); return; }
    const prev = votos;
    setVotos([...votos.filter((v) => v.user_id !== currentUserId), { user_id: currentUserId, nombre: "Tú", option_index: idx }]);
    setChanging(false);
    void run(async () => {
      try {
        const r = await pollVote(mensajeId, idx);
        onVoted(idx, r);
      } catch (e) {
        setVotos(prev);
        throw e;
      }
    }, "No se ha guardado tu voto. Inténtalo de nuevo.");
  };

  const close = () => run(async () => {
    const r = await closePoll(mensajeId);
    setConfirmClose(false);
    onChanged(r);
  }, "No se ha cerrado la encuesta. Inténtalo de nuevo.");

  const decide = (idx: number) => run(async () => {
    const r = await pollDecidir(mensajeId, idx);
    setDeciding(false);
    onChanged(r);
  }, "No se ha guardado la decisión. Inténtalo de nuevo.");

  // Kept for ties from before «Reabrir» / «Sortear» that already had a tie-break poll.
  void pollDesempatar;
  void onDesempate;

  const reabrir = () => run(async () => {
    onChanged(await pollReabrir(mensajeId));
  }, "No se ha reabierto la encuesta. Inténtalo de nuevo.");

  const sortear = () => run(async () => {
    const r = await pollSortear(mensajeId);
    onChanged(r);
  }, "No se ha hecho el sorteo. Inténtalo de nuevo.");

  const tiedNow = () => poll.empatadas ?? [];
  const closedMeta = () => {
    const parts = [poll.question, `${total} de ${memberCount} votos`];
    const quien = (id?: string, nombre?: string) => (id === currentUserId ? "ti" : nombre?.split(" ")[0] ?? "alguien");
    if (poll.decision === "sorteo") {
      const empate = `empate ${(poll.empatadas ?? []).map((i) => shown[i] ?? 0).join("–")}`;
      return [poll.question, empate, `sorteado por ${quien(poll.decidida_por, poll.decidida_por_nombre)}`].join(" · ") + (poll.decidida_at ? ` · ${hhmm(poll.decidida_at)}` : "");
    }
    if (poll.resultado === "empate" && fetched && missing.length === 0) {
      return [...parts, ...tiedNow().map((i) => `${poll.options[i]} ${shown[i] ?? 0}`)].join(" · ");
    }
    if (poll.decidida_por) parts.push(`decidido por ${quien(poll.decidida_por, poll.decidida_por_nombre)}`);
    else if (poll.cierre === "auto") parts.push("votasteis todos");
    else if (poll.closed_by) parts.push(poll.closed_by === currentUserId ? "cerrada por ti" : `cerrada por ${poll.closed_by_nombre?.split(" ")[0] ?? "alguien"}`);
    else if (poll.expires_at && !poll.closed) parts.push(`cerró el ${dayLabel(poll.expires_at)}`);
    const at = poll.decidida_por ? null : poll.closed_at;
    return parts.join(" · ") + (at ? ` · ${hhmm(at)}` : "");
  };

  const votesList = showVotes && (
    <ul className="mt-[8px] flex flex-col gap-[6px] text-[13px] leading-[1.4]">
      {poll.options.map((opt, i) => {
        const who = votos.filter((v) => v.option_index === i).map((v) => (v.user_id === currentUserId ? "Tú" : v.nombre.split(" ")[0]));
        return (
          <li key={i} className="text-muted">
            <span className="font-[var(--fw-semibold)] text-app">{opt}</span> · {who.length ? joinNames(who) : "nadie"}
          </li>
        );
      })}
    </ul>
  );
  const votesToggle = (
    <button type="button" onClick={() => setShowVotes((v) => !v)} aria-expanded={showVotes} className="min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">
      {showVotes ? "Ocultar votos" : "Ver votos"}
    </button>
  );
  const errorLine = error && <p role="alert" className="mt-[8px] text-[13px] text-[var(--error)]">{error}</p>;

  // Copied into a plan's chat (board cp-sistema · Encuesta copiada): a snapshot, nobody votes here.
  if (poll.copiada_at) {
    const at = new Date(poll.copiada_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
    return (
      <div className="rounded-[8px] border border-app bg-[var(--surface)] p-[14px]">
        <p className="text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">Encuesta copiada · cerrada</p>
        <p className="mt-[6px] [font-family:var(--font-display-face)] text-[26px] leading-[30px] text-app">{poll.question}</p>
        <Bars options={poll.options} counts={shown} total={total} />
        <p className="mt-[10px] text-[12px] text-muted">
          Resultados a {at} · {votesLabel(total)}. Para votar de nuevo, crea otra encuesta.
        </p>
      </div>
    );
  }

  if (state !== "abierta" && !fetched && !poll.resultado) {
    return <div className="h-[120px] rounded-[8px] border border-app bg-[var(--surface)]" aria-busy="true" />;
  }

  if (state === "sin_votos") {
    return (
      <div className="rounded-[8px] border border-dashed border-app p-[14px]">
        <p className="text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">Cerrada sin votos</p>
        <p className="mt-[4px] [font-family:var(--font-display-face)] text-[28px] leading-[32px] text-muted">{poll.question}</p>
        <p className="mt-[4px] text-[12px] text-muted">
          Nadie votó{poll.closed_by ? ` · ${poll.closed_by === currentUserId ? "cerrada por ti" : `cerrada por ${poll.closed_by_nombre?.split(" ")[0] ?? "alguien"}`}` : ""}{poll.closed_at ? ` · ${hhmm(poll.closed_at)}` : ""}
        </p>
        <button type="button" onClick={onRepeat} className="mt-[6px] min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">
          Repetir la encuesta
        </button>
      </div>
    );
  }

  if (state === "decidida" || state === "cerrada") {
    const winner = winnerIdx != null ? poll.options[winnerIdx] : null;
    const isDraw = poll.decision === "sorteo";
    const drawTied = (poll.empatadas ?? []).map((i) => poll.options[i]).filter(Boolean);
    const launcher = poll.decidida_por === currentUserId ? "ti" : poll.decidida_por_nombre?.split(" ")[0] ?? "alguien";
    const board = drawing && winner && (
      <DrawBoard
        host={drawHost}
        winner={winner}
        headline={decisionHeadline(poll.question, winner)}
        question={poll.question}
        tied={drawTied}
        launcher={launcher}
        onDone={() => setDrawing(false)}
      />
    );
    if (drawing) {
      // Board po-*-cine «Sorteando…»: the card waits under the board; it turns when the board goes.
      return (
        <div className="rounded-[8px] border border-app bg-[var(--surface)] p-[14px]">
          <p className="flex items-center gap-[6px] text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-[var(--chat-accent-text)]">
            <Dices className="size-[14px]" aria-hidden />Sorteando…
          </p>
          <p className="mt-[4px] [font-family:var(--font-display-face)] text-[28px] leading-[32px] text-app">{drawTied.join(" o ")}</p>
          <p className="mt-[4px] text-[12px] text-muted">
            {[poll.question, `${total} de ${memberCount} votos`, ...(poll.empatadas ?? []).map((i) => `${poll.options[i]} ${shown[i] ?? 0}`)].join(" · ")}
          </p>
          <p className="mt-[8px] text-[13px] text-muted">
            {launcher === "ti" ? "Has lanzado el sorteo" : `${launcher} ha lanzado el sorteo`} · todos veis el mismo resultado
          </p>
          {board}
        </div>
      );
    }
    return (
      <div className="rounded-[8px] border border-app bg-[var(--surface)] p-[14px]">
        <p className="flex items-center gap-[6px] text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-[var(--chat-accent-text)]">
          {isDraw && <Dices className="size-[14px]" aria-hidden />}
          {isDraw ? "Decidido por sorteo" : "Decidido"}
        </p>
        <p className="mt-[4px] [font-family:var(--font-display-face)] text-[28px] leading-[32px] text-app">
          {winner ? decisionHeadline(poll.question, winner) : poll.question}
        </p>
        <p className="mt-[4px] text-[12px] text-muted">{closedMeta()}</p>
        <Bars options={poll.options} counts={shown} total={total} winner={winnerIdx} />
        {votesList}
        <div className="mt-[6px] flex flex-wrap items-center gap-x-[16px]">
          {planAction?.kind === "add" && (
            <button type="button" onClick={planAction.onClick} className="mt-[6px] flex min-h-[44px] items-center gap-[8px] rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90">
              <svg aria-hidden viewBox="0 0 24 24" className="size-[16px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round"><path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" /></svg>
              {planAction.label}
            </button>
          )}
          {planAction?.kind === "done" && (
            <>
              <span className="flex items-center gap-[6px] text-[13px] text-muted">
                <Check className="size-[14px] text-[var(--chat-accent-text)]" strokeWidth={2.5} aria-hidden />{planAction.label}
              </span>
              <button type="button" onClick={planAction.onOpen} className="min-h-[44px] text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Ver en el plan</button>
            </>
          )}
          {votesToggle}
          {isDraw && winner && drawHost && !reducedMotion() && (
            <button type="button" onClick={() => setDrawing(true)} className={SMALL_BTN}>
              <Dices className="size-[15px]" aria-hidden />Volver a verlo
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state === "empate") {
    const tiedNames = tied.map((i) => poll.options[i]).filter(Boolean);
    return (
      <div className="rounded-[8px] border border-app bg-[var(--surface)] p-[14px]">
        <p className="flex items-center gap-[6px] text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-app">
          <ArrowLeftRight className="size-[14px]" aria-hidden />Empate · sin decidir
        </p>
        <p className="mt-[4px] [font-family:var(--font-display-face)] text-[28px] leading-[32px] text-app">{tiedNames.join(" o ")}</p>
        <p className="mt-[4px] text-[12px] text-muted">{closedMeta()}</p>
        <Bars options={poll.options} counts={shown} total={total} />
        {fetched && missing.length > 0 && (
          <p className="mt-[10px] text-[13px] text-muted">
            {missingMe
              ? `${missingOthers.length ? `Faltasteis ${joinNames(["tú", ...missingOthers])}` : "Faltaste tú"} por votar.`
              : `${missingOthers.length === 1 ? "Faltó" : "Faltaron"} ${joinNames(missingOthers)} por votar.`}
          </p>
        )}
        {votesList}
        <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
          {poll.desempate_id ? (
            <button type="button" onClick={() => onJumpTo(poll.desempate_id!)} className="min-h-[44px] text-[13px] text-muted underline-offset-2 hover:underline">
              Desempate abierto más abajo
            </button>
          ) : deciding ? (
            // «Decidir yo» in the card itself (no sheet): which of the tied ones, or Cancelar.
            <div role="group" aria-label="Decidir entre las empatadas" className="flex flex-wrap items-center gap-[8px]">
              <span className="text-[13px] font-[var(--fw-semibold)] text-app">¿Cuál?</span>
              {tied.map((i, k) => (
                <button key={i} type="button" autoFocus={k === 0} disabled={busy} onClick={() => void decide(i)} onKeyDown={(e) => { if (e.key === "Escape") setDeciding(false); }} className="min-h-[44px] rounded-[8px] border border-app px-[14px] text-[15px] font-[var(--fw-semibold)] text-app transition-colors hover:border-[var(--chat-me-border)] disabled:opacity-60">
                  {poll.options[i]}
                </button>
              ))}
              <button type="button" onClick={() => setDeciding(false)} className={SMALL_BTN}>Cancelar</button>
            </div>
          ) : (
            <>
              {fetched && missing.length > 0 && canManage && (
                <button type="button" disabled={busy} onClick={() => void reabrir()} className="flex min-h-[44px] items-center gap-[8px] rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-60">
                  <RotateCcw className="size-[16px]" aria-hidden />
                  Reabrir para {joinNames(missing.map((m) => (m.id === currentUserId ? "ti" : m.nombre.split(" ")[0] || "Alguien")))}
                </button>
              )}
              {fetched && missing.length === 0 && (
                <button type="button" disabled={busy} onClick={() => void sortear()} className="flex min-h-[44px] items-center gap-[8px] rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-60">
                  <Dices className="size-[16px]" aria-hidden />{busy ? "Sorteando…" : "Sortear"}
                </button>
              )}
              {canDecide && (
                <button type="button" disabled={busy} onClick={() => setDeciding(true)} className={`${SMALL_BTN_OK} ml-[4px]`}>
                  Decidir yo
                </button>
              )}
            </>
          )}
          {!deciding && <button type="button" onClick={() => setShowVotes((v) => !v)} aria-expanded={showVotes} className={SMALL_BTN}>{showVotes ? "Ocultar votos" : "Ver votos"}</button>}
        </div>
        {errorLine}
      </div>
    );
  }

  // Open (or the tie-break of an earlier poll).
  const tiebreak = poll.desempate_de != null;
  const showRadios = myVote === null || changing;
  let tally: string;
  if (missing.length === 0) tally = `${total} de ${memberCount} votos`;
  else if (missing.length === 1) tally = missingMe ? "Faltas tú · se cierra cuando votes" : `Falta ${missingOthers[0]} · se cierra cuando vote`;
  else tally = `${total} de ${memberCount} votos · ${missingMe ? `faltáis ${joinNames(["tú", ...missingOthers])}` : `faltan ${joinNames(missingOthers)}`}`;

  return (
    <div>
      {!tiebreak && (
        <div className="flex min-h-[20px] items-baseline gap-[8px] pt-[4px]">
          <span className="text-[13px] font-[var(--fw-semibold)] text-app">{author}</span>
          <span className="text-[12px] tabular-nums text-muted">{time}</span>
        </div>
      )}
      <div className={`${tiebreak ? "" : "mt-[6px]"} rounded-[8px] border bg-[var(--surface)] px-[14px] pt-[12px] ${tiebreak ? "border-[var(--chat-me-border)]" : "border-app"}`}>
        <div className="flex items-center gap-[6px]">
          <span className={`flex-1 text-[12px] font-[var(--fw-semibold)] tracking-[.02em] ${tiebreak ? "text-[var(--chat-accent-text)]" : "text-muted"}`}>
            <span className="flex items-center gap-[6px]">
              {tiebreak ? <ArrowLeftRight className="size-[14px]" aria-hidden /> : <BarChart3 className="size-[14px]" aria-hidden />}
              {tiebreak ? "Desempate · abierta" : poll.reabierta_at ? "Encuesta · reabierta" : "Encuesta · abierta"}
            </span>
          </span>
          {canManage && !sending && (
            <div className="relative">
              <button type="button" aria-label="Más opciones de la encuesta" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} className="-my-[8px] flex size-[36px] items-center justify-center rounded-[8px] text-muted hover:bg-[var(--surface-2)]">
                <MoreHorizontal className="size-[18px]" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-[32px] z-[5] min-w-[180px] rounded-[8px] border border-app bg-[var(--bg)] p-[4px] shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setConfirmClose(true); }} className="flex min-h-[40px] w-full items-center gap-[8px] rounded-[6px] px-[10px] text-left text-[15px] text-app hover:bg-[var(--surface-2)]">
                    <Lock className="size-[16px] text-muted" aria-hidden />Cerrar encuesta
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="mt-[4px] [font-family:var(--font-display-face)] text-[24px] leading-[28px] text-app">{poll.question}</p>
        {tiebreak && (
          <p className="mt-[4px] text-[12px] text-muted">
            {total} de {memberCount} votos ·{" "}
            <button type="button" onClick={() => onJumpTo(poll.desempate_de!)} className="underline-offset-2 hover:underline">
              viene del empate{poll.desempate_de_at ? ` de las ${hhmm(poll.desempate_de_at)}` : ""}
            </button>
          </p>
        )}
        {showRadios ? (
          <div role="radiogroup" aria-label="Opciones" className="flex flex-col">
            {poll.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={myVote === i}
                disabled={!fetched || sending || busy}
                onClick={() => vote(i)}
                className={`mt-[8px] flex min-h-[48px] w-full items-center gap-[10px] rounded-[8px] border px-[12px] text-left text-[15px] font-[var(--fw-semibold)] text-app transition-colors hover:border-[var(--chat-me-border)] disabled:opacity-50 ${myVote === i ? "border-[var(--primary)]" : "border-[var(--border-strong,var(--border))]"}`}
              >
                <span aria-hidden className={`relative size-[20px] shrink-0 rounded-full border-2 ${myVote === i ? "border-[var(--primary)]" : "border-[var(--border-strong,var(--border))]"}`}>
                  {myVote === i && <span className="absolute inset-[3px] rounded-full bg-[var(--primary)]" />}
                </span>
                <span className="min-w-0 flex-1 break-words">{opt}</span>
                {!tiebreak && <span className="shrink-0 text-[12px] font-normal tabular-nums text-muted">{votesLabel(shown[i] ?? 0)}</span>}
              </button>
            ))}
          </div>
        ) : (
          <>
            <Bars options={poll.options} counts={shown} total={total} mine={myVote} />
            <p className="mt-[8px] text-[13px] text-muted">
              Tu voto: {poll.options[myVote ?? 0]} ·{" "}
              <button type="button" onClick={() => setChanging(true)} className="min-h-[28px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Cambiar</button>
            </p>
          </>
        )}
        {errorLine}
        {confirmClose ? (
          // Board po-m-confirmar: the footer row itself asks (no modal, no sheet).
          <div role="group" aria-label="Confirmar cierre" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); cancelClose(); } }} className="mt-[10px] flex min-h-[44px] items-center justify-between gap-[8px] border-t border-app">
            <span className="min-w-0 text-[13px]">
              <b className="font-[var(--fw-semibold)] text-app">¿Cerrar?</b>{" "}
              <span className="text-muted">{closeOutcome(poll.options, shown)}</span>
            </span>
            <span className="flex shrink-0 gap-[8px] py-[4px]">
              <button type="button" onClick={cancelClose} disabled={busy} className={SMALL_BTN}>Cancelar</button>
              <button ref={confirmRef} type="button" onClick={() => void close()} disabled={busy} className={SMALL_BTN_OK}>
                <Lock className="size-[15px]" aria-hidden />{busy ? "Cerrando…" : "Cerrar"}
              </button>
            </span>
          </div>
        ) : tiebreak ? (
          <p className="pb-[12px] pt-[10px] text-[13px] text-muted">
            {canManage ? `Se cierra cuando votéis los ${memberCount} o cuando la cierres.` : `Se cierra cuando votéis los ${memberCount}.`}
          </p>
        ) : (
          <div className="mt-[10px] flex min-h-[44px] items-center justify-between gap-[8px] border-t border-app">
            <span className="text-[12px] tabular-nums text-muted">{fetched ? tally : ""}</span>
            {canManage && !sending && (
              <button ref={closeBtnRef} type="button" onClick={() => setConfirmClose(true)} className={`${SMALL_BTN} -mr-[6px]`}>
                <Lock className="size-[14px]" aria-hidden />Cerrar encuesta
              </button>
            )}
          </div>
        )}
      </div>
      {poll.expires_at && !tiebreak && (
        <p className="mt-[4px] text-[12px] text-muted">Se cierra el {dayLabel(poll.expires_at)}</p>
      )}
    </div>
  );
}

/** What closing now would leave: «Ganaría Madrid», «Quedaría en empate», «Se cerraría sin votos». */
function closeOutcome(options: string[], counts: number[]): string {
  const max = Math.max(0, ...counts);
  const top = counts.map((n, i) => (n === max && max > 0 ? i : -1)).filter((i) => i >= 0);
  if (top.length === 0) return "Se cerraría sin votos";
  if (top.length === 1) return `Ganaría ${options[top[0]]}`;
  return "Quedaría en empate";
}

/** Result bars: label + «N votos» on top, a thin bar below; the winner (or my vote) in accent. */
function Bars({
  options, counts, total, winner = null, mine = null,
}: {
  options: string[];
  counts: number[];
  total: number;
  winner?: number | null;
  mine?: number | null;
}) {
  return (
    <ul className="flex flex-col">
      {options.map((opt, i) => {
        const n = counts[i] ?? 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        const strong = winner === i || mine === i;
        return (
          <li key={i} className="mt-[8px]">
            <div className="flex justify-between gap-[8px] text-[14px] text-app">
              <span className={`flex min-w-0 items-center gap-[6px] break-words ${strong ? "font-[var(--fw-semibold)]" : ""}`}>
                {strong && <Check className="size-[14px] shrink-0" strokeWidth={2.5} aria-label={winner === i ? "Ganadora" : "Tu voto"} />}
                {opt}
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted">{votesLabel(n)}</span>
            </div>
            <div className="mt-[4px] h-[6px] rounded-[3px] bg-[var(--surface-2)]">
              <i className="block h-[6px] rounded-[3px] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%`, background: strong ? "var(--primary)" : "var(--text-secondary)" }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
