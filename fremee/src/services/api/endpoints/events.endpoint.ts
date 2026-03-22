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

  if (error) throw error;
  return (data ?? []) as CalendarEventRow[];
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

  const { data, error } = await supabase.rpc("fn_evento_insert_local", {
    p_title:            params.title,
    p_description:      params.description,
    p_category:         params.category,
    p_starts_at:        params.startsAt,
    p_ends_at:          params.endsAt,
    p_all_day:          params.allDay,
    p_color:            params.color,
    p_location_name:    params.locationName,
    p_location_address: params.locationAddress,
  });

  if (error) throw error;
  return { id: Number(data) };
}
