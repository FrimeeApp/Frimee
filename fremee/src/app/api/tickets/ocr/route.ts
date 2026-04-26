import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { publicEnv, getSupabaseServiceRoleKey } from "@/config/env";
import { OPENAI_API_BASE_URL } from "@/config/external";
import { createSupabaseServerClient } from "@/services/supabase/server";

export type TicketOcrResult = {
  source_path: string;            // path en Supabase Storage (plan-tickets bucket)
  type: string | null;            // flight | ferry | train | concert | match | hotel | other
  title: string | null;           // nombre del vuelo/evento/tren…
  from_label: string | null;      // código/nombre de origen (MAD, Barcelona…)
  to_label: string | null;        // código/nombre de destino
  place_label: string | null;     // recinto/lugar (para conciertos, hoteles…)
  starts_at: string | null;       // ISO 8601
  ends_at: string | null;         // ISO 8601 o null
  booking_code: string | null;    // localizador / PNR / código de reserva
  seat_label: string | null;      // asiento / sector
  gate_label: string | null;      // puerta
  terminal_label: string | null;  // terminal
  passenger_name: string | null;  // nombre en el billete
  has_qr: boolean;                // true si el documento contiene un QR o código de barras visible
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OCR no configurado" }, { status: 500 });
  }

  try {
    // ── 0. Verificar sesión ────────────────────────────────────────────────
    const authClient = await createSupabaseServerClient();
    const { data: { user: sessionUser } } = await authClient.auth.getUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file   = formData.get("file")    as File   | null;
    const userId = formData.get("user_id") as string | null;

    if (!file || !userId) {
      return NextResponse.json({ error: "Faltan parámetros: file, user_id" }, { status: 400 });
    }

    // Asegurar que el userId del formulario coincide con la sesión activa
    if (userId !== sessionUser.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // ── Subir a plan-tickets bucket ────────────────────────────────────────────
    const supabase = createClient(
      publicEnv.supabaseUrl,
      getSupabaseServiceRoleKey()
    );

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const storagePath = `tickets/${userId}/${filename}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("plan-tickets")
      .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: "Error subiendo archivo: " + uploadError.message }, { status: 500 });
    }

    // ── Prompt específico para tickets de viaje/eventos ────────────────────────
    const prompt = `Analiza este documento (boarding pass, billete de tren/ferry, entrada de concierto, reserva de hotel, etc.) y extrae la información en formato JSON.
Devuelve ÚNICAMENTE el JSON, sin texto adicional ni markdown, con esta estructura exacta:
{
  "type": "flight" | "ferry" | "train" | "concert" | "match" | "hotel" | "other",
  "title": "nombre del vuelo, evento o servicio (ej: Iberia IB3157, Coldplay Madrid, AVE Madrid-Barcelona)",
  "from_label": "código IATA o nombre de ciudad de origen — solo para vuelos/tren/ferry, null para el resto",
  "to_label": "código IATA o nombre de ciudad de destino — solo para vuelos/tren/ferry, null para el resto",
  "place_label": "nombre del recinto, hotel o lugar — para conciertos/partidos/hoteles, null para transporte",
  "starts_at": "YYYY-MM-DDTHH:MM:00" o null,
  "ends_at": "YYYY-MM-DDTHH:MM:00" o null,
  "booking_code": "localizador, PNR o código de reserva" o null,
  "seat_label": "asiento, fila, sector o zona" o null,
  "gate_label": "puerta de embarque" o null,
  "terminal_label": "terminal" o null,
  "passenger_name": "nombre completo del pasajero o titular" o null,
  "has_qr": true si el documento tiene un código QR o de barras visible, false si no
}
Para vuelos: from_label y to_label deben ser los códigos IATA de 3 letras (MAD, JFK…) si aparecen, o el nombre de la ciudad.
Si no puedes extraer algún campo con certeza, pon null. No inventes datos.`;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    let messageContent: unknown[];
    if (isPdf) {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(fileBuffer));
      const { text: pdfText } = await extractText(pdf, { mergePages: true });
      messageContent = [{ type: "text", text: `${prompt}\n\nTexto del documento:\n${pdfText}` }];
    } else {
      const base64   = fileBuffer.toString("base64");
      const mimeType = file.type || "image/jpeg";
      messageContent = [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } },
        { type: "text", text: prompt },
      ];
    }

    const openaiRes = await fetch(`${OPENAI_API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4o", max_tokens: 800, messages: [{ role: "user", content: messageContent }] }),
    });

    if (!openaiRes.ok) {
      const errJson = await openaiRes.json().catch(() => null) as { error?: { code?: string } } | null;
      const code = errJson?.error?.code;
      const msg =
        code === "invalid_image_format" ? "Formato no compatible. Usa JPG, PNG, WebP o PDF." :
        code === "rate_limit_exceeded"  ? "Demasiadas solicitudes. Inténtalo en unos segundos." :
        "No se pudo analizar el archivo. Inténtalo de nuevo.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const openaiData = (await openaiRes.json()) as { choices: { message: { content: string } }[] };
    const rawContent = openaiData.choices[0]?.message?.content ?? "{}";

    const cleaned = rawContent
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    let extracted: Omit<TicketOcrResult, "source_path"> = {
      type: null, title: null, from_label: null, to_label: null, place_label: null,
      starts_at: null, ends_at: null, booking_code: null, seat_label: null,
      gate_label: null, terminal_label: null, passenger_name: null, has_qr: false,
    };

    try { extracted = JSON.parse(cleaned); } catch { /* usuario rellena manualmente */ }

    const result: TicketOcrResult = { source_path: storagePath, ...extracted };
    return NextResponse.json(result);

  } catch (err) {
    console.error("[TICKET-OCR]", err);
    return NextResponse.json({ error: "No se pudo procesar el archivo." }, { status: 500 });
  }
}
