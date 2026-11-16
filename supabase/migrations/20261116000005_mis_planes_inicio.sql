-- Mis planes · Inicio (paso 2.34)
-- Una sola llamada con lo que pinta el Inicio de «Mis planes», para no pedir plan a plan:
--   planes[]: por cada plan activo de la persona → miembros (tú primero), no leídos del chat del plan,
--             encuestas abiertas del chat del plan (votantes, si ya has votado) y actividades de hoy
--             (solo si el plan está en curso).
--   invitaciones[]: invitaciones a planes sin responder (notificaciones 'plan_invite').
-- p_tz: zona horaria del dispositivo, para saber qué es «hoy».

create or replace function public.fn_mis_planes_inicio(p_tz text default 'Europe/Madrid')
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_tz text := coalesce(nullif(p_tz, ''), 'Europe/Madrid');
  v_hoy date;
  v_planes jsonb;
  v_inv jsonb;
begin
  if v_me is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  begin
    v_hoy := (now() at time zone v_tz)::date;
  exception when others then
    v_tz := 'Europe/Madrid';
    v_hoy := (now() at time zone v_tz)::date;
  end;

  with mis as (
    select p.id, p.inicio_at, p.fin_at
      from plan p
     where p.deleted_at is null
       and p.estado = 'ACTIVO'
       and (
         p.creado_por_user_id = v_me
         or p.owner_user_id = v_me
         or exists (select 1 from plan_usuarios pu
                     where pu.plan_id = p.id and pu.user_id = v_me and pu.estado = 'PARTICIPA')
       )
  ),
  chat_plan as (
    select distinct on (c.plan_id) c.plan_id, c.id as chat_id
      from chat c join mis on mis.id = c.plan_id
     where c.tipo = 'PLAN'
     order by c.plan_id, c.created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'plan_id', mis.id,
      'miembros', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', u.id,
                 'nombre', u.nombre,
                 'foto', public.fn_foto_visible(u.id, u.profile_image))
               order by (u.id = v_me) desc, pu.created_at)
          from plan_usuarios pu join usuarios u on u.id = pu.user_id
         where pu.plan_id = mis.id and pu.estado = 'PARTICIPA'), '[]'::jsonb),
      'chat_id', cp.chat_id,
      'no_leidos', case when cp.chat_id is null then 0 else (
        select count(*)
          from mensajes m
          left join chat_miembro cm on cm.chat_id = m.chat_id and cm.user_id = v_me
         where m.chat_id = cp.chat_id
           and m.id > coalesce(cm.vaciado_hasta, 0)
           and m.created_at > coalesce(cm.last_read_at, '-infinity'::timestamptz)
           and m.sender_id is distinct from v_me
           and not exists (select 1 from mensaje_oculto o where o.user_id = v_me and o.mensaje_id = m.id)
      ) end,
      'encuestas', case when cp.chat_id is null then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object(
                 'mensaje_id', e.id,
                 'pregunta', e.j->>'question',
                 'votantes', (select count(distinct v.user_id) from poll_votes v where v.mensaje_id = e.id),
                 'he_votado', exists (select 1 from poll_votes v where v.mensaje_id = e.id and v.user_id = v_me))
               order by e.id)
          from (
            select m.id, public.try_jsonb(m.texto) as j
              from mensajes m
             where m.chat_id = cp.chat_id
               and m.texto like '{"type":"poll"%'
               and not exists (select 1 from mensaje_oculto o where o.user_id = v_me and o.mensaje_id = m.id)
          ) e
         where e.j->>'type' = 'poll'
           and not coalesce((e.j->>'closed')::boolean, false)
           and (e.j->>'expires_at' is null or (e.j->>'expires_at')::timestamptz > now())
      ), '[]'::jsonb) end,
      'hoy', case
        when v_hoy between (mis.inicio_at at time zone v_tz)::date and (mis.fin_at at time zone v_tz)::date then coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', s.id,
                   'titulo', s.titulo,
                   'inicio_at', s.inicio_at,
                   'fin_at', s.fin_at,
                   'all_day', s.all_day,
                   'ubicacion', s.ubicacion_nombre)
                 order by s.all_day desc, s.inicio_at, s.orden)
            from subplan s
           where s.plan_id = mis.id
             and s.estado = 'ACTIVO'
             and v_hoy between (s.inicio_at at time zone v_tz)::date and (s.fin_at at time zone v_tz)::date
        ), '[]'::jsonb)
        else '[]'::jsonb end,
      -- Only for a plan in progress: tomorrow's first two activities, album photos and live expenses
      -- (the «En curso» card looks ahead, and on the last day at settling up and the album).
      'manana', case
        when v_hoy between (mis.inicio_at at time zone v_tz)::date and (mis.fin_at at time zone v_tz)::date - 1 then coalesce((
          select jsonb_agg(x.a order by x.ord)
            from (
              select jsonb_build_object(
                       'id', s.id,
                       'titulo', s.titulo,
                       'inicio_at', s.inicio_at,
                       'fin_at', s.fin_at,
                       'all_day', s.all_day,
                       'ubicacion', s.ubicacion_nombre) as a,
                     row_number() over (order by s.all_day desc, s.inicio_at, s.orden) as ord
                from subplan s
               where s.plan_id = mis.id
                 and s.estado = 'ACTIVO'
                 and v_hoy + 1 between (s.inicio_at at time zone v_tz)::date and (s.fin_at at time zone v_tz)::date
            ) x
           where x.ord <= 2
        ), '[]'::jsonb)
        else '[]'::jsonb end,
      'fotos', case
        when v_hoy between (mis.inicio_at at time zone v_tz)::date and (mis.fin_at at time zone v_tz)::date
          then (select count(*) from plan_fotos f where f.plan_id = mis.id)
        else 0 end,
      'gastos', case
        when v_hoy between (mis.inicio_at at time zone v_tz)::date and (mis.fin_at at time zone v_tz)::date
          then (select count(*) from gastos g where g.plan_id = mis.id and g.deleted_at is null and g.estado <> 'ANULADO')
        else 0 end
    )), '[]'::jsonb)
    into v_planes
    from mis left join chat_plan cp on cp.plan_id = mis.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'notificacion_id', n.id,
      'plan_id', p.id,
      'plan_titulo', p.titulo,
      'de_id', n.actor_id,
      'de_nombre', ua.nombre,
      'created_at', n.created_at)
    order by n.created_at desc), '[]'::jsonb)
    into v_inv
    from notificaciones n
    join plan p on p.id::text = n.entity_id and p.deleted_at is null and p.estado = 'ACTIVO'
    left join usuarios ua on ua.id = n.actor_id
   where n.user_id = v_me
     and n.tipo = 'plan_invite'
     and not exists (select 1 from plan_usuarios pu
                      where pu.plan_id = p.id and pu.user_id = v_me and pu.estado = 'PARTICIPA');

  return jsonb_build_object('planes', v_planes, 'invitaciones', v_inv);
end;
$$;

revoke all on function public.fn_mis_planes_inicio(text) from public, anon;
grant execute on function public.fn_mis_planes_inicio(text) to authenticated;
