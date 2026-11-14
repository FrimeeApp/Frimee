/**
 * Chat as a "Bitácora" (Claude Design canvas "Frimee · Chat · Bitácora"): a timeline where days are
 * chapters and each person's run of messages is a turn. This module only decides the layout of each
 * message; ChatConversation keeps loading, realtime, gestures and menus.
 */

type TimelineMessage = { sender_id: string; created_at: string | null | undefined; tipo?: string | null };

/** Messages closer than this, from the same person, read as one turn (one time, no repeated avatar). */
export const BURST_GAP_MS = 2 * 60 * 1000;

export type ChapterLabel = { title: string; subtitle: string };

export type TimelineSlot = {
  /** Set when this message opens a new day. */
  chapter: ChapterLabel | null;
  /** First message of a turn: a new author, a new day or a pause longer than BURST_GAP_MS. */
  startsTurn: boolean;
  /** Last message of its turn (spacing below it). */
  endsTurn: boolean;
};

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(from: Date, to: Date) {
  return Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / 86_400_000);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The chapter for a day. Without a trip: «Hoy», «Ayer», «Lunes 10» with the full date below.
 * With the dates of the chat's plan: before it «faltan 14 días», during it «Día 2», after it the date.
 */
export function chapterLabel(day: Date, now: Date = new Date(), trip?: { start: Date; end: Date } | null): ChapterLabel {
  const longDate = day.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", ...(day.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
  const ago = daysBetween(day, now);
  const relative = ago === 0 ? "Hoy" : ago === 1 ? "Ayer" : capitalize(day.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" }));

  if (trip) {
    const toStart = daysBetween(day, trip.start);
    const sinceStart = daysBetween(trip.start, day);
    const length = daysBetween(trip.start, trip.end) + 1;
    if (toStart > 0) {
      return { title: relative, subtitle: `${longDate} · ${toStart === 1 ? "falta 1 día" : `faltan ${toStart} días`}` };
    }
    if (sinceStart >= 0 && sinceStart < length) {
      return { title: `Día ${sinceStart + 1}`, subtitle: `${ago === 0 ? "hoy · " : ago === 1 ? "ayer · " : ""}${longDate}` };
    }
  }
  return { title: relative, subtitle: longDate };
}

/** One slot per message, in the same order. */
export function buildTimeline<T extends TimelineMessage>(messages: T[], trip?: { start: Date; end: Date } | null, now: Date = new Date()): TimelineSlot[] {
  const dates = messages.map((m) => (m.created_at ? new Date(m.created_at) : null));
  const isCall = (m: T) => Boolean(m.tipo?.startsWith("call_"));

  const startsTurnAt = (i: number) => {
    if (i === 0) return true;
    const prev = messages[i - 1];
    const cur = messages[i];
    const a = dates[i - 1];
    const b = dates[i];
    if (!a || !b) return prev.sender_id !== cur.sender_id;
    if (dayStart(a).getTime() !== dayStart(b).getTime()) return true;
    // A call record is its own moment, not part of someone's run of messages.
    if (isCall(prev) || isCall(cur)) return true;
    return prev.sender_id !== cur.sender_id || b.getTime() - a.getTime() > BURST_GAP_MS;
  };

  return messages.map((_, i) => {
    const d = dates[i];
    const prevD = i > 0 ? dates[i - 1] : null;
    const newDay = d && (!prevD || dayStart(prevD).getTime() !== dayStart(d).getTime());
    return {
      chapter: newDay && d ? chapterLabel(d, now, trip) : null,
      startsTurn: startsTurnAt(i),
      endsTurn: i === messages.length - 1 || startsTurnAt(i + 1),
    };
  });
}
