/**
 * Which messages @frimee reads for «Añadir al plan» / «Registrar como gasto» (chat-sugerencias).
 * The same cheap filter runs in the edge function: only messages with a number, a date or day, a
 * destination or plan / payment words can hold an activity or an expense, so «Me vale» or «jajaja»
 * never cost a call.
 */
const HINT = /\d|€|\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[ñn]ana|pasado|finde|fin de semana|semana que viene|mes que viene|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|navidad|puente|verano|viaje|escapada|vacaciones|reserv\w*|cena\w*|comida|comer|desayun\w*|quedamos|vamos|propongo|plan|excursi\w*|ruta|visita\w*|entradas?|billetes?|vuelos?|tren|hotel|apartamento|casa rural|concierto|museo|playa|pagu[eé]|pagado|bizum)\b/i;

type Candidate = { id: number; tipo?: string | null; texto?: string | null; audio_url?: string | null; image_url?: string | null; document_url?: string | null };

/** A person's plain text that may hold an activity or an expense. */
export function isSuggestionCandidate(m: Candidate): boolean {
  const texto = (m.texto ?? "").trim();
  return m.id > 0
    && (m.tipo ?? "text") === "text"
    && !m.audio_url && !m.image_url && !m.document_url
    && !texto.startsWith("{")
    && texto.length >= 6
    && HINT.test(texto);
}
