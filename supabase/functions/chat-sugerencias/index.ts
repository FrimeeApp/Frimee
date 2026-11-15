// chat-sugerencias: what @frimee sees in chat messages, so the chat only offers «Añadir al plan»
// (rombo, P) and «Registrar como gasto» (G) where they make sense, with the sheet already filled in.
//
// POST { chat_id, mensaje_ids: number[] } with the user's access token. Text messages of that chat
// not analysed yet are classified in one call to Claude (structured output: always valid JSON) and
// stored in mensaje_sugerencias, once per message for every member. Returns the suggestions of the
// requested messages (new and stored).
//
// POST { chat_id, completar: mensaje_id }: see completar() below (the panel's on-demand reading).
// POST { chat_id, plan_nuevo: true }: see planNuevo() below («Crear plan» from a chat).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_IDS = 60;
const MIN_LENGTH = 6;

/**
 * Cheap filter before the model (also in the app, src/components/chat/bitacora/sugerencias.ts):
 * only messages with a number, a date or day, a destination or plan / payment words can hold an
 * activity or an expense. «Me vale», «jajaja» or «¿Quién lleva el cargador?» never reach the model.
 */
const HINT = /\d|€|\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[ñn]ana|pasado|finde|fin de semana|semana que viene|mes que viene|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|navidad|puente|verano|viaje|escapada|vacaciones|reserv\w*|cena\w*|comida|comer|desayun\w*|quedamos|vamos|propongo|plan|excursi\w*|ruta|visita\w*|entradas?|billetes?|vuelos?|tren|hotel|apartamento|casa rural|concierto|museo|playa|pagu[eé]|pagado|bizum)\b/i;
const TIPOS = ["VUELO", "TREN", "BUS", "BARCO", "COCHE", "HOTEL", "RESTAURANTE", "ACTIVIDAD", "OTRO"] as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

type Plan = { es_plan: boolean; titulo: string; fecha: string; hora: string; lugar: string; tipo: string };
type Gasto = { es_gasto: boolean; concepto: string; importe: number };
type Item = { id: number; plan: Plan; gasto: Gasto };

// Every field is required and nothing is null: the model fills "" or 0 when there is nothing.
const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          plan: {
            type: "object",
            properties: {
              es_plan: { type: "boolean" },
              titulo: { type: "string" },
              fecha: { type: "string" },
              hora: { type: "string" },
              lugar: { type: "string" },
              tipo: { type: "string", enum: [...TIPOS] },
            },
            required: ["es_plan", "titulo", "fecha", "hora", "lugar", "tipo"],
            additionalProperties: false,
          },
          gasto: {
            type: "object",
            properties: {
              es_gasto: { type: "boolean" },
              concepto: { type: "string" },
              importe: { type: "number" },
            },
            required: ["es_gasto", "concepto", "importe"],
            additionalProperties: false,
          },
        },
        required: ["id", "plan", "gasto"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const SYSTEM = `Eres el asistente de Frimee, una app para organizar viajes en grupo. Lees mensajes de un chat y decides, para cada uno, si se puede convertir en una actividad del plan o en un gasto compartido.

El primer párrafo del mensaje del usuario dice si el chat es de un plan (un viaje) o un chat sin plan (un grupo o una conversación de dos).

En un chat SIN plan las reglas son más estrictas:
- es_plan solo para propuestas de salir o viajar más adelante con una fecha o un destino: «¿Y si el finde del 28 nos escapamos a la sierra?», «Lisboa en diciembre». titulo será el nombre del plan («Escapada a la sierra»), lugar el destino y fecha el primer día.
- Lo inmediato o casual no cuenta: «¿Te vienes a por un café? Estoy aquí», «cenamos hoy en casa».
- es_gasto siempre false: no hay plan donde apuntarlo.

En un chat DE plan:
Actividad del plan (es_plan = true) solo si el mensaje propone o confirma algo concreto que hacer, con al menos un sitio, un día o una hora: una cena en un restaurante, una visita, una reserva, un trayecto. Por ejemplo «Propongo el Time Out Market para comer el primer día» o «He reservado mesa para el fado el segundo día a las 20:30».
No es actividad: opiniones, confirmaciones sueltas («Me vale», «Pues decidido»), preguntas abiertas sin propuesta, saludos, logística sin un plan concreto («¿Quién lleva el cargador?»).
- titulo: corto y claro, como en una agenda («Cena con fado en Alfama»), sin fechas.
- fecha: YYYY-MM-DD si el mensaje la da o se deduce («el segundo día», «el sábado») con las fechas del viaje y la del mensaje; si no, "".
- hora: HH:MM en 24 h si aparece; si no, "".
- lugar: nombre del sitio si aparece; si no, "".
- tipo: el que mejor encaje; ACTIVIDAD si dudas.

Gasto (es_gasto = true) solo si el mensaje dice que alguien HA PAGADO algo concreto para el grupo, con un importe: «Ya he pagado el hotel, 480 €», «Pagué la cena, 120 €». No es un gasto: un precio informativo («unos 128 € por persona»), un presupuesto o el dinero que cada uno lleva («para propinas, 50 € cada uno»), lo que algo va a costar o lo que alguien debe.
- concepto: corto («Hotel 3 noches»).
- importe: el total en euros como número; si es por persona y sabes cuántos sois, multiplícalo; si no, el número que aparezca.

Cuando algo no aplica, deja es_plan o es_gasto en false, los textos en "" y el importe en 0. Incluye en items SOLO los mensajes en los que haya una actividad o un gasto, con su mismo id; omite todos los demás (la respuesta debe ser lo más corta posible).`;

// ── completar: one activity from a message AND the conversation around it ────
// POST { chat_id, completar: mensaje_id } when someone opens «Añadir al plan»: a time in one message
// and the place in the next, or a debate about the time, need the messages around. Only on demand
// (one small call per opened panel), never stored.

/** Context window: up to 30 messages before (within 3 h) and 10 after (within 2 h). */
const CTX_BEFORE = 30;
const CTX_AFTER = 10;
const CTX_BEFORE_MS = 3 * 3600_000;
const CTX_AFTER_MS = 2 * 3600_000;

type PlanCompleto = Plan & { hora_fin: string };
const SCHEMA_COMPLETAR = {
  type: "object",
  properties: {
    es_plan: { type: "boolean" },
    titulo: { type: "string" },
    fecha: { type: "string" },
    hora: { type: "string" },
    hora_fin: { type: "string" },
    lugar: { type: "string" },
    tipo: { type: "string", enum: [...TIPOS] },
  },
  required: ["es_plan", "titulo", "fecha", "hora", "hora_fin", "lugar", "tipo"],
  additionalProperties: false,
};
const SYSTEM_COMPLETAR = `Eres el asistente de Frimee, una app para organizar viajes en grupo. Alguien quiere añadir al plan la actividad de un mensaje del chat. Te paso ese mensaje (la línea que empieza por «ESTE») y la conversación de alrededor, en orden.
Rellena la actividad con lo que diga ESTE mensaje y complétala con la conversación: a menudo la hora va en un mensaje y el sitio en el siguiente, o el día se dijo antes.
Una propuesta cuenta aunque sea una pregunta y nadie haya contestado todavía: «¿Os va bien sobre las 9 de la noche?» → hora 21:00. La persona revisa la sugerencia antes de guardarla.
Si se propusieron valores distintos para un dato (varias horas o varios sitios), usa el ÚLTIMO en el que se pusieron de acuerdo, o el último propuesto si nadie lo rechazó. Deja el campo en "" solo si hay propuestas enfrentadas sin resolver («a las 20» / «no, mejor 22» / «yo no puedo antes de las 23»). No mezcles datos de otra actividad distinta de la de ESTE mensaje.
Las horas dichas en palabras pásalas a 24 h: «las 9 de la noche» → 21:00, «a mediodía» → 12:00, «las 3 de la tarde» → 15:00.
- es_plan: false solo si ni con la conversación hay una actividad concreta.
- titulo: corto y claro, como en una agenda («Cena con fado en Alfama»), sin fechas.
- fecha: YYYY-MM-DD si se dice o se deduce («el segundo día», «el sábado», «mañana») con las fechas del viaje y las de los mensajes; si no, "".
- hora: inicio, HH:MM en 24 h; si no, "".
- hora_fin: solo si se dice cuándo termina («de 10 a 12», «hasta las 14»); si no, "".
- lugar: nombre del sitio; si no, "".
- tipo: el que mejor encaje; ACTIVIDAD si dudas.`;

type MsgRow = { id: number; texto: string; created_at: string; sender_id: string | null; tipo: string };

async function completar(supabase: ReturnType<typeof createClient>, chat_id: string, mensajeId: number): Promise<Response> {
  const cols = "id, texto, created_at, sender_id, tipo";
  const { data: msg } = await supabase.from("mensajes").select(cols).eq("chat_id", chat_id).eq("id", mensajeId).maybeSingle();
  if (!msg) return jsonResponse({ error: "Mensaje no encontrado" }, 404);
  const t = new Date((msg as MsgRow).created_at).getTime();
  const [{ data: before }, { data: after }] = await Promise.all([
    supabase.from("mensajes").select(cols).eq("chat_id", chat_id).lt("id", mensajeId)
      .gte("created_at", new Date(t - CTX_BEFORE_MS).toISOString()).order("id", { ascending: false }).limit(CTX_BEFORE),
    supabase.from("mensajes").select(cols).eq("chat_id", chat_id).gt("id", mensajeId)
      .lte("created_at", new Date(t + CTX_AFTER_MS).toISOString()).order("id", { ascending: true }).limit(CTX_AFTER),
  ]);
  // People's text only around it (no moments JSON, calls or @frimee).
  const isText = (m: MsgRow) => m.tipo === "text" && Boolean(m.sender_id) && !m.texto.startsWith("{");
  const rows: MsgRow[] = [...((before ?? []) as MsgRow[]).reverse(), msg as MsgRow, ...((after ?? []) as MsgRow[])]
    .filter((m) => m.id === mensajeId || isText(m));

  const { data: chat } = await supabase.from("chat").select("plan_id").eq("id", chat_id).maybeSingle();
  let viaje = "Chat SIN plan (un grupo o una conversación de dos).";
  if (chat?.plan_id) {
    const { data: plan } = await supabase.from("plan").select("titulo, inicio_at, fin_at, ubicacion_nombre").eq("id", chat.plan_id).maybeSingle();
    if (plan) viaje = `Chat DE plan: viaje «${plan.titulo}» a ${plan.ubicacion_nombre ?? "?"}, del ${String(plan.inicio_at).slice(0, 10)} al ${String(plan.fin_at).slice(0, 10)}.`;
  }
  const senderIds = [...new Set(rows.map((m) => m.sender_id).filter((x): x is string => Boolean(x)))];
  const { data: users } = await supabase.from("usuarios").select("id, nombre").in("id", senderIds);
  const names = new Map(((users ?? []) as Array<{ id: string; nombre: string }>).map((u) => [u.id, u.nombre]));
  const lines = rows.map((m) =>
    `${m.id === mensajeId ? "ESTE → " : ""}${JSON.stringify({ cuando: m.created_at.slice(0, 16).replace("T", " "), autor: names.get(m.sender_id ?? "") ?? "?", texto: m.texto.slice(0, 600) })}`);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse({ error: "Missing API key" }, 500);
  const response = await new Anthropic({ apiKey }).messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1024,
    system: SYSTEM_COMPLETAR,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA_COMPLETAR } },
    messages: [{ role: "user", content: `${viaje}\n\nConversación (una línea por mensaje):\n${lines.join("\n")}` }],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    console.error("[chat-sugerencias] completar sin respuesta útil:", response.stop_reason);
    return jsonResponse({ plan: null });
  }
  const text = response.content.find((b) => b.type === "text");
  const plan = text && text.type === "text" ? JSON.parse(text.text) as PlanCompleto : null;
  return jsonResponse({ plan: plan?.es_plan ? plan : null });
}

// ── plan_nuevo: name, destination and dates for «Crear plan» from this chat ──
// POST { chat_id, plan_nuevo: true } when someone opens «Crear plan» in a chat without a plan. Reads
// the latest conversation and suggests what the sheet asks for. Only on demand, never stored.

const PLAN_NUEVO_MAX = 80;
const PLAN_NUEVO_DIAS = 45;

type PlanNuevo = { hay_viaje: boolean; titulo: string; destino: string; fecha_inicio: string; fecha_fin: string; primer_id: number };
const SCHEMA_PLAN_NUEVO = {
  type: "object",
  properties: {
    hay_viaje: { type: "boolean" },
    titulo: { type: "string" },
    destino: { type: "string" },
    fecha_inicio: { type: "string" },
    fecha_fin: { type: "string" },
    primer_id: { type: "integer" },
  },
  required: ["hay_viaje", "titulo", "destino", "fecha_inicio", "fecha_fin", "primer_id"],
  additionalProperties: false,
};
const SYSTEM_PLAN_NUEVO = `Eres el asistente de Frimee, una app para organizar viajes y planes en grupo. Alguien va a crear un plan a partir de un chat. Te paso los últimos mensajes, en orden, y la fecha de hoy. Sugiere los datos del plan del que están hablando AHORA (el más reciente si hay varios).
- hay_viaje: true si se habla de cualquier plan concreto: un viaje, una escapada, una cena, un concierto, un cumpleaños… false solo si no se habla de ninguno.
- titulo: corto, como lo llamaría el grupo («Finde en Cercedilla», «Lisboa en diciembre», «Cena en Lavapiés»); sin fechas.
- destino: la ciudad, pueblo, barrio o sitio; "" si no se dice.
- fecha_inicio y fecha_fin: YYYY-MM-DD. Deduce «el finde del 28», «el puente», «del 12 al 15» con la fecha de los mensajes y la de hoy; un finde es de viernes a domingo. Si solo hay un día, el mismo en las dos. "" si no se dice.
- primer_id: el id del primer mensaje en el que empiezan a hablar de ESTE plan; 0 si no está claro.
Si se propusieron varias opciones, usa la última en la que se pusieron de acuerdo, o la última propuesta si nadie la rechazó; si siguen enfrentadas, deja el campo en "".`;

async function planNuevo(supabase: ReturnType<typeof createClient>, chat_id: string): Promise<Response> {
  const desde = new Date(Date.now() - PLAN_NUEVO_DIAS * 86_400_000).toISOString();
  const { data } = await supabase.from("mensajes").select("id, texto, created_at, sender_id, tipo")
    .eq("chat_id", chat_id).gte("created_at", desde).order("id", { ascending: false }).limit(PLAN_NUEVO_MAX * 2);
  // People's text and @frimee's answers (they often name the place); no moments JSON or calls.
  const rows = ((data ?? []) as MsgRow[])
    .filter((m) => (m.tipo === "text" || m.tipo === "bot") && !m.texto.startsWith("{") && m.texto.trim().length > 0)
    .slice(0, PLAN_NUEVO_MAX)
    .reverse();
  if (rows.length === 0) return jsonResponse({ plan: null });

  const senderIds = [...new Set(rows.map((m) => m.sender_id).filter((x): x is string => Boolean(x)))];
  const { data: users } = await supabase.from("usuarios").select("id, nombre").in("id", senderIds);
  const names = new Map(((users ?? []) as Array<{ id: string; nombre: string }>).map((u) => [u.id, u.nombre]));
  const lines = rows.map((m) => JSON.stringify({
    id: m.id, cuando: m.created_at.slice(0, 16).replace("T", " "), autor: m.sender_id ? names.get(m.sender_id) ?? "?" : "Frimee", texto: m.texto.slice(0, 500),
  }));

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse({ error: "Missing API key" }, 500);
  const hoy = new Date().toISOString().slice(0, 10);
  const response = await new Anthropic({ apiKey }).messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 512,
    system: SYSTEM_PLAN_NUEVO,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA_PLAN_NUEVO } },
    messages: [{ role: "user", content: `Hoy es ${hoy}.\n\nConversación (una línea por mensaje):\n${lines.join("\n")}` }],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    console.error("[chat-sugerencias] plan_nuevo sin respuesta útil:", response.stop_reason);
    return jsonResponse({ plan: null });
  }
  const text = response.content.find((b) => b.type === "text");
  const plan = text && text.type === "text" ? JSON.parse(text.text) as PlanNuevo : null;
  if (!plan?.hay_viaje) return jsonResponse({ plan: null });
  const fecha = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");
  let [ini, fin] = [fecha(plan.fecha_inicio), fecha(plan.fecha_fin)];
  if (ini && !fin) fin = ini;
  if (ini && fin && fin < ini) [ini, fin] = [fin, ini];
  // Only an id that is really one of these messages.
  const primer = rows.some((m) => m.id === plan.primer_id) ? plan.primer_id : 0;
  return jsonResponse({ plan: { titulo: plan.titulo.trim(), destino: plan.destino.trim(), fecha_inicio: ini, fecha_fin: fin, primer_id: primer } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { chat_id, mensaje_ids, completar: completarId, plan_nuevo } = await req.json() as { chat_id?: string; mensaje_ids?: number[]; completar?: number; plan_nuevo?: boolean };
    const modoCompletar = typeof completarId === "number" && Number.isInteger(completarId) && completarId > 0;
    const modoPlan = plan_nuevo === true;
    if (!chat_id || (!modoCompletar && !modoPlan && !Array.isArray(mensaje_ids))) return jsonResponse({ error: "Faltan datos" }, 400);
    const ids = modoCompletar || modoPlan ? [] : [...new Set((mensaje_ids ?? []).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_IDS);
    if (!modoCompletar && !modoPlan && ids.length === 0) return jsonResponse({ sugerencias: [] });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Who is calling comes from the token; the service role below bypasses RLS, so check membership.
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) return jsonResponse({ error: "No autorizado" }, 401);
    const { data: member } = await supabase
      .from("chat_miembro").select("user_id").eq("chat_id", chat_id).eq("user_id", user.id).maybeSingle();
    if (!member) return jsonResponse({ error: "No eres miembro de este chat" }, 403);

    if (modoCompletar) return await completar(supabase, chat_id, completarId);
    if (modoPlan) return await planNuevo(supabase, chat_id);

    const { data: stored } = await supabase
      .from("mensaje_sugerencias").select("mensaje_id").in("mensaje_id", ids);
    const done = new Set((stored ?? []).map((r: { mensaje_id: number }) => r.mensaje_id));

    const { data: rows } = await supabase
      .from("mensajes")
      .select("id, texto, created_at, sender_id, tipo")
      .eq("chat_id", chat_id)
      .in("id", ids.filter((id) => !done.has(id)));
    const all = (rows ?? []) as Array<{ id: number; texto: string; created_at: string; sender_id: string | null; tipo: string }>;

    // Only people's plain text: moments (JSON), calls, @frimee and very short messages are skipped,
    // but stored as «nothing» so they are not sent again.
    const toAsk = all.filter((m) => m.tipo === "text" && m.sender_id && !m.texto.startsWith("{") && m.texto.trim().length >= MIN_LENGTH && HINT.test(m.texto));
    const skipped = all.filter((m) => !toAsk.includes(m));

    const results: Array<{ mensaje_id: number; chat_id: string; plan: Plan | { es_plan: false }; gasto: Gasto | { es_gasto: false } }> =
      skipped.map((m) => ({ mensaje_id: m.id, chat_id, plan: { es_plan: false }, gasto: { es_gasto: false } }));

    if (toAsk.length > 0) {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) return jsonResponse({ error: "Missing API key" }, 500);

      // Context: the trip's dates and place (for «el segundo día», «el sábado») and who wrote what.
      const { data: chat } = await supabase.from("chat").select("plan_id").eq("id", chat_id).maybeSingle();
      let viaje = "Chat SIN plan (un grupo o una conversación de dos).";
      if (chat?.plan_id) {
        const { data: plan } = await supabase
          .from("plan").select("titulo, inicio_at, fin_at, ubicacion_nombre").eq("id", chat.plan_id).maybeSingle();
        if (plan) viaje = `Chat DE plan: viaje «${plan.titulo}» a ${plan.ubicacion_nombre ?? "?"}, del ${String(plan.inicio_at).slice(0, 10)} al ${String(plan.fin_at).slice(0, 10)}.`;
      }
      const senderIds = [...new Set(toAsk.map((m) => m.sender_id!))];
      const { data: users } = await supabase.from("usuarios").select("id, nombre").in("id", senderIds);
      const names = new Map((users ?? []).map((u: { id: string; nombre: string }) => [u.id, u.nombre]));
      const lines = toAsk.map((m) => JSON.stringify({ id: m.id, fecha: m.created_at.slice(0, 10), autor: names.get(m.sender_id!) ?? "?", texto: m.texto }));

      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-haiku-5-5",
        max_tokens: 4096,
        system: SYSTEM,
        // A classification: low effort is enough and keeps it fast and cheap.
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content: `${viaje}\n\nMensajes (uno por línea):\n${lines.join("\n")}` }],
      });

      if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
        console.error("[chat-sugerencias] sin respuesta útil:", response.stop_reason);
      } else {
        const text = response.content.find((b) => b.type === "text");
        const parsed = text && text.type === "text" ? JSON.parse(text.text) as { items: Item[] } : { items: [] };
        const byId = new Map(parsed.items.map((it) => [it.id, it]));
        for (const m of toAsk) {
          const it = byId.get(m.id);
          const plan = it?.plan?.es_plan ? it.plan : { es_plan: false as const };
          // No plan, no expense: there is nowhere to register it.
          const gasto = chat?.plan_id && it?.gasto?.es_gasto && it.gasto.importe > 0 ? it.gasto : { es_gasto: false as const };
          results.push({ mensaje_id: m.id, chat_id, plan, gasto });
        }
      }
    }

    if (results.length > 0) {
      const { error } = await supabase.from("mensaje_sugerencias").upsert(results, { onConflict: "mensaje_id" });
      if (error) console.error("[chat-sugerencias] guardando:", error.message);
    }

    const { data: out } = await supabase
      .from("mensaje_sugerencias").select("mensaje_id, plan, gasto").in("mensaje_id", ids);
    return jsonResponse({ sugerencias: out ?? [] });
  } catch (e) {
    console.error("[chat-sugerencias] Error:", e);
    return jsonResponse({ error: "Error interno" }, 500);
  }
});
