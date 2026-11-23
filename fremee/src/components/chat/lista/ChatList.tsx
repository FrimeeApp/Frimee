"use client";

import Image from "next/image";
import { useState } from "react";
import { BarChart2, CalendarDays, ChevronDown, ChevronRight, FileText, Image as ImageIcon, MapPin, Mic, Phone, Receipt, Video } from "lucide-react";
import { formatChatTime, resolveChatAvatar, resolveChatName, type ChatListItem } from "@/services/api/repositories/chat.repository";
import { GroupIcon } from "@/components/chat/ChatConversation";
import { momentPreview, parseMoment } from "@/components/chat/bitacora/moments";
import { tripStatus } from "@/components/chat/bitacora/timeline";
import { FlightBadge } from "@/components/flights/FlightLine";
import { flightA11y, flightPreview, flightStateAt, useFriendFlight } from "@/components/flights/flight-data";

export type ChatFilter = "todos" | "viajes" | "personas" | "noleidos";

/** How many trips «Todos» shows above the people (the rest, in the «Viajes» filter). */
const TRIPS_ON_TOP = 3;

type Trip = { start: Date; end: Date };
type Phase = "curso" | "proximo" | "terminado" | "sinfecha";

function tripOf(c: ChatListItem): Trip | null {
  return c.plan_inicio_at && c.plan_fin_at ? { start: new Date(c.plan_inicio_at), end: new Date(c.plan_fin_at) } : null;
}
function phaseOf(c: ChatListItem, now: Date): Phase {
  const t = tripOf(c);
  if (!t) return "sinfecha";
  const s = tripStatus(t, now);
  if (s === "terminado") return "terminado";
  if (s === "empieza hoy" || s.startsWith("día ")) return "curso";
  return "proximo";
}
const byStart = (a: ChatListItem, b: ChatListItem) => (a.plan_inicio_at ?? "9999").localeCompare(b.plan_inicio_at ?? "9999");

/**
 * The Messages list (boards li-*): filters Todos · Viajes · Personas · No leídos. «Todos» shows at
 * most 3 trips (on now, then with unread messages, then the nearest upcoming; never finished ones)
 * and «Ver los N viajes» opens the «Viajes» filter, so chats with people are never buried.
 */
export function ChatList({
  chats, userId, selectedChatId, filter, onFilter, onOpen,
}: {
  chats: ChatListItem[];
  userId: string;
  selectedChatId: string | null;
  filter: ChatFilter;
  onFilter: (f: ChatFilter) => void;
  onOpen: (chatId: string) => void;
}) {
  const [showEnded, setShowEnded] = useState(false);
  const now = new Date();
  const trips = chats.filter((c) => c.tipo === "PLAN");
  const people = chats.filter((c) => c.tipo !== "PLAN");
  const unreadChats = chats.filter((c) => c.unread_count > 0);
  const phase = new Map(trips.map((c) => [c.chat_id, phaseOf(c, now)]));

  const row = (c: ChatListItem) => (
    <ChatRow key={c.chat_id} chat={c} userId={userId} selected={c.chat_id === selectedChatId} phase={phase.get(c.chat_id)} now={now} onOpen={onOpen} />
  );

  let body: React.ReactNode;
  if (filter === "todos") {
    const live = trips.filter((c) => phase.get(c.chat_id) !== "terminado");
    const onNow = live.filter((c) => phase.get(c.chat_id) === "curso").sort((a, b) => (a.plan_fin_at ?? "").localeCompare(b.plan_fin_at ?? ""));
    const unread = live.filter((c) => c.unread_count > 0 && phase.get(c.chat_id) !== "curso").sort(byStart);
    const next = live.filter((c) => c.unread_count === 0 && phase.get(c.chat_id) !== "curso").sort(byStart);
    const top = [...onNow, ...unread, ...next].slice(0, TRIPS_ON_TOP);
    const topIds = new Set(top.map((c) => c.chat_id));
    const hiddenUnread = trips.filter((c) => !topIds.has(c.chat_id) && c.unread_count > 0).length;
    const more = trips.length > TRIPS_ON_TOP;
    body = (
      <>
        {top.length > 0 && (
          <Section title="Viajes">
            {top.map(row)}
            {more && (
              <button
                type="button"
                onClick={() => onFilter("viajes")}
                aria-label={`Ver los ${trips.length} viajes${hiddenUnread ? `, ${hiddenUnread} con mensajes nuevos` : ""}`}
                className="mx-[var(--space-4)] mb-[4px] mt-[2px] flex min-h-[44px] w-[calc(100%-2*var(--space-4))] items-center gap-[8px] text-left text-[14px] font-[var(--fw-semibold)] text-primary-token"
              >
                Ver los {trips.length} viajes
                {hiddenUnread > 0 && (
                  <span className="inline-flex items-center gap-[6px] text-[12px] font-[500] text-muted">
                    <span aria-hidden className="size-[6px] rounded-full bg-[var(--primary)]" />
                    {hiddenUnread} con mensajes nuevos
                  </span>
                )}
                <ChevronRight className="ml-auto size-[16px]" aria-hidden />
              </button>
            )}
          </Section>
        )}
        {people.length > 0 && <Section title="Personas y grupos" bare={top.length === 0}>{people.map(row)}</Section>}
      </>
    );
  } else if (filter === "viajes") {
    const onNow = trips.filter((c) => phase.get(c.chat_id) === "curso").sort(byStart);
    const next = trips.filter((c) => phase.get(c.chat_id) === "proximo" || phase.get(c.chat_id) === "sinfecha").sort(byStart);
    const ended = trips.filter((c) => phase.get(c.chat_id) === "terminado").sort((a, b) => (b.plan_fin_at ?? "").localeCompare(a.plan_fin_at ?? ""));
    body = trips.length === 0 ? <Empty text="Aún no tienes viajes. Los chats de tus planes salen aquí." /> : (
      <>
        {onNow.length > 0 && <Section title="En curso">{onNow.map(row)}</Section>}
        {next.length > 0 && <Section title="Próximos por fecha">{next.map(row)}</Section>}
        {ended.length > 0 && (
          <section aria-label="Terminados">
            <h2>
              <button
                type="button"
                onClick={() => setShowEnded((v) => !v)}
                aria-expanded={showEnded}
                className="flex min-h-[44px] w-full items-center gap-[6px] px-[var(--space-4)] pt-[var(--space-2)] text-left text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted"
              >
                Terminados · {ended.length}
                <ChevronDown className={`size-[14px] transition-transform ${showEnded ? "rotate-180" : ""}`} aria-hidden />
              </button>
            </h2>
            {showEnded && ended.map(row)}
          </section>
        )}
      </>
    );
  } else if (filter === "personas") {
    body = people.length === 0 ? <Empty text="Aún no tienes chats con personas ni grupos. Busca a un amigo arriba para escribirle." /> : people.map(row);
  } else {
    body = unreadChats.length === 0 ? <Empty text="Estás al día: no tienes mensajes sin leer." /> : unreadChats.map(row);
  }

  const chip = (f: ChatFilter, label: string, count?: number) => (
    <button
      type="button"
      aria-pressed={filter === f}
      onClick={() => onFilter(f)}
      className="flex h-[44px] shrink-0 items-center"
    >
      <span className={`inline-flex h-[32px] items-center gap-[6px] rounded-[8px] border px-[12px] text-[13px] font-[500] ${filter === f ? "border-transparent bg-[var(--text-primary)] text-[var(--bg)]" : "border-app text-app hover:bg-[var(--chat-surface)]"}`}>
        {label}
        {count ? <span className="tabular-nums opacity-75">{count}</span> : null}
      </span>
    </button>
  );

  return (
    <>
      <div role="group" aria-label="Filtrar" className="flex gap-[8px] overflow-x-auto px-[var(--space-4)] [scrollbar-width:none]">
        {chip("todos", "Todos")}
        {chip("viajes", "Viajes", trips.length)}
        {chip("personas", "Personas")}
        {chip("noleidos", "No leídos", unreadChats.length)}
      </div>
      <div className="flex flex-col pb-[var(--space-4)]">{body}</div>
    </>
  );
}

function Section({ title, children, bare }: { title: string; children: React.ReactNode; bare?: boolean }) {
  return (
    <section aria-label={title}>
      {!bare && <h2 className="px-[var(--space-4)] pb-[6px] pt-[var(--space-3)] text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">{title}</h2>}
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-[var(--space-6)] py-[var(--space-8)] text-center text-body-sm text-muted">{text}</p>;
}

function ChatRow({
  chat, userId, selected, phase, now, onOpen,
}: {
  chat: ChatListItem;
  userId: string;
  selected: boolean;
  phase?: Phase;
  now: Date;
  onOpen: (chatId: string) => void;
}) {
  const name = resolveChatName(chat, userId);
  const avatar = resolveChatAvatar(chat, userId);
  const hasUnread = chat.unread_count > 0;
  const trip = tripOf(chat);
  const onNow = phase === "curso";
  const status = trip ? tripStatus(trip, now) : null;
  // A group a plan was made from: «Plan creado · ver el plan ›», so it does not look like a copy of the trip.
  // chat.last_message keeps the preview text («Plan creado · Lisboa»), not the moment's JSON.
  const planMade = chat.tipo === "GRUPO"
    && (parseMoment(chat.last_message ?? "")?.type === "plan_creado" || (chat.last_message ?? "").startsWith("Plan creado · "));
  const preview = describeLastMessage(chat.last_message);
  // Vuelo de la otra persona: insignia en el avatar y, sin mensajes sin leer, el estado en la vista previa.
  const flight = useFriendFlight(chat.tipo === "DIRECTO" ? chat.miembros.find((m) => m.id !== userId)?.id : null);
  const flightState = flight ? flightStateAt(flight, now.getTime()) : null;
  const showFlight = !!flight && flightState !== "landed";
  return (
    <button
      type="button"
      onClick={() => onOpen(chat.chat_id)}
      aria-current={selected ? "true" : undefined}
      aria-label={showFlight && flight ? flightA11y(flight, now.getTime()) : undefined}
      // The open chat (board d-*): --chat-surface, since --surface is white like the page in light mode.
      className={`flex min-h-[68px] w-full items-center gap-3 px-[var(--space-4)] py-[10px] text-left transition-colors focus:outline-none focus-visible:bg-[var(--chat-surface)] ${selected ? "bg-[var(--chat-surface)]" : "hover:bg-[var(--chat-surface)]"}`}
    >
      {trip ? (
        <span aria-hidden className={`flex size-[44px] shrink-0 flex-col items-center justify-center rounded-[8px] border leading-none ${onNow ? "border-[var(--chat-me-border)] bg-[var(--chat-me)]" : "border-app bg-[var(--surface)]"}`}>
          <span className="[font-family:var(--font-display-face)] text-[21px] tabular-nums text-app">{trip.start.getDate()}</span>
          <span className="mt-[3px] text-[10px] font-[var(--fw-semibold)] uppercase tracking-[0.04em] text-muted">{trip.start.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")}</span>
        </span>
      ) : (
        <span className="relative shrink-0"><ChatPreviewAvatar name={name} image={avatar} isGroup={chat.tipo !== "DIRECTO"} />{showFlight && flightState && <FlightBadge state={flightState} />}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`truncate text-[16px] text-app ${hasUnread ? "font-[600]" : "font-[500]"}`}>{name}</span>
          {status && (onNow ? (
            <span className="inline-flex shrink-0 items-center gap-[4px] text-[12px] font-[var(--fw-semibold)] text-primary-token">
              <span aria-hidden className="size-[6px] rounded-full bg-[var(--primary)]" />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          ) : <span className="shrink-0 text-[12px] text-muted">{status}</span>)}
          <span className={`ml-auto shrink-0 text-[12px] tabular-nums ${hasUnread ? "font-[var(--fw-semibold)] text-primary-token" : "text-muted"}`}>{formatChatTime(chat.last_message_at)}</span>
        </span>
        <span className="mt-[2px] flex items-center gap-2">
          {planMade ? (
            <span className="flex min-w-0 flex-1 items-center gap-[6px] text-[14px] leading-[1.4] text-primary-token">
              <CalendarDays className="size-[14px] shrink-0" aria-hidden />
              <span className="truncate">Plan creado · ver el plan</span>
              <ChevronRight className="size-[14px] shrink-0" aria-hidden />
            </span>
          ) : (
            <span className={`flex min-w-0 flex-1 items-center gap-[6px] text-[14px] leading-[1.4] ${preview.missed ? "text-[var(--error)]" : hasUnread ? "text-app" : "text-muted"}`}>
              {preview.icon}
              <span className="truncate">{showFlight && !hasUnread && flight ? flightPreview(flight, now.getTime()) : preview.text}</span>
            </span>
          )}
          {hasUnread && (
            <span className="flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-[6px] text-[11px] font-[700] leading-none text-[var(--contrast)]" aria-label={`${chat.unread_count} sin leer`}>
              {chat.unread_count > 99 ? "99+" : chat.unread_count}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export function ChatListSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-3)]" aria-label="Cargando conversaciones" role="status">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-[var(--space-3)]">
          <div className="skeleton-shimmer size-12 shrink-0 rounded-full" />
          <div className="skeleton-shimmer h-[14px] w-[148px] rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ChatPreviewAvatar({ name, image, isGroup }: { name: string; image: string | null; isGroup: boolean }) {
  if (image) {
    return (
      <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-app">
        <Image src={image} alt={name} fill sizes="48px" className="object-cover" unoptimized referrerPolicy="no-referrer" />
      </div>
    );
  }
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-app bg-surface-2 text-[15px] font-[700] text-muted">
      {isGroup ? <GroupIcon className="size-[20px] text-muted" /> : (name.trim()[0] || "U").toUpperCase()}
    </div>
  );
}

/** How the last message reads in the chat list: an icon for its kind and a short text. */
function describeLastMessage(raw: string | null): { icon: React.ReactNode; text: string; missed: boolean } {
  const m = raw ?? "";
  try {
    const parsed = JSON.parse(m) as { type?: string };
    const text = momentPreview(m);
    if (text) {
      const Icon = parsed?.type === "poll" ? BarChart2 : parsed?.type === "lugar" ? MapPin : parsed?.type === "tarjeta" ? CalendarDays : Receipt;
      return { icon: <Icon className="size-[14px] shrink-0" aria-hidden />, text, missed: false };
    }
  } catch { /* plain text */ }
  if (/llamada|videollamada/i.test(m)) {
    const missed = /perdida/i.test(m);
    const isVideo = /video/i.test(m);
    const Icon = isVideo ? Video : Phone;
    return { icon: <Icon className="size-[14px] shrink-0" aria-hidden />, text: missed ? (isVideo ? "Videollamada perdida" : "Llamada perdida") : (isVideo ? "Videollamada" : "Llamada de audio"), missed };
  }
  if (/^📷/.test(m)) return { icon: <ImageIcon className="size-[14px] shrink-0" aria-hidden />, text: m.replace(/^📷\s*/, "") || "Foto", missed: false };
  if (/^🎤|nota de voz/i.test(m)) return { icon: <Mic className="size-[14px] shrink-0" aria-hidden />, text: m.replace(/^🎤\s*/, "") || "Nota de voz", missed: false };
  if (/^📄|^📎/.test(m)) return { icon: <FileText className="size-[14px] shrink-0" aria-hidden />, text: m.replace(/^(📄|📎)\s*/, "") || "Documento", missed: false };
  return { icon: null, text: m, missed: false };
}
