import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCopy, preferenceCategoryAndKey } from "./copy.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: NotificacionRow;
};

type NotificacionRow = {
  id: number;
  user_id: string;
  tipo: string;
  actor_id: string | null;
  entity_id: string | null;
  entity_type: string | null;
  leida: boolean;
  created_at: string;
};

type PushToken = {
  token: string;
  platform: "ios" | "android";
};

type NotificationPreferences = Record<string, Record<string, boolean>>;

// ─── Google / FCM auth (reuses same pattern as sync-firebase-plan) ────────────

async function getFCMAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
  const rawKey = Deno.env.get("FIREBASE_PRIVATE_KEY")!;
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

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
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
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

// ─── FCM send ─────────────────────────────────────────────────────────────────

async function sendFCM(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
  accessToken: string
): Promise<{ success: boolean; invalidToken: boolean }> {
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID")!;
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          android: {
            priority: "high",
            notification: { sound: "default", click_action: "FLUTTER_NOTIFICATION_CLICK" },
          },
          apns: {
            payload: { aps: { sound: "default", badge: 1 } },
          },
        },
      }),
    }
  );

  if (res.ok) return { success: true, invalidToken: false };

  const err = await res.json() as { error?: { status?: string } };
  const invalidToken =
    err?.error?.status === "INVALID_ARGUMENT" ||
    err?.error?.status === "NOT_FOUND" ||
    err?.error?.status === "UNREGISTERED";

  return { success: false, invalidToken };
}

// ─── Quiet hours check ────────────────────────────────────────────────────────

function isQuietHour(
  quietHours: { enabled: boolean; start: string; end: string },
  timezone: string
): boolean {
  if (!quietHours.enabled) return false;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const [hStr, mStr] = formatter.format(now).split(":").map(Number);
    const current = hStr * 60 + (mStr ?? 0);

    const [startH, startM] = quietHours.start.split(":").map(Number);
    const [endH, endM] = quietHours.end.split(":").map(Number);
    const start = (startH ?? 0) * 60 + (startM ?? 0);
    const end = (endH ?? 0) * 60 + (endM ?? 0);

    // Spans midnight (e.g. 23:00 – 08:00)
    if (start > end) return current >= start || current < end;
    return current >= start && current < end;
  } catch {
    return false;
  }
}

// ─── Preference check ─────────────────────────────────────────────────────────

function isNotificationEnabled(
  tipo: string,
  prefs: NotificationPreferences
): boolean {
  const mapping = preferenceCategoryAndKey(tipo);
  if (!mapping) return true; // unknown type: allow by default

  const category = prefs[mapping.category] as Record<string, boolean> | undefined;
  if (!category) return true;
  if (category.enabled === false) return false;
  if (category[mapping.key] === false) return false;
  return true;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const payload = await req.json() as WebhookPayload;
    if (payload.type !== "INSERT") return new Response("ok", { status: 200 });

    const notif = payload.record;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch push tokens for recipient
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", notif.user_id) as { data: PushToken[] | null };

    if (!tokens || tokens.length === 0) return new Response("no tokens", { status: 200 });

    // 2. Fetch recipient settings (preferences + timezone)
    const { data: settings } = await supabase
      .from("user_settings")
      .select("notify_push, notification_preferences, timezone")
      .eq("user_id", notif.user_id)
      .single() as {
        data: {
          notify_push: boolean;
          notification_preferences: NotificationPreferences | null;
          timezone: string;
        } | null;
      };

    if (!settings?.notify_push) return new Response("push disabled", { status: 200 });

    const prefs = settings.notification_preferences ?? {};
    const quietHours = (prefs.quiet_hours as { enabled: boolean; start: string; end: string }) ??
      { enabled: false, start: "23:00", end: "08:00" };

    // 3. Check quiet hours
    if (isQuietHour(quietHours, settings.timezone ?? "Europe/Madrid")) {
      return new Response("quiet hours", { status: 200 });
    }

    // 4. Check per-type preference
    if (!isNotificationEnabled(notif.tipo, prefs)) {
      return new Response("preference disabled", { status: 200 });
    }

    // 5. Fetch actor name
    let actorNombre: string | null = null;
    if (notif.actor_id) {
      const { data: actor } = await supabase
        .from("perfiles")
        .select("nombre")
        .eq("user_id", notif.actor_id)
        .single() as { data: { nombre: string } | null };
      actorNombre = actor?.nombre ?? null;
    }

    // 6. Build meta from entity_id if it's JSON
    let meta: Record<string, string> = {};
    if (notif.entity_id) {
      try {
        meta = JSON.parse(notif.entity_id) as Record<string, string>;
      } catch {
        meta = { id: notif.entity_id };
      }
    }

    // 7. Build push copy
    const copy = buildCopy(notif.tipo, actorNombre, meta);
    if (!copy) return new Response("no copy for tipo", { status: 200 });

    // 8. Build deep link data
    const data: Record<string, string> = {
      type: notif.tipo,
      notification_id: String(notif.id),
      ...(meta.plan_id ? { plan_id: meta.plan_id } : {}),
      ...(notif.entity_type === "plan" ? { plan_id: notif.entity_id ?? "" } : {}),
    };

    // 9. Get FCM access token and send
    const accessToken = await getFCMAccessToken();
    const staleTokens: string[] = [];

    await Promise.all(
      tokens.map(async ({ token }) => {
        const { invalidToken } = await sendFCM(token, copy.title, copy.body, data, accessToken);
        if (invalidToken) staleTokens.push(token);
      })
    );

    // 10. Remove stale tokens
    if (staleTokens.length > 0) {
      await supabase.from("push_tokens").delete().in("token", staleTokens);
    }

    return new Response(JSON.stringify({ sent: tokens.length - staleTokens.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-push] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
