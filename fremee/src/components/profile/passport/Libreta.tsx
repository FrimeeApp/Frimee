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

  // Se abre por la última página sellada: la primera de las páginas de año (los viajes van del más reciente al más antiguo).
  const [index, setIndex] = useState(() => (pages.length > 1 ? 1 : 0));
  const [prev, setPrev] = useState<{ index: number; back: boolean } | null>(null);
  const curRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1.25, Math.max(0.6, el.clientWidth / W)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const goTo = useCallback(
    (to: number) => {
      if (to < 0 || to >= pages.length || to === index || busy.current) return;
      setPrev({ index, back: to < index });
      setIndex(to);
    },
    [index, pages.length],
  );

  useLayoutEffect(() => {
    if (!prev) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finish = () => {
      busy.current = false;
      setPrev(null);
    };
    busy.current = true;
    const cur = curRef.current;
    const out = prevRef.current;
    if (!cur || !out) return finish();
    let anim: Animation;
    if (reduced) {
      anim = cur.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "linear" });
    } else if (prev.back) {
      // Hacia atrás: la anterior se abre encima, desde el lomo.
      anim = cur.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: TURN_MS, easing: EASE_OUT });
    } else {
      anim = out.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: TURN_MS, easing: EASE_IN, fill: "forwards" });
    }
    anim.onfinish = finish;
    anim.oncancel = finish;
    return () => anim.cancel();
  }, [prev]);

  const page = pages[index];
  const activeYear = page.kind === "year" ? page.year : null;
  const jumpToYear = (y: number) => goTo(pages.findIndex((p) => p.kind === "year" && p.year === y));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goTo(index - 1);
    else if (e.key === "ArrowRight") goTo(index + 1);
  };

  const layer = (i: number, ref: React.Ref<HTMLDivElement> | undefined, z: number) => (
    <div ref={ref} className="absolute left-0 top-0" style={{ width: W, height: H, transformOrigin: "left center", zIndex: z }}>
      <PageView page={pages[i]} nombre={nombre} stats={stats} total={pages.length} />
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col" onKeyDown={onKey}>
      <nav aria-label="Saltar a" className="flex gap-2 overflow-x-auto pb-3 pt-1">
        <Chip active={page.kind === "datos"} onClick={() => goTo(0)}>
          Datos
        </Chip>
        {years.map((y) => (
          <Chip key={y} active={activeYear === y} onClick={() => jumpToYear(y)}>
            {y}
          </Chip>
        ))}
      </nav>

      <div ref={boxRef} className="w-full">
        <div className="relative" style={{ width: W * scale, height: H * scale }}>
          <div className="absolute left-0 top-0" style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {/* Hacia delante la saliente se cierra encima; hacia atrás la entrante se abre encima. */}
            {prev ? (
              <>
                {layer(prev.back ? prev.index : index, prev.back ? prevRef : curRef, 1)}
                {layer(prev.back ? index : prev.index, prev.back ? curRef : prevRef, 2)}
              </>
            ) : (
              layer(index, undefined, 1)
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pb-4 pt-3">
        <NavButton label="Página anterior" disabled={index === 0} onClick={() => goTo(index - 1)}>
          <ChevronLeft className="size-[22px]" aria-hidden />
        </NavButton>
        <span aria-live="polite" className="text-[14px] tabular-nums text-muted">
          Página {index + 1} de {pages.length}
        </span>
        <NavButton label="Página siguiente" disabled={index === pages.length - 1} onClick={() => goTo(index + 1)}>
          <ChevronRight className="size-[22px]" aria-hidden />
        </NavButton>
      </div>
    </div>
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

function PageView({ page, nombre, stats, total }: { page: PassportPage; nombre: string; stats: PassportStats; total: number }) {
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
