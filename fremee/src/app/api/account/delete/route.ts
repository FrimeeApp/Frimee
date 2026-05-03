import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/services/supabase/server";

export async function DELETE(req: NextRequest) {
  let user = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await createSupabaseServiceClient().auth.getUser(authHeader.slice(7));
    user = data.user;
  } else {
    const { data, error } = await (await createSupabaseServerClient()).auth.getUser();
    if (!error) user = data.user;
  }

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const admin = createSupabaseServiceClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
