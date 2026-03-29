import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Member = { id: string; nombre: string };

type PlanInfo = {
  titulo: string;
  ubicacion_nombre: string;
  inicio_at?: string;
  fin_at?: string;
};

type HistoryEntry = { role: "user" | "assistant"; content: string };

type SubplanContext = {
  titulo: string;
  tipo: string | null;
  ubicacion_nombre: string | null;
  ubicacion_lat: number | null;
  ubicacion_lng: number | null;
  inicio_at: string | null;
  fin_at: string | null;
};

type RequestBody = {
  message: string;
  members: Member[];
  planInfo?: PlanInfo;
  isAdmin?: boolean;
  userId: string;
  planId?: number;
  history?: HistoryEntry[];
  userLocation?: { lat: number; lng: number };
};

type FrimeeResult = {
  command: string | null;
  reply: string;
};

// ─── Rate limiting ────────────────────────────────────────────────────────────

const PERSONAL_LIMIT: Record<string, number> = { free: 5, pro: 50 };
const GROUP_LIMIT = { free: 20, pro: 200 };

async function checkAndIncrementUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planId: number | undefined,
  suscripcion: string,
): Promise<{ allowed: boolean; reply?: string }> {
  if (suscripcion === "admin") return { allowed: true };

  const today = new Date().toISOString().split("T")[0];

  // Personal usage
  const { data: usage } = await supabase
    .from("llm_uso_diario")
    .select("llamadas")
    .eq("user_id", userId)
    .eq("fecha", today)
    .maybeSingle();

  const personalUsed = usage?.llamadas ?? 0;
  const personalLimit = PERSONAL_LIMIT[suscripcion] ?? 5;

  if (personalUsed >= personalLimit) {
    return { allowed: false, reply: `Has alcanzado tu límite diario de ${personalLimit} consultas a @Frimee. Vuelve mañana.` };
  }

  // Group usage (only if planId provided)
  if (planId) {
    const memberIds = [userId]; // fallback — enrich below
    const { data: planMembers } = await supabase
      .from("plan_usuarios")
      .select("user_id")
      .eq("plan_id", planId);

    const allMemberIds = planMembers?.map((m: { user_id: string }) => m.user_id) ?? [userId];

    const { data: proMembers } = await supabase
      .from("usuarios")
      .select("id")
      .in("id", allMemberIds)
      .in("suscripcion", ["pro", "admin"]);

    const hasProInGroup = (proMembers?.length ?? 0) > 0;
    const groupLimit = hasProInGroup ? GROUP_LIMIT.pro : GROUP_LIMIT.free;

    const { data: groupUsage } = await supabase
      .from("llm_uso_diario")
      .select("llamadas")
      .in("user_id", allMemberIds)
      .eq("fecha", today);

    const totalGroupUsed = (groupUsage ?? []).reduce((sum: number, u: { llamadas: number }) => sum + u.llamadas, 0);

    if (totalGroupUsed >= groupLimit) {
      return { allowed: false, reply: `El grupo ha alcanzado el límite diario de ${groupLimit} consultas a @Frimee.` };
    }

    void memberIds; // suppress unused warning
  }

  // Increment counter
  await supabase
    .from("llm_uso_diario")
    .upsert(
      { user_id: userId, fecha: today, llamadas: personalUsed + 1 },
      { onConflict: "user_id,fecha" },
    );

  return { allowed: true };
}

// ─── Reverse geocoding ────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`,
      { headers: { "User-Agent": "Frimee/1.0" } },
    );
    if (!res.ok) throw new Error("nominatim error");
    const data = await res.json();
    const addr = data.address ?? {};
    const parts = [
      addr.neighbourhood ?? addr.suburb ?? addr.village ?? addr.town ?? addr.city_district,
      addr.city ?? addr.town ?? addr.municipality,
      addr.state,
      addr.country,
    ].filter(Boolean);
    return parts.slice(0, 3).join(", ") || data.display_name?.split(",").slice(0, 3).join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildLocationContext(
  planInfo: PlanInfo | undefined,
  userLocationName: string | undefined,
  subplans: SubplanContext[],
): string {
  if (userLocationName) {
    return `Ubicación actual del usuario (GPS en tiempo real): ${userLocationName}.`;
  }

  if (subplans.length > 0) {
    const now = Date.now();
    const active = subplans.find((s) => {
      if (!s.inicio_at) return false;
      const start = new Date(s.inicio_at).getTime();
      const end = s.fin_at ? new Date(s.fin_at).getTime() : start + 3_600_000;
      return now >= start && now <= end;
    });
    const upcoming = subplans
      .filter((s) => s.inicio_at && new Date(s.inicio_at).getTime() > now)
      .sort((a, b) => new Date(a.inicio_at!).getTime() - new Date(b.inicio_at!).getTime())[0];

    const lines: string[] = [];
    if (active) {
      const loc = active.ubicacion_nombre ?? planInfo?.ubicacion_nombre ?? "destino del plan";
      const hasta = active.fin_at
        ? ` (hasta las ${new Date(active.fin_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })})`
        : "";
      lines.push(`Actividad en curso: "${active.titulo}" en ${loc}${hasta}.`);
    }
    if (upcoming) {
      const loc = upcoming.ubicacion_nombre ?? planInfo?.ubicacion_nombre ?? "destino del plan";
      const hora = new Date(upcoming.inicio_at!).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      lines.push(`Próxima actividad: "${upcoming.titulo}" en ${loc} a las ${hora}.`);
    }
    if (lines.length > 0) {
      return lines.join("\n");
    }
  }

  return planInfo
    ? `Destino del viaje: ${planInfo.ubicacion_nombre}.`
    : "Sin información de ubicación.";
}

function buildSystemPrompt(
  members: Member[],
  planInfo: PlanInfo | undefined,
  isAdmin: boolean,
  suscripcion: string,
  userLocationName: string | undefined,
  subplans: SubplanContext[],
): string {
  const membersList = members.map((m) => `- ${m.nombre} (id: ${m.id})`).join("\n");
  const planCtx = planInfo
    ? `Nombre del plan: ${planInfo.titulo}\nDestino general: ${planInfo.ubicacion_nombre}`
    : "Sin información de plan.";

  const proFeatures = suscripcion === "pro" || suscripcion === "admin";

  return `Eres Frimee, el asistente inteligente de viaje integrado en el chat de grupo de la app Frimee.
Tu función es ayudar a los viajeros a coordinar su plan de forma natural, actuando como si fueras un miembro más del grupo que conoce todos los detalles del viaje.

━━━ IDENTIDAD ━━━
- Nombre: Frimee
- Tono: cercano, directo y útil. Ni demasiado formal ni demasiado informal.
- Idioma: español siempre, independientemente del idioma en que te escriban.
- Longitud de respuesta: concisa. Una o dos frases es suficiente salvo que se pida información detallada.
- Formato: texto plano únicamente. Sin markdown, sin asteriscos, sin guiones, sin emojis a menos que el contexto lo pida de forma muy natural.

━━━ CONTEXTO DEL VIAJE ━━━
Fecha y hora actual: ${new Date().toLocaleString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
${planCtx}

━━━ UBICACIÓN ACTUAL ━━━
${buildLocationContext(planInfo, userLocationName, subplans)}

━━━ MIEMBROS DEL GRUPO ━━━
${membersList}

━━━ PERFIL DEL USUARIO ━━━
Suscripción: ${suscripcion}
Rol en el plan: ${isAdmin ? "administrador" : "participante"}

━━━ CAPACIDADES DISPONIBLES ━━━
Las siguientes acciones están disponibles. Cuando el usuario pida algo que coincida, ejecútalo directamente sin explicar cómo funciona internamente.

CONSULTAS (disponibles para todos):
- Ver mis tareas pendientes → command="/tareas"
- Ver todas las tareas del grupo → command="/tareas todas"
- Ver mi saldo económico en el plan → command="/saldo"
- Ver todas las deudas del grupo → command="/deudas"
- Calcular las transferencias mínimas para saldar todas las deudas → command="/simplificar"

SUGERENCIAS (disponibles para todos):
- Si el usuario pide recomendaciones de restaurantes, actividades, planes u opciones para decidir en grupo, usa la información de UBICACIÓN ACTUAL como referencia geográfica (GPS exacto si disponible, actividad en curso si existe, o destino del plan como fallback). Genera 3-5 opciones concretas con una descripción breve y crea automáticamente una votación con esas opciones para que el grupo decida.
  En "reply" presenta brevemente las opciones. En "command" incluye el /votar con esas opciones entre comillas dobles.
  IMPORTANTE: las opciones deben ser nombres específicos de lugares o establecimientos reales (ej: "La Taberna del Puerto", "Restaurante El Buey"), nunca categorías genéricas como "chiringuito de playa" o "comida rápida". Si no conoces nombres concretos del lugar, inventa nombres verosímiles típicos de la zona.

ENCUESTAS (disponibles para todos):
- Crear una votación cuando el usuario quiera decidir algo entre opciones → command="/votar [pregunta]? \\"[opción 1]\\" \\"[opción 2]\\" \\"[opción 3]\\""
  IMPORTANTE: las opciones SIEMPRE van entre comillas dobles. Máximo 6 opciones. La pregunta debe terminar en "?".
  Ejemplo correcto: /votar ¿Dónde cenamos esta noche? "Restaurante italiano" "Chiringuito de playa" "Sushi"
- Votar en una encuesta activa en nombre del usuario → command="/voto [n]"
  Usa esto cuando el usuario diga explícitamente que vote por una opción concreta (ej: "vota por la segunda", "voto la opción 1").
  El número [n] es la posición de la opción en la encuesta activa (1, 2, 3...).${isAdmin ? `

ADMINISTRACIÓN (solo disponible porque eres admin):
- Crear una tarea asignada a un miembro → command="/tarea [título] @nombre [categoría]"
  Categorías válidas: vuelo, ferry, coche, alojamiento, actividad, comida, otro
  Usa el nombre exacto del miembro tal como aparece en la lista.
- Registrar un gasto compartido equitativamente → command="/gasto [concepto] [importe]€"
  Ejemplo: /gasto cena 120€
- Enviar un recordatorio de deuda o tarea a un miembro → command="/recordar @nombre"` : ""}${proFeatures ? `

FUNCIONES PRO (disponibles para ti):
- Traducción en tiempo real: si el usuario pide traducir cualquier texto o frase, tradúcelo directamente en el campo "reply". No necesitas ningún command para esto.` : ""}

━━━ REGLAS DE COMPORTAMIENTO ━━━
1. Nunca menciones comandos, sintaxis interna ni cómo funciona la app por dentro. El usuario no necesita saberlo.
2. Cuando puedas ejecutar una acción, hazla directamente y confirma de forma natural en el "reply".
3. Si la intención del usuario es ambigua, pide solo la aclaración mínima necesaria.
4. Si el usuario pide algo que no puedes hacer, explícalo en una frase sin entrar en detalles técnicos.
5. Para mencionar miembros en los comandos, usa siempre el nombre exacto tal como aparece en la lista de miembros.
6. Si el usuario pide votar en una encuesta pero no hay ninguna activa, indícalo brevemente.
7. Tienes acceso al historial reciente de la conversación. Úsalo para entender el contexto de los mensajes anteriores y responder de forma coherente con lo que ya se ha hablado.${!proFeatures ? `
8. Si el usuario solicita una función Pro (como traducción), indícale que está disponible para usuarios Pro de forma amable y sin ser insistente.` : ""}

━━━ FORMATO DE RESPUESTA ━━━
Devuelve SIEMPRE un objeto JSON válido con exactamente estos dos campos. Nada antes ni después del JSON.

{"command": string | null, "reply": string}

- "command": el comando interno a ejecutar, o null si no hay acción que ejecutar.
- "reply": la respuesta en lenguaje natural que verá el usuario. Siempre en español. Nunca incluyas el comando en este campo.

EJEMPLOS:
{"command": "/tareas", "reply": "Aquí van tus tareas pendientes."}
{"command": "/tarea reservar hotel @Carlos alojamiento", "reply": "Listo, le asigno la reserva del hotel a Carlos."}
{"command": "/votar ¿Qué hacemos el último día? \\"Playa\\" \\"Ciudad\\" \\"Excursión\\"", "reply": "He creado la votación para que el grupo decida."}
{"command": "/voto 2", "reply": "Votado. He elegido la segunda opción en tu nombre."}
{"command": null, "reply": "No hay ninguna votación activa ahora mismo."}
{"command": null, "reply": "Puedo ayudarte con las tareas, el saldo o las deudas del viaje. ¿Qué necesitas?"}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { message, members, planInfo, isAdmin = false, userId, planId, history, userLocation }: RequestBody = await req.json();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "Missing API key" }), { status: 500, headers: CORS });

    // Rate limit check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: userRow } = await supabase
      .from("usuarios")
      .select("suscripcion")
      .eq("id", userId)
      .maybeSingle();

    const suscripcion: string = userRow?.suscripcion ?? "free";

    const { allowed, reply: limitReply } = await checkAndIncrementUsage(supabase, userId, planId, suscripcion);
    if (!allowed) {
      return new Response(JSON.stringify({ command: null, reply: limitReply }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Fetch subplans for location context
    let subplans: SubplanContext[] = [];
    if (planId) {
      const { data: subplanRows } = await supabase
        .from("subplan")
        .select("titulo, tipo, ubicacion_nombre, ubicacion_lat, ubicacion_lng, inicio_at, fin_at")
        .eq("plan_id", planId)
        .order("inicio_at", { ascending: true });
      subplans = (subplanRows ?? []) as SubplanContext[];
    }

    // Resolve user location name from GPS coords (if provided)
    const userLocationName = userLocation
      ? await reverseGeocode(userLocation.lat, userLocation.lng)
      : undefined;

    // Call LLM
    const systemPrompt = buildSystemPrompt(members, planInfo, isAdmin, suscripcion, userLocationName, subplans);

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [...(history ?? []), { role: "user", content: message }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error("[frimee-assistant] Anthropic error:", err);
      return new Response(JSON.stringify({ command: null, reply: "No pude procesar tu mensaje, inténtalo de nuevo." }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const anthropicData = await anthropicRes.json();
    const rawText: string = anthropicData.content?.[0]?.text ?? "";

    let result: FrimeeResult = { command: null, reply: rawText };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as FrimeeResult;
        if (typeof parsed.reply === "string") result = parsed;
      }
    } catch {
      // LLM devolvió texto plano, usarlo como reply
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[frimee-assistant] Error:", e);
    return new Response(JSON.stringify({ command: null, reply: "Error interno, inténtalo de nuevo." }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
