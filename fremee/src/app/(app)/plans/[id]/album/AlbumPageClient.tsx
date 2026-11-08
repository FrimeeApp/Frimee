"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Camera, Check, ChevronDown, ChevronLeft, MapPin, Moon, Plane, PlaneLanding, Share2, Ship } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { fetchPlanAlbum, type AlbumMiembro, type PlanAlbum } from "@/services/api/endpoints/album.endpoint";
import { formatKm, type AlbumModel } from "@/lib/album";
import { buildJourney, dashboardAt, travelEase, positionAt, positionFromProgress, routeProgress, type Journey, type Ambient, type JourneyDay, type JourneyLeg, type JourneyPosition, type JourneyStop } from "@/lib/album-journey";
import { createMotion, createScrollStore, type Motion, type ScrollStore } from "@/lib/motion";
import { useIsDarkTheme } from "@/hooks/useIsDarkTheme";
import { formatDateRange, formatMoney, fmtDayHeader, fmtTime } from "@/lib/formatters";
import { formatCompactRouteDistance, formatCompactRouteDuration } from "@/lib/route-formatters";
import { DEMO_PHOTO_CREDITS } from "@/config/demo-photos";
import { getWebAppUrl } from "@/config/external";
import { transportInfo } from "./transport";
import { findMissingLegs, useComputeMissingLegs } from "@/hooks/useComputeMissingLegs";
import { useScrollSteps } from "@/hooks/useScrollSteps";
import { useStepPaging } from "@/hooks/useStepPaging";
import { useInView } from "@/hooks/useInView";
import { TIPOS_TRANSPORTE, updateSubplanViaje, type TipoSubplan } from "@/services/api/endpoints/subplanes.endpoint";
import { JourneyMap } from "./JourneyMap";
import { JourneyMapGL } from "./JourneyMapGL";
import { TRAVELLER_COLORS } from "./Vehicle";
import { Stamp, stampDate } from "./Stamp";
import { Dashboard } from "./Dashboard";
import { PhotoCollage } from "./PhotoCollage";
import { CountUp } from "./CountUp";
import styles from "./album.module.css";

const SERIF = "[font-family:var(--font-display-face)] font-normal";
// How long a leg takes to play once it is on screen: the same for every leg, so the trip
// always moves at one pace. Flights get a little more for the camera to pull back and return.
const LEG_PLAY_MS = 2600;
const FLIGHT_PLAY_MS = 3400;

function capitalize(text: string) {
  const lower = text.toLocaleLowerCase("es-ES");
  return lower.charAt(0).toLocaleUpperCase("es-ES") + lower.slice(1);
}

function planHref(planId: string) {
  return Capacitor.isNativePlatform() ? `/plans/static?id=${planId}` : `/plans/${planId}`;
}

function placeName(stop: JourneyStop) {
  return stop.place;
}

export default function AlbumPageClient() {
  const { user } = useAuth();
  const { id: paramId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  // Mobile static export: /plans/static/album?id=18 (same as the plan page).
  const planId = paramId === "static" ? searchParams.get("id") ?? "" : paramId;

  // The result remembers which plan it belongs to, so a stale one is never shown.
  const [result, setResult] = useState<{ planId: string; album?: PlanAlbum; error?: string } | null>(null);

  useEffect(() => {
    if (!user || !planId) return;
    let cancelled = false;
    fetchPlanAlbum(Number(planId))
      .then((album) => { if (!cancelled) setResult({ planId, album }); })
      .catch((err: { code?: string }) => {
        if (cancelled) return;
        setResult({
          planId,
          error: err?.code === "42501" ? "Este álbum es solo para los miembros del plan." : "No se pudo cargar el álbum.",
        });
      });
    return () => { cancelled = true; };
  }, [planId, user]);

  const current = result?.planId === planId ? result : null;
  const album = current?.album ?? null;
  const error = current?.error ?? null;
  const journey = useMemo(() => (album ? buildJourney(album) : null), [album]);

  // Legs nobody computed yet (itinerary never opened): compute and save them here too,
  // so the map draws real routes and the chapters count km.
  const missingLegs = useMemo(
    // From the activities themselves: a flight's landing stop shares its activity and is no leg.
    () => (journey ? findMissingLegs(journey.days.map((day) => day.stops.filter((stop) => !stop.arrival).map(({ actividad: a }) => ({
      id: a.id,
      isTransport: TIPOS_TRANSPORTE.includes(a.tipo as TipoSubplan),
      transporte: a.transporte_llegada,
      hasLeg: Boolean(a.duracion_viaje || a.distancia_viaje),
      at: a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null,
      end: a.fin_lat != null && a.fin_lng != null ? { lat: a.fin_lat, lng: a.fin_lng } : null,
    })))) : []),
    [journey],
  );
  const handleLegComputed = useCallback((destId: number, duracion: string, distancia: string, polyline: string) => {
    setResult((prev) => prev?.album ? {
      ...prev,
      album: {
        ...prev.album,
        actividades: prev.album.actividades.map((a) =>
          a.id === destId ? { ...a, duracion_viaje: duracion, distancia_viaje: distancia, ruta_polyline: polyline } : a),
      },
    } : prev);
    updateSubplanViaje(destId, duracion, distancia, polyline).catch(() => {});
  }, []);
  useComputeMissingLegs(missingLegs, handleLegComputed);

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-[var(--space-4)] bg-app px-[var(--page-margin-x)] text-app">
        <p className="text-body-sm text-muted">{error}</p>
        <Link href={planHref(planId)} className="text-body-sm text-[var(--primary)]">Volver al plan</Link>
      </main>
    );
  }
  if (!album || !journey) return <main className="min-h-dvh animate-pulse bg-[var(--al-map)]" aria-busy="true" />;

  return <JourneyView album={album} journey={journey} planId={planId} isGuest={Boolean(user?.is_anonymous)} currentUserId={user?.id ?? null} />;
}

function JourneyView({ album, journey, planId, isGuest, currentUserId }: { album: PlanAlbum; journey: Journey; planId: string; isGuest: boolean; currentUserId: string | null }) {
  const mapRef = useRef<HTMLDivElement>(null);
  // Height of the story's sticky header (--al-head), so the leg card sits right below it.
  const mainRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const head = headRef.current;
    const main = mainRef.current;
    if (!head || !main || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => main.style.setProperty("--al-head", `${head.offsetHeight}px`));
    observer.observe(head);
    return () => observer.disconnect();
  }, []);
  // The page moves one step per scroll gesture (scroll-snap). Reaching a leg plays it at a fixed
  // pace, whatever the scroll speed: a small player drives the step progress (for the leg card)
  // and the motion target (for the map) outside React; the page only re-renders per step.
  const [motion] = useState(() => createMotion());
  const [scroll] = useState(() => createScrollStore());
  const playRef = useRef({ frame: 0, step: -1 });
  const onStep = useCallback((i: number) => {
    const player = playRef.current;
    const previous = player.step;
    player.step = i;
    if (player.frame) cancelAnimationFrame(player.frame);
    player.frame = 0;
    const apply = (u: number) => {
      scroll.set(i, u);
      const target = positionAt(journey, i, u);
      motion.setTarget(routeProgress(target), `${target.day}|${target.started}|${target.finished}`);
    };
    const step = journey.steps.at(i);
    if (step?.kind !== "leg") return apply(0);
    // Down the page the group travels the leg; back up it returns to where the leg starts.
    const backwards = previous > i;
    const [from, to] = backwards ? [1, 0] : [0, 1];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return apply(to);
    const leg = journey.days.at(step.day)?.legs.at(step.leg);
    const duration = leg?.long ? FLIGHT_PLAY_MS : LEG_PLAY_MS;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      apply(from + (to - from) * k);
      player.frame = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    apply(from);
    player.frame = requestAnimationFrame(tick);
  }, [journey, motion, scroll]);
  useEffect(() => () => cancelAnimationFrame(playRef.current.frame), []);
  // Where a snapped step's top sits: below the sticky map (phones) and the story header.
  const snapLine = useCallback(() => {
    const map = mapRef.current?.getBoundingClientRect();
    const mapBottom = map && map.width > window.innerWidth * 0.8 ? Math.max(0, map.bottom) : 0;
    return mapBottom + (headRef.current?.offsetHeight ?? 0);
  }, []);
  const { index, register, steps } = useScrollSteps(journey.steps.length, snapLine, onStep);
  // One step per gesture (wheel, swipe, keys), whatever its strength.
  useStepPaging(mainRef, steps, snapLine);
  const position = positionAt(journey, index, 0);
  // At the end the map shows the whole trip, with the group parked at the last stop.
  // Cover and end show the whole trip; in between, the day being travelled.
  const day = position.finished || index === 0 ? journey.trip : journey.days.at(position.day);
  const destino = album.plan.ubicacion_nombre?.split(",")[0]?.trim() || album.plan.titulo;
  const [lightbox, setLightbox] = useState<{ url: string; urls: string[] } | null>(null);
  // Real map first; the SVG map takes over if it cannot load (offline, no WebGL, service down).
  const [mapMode, setMapMode] = useState<"gl" | "svg">("gl");
  const useSvg = useCallback(() => setMapMode("svg"), []);
  const mapTopPadding = isGuest ? 120 : 84;

  return (
    <main ref={mainRef} className={`${styles.album} min-h-dvh bg-app text-app lg:grid lg:grid-cols-[460px_1fr]`}>
      {/* Map: sticky on top on phones, fixed beside the story on desktop. */}
      <div
        ref={mapRef}
        className="sticky top-0 z-10 h-[min(48dvh,420px)] w-full overflow-hidden lg:order-2 lg:h-dvh"
      >
        <MapPanel mode={mapMode} day={day} base={position} motion={motion} miembros={album.miembros} currentUserId={currentUserId} topPadding={mapTopPadding} onFail={useSvg} />
        {/* Cover: the city stamp on the map until the trip starts. */}
        {!position.started && position.day === 0 && (
          // Bottom-left on phones: the top of the small map is busy with the controls and the route.
          <div className={`pointer-events-none absolute bottom-4 left-4 lg:hidden ${styles.rise}`} style={delay(700)}>
            <Stamp top={destino.toLocaleUpperCase("es-ES")} bottom={stampDate(album.plan.inicio_at)} size={74} />
          </div>
        )}
        {/* New day: night falls over the map, the chapter passes, dawn rises. */}
        {!position.finished && position.day > 0 && (
          <DayCurtain key={`curtain-${position.day}`} day={journey.days.at(position.day)} />
        )}
        <div className={`pointer-events-none absolute inset-x-3 flex items-center justify-between ${isGuest ? "top-[calc(env(safe-area-inset-top)+56px)]" : "top-[calc(env(safe-area-inset-top)+12px)]"}`}>
          <Link
            href={planHref(planId)}
            aria-label="Volver al plan"
            className="pointer-events-auto flex size-11 items-center justify-center rounded-full border border-[var(--al-line)] bg-[var(--al-glass)] text-[var(--al-text)] backdrop-blur-sm lg:hidden"
          >
            <ChevronLeft className="size-[18px]" aria-hidden />
          </Link>
          <MapPill destino={destino} journey={journey} base={position} motion={motion} />
          <div className="pointer-events-auto flex items-center gap-2.5">
            <LiveDashboard day={day} base={position} motion={motion} currency={journey.model.stats.moneda} className="hidden lg:inline-flex" />
            <ShareButton title={album.plan.titulo} planId={planId} />
          </div>
        </div>
        <LiveDashboard day={day} base={position} motion={motion} currency={journey.model.stats.moneda} className="absolute bottom-5 left-3 inline-flex lg:hidden" />
      </div>

      {/* Story: the scroll drives the journey. */}
      <div className="relative z-0 lg:order-1 lg:border-r lg:border-[var(--al-line)]">
        <div ref={headRef} className="sticky top-[min(48dvh,420px)] z-[5] bg-app px-5 pb-3 pt-4 lg:top-0 lg:px-9 lg:pt-6">
          <div className="mb-4 hidden items-center justify-between lg:flex">
            <Link href={planHref(planId)} className="flex items-center gap-2 text-[14px] text-muted hover:text-app">
              <ChevronLeft className="size-4" aria-hidden /> Volver al plan
            </Link>
            <span className="text-[14px] font-semibold text-[var(--primary)]">Frimee</span>
          </div>
          <DayProgress journey={journey} base={position} motion={motion} />
          <LiveDayHeader journey={journey} base={position} motion={motion} />
        </div>

        <div className={`${styles.steps} px-5 pb-16 lg:px-9`}>
          {journey.steps.map((step, i) => {
            const ref = register(i);
            switch (step.kind) {
              case "cover":
                return <CoverSection key="cover" ref={ref} album={album} model={journey.model} currentUserId={currentUserId} />;
              case "day": {
                const d = journey.days.at(step.day);
                const prevStop = journey.days.at(step.day - 1)?.stops.at(-1);
                return d ? (
                  <DaySection
                    key={`day-${step.day}`}
                    ref={ref}
                    day={d}
                    chapter={step.day + 1}
                    yesterday={step.day > 0 && prevStop ? placeName(prevStop) : null}
                  />
                ) : null;
              }
              case "stop": {
                const s = journey.days.at(step.day)?.stops.at(step.stop);
                const d = journey.days.at(step.day);
                if (s?.arrival) return <ArrivalSection key={`stop-${s.key}`} ref={ref} stop={s} />;
                return s && d ? (
                  <StopSection
                    key={`stop-${s.key}`}
                    ref={ref}
                    stop={s}
                    next={d.legs.at(step.stop) && d.stops.at(step.stop + 1) ? { leg: d.legs.at(step.stop) as JourneyLeg, to: d.stops.at(step.stop + 1) as JourneyStop } : null}
                    active={index === i}
                    miembros={album.miembros}
                    currency={journey.model.stats.moneda}
                    onOpenPhoto={(url, urls) => setLightbox({ url, urls })}
                  />
                ) : null;
              }
              case "leg": {
                const d = journey.days.at(step.day);
                const leg = d?.legs.at(step.leg);
                const here = d?.stops.at(step.leg);
                const next = d?.stops.at(step.leg + 1);
                return leg && here && next ? (
                  <LegSection
                    key={`leg-${step.day}-${step.leg}`}
                    ref={ref}
                    step={i}
                    scroll={scroll}
                    leg={leg}
                    from={here}
                    to={next}
                    miembros={album.miembros}
                    currentUserId={currentUserId}
                  />
                ) : null;
              }
              case "final":
                return <FinalSection key="final" ref={ref} album={album} model={journey.model} planId={planId} />;
            }
          })}
        </div>
      </div>

      {lightbox && (
        <div data-paging-ignore>
          <ImageLightbox url={lightbox.url} imageUrls={lightbox.urls} onClose={() => setLightbox(null)} />
        </div>
      )}
    </main>
  );
}

/** The map (real or SVG) and the dashboard; the moving parts follow `motion`. */
function MapPanel({
  mode, day, base, motion, miembros, currentUserId, topPadding, onFail,
}: {
  mode: "gl" | "svg";
  day: JourneyDay | undefined;
  base: JourneyPosition;
  motion: Motion;
  miembros: AlbumMiembro[];
  currentUserId: string | null;
  topPadding: number;
  onFail: () => void;
}) {
  const dark = useIsDarkTheme();
  return (
    <>
      {mode === "gl" ? (
        <JourneyMapGL key={dark ? "dark" : "light"} dark={dark} day={day} base={base} motion={motion} miembros={miembros} currentUserId={currentUserId} topPadding={topPadding} onFail={onFail} />
      ) : (
        <SvgMap day={day} base={base} motion={motion} miembros={miembros} currentUserId={currentUserId} />
      )}
    </>
  );
}

/** Fallback SVG map: re-renders with the motion value (simple, only used without the real map). */
function SvgMap({ day, base, motion, miembros, currentUserId }: { day: JourneyDay | undefined; base: JourneyPosition; motion: Motion; miembros: AlbumMiembro[]; currentUserId: string | null }) {
  const value = useSyncExternalStore(motion.subscribe, motion.get, motion.get);
  const position = positionFromProgress(base, value);
  return <JourneyMap day={day} position={position} ambient={dashboardAt(day, position)?.ambient ?? null} miembros={miembros} currentUserId={currentUserId} />;
}

/** The dashboard pill: a small component of its own, so only it re-renders while moving. */
function LiveDashboard({ day, base, motion, currency, className }: { day: JourneyDay | undefined; base: JourneyPosition; motion: Motion; currency: string; className?: string }) {
  const value = useSyncExternalStore(motion.subscribe, motion.get, motion.get);
  const data = dashboardAt(day, positionFromProgress(base, value));
  return data ? <Dashboard data={data} currency={currency} className={className} /> : null;
}

/** One bar per day: how much of it is behind us (moves with the group). */
function DayProgress({ journey, base, motion }: { journey: Journey; base: JourneyPosition; motion: Motion }) {
  const value = useSyncExternalStore(motion.subscribe, motion.get, motion.get);
  const position = positionFromProgress(base, value);
  const bars = journey.days.map((d, i) => {
    if (position.finished || i < position.day) return 1;
    if (i > position.day || !position.started) return 0;
    return Math.min(1, (position.stop + position.legT) / Math.max(1, d.stops.length - 1));
  });
  return (
    <div
      className="flex gap-1"
      role="progressbar"
      aria-label="Progreso del viaje"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((bars.reduce((a, b) => a + b, 0) / Math.max(1, bars.length)) * 100)}
    >
      {bars.map((bar, i) => (
        <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--al-line)]">
          <div className="h-full bg-[var(--primary)]" style={{ width: `${bar * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

type SectionRef = (el: HTMLElement | null) => void;
type DelayStyle = CSSProperties & { "--delay": string };
const delay = (ms: number): DelayStyle => ({ "--delay": `${ms}ms` });

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--surface-2)] px-[10px] text-[12px] font-medium text-app">
      {children}
    </span>
  );
}

/** "15–19 nov 2026" (or "30 oct – 2 nov 2026" across months). */
function tripDates(inicio: string, fin: string) {
  const a = new Date(inicio);
  const b = new Date(fin);
  const mes = (d: Date) => d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? `${a.getDate()}–${b.getDate()} ${mes(b)} ${b.getFullYear()}`
    : `${a.getDate()} ${mes(a)} – ${b.getDate()} ${mes(b)} ${b.getFullYear()}`;
}

/** Travellers with you last ("Lucía, Marcos, Ana y tú"), each with their colour. */
function travellers(miembros: AlbumMiembro[], currentUserId: string | null) {
  const others = miembros.filter((m) => m.id !== currentUserId);
  const me = miembros.find((m) => m.id === currentUserId);
  const ordered = me ? [...others, me] : others;
  const names = ordered.map((m) => (m.id === currentUserId ? "tú" : m.nombre.split(" ")[0] ?? m.nombre));
  const lista = names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names.at(-1)}` : names.join("");
  return { ordered, lista };
}

function TravellerDots({ miembros, currentUserId, size = 28 }: { miembros: AlbumMiembro[]; currentUserId: string | null; size?: number }) {
  return (
    <div className="flex items-center">
      {miembros.slice(0, 6).map((m, i) => {
        const label = m.id === currentUserId ? "Tú" : (m.nombre.trim()[0] ?? "?").toUpperCase();
        return (
          <span
            key={m.id}
            className={`flex items-center justify-center overflow-hidden rounded-full border-2 border-[var(--al-base)] font-semibold text-[var(--al-base)] ${i > 0 ? "-ml-2" : ""} ${styles.pop}`}
            style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: TRAVELLER_COLORS.at(i % TRAVELLER_COLORS.length), ...delay(600 + i * 90) }}
          >
            {m.foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- small avatar
              <img src={m.foto} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              label
            )}
          </span>
        );
      })}
    </div>
  );
}

function CoverSection({ ref, album, model, currentUserId }: { ref: SectionRef; album: PlanAlbum; model: AlbumModel; currentUserId: string | null }) {
  const { plan } = album;
  const { stats } = model;
  const destino = plan.ubicacion_nombre?.split(",")[0]?.trim() || plan.titulo;
  const { ordered, lista } = travellers(album.miembros, currentUserId);
  const start = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("capitulo-1")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };
  return (
    <section ref={ref} className="flex min-h-[52dvh] flex-col gap-[14px] pb-10 pt-6 lg:min-h-[calc(100dvh-120px)] lg:pb-12 lg:pt-4">
      <div className="flex items-start justify-between">
        <span className={`text-[11px] tracking-[0.15em] text-[var(--primary)] ${styles.rise}`} style={delay(0)}>ÁLBUM DEL VIAJE</span>
        <div className={`hidden lg:block ${styles.rise}`} style={delay(700)}>
          <Stamp top={destino.toLocaleUpperCase("es-ES")} bottom={stampDate(plan.inicio_at)} size={64} />
        </div>
      </div>
      <h1
        className={`${SERIF} m-0 leading-[0.95] lg:mt-6 ${plan.titulo.length > 28 ? "text-[40px] lg:text-[48px]" : "text-[52px] lg:text-[64px]"} ${styles.rise}`}
        style={delay(120)}
      >
        {plan.titulo}
      </h1>
      <p className={`m-0 text-[14px] text-muted ${styles.rise}`} style={delay(260)}>
        {plan.ubicacion_nombre ? `${plan.ubicacion_nombre} · ` : ""}{tripDates(plan.inicio_at, plan.fin_at)}
      </p>
      <div className="flex items-center gap-[10px]">
        <TravellerDots miembros={ordered} currentUserId={currentUserId} />
        <span className={`text-[13px] text-muted ${styles.rise}`} style={delay(900)}>{lista}</span>
      </div>
      <div className={`flex flex-wrap gap-1.5 ${styles.rise}`} style={delay(1000)}>
        <Chip>{stats.dias} días</Chip>
        <Chip>{stats.sitios} sitios</Chip>
        {stats.km > 0 && <Chip>{formatKm(stats.km)}</Chip>}
        {stats.fotos > 0 && <Chip>{stats.fotos} fotos</Chip>}
      </div>
      <p className={`mt-auto flex items-center justify-center gap-2 pt-8 text-[13px] lg:hidden ${styles.rise}`} style={delay(1200)}>
        <ChevronDown className="size-[18px] text-[var(--primary)]" aria-hidden /> Desliza para empezar el recorrido
      </p>
      <div className={`mt-auto hidden items-center gap-3 pt-8 lg:flex ${styles.rise}`} style={delay(1200)}>
        <button
          type="button"
          onClick={start}
          className="flex h-11 items-center gap-2 rounded-[8px] bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--al-base)] transition-opacity hover:opacity-90"
        >
          <ChevronDown className="size-4" aria-hidden /> Empezar el recorrido
        </button>
        <span className="text-[13px] text-muted">o haz scroll</span>
      </div>
    </section>
  );
}

function DaySection({ ref, day, chapter, yesterday }: { ref: SectionRef; day: JourneyDay; chapter: number; yesterday: string | null }) {
  const first = day.stops.at(0);
  const last = day.stops.at(-1);
  const route = first && last && first !== last ? `${placeName(first)} → ${placeName(last)}` : first ? placeName(first) : "";
  const header = capitalize(fmtDayHeader(day.firstAt));
  const fecha = new Date(day.firstAt);
  const mes = fecha.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").toLocaleUpperCase("es-ES");
  return (
    <section ref={ref} id={`capitulo-${chapter}`} className="flex scroll-mt-[min(48dvh,420px)] flex-col gap-4 border-t border-[var(--al-line)] pb-6 pt-8 lg:scroll-mt-24">
      {yesterday && (
        <p className="m-0 flex items-center gap-2 text-[12px] text-muted">
          <Moon className="size-[14px]" aria-hidden /> Ayer terminó en {yesterday}
        </p>
      )}
      <div className="relative flex flex-col gap-[14px] rounded-[8px] border border-[var(--al-line)] bg-[var(--al-card)] px-5 py-[22px]">
        <div className="absolute right-4 top-4">
          <Stamp top={`DÍA ${day.number}`} bottom={`${fecha.getDate()} ${mes}`} size={58} tilt={8} />
        </div>
        <span className="text-[11px] tracking-[0.15em] text-[var(--primary)]">CAPÍTULO {chapter}</span>
        <h2 className={`${SERIF} m-0 text-[56px] leading-[0.9]`}>Día {day.number}</h2>
        <p className="m-0 text-[15px] text-muted">
          {header}
          {route && ` · ${route}`}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip>{day.stops.length} {day.stops.length === 1 ? "parada" : "paradas"}</Chip>
          {day.km > 0 && <Chip>{formatKm(day.km)}</Chip>}
          {day.fotos > 0 && <Chip><Camera className="size-[13px]" aria-hidden />{day.fotos} {day.fotos === 1 ? "foto" : "fotos"}</Chip>}
        </div>
      </div>
      {yesterday && first && (
        <p className="m-0 flex items-center gap-2 text-[12px] text-muted">
          <MapPin className="size-[14px]" aria-hidden /> Sin trayecto entre días: el grupo aparece en {placeName(first)}
        </p>
      )}
    </section>
  );
}

/** Night over the map on a new day: the chapter card passes and dawn rises (CSS, 1.4 s). */
function DayCurtain({ day }: { day: JourneyDay | undefined }) {
  if (!day) return null;
  return (
    <div className={styles.curtain} aria-hidden>
      <div className={`${styles.curtainCard} text-center text-[var(--al-text)]`}>
        <span className="text-[11px] tracking-[0.2em] text-[var(--primary)]">CAPÍTULO {day.number}</span>
        <p className={`${SERIF} m-0 mt-2 text-[48px] leading-none`}>Día {day.number}</p>
        <p className="m-0 mt-2 text-[14px] text-[var(--al-muted)]">{capitalize(fmtDayHeader(day.firstAt))}</p>
      </div>
    </div>
  );
}

/** Landing end of a flight or ferry: one line, no card (the trip goes on from here). */
function ArrivalSection({ ref, stop }: { ref: SectionRef; stop: JourneyStop }) {
  const ferry = stop.actividad.tipo === "BARCO";
  const Icon = ferry ? Ship : PlaneLanding;
  return (
    <section ref={ref} className="flex gap-[14px] py-4">
      <div className="flex w-4 justify-center pt-[3px]">
        <span className="size-[14px] rounded-full border-[3px] border-[var(--primary)] bg-[var(--al-base)]" aria-hidden />
      </div>
      <p className="m-0 flex flex-1 items-center gap-2 text-[14px] text-app">
        <Icon className="size-4 text-[var(--primary)]" aria-hidden />
        {ferry ? "Llegada en barco a" : "Aterrizaje en"} {stop.place}
        <span className="text-muted">· {fmtTime(stop.time)}</span>
      </p>
    </section>
  );
}

function StopSection({
  ref, stop, next, active, miembros, currency, onOpenPhoto,
}: {
  ref: SectionRef;
  stop: JourneyStop;
  /** The way on from here, for the "Siguiente: …" line. */
  next: { leg: JourneyLeg; to: JourneyStop } | null;
  active: boolean;
  miembros: AlbumMiembro[];
  currency: string;
  onOpenPhoto: (url: string, urls: string[]) => void;
}) {
  const { actividad: a, fotos } = stop;
  const names = new Map(miembros.map((m) => [m.id, m.nombre.split(" ")[0]]));
  const shown = fotos.slice(0, 5);
  const urls = fotos.map((f) => f.url);
  const credits = fotos.map((f) => DEMO_PHOTO_CREDITS[f.url]).filter((c) => c !== undefined);
  const { ref: viewRef, inView } = useInView<HTMLDivElement>(0.2);
  // Arrival text: hour, name and chips rise once, when half the stop is on screen.
  const { ref: arriveRef, inView: arrived } = useInView<HTMLDivElement>(0.5);
  const rise = (ms: number) => (arrived ? { className: styles.rise, style: delay(ms) } : { className: "opacity-0", style: undefined });
  const long = a.titulo.length > 32;

  return (
    <section ref={ref} className="py-6">
      <div ref={viewRef} className="flex gap-[14px]">
        <div className="flex w-4 flex-col items-center pt-[3px]">
          <span
            className={`size-[14px] rounded-full border-[3px] bg-[var(--al-base)] transition-colors duration-300 ${active ? "border-[var(--primary)]" : "border-[var(--primary)]/70"}`}
            aria-hidden
          />
        </div>
        <div ref={arriveRef} className="flex min-w-0 flex-1 flex-col gap-2">
          <span className={`text-[12px] font-medium tabular-nums text-[var(--primary)] ${rise(350).className}`} style={rise(350).style}>
            {a.all_day ? "Todo el día" : fmtTime(a.inicio_at)} · Llegada
          </span>
          <h3 className={`${SERIF} m-0 line-clamp-3 leading-[1.05] ${long ? "text-[26px] lg:text-[36px]" : "text-[34px] lg:text-[48px]"} ${rise(420).className}`} style={rise(420).style}>{a.titulo}</h3>
          <div className={`flex flex-wrap gap-1.5 ${rise(500).className}`} style={rise(500).style}>
            {fotos.length > 0 && (
              <Chip><Camera className="size-[13px]" aria-hidden />{fotos.length} {fotos.length === 1 ? "foto" : "fotos"}</Chip>
            )}
            <Chip>{stop.gasto > 0 ? formatMoney(stop.gasto, currency) : "Sin gastos apuntados"}</Chip>
          </div>

          {shown.length > 0 && (
            <div className="mt-2 flex gap-[10px] overflow-x-auto pb-1 [scrollbar-width:none]">
              {shown.map((foto, i) => (
                <figure
                  key={foto.id}
                  className="m-0 flex w-[112px] shrink-0 flex-col gap-1.5 lg:w-[124px] transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none"
                  style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(10px)", transitionDelay: `${i * 90}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => onOpenPhoto(foto.url, urls)}
                    className="relative h-[84px] overflow-hidden rounded-[8px] bg-[var(--surface-2)] lg:h-[92px]"
                    aria-label={`Ver foto${names.get(foto.user_id) ? ` de ${names.get(foto.user_id)}` : ""}`}
                  >
                    <Image src={foto.url} alt="" fill className="object-cover" sizes="112px" unoptimized loading="lazy" referrerPolicy="no-referrer" />
                    {i === shown.length - 1 && fotos.length > shown.length && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[15px] font-semibold text-white">
                        +{fotos.length - shown.length}
                      </span>
                    )}
                  </button>
                  {names.get(foto.user_id) && (
                    <figcaption className="text-[12px] leading-[1.35] text-muted">Foto de {names.get(foto.user_id)}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
          {credits.length > 0 && (
            <p className="text-[11px] leading-relaxed text-muted">
              Fotos de ejemplo de Wikimedia Commons:{" "}
              {credits.map((c, i) => (
                <span key={c.fuente}>
                  {i > 0 && " · "}
                  <a href={c.fuente} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.autor}</a>
                  {" "}({c.licenciaUrl ? <a href={c.licenciaUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.licencia}</a> : c.licencia})
                </span>
              ))}
            </p>
          )}
          {next && <NextLine leg={next.leg} to={next.to} />}
        </div>
      </div>
    </section>
  );
}

/** "Siguiente: a pie · 24 min · 1,7 km hasta Mosteiro dos Jerónimos" under a stop. */
function NextLine({ leg, to }: { leg: JourneyLeg; to: JourneyStop }) {
  const info = transportInfo(leg.transporte);
  const Icon = info?.Icon;
  const distance = leg.long ? `≈ ${leg.longKm.toLocaleString("es-ES")} km` : formatCompactRouteDistance(leg.distancia);
  const parts = [travelPhrase(leg.transporte), formatCompactRouteDuration(leg.duracion), distance].filter(Boolean).join(" · ");
  return (
    <div className="mt-3 flex min-h-10 gap-3 border-l-2 border-dashed border-[var(--al-pending)] pl-3">
      <p className="m-0 flex items-center gap-2 text-[12px] text-muted">
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
        <span>Siguiente: {parts ? `${parts} ` : ""}hasta {to.place}</span>
      </p>
    </div>
  );
}

const AMBIENT_LABEL: Record<Ambient, string> = { manana: "Mañana", tarde: "Tarde", atardecer: "Atardecer", noche: "Noche" };

/** Story header while travelling: "Día 2 · Lun 16 nov" and the part of the day, live. */
function LiveDayHeader({ journey, base, motion }: { journey: Journey; base: JourneyPosition; motion: Motion }) {
  const value = useSyncExternalStore(motion.subscribe, motion.get, motion.get);
  if (!base.started || base.finished) return null;
  const day = journey.days.at(base.day);
  if (!day) return null;
  const ambient = dashboardAt(day, positionFromProgress(base, value))?.ambient;
  return (
    <div className="mt-3 flex items-baseline justify-between gap-3">
      <p className={`${SERIF} m-0 truncate text-[30px] leading-none lg:text-[40px]`}>
        Día {day.number} <span className="text-muted">· {capitalize(fmtDayHeader(day.firstAt))}</span>
      </p>
      {ambient && <span className="shrink-0 text-[12px] text-muted">{AMBIENT_LABEL[ambient]}</span>}
    </div>
  );
}

/** Pill on the map: destination and where we are (phones: "Día 2 de 3"; desktop: "Día 2 · Mañana"). */
function MapPill({ destino, journey, base, motion }: { destino: string; journey: Journey; base: JourneyPosition; motion: Motion }) {
  const value = useSyncExternalStore(motion.subscribe, motion.get, motion.get);
  const day = journey.days.at(base.day);
  const ambient = base.started && !base.finished ? dashboardAt(day, positionFromProgress(base, value))?.ambient : undefined;
  return (
    <div className="pointer-events-auto mx-auto flex h-[34px] items-center gap-2 rounded-full border border-[var(--al-line)] bg-[var(--al-glass)] px-[14px] text-[12px] font-medium text-[var(--al-text)] backdrop-blur-sm lg:mx-0">
      <span className={`${SERIF} text-[16px]`}>{destino}</span>
      {base.finished ? (
        <span className="text-[var(--al-muted)]">Fin del recorrido</span>
      ) : base.started && day ? (
        <>
          <span className="text-[var(--al-muted)] lg:hidden">Día {base.day + 1} de {journey.days.length}</span>
          <span className="hidden text-[var(--al-muted)] lg:inline">
            Día {day.number}{ambient ? ` · ${AMBIENT_LABEL[ambient]}` : ""}
          </span>
        </>
      ) : null}
    </div>
  );
}

/**
 * Shares the album link. In the app: the native share sheet (@capacitor/share), with the public
 * web address (the app's own address is capacitor:// or localhost, useless to anyone else).
 * On the web: the browser's share sheet on phones, or copy the link on desktop.
 */
async function shareAlbum(title: string, planId: string): Promise<"shared" | "copied" | "none"> {
  const path = `/plans/${planId}/album`;
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text: `${title} · álbum del viaje en Frimee`, url: `${getWebAppUrl()}${path}`, dialogTitle: "Compartir álbum" });
      return "shared";
    }
    const url = `${window.location.origin}${path}`;
    if (typeof navigator.share === "function") {
      await navigator.share({ title, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "none"; // the person closed the share sheet
  }
}

function ShareButton({ title, planId }: { title: string; planId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => void shareAlbum(title, planId).then((r) => setCopied(r === "copied"))}
      aria-label={copied ? "Enlace copiado" : "Compartir álbum"}
      title={copied ? "Enlace copiado" : "Compartir álbum"}
      className="flex size-11 items-center justify-center rounded-full border border-[var(--al-line)] bg-[var(--al-glass)] text-[var(--al-text)] backdrop-blur-sm lg:size-9"
    >
      {copied ? <Check className="size-[17px] text-[var(--primary)]" aria-hidden /> : <Share2 className="size-[17px]" aria-hidden />}
    </button>
  );
}

/** "24 min" / "1 h 46 min" → minutes (0 when unknown). */
function parseMinutes(value: string | null | undefined) {
  if (!value) return 0;
  const hours = Number(/(\d+)\s*h/.exec(value)?.[1] ?? 0);
  const minutes = Number(/(\d+)\s*min/.exec(value)?.[1] ?? 0);
  return hours * 60 + minutes;
}

const TRAVEL_PHRASES: Record<string, string> = {
  APIE: "a pie",
  COCHE: "en coche",
  TAXI: "en taxi",
  BUS: "en bus",
  METRO: "en metro",
  TREN: "en tren",
  VUELO: "en avión",
  BARCO: "en barco",
};

/** "a pie", "en metro"…: how the sentence of the travel card ends. */
function travelPhrase(transporte: string | null) {
  return transporte ? TRAVEL_PHRASES[transporte] ?? "" : "";
}

function LegSection({
  ref, step, scroll, leg, from, to, miembros, currentUserId,
}: {
  ref: SectionRef;
  step: number;
  scroll: ScrollStore;
  leg: JourneyLeg;
  from: JourneyStop;
  to: JourneyStop;
  miembros: AlbumMiembro[];
  currentUserId: string | null;
}) {
  // Only the active leg changes its snapshot while scrolling, so only it re-renders.
  const raw = useSyncExternalStore(
    scroll.subscribe,
    () => {
      const { index, t } = scroll.get();
      return index > step ? 1 : index === step ? t : 0;
    },
    () => 0,
  );
  // Same pace as the group on the map (eased), so the card and the map agree.
  const progress = travelEase(raw);
  const transporte = transportInfo(leg.transporte);
  const Icon = transporte?.Icon;
  // Flights and ferries: straight-line km, shown apart from the km travelled in town.
  const distance = leg.long ? `≈ ${leg.longKm.toLocaleString("es-ES")} km` : formatCompactRouteDistance(leg.distancia);
  const facts = [transporte?.label, formatCompactRouteDuration(leg.duracion), distance].filter(Boolean).join(" · ");

  // Live "what's left": from the leg's duration (flights: from their times) and its km.
  const totalMin = parseMinutes(leg.duracion) || Math.max(0, Math.round((Date.parse(to.time) - Date.parse(from.leaves)) / 60000));
  const leftMin = Math.max(0, Math.round(totalMin * (1 - progress)));
  const leftKm = (leg.long ? leg.longKm : leg.km) * (1 - progress);
  const left =
    progress >= 0.98 ? "Llegando…"
      : progress <= 0 ? null
        : [leftMin > 0 ? `Faltan unos ${leftMin} min` : null, leftKm > 0.05 ? formatKm(leftKm) : null].filter(Boolean).join(" · ");
  const phrase = travelPhrase(leg.transporte);
  const ordered = [...miembros.filter((m) => m.id !== currentUserId), ...miembros.filter((m) => m.id === currentUserId)];

  return (
    // A whole screen: while the leg plays, the next stop stays out of view.
    <section ref={ref} className={`${styles.legStep} flex gap-[14px]`} aria-label={`Hacia ${to.place}${facts ? `: ${facts}` : ""}`}>
      <div className="flex w-4 justify-center">
        <div className="relative w-[3px] rounded-full bg-[var(--al-line)]">
          <div className="absolute inset-x-0 top-0 rounded-full bg-[var(--primary)]" style={{ height: `${progress * 100}%` }} />
        </div>
      </div>
      {/* Travel card: stays in view for the whole leg and counts down to the next stop. It shows
          up once the group sets off; before that the stop's "Siguiente: …" line says it already. */}
      <div
        className="sticky top-[calc(min(48dvh,420px)+var(--al-head,96px)+12px)] flex h-fit flex-1 flex-col gap-3 py-3 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none lg:top-[calc(var(--al-head,140px)+12px)]"
        style={{ opacity: raw > 0 ? 1 : 0, transform: raw > 0 ? "none" : "translateY(8px)" }}
        aria-hidden={raw > 0 ? undefined : true}
      >
        <div className="flex items-center gap-2 text-[12px] text-app">
          {Icon ? <Icon className="size-4 text-[var(--primary)]" aria-hidden /> : null}
          <span>{facts || "Sin transporte apuntado"}</span>
        </div>
        <div>
          <div className="h-1 overflow-hidden rounded-full bg-[var(--al-line)]">
            <div className="h-full bg-[var(--primary)]" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted">
            <span>Salida {fmtTime(from.leaves)}</span>
            <span>Llegada {fmtTime(to.time)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[8px] bg-[var(--al-card)] px-[14px] py-3">
          <TravellerDots miembros={ordered} currentUserId={currentUserId} size={22} />
          <p className="m-0 text-[13px] leading-[1.45] text-muted">
            De {from.place} a {to.place}{phrase ? ` ${phrase}` : ""}.
            {left && <span className="text-app"> {left}{left.endsWith("…") ? "" : "."}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}

function FinalSection({ ref, album, model, planId }: { ref: SectionRef; album: PlanAlbum; model: AlbumModel; planId: string }) {
  const { stats } = model;
  const { ref: viewRef, inView } = useInView<HTMLDivElement>(0.3);
  const [copied, setCopied] = useState(false);
  const destino = album.plan.ubicacion_nombre?.split(",")[0]?.trim() || album.plan.titulo;
  const nombres = album.miembros.map((m) => m.nombre.split(" ")[0]);
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : nombres.join("");
  const whole = (n: number) => String(Math.round(n));
  const money = (n: number) => formatMoney(n, stats.moneda);
  const roundMoney = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: stats.moneda, maximumFractionDigits: 0 }).format(n);
  const cells: { label: string; value: number | string; format?: (n: number) => string }[] = [
    { label: "DÍAS", value: stats.dias, format: whole },
    { label: "SITIOS", value: stats.sitios, format: whole },
    ...(stats.km > 0 ? [{ label: "RECORRIDOS", value: stats.km, format: formatKm }] : []),
    ...(stats.kmAPie > 0 ? [{ label: "A PIE", value: stats.kmAPie, format: formatKm }] : []),
    ...(stats.fotos > 0 ? [{ label: "FOTOS", value: stats.fotos, format: whole }] : []),
    ...(stats.categoriaTop ? [{ label: "MÁS GASTO", value: `${stats.categoriaTop.nombre} · ${roundMoney(stats.categoriaTop.total)}` }] : []),
  ];
  const gastosHref = Capacitor.isNativePlatform() ? `/plans/static?id=${planId}&tab=gastos` : `/plans/${planId}?tab=gastos`;

  const share = async () => setCopied((await shareAlbum(album.plan.titulo, planId)) === "copied");

  return (
    <section ref={ref} className="border-t border-[var(--al-line)] pt-10">
      <div ref={viewRef} className={inView ? styles.rise : "opacity-0"}>
        <div className="overflow-hidden rounded-[8px] border border-[var(--al-line)] bg-[var(--al-card)]">
          <div className="flex flex-col gap-[14px] px-4 py-[14px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[11px] tracking-[0.13em] text-[var(--primary)]">
                <Plane className="size-[14px]" aria-hidden /> TARJETA DE EMBARQUE
              </span>
              <span className="text-[11px] text-muted">{formatDateRange(album.plan.inicio_at, album.plan.fin_at)}</span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className={`${SERIF} m-0 text-[30px] leading-none`}>{album.plan.titulo}</h2>
                <p className="m-0 mt-1.5 text-[12px] text-muted">{lista}</p>
              </div>
              <Stamp top={destino.toLocaleUpperCase("es-ES")} bottom={stampDate(album.plan.fin_at)} size={56} tilt={-8} />
            </div>
            <dl className="m-0 grid grid-cols-3 gap-x-[10px] gap-y-3">
              {cells.map((cell) => (
                <div key={cell.label} className="flex min-w-0 flex-col-reverse gap-[3px]">
                  <dd className="m-0 truncate text-[15px] font-semibold tabular-nums text-app">
                    {typeof cell.value === "number" && cell.format ? (
                      <CountUp value={cell.value} format={cell.format} start={inView} />
                    ) : (
                      cell.value
                    )}
                  </dd>
                  <dt className="text-[10px] tracking-[0.12em] text-muted">{cell.label}</dt>
                </div>
              ))}
            </dl>
          </div>
          {/* Tear line of the ticket. */}
          <div className="relative h-0 border-t border-dashed border-[var(--al-line)]" aria-hidden>
            <span className="absolute -left-2 -top-2 size-4 rounded-full bg-app" />
            <span className="absolute -right-2 -top-2 size-4 rounded-full bg-app" />
          </div>
          {stats.gastoTotal > 0 && (
            <div className="flex items-end justify-between px-4 py-[14px]">
              <div>
                <span className="text-[10px] tracking-[0.12em] text-muted">TOTAL DEL VIAJE</span>
                <p className="m-0 mt-1 text-[24px] font-semibold tabular-nums">
                  <CountUp value={stats.gastoTotal} format={money} start={inView} />
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] tracking-[0.12em] text-muted">POR PERSONA</span>
                <p className="m-0 mt-1 text-[17px] font-semibold tabular-nums">
                  <CountUp value={stats.gastoPorPersona} format={money} start={inView} />
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void share()}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[8px] bg-[var(--primary)] text-[14px] font-semibold text-[var(--al-base)] transition-opacity hover:opacity-90"
          >
            <Share2 className="size-4" aria-hidden /> {copied ? "Enlace copiado" : "Compartir álbum"}
          </button>
          <Link
            href={gastosHref}
            className="flex h-11 flex-1 items-center justify-center rounded-[8px] border border-[var(--al-line)] text-[14px] font-semibold text-app transition-colors hover:bg-[var(--surface-2)]"
          >
            Ver gastos
          </Link>
        </div>

        <p className="mt-8 text-[11px] text-muted">
          Mapa:{" "}
          <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenFreeMap</a>
          {" · "}
          <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">© OpenMapTiles</a>
          {" · Datos "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">
            © colaboradores de OpenStreetMap
          </a>
        </p>
      </div>
      {model.fotosSueltas.length > 0 && (
        <div className="mt-10">
          <h3 className={`${SERIF} m-0 text-[28px]`}>Más fotos del viaje</h3>
          <PhotoCollage fotos={model.fotosSueltas} miembros={album.miembros} />
        </div>
      )}
    </section>
  );
}
