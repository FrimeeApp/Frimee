create or replace function public.fn_evento_list_by_range(
  p_user_id uuid,
  p_range_start_at timestamptz,
  p_range_end_at timestamptz,
  p_limit integer default 500
)
returns table (
  id bigint,
  created_at timestamptz,
  updated_at timestamptz,
  owner_user_id uuid,
  creado_por_user_id uuid,
  titulo text,
  descripcion text,
  categoria text,
  inicio_at timestamptz,
  fin_at timestamptz,
  all_day boolean,
  color text,
  ubicacion_nombre text,
  ubicacion_direccion text,
  source text,
  google_calendar_id text,
  google_event_id text,
  sync_status text
)
language sql
stable
as $$
  select
    e.id,
    e.created_at,
    e.updated_at,
    e.owner_user_id,
    e.creado_por_user_id,
    e.titulo,
    e.descripcion,
    e.categoria,
    e.inicio_at,
    e.fin_at,
    e.all_day,
    e.color,
    e.ubicacion_nombre,
    e.ubicacion_direccion,
    e.source,
    e.google_calendar_id,
    e.google_event_id,
    e.sync_status
  from public.evento e
  where auth.uid() = p_user_id
    and e.owner_user_id = p_user_id
    and e.deleted_at is null
    and e.estado = 'ACTIVO'
    and e.inicio_at <= p_range_end_at
    and e.fin_at >= p_range_start_at
  order by e.inicio_at asc
  limit greatest(1, least(coalesce(p_limit, 500), 2000));
$$;

grant execute on function public.fn_evento_list_by_range(uuid, timestamptz, timestamptz, integer) to authenticated;
