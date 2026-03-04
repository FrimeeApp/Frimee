import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type CalendarEventRow = {
  id: number;
  created_at: string;
  updated_at: string;
  owner_user_id: string;
  creado_por_user_id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  inicio_at: string;
  fin_at: string;
  all_day: boolean;
  color: string | null;
  ubicacion_nombre: string | null;
  ubicacion_direccion: string | null;
  source: string;
  google_calendar_id: string | null;
  google_event_id: string | null;
  sync_status: string;
};

export async function fetchUserCalendarEventsByRange(params: {
  userId: string;
  rangeStartAt: string;
  rangeEndAt: string;
  limit: number;
}) {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.rpc("fn_evento_list_by_range", {
    p_user_id: params.userId,
    p_range_start_at: params.rangeStartAt,
    p_range_end_at: params.rangeEndAt,
    p_limit: params.limit,
  });

  if (!error) {
    return (data ?? []) as CalendarEventRow[];
  }

  // Fallback para cuando la RPC aun no esta disponible en cache/permisos.
  const { data: fallbackData, error: fallbackError } = await supabase
    .from("evento")
    .select(
      "id,created_at,updated_at,owner_user_id,creado_por_user_id,titulo,descripcion,categoria,inicio_at,fin_at,all_day,color,ubicacion_nombre,ubicacion_direccion,source,google_calendar_id,google_event_id,sync_status",
    )
    .eq("owner_user_id", params.userId)
    .is("deleted_at", null)
    .eq("estado", "ACTIVO")
    .lte("inicio_at", params.rangeEndAt)
    .gte("fin_at", params.rangeStartAt)
    .order("inicio_at", { ascending: true })
    .limit(params.limit);

  if (fallbackError) {
    const rpcError = {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    };
    const directError = {
      message: fallbackError.message,
      code: fallbackError.code,
      details: fallbackError.details,
      hint: fallbackError.hint,
    };
    throw new Error(`[events] rpc+fallback failed: ${JSON.stringify({ rpcError, directError })}`);
  }

  console.warn("[events] RPC fn_evento_list_by_range failed, fallback query used", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });

  return (fallbackData ?? []) as CalendarEventRow[];
}

export async function insertLocalCalendarEvent(params: {
  userId: string;
  title: string;
  description: string | null;
  category: "TRABAJO" | "MEDICO" | "CLASE" | "PERSONAL" | "OTRO";
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: string | null;
  locationName: string | null;
  locationAddress: string | null;
}) {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("evento")
    .insert({
      owner_user_id: params.userId,
      creado_por_user_id: params.userId,
      titulo: params.title,
      descripcion: params.description,
      categoria: params.category,
      inicio_at: params.startsAt,
      fin_at: params.endsAt,
      all_day: params.allDay,
      color: params.color,
      ubicacion_nombre: params.locationName,
      ubicacion_direccion: params.locationAddress,
      source: "LOCAL",
      sync_status: "SYNCED",
      estado: "ACTIVO",
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: Number(data.id) };
}
