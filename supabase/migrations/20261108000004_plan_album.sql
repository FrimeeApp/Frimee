-- Trip album: everything the album page needs for one plan, in one call.
-- The page groups activities, expenses and photos by day in the viewer's time zone.
-- Only members of the plan can read it (same rule as is_plan_member).

create or replace function public.fn_plan_album(p_plan_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from plan_usuarios where plan_id = p_plan_id and user_id = auth.uid()
  ) then
    raise exception 'permission denied for plan %', p_plan_id using errcode = '42501';
  end if;

  select jsonb_build_object(
    'plan', (
      select jsonb_build_object(
        'id', p.id,
        'titulo', p.titulo,
        'descripcion', p.descripcion,
        'inicio_at', p.inicio_at,
        'fin_at', p.fin_at,
        'ubicacion_nombre', p.ubicacion_nombre,
        'foto_portada', p.foto_portada
      )
      from plan p
      where p.id = p_plan_id and p.deleted_at is null
    ),
    'miembros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'nombre', u.nombre,
        'username', u.username,
        'foto', u.profile_image
      ) order by pu.created_at)
      from plan_usuarios pu
      join usuarios_public u on u.id = pu.user_id
      where pu.plan_id = p_plan_id and u.deleted_at is null
    ), '[]'::jsonb),
    'actividades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'titulo', s.titulo,
        'descripcion', s.descripcion,
        'tipo', s.tipo,
        'inicio_at', s.inicio_at,
        'fin_at', s.fin_at,
        'all_day', s.all_day,
        'ubicacion_nombre', s.ubicacion_nombre,
        'lat', s.ubicacion_lat,
        'lng', s.ubicacion_lng,
        'fin_nombre', s.ubicacion_fin_nombre,
        'fin_lat', s.ubicacion_fin_lat,
        'fin_lng', s.ubicacion_fin_lng,
        'transporte_llegada', s.transporte_llegada,
        'duracion_viaje', s.duracion_viaje,
        'distancia_viaje', s.distancia_viaje,
        'ruta_polyline', s.ruta_polyline
      ) order by s.inicio_at, s.orden, s.id)
      from subplan s
      where s.plan_id = p_plan_id and s.estado = 'ACTIVO'
    ), '[]'::jsonb),
    'gastos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'titulo', g.titulo,
        'total', g.total,
        'moneda', g.moneda,
        'fecha_gasto', g.fecha_gasto,
        'categoria', c.nombre,
        'subplan_id', g.subplan_id,
        'pagado_por_user_id', g.pagado_por_user_id
      ) order by g.fecha_gasto)
      from gastos g
      left join categorias_gasto c on c.id = g.categoria_id
      where g.plan_id = p_plan_id and g.estado = 'CONFIRMADO'
    ), '[]'::jsonb),
    'fotos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'url', f.url,
        'user_id', f.user_id,
        'created_at', f.created_at
      ) order by f.created_at)
      from plan_fotos f
      where f.plan_id = p_plan_id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.fn_plan_album(bigint) from public, anon;
grant execute on function public.fn_plan_album(bigint) to authenticated;
