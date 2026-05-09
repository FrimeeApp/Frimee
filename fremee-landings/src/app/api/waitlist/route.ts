import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { isValidEmailInput, sanitizeEmailInput } from "@/lib/sanitize";
import { createServerSupabaseClient } from "@/lib/supabase";

const IP_RATE_LIMIT = {
  limit: 8,
  windowMs: 10 * 60 * 1000,
};

const EMAIL_RATE_LIMIT = {
  limit: 3,
  windowMs: 60 * 60 * 1000,
};

export async function POST(request: Request) {
  let body: unknown;

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type inválido." }, { status: 415 });
  }

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const email = sanitizeEmailInput(
    typeof body === "object" && body && "email" in body ? body.email : "",
  );
  const honeypot = typeof body === "object" && body && "website" in body ? body.website : "";

  if (typeof honeypot === "string" && honeypot.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!isValidEmailInput(email)) {
    return NextResponse.json({ error: "Introduce un email válido." }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const ipLimit = await checkRateLimit(`waitlist:ip:${clientIp}`, IP_RATE_LIMIT.limit, IP_RATE_LIMIT.windowMs);

  if (ipLimit.limited) {
    return rateLimitedResponse(ipLimit.retryAfter);
  }

  const emailLimit = await checkRateLimit(`waitlist:email:${email}`, EMAIL_RATE_LIMIT.limit, EMAIL_RATE_LIMIT.windowMs);

  if (emailLimit.limited) {
    return rateLimitedResponse(emailLimit.retryAfter);
  }

  let supabase: ReturnType<typeof createServerSupabaseClient>;

  try {
    supabase = createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "Supabase no está configurado." }, { status: 500 });
  }

  const { error } = await supabase.from("waitlist").insert({
    email,
    source: "landing",
  });

  if (!error) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (error.code === "23505") {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  return NextResponse.json({ error: "No se pudo guardar el email." }, { status: 500 });
}
