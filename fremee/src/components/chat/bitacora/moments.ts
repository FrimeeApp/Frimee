/**
 * «Moments» of the Bitácora (board k-momentos): messages whose texto is a JSON object with a
 * `type`. Polls and the trip summary already existed; phase 2 adds expenses, shared places,
 * plan cards and @frimee proposals. Everything here is pure (no React), so the chat, the
 * Messages list and the reply quote read the same thing.
 */

export type PollMoment = {
  type: "poll";
  question: string;
  options: string[];
  expires_at?: string;
  closed?: boolean;
  /** Copied into a plan's chat (closed, results as they were then). */
  copiada_at?: string;
  // Saved by fn_poll_close / the automatic close (migration 20261116000001, board po-sistema).
  resultado?: "decidida" | "empate" | "sin_votos";
  ganadora?: number;
  empatadas?: number[];
  votos?: number[];
  total?: number;
  closed_at?: string;
  /** Who closed it; absent when it closed itself because everybody voted. */
  closed_by?: string;
  closed_by_nombre?: string;
  cierre?: "manual" | "auto";
  /** «Decidir yo» after a tie. */
  decidida_por?: string;
  decidida_por_nombre?: string;
  decidida_at?: string;
  /** How a tie was settled: «Decidir yo» or the server's draw («Sortear»). */
  decision?: "manual" | "sorteo";
  /** «Reabrir para Lucía y Marcos»: open again, votes kept. */
  reabierta_at?: string;
  reabierta_por?: string;
  reabierta_por_nombre?: string;
  /** The tie-break poll created from this one, and the poll this one breaks the tie of. */
  desempate_id?: number;
  desempate_de?: number;
  desempate_de_at?: string;
};

/** A poll was closed or decided: never drawn in the Bitácora, it feeds the Messages list. */
export type PollClosedMoment = {
  type: "poll_cerrada";
  poll_id: number;
  resultado: "decidida" | "empate" | "sin_votos" | "reabierta";
  texto: string;
  /** «reabierta»: the question and who it was reopened for (a line at the end of the chat). */
  pregunta?: string;
  para?: Array<{ id: string; nombre: string }>;
};

export type TripSummaryMoment = {
  type: "resumen_viaje";
  total: number;
  por_persona: number;
  num_miembros: number;
  top_pagador: string | null;
  top_pagador_importe: number | null;
  deudas_pendientes: number;
  actividades: number;
};

export type ExpenseMoment = {
  type: "gasto";
  titulo: string;
  total: number;
  pagado_por_nombre: string;
  /** People it is split between; equal parts. */
  participantes: number;
};

export type PlaceMoment = {
  type: "lugar";
  nombre: string;
  direccion?: string | null;
  lat: number;
  lng: number;
};

export type CardKind = "plan" | "vuelo" | "barco" | "tren" | "bus" | "alojamiento" | "restaurante" | "actividad";

/** A plan or one of its items, as a snapshot (the card still reads well if the item changes). */
export type CardMoment = {
  type: "tarjeta";
  kind: CardKind;
  plan_id: number;
  plan_titulo: string;
  subplan_id?: number | null;
  titulo: string;
  inicio_at: string;
  fin_at: string;
  all_day?: boolean;
  lugar?: string | null;
  lugar_fin?: string | null;
  duracion?: string | null;
  foto?: string | null;
  /** Plan invitations: whoever receives the card joins with this code (/join/<code>). */
  join_code?: string | null;
};

export type ProposalKind = "gasto" | "encuesta" | "tarea" | "actividad";

/** A plan-changing answer of @frimee: nothing happens until a member accepts it. */
export type ProposalMoment = {
  type: "propuesta";
  kind: ProposalKind;
  /** What @frimee says, above the proposal block. */
  reply: string;
  /** Block title and detail line (board: «Calzada Romana · sábado 29, 10:00»). */
  titulo: string;
  detalle: string;
  /** The internal command @frimee returned (kept for the record). */
  command: string;
  /** Parsed when it was proposed, so accepting runs exactly what was shown. */
  payload?: Record<string, unknown>;
  /** Who asked @frimee: the line «Lucía añadió …» names whoever accepted instead. */
  pedida_por?: string;
  estado: "pendiente" | "aceptada" | "descartada";
  resuelta_por?: string;
  resuelta_por_nombre?: string;
  resuelta_at?: string;
  resultado?: string | null;
  /** Copied into a plan's chat while pending: shown as copied, never acceptable there. */
  copia?: boolean;
};

/**
 * The mark something added to the plan from the chat leaves on the spine (board g-proponer «Añadir
 * directo»): «Añadiste «Taberna da Rua» al plan · Día 2, 21:00». A decided milestone of the ruler.
 */
export type PlanMarkMoment = {
  type: "hito_plan";
  subplan_id: number;
  plan_id: number;
  plan_titulo: string | null;
  titulo: string;
  tipo?: string | null;
  inicio_at: string;
  lugar?: string | null;
  origen_id?: number | null;
};

/**
 * «Antes del plan» (boards cp-m-plan, cp-sistema): the first entry of a plan's chat made from another
 * chat. The copied messages below keep their author and real date.
 */
export type CopyMoment = {
  type: "copia_chat";
  origen_chat_id: string;
  origen_nombre: string;
  copiados: number;
  copiado_at: string;
};

/** «Plan creado» (boards cp-m-grupo, cp-m-plan): in the original chat and closing the copied part. */
export type PlanCreatedMoment = {
  type: "plan_creado";
  plan_id: number;
  titulo: string;
  inicio_at: string;
  fin_at: string;
  creador_id: string;
  creador_nombre: string;
  miembros: Array<{ id: string; nombre: string }>;
  copiados: number;
  origen_chat_id: string;
  origen_nombre: string;
  /** The message the plan was made from (its diamond goes away); null from the header. */
  origen_mensaje_id?: number | null;
};

/**
 * A line in the chat when the group changes (board gi-sistema): someone renamed it, added, removed
 * or left. Written by the database (fn_chat_renombrar, fn_chat_quitar_miembro, fn_chat_aviso_gente).
 */
export type NoticeMoment = {
  type: "aviso";
  clase: "renombrado" | "quitado" | "anadido" | "salio" | "unio";
  actor_id: string;
  actor_nombre: string;
  /** renombrado: the new name. */
  nombre?: string;
  /** quitado / anadido / salio: who. */
  user_id?: string;
  user_nombre?: string;
  /** Where (fn_chat_aviso_gente since 2.33): «del plan» in plan chats. Older notices: grupo. */
  en?: "plan" | "grupo";
};

/**
 * A message deleted for everyone (fn_mensaje_eliminar): by its author or by an admin. «bloqueado»
 * never comes from the database: it is how a group message from someone I blocked is drawn.
 */
export type DeletedMoment = {
  type: "eliminado";
  por: "autor" | "admin" | "bloqueado";
};

export type Moment = PollMoment | TripSummaryMoment | ExpenseMoment | PlaceMoment | CardMoment | ProposalMoment | PlanMarkMoment | CopyMoment | PlanCreatedMoment | NoticeMoment | DeletedMoment | PollClosedMoment;

const TYPES = new Set(["poll", "resumen_viaje", "gasto", "lugar", "tarjeta", "propuesta", "hito_plan", "copia_chat", "plan_creado", "aviso", "eliminado", "poll_cerrada"]);

/** The moment inside a message's texto, or null for plain text. Never throws. */
export function parseMoment(texto: string | null | undefined): Moment | null {
  if (!texto || texto[0] !== "{") return null;
  try {
    const parsed = JSON.parse(texto) as { type?: unknown };
    return typeof parsed?.type === "string" && TYPES.has(parsed.type) ? (parsed as Moment) : null;
  } catch {
    return null;
  }
}

export const formatEuros = (n: number) =>
  `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const CARD_LABEL: Record<CardKind, string> = {
  plan: "Plan",
  vuelo: "Vuelo",
  barco: "Barco",
  tren: "Tren",
  bus: "Autobús",
  alojamiento: "Alojamiento",
  restaurante: "Restaurante",
  actividad: "Actividad",
};
export const cardLabel = (kind: CardKind) => CARD_LABEL[kind] ?? "Plan";

/** One line for the Messages list, the reply quote and the pinned bar. */
export function momentPreview(texto: string | null | undefined): string | null {
  const m = parseMoment(texto);
  if (!m) return null;
  switch (m.type) {
    case "poll": return `Encuesta · ${m.question}`;
    case "resumen_viaje": return "Resumen del viaje";
    case "gasto": return `Gasto · ${m.titulo} · ${formatEuros(m.total)}`;
    case "lugar": return `Sitio · ${m.nombre}`;
    case "tarjeta": return m.kind === "plan" ? `Invitación · ${m.titulo}` : `${cardLabel(m.kind)} · ${m.titulo}`;
    case "propuesta": return `Frimee propone · ${m.titulo}`;
    case "hito_plan": return `Añadido al plan · ${m.titulo}`;
    case "copia_chat": return `Conversación copiada de «${m.origen_nombre}»`;
    case "plan_creado": return `Plan creado · ${m.titulo}`;
    case "aviso": return noticeText(m);
    case "eliminado": return deletedText(m);
    case "poll_cerrada": return m.texto;
  }
}

/** «Ana cambió el nombre a «Lisboa»», «Álex añadió a Marcos»… (meId: second person when it is you). */
export function noticeText(m: NoticeMoment, meId?: string): string {
  // When it is you, in second person: «Cambiaste el nombre…», «Ana te añadió».
  const yo = m.actor_id === meId;
  const aMi = m.user_id === meId;
  const quien = m.user_nombre ?? "alguien";
  const donde = m.en === "plan" ? "del plan" : "del grupo";
  switch (m.clase) {
    case "renombrado": return yo ? `Cambiaste el nombre a «${m.nombre ?? ""}»` : `${m.actor_nombre} cambió el nombre a «${m.nombre ?? ""}»`;
    case "anadido": return aMi ? `${m.actor_nombre} te añadió` : yo ? `Añadiste a ${quien}` : `${m.actor_nombre} añadió a ${quien}`;
    case "quitado": return aMi ? `${m.actor_nombre} te quitó ${donde}` : yo ? `Quitaste a ${quien} ${donde}` : `${m.actor_nombre} quitó a ${quien} ${donde}`;
    case "salio": return aMi ? `Saliste ${donde}` : `${m.user_nombre ?? "Alguien"} salió ${donde}`;
    case "unio": return aMi ? "Te uniste al plan" : `${m.user_nombre ?? "Alguien"} se unió al plan`;
  }
}

export const deletedText = (m: DeletedMoment) =>
  m.por === "admin" ? "El admin eliminó este mensaje"
    : m.por === "bloqueado" ? "Mensaje de una persona bloqueada"
    : "Se eliminó este mensaje";

/** Text the bot history sends back to @frimee: what it said, never the JSON. */
export function momentAsAssistantText(texto: string): string | null {
  const m = parseMoment(texto);
  if (m?.type === "propuesta") return m.reply;
  return null;
}
