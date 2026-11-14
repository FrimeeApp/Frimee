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
  /**
   * First message of a burst: messages less than BURST_GAP_MS apart, whoever writes them, read as
   * one exchange with a single time at its start (board «Comprobación · ráfaga»).
   */
  startsBurst: boolean;
  /** Last message of its burst. */
  endsBurst: boolean;
  /** The burst has more than one message (a lone message keeps the regular layout). */
  inBurst: boolean;
  /** First message of a turn: the burst starts or the author changes inside it. */
  startsTurn: boolean;
  /** Last message of its turn. */
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
  const otherYear = day.getFullYear() !== now.getFullYear();
  const weekday = day.toLocaleDateString("es-ES", { weekday: "long" });
  const month = day.toLocaleDateString("es-ES", { month: "long" });
  // «sábado 14 de noviembre» (no comma), with the year only when it is not this one
  const longDate = `${weekday} ${day.getDate()} de ${month}${otherYear ? ` de ${day.getFullYear()}` : ""}`;
  const monthOnly = `${month}${otherYear ? ` de ${day.getFullYear()}` : ""}`;
  const ago = daysBetween(day, now);
  const isNear = ago === 0 || ago === 1;
  const relative = ago === 0 ? "Hoy" : ago === 1 ? "Ayer" : `${capitalize(weekday)} ${day.getDate()}`;
  // The title already names the weekday and day: below it, only what it leaves out.
  const rest = isNear ? longDate : monthOnly;

  if (trip) {
    const toStart = daysBetween(day, trip.start);
    const sinceStart = daysBetween(trip.start, day);
    const length = daysBetween(trip.start, trip.end) + 1;
    if (toStart > 0) {
      return { title: relative, subtitle: `${rest} · ${toStart === 1 ? "falta 1 día" : `faltan ${toStart} días`}` };
    }
    if (sinceStart >= 0 && sinceStart < length) {
      return { title: `Día ${sinceStart + 1}`, subtitle: `${ago === 0 ? "hoy · " : ago === 1 ? "ayer · " : ""}${longDate}` };
    }
  }
  return { title: relative, subtitle: rest };
}

/** Where the trip stands, for the chat header: «en 14 días», «mañana», «día 2 de 5», «terminado». */
export function tripStatus(trip: { start: Date; end: Date }, now: Date = new Date()): string {
  const toStart = daysBetween(now, trip.start);
  const length = daysBetween(trip.start, trip.end) + 1;
  if (toStart > 1) return `en ${toStart} días`;
  if (toStart === 1) return "mañana";
  const day = daysBetween(trip.start, now) + 1;
  if (day >= 1 && day <= length) return day === 1 ? "empieza hoy" : `día ${day} de ${length}`;
  return "terminado";
}

/** «21–25 nov», «30 dic – 2 ene» */
export function tripRange(trip: { start: Date; end: Date }): string {
  const month = (d: Date) => d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  if (trip.start.getMonth() === trip.end.getMonth() && trip.start.getFullYear() === trip.end.getFullYear()) {
    return trip.start.getDate() === trip.end.getDate()
      ? `${trip.start.getDate()} ${month(trip.start)}`
      : `${trip.start.getDate()}–${trip.end.getDate()} ${month(trip.end)}`;
  }
  return `${trip.start.getDate()} ${month(trip.start)} – ${trip.end.getDate()} ${month(trip.end)}`;
}

/** One slot per message, in the same order. */
export function buildTimeline<T extends TimelineMessage>(messages: T[], trip?: { start: Date; end: Date } | null, now: Date = new Date()): TimelineSlot[] {
  const dates = messages.map((m) => (m.created_at ? new Date(m.created_at) : null));
  const isCall = (m: T) => Boolean(m.tipo?.startsWith("call_"));

  const startsBurstAt = (i: number) => {
    if (i === 0) return true;
    const prev = messages[i - 1];
    const cur = messages[i];
    // A call record is its own moment, not part of an exchange of messages.
    if (isCall(prev) || isCall(cur)) return true;
    const a = dates[i - 1];
    const b = dates[i];
    if (!a || !b) return true;
    if (dayStart(a).getTime() !== dayStart(b).getTime()) return true;
    return b.getTime() - a.getTime() > BURST_GAP_MS;
  };
  const startsTurnAt = (i: number) => startsBurstAt(i) || messages[i - 1].sender_id !== messages[i].sender_id;

  const n = messages.length;
  const burstStarts = messages.map((_, i) => startsBurstAt(i));
  const endsBurstAt = (i: number) => i === n - 1 || burstStarts[i + 1];

  return messages.map((_, i) => {
    const d = dates[i];
    const prevD = i > 0 ? dates[i - 1] : null;
    const newDay = d && (!prevD || dayStart(prevD).getTime() !== dayStart(d).getTime());
    const startsBurst = burstStarts[i];
    const endsBurst = endsBurstAt(i);
    return {
      chapter: newDay && d ? chapterLabel(d, now, trip) : null,
      startsBurst,
      endsBurst,
      inBurst: !(startsBurst && endsBurst),
      startsTurn: startsTurnAt(i),
      endsTurn: i === n - 1 || startsTurnAt(i + 1),
    };
  });
}

/** The messages sorted by time (stable, by id on ties); the same array when they already are. */
export function inTimeOrder<T extends { id: number; created_at: string | null | undefined }>(messages: T[]): T[] {
  const time = (m: T) => (m.created_at ? new Date(m.created_at).getTime() : Number.POSITIVE_INFINITY);
  const sorted = messages.every((m, i) => i === 0 || time(messages[i - 1]) <= time(m));
  if (sorted) return messages;
  return [...messages].sort((a, b) => time(a) - time(b) || a.id - b.id);
}
