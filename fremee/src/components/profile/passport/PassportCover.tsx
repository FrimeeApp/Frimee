import { coverNameLines } from "@/lib/passport";

/** Tapa del pasaporte (tableros «Pasaporte · la libreta»). Objeto con tapa propia: siempre oscura, también en tema claro. */

const BASE_W = 132;
const BASE_H = 185;

export function PassportCover({
  name,
  width = BASE_W,
  tilt = -3,
  loading = false,
  className = "",
}: {
  /** Nombre en mayúsculas al pie; sin nombre (mini, cargando) no se pinta. */
  name?: string;
  width?: number;
  tilt?: number;
  loading?: boolean;
  className?: string;
}) {
  const k = width / BASE_W;
  const px = (n: number) => Math.round(n * k * 10) / 10;
  return (
    <div
      aria-hidden="true"
      className={`relative flex shrink-0 flex-col items-center justify-between rounded-[8px] text-[var(--passport-foil)] shadow-md ${loading ? "animate-pulse motion-reduce:animate-none motion-reduce:opacity-70" : ""} ${className}`}
      style={{
        width,
        height: px(BASE_H),
        background: "var(--passport-cover)",
        borderLeft: `${px(7)}px solid var(--passport-spine)`,
        transform: `rotate(${tilt}deg)`,
        padding: `${px(15)}px ${px(9)}px ${px(13)}px`,
        boxSizing: "border-box",
      }}
    >
      <span className="font-bold leading-none" style={{ fontSize: px(12), letterSpacing: "0.22em" }}>FRIMEE</span>
      <span className="flex flex-col items-center" style={{ gap: px(8) }}>
        <svg width={px(55)} height={px(55)} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0">
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
        <span className="[font-family:var(--font-display-face)] leading-none" style={{ fontSize: px(25) }}>Pasaporte</span>
      </span>
      <span className="flex flex-col items-center" style={{ gap: px(6) }}>
        {name ? (
          <span className="text-center font-semibold leading-[1.2]" style={{ fontSize: px(12), letterSpacing: "0.08em" }}>
            {coverNameLines(name).map((l) => (
              <span key={l} className="block">{l.toUpperCase()}</span>
            ))}
          </span>
        ) : null}
        <span className="box-border rounded-[3px] border-[1.5px] border-current" style={{ width: px(17), height: px(11) }} />
      </span>
    </div>
  );
}

/** Sello de plan «fantasma» de un viaje que aún no ha terminado (tablero «Con planes, sin sellos»). */
export function GhostPlanStamp({ place, dates, className = "" }: { place: string; dates: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`rounded-[8px] border-[1.5px] border-dashed border-[var(--border-strong)] p-1 leading-[0] ${className}`}
    >
      <svg width="93" height="64" viewBox="0 0 140 96" className="shrink-0 text-[var(--text-secondary)] opacity-60">
        <rect x="2" y="2" width="136" height="92" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="8" y="8" width="124" height="80" rx="3" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
        <text x="16" y="45" fontFamily="var(--font-display-face), Georgia, serif" fontSize="27" fill="currentColor">
          {place.length > 11 ? `${place.slice(0, 10)}…` : place}
        </text>
        <text x="16" y="72" fontFamily="Inter, Arial, sans-serif" fontSize="8" fontWeight="700" letterSpacing="1.1" fill="currentColor">
          {dates}
        </text>
      </svg>
    </span>
  );
}
