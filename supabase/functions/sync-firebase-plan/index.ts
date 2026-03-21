import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── Tipos ────────────────────────────────────────────────────────────────────

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: PlanRow;
  old_record: PlanRow;
};

type PlanRow = {
  id: number;
  titulo: string;
  descripcion: string;
  ubicacion_nombre: string;
  inicio_at: string;
  fin_at: string;
  all_day: boolean;
  visibilidad: string;
  foto_portada: string | null;
  owner_user_id: string;
  estado: string;
  deleted_at: string | null;
};

// ── Google auth ──────────────────────────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
  const rawKey = Deno.env.get("FIREBASE_PRIVATE_KEY")!;
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const keyBuffer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

// ── Firestore helpers ────────────────────────────────────────────────────────

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;

async function updatePlanDoc(planId: number, fields: Record<string, unknown>, maskPaths: string[], token: string): Promise<void> {
  const docName = `projects/${PROJECT_ID}/databases/(default)/documents/posts/plan_${planId}`;
  const mask = maskPaths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join("&");

  const res = await fetch(`https://firestore.googleapis.com/v1/${docName}?${mask}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    // Si el doc no existe (plan no publicado), lo ignoramos
    if (res.status === 404) return;
    throw new Error(`Firestore PATCH failed: ${err}`);
  }
}

// ── Handler principal ────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const payload = await req.json() as WebhookPayload;

    if (payload.type !== "UPDATE") {
      return new Response(JSON.stringify({ ok: true, skipped: "not an update" }), { status: 200 });
    }

    const { record, old_record } = payload;

    // Campos relevantes para el feed
    const changed =
      record.titulo !== old_record.titulo ||
      record.descripcion !== old_record.descripcion ||
      record.ubicacion_nombre !== old_record.ubicacion_nombre ||
      record.inicio_at !== old_record.inicio_at ||
      record.fin_at !== old_record.fin_at ||
      record.all_day !== old_record.all_day ||
      record.visibilidad !== old_record.visibilidad ||
      record.foto_portada !== old_record.foto_portada;

    if (!changed) {
      return new Response(JSON.stringify({ ok: true, skipped: "no relevant changes" }), { status: 200 });
    }

    const token = await getGoogleAccessToken();

    const fields: Record<string, unknown> = {
      title:        { stringValue: record.titulo },
      description:  { stringValue: record.descripcion },
      locationName: { stringValue: record.ubicacion_nombre },
      startsAt:     { stringValue: record.inicio_at },
      endsAt:       { stringValue: record.fin_at },
      allDay:       { booleanValue: record.all_day },
      visibility:   { stringValue: record.visibilidad },
      coverImage:   record.foto_portada ? { stringValue: record.foto_portada } : { nullValue: null },
    };

    const maskPaths = ["title", "description", "locationName", "startsAt", "endsAt", "allDay", "visibility", "coverImage"];

    await updatePlanDoc(record.id, fields, maskPaths, token);

    console.log(`[sync-firebase-plan] plan=${record.id} updated in Firebase`);

    return new Response(JSON.stringify({ ok: true, planId: record.id }), { status: 200 });
  } catch (err) {
    console.error("[sync-firebase-plan] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
