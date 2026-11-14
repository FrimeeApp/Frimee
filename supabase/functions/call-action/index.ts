import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCallDeclineToken } from "../_shared/callToken.ts";

// "Rechazar" pressed in the Android call notification (board M19a), with Frimee closed.
// The phone sends the signed code it got in the push; no session needed. Deploy with
// --no-verify-jwt (the request carries no user token).
//
// POST { action: "decline", llamada_id, user_id, token }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const { action, llamada_id, user_id, token } = await req.json() as {
      action?: string;
      llamada_id?: string | number;
      user_id?: string;
      token?: string;
    };
    if (action !== "decline" || !llamada_id || !user_id || !token) return json({ error: "bad request" }, 400);
    if (!(await verifyCallDeclineToken(llamada_id, user_id, token))) return json({ error: "forbidden" }, 403);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await supabase.rpc("fn_call_decline", { p_llamada_id: Number(llamada_id), p_user_id: user_id });
    if (error) {
      console.error("[call-action] decline", error.message);
      return json({ error: "decline failed" }, 500);
    }
    return json({ result: data });
  } catch (err) {
    console.error("[call-action] error:", err);
    return json({ error: String(err) }, 500);
  }
});
