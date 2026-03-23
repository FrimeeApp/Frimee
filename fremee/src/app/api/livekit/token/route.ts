import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createSupabaseServiceClient } from "@/services/supabase/server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  if (!accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createSupabaseServiceClient();
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { roomName, chatId } = await req.json();
  if (!roomName) return NextResponse.json({ error: "roomName required" }, { status: 400 });

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Livekit not configured" }, { status: 500 });
  }

  // Verify user is member of the chat
  if (chatId) {
    const { data: member } = await supabase
      .from("chat_miembro")
      .select("user_id")
      .eq("chat_id", chatId)
      .eq("user_id", user.id)
      .single();
    if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
  return NextResponse.json({ token });
}
