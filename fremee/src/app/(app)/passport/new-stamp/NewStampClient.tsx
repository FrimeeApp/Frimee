"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useRouter, useSearchParams } from "next/navigation";
import { Stamp, X } from "lucide-react";
import { FILL_BTN, FOCUS, GHOST_BTN, LABEL, SERIF } from "@/components/plans/home/pieces";
import { BOOK, PAPER_VARS, PaperGuilloche } from "@/components/profile/passport/Libreta";
import { CountryStamp, HitoStamp, PlanStamp, noFuiQuita } from "@/components/profile/passport/stamps";
import { useAuth } from "@/providers/AuthProvider";
import { leerPasaporte, marcarNoFui, marcarSellosVistos } from "@/services/api/endpoints/pasaporte.endpoint";
import { buildPages, countryName, countryOrdinal, groupTrips, hash, pendingTrips, tripPageNumber, unseenIds, type Sello, type Trip } from "@/lib/passport";

/**
 * Pantalla «Sello nuevo» (tablero SelloNuevo): celebra un viaje recién sellado, una sola vez.
 * Al enseñarlo se marcan sus sellos como vistos: volver a tocar el aviso lleva directo a la libreta.
 * Si hay varios viajes sin ver, se enseña uno por plan («1 de 2»).
 */

const PAGE_W = 358;
const PAGE_H = 250;
const HITO_ROW = 64;
/** Los avisos solo salen de planes que terminaron hace como mucho una semana. */
const RECENT_DAYS = 7;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Escala la página de ejemplo al ancho disponible (hasta 420 px; en pantallas estrechas, más pequeña). */
function useFit(base: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / base);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [base]);
  return [ref, scale] as const;
}

const lista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : (xs[0] ?? ""));

export default function NewStampClient() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const planParam = Number(useSearchParams().get("plan")) || null;

  const [sellos, setSellos] = useState<Sello[] | null>(null);
  const [queue, setQueue] = useState<number[]>([]);
  const [position, setPosition] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const marked = useRef(new Set<number>());

  const profileHref = userId ? (Capacitor.isNativePlatform() ? `/profile/static?id=${userId}` : `/profile/${userId}`) : "/calendar";

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    leerPasaporte()
      .then((p) => {
        if (cancelled) return;
        // El viaje del aviso va primero, aunque sea antiguo; después, el resto de recientes sin ver.
        const todos = pendingTrips(p.sellos);
        const recientes = pendingTrips(p.sellos, RECENT_DAYS).map((t) => t.planId);
        const ids = [...(planParam && todos.some((t) => t.planId === planParam) ? [planParam] : []), ...recientes.filter((id) => id !== planParam)];
        if (ids.length === 0) {
          // Ya visto (o no existe): nada que celebrar, directo a la libreta.
          const page = planParam ? tripPageNumber(buildPages(groupTrips(p.sellos)), planParam) : null;
          router.replace(page ? `/passport?plan=${planParam}` : "/passport");
          return;
        }
        setSellos(p.sellos);
        setQueue(ids);
      })
      .catch((err) => {
        console.error("[pasaporte] No se pudo cargar el sello nuevo:", (err as { message?: string } | null)?.message ?? err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, planParam, attempt, router]);

  const planId = queue[position] ?? null;
  const trip = useMemo<Trip | null>(() => (sellos && planId !== null ? groupTrips(sellos).find((t) => t.planId === planId) ?? null : null), [sellos, planId]);
  const pages = useMemo(() => (sellos ? buildPages(groupTrips(sellos)) : []), [sellos]);

  // Enseñarlo es verlo: el servidor lo recuerda y no se vuelve a celebrar.
  useEffect(() => {
    if (!trip) return;
    const ids = unseenIds(trip).filter((id) => !marked.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => marked.current.add(id));
    marcarSellosVistos(ids).catch((err) => console.error("[pasaporte] No se marcaron los sellos como vistos:", (err as { message?: string } | null)?.message ?? err));
  }, [trip]);

  useEffect(() => {
    if (!confirming) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && !busy && setConfirming(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [confirming, busy]);

  const next = useCallback(() => {
    setConfirming(false);
    setActionError(null);
    setPosition((n) => n + 1);
  }, []);

  const noFui = async () => {
    if (planId === null) return;
    setBusy(true);
    setActionError(null);
    try {
      await marcarNoFui(planId);
      setBusy(false);
      setConfirming(false);
      setSellos((all) => (all ? all.filter((s) => s.plan_id !== planId) : all));
      // Si quedan más viajes por enseñar, siguen; si no, al perfil.
      if (position < queue.length - 1) setQueue((q) => q.filter((id) => id !== planId));
      else router.replace(profileHref);
    } catch (err) {
      console.error("[pasaporte] No se pudo marcar «No fui»:", (err as { message?: string } | null)?.message ?? err);
      setActionError("No se pudo completar. Comprueba la conexión y vuelve a intentarlo.");
      setBusy(false);
    }
  };

  if (failed) {
    return (
      <div className="min-h-dvh bg-app px-4 pt-mobile-safe-top text-app">
        <div role="alert" className="mx-auto flex max-w-[460px] flex-col items-start gap-3 p-4 pt-14">
          <p className="m-0 text-[16px] font-[var(--fw-semibold)]">No se pudo cargar el sello</p>
          <p className="m-0 text-[14px] leading-[1.5] text-muted">Comprueba la conexión y vuelve a intentarlo.</p>
          <div className="flex gap-2">
            <button type="button" className={GHOST_BTN} onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>
              Reintentar
            </button>
            <button type="button" className={GHOST_BTN} onClick={() => router.replace("/passport")}>
              Abrir mi pasaporte
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!sellos || !trip) {
    return (
      <div role="status" aria-label="Cargando el sello" className="min-h-dvh bg-app px-4 pt-mobile-safe-top">
        <div className="mx-auto max-w-[460px] pt-[72px]">
          <div className="skeleton-shimmer h-4 w-28 rounded-[4px]" />
          <div className="skeleton-shimmer mt-3 h-9 w-3/4 rounded-[4px]" />
          <div className="skeleton-shimmer mt-5 aspect-[358/250] w-full rounded-[8px]" />
        </div>
      </div>
    );
  }

  const info = trip.info;
  const titulo = info?.titulo ?? "Viaje";
  const lugar = info?.ubicacion_nombre?.split(",")[0]?.trim() || titulo;
  const pagina = tripPageNumber(pages, trip.planId);
  const pais = trip.paises[0] ?? null;
  const nPais = trip.paises.length === 1 && pais?.country_code ? countryOrdinal(sellos, pais.country_code, pais.id) : 0;
  const nombresPaises = trip.paises.filter((s) => s.country_code).map((s) => countryName(s.country_code!));
  const year = Number(trip.date.slice(0, 4));
  const total = queue.length;
  const isLast = position >= total - 1;

  // «Su sello ya está en la página 3, junto al de Portugal» la primera vez; «Es tu 2.º sello de Portugal. Está en la página 3» al repetir.
  const donde = pagina ? `la página ${pagina}` : "tu pasaporte";
  const nota =
    nPais > 1 && pais?.country_code
      ? `Terminó «${titulo}». Es tu ${nPais}.º sello de ${countryName(pais.country_code)}. Está en ${donde}.`
      : nombresPaises.length === 0
        ? `Terminó «${titulo}». Su sello ya está en ${donde}.`
        : `Terminó «${titulo}». Su sello ya está en ${donde}, ${nombresPaises.length > 1 ? "junto a los de" : "junto al de"} ${lista(nombresPaises)}.`;

  const primary = (
    <button type="button" className={`${FILL_BTN} w-full md:w-auto md:px-6 ${FOCUS}`} onClick={() => (isLast ? router.replace(`/passport?plan=${trip.planId}`) : next())}>
      {isLast ? "Abrir mi pasaporte" : "Siguiente sello"}
    </button>
  );
  const notThere = (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`inline-flex h-11 w-full items-center justify-center rounded-[8px] text-[14px] font-[var(--fw-semibold)] leading-[1.2] text-muted hover:text-app md:w-auto md:px-4 ${FOCUS}`}
    >
      No fui a este viaje
    </button>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-app text-app">
      <div className="mx-auto flex h-14 w-full max-w-[960px] shrink-0 items-center justify-between px-2 pt-mobile-safe-top md:px-6">
        <button type="button" aria-label="Cerrar" onClick={() => router.replace(profileHref)} className={`inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
          <X className="size-[22px]" aria-hidden />
        </button>
        {total > 1 && <span aria-live="polite" className="pr-3 text-[14px] tabular-nums text-muted">{position + 1} de {total}</span>}
      </div>

      {/*
        Móvil: título, página y nota en una columna, con los botones fijos abajo.
        Escritorio: la página a la izquierda; título, nota y botones a la derecha.
        key: al pasar de un viaje al siguiente, todo se vuelve a estampar.
      */}
      <div
        key={trip.planId}
        className="mx-auto grid w-full max-w-[960px] flex-1 grid-cols-1 content-start gap-x-16 gap-y-5 px-4 pb-4 md:grid-cols-[420px_minmax(0,400px)] md:content-center md:justify-center md:gap-y-3 md:px-12 md:pb-16"
      >
        <div role="status" className="flex flex-col items-center gap-2 text-center md:col-start-2 md:row-start-1 md:items-start md:self-end md:text-left">
          <p className="m-0 inline-flex items-center gap-1.5 text-[12px] font-[var(--fw-semibold)] leading-[1.4] tracking-[.02em] text-[var(--chat-accent-text)]">
            <Stamp className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            SELLO NUEVO
          </p>
          <h1 className={`m-0 text-[32px] leading-[1.1] md:text-[48px] ${SERIF}`}>{lugar} ya está en tu pasaporte</h1>
        </div>

        <div className="md:col-start-1 md:row-span-2 md:row-start-1 md:self-center">
          <MiniPage trip={trip} year={year} page={pagina} />
        </div>

        <div className="flex flex-col items-center md:col-start-2 md:row-start-2 md:items-start md:self-start">
          <p className="m-0 px-2 text-center text-[16px] leading-[1.6] text-muted md:px-0 md:text-left">{nota}</p>
          {/* Acompañantes: pendiente del backend de acompañantes (backlog). */}
          <div className="mt-5 hidden items-center gap-2 md:flex">
            {primary}
            {notThere}
          </div>
        </div>
      </div>

      {/* Móvil: botones fijos abajo, sin huecos. */}
      <div className="sticky bottom-0 mx-auto flex w-full max-w-[460px] shrink-0 flex-col gap-1 border-t border-app bg-app px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:hidden">
        {primary}
        {notThere}
      </div>

      {confirming && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-[60] bg-black/60" onClick={() => !busy && setConfirming(false)} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="no-fui-title"
            className="fixed left-1/2 top-1/2 z-[61] flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[8px] border border-app bg-surface p-6 text-app shadow-[0_12px_24px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)]"
          >
            <h2 id="no-fui-title" className="m-0 text-[20px] font-[var(--fw-semibold)] leading-tight">¿Quitar «{titulo}» de tu pasaporte?</h2>
            <p className="m-0 text-[16px] leading-[1.5] text-muted">Se quitarán {noFuiQuita(sellos, trip.planId)}. Puedes volver a añadirlo desde el plan.</p>
            {actionError && (
              <p role="alert" className="m-0 text-[14px] leading-[1.5] text-[var(--error)]">
                {actionError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <button type="button" autoFocus disabled={busy} onClick={() => { setConfirming(false); setActionError(null); }} className={`${GHOST_BTN} !h-11 !text-[14px]`}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void noFui()}
                className={`inline-flex h-11 items-center justify-center rounded-[8px] bg-[var(--error)] px-4 text-[14px] font-[var(--fw-semibold)] text-[var(--error-contrast)] disabled:opacity-[var(--disabled-opacity)] ${FOCUS}`}
              >
                {busy ? "Quitando…" : "Quitar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Mini página del año con lo que ha dado el viaje: sello de plan, sello de país y, si lo hay, sus hitos. */
function MiniPage({ trip, year, page }: { trip: Trip; year: number; page: number | null }) {
  const [boxRef, scale] = useFit(PAGE_W);
  const pais = trip.paises[0] ?? null;
  const hitos = trip.hitos.filter((h) => h.hito);
  const h = PAGE_H + (hitos.length ? HITO_ROW : 0);
  const drop = (delay: number): React.CSSProperties => ({ ["--stamp-delay" as string]: `${delay}ms` });
  const planX = pais ? 22 : (PAGE_W - 162) / 2;

  return (
    <div ref={boxRef} className="mx-auto flex w-full max-w-[420px] justify-center">
      <div style={{ width: PAGE_W * scale, height: h * scale }}>
        <div
          role="img"
          aria-label={`Página del año ${year} con el sello de ${trip.info?.titulo ?? "tu viaje"}`}
          className="relative overflow-hidden rounded-[8px]"
          style={{ ...PAPER_VARS, background: BOOK.paper, color: BOOK.text, boxShadow: "2px 0 0 #d6dbd2, 3px 0 0 #e9ece4, 4px 0 0 #d2d7ce", width: PAGE_W, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <PaperGuilloche w={PAGE_W} h={h} seed={page ?? hash(trip.planId)} />
          <div className={`absolute inset-x-4 top-[14px] flex justify-between ${LABEL}`}>
            <span>VISADOS · VISAS</span>
            {page && <span className="tabular-nums">PÁG. {pad2(page)}</span>}
          </div>
          <h2 className={`absolute left-4 top-[34px] m-0 text-[28px] leading-[1.1] ${SERIF}`}>{year}</h2>

          {/* El hueco en el que va a caer el sello, que se queda debajo. */}
          <span aria-hidden="true" className="absolute h-[110px] w-[160px] rounded-[8px] border-2 border-dashed border-[var(--passport-ink-new)] opacity-50" style={{ left: planX + 4, top: 92, transform: "rotate(-6deg)" }} />
          {trip.plan && (
            <span className="passport-stamp-drop absolute block leading-[0]" style={{ left: planX, top: 88, ...drop(300) }}>
              <PlanStamp sello={trip.plan} size={162} tilt={-6} nuevo />
            </span>
          )}
          {pais && (
            <span className="passport-stamp-drop absolute block leading-[0]" style={{ left: 200, top: 70, ...drop(420) }}>
              <CountryStamp sello={pais} size={112} tilt={9} nuevo />
            </span>
          )}
          {trip.paises.length > 1 && (
            <span className="absolute inline-flex h-6 items-center rounded-full border border-[var(--border-strong)] bg-surface-2 px-2 text-[12px] font-[var(--fw-semibold)] leading-none" style={{ left: 200, top: 196 }}>
              {trip.paises.length} países
            </span>
          )}
          {hitos.length > 0 && (
            <div className="absolute flex gap-2.5" style={{ left: 16, top: PAGE_H - 8 }}>
              {hitos.map((s, i) => (
                <span key={s.id} className="passport-stamp-drop block leading-[0]" style={drop(540 + i * 120)}>
                  <HitoStamp hito={s.hito!} id={s.id} size={52} tilt={i % 2 ? 5 : -5} nuevo />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
