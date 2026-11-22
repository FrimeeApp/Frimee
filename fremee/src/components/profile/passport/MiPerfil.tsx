"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { CalendarDays, ChevronRight, Lock, MapPin, Plus, Settings, Users } from "lucide-react";
import { listUserRelatedPlans } from "@/services/api/repositories/plans.repository";
import { listTicketsEndpoint, TICKET_TYPE_LABELS, type PlanTicket } from "@/services/api/endpoints/wallet.endpoint";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { isPlanFinished, planEndsAt } from "@/lib/plan-dates";
import { TicketTypeIcon } from "@/components/wallet/TicketTypeIcon";
import { CARD, FILL_BTN, FOCUS, GHOST_BTN, LABEL, SERIF, TEXT_BTN } from "@/components/plans/home/pieces";
import { leerPasaporte } from "@/services/api/endpoints/pasaporte.endpoint";
import { computeStats, countryName, dateLabel, latestStamps, type PasaporteAjustes, type PasaporteLeido, type Sello } from "@/lib/passport";
import { BOOK, PAPER_VARS, PaperGuilloche } from "./Libreta";
import { GhostPlanStamp, PassportCover } from "./PassportCover";
import PassportPrivacySheet from "./PassportPrivacySheet";
import dynamic from "next/dynamic";
import { CountryStamp, PlanStamp } from "./stamps";

/** El lector es una capa que se abre al pulsar: solo se carga en el cliente (no depende de la hora ni del tamaño de ventana del servidor). */
const PassportReader = dynamic(() => import("./PassportReader"), { ssr: false });

/** Tu perfil (tableros «Perfil»): cabecera, pasaporte y cartera. Nada más: aquí eres viajero, no hay lista de planes. */

type Loaded = { plans: FeedPlanItemDto[]; tickets: PlanTicket[]; pasaporte: PasaporteLeido | null };

const DAY_MS = 86_400_000;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** El nombre baja por tramos para que la cabecera no crezca: hasta 18 letras, hasta 26 y más. */
function nameSize(nombre: string) {
  const n = nombre.trim().length;
  if (n <= 18) return "text-[32px] md:text-[48px]";
  if (n <= 26) return "text-[28px] md:text-[40px]";
  return "text-[24px] md:text-[32px]";
}

const planPath = (id: number) => (Capacitor.isNativePlatform() ? `/plans/static?id=${id}` : `/plans/${id}`);

function dayMonth(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** «19–22 DIC 2026» o «30 NOV – 2 DIC 2026». */
function dateRangeLabel(startIso: string, finIso: string) {
  const a = new Date(startIso);
  const b = planEndsAt(finIso);
  const year = b.getFullYear();
  const text =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
      ? a.getDate() === b.getDate()
        ? `${a.getDate()} ${MONTHS[a.getMonth()]}`
        : `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}`
      : `${dayMonth(a)} – ${dayMonth(b)}`;
  return `${text} ${year}`.toUpperCase();
}

function ticketWhen(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dayMonth(d)} · ${hh}:${mm}`;
}

function ticketName(t: PlanTicket) {
  const route = t.type === "flight" || t.type === "ferry" || t.type === "train";
  return route && t.from_label && t.to_label ? `${TICKET_TYPE_LABELS[t.type]} ${t.from_label} → ${t.to_label}` : t.title;
}

export default function MiPerfil({
  userId,
  nombre,
  profileImage,
  isGuest,
}: {
  userId: string;
  nombre: string;
  profileImage: string | null;
  isGuest: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  // Se fija al cargar: así el render no depende del reloj.
  const [now, setNow] = useState(() => Date.now());

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Los sellos no bloquean el perfil: si fallan, la tarjeta cae a la cuenta de planes terminados.
    const sellos = leerPasaporte().catch((err) => {
      console.error("[perfil] Error leyendo los sellos:", (err as { message?: string } | null)?.message ?? err);
      return null;
    });
    Promise.all([listUserRelatedPlans({ userId, limit: 100 }), listTicketsEndpoint(), sellos])
      .then(([plans, tickets, pasaporte]) => {
        if (!cancelled) setData({ plans, tickets, pasaporte });
      })
      .catch((err) => {
        const { message, code } = (err ?? {}) as { message?: string; code?: string };
        console.error("[perfil] Error cargando el perfil:", message ?? err, code ?? "");
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  const retry = () => {
    setFailed(false);
    setData(null);
    setNow(Date.now());
    setAttempt((n) => n + 1);
  };

  const initials = (nombre.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "U").toUpperCase();
  const goSettings = () => router.push("/settings");

  return (
    <div data-profile-root className="mx-auto w-full max-w-[1080px]">
      {isGuest && (
        <div className="mb-[var(--space-4)] flex min-h-[52px] items-center gap-2.5 rounded-[8px] border border-app bg-surface pl-3 pr-1 md:hidden">
          <span className="flex-1 text-[14px] leading-tight text-app">Estás en modo invitado</span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("frimee:save-account"))}
            className="min-h-11 px-2 text-[14px] font-[var(--fw-semibold)] text-[var(--primary)]"
          >
            Guardar mi cuenta
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between md:gap-4">
        <button
          type="button"
          onClick={goSettings}
          aria-label="Ajustes"
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] text-app transition-opacity hover:opacity-70 active:opacity-[var(--disabled-opacity)] max-md:mb-3 max-md:w-11 max-md:self-end md:order-2 md:h-11 md:border md:border-[var(--border-strong)] md:bg-surface-2 md:px-4 md:text-[14px] md:font-[var(--fw-semibold)] md:hover:opacity-100 md:hover:bg-[var(--surface-inset)] ${FOCUS}`}
        >
          <Settings className="size-[22px]" strokeWidth={2} aria-hidden />
          <span className="hidden md:inline">Ajustes</span>
        </button>

        <Link
          href="/settings"
          aria-label={`${nombre}. Cambiar foto y nombre en Ajustes`}
          className={`flex items-center gap-4 rounded-[8px] text-app no-underline md:order-1 md:gap-6 ${FOCUS}`}
        >
          {profileImage ? (
            <Image
              src={profileImage}
              alt=""
              width={104}
              height={104}
              unoptimized
              referrerPolicy="no-referrer"
              className="size-[72px] shrink-0 rounded-full border border-[var(--border-strong)] bg-surface-2 object-cover md:size-[104px]"
            />
          ) : (
            <span
              aria-hidden="true"
              className={`flex size-[72px] shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-surface-2 text-[29px] leading-none md:size-[104px] md:text-[42px] ${SERIF}`}
            >
              {initials}
            </span>
          )}
          <span className="flex min-w-0 flex-col items-start gap-0.5">
            <span className={LABEL}>TU PERFIL</span>
            <span title={nombre} className={`line-clamp-2 break-words ${nameSize(nombre)} leading-[1.05] ${SERIF}`}>
              {nombre}
            </span>
          </span>
        </Link>
      </div>

      {failed ? (
        <ProfileError onRetry={retry} />
      ) : !data ? (
        <PassportLoadingCard nombre={nombre} plain />
      ) : (
        <div className="flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] md:items-start md:gap-6">
          <PassportCard userId={userId} nombre={nombre} plans={data.plans} pasaporte={data.pasaporte} now={now} />
          <Wallet tickets={data.tickets} now={now} />
        </div>
      )}
      </div>
    </div>
  );
}

const VISIBILITY_TEXT = {
  TODOS: { icon: Users, text: "Lo ve todo el mundo" },
  AMISTADES: { icon: Users, text: "Lo ven tus amistades" },
  SOLO_YO: { icon: Lock, text: "Solo lo ves tú" },
} as const;

function PassportCard({ userId, nombre, plans, pasaporte, now }: { userId: string; nombre: string; plans: FeedPlanItemDto[]; pasaporte: PasaporteLeido | null; now: number }) {
  const router = useRouter();
  const { finished, next } = useMemo(() => {
    const at = new Date(now);
    const done = plans.filter((p) => isPlanFinished(p.endsAt, at));
    const open = plans
      .filter((p) => !isPlanFinished(p.endsAt, at))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return { finished: done.length, next: open[0] ?? null };
  }, [plans, now]);

  const goCreate = () => router.push("/calendar?create=1");
  // El pasaporte se abre como capa encima del perfil (para que la tapa pueda volar desde su sitio) y el historial
  // lleva un paso propio: «atrás» lo cierra.
  const [reader, setReader] = useState<{ from: HTMLElement | null } | null>(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!reader) return;
    const onPop = () => setClosing(true);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [reader]);
  const closeReader = useCallback(() => {
    setReader(null);
    setClosing(false);
  }, []);
  const openPassport = () => {
    if (!pasaporte) {
      // Sin los sellos leídos, la entrada directa los vuelve a pedir.
      router.push("/passport");
      return;
    }
    // La tapa que se ve (móvil o escritorio) es la que vuela.
    const from = ([...document.querySelectorAll<HTMLElement>("[data-passport-cover]")].find((e) => e.getClientRects().length > 0)?.firstElementChild as HTMLElement | null) ?? null;
    window.history.pushState({ passportReader: true }, "");
    setClosing(false);
    setReader({ from });
  };

  let headline: string;
  let body: React.ReactNode = null;
  let chip: React.ReactNode = null;
  let action: React.ReactNode;

  const sellos = pasaporte?.sellos ?? [];
  const stats = computeStats(sellos);
  const recientes = latestStamps(sellos);
  const nuevo = sellos.find((s) => s.nuevo && !s.hidden && s.kind === "plan") ?? sellos.find((s) => s.nuevo && !s.hidden && s.kind !== "hito");
  const [ajustesLocal, setAjustesLocal] = useState<PasaporteAjustes | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const ajustes = ajustesLocal ?? pasaporte?.ajustes ?? null;
  const visibility = VISIBILITY_TEXT[ajustes?.passport_visibility ?? "AMISTADES"];
  const VisIcon = visibility.icon;

  if (finished > 0 || sellos.length > 0) {
    headline =
      stats.paises > 0
        ? `${stats.paises} ${stats.paises === 1 ? "país" : "países"},\n${stats.planes} ${stats.planes === 1 ? "plan" : "planes"}`
        : `${finished} ${finished === 1 ? "plan terminado" : "planes terminados"}`;
    if (nuevo) {
      const where = nuevo.kind === "pais" && nuevo.country_code ? countryName(nuevo.country_code) : nuevo.plan?.ubicacion_nombre?.split(",")[0]?.trim() || nuevo.plan?.titulo || "";
      chip = (
        <span className="inline-flex h-7 items-center gap-1.5 self-start rounded-full border border-[var(--chat-me-border)] bg-[var(--chat-me)] px-2.5 text-[12px] font-[var(--fw-semibold)] text-app">
          Sello nuevo{where ? ` · ${where}` : ""}
        </span>
      );
    }
    body = (
      <span className="inline-flex items-center gap-2 text-[14px] leading-[1.5] text-muted">
        <VisIcon className="size-4 shrink-0" aria-hidden />
        {visibility.text}
      </span>
    );
    action = (
      <span className="flex flex-col gap-2 md:flex-row md:self-start">
        <button type="button" onClick={openPassport} className={`${FILL_BTN} w-full md:w-auto`}>
          Abrir pasaporte
        </button>
        <button type="button" onClick={() => setPrivacyOpen(true)} className={`${GHOST_BTN} w-full !text-[14px] md:w-auto`}>
          <Users className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
          Quién lo ve
        </button>
      </span>
    );
  } else if (next) {
    const stampDay = new Date(planEndsAt(next.endsAt).getTime() + DAY_MS);
    const left = Math.max(1, Math.ceil((stampDay.getTime() - now) / DAY_MS));
    headline = "Aún sin sellos";
    body = (
      <span className="text-[14px] leading-[1.5] text-muted">
        Tu primer sello llegará el <b className="font-[var(--fw-semibold)] text-app">{dayMonth(stampDay)}</b>, cuando termine «{next.title}».
      </span>
    );
    chip = (
      <span className="inline-flex h-7 items-center gap-1.5 self-start rounded-full border border-[var(--border-strong)] bg-surface-2 px-2.5 text-[12px] font-[var(--fw-semibold)] tabular-nums text-app">
        <CalendarDays className="size-3.5" aria-hidden />
        {left === 1 ? "Falta 1 día" : `Faltan ${left} días`}
      </span>
    );
    action = (
      <button type="button" onClick={() => router.push(planPath(next.id))} className={`${GHOST_BTN} w-full !text-[14px] md:w-auto md:self-start`}>
        <MapPin className="size-[18px]" aria-hidden />
        Ver «{next.title}»
      </button>
    );
  } else {
    headline = "En blanco";
    body = <span className="text-[14px] leading-[1.5] text-muted">Cada viaje que termines con Frimee deja aquí su sello.</span>;
    action = (
      <button type="button" onClick={goCreate} className={`${FILL_BTN} w-full md:w-auto md:self-start`}>
        Crea tu primer plan
      </button>
    );
  }

  const ghost = finished === 0 && next ? { place: next.locationName || next.title, dates: dateRangeLabel(next.startsAt, next.endsAt) } : null;

  return (
    <section aria-label="Pasaporte" className="flex flex-col gap-4 md:gap-8 md:pt-2">
      <div className="flex items-center gap-4 md:flex-wrap md:gap-10">
        <span className="md:hidden">
          <ClosedBook nombre={nombre} width={112} ghost={ghost} />
        </span>
        <span className="hidden md:block">
          <ClosedBook nombre={nombre} width={176} ghost={ghost} big />
        </span>
        <span className="flex min-w-0 flex-col gap-2.5 md:flex-1 md:basis-[260px] md:gap-[22px]">
          <span className="flex flex-col gap-2.5">
            <span className={LABEL}>PASAPORTE</span>
            <span className={`whitespace-pre-line text-[28px] leading-[1.1] md:text-[40px] ${SERIF}`}>{headline}</span>
            {chip}
            {body}
          </span>
          <span className="hidden md:block">{action}</span>
        </span>
      </div>
      <div className="md:hidden">{action}</div>
      {recientes.length > 0 && (
        <>
          <div className="md:hidden">
            <RecentStrip items={recientes.slice(0, 3)} compact />
          </div>
          <div className="hidden md:block">
            <RecentStrip items={recientes} />
          </div>
        </>
      )}
      {privacyOpen && (
        <PassportPrivacySheet ajustes={ajustes} shareUrl={`${window.location.origin}/profile/${userId}`} onChange={setAjustesLocal} onClose={() => setPrivacyOpen(false)} />
      )}
      {reader &&
        pasaporte &&
        createPortal(
          <PassportReader
            nombre={nombre}
            sellos={pasaporte.sellos}
            ajustes={ajustes}
            userId={userId}
            onAjustesChange={setAjustesLocal}
            fromCover={reader.from}
            profile={document.querySelector<HTMLElement>("[data-profile-root]")}
            closing={closing}
            onRequestClose={() => window.history.back()}
            onClosed={closeReader}
          />,
          document.body,
        )}
    </section>
  );
}

/** Libreta cerrada: hojas asomando por el canto, cinta y tapa, inclinada −3°. Estática. La tapa es la que vuela al abrir (`data-passport-cover`). */
function ClosedBook({ nombre, width, ghost, big = false }: { nombre: string; width: number; ghost: { place: string; dates: string } | null; big?: boolean }) {
  const h = Math.round((width * 185) / 132);
  const sc = big ? 1.3 : 1;
  const w = ghost ? Math.round(width * 0.58 + 101 * sc) + 6 : width + 8;
  return (
    <span className="relative block shrink-0 -rotate-3 p-2" style={{ width: w + 16, height: h + 50 }}>
      <span aria-hidden="true" className="absolute rounded-[8px]" style={{ left: 14, top: 12, width: width, height: h, background: `repeating-linear-gradient(to bottom, ${BOOK.paper} 0 2px, #DCE1D8 2px 3px)`, boxShadow: "var(--book-shadow-small)" }} />
      <span aria-hidden="true" className="absolute" style={{ left: 8 + Math.round(width * 0.62), top: 8 + h - 6, width: 12, height: 34, background: BOOK.ribbon, clipPath: "polygon(0 0,100% 0,100% 100%,50% calc(100% - 9px),0 100%)" }} />
      {ghost && (
        <GhostPlanStamp
          place={ghost.place}
          dates={ghost.dates}
          className="absolute"
          style={{ left: 8 + Math.round(width * 0.58), top: 8 + Math.round(width * 0.5), transform: `rotate(-4deg) scale(${sc})`, transformOrigin: "top left" }}
        />
      )}
      <span data-passport-cover className="absolute" style={{ left: 8, top: 8 }}>
        <PassportCover name={nombre} width={width} tilt={0} />
      </span>
    </span>
  );
}

/** Tira de papel con los últimos sellos. El papel es claro también en oscuro, como en la libreta. */
function RecentStrip({ items, compact = false }: { items: Sello[]; compact?: boolean }) {
  const h = compact ? 178 : 196;
  const box = compact ? 80 : 96;
  const rot = [-4, 6, -5, 3];
  return (
    <div
      className="relative w-full max-w-[640px] overflow-hidden rounded-[6px]"
      style={{ ...PAPER_VARS, height: h, background: BOOK.paper, color: BOOK.text, boxShadow: "0 1px 0 #d6dbd2, 0 2px 0 #e9ece4, 0 3px 0 #d2d7ce" }}
    >
      <PaperGuilloche w={640} h={h} seed={2} />
      <span className="absolute left-4 top-2.5 text-[11px] font-[var(--fw-semibold)] tracking-[0.08em]" style={{ color: BOOK.label }}>
        ÚLTIMOS SELLOS
      </span>
      <ul className="absolute inset-0 m-0 grid list-none p-0" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((s, i) => (
          <li key={s.id} className="relative flex flex-col items-center">
            <span className="flex items-center justify-center" style={{ marginTop: compact ? 26 : 30, height: box }}>
              <span className="block leading-[0]" style={{ opacity: 0.92 }}>
                {s.kind === "pais" ? <CountryStamp sello={s} size={compact ? 72 : 84} tilt={rot[i % 4]} nuevo={s.nuevo} /> : <PlanStamp sello={s} size={compact ? 100 : 124} tilt={rot[i % 4]} nuevo={s.nuevo} />}
              </span>
            </span>
            <span className="mb-2.5 mt-auto flex min-w-0 max-w-full flex-col items-center px-1 text-center">
              <span className="max-w-full truncate text-[14px] font-[var(--fw-semibold)] leading-[1.4]">{s.kind === "pais" ? countryName(s.country_code ?? "") : s.plan?.titulo}</span>
              <span className="text-[12px] leading-[1.4] tabular-nums" style={{ color: BOOK.label }}>{dateLabel(s.stamped_at)}</span>
            </span>
            {s.nuevo && (
              <span className="absolute h-[22px] rounded-full px-2 text-[12px] font-[var(--fw-semibold)] leading-[22px] text-white" style={{ right: 6, top: compact ? 18 : 22, background: "#227a6c" }}>
                Nuevo
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Wallet({ tickets, now }: { tickets: PlanTicket[]; now: number }) {
  const router = useRouter();
  // Todos los billetes próximos, del más cercano al más lejano; la lista enseña los 2 primeros.
  const nextAll = useMemo(
    () =>
      tickets
        .filter((t) => t.status === "upcoming" && new Date(t.ends_at ?? t.starts_at).getTime() >= now)
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [tickets, now],
  );
  const upcoming = nextAll.slice(0, 2);
  // Sin próximos: el último billete (por fecha) lleva a la cartera.
  const lastTicket = useMemo(() => [...tickets].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0] ?? null, [tickets]);
  const nextText = nextAll.length === 0 ? "ninguno próximo" : nextAll.length === 1 ? "1 próximo" : `${nextAll.length} próximos`;

  return (
    <section aria-label="Cartera" className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="m-0 text-[18px] font-[var(--fw-semibold)] leading-[1.3]">Cartera</h2>
        <span className="text-[14px] tabular-nums text-muted">
          {tickets.length === 0 ? "vacía" : `${tickets.length} ${tickets.length === 1 ? "billete" : "billetes"} · ${nextText}`}
        </span>
        {tickets.length > 0 && (
          <button type="button" onClick={() => router.push("/wallet")} className={`${TEXT_BTN} ml-auto rounded-[4px] ${FOCUS}`}>
            Abrir
            <ChevronRight className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-start gap-3.5 rounded-[8px] border-[1.5px] border-dashed border-[var(--border-strong)] p-5">
          <div className="flex items-center gap-3.5">
            <TicketStub type="other" />
            <p className="m-0 text-[14px] leading-[1.5] text-muted">Guarda aquí tus billetes, reservas y entradas para tenerlos a mano en el viaje.</p>
          </div>
          <button type="button" onClick={() => router.push("/wallet")} className={`${GHOST_BTN} w-full !text-[14px] md:w-auto`}>
            <Plus className="size-[18px] shrink-0" aria-hidden />
            Añadir billete
          </button>
        </div>
      ) : upcoming.length === 0 && lastTicket ? (
        <Link href="/wallet" className={`flex min-h-16 items-center gap-3 rounded-[8px] border border-app bg-surface px-3 py-2 text-app no-underline transition-colors hover:bg-surface-2 ${FOCUS}`}>
          <TicketStub type={lastTicket.type} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[16px] font-[var(--fw-semibold)] leading-[1.35]">Ver la cartera</span>
            <span className="truncate text-[14px] leading-[1.5] tabular-nums text-muted">
              Último: {[ticketName(lastTicket), ticketWhen(lastTicket.starts_at)].join(" · ")}
            </span>
          </span>
          <ChevronRight className="size-[18px] shrink-0 text-muted" aria-hidden />
        </Link>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-[8px] border border-app bg-surface p-0 ">
          {upcoming.map((t, i) => (
            <li key={t.id} className={i > 0 ? "border-t border-app" : ""}>
              <Link href="/wallet" className={`flex min-h-16 items-center gap-3 px-3 py-2 text-app no-underline transition-colors hover:bg-surface-2 ${FOCUS}`}>
                <TicketStub type={t.type} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-[16px] font-[var(--fw-semibold)] leading-[1.35]">
                    <span className="truncate">{ticketName(t)}</span>
                    {i === 0 && (
                      <span className="h-[22px] shrink-0 rounded-full border border-[var(--chat-me-border)] bg-[var(--chat-me)] px-2 text-[12px] font-[var(--fw-semibold)] leading-5 text-app">
                        Próximo
                      </span>
                    )}
                  </span>
                  <span className="truncate text-[14px] leading-[1.5] tabular-nums text-muted">
                    {[t.plan_titulo, ticketWhen(t.starts_at)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Talón de 52 × 32 con muescas y trepado; el icono depende del tipo de billete. */
function TicketStub({ type }: { type: PlanTicket["type"] }) {
  return (
    <span aria-hidden="true" className="relative block h-8 w-[52px] shrink-0 text-[var(--text-primary)]">
      <svg width="52" height="32" viewBox="0 0 64 40" className="absolute inset-0">
        <path d="M4 2h56a2 2 0 0 1 2 2v11a5 5 0 0 0 0 10v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V25a5 5 0 0 0 0-10V4a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M46 6v28" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2.5" />
        <path d="M51 14h6M51 20h6M51 26h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="absolute left-[10px] top-[8px] flex size-4 items-center justify-center">
        <TicketTypeIcon type={type} className="size-4" />
      </span>
    </span>
  );
}

/** Tarjeta del pasaporte cargando: la misma en tu perfil y en el de otra persona. */
export function PassportLoadingCard({ nombre = "", plain = false }: { nombre?: string; plain?: boolean }) {
  return (
    <section role="status" aria-label="Cargando tu perfil" className={`${plain ? "" : CARD} flex items-center gap-4 ${plain ? "py-2" : "px-4 py-5"} md:gap-10 ${plain ? "" : "md:p-8"}`}>
      <PassportCover name={nombre} loading />
      <span className="flex flex-1 flex-col gap-3">
        <span className="skeleton-shimmer h-3 w-20 rounded-full" />
        <span className="skeleton-shimmer h-7 w-40 rounded-full" />
        <span className="skeleton-shimmer h-3 w-28 rounded-full opacity-70" />
      </span>
      <span className="sr-only">Cargando tu perfil…</span>
    </section>
  );
}

function ProfileError({ onRetry }: { onRetry: () => void }) {
  return (
    <section role="alert" className={`${CARD} flex flex-col items-start gap-3 p-5`}>
      <p className="m-0 text-[16px] font-[var(--fw-semibold)]">No se pudo cargar tu perfil</p>
      <p className="m-0 text-[14px] leading-[1.5] text-muted">Comprueba la conexión y vuelve a intentarlo.</p>
      <button type="button" onClick={onRetry} className={GHOST_BTN}>Reintentar</button>
    </section>
  );
}
