-- Backfill de route_cache usando rutas ya guardadas en public.subplan.
-- Asume que:
-- - ruta_polyline/duracion_viaje/distancia_viaje se guardan en el subplan destino
-- - el origen del tramo es el subplan anterior del mismo plan y mismo dia
-- - solo se backfillean filas con coordenadas validas en origen y destino

with ordered_subplans as (
  select
    s.id,
    s.plan_id,
    s.inicio_at,
    s.orden,
    s.created_at,
    s.ubicacion_lat as dest_lat,
    s.ubicacion_lng as dest_lng,
    s.ruta_polyline,
    s.distancia_viaje,
    s.duracion_viaje,
    lag(s.ubicacion_lat) over (
      partition by s.plan_id, (s.inicio_at at time zone 'utc')::date
      order by s.inicio_at, s.orden, s.created_at, s.id
    ) as origin_lat,
    lag(s.ubicacion_lng) over (
      partition by s.plan_id, (s.inicio_at at time zone 'utc')::date
      order by s.inicio_at, s.orden, s.created_at, s.id
    ) as origin_lng
  from public.subplan s
  where s.estado = 'ACTIVO'
)
insert into public.route_cache (
  origin_lat,
  origin_lng,
  dest_lat,
  dest_lng,
  polyline,
  distance,
  duration
)
select distinct
  round(origin_lat::numeric, 4)::double precision as origin_lat,
  round(origin_lng::numeric, 4)::double precision as origin_lng,
  round(dest_lat::numeric, 4)::double precision as dest_lat,
  round(dest_lng::numeric, 4)::double precision as dest_lng,
  ruta_polyline,
  distancia_viaje,
  duracion_viaje
from ordered_subplans
where ruta_polyline is not null
  and ruta_polyline <> ''
  and origin_lat is not null
  and origin_lng is not null
  and dest_lat is not null
  and dest_lng is not null
on conflict (origin_lat, origin_lng, dest_lat, dest_lng)
do update set
  polyline = excluded.polyline,
  distance = excluded.distance,
  duration = excluded.duration,
  updated_at = now();

-- Sincronizacion automatica desde subplan -> route_cache cuando se guarda un tramo.
create or replace function public.sync_route_cache_from_subplan(p_subplan_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dest_row public.subplan%rowtype;
  origin_row public.subplan%rowtype;
begin
  select *
  into dest_row
  from public.subplan
  where id = p_subplan_id;

  if not found then
    return;
  end if;

  if coalesce(dest_row.ruta_polyline, '') = '' then
    return;
  end if;

  if dest_row.ubicacion_lat is null or dest_row.ubicacion_lng is null then
    return;
  end if;

  select *
  into origin_row
  from public.subplan s
  where s.plan_id = dest_row.plan_id
    and s.estado = 'ACTIVO'
    and (s.inicio_at at time zone 'utc')::date = (dest_row.inicio_at at time zone 'utc')::date
    and (s.inicio_at, s.orden, s.created_at, s.id) < (dest_row.inicio_at, dest_row.orden, dest_row.created_at, dest_row.id)
    and s.ubicacion_lat is not null
    and s.ubicacion_lng is not null
  order by s.inicio_at desc, s.orden desc, s.created_at desc, s.id desc
  limit 1;

  if not found then
    return;
  end if;

  insert into public.route_cache (
    origin_lat,
    origin_lng,
    dest_lat,
    dest_lng,
    polyline,
    distance,
    duration
  )
  values (
    round(origin_row.ubicacion_lat::numeric, 4)::double precision,
    round(origin_row.ubicacion_lng::numeric, 4)::double precision,
    round(dest_row.ubicacion_lat::numeric, 4)::double precision,
    round(dest_row.ubicacion_lng::numeric, 4)::double precision,
    dest_row.ruta_polyline,
    dest_row.distancia_viaje,
    dest_row.duracion_viaje
  )
  on conflict (origin_lat, origin_lng, dest_lat, dest_lng)
  do update set
    polyline = excluded.polyline,
    distance = excluded.distance,
    duration = excluded.duration,
    updated_at = now();
end;
$$;

create or replace function public.trg_sync_route_cache_from_subplan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.ruta_polyline, '') <> '' then
    perform public.sync_route_cache_from_subplan(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists subplan_sync_route_cache on public.subplan;
create trigger subplan_sync_route_cache
after insert or update of ruta_polyline, distancia_viaje, duracion_viaje, ubicacion_lat, ubicacion_lng
on public.subplan
for each row
execute function public.trg_sync_route_cache_from_subplan();
