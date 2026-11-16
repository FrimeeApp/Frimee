import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type InicioMiembro = { id: string; nombre: string; foto: string | null };

export type InicioEncuesta = {
  mensaje_id: number;
  pregunta: string;
  votantes: number;
  he_votado: boolean;
};

export type InicioActividad = {
  id: number;
  titulo: string;
  inicio_at: string;
  fin_at: string;
  all_day: boolean;
  ubicacion: string | null;
};

export type InicioPlanExtra = {
  plan_id: number;
  miembros: InicioMiembro[];
  chat_id: string | null;
  no_leidos: number;
  encuestas: InicioEncuesta[];
  hoy: InicioActividad[];
  /** Plan in progress only: first two activities of tomorrow (empty on the last day). */
  manana?: InicioActividad[];
  /** Plan in progress only: album photos and live expenses. */
  fotos?: number;
  gastos?: number;
};

export type InicioInvitacion = {
  notificacion_id: number;
  plan_id: number;
  plan_titulo: string;
  de_id: string | null;
  de_nombre: string | null;
  created_at: string;
};

export type MisPlanesInicio = {
  planes: InicioPlanExtra[];
  invitaciones: InicioInvitacion[];
};

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
  } catch {
    return "Europe/Madrid";
  }
}

/** Everything the «Mis planes» home needs besides the plan list itself, in one call (fn_mis_planes_inicio, step 2.34). */
export async function fetchMisPlanesInicio(): Promise<MisPlanesInicio> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_mis_planes_inicio", { p_tz: deviceTimeZone() });
  if (error) throw error;
  const result = (data ?? {}) as Partial<MisPlanesInicio>;
  return { planes: result.planes ?? [], invitaciones: result.invitaciones ?? [] };
}
