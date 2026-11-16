"use client";

import { useEffect, useState } from "react";
import { BarChart3, ChevronRight, CircleCheck, ImagePlus, Images, MessageCircle, Plus, Wallet } from "lucide-react";
import { getBalancesForPlanEndpoint, type BalanceRow } from "@/services/api/endpoints/gastos.endpoint";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { InicioActividad, InicioEncuesta, InicioMiembro, InicioPlanExtra } from "@/services/api/endpoints/misPlanes.endpoint";
import {
  activityWhen,
  countdownText,
  formatPlanRange,
  peopleSentence,
  planTiming,
  todayLabel,
  type MonthChapter,
} from "./homeSections";
import {
  CARD,
  CHIP_HL,
  FILL_BTN,
  FOCUS,
  LABEL,
  PeopleStack,
  PinButton,
  Pill,
  PlanCover,
  SERIF,
  TEXT_BTN,
  TripProgress,
  hasPhoto,
} from "./pieces";

export type PlanTab = "itinerario" | "chat" | "gastos" | "fotos";
export type OpenPlan = (planId: number, tab?: PlanTab) => void;

type Common = {
  plan: FeedPlanItemDto;
  extra?: InicioPlanExtra;
  pinned: boolean;
  onTogglePin: () => void;
  onOpen: OpenPlan;
  userId?: string;
};

function placeOf(plan: FeedPlanItemDto) {
  return (plan.locationName?.trim() || "").replace(/\bParis\b/g, "París");
}

function rangeAndPlace(plan: FeedPlanItemDto, shortPlace = false) {
  const place = shortPlace ? placeOf(plan).split(",")[0] : placeOf(plan);
  return [formatPlanRange(plan.startsAt, plan.endsAt), place].filter(Boolean).join(" · ");
}

/** «Tú, Ana, Marcos y Lucía»: names of the members, the current user as «Tú». */
export function membersSentence(members: InicioMiembro[] | undefined, userId?: string) {
  if (!members?.length) return "";
  const first = (n: string) => n.trim().split(/\s+/)[0] || n;
  return peopleSentence(members.map((m) => (m.id === userId ? "Tú" : first(m.nombre))));
}

function creatorText(plan: FeedPlanItemDto, userId?: string) {
  const mine = plan.creator.id === userId || plan.ownerUserId === userId;
  return mine ? "creado por ti" : `de ${plan.creator.name.split(" ")[0]}`;
}

/** First open poll the person has not voted, else the first open poll. */
function pollForMe(polls: InicioEncuesta[] | undefined) {
  if (!polls?.length) return null;
  return polls.find((p) => !p.he_votado) ?? polls[0];
}

function OpenLink({ plan, onOpen, className = "", children }: { plan: FeedPlanItemDto; onOpen: OpenPlan; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={`/plans/${plan.id}`}
      onClick={(e) => {
        e.preventDefault();
        onOpen(plan.id);
      }}
      className={`${FOCUS} ${className}`}
    >
      {children}
    </a>
  );
}

function ChatButton({ planId, unread, onOpen }: { planId: number; unread: number; onOpen: OpenPlan }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(planId, "chat")}
      aria-label={unread ? `Chat del plan, ${unread} sin leer` : "Chat del plan"}
      className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[8px] border border-[var(--border-strong)] px-3 text-[14px] font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface-2 ${FOCUS}`}
    >
      <MessageCircle size={18} aria-hidden />
      Chat
      {unread > 0 && (
        <span
          aria-hidden
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-[var(--chat-accent-text)] px-1.5 text-[12px] font-[var(--fw-semibold)] tabular-nums text-contrast-token"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function ActivityRows({ items, dense, live }: { items: InicioActividad[]; dense?: boolean; live?: boolean }) {
  const now = new Date();
  return (
    <ul>
      {items.map((a) => {
        const when = !live || a.all_day ? null : activityWhen(a.inicio_at, a.fin_at, now);
        return (
          <li key={a.id} className={`flex items-center gap-3 border-t border-app ${dense ? "min-h-10" : "min-h-11"}`}>
            <span className="w-11 shrink-0 text-[14px] font-[var(--fw-semibold)] tabular-nums text-muted">
              {a.all_day ? "Día" : hhmm(a.inicio_at)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[16px] text-app">{a.titulo}</span>
            {when === "Ahora" ? (
              <span className="inline-flex h-6 items-center rounded-full border border-[var(--chat-me-border)] bg-[var(--chat-me)] px-2 text-[12px] font-[var(--fw-semibold)] text-app">
                Ahora
              </span>
            ) : when ? (
              <span className="text-[12px] tabular-nums text-muted">{when}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const SMALL_BTN = `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border border-[var(--border-strong)] px-3 text-[14px] font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface-2 ${FOCUS}`;

/** Your balance in the plan: «Ana te debe 34,50 €», «Debes 12,00 € a Ana · Saldar», «Cuentas cerradas». */
function SettleRow({ planId, userId, onOpen }: { planId: number; userId?: string; onOpen: OpenPlan }) {
  const [rows, setRows] = useState<BalanceRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getBalancesForPlanEndpoint(planId)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((error: unknown) => {
        console.error("[mis-planes] balances", (error as { message?: string })?.message ?? String(error));
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const first = (n: string | null) => (n ?? "Alguien").trim().split(/\s+/)[0];
  let text: string;
  let action: string | null = null;
  let done = false;
  if (failed) {
    text = "No se han podido cargar las cuentas";
    action = "Ver cuentas";
  } else if (!rows) {
    text = "Mirando las cuentas…";
  } else {
    const iOwe = rows.filter((r) => r.from_user_id === userId);
    const owedToMe = rows.filter((r) => r.to_user_id === userId);
    const sum = (list: BalanceRow[]) => list.reduce((acc, r) => acc + Number(r.importe), 0);
    if (iOwe.length) {
      text =
        iOwe.length === 1
          ? `Debes ${EUR.format(sum(iOwe))} a ${first(iOwe[0].to_nombre)}`
          : `Debes ${EUR.format(sum(iOwe))} a ${iOwe.length} personas`;
      action = "Saldar";
    } else if (owedToMe.length) {
      text =
        owedToMe.length === 1
          ? `${first(owedToMe[0].from_nombre)} te debe ${EUR.format(sum(owedToMe))}`
          : `Te deben ${EUR.format(sum(owedToMe))} entre ${owedToMe.length}`;
      action = "Ver cuentas";
    } else {
      text = "Cuentas cerradas";
      done = true;
    }
  }
  const icon = (
    <span className={`flex w-11 shrink-0 ${done ? "text-[var(--chat-accent-text)]" : "text-muted"}`}>
      {done ? <CircleCheck size={20} aria-hidden /> : <Wallet size={20} aria-hidden />}
    </span>
  );
  if (!action) {
    return (
      <li className="flex min-h-11 items-center gap-3 border-t border-app">
        {icon}
        <span className="min-w-0 flex-1 truncate text-[16px] text-app">{text}</span>
      </li>
    );
  }
  return (
    <li className="border-t border-app">
      <CloseRow onClick={() => onOpen(planId, "gastos")} icon={icon} text={text} action={action} />
    </li>
  );
}

/** A «Para cerrar el viaje» row: the whole row is the button; the turquoise text says what happens. */
function CloseRow({ onClick, icon, text, action }: { onClick: () => void; icon: React.ReactNode; text: string; action: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-11 w-full items-center gap-3 text-left ${FOCUS}`}>
      {icon}
      <span className="min-w-0 flex-1 truncate text-[16px] text-app">{text}</span>
      <span className={TEXT_BTN}>{action}</span>
    </button>
  );
}

/**
 * Bottom of the «En curso» card, so it is never empty:
 * what is left today (up to 3) or «Hoy no tenéis nada previsto»; then, on the last day,
 * «Para cerrar el viaje» (balance + album); on the other days, «Mañana · …» (first 2).
 */
function NowAgenda({
  plan,
  extra,
  lastDay,
  dense,
  userId,
  onOpen,
}: {
  plan: FeedPlanItemDto;
  extra?: InicioPlanExtra;
  lastDay: boolean;
  dense?: boolean;
  userId?: string;
  onOpen: OpenPlan;
}) {
  const now = new Date();
  const today = (extra?.hoy ?? []).filter((a) => a.all_day || new Date(a.fin_at).getTime() >= now.getTime()).slice(0, 3);
  const tomorrow = (extra?.manana ?? []).slice(0, 2);
  const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const photos = extra?.fotos ?? 0;
  return (
    <>
      <h4 className={`${LABEL} mb-1 mt-4`}>{todayLabel(now)}</h4>
      {today.length ? (
        <ActivityRows items={today} dense={dense} live />
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-app py-2.5">
          <p className="mr-auto text-[16px] text-app">Hoy no tenéis nada previsto</p>
          <button type="button" onClick={() => onOpen(plan.id, "itinerario")} className={SMALL_BTN}>
            <Plus size={16} aria-hidden />
            Añadir actividad
          </button>
          <button type="button" onClick={() => onOpen(plan.id, "chat")} className={SMALL_BTN}>
            Pedir ideas a @frimee
          </button>
        </div>
      )}
      {lastDay ? (
        <>
          <h4 className={`${LABEL} mb-1 mt-4`}>Para cerrar el viaje</h4>
          <ul>
            {(extra?.gastos ?? 0) > 0 && <SettleRow planId={plan.id} userId={userId} onOpen={onOpen} />}
            <li className="border-t border-app">
              <CloseRow
                onClick={() => onOpen(plan.id, "fotos")}
                icon={
                  <span className="flex w-11 shrink-0 text-muted">
                    <Images size={20} aria-hidden />
                  </span>
                }
                text={photos ? `${photos} ${photos === 1 ? "foto" : "fotos"} del viaje` : "Aún no hay fotos del viaje"}
                action="Añade las tuyas"
              />
            </li>
          </ul>
        </>
      ) : tomorrow.length ? (
        <>
          <h4 className={`${LABEL} mb-1 mt-4`}>
            Mañana · {WEEKDAYS[tmr.getDay()]} {tmr.getDate()}
          </h4>
          <ActivityRows items={tomorrow} dense={dense} />
        </>
      ) : null}
    </>
  );
}

/* ───────────── En curso («Ahora») ───────────── */

export function NowBlock({ plan, extra, pinned, onTogglePin, onOpen, userId, desktop }: Common & { desktop?: boolean }) {
  const t = planTiming(plan);
  const day = t.kind === "ongoing" ? t : { day: 1, total: 1 };
  const label = countdownText(plan) ?? "";
  const people = extra?.miembros ?? [];
  return (
    <article aria-label={`En curso: ${plan.title}, ${label.toLowerCase()}`} className={`${CARD} ${desktop ? "flex min-h-[300px]" : ""}`}>
      <PlanCover plan={plan} className={desktop ? "min-h-[300px] w-[340px] shrink-0" : "h-[156px]"}>
        <div className="absolute left-3 top-3">
          <Pill>{label}</Pill>
        </div>
        <div className="absolute right-2 top-2">
          <PinButton pinned={pinned} onToggle={onTogglePin} onPhoto />
        </div>
      </PlanCover>
      <div className={desktop ? "flex min-w-0 flex-1 flex-col px-6 pb-4 pt-5" : "px-4 pb-2 pt-3.5"}>
        <h3 className={`${SERIF} truncate text-[32px] leading-9 text-app [text-wrap:balance]`}>
          <OpenLink plan={plan} onOpen={onOpen}>{plan.title}</OpenLink>
        </h3>
        <p className="mt-1 text-[14px] text-muted">{rangeAndPlace(plan)}</p>
        <div className={desktop ? "mt-3" : "mt-3.5"}>
          <TripProgress day={day.day} total={day.total} />
        </div>
        <NowAgenda plan={plan} extra={extra} lastDay={t.kind === "ongoing" && t.total > 1 && t.day === t.total} dense={desktop} userId={userId} onOpen={onOpen} />
        <div className={`flex items-center gap-2.5 ${desktop ? "mt-auto pt-2" : "mt-0 min-h-[52px] border-t border-app pt-2"}`}>
          <PeopleStack people={people} size={28} />
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{membersSentence(people, userId)}</span>
          <ChatButton planId={plan.id} unread={extra?.no_leidos ?? 0} onOpen={onOpen} />
          {desktop && (
            <button type="button" onClick={() => onOpen(plan.id, "itinerario")} className={`${FILL_BTN} h-11 text-[14px] ${FOCUS}`}>
              Ver el día
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ───────────── Tu próximo viaje (protagonista sin nada en curso) ───────────── */

function PollRow({ poll, total, planId, onOpen }: { poll: InicioEncuesta; total: number; planId: number; onOpen: OpenPlan }) {
  const meta = [`Encuesta · han votado ${poll.votantes} de ${total}`, poll.he_votado ? null : "falta tu voto"].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(planId, "chat")}
        className={`flex min-h-14 w-full items-center gap-3 border-t border-app text-left ${FOCUS}`}
      >
        <BarChart3 size={20} className="shrink-0 text-[var(--chat-accent-text)]" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-[var(--fw-medium)] text-app">{poll.pregunta}</span>
          <span className="text-[14px] text-muted">{meta}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  );
}

export function HeroBlock({ plan, extra, pinned, onTogglePin, onOpen, userId, desktop }: Common & { desktop?: boolean }) {
  const t = planTiming(plan);
  const people = extra?.miembros ?? [];
  const polls = extra?.encuestas ?? [];
  const countdown =
    t.kind === "upcoming" && t.days > 1 && t.days <= 30 ? (
      <p className="flex items-baseline gap-2">
        <span className={LABEL}>Faltan</span>
        <span className={`${SERIF} tabular-nums text-app ${desktop ? "text-[72px] leading-[64px]" : "text-[48px] leading-[44px]"}`}>{t.days}</span>
        <span className={`${SERIF} text-[24px] leading-7 text-app`}>días</span>
      </p>
    ) : (
      <p className={`${SERIF} text-[32px] leading-9 text-app`}>{countdownText(plan)}</p>
    );

  const titleBlock = (
    <>
      <h3 className={`${SERIF} text-[32px] leading-9 [text-wrap:balance] ${desktop ? "text-app" : "text-white"}`}>
        <OpenLink plan={plan} onOpen={onOpen}>{plan.title}</OpenLink>
      </h3>
      <p className={`mt-1 text-[14px] leading-5 ${desktop ? "text-muted" : "text-white"}`}>
        {rangeAndPlace(plan)}
        {desktop ? ` · ${creatorText(plan, userId)}` : ""}
      </p>
    </>
  );

  return (
    <article aria-label={`Tu próximo viaje: ${plan.title}`} className={`${CARD} ${desktop ? "flex min-h-[420px]" : ""}`}>
      <PlanCover
        plan={plan}
        veil={!desktop}
        className={desktop ? "w-[400px] shrink-0" : "h-[208px]"}
      >
        <div className="absolute right-2 top-2">
          <PinButton pinned={pinned} onToggle={onTogglePin} onPhoto />
        </div>
        {!desktop && <div className="absolute inset-x-4 bottom-3.5">{titleBlock}</div>}
      </PlanCover>
      <div className={desktop ? "flex min-w-0 flex-1 flex-col px-7 pb-5 pt-6" : "px-4 pb-1.5 pt-3.5"}>
        {desktop && <div className="mb-3">{titleBlock}</div>}
        <div className="flex items-end justify-between gap-3">
          {countdown}
          <div className="flex flex-col items-end gap-1">
            <PeopleStack people={people} size={28} />
            <span className="text-[12px] text-muted">
              {people.length === 1 ? "Solo tú" : `${people.length} van`}
              {desktop ? "" : ` · ${creatorText(plan, userId)}`}
            </span>
          </div>
        </div>
        {polls.length > 0 && (
          <>
            <h4 className={`${LABEL} mt-4`}>Por decidir · {polls.length}</h4>
            <ul className="mt-1">
              {polls.slice(0, 3).map((p) => (
                <PollRow key={p.mensaje_id} poll={p} total={Math.max(people.length, p.votantes)} planId={plan.id} onOpen={onOpen} />
              ))}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}

/* ───────────── Siguiente / Anclado (tarjeta con portada) ───────────── */

export function CoverCard({
  plan,
  extra,
  pinned,
  onTogglePin,
  onOpen,
  userId,
  label,
  desktop,
}: Common & { label: string; desktop?: boolean }) {
  const photo = hasPhoto(plan);
  const people = extra?.miembros ?? [];
  const poll = pollForMe(extra?.encuestas);
  const countdown = countdownText(plan);
  return (
    <article aria-label={`${label}: ${plan.title}${countdown ? `, ${countdown.toLowerCase()}` : ""}`} className={`${CARD} transition-transform duration-[120ms] active:scale-[.98] motion-reduce:transition-none`}>
      <PlanCover
        plan={plan}
        veil
        className={desktop ? "h-[160px]" : "h-[196px]"}
      >
        {countdown && (
          <div className="absolute left-3 top-3">
            <Pill>{countdown}</Pill>
          </div>
        )}
        <div className="absolute right-2 top-2">
          <PinButton pinned={pinned} onToggle={onTogglePin} onPhoto />
        </div>
        <div className={`absolute bottom-3.5 ${desktop ? "inset-x-5" : "inset-x-4"}`}>
          <h3 className={`${SERIF} truncate text-[32px] leading-9 text-white`}>
            <OpenLink plan={plan} onOpen={onOpen}>{plan.title}</OpenLink>
          </h3>
          <p className="mt-1 text-[14px] leading-5 text-white">{rangeAndPlace(plan, desktop)}</p>
        </div>
      </PlanCover>
      <div className={`flex flex-wrap items-center gap-2.5 ${desktop ? "min-h-[60px] py-2 pl-5 pr-3" : "pb-3 pl-4 pr-3 pt-2.5"}`}>
        <PeopleStack people={people} size={22} />
        <span className="min-w-[120px] flex-1 truncate text-[12px] text-muted">
          {membersSentence(people, userId)}
          {!poll && desktop ? ` · ${creatorText(plan, userId)}` : ""}
        </span>
        {poll && (
          <button type="button" onClick={() => onOpen(plan.id, "chat")} className={`${CHIP_HL} ${FOCUS}`}>
            <BarChart3 size={16} aria-hidden className="shrink-0" />
            <span className="truncate">
              {poll.pregunta}
              {poll.he_votado ? "" : " · falta tu voto"}
            </span>
          </button>
        )}
        {!poll && desktop && !photo && (
          <button
            type="button"
            onClick={() => onOpen(plan.id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 text-[14px] font-[var(--fw-medium)] text-app ${FOCUS}`}
          >
            <ImagePlus size={16} aria-hidden />
            Añadir foto
          </button>
        )}
      </div>
    </article>
  );
}

/* ───────────── Fila de plan (Anclados y Más adelante en móvil) ───────────── */

export function PlanRow({
  plan,
  extra,
  pinned,
  onTogglePin,
  onOpen,
  userId,
  spine,
  finished,
}: Common & { spine?: boolean; finished?: boolean }) {
  const people = extra?.miembros ?? [];
  const mine = plan.creator.id === userId || plan.ownerUserId === userId;
  const others = people.filter((p) => p.id !== userId);
  const who = finished
    ? `${people.length || 1} ${people.length === 1 ? "persona" : "personas"} · ${mine ? "creado por ti" : `de ${plan.creator.name.split(" ")[0]}`}`
    : mine
      ? others.length && others.length <= 2
        ? `Creado por ti · ${membersSentence(people, userId).toLowerCase()}`
        : "Creado por ti"
      : `Creado por ${plan.creator.name.split(" ")[0]}`;
  const countdown = finished ? null : countdownText(plan);
  const soon = !finished && planTiming(plan).kind === "upcoming" && (planTiming(plan) as { days: number }).days <= 30;
  return (
    <div
      className={`group relative flex min-h-[88px] cursor-pointer items-center gap-3 rounded-[8px] py-2.5 pr-1 transition-colors hover:bg-surface-2 ${spine ? "pl-14" : "pl-4"}`}
      onClick={() => onOpen(plan.id)}
    >
      {spine && (
        <span aria-hidden className="absolute left-[22px] top-[38px] size-[11px] rounded-full border-2 border-[var(--text-secondary)] bg-app" />
      )}
      <PlanCover plan={plan} variant="thumb" className="size-16 shrink-0 rounded-[8px]" />
      <div className="min-w-0 flex-1">
        <OpenLink plan={plan} onOpen={onOpen} className="flex items-center gap-1.5">
          <span className="truncate text-[16px] font-[var(--fw-semibold)] text-app">{plan.title}</span>
        </OpenLink>
        <p className="mt-0.5 truncate text-[14px] text-muted">{rangeAndPlace(plan, true)}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <PeopleStack people={people} size={20} ring="var(--bg)" max={3} />
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{who}</span>
          {countdown && (
            <span className={`shrink-0 text-[12px] ${soon ? "font-[var(--fw-semibold)] text-[var(--chat-accent-text)]" : "text-muted"}`}>
              {countdown}
            </span>
          )}
        </div>
      </div>
      {!finished && <PinButton pinned={pinned} onToggle={onTogglePin} />}
    </div>
  );
}

/** «Más adelante» on mobile: months are chapters on the Bitácora spine. */
export function LaterSpine({
  chapters,
  extras,
  pinnedIds,
  onTogglePin,
  onOpen,
  userId,
}: {
  chapters: MonthChapter[];
  extras: Map<number, InicioPlanExtra>;
  pinnedIds: number[];
  onTogglePin: (id: number) => void;
  onOpen: OpenPlan;
  userId?: string;
}) {
  return (
    <div className="relative">
      <div aria-hidden className="absolute bottom-0 left-[27px] top-0 w-px bg-[var(--border)]" />
      {chapters.map((c) => (
        <section key={c.key} aria-label={c.title}>
          <div className="relative pb-0.5 pl-14 pr-4 pt-3.5">
            <span aria-hidden className="absolute left-[21px] top-[22px] size-[13px] rounded-full border-2 border-[var(--text-primary)] bg-app" />
            <h3 className="flex items-baseline gap-2 font-normal">
              <span className={`${SERIF} text-[24px] leading-7 text-app`}>{c.title}</span>
              <span className="text-[12px] text-muted">{c.hint}</span>
            </h3>
          </div>
          {c.plans.map((p) => (
            <PlanRow
              key={p.id}
              plan={p}
              extra={extras.get(p.id)}
              pinned={pinnedIds.includes(p.id)}
              onTogglePin={() => onTogglePin(p.id)}
              onOpen={onOpen}
              userId={userId}
              spine
            />
          ))}
        </section>
      ))}
    </div>
  );
}

/** Desktop «Más adelante» tile. */
export function LaterTile({ plan, onOpen, userId }: { plan: FeedPlanItemDto; onOpen: OpenPlan; userId?: string }) {
  const mine = plan.creator.id === userId || plan.ownerUserId === userId;
  const meta = [formatPlanRange(plan.startsAt, plan.endsAt), placeOf(plan).split(",")[0], mine ? null : `de ${plan.creator.name.split(" ")[0]}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <OpenLink
      plan={plan}
      onOpen={onOpen}
      className="flex min-h-[76px] items-center gap-3 rounded-[8px] border border-app py-1.5 pl-1.5 pr-3 transition-[transform,background-color] duration-[120ms] hover:bg-surface-2 active:scale-[.98]"
    >
      <PlanCover plan={plan} variant="thumb" className="size-16 shrink-0 rounded-[8px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-[var(--fw-semibold)] text-app">{plan.title}</span>
        <span className="block truncate text-[14px] text-muted">{meta}</span>
      </span>
      <span className="shrink-0 text-[12px] text-muted">{countdownText(plan)}</span>
    </OpenLink>
  );
}

/** Link row to «Todos los planes» filtered by Finalizados, with three thumbnails. */
export function FinishedLink({ plans, onClick }: { plans: FeedPlanItemDto[]; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mx-4 flex min-h-14 w-[calc(100%-32px)] items-center gap-3 rounded-[8px] border border-app pl-3 pr-1 text-left transition-colors hover:bg-surface-2 ${FOCUS}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-muted">
        <rect width="20" height="5" x="2" y="3" rx="1" />
        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
        <path d="M10 12h4" />
      </svg>
      <span className="flex-1 text-[16px] font-[var(--fw-medium)] text-app">Finalizados</span>
      <span aria-hidden className="flex pl-2">
        {plans.slice(0, 3).map((p) => (
          <span key={p.id} className="-ml-2 flex rounded-[8px] border-2 border-[var(--bg)]">
            <PlanCover plan={p} variant="thumb" className="size-8 rounded-[6px] [&>span:first-child]:text-[12px] [&>span:last-child]:hidden" />
          </span>
        ))}
      </span>
      <span className="text-[14px] tabular-nums text-muted">{plans.length}</span>
      <span className="flex w-9 justify-center text-muted">
        <ChevronRight size={18} aria-hidden />
      </span>
    </button>
  );
}
