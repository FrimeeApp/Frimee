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

type BalanceRow = {
  from_user_id: string;
  from_nombre: string | null;
  to_user_id: string;
  to_nombre: string | null;
  importe: number;
  estado: string;
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

  if (planId) {
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
  }

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

// ─── Weather (Open-Meteo, no API key needed) ──────────────────────────────────

const WEATHER_CODES: Record<number, string> = {
  0: "despejado", 1: "mayormente despejado", 2: "parcialmente nublado", 3: "nublado",
  45: "niebla", 48: "niebla con escarcha",
  51: "llovizna ligera", 53: "llovizna moderada", 55: "llovizna intensa",
  61: "lluvia ligera", 63: "lluvia moderada", 65: "lluvia intensa",
  71: "nieve ligera", 73: "nieve moderada", 75: "nieve intensa",
  80: "chubascos ligeros", 81: "chubascos moderados", 82: "chubascos fuertes",
  95: "tormenta", 96: "tormenta con granizo", 99: "tormenta con granizo fuerte",
};

async function fetchWeatherContext(
  locationName: string,
  planInfo?: PlanInfo,
  userLat?: number,
  userLng?: number,
): Promise<string | null> {
  try {
    let lat: number, lng: number;

    if (userLat !== undefined && userLng !== undefined) {
      lat = userLat;
      lng = userLng;
    } else {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=es`,
      );
      if (!geoRes.ok) return null;
      const geoData = await geoRes.json();
      const result = geoData.results?.[0];
      if (!result) return null;
      lat = result.latitude;
      lng = result.longitude;
    }

    // Open-Meteo free tier goes up to 16 days ahead
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&forecast_days=16&current_weather=true`,
    );
    if (!weatherRes.ok) return null;
    const weather = await weatherRes.json();

    const current = weather.current_weather;
    const daily = weather.daily;

    // Determine the date range to show:
    // - If plan has dates, only show days within inicio_at..fin_at
    // - Otherwise show today + next 7 days
    const todayStr = new Date().toISOString().split("T")[0];
    const planStart = planInfo?.inicio_at ? planInfo.inicio_at.split("T")[0] : null;
    const planEnd = planInfo?.fin_at ? planInfo.fin_at.split("T")[0] : null;

    // Filter forecast days to those within the plan's travel window
    const filteredIndices: number[] = [];
    for (let i = 0; i < (daily.time?.length ?? 0); i++) {
      const day = daily.time[i]; // "YYYY-MM-DD"
      if (planStart && planEnd) {
        if (day >= planStart && day <= planEnd) filteredIndices.push(i);
      } else {
        // No plan dates: show today + next 7 days
        if (day >= todayStr) filteredIndices.push(i);
        if (filteredIndices.length >= 7) break;
      }
    }

    // If plan has future dates with no overlap in forecast window
    if (planStart && filteredIndices.length === 0) {
      const startFormatted = new Date(planStart).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
      const endFormatted = planEnd
        ? new Date(planEnd).toLocaleDateString("es-ES", { day: "numeric", month: "long" })
        : startFormatted;
      return `Previsión meteorológica para las fechas del viaje (${startFormatted}–${endFormatted}) aún no disponible. Los datos solo cubren los próximos 16 días.`;
    }

    const currentDesc = WEATHER_CODES[current?.weathercode] ?? "variable";
    let ctx = `Clima actual en ${locationName}: ${Math.round(current?.temperature ?? 0)}°C, ${currentDesc}.\n`;
    ctx += planStart ? `Previsión para los días del viaje:\n` : `Previsión próximos días:\n`;

    for (const i of filteredIndices) {
      const date = new Date(daily.time[i]).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
      const min = Math.round(daily.temperature_2m_min[i]);
      const max = Math.round(daily.temperature_2m_max[i]);
      const desc = WEATHER_CODES[daily.weathercode[i]] ?? "variable";
      const rain = daily.precipitation_sum[i] > 0 ? `, ${daily.precipitation_sum[i].toFixed(1)}mm lluvia` : "";
      ctx += `- ${date}: ${min}–${max}°C, ${desc}${rain}\n`;
    }

    return ctx.trim();
  } catch {
    return null;
  }
}

// ─── Currency (Frankfurter API, no API key needed) ────────────────────────────

async function fetchCurrencyContext(): Promise<string | null> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR");
    if (!res.ok) return null;
    const data = await res.json();
    const rates = data.rates as Record<string, number>;

    const relevant = ["USD", "GBP", "JPY", "CHF", "MXN", "BRL", "ARS", "CLP", "COP", "PEN", "CAD", "AUD", "DKK", "SEK", "NOK", "PLN", "CZK", "HUF", "RON", "TRY", "MAD", "EGP", "ZAR", "AED", "THB", "IDR", "INR", "KRW", "CNY", "HKD", "SGD"];
    const lines = relevant
      .filter((c) => rates[c])
      .map((c) => `1 EUR = ${rates[c].toFixed(4)} ${c}`);

    return `Tipos de cambio actuales (base EUR):\n${lines.join("\n")}`;
  } catch {
    return null;
  }
}

// ─── Balance context ──────────────────────────────────────────────────────────

async function fetchBalanceContext(
  supabase: ReturnType<typeof createClient>,
  planId: number,
  userId: string,
  members: Member[],
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("fn_balances_for_plan", { p_plan_id: planId });
    if (error || !data) return null;

    const balances = data as BalanceRow[];
    if (balances.length === 0) return "No hay deudas pendientes en el plan.";

    const memberName = (id: string) => members.find((m) => m.id === id)?.nombre ?? id;

    const lines: string[] = [];

    // What I owe
    const iOwe = balances.filter((b) => b.from_user_id === userId && b.estado !== "SALDADO");
    if (iOwe.length > 0) {
      lines.push("Lo que debes:");
      iOwe.forEach((b) => lines.push(`  - Debes ${b.importe.toFixed(2)}€ a ${b.to_nombre ?? memberName(b.to_user_id)}`));
    }

    // What I'm owed
    const owedToMe = balances.filter((b) => b.to_user_id === userId && b.estado !== "SALDADO");
    if (owedToMe.length > 0) {
      lines.push("Lo que te deben:");
      owedToMe.forEach((b) => lines.push(`  - ${b.from_nombre ?? memberName(b.from_user_id)} te debe ${b.importe.toFixed(2)}€`));
    }

    // All pending balances (for general debt overview)
    const pending = balances.filter((b) => b.estado !== "SALDADO");
    if (pending.length > 0 && lines.length === 0) {
      lines.push("Deudas pendientes del grupo:");
      pending.forEach((b) =>
        lines.push(`  - ${b.from_nombre ?? memberName(b.from_user_id)} → ${b.to_nombre ?? memberName(b.to_user_id)}: ${b.importe.toFixed(2)}€`)
      );
    }

    return lines.length > 0 ? lines.join("\n") : "No hay deudas pendientes.";
  } catch {
    return null;
  }
}

// ─── Intent detection ─────────────────────────────────────────────────────────

function needsWeather(msg: string): boolean {
  const keywords = ["tiempo", "lluvia", "temperatura", "frío", "calor", "paraguas", "nublado", "soleado", "nieva", "viento", "tormenta", "grados", "celsius", "fahrenheit", "meteorolog", "previsión", "forecast", "cielo", "nube"];
  const lower = msg.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function needsCurrency(msg: string): boolean {
  const keywords = ["convierte", "conversión", "cambio", "dólar", "libra", "yen", "yuan", "franco", "peso", "real", "corona", "moneda", "divisa", "cotización", "tasa de cambio", "cuánto son", "a cuánto"];
  const symbols = /\$|£|¥|USD|GBP|JPY|CHF|CAD|AUD|MXN|BRL|ARS/;
  const lower = msg.toLowerCase();
  return keywords.some((k) => lower.includes(k)) || symbols.test(msg);
}

// ─── Location context ─────────────────────────────────────────────────────────

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
    if (lines.length > 0) return lines.join("\n");
  }

  return planInfo
    ? `Destino del viaje: ${planInfo.ubicacion_nombre}.`
    : "Sin información de ubicación.";
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  members: Member[],
  planInfo: PlanInfo | undefined,
  isAdmin: boolean,
  suscripcion: string,
  userLocationName: string | undefined,
  subplans: SubplanContext[],
  balanceContext: string | null,
  weatherContext: string | null,
  currencyContext: string | null,
): string {
  const membersList = members.map((m) => `- ${m.nombre} (id: ${m.id})`).join("\n");
  const planCtx = planInfo
    ? `Nombre del plan: ${planInfo.titulo}\nDestino general: ${planInfo.ubicacion_nombre}${planInfo.inicio_at ? `\nFecha inicio: ${new Date(planInfo.inicio_at).toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}` : ""}${planInfo.fin_at ? `\nFecha fin: ${new Date(planInfo.fin_at).toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}` : ""}`
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
${balanceContext ? `\n━━━ BALANCE ECONÓMICO (datos reales del plan) ━━━\n${balanceContext}` : ""}${weatherContext ? `\n\n━━━ DATOS METEOROLÓGICOS ━━━\n${weatherContext}` : ""}${currencyContext ? `\n\n━━━ TIPOS DE CAMBIO ACTUALES ━━━\n${currencyContext}` : ""}

━━━ CAPACIDADES DISPONIBLES ━━━
Las siguientes acciones están disponibles. Cuando el usuario pida algo que coincida, ejecútalo directamente sin explicar cómo funciona internamente.

CONSULTAS (disponibles para todos):
- Ver mis tareas pendientes → command="/tareas"
- Ver todas las tareas del grupo → command="/tareas todas"
- Ver mi saldo económico en el plan → command="/saldo"
- Ver todas las deudas del grupo → command="/deudas"
- Calcular las transferencias mínimas para saldar todas las deudas → command="/simplificar"

BALANCE DETALLADO:
- Si el usuario pregunta cuánto debe, a quién debe pagar, cuánto le deben, o su situación económica en el plan, usa los datos de BALANCE ECONÓMICO del contexto para responderle de forma natural y detallada. No ejecutes ningún command, responde directamente en "reply".

SUGERENCIAS (disponibles para todos):
- Si el usuario pide recomendaciones de restaurantes, actividades, planes u opciones para decidir en grupo, usa la información de UBICACIÓN ACTUAL como referencia geográfica (GPS exacto si disponible, actividad en curso si existe, o destino del plan como fallback). Genera 3-5 opciones concretas con una descripción breve y crea automáticamente una votación con esas opciones para que el grupo decida.
  En "reply" presenta brevemente las opciones. En "command" incluye el /votar con esas opciones entre comillas dobles.
  IMPORTANTE: las opciones deben ser nombres específicos de lugares o establecimientos reales (ej: "La Taberna del Puerto", "Restaurante El Buey"), nunca categorías genéricas como "chiringuito de playa" o "comida rápida". Si no conoces nombres concretos del lugar, inventa nombres verosímiles típicos de la zona.

MODO SORPRESA:
- Si el usuario pide que decidas tú (restaurante, plan, actividad, dónde ir, qué hacer), elige una opción concreta y justifícala brevemente con contexto del viaje (destino, actividades del día, época del año). No crees votación — decide directamente. Responde en "reply", command null.

ENCUESTAS (disponibles para todos):
- Crear una votación cuando el usuario quiera decidir algo entre opciones → command="/votar [pregunta]? \\"[opción 1]\\" \\"[opción 2]\\" \\"[opción 3]\\""
  IMPORTANTE: las opciones SIEMPRE van entre comillas dobles. Máximo 6 opciones. La pregunta debe terminar en "?".
  Ejemplo correcto: /votar ¿Dónde cenamos esta noche? "Restaurante italiano" "Chiringuito de playa" "Sushi"
- Votar en una encuesta activa en nombre del usuario → command="/voto [n]"
  Usa esto cuando el usuario diga explícitamente que vote por una opción concreta (ej: "vota por la segunda", "voto la opción 1").
  El número [n] es la posición de la opción en la encuesta activa (1, 2, 3...).
- Cerrar la encuesta activa → command="/cerrar"
  Usa esto cuando el usuario pida cerrar o terminar la votación. IMPORTANTE: nunca asumas el estado de la encuesta desde el historial — siempre ejecuta el command y deja que el sistema compruebe si está abierta.

RESUMEN DEL CHAT (ponme al día):
- Si el usuario pide saber qué ha pasado mientras estaba fuera ("ponme al día", "qué me perdí", "qué ha pasado"), resume brevemente el historial de conversación disponible. Menciona decisiones tomadas, gastos registrados, tareas creadas o encuestas lanzadas. Responde en "reply", command null.

CHECKLIST DE VIAJE:
- Si el usuario pide una lista de cosas que llevar o preparar para el viaje, genera una checklist personalizada según el destino, la duración, la época del año y el tipo de actividades del plan.
  Organízala en categorías con este formato exacto (cada categoría en una línea, items separados por coma):
  Ropa: item1, item2, item3
  Accesorios: item1, item2
  Documentación: item1, item2
  Aseo: item1, item2
  Tecnología: item1, item2
  Otros: item1, item2
  Solo incluye las categorías que apliquen. Responde en "reply", command null.

CLIMA Y TIEMPO:
- Si hay datos meteorológicos en el contexto, úsalos para responder preguntas sobre el tiempo de forma natural y útil. Incluye recomendaciones prácticas (llevar paraguas, ropa de abrigo, etc.). Responde en "reply", command null.

CONVERSIÓN DE DIVISAS:
- Si hay tipos de cambio en el contexto, úsalos para responder conversiones de moneda de forma precisa. Si el usuario no especifica la moneda de destino, infiere cuál es la moneda local del destino del viaje. Responde en "reply", command null.

TRADUCCIÓN E IDIOMA DEL DESTINO:
- Si el usuario pide traducir algo, o pregunta cómo se dice algo, responde con la traducción directamente en "reply". Si no especifica el idioma destino, usa el idioma del país de destino del plan (ej: si el plan es en Japón, traduce al japonés; si es en Italia, al italiano). command null.

REDACTAR MENSAJES:
- Si el usuario pide ayuda para escribir un mensaje a alguien del grupo (ej: recordarle una deuda, pedirle que haga algo), redáctalo tú de forma diplomática, directa y natural. Devuelve el texto del mensaje en "reply". command null.

INFORMACIÓN SOBRE LUGARES:
- Si el usuario pregunta sobre horarios, precios, requisitos de entrada o información práctica de un lugar concreto, responde con lo que sabes de tu entrenamiento. Aclara brevemente si la información podría no estar actualizada. Responde en "reply", command null.${isAdmin ? `

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

    // Fetch contextual data in parallel based on intent detection
    const wantsWeather = needsWeather(message);
    const wantsCurrency = needsCurrency(message);

    const locationForWeather = userLocation
      ? undefined // use coords directly
      : planInfo?.ubicacion_nombre;

    const [balanceContext, weatherContext, currencyContext] = await Promise.all([
      planId ? fetchBalanceContext(supabase, planId, userId, members) : Promise.resolve(null),
      wantsWeather && (locationForWeather || userLocation)
        ? fetchWeatherContext(locationForWeather ?? "", planInfo, userLocation?.lat, userLocation?.lng)
        : Promise.resolve(null),
      wantsCurrency ? fetchCurrencyContext() : Promise.resolve(null),
    ]);

    // Build system prompt and call LLM
    const systemPrompt = buildSystemPrompt(
      members, planInfo, isAdmin, suscripcion,
      userLocationName, subplans,
      balanceContext, weatherContext, currencyContext,
    );

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
