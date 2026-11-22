"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { Ban, BookOpen, Check, ChevronLeft, ChevronRight, Lock, MessageCircle, MoreHorizontal, Plus, UserCheck, UserPlus, Users } from "lucide-react";
import { FILL_BTN, FOCUS, GHOST_BTN, LABEL, SERIF } from "@/components/plans/home/pieces";
import { computeStats, countryName, dateLabel, latestStamps, planRangeLabel, type Sello } from "@/lib/passport";
import type { AccesoPasaporte, PerfilAjeno, PlanComun, Relacion } from "@/services/api/endpoints/perfilAjeno.endpoint";
import { CountryStamp, PlanStamp } from "../passport/stamps";
import { PassportCover } from "../passport/PassportCover";
import dynamic from "next/dynamic";

/** El lector es una capa que se abre al pulsar: solo se carga en el cliente (no depende de la hora ni del tamaño de ventana del servidor). */
const PassportReader = dynamic(() => import("../passport/PassportReader"), { ssr: false });

/**
 * Perfil de otra persona (tablero «Amistad / Sin amistad»): cabecera, acciones según la relación, su pasaporte
 * (según su privacidad) y «En común». La cartera nunca aparece aquí.
 */

export type OtherProfileData = {
  id: string;
  fullName: string;
  firstName: string;
  avatarUrl: string | null;
  relationship: Relacion;
  access: AccesoPasaporte;
  /** Sus sellos, ya filtrados por el servidor según su privacidad; vacío si no los ves. */
  sellos: Sello[];
  common: PerfilAjeno["en_comun"];
  juntosIds: number[];
};

type Props = {
  data: OtherProfileData;
  blocked: boolean;
  onMessage: () => Promise<void>;
  onInvite: () => void;
  onAddFriend: () => Promise<void>;
  onAcceptFriend: () => Promise<void>;
  onCancelRequest: () => Promise<void>;
  onRemoveFriend: () => void; // pide confirmación fuera
  onBlock: () => void;
  onUnblock: () => Promise<void>;
  backHref: string;
};

const planPath = (id: number) => (Capacitor.isNativePlatform() ? `/plans/static?id=${id}` : `/plans/${id}`);
const tripDates = (p: PlanComun) => planRangeLabel({ titulo: p.titulo, ubicacion_nombre: null, inicio_at: p.inicio_at, fin_at: p.fin_at, all_day: p.all_day }).toLowerCase();

/* ---------------- piezas ---------------- */

/** Nombre largo: 2 líneas como máximo y tamaño por tramos (48 / 40 / 32 en escritorio). */
function NameHeading({ name }: { name: string }) {
  const n = name.trim().length;
  const size = n <= 18 ? "text-[32px] md:text-[48px]" : n <= 26 ? "text-[28px] md:text-[40px]" : "text-[24px] md:text-[32px]";
  return (
    <h1 title={name} className={`m-0 line-clamp-2 break-words leading-[1.05] ${size} ${SERIF}`}>
      {name}
    </h1>
  );
}

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  return url ? (
    <Image src={url} alt={`Foto de ${name}`} width={size} height={size} unoptimized referrerPolicy="no-referrer" className="shrink-0 rounded-full border border-[var(--border-strong)] bg-surface-2 object-cover" style={{ width: size, height: size }} />
  ) : (
    <span role="img" aria-label={`Foto de ${name}`} className={`grid shrink-0 place-content-center rounded-full border border-[var(--border-strong)] bg-surface-2 ${SERIF}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}

function MoreMenu({ data, blocked, onRemoveFriend, onBlock, onUnblock }: Pick<Props, "data" | "blocked" | "onRemoveFriend" | "onBlock" | "onUnblock">) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const item = `flex min-h-11 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-[14px] font-[var(--fw-semibold)] hover:bg-surface-2 ${FOCUS}`;
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Más opciones" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)} className={`grid size-11 place-content-center rounded-[8px] text-app ${FOCUS}`}>
        <MoreHorizontal className="size-[22px]" aria-hidden />
      </button>
      {open && (
        <div id={menuId} role="menu" className="absolute right-0 top-12 z-30 w-56 rounded-[8px] border border-app bg-[var(--bg)] p-1 shadow-[0_4px_12px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.2)]">
          {data.relationship === "friend" && (
            <button
              role="menuitem"
              type="button"
              className={`${item} text-app`}
              onClick={() => {
                setOpen(false);
                onRemoveFriend();
              }}
            >
              Quitar amistad
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            className={`${item} text-[var(--error)]`}
            onClick={() => {
              setOpen(false);
              if (blocked) void onUnblock();
              else onBlock();
            }}
          >
            <Ban className="size-[18px] shrink-0" aria-hidden />
            {blocked ? `Desbloquear a ${data.firstName}` : `Bloquear a ${data.firstName}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Actions({ data, onMessage, onInvite, onAddFriend, onAcceptFriend, onCancelRequest }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      console.error("[perfil] Error en la acción:", (err as { message?: string } | null)?.message ?? err);
      setError("No se pudo completar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  const note = "m-0 text-center text-[12px] leading-[1.4] text-muted md:text-right";
  const btn = "w-full md:w-auto";
  let content: React.ReactNode;
  if (data.relationship === "friend") {
    content = (
      <div className="grid grid-cols-2 gap-2 md:flex">
        <button type="button" disabled={busy} onClick={run(onMessage)} className={`${FILL_BTN} ${btn}`}>
          <MessageCircle className="size-[18px] shrink-0" aria-hidden />
          Enviar mensaje
        </button>
        <button type="button" onClick={onInvite} className={`${GHOST_BTN} bg-surface-2 ${btn}`}>
          <Plus className="size-[18px] shrink-0" aria-hidden />
          Invitar a un plan
        </button>
      </div>
    );
  } else if (data.relationship === "request_received") {
    content = (
      <div className="flex flex-col gap-1.5 md:items-end">
        <button type="button" disabled={busy} onClick={run(onAcceptFriend)} className={`${FILL_BTN} ${btn}`}>
          <UserCheck className="size-[18px] shrink-0" aria-hidden />
          Aceptar amistad
        </button>
        <p className={note}>{data.firstName} te ha enviado una solicitud.</p>
      </div>
    );
  } else if (data.relationship === "request_sent") {
    content = (
      <div className="flex flex-col gap-1.5 md:items-end">
        <button type="button" disabled={busy} onClick={run(onCancelRequest)} className={`${GHOST_BTN} bg-surface-2 ${btn}`}>
          <Check className="size-[18px] shrink-0" aria-hidden />
          Solicitud enviada
        </button>
        <p className={note}>Toca para cancelarla.</p>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-1.5 md:items-end">
        <button type="button" disabled={busy} onClick={run(onAddFriend)} className={`${FILL_BTN} ${btn}`}>
          <UserPlus className="size-[18px] shrink-0" aria-hidden />
          Añadir amistad
        </button>
        <p className={note}>Si acepta, os podréis escribir y ver vuestros pasaportes.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 md:items-end">
      {content}
      {error && (
        <p role="alert" className="m-0 text-center text-[12px] leading-[1.4] text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}

function PassportBlock({ data }: { data: OtherProfileData }) {
  // El pasaporte se abre como capa encima del perfil, con su paso en el historial (como en tu perfil).
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
    const from = ([...document.querySelectorAll<HTMLElement>("[data-passport-cover]")].find((e) => e.getClientRects().length > 0)?.firstElementChild as HTMLElement | null) ?? null;
    window.history.pushState({ passportReader: true }, "");
    setClosing(false);
    setReader({ from });
  };

  if (data.access === "hidden") return null; // «Solo yo»: no existe para los demás

  if (data.access === "friends_only") {
    return (
      <section aria-label={`Pasaporte de ${data.firstName}`} className="flex items-center gap-4 rounded-[8px] border border-app bg-surface p-4 md:gap-8 md:p-8">
        <div className="relative shrink-0 opacity-55">
          <PassportCover width={104} name={data.fullName} />
          <span className="absolute inset-0 m-auto grid size-11 place-content-center rounded-full border border-[var(--border-strong)] bg-surface text-app">
            <Lock className="size-5" aria-hidden />
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className={LABEL}>PASAPORTE</span>
          <p className={`m-0 text-[26px] leading-[1.1] md:text-[40px] ${SERIF}`}>Solo para sus amistades</p>
          <p className="m-0 text-[14px] leading-[1.5] text-muted">{data.firstName} enseña su pasaporte solo a quien ya es su amistad en Frimee.</p>
        </div>
      </section>
    );
  }

  const stats = computeStats(data.sellos);
  const recientes = latestStamps(data.sellos);
  const juntos = new Set(data.juntosIds);
  return (
    <section aria-label={`Pasaporte de ${data.firstName}`} className="flex flex-col gap-4 rounded-[8px] border border-app bg-surface p-4 md:gap-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3 md:gap-8">
        <span data-passport-cover className="md:hidden">
          <PassportCover width={112} name={data.fullName} />
        </span>
        <span data-passport-cover className="hidden md:block">
          <PassportCover width={180} name={data.fullName} />
        </span>
        <div className="flex min-w-[160px] flex-1 flex-col gap-2.5 md:gap-5">
          <div className="flex flex-col gap-2.5">
            <span className={LABEL}>PASAPORTE</span>
            {data.sellos.length > 0 ? (
              <p className={`m-0 text-[28px] leading-[1.1] tabular-nums md:text-[40px] ${SERIF}`}>
                {stats.paises} {stats.paises === 1 ? "país" : "países"},
                <br />
                {stats.planes} {stats.planes === 1 ? "plan" : "planes"}
              </p>
            ) : (
              <p className={`m-0 text-[28px] leading-[1.1] md:text-[40px] ${SERIF}`}>Aún sin sellos</p>
            )}
            {stats.lastStamp && (
              <p className="m-0 text-[14px] leading-[1.5] text-muted">
                Último sello: {stats.lastStamp.place} · {dateLabel(stats.lastStamp.date)}
              </p>
            )}
          </div>
          <button type="button" onClick={openPassport} className={`${GHOST_BTN} self-start bg-surface-2`}>
            <BookOpen className="size-[18px] shrink-0" aria-hidden />
            Abrir pasaporte
          </button>
        </div>
      </div>

      {recientes.length > 0 && (
        <div className="hidden flex-col gap-1 md:flex">
          <h3 className={`m-0 ${LABEL}`}>ÚLTIMOS SELLOS</h3>
          <ul className="m-0 grid list-none grid-cols-4 gap-2 border-t border-app p-0 pt-4">
            {recientes.map((s) => {
              const label = s.kind === "pais" ? countryName(s.country_code ?? "") : s.plan?.titulo ?? "Viaje";
              const together = juntos.has(s.plan_id);
              return (
                <li key={s.id}>
                  <button type="button" onClick={openPassport} aria-label={`${label}, ${dateLabel(s.stamped_at)}${together ? ", viajasteis juntos" : ""}`} className={`relative flex w-full flex-col items-center justify-end gap-2 rounded-[8px] px-1 py-2 text-app ${FOCUS}`}>
                    <span className="flex h-[92px] items-center">{s.kind === "pais" ? <CountryStamp sello={s} size={84} tilt={-4} /> : <PlanStamp sello={s} size={124} tilt={-3} />}</span>
                    {together && (
                      <span className="absolute right-0 top-0 inline-flex h-[22px] items-center gap-1 rounded-full border border-[var(--chat-me-border)] bg-surface px-2 text-[12px] font-[var(--fw-semibold)]">
                        <Users className="size-3" aria-hidden />
                        Juntos
                      </span>
                    )}
                    <span className="max-w-full truncate text-center text-[14px] font-[var(--fw-semibold)]">{label}</span>
                    <span className="text-[12px] tabular-nums text-muted">{dateLabel(s.stamped_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {reader &&
        createPortal(
          <PassportReader
            nombre={data.fullName}
            sellos={data.sellos}
            readOnly
            title={`Pasaporte de ${data.firstName}`}
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

function CommonBlock({ data }: { data: OtherProfileData }) {
  const router = useRouter();
  const { paises, viajes_juntos: viajes, planes_compartidos: compartidos } = data.common;
  const sellosPais = new Map(data.sellos.filter((s) => s.kind === "pais" && s.country_code).map((s) => [s.country_code!, s]));
  // Sin amistad no se cruzan pasaportes: el servidor ya solo manda planes compartidos.
  if (!viajes.length && !compartidos.length && !paises.length) return null;

  const row = (p: PlanComun, meta: string, top: boolean) => (
    <li key={p.plan_id} className={top ? "border-t border-app" : ""}>
      <button type="button" onClick={() => router.push(planPath(p.plan_id))} className={`flex min-h-[60px] w-full items-center gap-3 rounded-[8px] px-3 py-1.5 text-left text-app ${FOCUS}`}>
        <Users className="size-[18px] shrink-0 text-muted" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[16px] font-[var(--fw-semibold)]">{p.titulo}</span>
          <span className="truncate text-[14px] tabular-nums text-muted">{meta}</span>
        </span>
        <ChevronRight className="size-[18px] shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  );

  return (
    <section aria-label="En común" className="flex flex-col gap-2">
      <h2 className="m-0 text-[18px] font-[var(--fw-semibold)] leading-[1.3]">En común</h2>
      <div className="rounded-[8px] border border-app bg-surface">
        {paises.length > 0 && (
          <div className="flex items-center gap-3 p-3">
            <span className="flex items-center gap-1" aria-hidden="true">
              {paises.slice(0, 3).map((c) => {
                const s = sellosPais.get(c);
                return s ? <CountryStamp key={c} sello={s} size={60} tilt={0} /> : null;
              })}
            </span>
            <span className="text-[14px] text-muted">
              Habéis estado los dos en{" "}
              <b className="font-[var(--fw-semibold)] text-app">
                {paises.length} {paises.length === 1 ? "país" : "países"}
              </b>
            </span>
          </div>
        )}
        {viajes.length > 0 && (
          <>
            <p className={`m-0 px-3 pb-1 pt-1 ${LABEL}`}>VIAJES JUNTOS · {viajes.length}</p>
            <ul className="m-0 list-none p-0">{viajes.map((t) => row(t, `${tripDates(t)}${t.personas ? ` · ${t.personas} personas` : ""}`, true))}</ul>
          </>
        )}
        {compartidos.length > 0 && (
          <ul className="m-0 list-none p-0">{compartidos.map((t, i) => row(t, `Estáis en este plan · ${tripDates(t)}`, i > 0 || viajes.length > 0 || paises.length > 0))}</ul>
        )}
      </div>
    </section>
  );
}

/* ---------------- pantalla ---------------- */

export default function OtherProfile(p: Props) {
  const { data } = p;
  const router = useRouter();
  // Sin nada en común no se pinta la columna: así el pasaporte ocupa todo el ancho.
  const hasCommon = data.common.paises.length > 0 || data.common.viajes_juntos.length > 0 || data.common.planes_compartidos.length > 0;
  return (
    <div data-profile-root className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 pb-12 md:gap-6">
      <div className="-mx-2 flex h-14 items-center justify-between">
        <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push(p.backHref))} aria-label="Volver" className={`inline-flex h-11 items-center gap-1 rounded-[8px] px-2 text-[14px] font-[var(--fw-semibold)] text-[var(--primary)] ${FOCUS}`}>
          <ChevronLeft className="size-5" aria-hidden />
          <span className="hidden md:inline">Volver</span>
        </button>
        <MoreMenu data={data} blocked={p.blocked} onRemoveFriend={p.onRemoveFriend} onBlock={p.onBlock} onUnblock={p.onUnblock} />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="md:hidden">
            <Avatar url={data.avatarUrl} name={data.fullName} size={72} />
          </span>
          <span className="hidden md:block">
            <Avatar url={data.avatarUrl} name={data.fullName} size={104} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <NameHeading name={data.fullName} />
            {data.relationship === "friend" && (
              <span className="inline-flex h-[26px] items-center gap-1.5 self-start rounded-full border border-[var(--chat-me-border)] bg-[var(--chat-me)] px-2.5 text-[12px] font-[var(--fw-semibold)]">
                <UserCheck className="size-3.5" aria-hidden />
                Amistad
              </span>
            )}
          </div>
        </div>
        <div className="md:flex md:justify-end">
          <Actions {...p} />
        </div>
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:flex-wrap md:items-start md:gap-6">
        <div className="min-w-0 md:flex-[999_1_560px]">
          <PassportBlock data={data} />
        </div>
        {hasCommon && (
          <div className="min-w-0 md:flex-[1_1_320px]">
            <CommonBlock data={data} />
          </div>
        )}
      </div>
    </div>
  );
}
