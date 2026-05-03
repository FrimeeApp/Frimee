import { NextRequest, NextResponse } from "next/server";
import { OPENAI_API_BASE_URL } from "@/config/external";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/services/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  let user = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await createSupabaseServiceClient().auth.getUser(authHeader.slice(7));
    user = data.user;
  } else {
    const { data } = await (await createSupabaseServerClient()).auth.getUser();
    user = data.user;
  }
  if (!user) return NextResponse.json({ toxic: false }, { status: 401 });

  const rl = await checkRateLimit(`moderate:${user.id}`, 30, 60_000);
  if (rl.limited) return rateLimitedResponse(rl.retryAfter);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ toxic: false });
  }

  try {
    const body = await req.json() as unknown;
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ toxic: false }, { status: 400 });
    }
    const text = sanitizeText((body as Record<string, unknown>).text, 2000);
    if (!text) {
      return NextResponse.json({ toxic: false });
    }

    const res = await fetch(`${OPENAI_API_BASE_URL}/moderations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });

    if (!res.ok) {
      return NextResponse.json({ toxic: false });
    }

    const data = (await res.json()) as {
      results: {
        flagged: boolean;
        categories: Record<string, boolean>;
        category_scores: Record<string, number>;
      }[];
    };

    const result = data.results[0];
    if (!result) return NextResponse.json({ toxic: false });

    return NextResponse.json({ toxic: result.flagged });
  } catch {
    return NextResponse.json({ toxic: false });
  }
}
