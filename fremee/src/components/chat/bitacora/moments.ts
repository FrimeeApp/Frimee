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
};

export type Moment = PollMoment | TripSummaryMoment | ExpenseMoment | PlaceMoment | CardMoment | ProposalMoment;

const TYPES = new Set(["poll", "resumen_viaje", "gasto", "lugar", "tarjeta", "propuesta"]);

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
    case "tarjeta": return `${cardLabel(m.kind)} · ${m.titulo}`;
    case "propuesta": return `Frimee propone · ${m.titulo}`;
  }
}

/** Text the bot history sends back to @frimee: what it said, never the JSON. */
export function momentAsAssistantText(texto: string): string | null {
  const m = parseMoment(texto);
  if (m?.type === "propuesta") return m.reply;
  return null;
}
