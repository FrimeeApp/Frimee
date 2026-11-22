/** Lógica pura de la libreta del pasaporte: lectura de sellos, estadísticas y reparto en páginas. Sin React. */

export type SelloKind = "plan" | "pais" | "hito";
export type HitoKind = "primer_viaje" | "pais_10" | "pais_25" | "pais_50" | "de_vuelta" | "viaje_largo" | "en_grupo" | "ruta";

export type SelloPlan = {
  titulo: string;
  ubicacion_nombre: string | null;
  inicio_at: string;
  fin_at: string;
  all_day: boolean;
};

export type Sello = {
  id: number;
  kind: SelloKind;
  country_code: string | null;
  hito: HitoKind | null;
  stamped_at: string; // yyyy-mm-dd
  plan_id: number;
  hidden: boolean;
  nuevo: boolean;
  plan: SelloPlan | null;
  /** Solo en el sello de plan y solo para su dueño: primer billete de transporte del viaje. */
  ruta?: { tipo: "flight" | "ferry" | "train"; desde: string; hasta: string } | null;
};

export type PasaporteAjustes = { passport_visibility: "TODOS" | "AMISTADES" | "SOLO_YO"; show_plan_stamps: boolean; show_companions: boolean };

export type PasaporteLeido = {
  puede_ver: boolean;
  es_mio: boolean;
  ajustes: PasaporteAjustes | null;
  sellos: Sello[];
};

/** Un viaje = lo que sella un mismo plan: el sello del plan, uno por país y los hitos que consigue. */
export type Trip = {
  planId: number;
  date: string; // fecha del sello del plan (o la más reciente si no hay)
  plan: Sello | null;
  paises: Sello[];
  hitos: Sello[];
  info: SelloPlan | null;
};

export type PassportPage =
  | { kind: "datos"; number: number }
  | { kind: "year"; number: number; year: number; trips: Trip[]; continues: boolean };

export const SLOTS_PER_PAGE = 3;
/** Un viaje ocupa una franja de la página; con 2 o más países, dos. Los hitos van dentro de su franja. */
export function tripSlots(t: Trip) {
  return t.paises.length >= 2 ? 2 : 1;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** yyyy-mm-dd → [año, mes0, día] sin pasar por zonas horarias. */
function ymd(d: string): [number, number, number] {
  const [y, m, day] = d.split("-").map(Number);
  return [y, m - 1, day];
}

export const dateLabel = (d: string) => {
  const [y, m, day] = ymd(d);
  return `${day} ${MONTHS[m]} ${y}`;
};
/** «25 NOV 26», para dentro del sello. */
export const stampDateLabel = (d: string) => {
  const [y, m, day] = ymd(d);
  return `${day} ${MONTHS[m].toUpperCase().slice(0, 3)} ${String(y).slice(2)}`;
};
export const monthYearLabel = (d: string) => {
  const [y, m] = ymd(d);
  return `${MONTHS[m]} ${y}`;
};

/** «21–25 NOV 2026» o «30 NOV – 2 DIC 2026» a partir de las fechas del plan (hora local). */
export function planRangeLabel(p: SelloPlan, short = false) {
  const a = new Date(p.inicio_at);
  const rawEnd = new Date(p.fin_at);
  // Un plan de día completo termina a las 00:00 del día siguiente al último.
  const b = p.all_day ? new Date(rawEnd.getTime() - 1) : rawEnd;
  const m = (d: Date) => MONTHS[d.getMonth()].toUpperCase().slice(0, 3);
  const text =
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
      ? a.getDate() === b.getDate()
        ? `${a.getDate()} ${m(a)}`
        : `${a.getDate()}–${b.getDate()} ${m(a)}`
      : `${a.getDate()} ${m(a)} – ${b.getDate()} ${m(b)}`;
  return short ? text : `${text} ${b.getFullYear()}`;
}

export function planDays(p: SelloPlan) {
  const a = new Date(p.inicio_at);
  const rawEnd = new Date(p.fin_at);
  const b = p.all_day ? new Date(rawEnd.getTime() - 1) : rawEnd;
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(1, Math.round((day(b) - day(a)) / 86_400_000) + 1);
}

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["es"], { type: "region" }) : null;
export function countryName(code: string) {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Número estable a partir de un id: la variación de cada sello sale de aquí, nunca del azar. */
export function hash(n: number, salt = 0) {
  let x = (Math.imul(n + 1, 2654435761) ^ Math.imul(salt + 7, 40503)) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export function groupTrips(sellos: Sello[]): Trip[] {
  const byPlan = new Map<number, Trip>();
  for (const s of sellos) {
    if (s.hidden) continue;
    let t = byPlan.get(s.plan_id);
    if (!t) {
      t = { planId: s.plan_id, date: s.stamped_at, plan: null, paises: [], hitos: [], info: s.plan };
      byPlan.set(s.plan_id, t);
    }
    if (s.plan && !t.info) t.info = s.plan;
    if (s.kind === "plan") {
      t.plan = s;
      t.date = s.stamped_at;
    } else if (s.kind === "pais") t.paises.push(s);
    else t.hitos.push(s);
    if (!t.plan && s.stamped_at > t.date) t.date = s.stamped_at;
  }
  const trips = [...byPlan.values()];
  for (const t of trips) t.paises.sort((a, b) => (a.stamped_at < b.stamped_at ? -1 : a.stamped_at > b.stamped_at ? 1 : a.id - b.id));
  return trips.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.planId - b.planId));
}

/** Página 1 = datos; luego un bloque por año y viajes por fecha, de más antiguo a más reciente, con 3 huecos por página. */
export function buildPages(trips: Trip[]): PassportPage[] {
  const pages: PassportPage[] = [{ kind: "datos", number: 1 }];
  const years = [...new Set(trips.map((t) => Number(t.date.slice(0, 4))))].sort((a, b) => a - b);
  for (const year of years) {
    let current: Trip[] = [];
    let used = 0;
    for (const t of trips.filter((x) => Number(x.date.slice(0, 4)) === year)) {
      const cost = tripSlots(t);
      if (used + cost > SLOTS_PER_PAGE && current.length) {
        pages.push({ kind: "year", number: pages.length + 1, year, trips: current, continues: true });
        current = [];
        used = 0;
      }
      current.push(t);
      used += cost;
    }
    if (current.length) pages.push({ kind: "year", number: pages.length + 1, year, trips: current, continues: false });
  }
  return pages;
}

export type PassportStats = {
  paises: number;
  planes: number;
  dias: number;
  lastStamp: { place: string; date: string } | null;
  porPais: { code: string; count: number }[];
  since: string | null;
};

export function computeStats(sellos: Sello[]): PassportStats {
  const vis = sellos.filter((s) => !s.hidden);
  const paises = new Set(vis.filter((s) => s.kind === "pais").map((s) => s.country_code!));
  const planStamps = vis.filter((s) => s.kind === "plan");
  const dias = planStamps.reduce((n, s) => n + (s.plan ? planDays(s.plan) : 0), 0);

  const real = vis.filter((s) => s.kind !== "hito");
  const last = [...real].sort((a, b) => (a.stamped_at < b.stamped_at ? 1 : a.stamped_at > b.stamped_at ? -1 : b.id - a.id))[0];
  const lastStamp = last
    ? {
        place: last.kind === "pais" && last.country_code ? countryName(last.country_code) : last.plan?.ubicacion_nombre?.split(",")[0]?.trim() || last.plan?.titulo || "Viaje",
        date: last.stamped_at,
      }
    : null;

  const count = new Map<string, { count: number; at: string }>();
  for (const s of vis) {
    if (s.kind !== "pais" || !s.country_code) continue;
    const c = count.get(s.country_code) ?? { count: 0, at: "" };
    c.count += 1;
    if (s.stamped_at > c.at) c.at = s.stamped_at;
    count.set(s.country_code, c);
  }
  const porPais = [...count.entries()].sort((a, b) => (a[1].at < b[1].at ? 1 : -1)).map(([code, v]) => ({ code, count: v.count }));

  const since = real.length ? real.reduce((m, s) => (s.stamped_at < m ? s.stamped_at : m), real[0].stamped_at) : null;
  return { paises: paises.size, planes: planStamps.length, dias, lastStamp, porPais, since };
}

/** Línea de máquina decorativa del pie de la página de datos. */
export function machineLines(nombre: string, stats: PassportStats) {
  const clean = nombre
    .replace(/-/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .trim()
    .split(/\s+/);
  const first = clean[0] ?? "";
  const rest = clean.slice(1).join("<");
  const pad = (s: string, n = 36) => (s + "<".repeat(n)).slice(0, n);
  const pp = String(stats.paises).padStart(2, "0");
  const since = stats.since ? stats.since.slice(2, 4) + stats.since.slice(5, 7) : "0000";
  return [pad(`P<FRM${rest || first}<<${rest ? first : ""}`), pad(`${pp}PAISES<<${stats.planes}PLANES<<${since}`)];
}

/** Interpreta el jsonb de fn_passport_leer. */
export function parsePasaporte(raw: unknown): PasaporteLeido {
  const r = (raw ?? {}) as Partial<PasaporteLeido>;
  return {
    puede_ver: Boolean(r.puede_ver),
    es_mio: Boolean(r.es_mio),
    ajustes: r.ajustes ?? null,
    sellos: Array.isArray(r.sellos) ? r.sellos : [],
  };
}

/** «Barcelona (BCN)» → «BCN»; un código suelto se queda; si no hay código, las 3 primeras letras de la ciudad. */
export function routeCode(label: string) {
  const t = label.trim();
  const inParens = /\(([A-Za-z]{3})\)/.exec(t);
  if (inParens) return inParens[1].toUpperCase();
  if (/^[A-Za-z]{3,4}$/.test(t)) return t.toUpperCase();
  const word = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z ]/g, "").trim().split(/\s+/)[0] ?? "";
  return word.slice(0, 3).toUpperCase();
}

/**
 * Líneas del nombre en la tapa, que es el sitio más estrecho. En orden de preferencia: nombre y apellido en una línea;
 * en dos; y si tampoco cabe, solo el nombre de pila. `cap` = letras que caben en una línea (nunca se encoge la letra).
 * Con varios nombres no se sabe dónde empiezan los apellidos: se usa la última palabra, que sí es apellido.
 */
export function coverNameLines(nombre: string, cap = 12): string[] {
  const words = nombre.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const first = words[0];
  const surname = words.length > 1 ? words[words.length - 1] : undefined;
  if (!surname) return [first];
  if (`${first} ${surname}`.length <= cap) return [`${first} ${surname}`];
  if (first.length <= cap && surname.length <= cap) return [first, surname];
  return [first];
}

/** Solo el nombre de pila, para textos como «Pasaporte de María» o «Coincidís en…». */
export function firstName(nombre: string) {
  return nombre.trim().split(/\s+/)[0] ?? "";
}

export type IndexData = {
  paises: { code: string; name: string; count: number; last: string; page: number | null; sello: Sello }[];
  planes: { titulo: string; page: number | null; sello: Sello }[];
  hitos: { page: number | null; sello: Sello }[];
  /** Viajes ocultos (su sello de plan; solo los ve su dueño), del más reciente al más antiguo. */
  ocultos: Sello[];
};

/** Índice en texto: cada país, plan e hito con su página. Incluye lo que la página no llega a enseñar (4.º país, 2.º hito…). */
export function buildIndex(sellos: Sello[], pages: PassportPage[]): IndexData {
  const tripPage = new Map<number, number>();
  for (const p of pages) if (p.kind === "year") for (const t of p.trips) tripPage.set(t.planId, p.number);
  const vis = sellos.filter((s) => !s.hidden);
  const byDateDesc = (a: Sello, b: Sello) => (a.stamped_at < b.stamped_at ? 1 : a.stamped_at > b.stamped_at ? -1 : b.id - a.id);

  const countries = new Map<string, { count: number; last: Sello; page: number | null }>();
  for (const s of [...vis].filter((x) => x.kind === "pais" && x.country_code).sort((a, b) => -byDateDesc(a, b))) {
    const code = s.country_code!;
    const c = countries.get(code);
    const page = tripPage.get(s.plan_id) ?? null;
    // La página de un país es la de su primer sello; el resto está en el pasaporte, pero un solo salto basta.
    countries.set(code, { count: (c?.count ?? 0) + 1, last: s, page: c?.page ?? page });
  }
  const paises = [...countries.entries()]
    .map(([code, c]) => ({ code, name: countryName(code), count: c.count, last: c.last.stamped_at, page: c.page, sello: c.last }))
    .sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0));

  const planes = vis
    .filter((s) => s.kind === "plan")
    .sort(byDateDesc)
    .map((s) => ({ titulo: s.plan?.titulo ?? "Viaje", page: tripPage.get(s.plan_id) ?? null, sello: s }));
  const hitos = vis
    .filter((s) => s.kind === "hito" && s.hito)
    .sort(byDateDesc)
    .map((s) => ({ page: tripPage.get(s.plan_id) ?? null, sello: s }));
  const ocultos = sellos.filter((s) => s.hidden && s.kind === "plan").sort(byDateDesc);
  return { paises, planes, hitos, ocultos };
}

/** «Tu 2.º sello de Portugal»: el lugar de este sello de país entre los tuyos de ese país, por fecha. */
export function countryOrdinal(sellos: Sello[], code: string, stampId: number): number {
  const all = sellos
    .filter((s) => !s.hidden && s.kind === "pais" && s.country_code === code)
    .sort((a, b) => (a.stamped_at < b.stamped_at ? -1 : a.stamped_at > b.stamped_at ? 1 : a.id - b.id));
  return all.findIndex((s) => s.id === stampId) + 1;
}
