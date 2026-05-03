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

export function rateLimitedResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
