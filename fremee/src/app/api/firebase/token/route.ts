import { NextRequest, NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createSupabaseServiceClient } from "@/services/supabase/server";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { handleCorsPreflight, withCors } from "@/lib/api/cors";

/**
 * Firebase identity for the Supabase user: a custom token whose uid is the Supabase user id,
 * so Firebase Storage and Firestore rules can require a signed-in user and check ownership
 * (`request.auth.uid`). Login stays in Supabase; Firebase only learns who is asking.
 */
function firebaseAdminAuth() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Pasted keys often keep their line breaks escaped.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getAuth(app);
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function POST(req: NextRequest) {
  const accessToken = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!accessToken) return withCors(req, NextResponse.json({ error: "unauthorized" }, { status: 401 }));

  const supabase = createSupabaseServiceClient();
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) return withCors(req, NextResponse.json({ error: "unauthorized" }, { status: 401 }));

  const rl = await checkRateLimit(`firebase-token:${user.id}`, 20, 60_000);
  if (rl.limited) return withCors(req, rateLimitedResponse(rl.retryAfter));

  const auth = firebaseAdminAuth();
  if (!auth) return withCors(req, NextResponse.json({ error: "Firebase not configured" }, { status: 500 }));

  try {
    const token = await auth.createCustomToken(user.id);
    return withCors(req, NextResponse.json({ token }));
  } catch (error) {
    console.error("[firebase-token] No se pudo crear el token:", error);
    return withCors(req, NextResponse.json({ error: "No se pudo crear el token" }, { status: 500 }));
  }
}
