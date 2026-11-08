import { NextRequest, NextResponse } from "next/server";
import { getProfileImagesBucket } from "@/config/external";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/services/supabase/server";

/**
 * "Eliminar cuenta". The account is anonymised in the database (fn_account_delete: shared
 * expenses and debts stay as "Usuario eliminado", personal data goes, the email is freed),
 * then the user's own files are removed from storage.
 */
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
  const { error } = await admin.rpc("fn_account_delete", { p_user_id: user.id });
  if (error) {
    console.error("[account/delete]", error.message);
    return NextResponse.json({ error: "No se pudo eliminar la cuenta. Inténtalo de nuevo." }, { status: 500 });
  }

  // Files: best effort, the account is already gone. Profile photo and wallet tickets are
  // personal; receipts and album photos belong to shared plans and stay.
  try {
    await admin.storage.from(getProfileImagesBucket()).remove([`${user.id}/image`]);
    const { data: tickets } = await admin.storage.from("plan-tickets").list(`tickets/${user.id}`, { limit: 1000 });
    if (tickets?.length) {
      await admin.storage.from("plan-tickets").remove(tickets.map((file) => `tickets/${user.id}/${file.name}`));
    }
  } catch (storageError) {
    console.error("[account/delete] storage", storageError);
  }

  return NextResponse.json({ ok: true });
}
