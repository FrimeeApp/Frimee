import { createSign } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/services/supabase/server";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { handleCorsPreflight, withCors } from "@/lib/api/cors";

export const runtime = "nodejs";

/**
 * Firebase identity for the Supabase user: a custom token whose uid is the Supabase user id,
 * so Firebase Storage and Firestore rules can require a signed-in user and check ownership
 * (`request.auth.uid`). Login stays in Supabase; Firebase only learns who is asking.
 *
 * The token is a JWT signed with the service account key, built here with node:crypto
 * (what firebase-admin's createCustomToken does), so the route needs no SDK.
 * https://firebase.google.com/docs/auth/admin/create-custom-tokens#create_custom_tokens_using_a_third-party_jwt_library
 */
const AUDIENCE = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function createCustomToken(uid: string, claims: Record<string, unknown>): string | null {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim().replace(/^"|"$/g, "");
  // Pasted keys often keep their line breaks escaped, or the quotes around them.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: AUDIENCE,
    iat: now,
    exp: now + 3600,
    uid,
    claims,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${base64url(signer.sign(privateKey))}`;
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

  try {
    // «frimee»: the rules only trust tokens from here, not any Firebase account someone could create.
    const token = createCustomToken(user.id, { frimee: true });
    if (!token) return withCors(req, NextResponse.json({ error: "Firebase not configured" }, { status: 500 }));
    return withCors(req, NextResponse.json({ token }));
  } catch (error) {
    console.error("[firebase-token] No se pudo crear el token:", error);
    return withCors(req, NextResponse.json({ error: "No se pudo crear el token" }, { status: 500 }));
  }
}
