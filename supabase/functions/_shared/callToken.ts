// Signed code for "Rechazar" in the Android call notification (board M19a). The phone has no
// session at that moment (Frimee may be closed), so send-push gives each recipient a code for
// that call and that person, and call-action checks it. HMAC-SHA256 with the service role key,
// which only the functions know.

const encoder = new TextEncoder();

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function callDeclineToken(llamadaId: string | number, userId: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(`decline:${llamadaId}:${userId}`));
  return toHex(signature);
}

export async function verifyCallDeclineToken(llamadaId: string | number, userId: string, token: string): Promise<boolean> {
  const expected = await callDeclineToken(llamadaId, userId);
  if (expected.length !== token.length) return false;
  // Constant-time comparison.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
