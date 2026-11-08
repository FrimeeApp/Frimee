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
// Los invitados (usuarios anónimos de Supabase) se crean con un clic, así que un
// límite por usuario no basta: además del cupo diario de cada invitado hay una
// bolsa común para todos, que pone un techo absoluto al gasto.

const DAY_MS = 24 * 60 * 60 * 1000;

export const GUEST_DAILY_LIMITS = {
  "ocr-ticket": { perGuest: 3, allGuests: 100 },
  "ocr-receipt": { perGuest: 3, allGuests: 100 },
  livekit: { perGuest: 2, allGuests: 50 },
} as const;

export type GuestFeature = keyof typeof GUEST_DAILY_LIMITS;

/** Cupo diario del modo invitado. Para usuarios registrados no limita nada. */
export async function checkGuestDailyLimit(
  user: { id: string; is_anonymous?: boolean },
  feature: GuestFeature,
): Promise<RateLimitResult> {
  if (!user.is_anonymous) return { limited: false, remaining: Infinity };

  const { perGuest, allGuests } = GUEST_DAILY_LIMITS[feature];
  const own = await checkRateLimit(`guest-day:${feature}:${user.id}`, perGuest, DAY_MS);
  if (own.limited) return own;
  return checkRateLimit(`guest-day:${feature}:all`, allGuests, DAY_MS);
}

export function guestLimitedResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Has llegado al límite diario del modo invitado. Crea una cuenta para seguir usando esta función." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export function rateLimitedResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
