import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { OPENAI_API_BASE_URL } from "@/config/external";
import { createSupabaseServerClient } from "@/services/supabase/server";

// Tipos que devuelve el OCR al frontend
export type OcrResult = {
  url: string;                  // URL firmada del archivo en Supabase Storage
  is_receipt: boolean;          // true si el archivo parece un recibo/factura/ticket
  total: number | null;         // Total del recibo
  fecha: string | null;         // Fecha en formato YYYY-MM-DD
  moneda: string | null;        // ISO 4217 (EUR, USD...)
  comercio: string | null;      // Nombre del comercio
  items: OcrItem[];             // Líneas del ticket (vacío si no se detectan)
};

export type OcrItem = {
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
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

    // ── 1. Leer el archivo del formulario ──────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const planId = formData.get("plan_id") as string | null;
    const userId = formData.get("user_id") as string | null;

    if (!file || !planId || !userId) {
      return NextResponse.json({ error: "Faltan parámetros: file, plan_id, user_id" }, { status: 400 });
    }

    // Asegurar que el userId del formulario coincide con la sesión activa
    if (userId !== sessionUser.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // ── 2. Subir a Supabase Storage ────────────────────────────────────────
    // Usamos service role para saltarnos RLS en el servidor (la política de Storage
    // aplica a peticiones del cliente, no a llamadas server-side con service role)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const storagePath = `${planId}/${userId}/${filename}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: "Error subiendo archivo: " + uploadError.message }, { status: 500 });
    }

    // Generar URL firmada válida 1 hora (el recibo es privado)
    const { data: signedData } = await supabase.storage
      .from("receipts")
      .createSignedUrl(storagePath, 3600);

    const fileUrl = signedData?.signedUrl ?? "";

    // ── 3. Preparar contenido para GPT-4o ─────────────────────────────────
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    const prompt = `Analiza este documento e indica si es un recibo, ticket o factura. Extrae la información en formato JSON.
Devuelve ÚNICAMENTE el JSON, sin texto adicional, con esta estructura exacta:
{
  "is_receipt": true o false,
  "total": número o null,
  "fecha": "YYYY-MM-DD" o null,
  "moneda": "EUR" o código ISO o null,
  "comercio": "nombre del comercio" o null,
  "items": [
    { "nombre": "descripción", "precio_unitario": número, "cantidad": número, "subtotal": número }
  ]
}
"is_receipt" debe ser true solo si el documento es claramente un ticket de compra, recibo, factura o albarán con importes. Si es una foto, captura de pantalla, documento sin importes u otro tipo de archivo, ponlo a false.
Si no puedes extraer algún campo, pon null. Los items pueden ser array vacío si no se distinguen líneas.`;

    // PDFs: extract text and send as text message
    // Images: send as base64 image_url
    let messageContent: unknown[];
    if (isPdf) {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(fileBuffer));
      const { text: pdfText } = await extractText(pdf, { mergePages: true });
      messageContent = [
        { type: "text", text: `${prompt}\n\nTexto del documento:\n${pdfText}` },
      ];
    } else {
      const base64 = fileBuffer.toString("base64");
      const mimeType = file.type || "image/jpeg";
      messageContent = [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } },
        { type: "text", text: prompt },
      ];
    }

    const openaiRes = await fetch(`${OPENAI_API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1000,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!openaiRes.ok) {
      const errJson = await openaiRes.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
      const code = errJson?.error?.code;
      const friendlyMsg =
        code === "invalid_image_format" ? "Formato de imagen no compatible. Usa JPG, PNG, WebP o PDF." :
        code === "rate_limit_exceeded"  ? "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos." :
        "No se pudo analizar el archivo. Inténtalo de nuevo.";
      return NextResponse.json({ error: friendlyMsg }, { status: 500 });
    }

    const openaiData = (await openaiRes.json()) as {
      choices: { message: { content: string } }[];
    };

    const rawContent = openaiData.choices[0]?.message?.content ?? "{}";

    // ── 4. Parsear respuesta JSON de GPT ───────────────────────────────────
    // GPT a veces envuelve el JSON en ```json ... ```, lo limpiamos
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let extracted: Omit<OcrResult, "url"> = {
      is_receipt: false,
      total: null,
      fecha: null,
      moneda: null,
      comercio: null,
      items: [],
    };

    try {
      extracted = JSON.parse(cleaned) as Omit<OcrResult, "url">;
    } catch {
      // Si falla el parse devolvemos campos vacíos — el usuario rellena manualmente
    }

    const result: OcrResult = {
      url: fileUrl,
      is_receipt: extracted.is_receipt === true,
      total: extracted.total ?? null,
      fecha: extracted.fecha ?? null,
      moneda: extracted.moneda ?? "EUR",
      comercio: extracted.comercio ?? null,
      items: Array.isArray(extracted.items) ? extracted.items : [],
    };

    return NextResponse.json(result);

  } catch (err) {
    console.error("[OCR]", err);
    return NextResponse.json({ error: "No se pudo procesar el archivo. Inténtalo de nuevo." }, { status: 500 });
  }
}
