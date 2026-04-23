import { createBrowserSupabaseClient } from "@/services/supabase/client";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type MetodoReparto = "IGUAL" | "PORCENTAJE" | "CANTIDAD" | "POR_ITEMS";

export type GastoParte = {
  user_id: string;
  importe: number;
  nombre: string | null;
  username: string | null;
  foto: string | null;
};

export type GastoRow = {
  id: number;
  titulo: string;
  descripcion: string | null;
  total: number;
  moneda: string;
  fecha_gasto: string;
  metodo_reparto: MetodoReparto;
  categoria_id: number | null;
  categoria_nombre: string | null;
  categoria_icono: string | null;
  categoria_color: string | null;
  estado: "BORRADOR" | "CONFIRMADO" | "ANULADO";
  subplan_id: number | null;
  subplan_titulo: string | null;
  pagado_por_user_id: string;
  pagado_por_nombre: string | null;
  pagado_por_username: string | null;
  pagado_por_foto: string | null;
  partes: GastoParte[] | null;
  receipt_url: string | null;
  created_at: string;
};

export type BalanceRow = {
  liquidacion_id: number;
  from_user_id: string;
  from_nombre: string | null;
  from_profile_image: string | null;
  to_user_id: string;
  to_nombre: string | null;
  to_profile_image: string | null;
  importe: number;
};

export async function pagarLiquidacionEndpoint(liquidacionId: number, comprobanteUrl: string | null): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_liquidacion_pagar", {
    p_liquidacion_id: liquidacionId,
    p_comprobante_url: comprobanteUrl,
  });
  if (error) throw error;
}

export async function uploadComprobanteEndpoint(file: File, userId: string): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `comprobantes/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, { upsert: true });
  if (error) throw error;
  // Guardamos el path, las URLs firmadas se generan al mostrar
  return path;
}

export async function getComprobanteSignedUrl(path: string): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 60); // 1h
  if (error) throw error;
  return data.signedUrl;
}

// Participante para repartos IGUAL / CANTIDAD / PORCENTAJE
export type Participante =
  | { user_id: string }                           // IGUAL
  | { user_id: string; importe: number }          // CANTIDAD
  | { user_id: string; porcentaje: number };      // PORCENTAJE

// Ítem para reparto POR_ITEMS
export type GastoItemInput = {
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
  usuarios: { user_id: string; subtotal_asignado: number }[];
};

// Parámetros para crear / actualizar un gasto
export type GastoInput = {
  plan_id: number;
  titulo: string;
  pagado_por_user_id: string;
  fecha_gasto: string;        // ISO string
  total: number;
  metodo_reparto: MetodoReparto;
  participantes: Participante[];
  descripcion?: string;
  subplan_id?: number;
  categoria_id?: number;
  moneda?: string;
  items?: GastoItemInput[];   // solo para POR_ITEMS
  receipt_url?: string | null;
};

export type PlanMiembro = {
  user_id: string;
  nombre: string | null;
  username: string | null;
  foto: string | null;
};

// ── Endpoints ────────────────────────────────────────────────────────────────

/** Devuelve los miembros activos de un plan */
export async function fetchPlanMiembrosEndpoint(planId: number): Promise<PlanMiembro[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_plan_get_miembros", { p_plan_id: planId });
  if (error) throw error;
  return (data ?? []) as PlanMiembro[];
}

/** Lista todos los gastos activos de un plan con sus partes y datos del pagador */
export async function listGastosForPlanEndpoint(planId: number): Promise<GastoRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_gastos_list_for_plan", {
    p_plan_id: planId,
  });
  if (error) throw error;
  return (data ?? []) as GastoRow[];
}

/** Crea un gasto confirmado y recalcula liquidaciones */
export async function createGastoEndpoint(input: GastoInput): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_gasto_create", {
    p_plan_id:            input.plan_id,
    p_titulo:             input.titulo,
    p_pagado_por_user_id: input.pagado_por_user_id,
    p_fecha_gasto:        input.fecha_gasto,
    p_total:              input.total,
    p_metodo_reparto:     input.metodo_reparto,
    p_participantes:      input.participantes,
    p_descripcion:        input.descripcion ?? null,
    p_subplan_id:         input.subplan_id ?? null,
    p_categoria_id:       input.categoria_id ?? null,
    p_moneda:             input.moneda ?? "EUR",
    p_items:              input.items ?? null,
    p_receipt_url:        input.receipt_url ?? null,
  });
  if (error) throw error;
  return data as number;
}

/** Actualiza un gasto existente y recalcula liquidaciones */
export async function updateGastoEndpoint(
  gastoId: number,
  input: Omit<GastoInput, "plan_id">
): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_gasto_update", {
    p_gasto_id:           gastoId,
    p_titulo:             input.titulo,
    p_pagado_por_user_id: input.pagado_por_user_id,
    p_fecha_gasto:        input.fecha_gasto,
    p_total:              input.total,
    p_metodo_reparto:     input.metodo_reparto,
    p_participantes:      input.participantes,
    p_descripcion:        input.descripcion ?? null,
    p_subplan_id:         input.subplan_id ?? null,
    p_categoria_id:       input.categoria_id ?? null,
    p_moneda:             input.moneda ?? "EUR",
    p_items:              input.items ?? null,
    p_receipt_url:        input.receipt_url ?? null,
  });
  if (error) throw error;
}

/** Anula un gasto (soft delete) y recalcula liquidaciones */
export async function deleteGastoEndpoint(gastoId: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_gasto_anular", {
    p_gasto_id: gastoId,
  });
  if (error) throw error;
}

/** Devuelve los balances pendientes del plan (quién debe qué a quién) */
export async function getBalancesForPlanEndpoint(planId: number): Promise<BalanceRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_balances_for_plan", {
    p_plan_id: planId,
  });
  if (error) throw error;
  return (data ?? []) as BalanceRow[];
}
