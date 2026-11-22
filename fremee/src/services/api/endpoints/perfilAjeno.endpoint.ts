import { createBrowserSupabaseClient } from "@/services/supabase/client";

/** Lo que el servidor resuelve del perfil de otra persona: vuestra relación, qué ves de su pasaporte y lo que tenéis en común. */

export type Relacion = "friend" | "none" | "request_sent" | "request_received";
export type AccesoPasaporte = "visible" | "friends_only" | "hidden";

export type PlanComun = { plan_id: number; titulo: string; inicio_at: string; fin_at: string; all_day: boolean; personas?: number };

export type PerfilAjeno = {
  es_mio: boolean;
  relacion: Relacion;
  acceso_pasaporte: AccesoPasaporte;
  en_comun: { paises: string[]; viajes_juntos: PlanComun[]; planes_compartidos: PlanComun[] };
  /** Planes terminados que hicisteis juntos (vacío si su ajuste «con quién viajaste» está apagado). */
  juntos_plan_ids: number[];
};

const VACIO: PerfilAjeno = {
  es_mio: false,
  relacion: "none",
  acceso_pasaporte: "hidden",
  en_comun: { paises: [], viajes_juntos: [], planes_compartidos: [] },
  juntos_plan_ids: [],
};

export async function getPerfilAjeno(userId: string): Promise<PerfilAjeno> {
  const { data, error } = await createBrowserSupabaseClient().rpc("fn_perfil_ajeno", { p_user_id: userId });
  if (error) throw error;
  const r = (data ?? {}) as Partial<PerfilAjeno>;
  return {
    es_mio: Boolean(r.es_mio),
    relacion: r.relacion ?? VACIO.relacion,
    acceso_pasaporte: r.acceso_pasaporte ?? VACIO.acceso_pasaporte,
    en_comun: {
      paises: r.en_comun?.paises ?? [],
      viajes_juntos: r.en_comun?.viajes_juntos ?? [],
      planes_compartidos: r.en_comun?.planes_compartidos ?? [],
    },
    juntos_plan_ids: r.juntos_plan_ids ?? [],
  };
}
