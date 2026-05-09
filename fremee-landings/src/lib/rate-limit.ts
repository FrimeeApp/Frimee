import "server-only";

import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";

type RateLimitResult =
  | { limited: false; remaining: number }
  | { limited: true; retryAfter: number };

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.round(windowMs / 1000),
    });

    if (error) {
      console.error("[waitlist-rate-limit] Supabase RPC error:", error.message);
      return { limited: false, remaining: limit };
    }

    const row = data?.[0];
    if (!row) {
      return { limited: false, remaining: limit };
    }

    if (!row.allowed) {
      return { limited: true, retryAfter: Math.max(1, row.retry_after) };
    }

    return { limited: false, remaining: row.remaining };
  } catch (error) {
    console.error("[waitlist-rate-limit] unexpected error:", error);
    return { limited: false, remaining: limit };
  }
}

export function rateLimitedResponse(retryAfter: number) {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Intentalo de nuevo en unos minutos." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
