import { countryName, hash, planRangeLabel, stampDateLabel, type HitoKind, type Sello } from "@/lib/passport";

/** Sellos del pasaporte. Siempre en tinta (--passport-ink); el sello nuevo usa --passport-ink-new. Sin filtros SVG. */

const SANS = "Inter, Arial, sans-serif";
const SERIF = "var(--font-display-face), Georgia, serif";

const ink = (nuevo?: boolean) => (nuevo ? "var(--passport-ink-new)" : "var(--passport-ink)");

/** Cortes irregulares en el trazo («tinta gastada»), fijos por id: cuestan lo mismo que un trazo liso. */
function worn(seed: number, circumference: number) {
  const a = 6 + (seed % 5);
  const b = 2 + ((seed >> 3) % 3);
  const parts: number[] = [];
  let used = 0;
  let i = 0;
  while (used < circumference - 20) {
    const on = circumference * (0.12 + (((seed >> (i % 12)) & 7) / 7) * 0.22);
    parts.push(Math.round(on * 10) / 10, i % 2 ? a : b);
    used += on + (i % 2 ? a : b);
    i++;
  }
  return parts.join(" ");
}

function starPoints(cx: number, cy: number, ro: number, ri: number, n: number) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? ri : ro;
    const a = (Math.PI * i) / n - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function ornament(kind: number, c: string) {
  // Se dibuja a ambos lados del código del país (y = 47), en el lugar de las rayitas.
  const side = (dir: 1 | -1) => {
    const x = dir === 1 ? 66 : 22;
    const sx = dir === 1 ? 1 : -1;
    switch (kind) {
      case 0:
        return <path key={dir} d={`M${x} 44h${8 * sx}M${x} 47h${8 * sx}M${x} 50h${8 * sx}`} stroke={c} strokeWidth="1" />;
      case 1:
        return <polygon key={dir} points={starPoints(x + 4 * sx, 47, 4, 1.7, 5)} fill={c} />;
      case 2:
        return (
          <g key={dir} fill={c}>
            {[0, 1, 2].map((k) => (
              <circle key={k} cx={x + (2 + k * 3) * sx} cy="47" r="1" />
            ))}
          </g>
        );
      default:
        return <path key={dir} d={`M${x} 49a5 5 0 0 ${dir === 1 ? 0 : 1} ${8 * sx} 0`} fill="none" stroke={c} strokeWidth="1" />;
    }
  };
  return [side(-1), side(1)];
}

function scallop(n: number, r: number, depth: number) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = (2 * Math.PI * i) / n;
    const a1 = (2 * Math.PI * (i + 1)) / n;
    const am = (a0 + a1) / 2;
    const p = (a: number, rr: number) => `${(48 + rr * Math.cos(a)).toFixed(1)} ${(48 + rr * Math.sin(a)).toFixed(1)}`;
    d += `${i === 0 ? "M" : "L"}${p(a0, r)} Q${p(am, r + depth)} ${p(a1, r)} `;
  }
  return `${d}Z`;
}

export function CountryStamp({
  sello,
  size = 104,
  tilt,
  nuevo = false,
  className,
  style,
}: {
  sello: Pick<Sello, "id" | "country_code" | "stamped_at">;
  size?: number;
  tilt: number;
  nuevo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const c = ink(nuevo);
  const seed = hash(sello.id, 1);
  const border = seed % 4; // liso, dentado, doble, punteado
  const orn = (seed >> 4) % 4; // rayas, estrellas, puntos, arco
  const code = sello.country_code ?? "";
  const name = countryName(code).toUpperCase();
  const nameSize = name.length > 14 ? 5.6 : name.length > 10 ? 6.4 : 7.5;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" className={className} style={{ transform: `rotate(${tilt}deg)`, flexShrink: 0, ...style }}>
      {border === 1 ? (
        <path d={scallop(36, 42, 2.4)} fill="none" stroke={c} strokeWidth="1.6" strokeDasharray={worn(seed, 276)} />
      ) : border === 3 ? (
        <circle cx="48" cy="48" r="43" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.1 4.6" />
      ) : (
        <circle cx="48" cy="48" r="44" fill="none" stroke={c} strokeWidth="2" strokeDasharray={worn(seed, 276)} />
      )}
      {border === 2 && <circle cx="48" cy="48" r="40.5" fill="none" stroke={c} strokeWidth="1" />}
      <circle cx="48" cy="48" r={border === 2 ? 36 : 37.5} fill="none" stroke={c} strokeWidth="1" strokeDasharray="2 3" />
      <text x="48" y="31" textAnchor="middle" fontFamily={SANS} fontSize={nameSize} fontWeight="700" letterSpacing="1.4" fill={c}>
        {name}
      </text>
      <text x="48" y="59" textAnchor="middle" fontFamily={SERIF} fontSize="32" fill={c}>
        {code}
      </text>
      {ornament(orn, c)}
      <text x="48" y="73" textAnchor="middle" fontFamily={SANS} fontSize="7" fontWeight="700" letterSpacing="1.2" fill={c}>
        {stampDateLabel(sello.stamped_at)}
      </text>
    </svg>
  );
}

export function PlanStamp({
  sello,
  size = 150,
  tilt,
  nuevo = false,
  className,
  style,
}: {
  sello: Pick<Sello, "id" | "plan">;
  size?: number;
  tilt: number;
  nuevo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const c = ink(nuevo);
  const seed = hash(sello.id, 2);
  const border = seed % 4; // base, perforado, esquinas, doble
  const plan = sello.plan;
  const title = plan?.titulo ?? "Viaje";
  const titleSize = title.length > 15 ? 17 : title.length > 11 ? 21 : 27;
  const shown = title.length > 20 ? `${title.slice(0, 19)}…` : title;
  const place = (plan?.ubicacion_nombre?.split(",")[0]?.trim() ?? "").toUpperCase();
  const placeShown = place.length > 16 ? `${place.slice(0, 15)}…` : place;
  return (
    <svg width={size} height={Math.round((size * 96) / 140)} viewBox="0 0 140 96" aria-hidden="true" className={className} style={{ transform: `rotate(${tilt}deg)`, flexShrink: 0, ...style }}>
      {border === 2 ? (
        <path d="M2 18V8a6 6 0 0 1 6-6h10M122 2h10a6 6 0 0 1 6 6v10M138 78v10a6 6 0 0 1-6 6h-10M18 94H8a6 6 0 0 1-6-6V78" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
      ) : (
        <rect x="2" y="2" width="136" height="92" rx="6" fill="none" stroke={c} strokeWidth="2" strokeDasharray={border === 1 ? "6 3" : worn(seed, 456)} />
      )}
      {border === 3 && <rect x="6" y="6" width="128" height="84" rx="4" fill="none" stroke={c} strokeWidth="1" />}
      <rect x={border === 3 ? 10 : 8} y={border === 3 ? 10 : 8} width={border === 3 ? 120 : 124} height={border === 3 ? 76 : 80} rx="3" fill="none" stroke={c} strokeWidth="1" strokeDasharray="3 3" />
      <g transform="translate(15 15) scale(0.62)" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </g>
      {placeShown && (
        <text x="36" y="26" fontFamily={SANS} fontSize="9.5" fontWeight="700" letterSpacing="1.2" fill={c}>
          {placeShown}
        </text>
      )}
      <text x="16" y="63" fontFamily={SERIF} fontSize={titleSize} fill={c}>
        {shown}
      </text>
      <text x="16" y="79" fontFamily={SANS} fontSize="8" fontWeight="700" letterSpacing="1.1" fill={c}>
        {plan ? planRangeLabel(plan) : ""}
      </text>
    </svg>
  );
}

const HITO_TEXT: Record<HitoKind, { big: string; label: string; sub?: string }> = {
  primer_viaje: { big: "1", label: "PRIMER", sub: "VIAJE" },
  pais_10: { big: "10", label: "PAÍSES" },
  pais_25: { big: "25", label: "PAÍSES" },
  pais_50: { big: "50", label: "PAÍSES" },
  de_vuelta: { big: "", label: "DE VUELTA" },
  viaje_largo: { big: "7+", label: "DÍAS" },
  en_grupo: { big: "8+", label: "EN GRUPO" },
  ruta: { big: "3+", label: "RUTA", sub: "PAÍSES" },
};

export const HITO_NAME: Record<HitoKind, string> = {
  primer_viaje: "Primer viaje",
  pais_10: "País n.º 10",
  pais_25: "País n.º 25",
  pais_50: "País n.º 50",
  de_vuelta: "De vuelta",
  viaje_largo: "Viaje largo",
  en_grupo: "En grupo",
  ruta: "Ruta",
};

/** Sellos de hito: formas que no usa ningún otro sello, para reconocerlos sin color. */
export function HitoStamp({ hito, id, stampedAt, size = 64, tilt = 0, nuevo = false, className, style }: { hito: HitoKind; id: number; stampedAt: string; size?: number; tilt?: number; nuevo?: boolean; className?: string; style?: React.CSSProperties }) {
  const c = ink(nuevo);
  const t = HITO_TEXT[hito];
  const seed = hash(id, 3);
  let shape: React.ReactNode;
  switch (hito) {
    case "primer_viaje":
      shape = <polygon points={starPoints(48, 48, 45, 39, 16)} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeDasharray={worn(seed, 560)} />;
      break;
    case "pais_10":
    case "pais_25":
    case "pais_50":
      shape = <polygon points={starPoints(48, 48, 44, 44, 5)} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />;
      break;
    case "de_vuelta":
      shape = <ellipse cx="48" cy="48" rx="45" ry="32" fill="none" stroke={c} strokeWidth="2" strokeDasharray={worn(seed, 260)} />;
      break;
    case "viaje_largo":
      shape = <polygon points="48,4 87,26 87,70 48,92 9,70 9,26" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />;
      break;
    case "en_grupo":
      shape = <path d="M48 4 86 16v30c0 22-16 38-38 46C26 84 10 68 10 46V16Z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeDasharray={worn(seed, 300)} />;
      break;
    case "ruta":
      shape = <path d="M6 22h84l-12 26 12 26H6l12-26Z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />;
      break;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" className={className} style={{ transform: `rotate(${tilt}deg)`, flexShrink: 0, ...style }}>
      {shape}
      {hito === "de_vuelta" ? (
        <g fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M30 40h30a8 8 0 0 1 0 16H36" />
          <path d="M42 48l-8 8 8 8" transform="translate(-4 -8)" />
        </g>
      ) : (
        <text x="48" y={t.sub ? 60 : 58} textAnchor="middle" fontFamily={SERIF} fontSize={t.sub ? 28 : t.big.length > 1 ? 32 : 36} fill={c}>
          {t.big}
        </text>
      )}
      <text x="48" y={hito === "de_vuelta" ? 74 : t.sub ? 31 : 70} textAnchor="middle" fontFamily={SANS} fontSize="9" fontWeight="700" letterSpacing="1.2" fill={c}>
        {t.label}
      </text>
      {t.sub && (
        <text x="48" y="72" textAnchor="middle" fontFamily={SANS} fontSize="9" fontWeight="700" letterSpacing="1.2" fill={c}>
          {t.sub}
        </text>
      )}
      <text x="48" y="84" textAnchor="middle" fontFamily={SANS} fontSize="7" fontWeight="700" letterSpacing="1" fill={c}>
        {stampDateLabel(stampedAt)}
      </text>
    </svg>
  );
}
