"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  tripSlots,
  type PassportPage,
  type PassportStats,
  type Sello,
  type Trip,
} from "@/lib/passport";
import { marcarSellosVistos } from "@/services/api/endpoints/pasaporte.endpoint";
import { CountryStamp, HITO_NAME, HitoStamp, PlanStamp } from "./stamps";

/** La libreta (tableros «Pasaporte · la libreta»): página de datos + una página por cada 3 viajes de un año. */

/** Medidas lógicas de una página. Móvil: 358 × 590. Escritorio (doble página): 452 × 620, casi la proporción de la tapa. */
type Dims = { w: number; h: number; tops: number[]; stack: number };
const MOBILE: Dims = { w: 358, h: 590, tops: [56, 224, 390], stack: 108 };
const WIDE: Dims = { w: 452, h: 620, tops: [60, 238, 416], stack: 116 };
const DimsContext = createContext<Dims>(MOBILE);
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

export default function Libreta({ nombre, sellos }: { nombre: string; sellos: Sello[] }) {
  const trips = useMemo(() => groupTrips(sellos), [sellos]);
  const pages = useMemo(() => buildPages(trips), [trips]);
  const stats = useMemo(() => computeStats(sellos), [sellos]);
  const years = useMemo(() => [...new Set(pages.flatMap((p) => (p.kind === "year" ? [p.year] : [])))], [pages]);

  const boxRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [scale, setScale] = useState(1);
  const dims = wide ? WIDE : MOBILE;
  const W = dims.w;
  const H = dims.h;
  const SPREAD_W = W * 2 + SPINE;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const isWide = window.matchMedia("(min-width: 768px)").matches;
      setWide(isWide);
      const d = isWide ? WIDE : MOBILE;
      const byWidth = el.clientWidth / (isWide ? d.w * 2 + SPINE + TAB_W : d.w);
      const byHeight = isWide ? (window.innerHeight - 200) / d.h : Infinity;
      setScale(Math.min(isWide ? 1 : 1.25, Math.max(0.5, Math.min(byWidth, byHeight))));
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

  // Se abre por la última página sellada: las páginas van por orden de fecha, como en un pasaporte.
  const [rawIndex, setIndex] = useState(() => pages.length - 1);
  // En ancho la página izquierda siempre es par (índice impar); al pasar de móvil a ancho se recoloca.
  const index = wide ? (rawIndex === 0 ? 0 : 2 * Math.ceil(rawIndex / 2) - 1) : rawIndex;
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

  const visible = wide ? (index === 0 ? [0] : [index, index + 1]) : [index];
  const visibleKey = visible.join(",");
  useEffect(() => {
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
  }, [visibleKey, pages]);

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
      <nav aria-label="Saltar a" className="flex gap-2 overflow-x-auto pb-3 pt-1 md:hidden">
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
          <div ref={fadeRef} data-passport-book data-passport-target={wide ? undefined : ""} className="absolute left-0 top-0" style={{ width: wide ? SPREAD_W : W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <DimsContext.Provider value={dims}>
            {wide ? (
              <>
                <div data-passport-target className="absolute left-0 top-0" style={{ width: W, height: H }}>
                  {half("left")}
                </div>
                <div aria-hidden="true" className="absolute top-0 bg-[var(--border-strong)]" style={{ left: W, width: SPINE, height: H }} />
                <div className="absolute top-0" style={{ left: W + SPINE, width: W, height: H }}>
                  {half("right")}
                </div>
              </>
            ) : (
              half("right")
            )}
            </DimsContext.Provider>
          </div>
          {wide && (
            <div className="absolute flex flex-col" style={{ left: SPREAD_W * scale, top: 28 * scale, gap: 6 * scale }}>
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

      <div className="flex items-center justify-between pb-4 pt-3">
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
        <span aria-hidden="true" className="absolute rounded-[8px] border-2 border-dashed border-[var(--border-strong)]" style={{ left: 20, top: 84, width: 150, height: 103 }} />
        <span aria-hidden="true" className="absolute rounded-full border-2 border-dashed border-[var(--border-strong)]" style={{ left: W - 144, top: 70, width: 104, height: 104 }} />
        <p className="absolute inset-x-4 m-0 text-center text-[14px] leading-[1.5] text-muted" style={{ top: 236 }}>
          Aquí irá tu próximo sello
        </p>
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
            <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.16">
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
        <p className={`m-0 text-[40px] leading-[1.1] ${SERIF}`}>{nombre}</p>
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
      <span className={`tabular-nums font-[var(--fw-semibold)] ${small ? "text-[14px] leading-[1.5]" : "text-[16px] leading-[1.35]"}`}>{value}</span>
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

const planTilt = (id: number) => -6 + (hash(id, 11) % 11);
const paisTilt = (id: number) => -8 + (hash(id, 12) % 18);

function NuevoPill({ className }: { className?: string }) {
  return (
    <span className={`absolute h-[22px] rounded-full bg-[var(--passport-ink-new)] px-2 text-[12px] font-[var(--fw-semibold)] leading-[22px] text-[var(--contrast)] ${className ?? ""}`}>
      Nuevo
    </span>
  );
}

function YearPage({ page, total, isNew }: { page: Extract<PassportPage, { kind: "year" }>; total: number; isNew: (s: Pick<Sello, "id" | "nuevo">) => boolean }) {
  const starts = page.trips.map((_, i) => page.trips.slice(0, i).reduce((n, t) => n + tripSlots(t), 0));
  return (
    <>
      <h2 className={`absolute left-4 top-[34px] m-0 text-[28px] leading-[1.1] ${SERIF}`}>{page.year}</h2>
      {page.trips.map((t, i) => (
        <TripView key={t.planId} trip={t} slot={starts[i]} isNew={isNew} />
      ))}
      {page.continues && page.number < total && <p className="absolute inset-x-4 bottom-3 m-0 text-right text-[12px] leading-[1.4] text-muted">Sigue en la pág. {pad2(page.number + 1)}</p>}
    </>
  );
}

/** Animación al estampar: el de plan primero, el de país 120 ms después, el hito al final. */
const stampIn = (isNew: boolean, delayMs: number): React.CSSProperties | undefined =>
  isNew ? { animation: `passport-stamp-in 240ms cubic-bezier(0.2, 0, 0, 1) ${delayMs}ms both` } : undefined;

function TripView({ trip, slot, isNew }: { trip: Trip; slot: number; isNew: (s: Pick<Sello, "id" | "nuevo">) => boolean }) {
  const { w: W, tops, stack } = useDims();
  const y = tops[slot];
  const flip = slot % 2 === 1;
  const multi = trip.paises.length >= 2;
  const planX = flip ? W - 182 : 16;
  const planY = y + 12;
  const label = trip.info?.titulo ?? "Viaje";
  const nuevoPlan = trip.plan ? isNew(trip.plan) : false;
  const shown = multi ? trip.paises.slice(0, 3) : trip.paises;
  const extra = multi ? trip.paises.length - shown.length : 0;
  const size = multi ? (shown.length > 2 ? 84 : 88) : 104;
  const hitoSlot = slot + (multi ? 2 : 1);
  const hitos = trip.hitos.slice(0, 3);
  const hitoSize = hitos.length > 2 ? 88 : 92;
  const hitoGap = 14;
  const hitoRowW = hitos.length * hitoSize + (hitos.length - 1) * hitoGap;
  return (
    <>
      {trip.plan && (
        <span role="img" aria-label={`${label}${trip.info ? `, ${dateLabel(trip.date)}` : ""}${nuevoPlan ? ", sello nuevo" : ""}`} className="absolute block leading-[0]" style={{ left: planX, top: planY, ...stampIn(nuevoPlan, 300) }}>
          <PlanStamp sello={trip.plan} tilt={planTilt(trip.plan.id)} nuevo={nuevoPlan} />
          {nuevoPlan && <NuevoPill className="-right-1.5 -top-2.5" />}
        </span>
      )}
      {shown.map((p, i) => {
        const x = multi ? (flip ? 28 + (i % 2) * 14 : W - 126 - (i % 2) * 14) : flip ? 24 : W - 144;
        const top = multi ? y + i * stack : y;
        const nuevo = isNew(p);
        return (
          <span key={p.id} role="img" aria-label={`${countryName(p.country_code ?? "")}, sello del ${dateLabel(p.stamped_at)}${nuevo ? ", nuevo" : ""}`} className="absolute block leading-[0]" style={{ left: Math.min(x, W - size - 8), top, ...stampIn(nuevo, 420 + i * 60) }}>
            <CountryStamp sello={p} size={size} tilt={paisTilt(p.id)} nuevo={nuevo} />
            {nuevo && <NuevoPill className="-right-2 -top-2.5" />}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="absolute inline-flex h-6 items-center rounded-full border border-[var(--border-strong)] bg-surface-2 px-2 text-[12px] font-[var(--fw-semibold)] leading-none" style={{ left: flip ? 28 : W - 126, top: y + 3 * stack - 4 }}>
          +{extra}
        </span>
      )}
      {hitos.map((h, i) => {
        const nuevo = isNew(h);
        return (
          <span
            key={h.id}
            role="img"
            aria-label={`Hito: ${HITO_NAME[h.hito!]}`}
            className="absolute block leading-[0]"
            style={{ left: (W - hitoRowW) / 2 + i * (hitoSize + hitoGap), top: tops[hitoSlot] + 24, ...stampIn(nuevo, 540 + i * 60) }}
          >
            <HitoStamp hito={h.hito!} id={h.id} stampedAt={h.stamped_at} size={hitoSize} tilt={paisTilt(h.id) / 2} nuevo={nuevo} />
            {nuevo && <NuevoPill className="-right-2 -top-2.5" />}
          </span>
        );
      })}
    </>
  );
}
