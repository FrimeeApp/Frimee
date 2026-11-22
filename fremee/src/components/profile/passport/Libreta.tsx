"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { CountryStamp, HitoStamp, PlanStamp } from "./stamps";

/** La libreta (tableros «Pasaporte · la libreta»): página de datos + una página por cada 3 viajes de un año. */

const W = 358;
const H = 590;
const SPINE = 6;
const SPREAD_W = W * 2 + SPINE;
const TAB_W = 48;
const SLOT_TOPS = [56, 224, 390];
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
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const isWide = window.matchMedia("(min-width: 768px)").matches;
      setWide(isWide);
      const byWidth = el.clientWidth / (isWide ? SPREAD_W + TAB_W : W);
      const byHeight = isWide ? (window.innerHeight - 210) / H : Infinity;
      setScale(Math.min(isWide ? 1.4 : 1.25, Math.max(0.6, Math.min(byWidth, byHeight))));
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

  // Se abre por la última página sellada: la primera de las páginas de año (los viajes van del más reciente al más antiguo).
  const [rawIndex, setIndex] = useState(() => (pages.length > 1 ? 1 : 0));
  // En ancho la página izquierda siempre es par (índice impar); al pasar de móvil a ancho se recoloca.
  const index = wide ? (rawIndex === 0 ? 0 : 2 * Math.ceil(rawIndex / 2) - 1) : rawIndex;
  const [prev, setPrev] = useState<{ index: number; back: boolean; reduced: boolean } | null>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

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
  const spreadYears = wide ? [pages[index], pages[index + 1]].flatMap((p) => (p?.kind === "year" ? [p.year] : [])) : page.kind === "year" ? [page.year] : [];
  const spreadHasDatos = wide ? index === 0 : page.kind === "datos";
  const jumpToYear = (y: number) => goToPage(pages.findIndex((p) => p.kind === "year" && p.year === y));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToUnit(unit(index) - 1);
    else if (e.key === "ArrowRight") goToUnit(unit(index) + 1);
  };

  const pageAt = (i: number) => pages[i] ?? null;
  const view = (p: PassportPage | null, cover = false) => <PageView page={p} nombre={nombre} stats={stats} total={pages.length} cover={cover} />;
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
    const make = (i: number) => view(i < 0 ? null : pageAt(i), i < 0);
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
    <div className="mx-auto flex w-full max-w-[460px] flex-col md:max-w-[860px]" onKeyDown={onKey}>
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
          <div ref={fadeRef} className="absolute left-0 top-0" style={{ width: wide ? SPREAD_W : W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {wide ? (
              <>
                <div className="absolute left-0 top-0" style={{ width: W, height: H }}>
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
          </div>
          {wide && (
            <div className="absolute flex flex-col gap-1" style={{ left: SPREAD_W * scale, top: 24 * scale }}>
              <EdgeTab active={spreadHasDatos} onClick={() => goToPage(0)} h={88 * scale}>
                Datos
              </EdgeTab>
              {years.map((y) => (
                <EdgeTab key={y} active={spreadYears.includes(y)} onClick={() => jumpToYear(y)} h={88 * scale}>
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
          {wide && index > 0 && pages[index + 1] ? `Páginas ${index + 1} y ${index + 2} de ${pages.length}` : `Página ${index + 1} de ${pages.length}`}
        </span>
        <NavButton label="Página siguiente" disabled={unit(index) === units - 1} onClick={() => goToUnit(unit(index) + 1)}>
          <ChevronRight className="size-[22px]" aria-hidden />
        </NavButton>
      </div>
    </div>
  );
}

function EdgeTab({ active, onClick, h, children }: { active: boolean; onClick: () => void; h: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={{ width: TAB_W - 4, height: h, writingMode: "vertical-rl" }}
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
      className={`inline-flex size-11 items-center justify-center rounded-[8px] border border-[var(--border-strong)] bg-surface-2 text-app disabled:opacity-[var(--disabled-opacity)] ${FOCUS}`}
    >
      {children}
    </button>
  );
}

/** Fondo de seguridad: 10 ondas + roseta, trazo de 1 px. Un SVG estático por página, sin filtros. */
function Guilloche({ seed }: { seed: number }) {
  const bases = [59, 119, 172, 217, 259, 301, 350, 404, 459, 512];
  const roseta = { x: 318, y: 530 };
  const waves = useMemo(
    () =>
      bases.map((base, k) => {
        const p1 = ((hash(seed, k) % 628) / 100) * 1;
        const p2 = ((hash(seed, k + 20) % 628) / 100) * 1;
        let pts = "";
        for (let x = 0; x <= 360; x += 9) {
          const y = base + 7 * Math.sin(x / 38 + p1) + 4 * Math.sin(x / 15 + p2);
          pts += `${x},${y.toFixed(1)} `;
        }
        return pts.trim();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed],
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

function PageView({ page, nombre, stats, total, cover = false }: { page: PassportPage | null; nombre: string; stats: PassportStats; total: number; cover?: boolean }) {
  if (cover) {
    // El interior de la tapa, a la izquierda de la página de datos.
    return <div className="rounded-[8px]" style={{ width: W, height: H, background: "var(--passport-cover)", borderRight: "1px solid var(--passport-spine)" }} />;
  }
  if (!page) {
    return (
      <div className="relative overflow-hidden rounded-[8px] border border-app bg-surface" style={{ width: W, height: H }}>
        <Guilloche seed={99} />
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-[8px] border border-app bg-surface text-app" style={{ width: W, height: H }}>
      <Guilloche seed={page.number} />
      <div className={`absolute inset-x-4 top-[14px] flex justify-between ${LABEL}`}>
        <span>{page.kind === "datos" ? "PÁGINA DE DATOS" : `VISADOS · ${page.year}`}</span>
        <span className="tabular-nums">PÁG. {pad2(page.number)}</span>
      </div>
      {page.kind === "datos" ? <DatosPage nombre={nombre} stats={stats} /> : <YearPage page={page} total={total} />}
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

function YearPage({ page, total }: { page: Extract<PassportPage, { kind: "year" }>; total: number }) {
  const starts = page.trips.map((_, i) => page.trips.slice(0, i).reduce((n, t) => n + tripSlots(t), 0));
  return (
    <>
      <h2 className={`absolute left-4 top-[34px] m-0 text-[28px] leading-[1.1] ${SERIF}`}>{page.year}</h2>
      {page.trips.map((t, i) => (
        <TripView key={t.planId} trip={t} y={SLOT_TOPS[starts[i]]} flip={starts[i] % 2 === 1} />
      ))}
      {page.continues && page.number < total && <p className="absolute inset-x-4 bottom-3 m-0 text-right text-[12px] leading-[1.4] text-muted">Sigue en la pág. {pad2(page.number + 1)}</p>}
    </>
  );
}

function TripView({ trip, y, flip }: { trip: Trip; y: number; flip: boolean }) {
  const multi = trip.paises.length >= 2;
  const planX = flip ? 176 : 16;
  const planY = y + 12;
  const label = trip.info?.titulo ?? "Viaje";
  const nuevoPlan = trip.plan?.nuevo ?? false;
  const shown = multi ? trip.paises.slice(0, 3) : trip.paises;
  const extra = multi ? trip.paises.length - shown.length : 0;
  const size = multi ? (shown.length > 2 ? 84 : 88) : 104;
  return (
    <>
      {trip.plan && (
        <span role="img" aria-label={`${label}${trip.info ? `, ${dateLabel(trip.date)}` : ""}${nuevoPlan ? ", sello nuevo" : ""}`} className="absolute block leading-[0]" style={{ left: planX, top: planY }}>
          <PlanStamp sello={trip.plan} tilt={planTilt(trip.plan.id)} nuevo={nuevoPlan} />
          {nuevoPlan && <NuevoPill className="-right-1.5 -top-2.5" />}
        </span>
      )}
      {shown.map((p, i) => {
        const x = multi ? (flip ? 28 + (i % 2) * 14 : 232 - (i % 2) * 14) : flip ? 24 : 214;
        const top = multi ? y + i * 108 : y;
        return (
          <span key={p.id} role="img" aria-label={`${countryName(p.country_code ?? "")}, sello del ${dateLabel(p.stamped_at)}${p.nuevo ? ", nuevo" : ""}`} className="absolute block leading-[0]" style={{ left: Math.min(x, W - size - 8), top }}>
            <CountryStamp sello={p} size={size} tilt={paisTilt(p.id)} nuevo={p.nuevo} />
            {p.nuevo && <NuevoPill className="-right-2 -top-2.5" />}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="absolute inline-flex h-6 items-center rounded-full border border-[var(--border-strong)] bg-surface-2 px-2 text-[12px] font-[var(--fw-semibold)] leading-none" style={{ left: flip ? 28 : 232, top: y + 3 * 108 - 4 }}>
          +{extra}
        </span>
      )}
      {trip.hitos.slice(0, 3).map((h, i) => (
        <span key={h.id} role="img" aria-label={`Hito: ${h.hito}`} className="absolute block leading-[0]" style={{ left: planX + 6 + i * 58, top: planY + 108 }}>
          <HitoStamp hito={h.hito!} id={h.id} stampedAt={h.stamped_at} size={54} tilt={paisTilt(h.id) / 2} nuevo={h.nuevo} />
        </span>
      ))}
    </>
  );
}
