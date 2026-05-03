import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createSupabaseServiceClient } from "@/services/supabase/server";
import { sanitizeRoomName, sanitizeUuid } from "@/lib/sanitize";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { handleCorsPreflight, withCors } from "@/lib/api/cors";

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  if (!accessToken) return withCors(req, NextResponse.json({ error: "unauthorized" }, { status: 401 }));

  const supabase = createSupabaseServiceClient();
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) return withCors(req, NextResponse.json({ error: "unauthorized" }, { status: 401 }));

  const rl = await checkRateLimit(`livekit:${user.id}`, 10, 60_000);
  if (rl.limited) return withCors(req, rateLimitedResponse(rl.retryAfter));

  const body = await req.json() as unknown;
  if (typeof body !== "object" || body === null) {
    return withCors(req, NextResponse.json({ error: "Invalid request body" }, { status: 400 }));
  }
  const raw = body as Record<string, unknown>;
  const roomName = sanitizeRoomName(raw.roomName);
  if (!roomName) return withCors(req, NextResponse.json({ error: "roomName invalido o requerido" }, { status: 400 }));
  const chatId = raw.chatId != null ? sanitizeUuid(raw.chatId) : null;
  if (raw.chatId != null && !chatId) {
    return withCors(req, NextResponse.json({ error: "chatId invalido" }, { status: 400 }));
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return withCors(req, NextResponse.json({ error: "Livekit not configured" }, { status: 500 }));
  }

  if (chatId) {
    const { data: member } = await supabase
      .from("chat_miembro")
      .select("user_id")
      .eq("chat_id", chatId)
      .eq("user_id", user.id)
      .single();
    if (!member) return withCors(req, NextResponse.json({ error: "forbidden" }, { status: 403 }));
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    ttl: "1h",
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return withCors(req, NextResponse.json({ token }));
}
