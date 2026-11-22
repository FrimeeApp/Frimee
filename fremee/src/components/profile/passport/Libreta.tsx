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
  hash,
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
import { playOpen } from "@/lib/passportOpen";
import { PassportCover } from "./PassportCover";
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
const TAB_W = 52;
const TAB_H = 104;
type Side = "left" | "right" | "single";
const SIDE_RADIUS: Record<Side, string> = { left: "rounded-l-[8px]", right: "rounded-r-[8px]", single: "rounded-[8px]" };
const EASE_IN = "cubic-bezier(0.3, 0, 1, 1)";
const EASE_OUT = "cubic-bezier(0.2, 0, 0, 1)";
const TURN_MS = 240;
const FADE_MS = 160;

const pad2 = (n: number) => String(n).padStart(2, "0");

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

export default function Libreta({
  nombre,
  sellos,
  intro,
  jumpTo,
  onOpenStamp,
}: {
  nombre: string;
  sellos: Sello[];
  intro?: LibretaIntro;
  jumpTo?: { page: number; nonce: number } | null;
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
  const dims = wide ? WIDE : MOBILE;
  const W = dims.w;
  const H = dims.h;
  const SPREAD_W = W * 2 + SPINE;
  // La tapa del lector mantiene la proporción de la tapa (132 × 185) y cabe en una página.
  const coverW = Math.min(W, (H * 132) / 185);
  const coverH = (coverW * 185) / 132;
  // Antes de pintar: la apertura necesita saber ya si es doble página y a qué escala.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const isWide = window.matchMedia("(min-width: 768px)").matches;
      setWide(isWide);
      const d = isWide ? WIDE : MOBILE;
      const byWidth = el.clientWidth / (isWide ? d.w * 2 + SPINE + TAB_W : d.w);
      const byHeight = isWide ? (window.innerHeight - 200) / d.h : Infinity;
      setScale(Math.min(isWide ? 1 : 1.25, Math.max(0.5, Math.min(byWidth, byHeight))));
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
  const leftRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLElement>(null);
  const coverMoveRef = useRef<HTMLDivElement>(null);
  const coverFoldRef = useRef<HTMLDivElement>(null);
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
    const chrome = ([controlsRef.current, wide ? null : chipsRef.current, ...(intro.chromeRefs ?? []).map((r) => r.current)] as (HTMLElement | null)[]).filter((e): e is HTMLElement => Boolean(e));
    void playOpen({
      fromCover: intro.fromCover,
      coverMove: cm,
      coverFold: cf,
      profile: intro.profile,
      desk,
      right: ([right, spineRef.current] as (HTMLElement | null)[]).filter((e): e is HTMLElement => Boolean(e)),
      left: wide ? leftRef.current : null,
      tabs: wide ? tabsRef.current : null,
      chrome,
    }).then(() => {
      setIntroDone(true);
      intro.onDone?.();
    });
  }, [intro, measured, wide]);

    // En escritorio se abre por la tapa (guarda y página de datos); en móvil, por la última página sellada.
  const [rawIndex, setIndex] = useState(() => (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches ? 0 : pages.length - 1));
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
  const jumpToYear = (y: number) => goToPage(pages.findIndex((p) => p.kind === "year" && p.year === y));

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
    <PageView page={p} nombre={nombre} stats={stats} total={pages.length} cover={cover} number={number} isNew={isNew} side={side} />
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

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col md:max-w-[1080px]">
      <nav ref={chipsRef} aria-label="Saltar a" className="flex gap-2 overflow-x-auto pb-3 pt-1 md:hidden">
        <Chip active={spreadHasDatos} onClick={() => goToPage(0)}>
          Datos
        </Chip>
        {years.map((y) => (
          <Chip key={y} active={spreadYears.includes(y)} onClick={() => jumpToYear(y)}>
            {y}
          </Chip>
        ))}
      </nav>

      <div ref={boxRef} className="w-full">
        <div className="relative mx-auto" style={{ width: (wide ? SPREAD_W + TAB_W : W) * scale, height: H * scale }}>
          <div ref={fadeRef} className="absolute left-0 top-0" style={{ width: wide ? SPREAD_W : W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <StampAnimContext.Provider value={introDone}>
            <StampOpenContext.Provider value={onOpenStamp ?? null}>
            <DimsContext.Provider value={dims}>
            {wide ? (
              <>
                <div ref={leftRef} className="absolute left-0 top-0" style={{ width: W, height: H }}>
                  {half("left")}
                </div>
                <div ref={spineRef} aria-hidden="true" className="absolute top-0 bg-[var(--border-strong)]" style={{ left: W, width: SPINE, height: H }} />
                <div ref={rightRef} className="absolute top-0" style={{ left: W + SPINE, width: W, height: H }}>
                  {half("right")}
                </div>
              </>
            ) : (
              <div ref={rightRef} className="absolute left-0 top-0" style={{ width: W, height: H }}>
                {half("right")}
              </div>
            )}
            {/* Tapa del lector: solo existe durante la apertura, centrada sobre la página derecha. */}
            {!introDone && (
              <div
                ref={coverMoveRef}
                className="absolute"
                style={{ left: (wide ? W + SPINE : 0) + (W - coverW) / 2, top: (H - coverH) / 2, width: coverW, height: coverH, zIndex: 20 }}
              >
                <div ref={coverFoldRef}>
                  <PassportCover name={nombre} width={coverW} tilt={0} />
                </div>
              </div>
            )}
            </DimsContext.Provider>
            </StampOpenContext.Provider>
            </StampAnimContext.Provider>
          </div>
          {wide && (
            <div ref={tabsRef} className="absolute flex flex-col" style={{ left: SPREAD_W * scale, top: 28 * scale, gap: 6 * scale }}>
              <EdgeTab active={spreadHasDatos} onClick={() => goToPage(0)} h={TAB_H * scale} w={TAB_W * scale}>
                Datos
              </EdgeTab>
              {years.map((y) => (
                <EdgeTab key={y} active={spreadYears.includes(y)} onClick={() => jumpToYear(y)} h={TAB_H * scale} w={TAB_W * scale}>
                  {y}
                </EdgeTab>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={controlsRef} className="flex items-center justify-between pb-4 pt-3">
        <NavButton label="Página anterior" disabled={unit(index) === 0} onClick={() => goToUnit(unit(index) - 1)}>
          <ChevronLeft className="size-[22px]" aria-hidden />
        </NavButton>
        <span aria-live="polite" className="text-[14px] tabular-nums text-muted">
          {wide && index > 0 ? `Páginas ${index + 1}–${index + 2} de ${Math.max(pages.length, index + 2)}` : `Página ${index + 1} de ${pages.length}`}
        </span>
        <NavButton label="Página siguiente" disabled={unit(index) === units - 1} onClick={() => goToUnit(unit(index) + 1)}>
          <ChevronRight className="size-[22px]" aria-hidden />
        </NavButton>
      </div>
    </div>
  );
}

function EdgeTab({ active, onClick, h, w, children }: { active: boolean; onClick: () => void; h: number; w: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={{ width: w, height: h, writingMode: "vertical-rl" }}
      className={`flex items-center justify-center rounded-r-[8px] border border-l-0 text-[14px] font-[var(--fw-semibold)] leading-none ${FOCUS} ${
        active ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--contrast)]" : "border-[var(--border-strong)] bg-surface-2 text-app"
      }`}
    >
      {children}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 min-w-11 shrink-0 items-center justify-center rounded-full border px-4 text-[14px] font-[var(--fw-semibold)] leading-none ${FOCUS} ${
        active ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--contrast)]" : "border-[var(--border-strong)] bg-surface-2 text-app"
      }`}
    >
      {children}
    </button>
  );
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex size-11 items-center justify-center rounded-[8px] border border-[var(--border-strong)] bg-surface-2 text-app disabled:opacity-[var(--disabled-opacity)] md:size-[52px] ${FOCUS}`}
    >
      {children}
    </button>
  );
}

/** Fondo de seguridad: 10 ondas + roseta, trazo de 1 px. Un SVG estático por página, sin filtros. */
function Guilloche({ seed }: { seed: number }) {
  const { w: W, h: H } = useDims();
  const k = H / 590;
  const bases = [59, 119, 172, 217, 259, 301, 350, 404, 459, 512].map((b) => b * k);
  const roseta = { x: W - 40, y: H - 60 };
  const waves = useMemo(
    () =>
      bases.map((base, k) => {
        const p1 = ((hash(seed, k) % 628) / 100) * 1;
        const p2 = ((hash(seed, k + 20) % 628) / 100) * 1;
        let pts = "";
        for (let x = 0; x <= W + 9; x += 9) {
          const y = base + 7 * Math.sin(x / 38 + p1) + 4 * Math.sin(x / 15 + p2);
          pts += `${x},${y.toFixed(1)} `;
        }
        return pts.trim();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, W, H],
  );
  return (
    <svg aria-hidden="true" width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute left-0 top-0" fill="none" stroke="var(--passport-line)" strokeWidth="1">
      {waves.map((pts, i) => (
        <polyline key={i} points={pts} />
      ))}
      {[0, 30, 60, 90, 120, 150].map((r) => (
        <ellipse key={r} cx={roseta.x} cy={roseta.y} rx="46" ry="16" transform={`rotate(${r} ${roseta.x} ${roseta.y})`} />
      ))}
    </svg>
  );
}

function PageView({
  page,
  nombre,
  stats,
  total,
  cover = false,
  number,
  isNew,
  side,
}: {
  page: PassportPage | null;
  nombre: string;
  stats: PassportStats;
  total: number;
  cover?: boolean;
  number: number;
  isNew: (s: Pick<Sello, "id" | "nuevo">) => boolean;
  side: Side;
}) {
  const { w: W, h: H } = useDims();
  const radius = SIDE_RADIUS[side];
  if (cover) return <Guarda nombre={nombre} since={stats.since} className={radius} />;
  if (!page) {
    // Página aún sin sellar: dice por qué está vacía y deja dos huecos para el próximo viaje.
    return (
      <div className={`relative overflow-hidden border border-app bg-surface text-app ${radius}`} style={{ width: W, height: H }}>
        <Guilloche seed={99} />
        <div className={`absolute inset-x-4 top-[14px] flex justify-between ${LABEL}`}>
          <span>VISADOS</span>
          <span className="tabular-nums">PÁG. {pad2(number)}</span>
        </div>
        {/* Una hoja en blanco de verdad: fondo de seguridad y cabecera, nada más. */}
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden border border-app bg-surface text-app ${radius}`} style={{ width: W, height: H }}>
      <Guilloche seed={page.number} />
      <div className={`absolute inset-x-4 top-[14px] flex justify-between ${LABEL}`}>
        <span>{page.kind === "datos" ? "PÁGINA DE DATOS" : "VISADOS"}</span>
        <span className="tabular-nums">PÁG. {pad2(page.number)}</span>
      </div>
      {page.kind === "datos" ? <DatosPage nombre={nombre} stats={stats} /> : <YearPage page={page} total={total} isNew={isNew} />}
    </div>
  );
}

/** Guarda: el interior de la tapa, a la izquierda de la página de datos (tablero «Opción B»). Siempre en el verde de la tapa. */
function Guarda({ nombre, since, className = "" }: { nombre: string; since: string | null; className?: string }) {
  const { w: W, h: H } = useDims();
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width: W, height: H, background: "var(--passport-cover)", color: "var(--passport-foil)" }}>
      <svg aria-hidden="true" width={W} height={H} className="absolute inset-0">
        <defs>
          <pattern id="passport-guarda" width="88" height="88" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.11">
              <circle cx="22" cy="22" r="12" />
              <ellipse cx="22" cy="22" rx="5.5" ry="12" />
              <path d="M10 22h24" />
              <path d="M48 70c8-16 20-22 32-26" strokeDasharray="3 3" />
              <circle cx="48" cy="70" r="2" />
              <circle cx="80" cy="44" r="2" />
              <circle cx="66" cy="66" r="12" />
              <ellipse cx="66" cy="66" rx="5.5" ry="12" />
              <path d="M54 66h24" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#passport-guarda)" />
      </svg>
      <div
        className="absolute flex flex-col items-center gap-3 rounded-[8px] border border-current text-center"
        style={{ left: 48, right: 48, top: "50%", transform: "translateY(-50%)", padding: "32px 24px", background: "var(--passport-cover)" }}
      >
        <svg aria-hidden="true" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0">
          <circle cx="32" cy="32" r="22" />
          <ellipse cx="32" cy="32" rx="10" ry="22" />
          <path d="M10 32h44" />
          <path d="M13 21h38" />
          <path d="M13 43h38" />
          <circle cx="32" cy="32" r="28" strokeDasharray="1.5 3" />
          <path d="M18 46c6-14 18-20 30-26" strokeDasharray="3 3" strokeWidth="2" />
          <circle cx="18" cy="46" r="2.6" fill="currentColor" />
          <circle cx="48" cy="20" r="2.6" fill="currentColor" />
        </svg>
        <p className="m-0 text-[12px] font-[var(--fw-semibold)] leading-[1.4] tracking-[0.08em]">ESTE PASAPORTE PERTENECE A</p>
        <p title={nombre} className={`m-0 line-clamp-2 break-words leading-[1.1] ${nombre.trim().length > 22 ? "text-[32px]" : "text-[40px]"} ${SERIF}`}>{nombre}</p>
        <span aria-hidden="true" className="h-px w-12 bg-current" />
        <p className="m-0 text-[14px] leading-[1.5]">{since ? `Frimee · desde ${monthYearLabel(since)}` : "Frimee"}</p>
      </div>
      <p className="absolute inset-x-0 m-0 text-center text-[12px] font-[var(--fw-semibold)] leading-[1.4] tracking-[0.22em]" style={{ bottom: 20 }}>
        FRIMEE
      </p>
    </div>
  );
}

function Field({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={LABEL}>{label}</span>
      <span className={`break-words tabular-nums font-[var(--fw-semibold)] ${small ? "text-[14px] leading-[1.5]" : "text-[16px] leading-[1.35]"}`}>{value}</span>
    </div>
  );
}

function DatosPage({ nombre, stats }: { nombre: string; stats: PassportStats }) {
  const initials = (nombre.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "U").toUpperCase();
  const [m1, m2] = machineLines(nombre, stats);
  const porPais = stats.porPais.map((p) => (p.count > 1 ? `${p.code} ×${p.count}` : p.code)).join(" · ");
  return (
    <div className="absolute inset-x-4 bottom-[14px] top-11 flex flex-col gap-4">
      <div className="flex gap-3.5">
        <span aria-hidden="true" className={`flex h-[124px] w-24 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border-strong)] bg-surface-2 text-[40px] leading-none ${SERIF}`}>
          {initials}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <Field label="TITULAR" value={nombre} />
          {stats.since && <Field label="VIAJA DESDE" value={monthYearLabel(stats.since)} />}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-y border-app py-3">
        {[
          [stats.paises, "países"],
          [stats.planes, "planes"],
          [stats.dias, "días fuera"],
        ].map(([n, l]) => (
          <div key={l} className="flex flex-col">
            <span className={`text-[40px] leading-none tabular-nums ${SERIF}`}>{n}</span>
            <span className="text-[14px] leading-[1.5] text-muted">{l}</span>
          </div>
        ))}
      </div>
      {stats.lastStamp ? (
        <Field label="ÚLTIMO SELLO" value={`${stats.lastStamp.place} · ${dateLabel(stats.lastStamp.date)}`} />
      ) : (
        <p className="m-0 text-[14px] leading-[1.5] text-muted">Aún no hay sellos. Llegan el día siguiente a que termine cada viaje.</p>
      )}
      {porPais && <Field label="SELLOS POR PAÍS" value={porPais} small />}
      <div aria-hidden="true" className="mt-auto overflow-hidden whitespace-nowrap font-mono text-[12px] leading-[1.6] tracking-[0.12em] text-muted">
        {m1}
        <br />
        {m2}
      </div>
    </div>
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
      <h2 className={`absolute left-4 top-[34px] m-0 text-[28px] leading-[1.1] ${SERIF}`}>{page.year}</h2>
      {placed.map((p) => (
        <PlacedStamp key={p.key} p={p} isNew={isNew} />
      ))}
      {/* La última página, si le quedan franjas, enseña dónde irá lo siguiente. */}
      {page.number === total && <FreeSlots trips={page.trips} />}
      {page.continues && page.number < total && <p className="absolute inset-x-4 bottom-3 m-0 text-right text-[12px] leading-[1.4] text-muted">Sigue en la pág. {pad2(page.number + 1)}</p>}
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
