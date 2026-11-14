/**
 * Loader of the day route map: a route that draws itself between four numbered stops over
 * faint streets. Design: Claude Design canvas "Frimee · Carga del mapa de ruta"
 * (boards M1 mobile, D1 desktop, M2 full screen). Styles in styles/components/route-loader.css.
 */

type Variant = "embedded" | "fullscreen";

type RouteShape = {
  width: number;
  height: number;
  r: number;
  fontSize: number;
  segments: [string, string, string];
  stops: [number, number][];
};

// One route per size, as drawn on the canvas.
const ROUTES = {
  mobile: {
    width: 280, height: 150, r: 11, fontSize: 12,
    segments: ["M35 115 C55 70 80 45 110 42", "M110 42 C145 40 160 80 185 105", "M185 105 Q190 35 250 38"],
    stops: [[35, 115], [110, 42], [185, 105], [250, 38]],
  },
  desktop: {
    width: 400, height: 120, r: 11, fontSize: 12,
    segments: ["M30 85 C70 85 100 35 140 35", "M140 35 C190 35 210 85 260 85", "M260 85 Q300 5 370 35"],
    stops: [[30, 85], [140, 35], [260, 85], [370, 35]],
  },
  fullscreen: {
    width: 260, height: 300, r: 14, fontSize: 14,
    segments: ["M50 250 C110 250 170 235 190 190", "M190 190 C205 150 110 140 70 110", "M70 110 Q80 20 200 45"],
    stops: [[50, 250], [190, 190], [70, 110], [200, 45]],
  },
} satisfies Record<string, RouteShape>;

function gridPath(x0: number, y0: number, x1: number, y1: number, stepX: number, stepY: number) {
  const parts: string[] = [];
  for (let x = x0; x <= x1; x += stepX) parts.push(`M${x} ${y0} V${y1}`);
  for (let y = y0; y <= y1; y += stepY) parts.push(`M${x0} ${y} H${x1 + 2 * stepX}`);
  return parts.join(" ");
}

function StreetsBackground({ variant }: { variant: "mobile" | "desktop" | "fullscreen" }) {
  if (variant === "desktop") {
    return (
      <svg viewBox="0 0 560 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <path className="bg-water" strokeWidth="26" d="M-30 192 C168 168 336 221 590 158" />
        <rect className="bg-park" x="392" y="24" width="95" height="48" rx="10" />
        <rect className="bg-park" x="34" y="125" width="67" height="29" rx="8" />
        <path className="bg-r2" strokeWidth="1.5" transform="rotate(-14 280 120)" d={gridPath(-329, -489, 887, 729, 38, 46)} />
        <path className="bg-r1" strokeWidth="7" d="M-20 91 C168 72 336 110 580 82" />
        <path className="bg-r1" strokeWidth="7" d="M157 -20 C202 96 123 144 179 260" />
        <path className="bg-r1" strokeWidth="5" d="M308 260 L580 29" />
      </svg>
    );
  }
  if (variant === "fullscreen") {
    return (
      <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <path className="bg-water" strokeWidth="26" d="M-30 675 C117 591 234 776 420 557" />
        <rect className="bg-park" x="273" y="84" width="66" height="169" rx="10" />
        <rect className="bg-park" x="23" y="439" width="47" height="101" rx="8" />
        <path className="bg-r2" strokeWidth="1.5" transform="rotate(-14 195 422)" d={gridPath(-734, -507, 1090, 1351, 38, 46)} />
        <path className="bg-r1" strokeWidth="7" d="M-20 321 C117 253 234 388 410 287" />
        <path className="bg-r1" strokeWidth="7" d="M109 -20 C140 338 86 506 125 864" />
        <path className="bg-r1" strokeWidth="5" d="M215 864 L410 101" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 358 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <path className="bg-water" strokeWidth="26" d="M-30 240 C107 210 215 276 388 198" />
      <rect className="bg-park" x="251" y="30" width="61" height="60" rx="10" />
      <rect className="bg-park" x="21" y="156" width="43" height="36" rx="8" />
      <path className="bg-r2" strokeWidth="1.5" transform="rotate(-14 179 150)" d={gridPath(-288, -317, 624, 617, 38, 46)} />
      <path className="bg-r1" strokeWidth="7" d="M-20 114 C107 90 215 138 378 102" />
      <path className="bg-r1" strokeWidth="7" d="M100 -20 C129 120 79 180 115 320" />
      <path className="bg-r1" strokeWidth="5" d="M197 320 L378 36" />
    </svg>
  );
}

function AnimatedRoute({ shape }: { shape: RouteShape }) {
  const [s1, s2, s3] = shape.segments;
  const last = shape.stops[shape.stops.length - 1];
  return (
    <svg width={shape.width} height={shape.height} viewBox={`0 0 ${shape.width} ${shape.height}`} aria-hidden="true" focusable="false">
      <path className="rl-ghost" d={`${s1} ${s2} ${s3}`} />
      <g className="rl-group">
        <path className="rl-seg rl-s1" pathLength={100} d={s1} />
        <path className="rl-seg rl-s2" pathLength={100} d={s2} />
        <path className="rl-seg rl-s3 rl-air" pathLength={100} d={s3} />
        <circle className="rl-ring" cx={last[0]} cy={last[1]} r={shape.r} />
        {shape.stops.map(([x, y], i) => (
          <g key={i} className={`rl-mk rl-m${i + 1}`}>
            <circle cx={x} cy={y} r={shape.r} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={shape.fontSize}>{i + 1}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function Messages() {
  return (
    <p className="rl-msg" aria-hidden="true">
      <span className="rl-msg-a">Trazando la ruta del día…</span>
      <span className="rl-msg-b">Uniendo las paradas…</span>
    </p>
  );
}

export default function RouteMapLoader({ variant = "embedded" }: { variant?: Variant }) {
  return (
    <div className={`route-loader${variant === "fullscreen" ? " route-loader--fullscreen" : ""}`}>
      {variant === "fullscreen" ? (
        <>
          <div className="rl-bg"><StreetsBackground variant="fullscreen" /><div className="rl-veil" /></div>
          <div className="rl-inner"><AnimatedRoute shape={ROUTES.fullscreen} /><Messages /></div>
        </>
      ) : (
        <>
          {/* M1 below md, D1 from md: the embedded map is 300 px tall on phones, 240 px on desktop */}
          <div className="rl-bg md:hidden"><StreetsBackground variant="mobile" /><div className="rl-veil" /></div>
          <div className="rl-bg hidden md:block"><StreetsBackground variant="desktop" /><div className="rl-veil" /></div>
          <div className="rl-inner md:hidden"><AnimatedRoute shape={ROUTES.mobile} /><Messages /></div>
          <div className="rl-inner hidden md:flex"><AnimatedRoute shape={ROUTES.desktop} /><Messages /></div>
        </>
      )}
      <span className="sr-only" role="status">Cargando el mapa con la ruta del día</span>
    </div>
  );
}
