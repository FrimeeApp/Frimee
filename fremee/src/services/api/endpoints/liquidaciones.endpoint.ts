import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type LiquidacionRow = {
  id: number;
  plan_id: number;
  plan_titulo: string | null;
  from_user_id: string;
  to_user_id: string;
  importe: number;
  fecha: string;
  nota: string | null;
  estado: "PENDIENTE" | "EN_REVISION" | "CONFIRMADA" | "ANULADA";
  counterparty_id: string;
  counterparty_nombre: string | null;
  counterparty_username: string | null;
  counterparty_profile_image: string | null;
};

export async function listLiquidacionesForUserEndpoint(): Promise<LiquidacionRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_liquidaciones_list_for_user");
  if (error) throw error;
  return (data ?? []) as LiquidacionRow[];
}

export async function requestConfirmationEndpoint(liquidacionId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_liquidacion_request_confirmation", {
    p_liquidacion_id: liquidacionId,
  });
  if (error) throw error;
}

export async function confirmReceiptEndpoint(liquidacionId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_liquidacion_confirm_receipt", {
    p_liquidacion_id: liquidacionId,
  });
  if (error) throw error;
}

export async function rejectReceiptEndpoint(liquidacionId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_liquidacion_reject_receipt", {
    p_liquidacion_id: liquidacionId,
  });
  if (error) throw error;
}
