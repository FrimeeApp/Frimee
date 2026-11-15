// chat-sugerencias: what @frimee sees in chat messages, so the chat only offers «Añadir al plan»
// (rombo, P) and «Registrar como gasto» (G) where they make sense, with the sheet already filled in.
//
// POST { chat_id, mensaje_ids: number[] } with the user's access token. Text messages of that chat
// not analysed yet are classified in one call to Claude (structured output: always valid JSON) and
// stored in mensaje_sugerencias, once per message for every member. Returns the suggestions of the
// requested messages (new and stored).
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { chat_id, mensaje_ids } = await req.json() as { chat_id?: string; mensaje_ids?: number[] };
    if (!chat_id || !Array.isArray(mensaje_ids)) return jsonResponse({ error: "Faltan datos" }, 400);
    const ids = [...new Set(mensaje_ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_IDS);
    if (ids.length === 0) return jsonResponse({ sugerencias: [] });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Who is calling comes from the token; the service role below bypasses RLS, so check membership.
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) return jsonResponse({ error: "No autorizado" }, 401);
    const { data: member } = await supabase
      .from("chat_miembro").select("user_id").eq("chat_id", chat_id).eq("user_id", user.id).maybeSingle();
    if (!member) return jsonResponse({ error: "No eres miembro de este chat" }, 403);

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
