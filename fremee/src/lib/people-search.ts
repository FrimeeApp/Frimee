/** Lógica pura del buscador de personas (sin React ni red): agrupar, texto de contexto y coincidencia. */

export type Relacion = "amigos" | "pendiente" | "ninguna";

/** Una fila de fn_users_buscar_contexto. */
export type PersonaBusqueda = {
  id: string;
  nombre: string;
  username: string | null;
  profile_image: string | null;
  relacion: Relacion;
  amigos_comun: number;
  /** Nombres de pila de hasta 3 amigos en común. */
  nombres_comun: string[];
  planes_juntos: number;
  plan_titulo: string | null;
  /** Fecha de alta en Frimee. */
  desde: string;
};

export type SeccionClave = "amigos" | "conoces" | "mas" | "viajan";

export type Seccion = { clave: SeccionClave; titulo: string; personas: PersonaBusqueda[] };

const TITULOS: Record<SeccionClave, string> = {
  amigos: "Tus amigos",
  conoces: "Puede que conozcas",
  mas: "Más personas en Frimee",
  viajan: "Viajan contigo",
};

/** Con texto escrito: amigos primero, luego quien tiene algo en común o una solicitud, luego el resto. */
export function agruparResultados(personas: PersonaBusqueda[]): Seccion[] {
  const amigos: PersonaBusqueda[] = [];
  const conoces: PersonaBusqueda[] = [];
  const mas: PersonaBusqueda[] = [];
  for (const p of personas) {
    if (p.relacion === "amigos") amigos.push(p);
    else if (p.relacion === "pendiente" || p.amigos_comun > 0 || p.planes_juntos > 0) conoces.push(p);
    else mas.push(p);
  }
  return ([
    { clave: "amigos", titulo: TITULOS.amigos, personas: amigos },
    { clave: "conoces", titulo: TITULOS.conoces, personas: conoces },
    { clave: "mas", titulo: TITULOS.mas, personas: mas },
  ] as Seccion[]).filter((s) => s.personas.length > 0);
}

/** Sin texto: quien viaja contigo y todavía no es amigo. */
export function seccionViajan(personas: PersonaBusqueda[]): Seccion | null {
  return personas.length > 0 ? { clave: "viajan", titulo: TITULOS.viajan, personas } : null;
}

/** «Tus amigos · 2» */
export function cabeceraSeccion(s: Seccion): string {
  return s.clave === "viajan" ? s.titulo : `${s.titulo} · ${s.personas.length}`;
}

export type TipoContexto = "amigos" | "comun" | "plan" | "pendiente" | "desde";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «jun 2026» */
export function formatearDesde(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function listaNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/** Qué es esa persona para ti, en una línea. Una sola cosa: la más cercana. */
export function contexto(p: PersonaBusqueda): { tipo: TipoContexto; texto: string } {
  if (p.relacion === "amigos") {
    const planes = p.planes_juntos > 0 ? ` · ${p.planes_juntos} ${p.planes_juntos === 1 ? "plan" : "planes"} juntos` : "";
    return { tipo: "amigos", texto: `Amigos${planes}` };
  }
  if (p.relacion === "pendiente") return { tipo: "pendiente", texto: "Solicitud pendiente" };
  if (p.amigos_comun > 0) {
    const n = p.amigos_comun;
    const base = `${n} ${n === 1 ? "amigo" : "amigos"} en común`;
    const nombres = p.nombres_comun.length === n && n <= 3 ? `: ${listaNombres(p.nombres_comun)}` : "";
    return { tipo: "comun", texto: base + nombres };
  }
  if (p.planes_juntos > 0 && p.plan_titulo) {
    const mas = p.planes_juntos > 1 ? ` y ${p.planes_juntos - 1} más` : "";
    return { tipo: "plan", texto: `Viene a ${p.plan_titulo}${mas}` };
  }
  const desde = formatearDesde(p.desde);
  return { tipo: "desde", texto: desde ? `En Frimee desde ${desde}` : "En Frimee" };
}

const plegar = (c: string) => c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Parte un texto en antes / coincidencia / después, sin distinguir mayúsculas ni tildes. */
export function partirCoincidencia(texto: string, consulta: string): { pre: string; hit: string; post: string; ok: boolean } {
  const q = Array.from(consulta.trim()).map(plegar).join("");
  const chars = Array.from(texto);
  const plegado = chars.map(plegar).join("");
  const i = q ? plegado.indexOf(q) : -1;
  if (i < 0) return { pre: texto, hit: "", post: "", ok: false };
  const n = Array.from(q).length;
  return { pre: chars.slice(0, i).join(""), hit: chars.slice(i, i + n).join(""), post: chars.slice(i + n).join(""), ok: true };
}

/** Color estable de las iniciales (0..5) según la persona. */
export function tinte(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 6;
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const a = Array.from(partes[0])[0] ?? "";
  const b = partes.length > 1 ? (Array.from(partes[1])[0] ?? "") : "";
  return (a + b).toUpperCase();
}
