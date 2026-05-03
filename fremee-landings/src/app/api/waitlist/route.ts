import { NextResponse } from "next/server";
import { isValidEmailInput, sanitizeEmailInput } from "@/lib/sanitize";
import { createServerSupabaseClient } from "@/lib/supabase";

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

  if (!isValidEmailInput(email)) {
    return NextResponse.json({ error: "Introduce un email válido." }, { status: 400 });
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
