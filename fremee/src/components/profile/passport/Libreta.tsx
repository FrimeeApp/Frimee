"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FOCUS, LABEL, SERIF } from "@/components/plans/home/pieces";
import {
  buildPages,
  computeStats,
  countryName,
  dateLabel,
  groupTrips,
  machineLines,
  monthYearLabel,
  type PassportPage,
  type PassportStats,
  type Sello,
  type Trip,
} from "@/lib/passport";
import type { Placed } from "@/lib/passportLayout";
import { freeBands, layoutPage } from "@/lib/passportLayout";
import { marcarSellosVistos } from "@/services/api/endpoints/pasaporte.endpoint";
import { playCloseBook, playOpen } from "@/lib/passportOpen";
import { PassportCover } from "./PassportCover";
import PageFlags, { type FlagItem } from "./PageFlags";
import { CountryStamp, HITO_NAME, HitoStamp, PlanStamp } from "./stamps";

/** La libreta (tableros «Pasaporte · la libreta»): página de datos + una página por cada 3 viajes de un año. */

/** Medidas lógicas de una página. Móvil: 358 × 590. Escritorio (doble página): 452 × 620, casi la proporción de la tapa. */
type Dims = { w: number; h: number };
const MOBILE: Dims = { w: 358, h: 590 };
const WIDE: Dims = { w: 452, h: 620 };
const DimsContext = createContext<Dims>(MOBILE);
/** Pulsar un sello abre su hoja (solo en tu propio pasaporte). */
/** Los sellos nuevos se estampan cuando acaba la apertura del libro, no mientras la tapa aún vuela. */
const StampAnimContext = createContext(true);
const StampOpenContext = createContext<((s: Sello, el: HTMLElement) => void) | null>(null);
const useDims = () => useContext(DimsContext);
const SPINE = 6;
type Side = "left" | "right" | "single";
const SIDE_RADIUS: Record<Side, string> = { left: "rounded-l-[8px]", right: "rounded-r-[8px]", single: "rounded-[8px]" };
const EASE_IN = "cubic-bezier(0.3, 0, 1, 1)";
const EASE_OUT = "cubic-bezier(0.2, 0, 0, 1)";
const TURN_MS = 240;
const FADE_MS = 160;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** El objeto: papel claro también en oscuro (como un documento real), con tinta propia. Nuevo en el sistema. */
export const BOOK = {
  cover: "#0e2f2a",
  foil: "#3cddc2",
  paper: "#F1F3EC",
  paperBand: "#FAFBF7",
  text: "#1F2A28", // 13:1 sobre el papel
  label: "#4D5E59", // 6,2:1 sobre el papel
  guil1: "#C6D7CE",
  guil2: "#E6CDD3",
  micro: "#9DB2A8",
  slot: "#AEBBB4",
  ribbon: "#1c6a5d",
} as const;
const PAD_WIDE = 8;
const PAD_SINGLE = 6;
/** Dentro del papel, los tokens del sistema vuelven a sus valores claros para que textos, sellos y chips se lean. */
export const PAPER_VARS = {
  "--surface": BOOK.paper,
  "--surface-2": "#E6E9E1",
  "--text-primary": BOOK.text,
  "--text-secondary": BOOK.label,
  "--border": "#D6DBD2",
  "--border-strong": BOOK.slot,
  "--contrast": "#FFFFFF",
  "--passport-ink": "#2a2a31",
  "--passport-ink-new": "#227a6c",
  // Tintas de sello: azul, burdeos, verde y violeta, todas por encima de 6:1 sobre el papel.
  "--passport-ink-1": "#2B4C9B",
  "--passport-ink-2": "#9B2B3A",
  "--passport-ink-3": "#1E5E52",
  "--passport-ink-4": "#5B3A8C",
} as React.CSSProperties;
/** Grosor de hojas: líneas de 1 px en el canto exterior. */
const EDGE: Record<Side, string> = {
  left: "-1px 0 0 #d6dbd2, -2px 0 0 #e9ece4, -3px 0 0 #d2d7ce, -4px 0 0 #e6e9e1",
  right: "1px 0 0 #d6dbd2, 2px 0 0 #e9ece4, 3px 0 0 #d2d7ce, 4px 0 0 #e6e9e1",
  single: "2px 0 0 #d6dbd2, 3px 0 0 #e9ece4, 4px 0 0 #d2d7ce",
};

/** Apertura desde el perfil: la tapa vuela hasta la página derecha, se pliega sobre el lomo y descubre el libro. */
export type LibretaIntro = {
  fromCover: HTMLElement;
  profile?: HTMLElement | null;
  /** Fondo del lector: solo el fondo, para que el contenido no se funda con él. */
  deskRef: RefObject<HTMLElement | null>;
  /** Título y demás elementos del lector que entran al final. */
  chromeRefs?: RefObject<HTMLElement | null>[];
  onDone?: () => void;
};

/** Cierre hacia el perfil: la tapa del perfil adonde vuela, y cómo saltarse la animación. */
export type LibretaOutro = {
  fromCover: HTMLElement;
  profile?: HTMLElement | null;
  deskRef: RefObject<HTMLElement | null>;
  chromeRefs?: RefObject<HTMLElement | null>[];
  /** La libreta entrega aquí su función para saltar al final. */
  registerCancel: (cancel: () => void) => void;
  onDone: () => void;
};

export default function Libreta({
  nombre,
  ciudad = null,
  emptyPage = null,
  sellos,
  intro,
  jumpTo,
  startPage,
  outro = null,
  onOpenStamp,
}: {
  nombre: string;
  /** Ciudad base, si la hay y quien mira puede verla. */
  ciudad?: string | null;
  /** Pasaporte sin sellos: la primera hoja en blanco explica por qué y ofrece crear un plan o ver el ejemplo. */
  emptyPage?: EmptyPageActions | null;
  sellos: Sello[];
  intro?: LibretaIntro;
  jumpTo?: { page: number; nonce: number } | null;
  /** Página (desde 1) por la que se abre; sin ella, la tapa en escritorio y la última página en móvil. */
  startPage?: number;
  /** Cierre con la libreta: la pide el lector al volver al perfil. */
  outro?: LibretaOutro | null;
  onOpenStamp?: (s: Sello, el: HTMLElement) => void;
}) {
  const trips = useMemo(() => groupTrips(sellos), [sellos]);
  const pages = useMemo(() => buildPages(trips), [trips]);
  const stats = useMemo(() => computeStats(sellos), [sellos]);
  const years = useMemo(() => [...new Set(pages.flatMap((p) => (p.kind === "year" ? [p.year] : [])))], [pages]);

  const boxRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [scale, setScale] = useState(1);
  const [measured, setMeasured] = useState(false);
  // En móvil el ancho se mantiene y la página se acorta hasta caber entera (sin scroll) entre las marcas y las flechas.
  const [mobileH, setMobileH] = useState(MOBILE.h);
  const dims = useMemo<Dims>(() => (wide ? WIDE : { w: MOBILE.w, h: mobileH }), [wide, mobileH]);
  const W = dims.w;
  const H = dims.h;
  const SPREAD_W = W * 2 + SPINE;
  const PAD = wide ? PAD_WIDE : PAD_SINGLE;
  // La tapa voladora mide exactamente la mitad derecha con su marco (en móvil, la libreta entera).
  const coverW = wide ? W + PAD : W + PAD * 2;
  const coverH = H + PAD * 2;
  // Antes de pintar: la apertura necesita saber ya si es doble página y a qué escala.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const isWide = window.matchMedia("(min-width: 768px)").matches;
      setWide(isWide);
      const d = isWide ? WIDE : MOBILE;
      const pd = isWide ? PAD_WIDE : PAD_SINGLE;
      const byWidth = el.clientWidth / (isWide ? d.w * 2 + SPINE + pd * 2 : d.w + pd * 2);
      const byHeight = isWide ? (window.innerHeight - 290) / (d.h + pd * 2) : Infinity;
      const sc = Math.min(isWide ? 1 : 1.25, Math.max(0.5, Math.min(byWidth, byHeight)));
      setScale(sc);
      if (!isWide) {
        // Hueco real: desde donde empieza la libreta hasta el final de la pantalla, menos la cinta, las flechas y los márgenes.
        const wrapper = el.parentElement?.parentElement;
        const padBottom = wrapper ? parseFloat(getComputedStyle(wrapper).paddingBottom) || 0 : 0;
        const below = 32 + (controlsRef.current?.offsetHeight ?? 60) + padBottom;
        const room = window.innerHeight - el.getBoundingClientRect().top - below;
        setMobileH(Math.max(430, Math.min(MOBILE.h, Math.floor(room / sc) - PAD_SINGLE * 2)));
      }
      setMeasured(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const rightRef = useRef<HTMLDivElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const ribbonRef = useRef<HTMLSpanElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const flagsRef = useRef<HTMLElement>(null);
  const coverMoveRef = useRef<HTMLDivElement>(null);
  const coverFoldRef = useRef<HTMLDivElement>(null);
  const coverShadeRef = useRef<HTMLSpanElement>(null);
  const introRan = useRef(false);
  const [introDone, setIntroDone] = useState(!intro);
  useLayoutEffect(() => {
    if (!intro || !measured || introRan.current) return;
    const cm = coverMoveRef.current;
    const cf = coverFoldRef.current;
    const desk = intro.deskRef.current;
    const right = rightRef.current;
    if (!cm || !cf || !desk || !right) {
      queueMicrotask(() => setIntroDone(true));
      return;
    }
    introRan.current = true;
    const chrome = ([controlsRef.current, flagsRef.current, ...(intro.chromeRefs ?? []).map((r) => r.current)] as (HTMLElement | null)[]).filter((e): e is HTMLElement => Boolean(e));
    void playOpen({
      fromCover: intro.fromCover,
      coverMove: cm,
      coverFold: cf,
      profile: intro.profile,
      desk,
      coverShade: coverShadeRef.current,
      right: ([right, spineRef.current] as (HTMLElement | null)[]).filter((e): e is HTMLElement => Boolean(e)),
      left: wide ? leftRef.current : null,
      ribbon: ribbonRef.current,
      chrome,
    }).then(() => {
      setIntroDone(true);
      intro.onDone?.();
    });
  }, [intro, measured, wide]);

  // Cierre con la libreta: la tapa vuelve a montarse sobre la página derecha, se despliega y vuela de vuelta al perfil.
  const outroRan = useRef(false);
  useLayoutEffect(() => {
    if (!outro || outroRan.current) return;
    const cm = coverMoveRef.current;
    const cf = coverFoldRef.current;
    const desk = outro.deskRef.current;
    const right = rightRef.current;
    if (!cm || !cf || !desk || !right) {
      outro.onDone();
      return;
    }
    outroRan.current = true;
    const chrome = ([controlsRef.current, flagsRef.current, ...(outro.chromeRefs ?? []).map((r) => r.current)] as (HTMLElement | null)[]).filter((e): e is HTMLElement => Boolean(e));
    const { done, cancel } = playCloseBook({
      fromCover: outro.fromCover,
      coverMove: cm,
      coverFold: cf,
      coverShade: coverShadeRef.current,
      profile: outro.profile,
      desk,
      right: ([right, spineRef.current] as (HTMLElement | null)[]).filter((e): e is HTMLElement => Boolean(e)),
      left: wide ? leftRef.current : null,
      ribbon: ribbonRef.current,
      chrome,
    });
    outro.registerCancel(cancel);
    void done.then(() => outro.onDone());
  }, [outro, wide]);

    // En escritorio se abre por la tapa (guarda y página de datos); en móvil, por la última página sellada.
  const [rawIndex, setIndex] = useState(() => (startPage ? startPage - 1 : typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches ? 0 : pages.length - 1));
  // En ancho la página izquierda siempre es par (índice impar); al pasar de móvil a ancho se recoloca.
  const clamped = Math.min(rawIndex, pages.length - 1);
  const index = wide ? (clamped === 0 ? 0 : 2 * Math.ceil(clamped / 2) - 1) : clamped;
  const [prev, setPrev] = useState<{ index: number; back: boolean; reduced: boolean } | null>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  // «Nuevo» solo dura mientras se estampa: al abrir la página se guardan como vistos y vuelven a la tinta normal.
  const [seen, setSeen] = useState<ReadonlySet<number>>(new Set());
  const marked = useRef(new Set<number>());
  const isNew = useCallback((s: Pick<Sello, "id" | "nuevo">) => s.nuevo && !seen.has(s.id), [seen]);

  // En ancho se ven dos páginas: la de datos (1) a la derecha de la tapa y luego parejas par | impar.
  const unit = useCallback((i: number) => (wide ? Math.ceil(i / 2) : i), [wide]);
  const units = unit(pages.length - 1) + 1;
  const anchor = (u: number) => (wide ? (u === 0 ? 0 : 2 * u - 1) : u);

  const goToUnit = useCallback(
    (u: number) => {
      if (u < 0 || u >= units || u === unit(index) || busy.current) return;
      setPrev({ index, back: u < unit(index), reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
      setIndex(anchor(u));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, units, wide],
  );
  const goToPage = (i: number) => goToUnit(unit(i));
  // Saltos pedidos desde el índice (número de página, empezando en 1).
  const lastJump = useRef<number | null>(null);
  useEffect(() => {
    if (!jumpTo || lastJump.current === jumpTo.nonce) return;
    lastJump.current = jumpTo.nonce;
    goToUnit(unit(jumpTo.page - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo]);

  const visible = wide ? (index === 0 ? [0] : [index, index + 1]) : [index];
  const visibleKey = visible.join(",");
  useEffect(() => {
    if (!introDone) return;
    const ids = visibleKey
      .split(",")
      .map((i) => pages[Number(i)])
      .flatMap((p) => (p?.kind === "year" ? p.trips.flatMap((t) => [t.plan, ...t.paises, ...t.hitos]) : []))
      .filter((s): s is Sello => Boolean(s?.nuevo) && !marked.current.has(s!.id))
      .map((s) => s.id);
    if (ids.length === 0) return;
    ids.forEach((id) => marked.current.add(id));
    marcarSellosVistos(ids).catch((err) => console.error("[pasaporte] No se marcaron los sellos como vistos:", (err as { message?: string } | null)?.message ?? err));
    // Sin limpiar el temporizador: aunque pases de página, esos sellos ya están vistos.
    setTimeout(() => setSeen((prev) => new Set([...prev, ...ids])), 2400);
  }, [visibleKey, pages, introDone]);

  const refs = {
    leftTop: useRef<HTMLDivElement>(null),
    rightTop: useRef<HTMLDivElement>(null),
    single: useRef<HTMLDivElement>(null),
  };

  useLayoutEffect(() => {
    if (!prev) return;
    const reduced = prev.reduced;
    busy.current = true;
    const done: Animation[] = [];
    const finish = () => {
      busy.current = false;
      setPrev(null);
    };
    const play = (el: HTMLDivElement | null, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
      if (!el) return;
      const a = el.animate(frames, { fill: "both", ...opts });
      done.push(a);
      return a;
    };
    let last: Animation | undefined;
    if (reduced) {
      // Solo fundido: lo que entra aparece, sin escala ni giro.
      last = play(fadeRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "linear" });
    } else if (!wide) {
      last = prev.back
        ? play(refs.single.current, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: TURN_MS, easing: EASE_OUT })
        : play(refs.single.current, [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: TURN_MS, easing: EASE_IN });
    } else if (!prev.back) {
      // Hacia delante: la derecha vieja se pliega hacia el lomo y la izquierda nueva se abre desde él.
      play(refs.rightTop.current, [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: TURN_MS, easing: EASE_IN });
      last = play(refs.leftTop.current, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: TURN_MS, easing: EASE_OUT, delay: TURN_MS / 2 });
    } else {
      play(refs.leftTop.current, [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: TURN_MS, easing: EASE_IN });
      last = play(refs.rightTop.current, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: TURN_MS, easing: EASE_OUT, delay: TURN_MS / 2 });
    }
    if (!last) {
      finish();
      return;
    }
    last.onfinish = finish;
    last.oncancel = finish;
    return () => done.forEach((a) => a.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prev]);

  const page = pages[index];
  // Solo cuentan las páginas que se ven: en la primera vista (tapa + datos) no hay ningún año.
  const spreadYears = visible.flatMap((i) => (pages[i]?.kind === "year" ? [(pages[i] as { year: number }).year] : []));
  const spreadHasDatos = wide ? index === 0 : page.kind === "datos";

  // Flechas del teclado y rueda del ratón pasan página desde cualquier punto de la pantalla.
  const lastWheel = useRef(0);
  const current = unit(index);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowLeft") goToUnit(current - 1);
      else if (e.key === "ArrowRight") goToUnit(current + 1);
    };
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const now = Date.now();
      if (Math.abs(d) < 20 || now - lastWheel.current < 450) return;
      lastWheel.current = now;
      goToUnit(current + (d > 0 ? 1 : -1));
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [goToUnit, current]);

  const pageAt = (i: number) => pages[i] ?? null;
  const view = (p: PassportPage | null, side: Side, cover = false, number = 0) => (
    <PageView page={p} nombre={nombre} ciudad={ciudad} emptyPage={emptyPage} stats={stats} total={pages.length} cover={cover} number={number} isNew={isNew} side={side} />
  );
  const layer = (content: React.ReactNode, z: number, origin: "left" | "right", ref?: React.Ref<HTMLDivElement>) => (
    <div ref={ref} className="absolute top-0" style={{ left: 0, width: W, height: H, transformOrigin: `${origin} center`, zIndex: z }}>
      {content}
    </div>
  );

  // Una mitad del libro: la capa que se anima va encima de la estática.
  const half = (side: "left" | "right") => {
    const cur = wide ? (side === "left" ? (index === 0 ? -1 : index) : index === 0 ? 0 : index + 1) : index;
    const before = prev ? (wide ? (side === "left" ? (prev.index === 0 ? -1 : prev.index) : prev.index === 0 ? 0 : prev.index + 1) : prev.index) : null;
    const origin = side === "left" ? "right" : "left";
    const make = (i: number) => view(i < 0 ? null : pageAt(i), wide ? side : "single", i < 0, i + 1);
    if (!prev || before === null || prev.reduced) return layer(make(cur), 1, origin);
    // Hacia delante: la nueva izquierda y la vieja derecha son las que se mueven; hacia atrás, al revés.
    const topIsNew = side === "left" ? !prev.back : prev.back;
    const top = topIsNew ? cur : before;
    const bottom = topIsNew ? before : cur;
    const topRef = wide ? (side === "left" ? refs.leftTop : refs.rightTop) : refs.single;
    // En móvil: hacia delante se cierra la vieja; hacia atrás se abre la nueva.
    if (!wide) {
      const mobileTopIsNew = prev.back;
      return (
        <>
          {layer(make(mobileTopIsNew ? before : cur), 1, "left")}
          {layer(make(mobileTopIsNew ? cur : before), 2, "left", refs.single)}
        </>
      );
    }
    return (
      <>
        {layer(make(bottom), 1, origin)}
        {layer(make(top), 2, origin, topRef)}
      </>
    );
  };

  // Marcas del borde de arriba: Datos y un año por cada año con sellos, en el orden del libro.
  // Como máximo los 4 años más recientes en móvil y los 7 en escritorio; el resto se alcanza desde el índice.
  const maxYears = wide ? 7 : 4;
  const shownYears = years.slice(-maxYears);
  const hasOlder = years.length > shownYears.length;
  const flagItems: FlagItem[] = [
    { id: "datos", label: "Datos", page: 0 },
    ...shownYears.map((y, i) => ({ id: String(y), label: String(y), page: pages.findIndex((p) => p.kind === "year" && p.year === y), more: hasOlder && i === 0 })),
  ];
  // Si se está en un año que no tiene marca, la que lleva «‹» hace de marca activa.
  const openYear = String(spreadYears[0] ?? "");
  const activeFlag = spreadHasDatos ? "datos" : flagItems.some((f) => f.id === openYear) ? openYear : (flagItems[1]?.id ?? "datos");

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col md:max-w-[1080px]">
      <div ref={boxRef} className="mt-[46px] w-full pb-8 md:mt-[52px]">
        <div className="relative mx-auto" style={{ width: ((wide ? SPREAD_W : W) + PAD * 2) * scale, height: (H + PAD * 2) * scale }}>
          <PageFlags ref={flagsRef} items={flagItems} activeId={activeFlag} onGo={goToPage} bookWidth={((wide ? SPREAD_W : W) + PAD * 2) * scale} flagWidth={wide ? 78 : 80} />
          {/* Cinta marcapáginas: centrada en la línea de unión (escritorio) o pegada al borde izquierdo (móvil); asoma 24 px por debajo. */}
          <span
            ref={ribbonRef}
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              left: (wide ? PAD + W + SPINE / 2 - 7 : 0) * scale,
              top: -4 * scale,
              width: (wide ? 14 : 10) * scale,
              height: (H + PAD * 2 + 28) * scale,
              zIndex: 3,
              background: BOOK.ribbon,
              clipPath: "polygon(0 0,100% 0,100% 100%,50% calc(100% - 12px),0 100%)",
              boxShadow: "inset -3px 0 0 rgba(0,0,0,.12)",
            }}
          />
          <div ref={fadeRef} className="absolute" style={{ left: PAD * scale, top: PAD * scale, width: wide ? SPREAD_W : W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <StampAnimContext.Provider value={introDone}>
            <StampOpenContext.Provider value={onOpenStamp ?? null}>
            <DimsContext.Provider value={dims}>
            {wide ? (
              <>
                <div ref={leftRef} className="absolute left-0 top-0" style={{ width: W, height: H }}>
                  {/* Cada mitad lleva su marco: la tapa que asoma y la sombra. Nunca hay marco sin página encima. */}
                  <span aria-hidden="true" className="absolute" style={{ left: -PAD, top: -PAD, width: W + PAD + SPINE, height: H + PAD * 2, background: BOOK.cover, borderRadius: "10px 0 0 10px", boxShadow: "var(--book-shadow)" }} />
                  {half("left")}
                </div>
                <div ref={spineRef} aria-hidden="true" className="absolute top-0" style={{ left: W, width: SPINE, height: H, background: "#0a2420" }} />
                <div ref={rightRef} className="absolute top-0" style={{ left: W + SPINE, width: W, height: H }}>
                  <span aria-hidden="true" className="absolute" style={{ left: 0, top: -PAD, width: W + PAD, height: H + PAD * 2, background: BOOK.cover, borderRadius: "0 10px 10px 0", boxShadow: "var(--book-shadow)" }} />
                  {half("right")}
                </div>
              </>
            ) : (
              <div ref={rightRef} className="absolute left-0 top-0" style={{ width: W, height: H }}>
                <span aria-hidden="true" className="absolute" style={{ left: -PAD, top: -PAD, width: W + PAD * 2, height: H + PAD * 2, background: BOOK.cover, borderRadius: 10, boxShadow: "var(--book-shadow)" }} />
                {half("right")}
              </div>
            )}
            {/* Tapa del lector: solo existe durante la apertura, centrada sobre la página derecha. */}
            {(!introDone || outro) && (
              <div
                ref={coverMoveRef}
                className="absolute"
                style={{ left: wide ? W + SPINE : -PAD, top: -PAD, width: coverW, height: coverH, zIndex: 20 }}
              >
                <div ref={coverFoldRef} className="relative">
                  <PassportCover name={nombre} width={coverW} height={coverH} tilt={0} className={wide ? "!rounded-l-none !rounded-r-[10px]" : "!rounded-[10px]"} />
                  <span ref={coverShadeRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-black opacity-0 ${wide ? "rounded-r-[10px]" : "rounded-[10px]"}`} />
                </div>
              </div>
            )}
            </DimsContext.Provider>
            </StampOpenContext.Provider>
            </StampAnimContext.Provider>
          </div>
        </div>
      </div>

      <div ref={controlsRef} className="flex items-center justify-between pb-2 pt-1 md:pb-4 md:pt-3">
        <NavButton label="Página anterior" disabled={unit(index) === 0} onClick={() => goToUnit(unit(index) - 1)}>
          <ChevronLeft className="size-[22px]" aria-hidden />
        </NavButton>
        <div className="flex flex-col items-center gap-2">
          <p aria-live="polite" className="m-0 flex items-baseline gap-1.5 whitespace-nowrap tabular-nums">
            <span className={`text-[22px] leading-none text-app ${SERIF}`}>{wide && index > 0 ? `Págs. ${index + 1}–${index + 2}` : `Pág. ${index + 1}`}</span>
            <span className="text-[14px] leading-none text-muted">de {wide && index > 0 ? Math.max(pages.length, index + 2) : pages.length}</span>
          </p>
          {/* Un trazo por pliego: el actual, largo y relleno. */}
          <span aria-hidden="true" className="flex items-center gap-1.5">
            {Array.from({ length: units }, (_, i) =>
              i === unit(index) ? (
                <span key={i} className="h-1.5 w-7 rounded-sm bg-[var(--text-primary)] transition-[width] duration-150 motion-reduce:transition-none" />
              ) : (
                <span key={i} className="box-border h-1.5 w-2.5 rounded-sm border border-[var(--text-secondary)] transition-[width] duration-150 motion-reduce:transition-none" />
              ),
            )}
          </span>
        </div>
        <NavButton label="Página siguiente" disabled={unit(index) === units - 1} onClick={() => goToUnit(unit(index) + 1)}>
          <ChevronRight className="size-[22px]" aria-hidden />
        </NavButton>
      </div>
    </div>
  );
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    // Sin `disabled`: sigue siendo enfocable para que el lector de pantalla la anuncie como desactivada.
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onClick()}
      className={`relative inline-flex size-[52px] shrink-0 items-center justify-center rounded-lg bg-[#0e2f2a] p-0 text-[#F1F3EC] transition-[background-color,transform] duration-[120ms] motion-reduce:transition-none ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-[#13403a] active:translate-y-px active:bg-[#0a2420] motion-reduce:active:translate-y-0"
      } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c6a5d]`}
      style={{ border: "1px solid var(--passport-arrow-border)", boxShadow: "var(--passport-arrow-shadow)" }}
    >
      {/* pespunte */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-1 rounded-[5px] border border-dashed border-[rgba(241,243,236,0.38)]" />
      {children}
    </button>
  );
}

/** Fondo de seguridad del papel: ondas + roseta + microtexto. Estático, sin filtros. */
export function PaperGuilloche({ w, h, seed, foil = false, soft = false, rosetteY = 0.55, variant }: { w: number; h: number; seed: number; foil?: boolean; soft?: boolean; rosetteY?: number; variant?: "ticket" }) {
  const lines = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 22; i++) {
      const y0 = h * 0.04 + i * h * 0.044;
      let d = "";
      for (let x = 0; x <= w + 6; x += 6) {
        const y = y0 + 6 * Math.sin(x / 22 + i * 0.55 + seed) + 3 * Math.sin(x / 9 + i);
        d += `${x === 0 ? "M" : "L"}${x},${y.toFixed(1)}`;
      }
      out.push(d);
    }
    return out;
  }, [w, h, seed]);
  const c1 = foil ? BOOK.foil : BOOK.guil1;
  const c2 = foil ? BOOK.foil : BOOK.guil2;
  const cx = w / 2;
  const cy = h * rosetteY;
  return (
    <svg aria-hidden="true" width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute left-0 top-0">
      <g opacity={foil ? 0.13 : variant === "ticket" ? 0.5 : 1} fill="none" strokeWidth={0.6}>
        {lines.map((d, i) => (
          <path key={i} d={d} stroke={i % 2 ? c1 : c2} />
        ))}
        {variant !== "ticket" && <g opacity={soft ? 0.45 : 1}>
          {Array.from({ length: 18 }, (_, k) => (
            <ellipse key={k} cx={cx} cy={cy} rx={w * 0.34} ry={w * 0.11} stroke={k % 3 === 0 ? c2 : c1} transform={`rotate(${k * 10} ${cx} ${cy})`} />
          ))}
          {Array.from({ length: 6 }, (_, r) => (
            <circle key={r} cx={cx} cy={cy} r={w * 0.06 + r * 5} stroke={c1} strokeWidth={0.5} />
          ))}
        </g>}
      </g>
      {!foil && (
        <text x={12} y={h - 10} fontSize={5.5} letterSpacing={1} fill={BOOK.micro} fontFamily="Inter, Arial, sans-serif">
          {"FRIMEE · DOCUMENTO DE VIAJE ENTRE AMIGOS · ".repeat(6)}
        </text>
      )}
    </svg>
  );
}

/** Papel: fondo de seguridad, grosor de hojas en el canto exterior y sombra del lomo en el interior. */
function Paper({ side, seed, number, soft = false, rosetteY, children }: { side: Side; seed: number; number?: number; soft?: boolean; rosetteY?: number; children?: React.ReactNode }) {
  const { w: W, h: H } = useDims();
  return (
    <div className={`relative overflow-hidden ${SIDE_RADIUS[side]}`} style={{ ...PAPER_VARS, width: W, height: H, background: BOOK.paper, boxShadow: EDGE[side], color: BOOK.text }}>
      <PaperGuilloche w={W} h={H} seed={seed} soft={soft} rosetteY={rosetteY} />
      {children}
      {number !== undefined && (
        <span aria-hidden="true" className={`absolute inset-x-0 bottom-[22px] text-center text-[12px] tabular-nums ${SERIF}`} style={{ color: BOOK.label }}>
          {number}
        </span>
      )}
      {side !== "single" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-11"
          style={{
            [side === "left" ? "right" : "left"]: 0,
            background: `linear-gradient(${side === "left" ? "to left" : "to right"}, rgba(36,48,42,.22), rgba(36,48,42,.06) 40%, rgba(36,48,42,0))`,
          }}
        />
      )}
    </div>
  );
}

function PageView({
  page,
  nombre,
  ciudad,
  emptyPage,
  stats,
  total,
  cover = false,
  number,
  isNew,
  side,
}: {
  page: PassportPage | null;
  nombre: string;
  ciudad: string | null;
  emptyPage: EmptyPageActions | null;
  stats: PassportStats;
  total: number;
  cover?: boolean;
  number: number;
  isNew: (s: Pick<Sello, "id" | "nuevo">) => boolean;
  side: Side;
}) {
  if (cover) return <Guarda nombre={nombre} since={stats.since} side={side} />;
  if (!page) {
    // Página aún sin sellar: una hoja en blanco de verdad, con su fondo de seguridad y su cabecera.
    return (
      <Paper side={side} seed={99} number={number} soft>
        <div className={`absolute inset-x-5 top-4 flex justify-between ${LABEL}`}>
          <span>VISADOS · VISAS</span>
          <span className="tabular-nums">{pad2(number)}</span>
        </div>
        {emptyPage && number === 2 && <EmptyPage actions={emptyPage} />}
      </Paper>
    );
  }
  return (
    <Paper side={side} seed={page.number} number={page.kind === "datos" ? undefined : page.number} soft rosetteY={page.kind === "datos" ? 0.74 : undefined}>
      {page.kind === "datos" ? (
        <DatosPage nombre={nombre} ciudad={ciudad} stats={stats} />
      ) : (
        <>
          <div className={`absolute inset-x-5 top-4 flex justify-between ${LABEL}`}>
            <span>VISADOS · VISAS</span>
            <span className="tabular-nums">{pad2(page.number)}</span>
          </div>
          <YearPage page={page} total={total} isNew={isNew} />
        </>
      )}
    </Paper>
  );
}

export type EmptyPageActions = {
  onCreate: () => void;
  onExample: () => void;
  exampleLoading?: boolean;
  exampleError?: string | null;
};

/** Primera hoja en blanco de un pasaporte sin sellos (tablero «Estados»). */
function EmptyPage({ actions }: { actions: EmptyPageActions }) {
  const btn = "inline-flex h-[46px] w-full items-center justify-center rounded-[8px] px-4 text-[15px] font-[var(--fw-semibold)] leading-[1.2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";
  return (
    <div className="absolute inset-x-6 top-[86px] flex flex-col items-center text-center">
      <span aria-hidden="true" className="h-[104px] w-[150px] -rotate-[5deg] rounded-[8px] border-2 border-dashed" style={{ borderColor: BOOK.slot }} />
      <span aria-hidden="true" className="-mt-[30px] ml-[140px] size-[100px] rotate-[6deg] rounded-full border-2 border-dashed" style={{ borderColor: BOOK.slot }} />
      <h3 className={`m-0 mt-6 text-[28px] leading-[1.15] ${SERIF}`}>Esta página está en blanco</h3>
      <p className="m-0 mt-2 text-[16px] leading-[1.6]" style={{ color: BOOK.label }}>Cuando termine tu primer viaje con Frimee, aquí irá su sello.</p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <button type="button" onClick={actions.onCreate} className={`${btn} bg-[var(--primary)] text-[var(--contrast)]`}>
          Crea tu primer plan
        </button>
        <button type="button" onClick={actions.onExample} disabled={actions.exampleLoading} className={`${btn} border border-[var(--border-strong)] bg-[var(--surface-2)] disabled:opacity-60`}>
          {actions.exampleLoading ? "Abriendo el ejemplo…" : "Ver el ejemplo"}
        </button>
        {actions.exampleError && <p role="alert" className="m-0 text-[14px] text-[var(--error)]">{actions.exampleError}</p>}
      </div>
    </div>
  );
}

function Emblem({ size, color }: { size: number; color: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      <circle cx="32" cy="32" r="22" />
      <ellipse cx="32" cy="32" rx="10" ry="22" />
      <path d="M10 32h44M13 21h38M13 43h38" />
      <circle cx="32" cy="32" r="28" strokeDasharray="1.5 3" />
      <path d="M18 46c6-14 18-20 30-26" strokeDasharray="3 3" strokeWidth={2} />
      <circle cx="18" cy="46" r="2.6" fill={color} />
      <circle cx="48" cy="20" r="2.6" fill={color} />
    </svg>
  );
}

/** Guarda: el interior de la tapa, a la izquierda de la página de datos. Siempre en el verde de la tapa. */
function Guarda({ nombre, since, side }: { nombre: string; since: string | null; side: Side }) {
  const { w: W, h: H } = useDims();
  const big = Math.round(W * 0.9);
  const len = nombre.trim().length;
  const nameSize = len <= 16 ? 44 : len <= 24 ? 36 : 30;
  return (
    <div className={`relative overflow-hidden ${SIDE_RADIUS[side]}`} style={{ width: W, height: H, background: BOOK.cover, color: BOOK.foil }}>
      <PaperGuilloche w={W} h={H} seed={3} foil />
      <svg aria-hidden="true" width={big} height={big} viewBox="0 0 64 64" className="absolute" style={{ left: W * 0.05, top: H * 0.1, opacity: 0.1 }} fill="none" stroke={BOOK.foil} strokeWidth={0.35}>
        {Array.from({ length: 13 }, (_, i) => (
          <circle key={`c${i}`} cx="32" cy="32" r={6 + i * 2} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse key={`e${i}`} cx="32" cy="32" rx={4 + i * 4} ry="30" />
        ))}
        {Array.from({ length: 13 }, (_, i) => (
          <path key={`p${i}`} d={`M2 ${8 + i * 4}h60`} />
        ))}
      </svg>
      <span aria-hidden="true" className="absolute inset-y-0 right-0 w-11" style={{ background: "linear-gradient(to left, rgba(0,0,0,.3), rgba(0,0,0,0))" }} />
      <div className="absolute inset-x-8 flex flex-col items-center gap-3 text-center" style={{ top: H * 0.33 }}>
        <Emblem size={56} color={BOOK.foil} />
        <p className="m-0 text-[12px] font-[var(--fw-semibold)] tracking-[0.16em]">ESTE PASAPORTE PERTENECE A</p>
        <p title={nombre} className={`m-0 line-clamp-2 break-words leading-[1.05] ${SERIF}`} style={{ fontSize: nameSize }}>
          {nombre}
        </p>
        <span aria-hidden="true" className="h-px w-14" style={{ background: BOOK.foil }} />
        <p className="m-0 text-[14px] leading-[1.5]">{since ? `Frimee · desde ${monthYearLabel(since)}` : "Frimee"}</p>
      </div>
      <p className="absolute inset-x-6 bottom-[22px] m-0 text-center text-[12px] leading-normal">
        <span className="font-[var(--fw-semibold)] tracking-[0.06em]">DOCUMENTO DE VIAJE ENTRE AMIGOS</span>
        <br />
        No sirve para cruzar fronteras, pero sí para recordarlas.
      </p>
    </div>
  );
}

function Field({ label, value, big, wrap }: { label: string; value: string; big?: boolean | "sm"; wrap?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-px">
      <span className="text-[11px] font-[var(--fw-semibold)] leading-4 tracking-[0.04em]" style={{ color: BOOK.label }}>
        {label}
      </span>
      <span className={`${wrap ? "line-clamp-2 break-words" : "truncate"} tabular-nums ${big ? `${SERIF} ${big === "sm" ? "text-[20px]" : "text-[24px]"} leading-tight` : "text-[15px] font-[var(--fw-semibold)] tracking-[0.04em]"}`} style={{ color: BOOK.text }} title={value}>
        {value}
      </span>
    </div>
  );
}

/** Página de datos tipo documento: cabecera, foto con firma, campos, sellos por país y línea de máquina. */
function DatosPage({ nombre, ciudad, stats }: { nombre: string; ciudad: string | null; stats: PassportStats }) {
  const { w: W, h: H } = useDims();
  // Por debajo de 560 px de alto (móvil bajo): foto más pequeña, banda más baja, cifras más pequeñas y sin marca de agua.
  const compact = H < 560;
  const parts = nombre.trim().split(/\s+/);
  const given = parts[0] ?? "";
  // En escritorio caben las etiquetas bilingües; en móvil solo en español.
  const wide = W > 400;
  const bi = (es: string, en: string) => (wide ? `${es} / ${en}` : es);
  const initials = (parts.map((w) => w[0]).slice(0, 2).join("") || "U").toUpperCase();
  const [m1, m2] = machineLines(nombre, stats);
  // Dos líneas como máximo; si no caben, termina con «+N» (los que faltan), no con puntos suspensivos.
  const countries = stats.porPais.map((p) => (p.count > 1 ? `${p.code} ×${p.count}` : p.code));
  const budget = Math.floor((W - 40) / 9.4) * 2 - 2;
  const join = (xs: string[]) => xs.join(" · ");
  let nShown = countries.length;
  while (nShown > 0 && join(countries.slice(0, nShown)).length + (nShown < countries.length ? ` +${countries.length - nShown}`.length : 0) > budget) nShown--;
  const porPais = join(countries.slice(0, nShown)) + (nShown < countries.length ? ` +${countries.length - nShown}` : "");
  const yymm = stats.since ? stats.since.slice(2, 4) + stats.since.slice(5, 7) : "0000";
  const docNumber = `FR-${yymm}-${initials}`;
  const pw = Math.round(W * (compact ? 0.22 : 0.27));
  const ph = Math.round(pw * 1.3);
  const mrzSize = Math.min(13, (W - 40) / (m1.length * 0.77));
  return (
    <>
      {!compact && (
        <div aria-hidden="true" className="absolute opacity-[.04]" style={{ right: -W * 0.08, bottom: 90 }}>
          <Emblem size={Math.round(W * 0.55)} color={BOOK.text} />
        </div>
      )}
      <div className="absolute inset-x-5 top-4 whitespace-nowrap text-center text-[11px] font-bold" style={{ letterSpacing: wide ? "0.24em" : "0.1em" }}>
        FRIMEE · PASAPORTE · PASSPORT
      </div>
      <div className="absolute inset-x-5 top-9 flex justify-between text-[11px] font-[var(--fw-semibold)] tracking-[0.06em]" style={{ color: BOOK.label }}>
        <span>{bi("TIPO", "TYPE")} · P</span>
        <span>{bi("CÓDIGO", "CODE")} · FRM</span>
        <span className="tabular-nums">Nº {docNumber}</span>
      </div>
      <div className="absolute inset-x-5 top-16 flex gap-[18px]">
        <div className="flex shrink-0 flex-col gap-2">
          <span role="img" aria-label={`Foto de ${nombre}`} className={`grid place-content-center ${SERIF}`} style={{ width: pw, height: ph, background: "#D9DFD7", border: "1px solid #B9C4BE", color: "#6C7B75", fontSize: Math.max(12, pw * 0.45) }}>
            {initials}
          </span>
          <span className={`${SERIF} -rotate-[4deg] truncate text-[24px] italic leading-none`} style={{ color: "#2B4C9B", width: pw }}>
            {given}
          </span>
          <span className="pt-0.5 text-[11px] font-[var(--fw-semibold)] tracking-[0.04em]" style={{ width: pw, borderTop: "1px solid #9FB0A8", color: BOOK.label }}>
            {bi("FIRMA", "SIGNATURE")}
          </span>
        </div>
        <div className={`flex min-w-0 flex-1 flex-col ${compact ? "gap-1.5" : "gap-2.5"}`}>
          <Field label="TITULAR / HOLDER" value={nombre.trim().toUpperCase()} wrap />
          {ciudad && <Field label={bi("RESIDENCIA", "RESIDENCE")} value={ciudad.toUpperCase()} />}
          {stats.since && <Field label={bi("VIAJA DESDE", "SINCE")} value={monthYearLabel(stats.since).toUpperCase()} />}
          {stats.lastStamp && <Field label={bi("ÚLTIMO SELLO", "LAST")} value={`${stats.lastStamp.place} · ${dateLabel(stats.lastStamp.date)}`.toUpperCase()} />}
        </div>
      </div>
      <div className="absolute inset-x-5 flex flex-col gap-4" style={{ top: 64 + ph + (compact ? 70 : 76) }}>
        <div className="grid grid-cols-3 items-end gap-2">
          <Field label={bi("PAÍSES", "COUNTRIES")} value={String(stats.paises).padStart(2, "0")} big={compact ? "sm" : true} />
          <Field label={bi("PLANES", "TRIPS")} value={String(stats.planes).padStart(2, "0")} big={compact ? "sm" : true} />
          <Field label={bi("DÍAS", "DAYS")} value={String(stats.dias).padStart(3, "0")} big={compact ? "sm" : true} />
        </div>
        {!stats.lastStamp && (
          <p className="m-0 text-[14px] leading-[1.5]" style={{ color: BOOK.label }}>
            Aún no hay sellos. Llegan el día siguiente a que termine cada viaje.
          </p>
        )}
        {porPais && <Field label={bi("SELLOS POR PAÍS", "STAMPS BY COUNTRY")} value={porPais} wrap />}
      </div>
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 box-border overflow-hidden whitespace-nowrap px-5 font-mono ${compact ? "h-[56px] pt-2" : "h-[78px] pt-4"} leading-[1.7] tracking-[0.17em]`}
        style={{ background: BOOK.paperBand, borderTop: "1px solid #DDE3DA", color: BOOK.text, fontSize: mrzSize }}
      >
        {m1}
        <br />
        {m2}
      </div>
    </>
  );
}

function NuevoPill({ className }: { className?: string }) {
  return (
    <span className={`absolute h-[22px] rounded-full bg-[var(--passport-ink-new)] px-2 text-[12px] font-[var(--fw-semibold)] leading-[22px] text-[var(--contrast)] ${className ?? ""}`}>
      Nuevo
    </span>
  );
}

function YearPage({ page, total, isNew }: { page: Extract<PassportPage, { kind: "year" }>; total: number; isNew: (s: Pick<Sello, "id" | "nuevo">) => boolean }) {
  const dims = useDims();
  const placed = useMemo(() => layoutPage(page.trips, dims), [page.trips, dims]);
  return (
    <>
      <h2 className={`absolute left-5 top-[34px] m-0 text-[30px] leading-[1.1] ${SERIF}`}>{page.year}</h2>
      {placed.map((p) => (
        <PlacedStamp key={p.key} p={p} isNew={isNew} />
      ))}
      {/* La última página, si le quedan franjas, enseña dónde irá lo siguiente. */}
      {page.number === total && <FreeSlots trips={page.trips} />}
    </>
  );
}

/** «Aquí irá tu próximo sello»: rectángulo y círculo discontinuos en los huecos de plan y país de la primera franja libre. */
function FreeSlots({ trips }: { trips: Trip[] }) {
  const dims = useDims();
  const free = useMemo(() => freeBands(trips, dims), [trips, dims]);
  if (free.length === 0) return null;
  // Solo el hueco siguiente: el resto de la hoja se queda en blanco.
  const first = free[0];
  return (
    <>
      <span aria-hidden="true" className="absolute rounded-[8px] border-2 border-dashed border-[var(--border-strong)]" style={{ left: first.plan.x, top: first.plan.y, width: first.plan.w, height: first.plan.h }} />
      <span aria-hidden="true" className="absolute rounded-full border-2 border-dashed border-[var(--border-strong)]" style={{ left: first.country.x, top: first.country.y, width: first.country.size, height: first.country.size }} />
      <p className="absolute inset-x-4 m-0 text-center text-[14px] leading-[1.5] text-muted" style={{ top: first.plan.y + first.plan.h + 20 }}>
        Aquí irá tu próximo sello
      </p>
    </>
  );
}

/** Animación al estampar: el de plan primero, el de país 120 ms después, el hito al final. */
const stampIn = (isNew: boolean, delayMs: number): React.CSSProperties | undefined =>
  isNew ? { animation: `passport-stamp-in 240ms cubic-bezier(0.2, 0, 0, 1) ${delayMs}ms both` } : undefined;

function PlacedStamp({ p, isNew }: { p: Placed; isNew: (s: Pick<Sello, "id" | "nuevo">) => boolean }) {
  const open = useContext(StampOpenContext);
  const ready = useContext(StampAnimContext);
  if (p.kind === "more") {
    return (
      <span className="absolute inline-flex h-6 items-center rounded-full border border-[var(--border-strong)] bg-surface-2 px-2 text-[12px] font-[var(--fw-semibold)] leading-none" style={{ left: p.x, top: p.y }}>
        {p.label}
      </span>
    );
  }
  const s = p.sello;
  const nuevo = isNew(s);
  const label =
    p.kind === "plan"
      ? `${s.plan?.titulo ?? "Viaje"}, ${dateLabel(s.stamped_at)}${nuevo ? ", sello nuevo" : ""}`
      : p.kind === "country"
        ? `${countryName(s.country_code ?? "")}, sello del ${dateLabel(s.stamped_at)}${nuevo ? ", nuevo" : ""}`
        : `Hito: ${HITO_NAME[s.hito!]}`;
  const delay = p.kind === "plan" ? 300 : p.kind === "country" ? 420 : 540;
  const content =
    p.kind === "plan" ? (
      <PlanStamp sello={s} size={p.size} tilt={p.rot} nuevo={nuevo} />
    ) : p.kind === "country" ? (
      <CountryStamp sello={s} size={p.size} tilt={p.rot} nuevo={nuevo} />
    ) : (
      <HitoStamp hito={s.hito!} id={s.id} size={p.size} tilt={p.rot} nuevo={nuevo} />
    );
  const pill = nuevo && <NuevoPill className={p.kind === "plan" ? "-right-1.5 -top-2.5" : "-right-2 -top-2.5"} />;
  // Mientras el libro se abre, el sello nuevo espera sin verse; al acabar, cae sobre la página.
  const style = { left: p.x, top: p.y, ...(nuevo && !ready ? { opacity: 0 } : stampIn(nuevo, delay)) };
  const base = "absolute block rounded-[8px] leading-[0]";
  // Con hoja (tu pasaporte) cada sello es un botón; sin ella, solo una imagen con su descripción.
  return open ? (
    <button type="button" onClick={(e) => open(s, e.currentTarget)} aria-label={label} className={`${base} ${FOCUS}`} style={style}>
      {content}
      {pill}
    </button>
  ) : (
    <span role="img" aria-label={label} className={base} style={style}>
      {content}
      {pill}
    </span>
  );
}
