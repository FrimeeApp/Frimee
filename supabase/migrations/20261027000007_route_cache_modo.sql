-- route_cache was keyed only by origin/destination coordinates, so a route
-- computed by car was served again after switching the leg to "A pie"
-- (e.g. 12,9 km in 34 min walking). The cache now also stores the app's
-- transport value (APIE, COCHE, BUS, METRO, TREN). TAXI shares COCHE's road
-- route; BUS, METRO and TREN stay apart because /api/directions asks Google to
-- prefer that vehicle (transit_mode), so their routes differ.

-- Existing rows do not say which mode they were computed with, and the table
-- is only a cache, so it is emptied instead of guessing.
delete from public.route_cache;

alter table public.route_cache
  add column modo text not null
  constraint route_cache_modo_check check (modo in ('APIE', 'COCHE', 'BUS', 'METRO', 'TREN'));

drop index if exists public.route_cache_origin_dest_key;
create unique index route_cache_origin_dest_modo_key
  on public.route_cache using btree (origin_lat, origin_lng, dest_lat, dest_lng, modo);

-- Same key as cacheMode in /api/directions: null, TAXI and unknown values mean COCHE.
create or replace function public.route_cache_modo(p_transporte text)
returns text
language sql
immutable
set search_path = public
as $$
  select case upper(coalesce(p_transporte, 'COCHE'))
    when 'APIE' then 'APIE'
    when 'BUS' then 'BUS'
    when 'METRO' then 'METRO'
    when 'TREN' then 'TREN'
    else 'COCHE'
  end;
$$;

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
    modo,
    polyline,
    distance,
    duration
  )
  values (
    round(origin_row.ubicacion_lat::numeric, 4)::double precision,
    round(origin_row.ubicacion_lng::numeric, 4)::double precision,
    round(dest_row.ubicacion_lat::numeric, 4)::double precision,
    round(dest_row.ubicacion_lng::numeric, 4)::double precision,
    public.route_cache_modo(dest_row.transporte_llegada),
    dest_row.ruta_polyline,
    dest_row.distancia_viaje,
    dest_row.duracion_viaje
  )
  on conflict (origin_lat, origin_lng, dest_lat, dest_lng, modo)
  do update set
    polyline = excluded.polyline,
    distance = excluded.distance,
    duration = excluded.duration,
    updated_at = now();
end;
$$;

-- Only the subplan trigger needs this; it was callable by anyone through the API.
revoke execute on function public.sync_route_cache_from_subplan(bigint) from public, anon, authenticated;

-- Legs saved on subplans may hold a driving result for a walking or transit
-- leg (they came from the old cache), and transit legs never asked for the
-- chosen vehicle. Driving legs are right; clear the rest so the app computes
-- them again.
update public.subplan
set ruta_polyline = null, duracion_viaje = null, distancia_viaje = null
where public.route_cache_modo(transporte_llegada) <> 'COCHE'
  and (ruta_polyline is not null or duracion_viaje is not null or distancia_viaje is not null);

-- Google Maps Platform terms only allow caching results for a limited time
-- (30 days). Routes saved on each subplan stay; only the shared cache expires,
-- so an existing plan never calls Google again because of this.
-- Every night at 03:45 UTC, after guest-cleanup. Uses route_cache_updated_at_idx.
select cron.schedule(
  'route-cache-expire',
  '45 3 * * *',
  $$delete from public.route_cache where updated_at < now() - interval '30 days'$$
);
