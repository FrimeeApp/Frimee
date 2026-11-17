/**
 * Rate limiter con ventana fija usando Supabase como backend.
 *
 * La función `check_rate_limit` de PostgreSQL es atómica (un único UPSERT),
 * por lo que funciona correctamente aunque haya múltiples servidores o
 * instancias corriendo en paralelo (producción en IONOS, App Store, Play Store).
 *
 * Si la llamada a Supabase falla (error de red, etc.) se hace fail-open:
 * se permite la petición para no bloquear a usuarios legítimos.
 */

import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/services/supabase/server";

export type RateLimitResult =
  | { limited: false; remaining: number }
  | { limited: true; retryAfter: number };

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const windowSeconds = Math.round(windowMs / 1000);

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error("[rate-limit] Supabase RPC error:", error.message);
      return { limited: false, remaining: limit };
    }

    const row = (data as { allowed: boolean; remaining: number; retry_after: number }[])[0];
    if (!row) return { limited: false, remaining: limit };

    if (!row.allowed) {
      return { limited: true, retryAfter: Math.max(1, row.retry_after) };
    }

    return { limited: false, remaining: row.remaining };
  } catch (err) {
    // Fail-open: si Supabase no está disponible, no bloquear al usuario
    console.error("[rate-limit] unexpected error:", err);
    return { limited: false, remaining: limit };
  }
}

// ── Modo invitado ──────────────────────────────────────────────────────────────
// Cupo diario de las funciones que cuestan dinero (OpenAI, Google Maps, LiveKit).
// Los invitados (usuarios anónimos de Supabase) se crean con un clic y el registro está
// abierto, así que un límite por usuario no basta: además del cupo de cada uno hay una
// bolsa común al día, que pone un techo absoluto al gasto. Los invitados tienen la suya,
// más pequeña. Los números quedan muy por encima de un uso normal.

const DAY_MS = 24 * 60 * 60 * 1000;

export const DAILY_LIMITS = {
  "ocr-ticket": { guest: 3, allGuests: 100, user: 20, allUsers: 500 },
  "ocr-receipt": { guest: 3, allGuests: 100, user: 20, allUsers: 500 },
  livekit: { guest: 2, allGuests: 50, user: 50, allUsers: 1000 },
  directions: { guest: 150, allGuests: 2000, user: 400, allUsers: 4000 },
} as const;

export type DailyFeature = keyof typeof DAILY_LIMITS;
export type DailyLimitResult = RateLimitResult & { guest: boolean };

/** Cupo diario de una función de pago para este usuario (invitado o registrado). */
export async function checkDailyLimit(
  user: { id: string; is_anonymous?: boolean },
  feature: DailyFeature,
): Promise<DailyLimitResult> {
  const limits = DAILY_LIMITS[feature];
  const guest = Boolean(user.is_anonymous);
  const kind = guest ? "guest-day" : "user-day";
  const own = await checkRateLimit(`${kind}:${feature}:${user.id}`, guest ? limits.guest : limits.user, DAY_MS);
  if (own.limited) return { ...own, guest };
  const all = await checkRateLimit(`${kind}:${feature}:all`, guest ? limits.allGuests : limits.allUsers, DAY_MS);
  return { ...all, guest };
}

export function dailyLimitedResponse(result: { guest: boolean; retryAfter: number }): NextResponse {
  const error = result.guest
    ? "Has llegado al límite diario del modo invitado. Crea una cuenta para seguir usando esta función."
    : "Has llegado al límite diario de esta función. Vuelve a intentarlo mañana.";
  return NextResponse.json({ error }, { status: 429, headers: { "Retry-After": String(result.retryAfter) } });
}

export function rateLimitedResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
