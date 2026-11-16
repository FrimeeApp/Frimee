-- Encuestas: cerrar, empatar y desempatar (tableros po-*, po-sistema) · paso de publicación 2.30.
--
-- 1) El resultado vive en la encuesta: al cerrarla se guarda en su JSON `resultado`
--    ('decidida' | 'empate' | 'sin_votos'), `ganadora`, `empatadas`, `votos`, `closed_at`,
--    `closed_by` (null si se cerró sola) y `cierre` ('manual' | 'auto').
--    Ya no se publica «Votación cerrada: …»: queda un mensaje {"type":"poll_cerrada"} que la app
--    no pinta y que alimenta la vista previa de la lista de chats.
-- 2) fn_poll_vote exige ser miembro del chat, que la encuesta siga abierta y una opción válida
--    (antes cualquiera, incluso sin sesión, podía votar en cualquier mensaje), y la cierra sola
--    cuando ha votado todo el chat.
-- 3) Cerrar: quien la creó o un admin (grupo o plan); si la creó Frimee, cualquiera del chat.
-- 4) «Desempatar» (cualquiera del chat): encuesta nueva con las empatadas, enlazada a la anterior.
-- 5) «Decidir yo» (quien la creó o un admin): elige una de las empatadas.
-- 6) fn_poll_votos: quién votó qué (para «Faltan Lucía y Marcos» y «Ver votos»).
-- 7) Un empate no es una decisión (fn_momento_decidido) y una encuesta sin votos no es un hito
--    en la regla (fn_chat_indice).
--
-- 8) Empate: «Reabrir para…» si falta gente (fn_poll_reabrir, avisa con poll_reopen) o «Sortear»
--    si ya votaron todos (fn_poll_sortear: el servidor elige una vez).
--
-- Cambian de tipo de retorno (se borran y se crean): fn_poll_close y fn_poll_vote (void → jsonb).

-- ¿Es admin del chat (grupo enlazado o plan)? Interna.
create or replace function public.fn_chat_es_admin(p_chat_id uuid, p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select exists (
    select 1 from chat c
     where c.id = p_chat_id
       and ((c.grupo_id is not null and exists (
              select 1 from miembros_grupo g where g.grupo_id = c.grupo_id and g.user_id = p_user
                 and g.rol = 'ADMIN' and g.estado = 'ACTIVO'))
         or (c.tipo = 'PLAN' and c.plan_id is not null and exists (
              select 1 from plan_usuarios pu where pu.plan_id = c.plan_id and pu.user_id = p_user
                 and pu.rol = 'ADMIN' and pu.estado = 'PARTICIPA'))));
$$;
revoke all on function public.fn_chat_es_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_chat_es_admin(uuid, uuid) to service_role;

-- Recuento de una encuesta (interna): {resultado, ganadora, empatadas, votos, total}.
create or replace function public.fn_poll_resultado(p_mensaje_id bigint, p_n_opciones integer)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_votos int[] := array_fill(0, array[greatest(p_n_opciones, 0)]);
  v_total int := 0;
  v_max int := 0;
  v_empatadas jsonb := '[]'::jsonb;
  r record;
  i int;
begin
  for r in select option_index, count(*)::int as n from poll_votes
            where mensaje_id = p_mensaje_id and option_index between 0 and p_n_opciones - 1
            group by option_index loop
    v_votos[r.option_index + 1] := r.n;
    v_total := v_total + r.n;
  end loop;
  if v_total = 0 then
    return jsonb_build_object('resultado', 'sin_votos', 'votos', to_jsonb(v_votos), 'total', 0);
  end if;
  select max(x) into v_max from unnest(v_votos) x;
  for i in 1 .. p_n_opciones loop
    if v_votos[i] = v_max then v_empatadas := v_empatadas || to_jsonb(i - 1); end if;
  end loop;
  if jsonb_array_length(v_empatadas) = 1 then
    return jsonb_build_object('resultado', 'decidida', 'ganadora', v_empatadas->0,
                              'votos', to_jsonb(v_votos), 'total', v_total);
  end if;
  return jsonb_build_object('resultado', 'empate', 'empatadas', v_empatadas,
                            'votos', to_jsonb(v_votos), 'total', v_total);
end;
$$;
revoke all on function public.fn_poll_resultado(bigint, integer) from public, anon, authenticated;
grant execute on function public.fn_poll_resultado(bigint, integer) to service_role;

-- Texto de la vista previa de una encuesta cerrada o decidida.
create or replace function public.fn_poll_preview(p_j jsonb)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $$
  select case
    when p_j->>'resultado' = 'decidida' and p_j ? 'decidida_por' then
      'Encuesta decidida · ' || (p_j->'options'->>((p_j->>'ganadora')::int))
    when p_j->>'resultado' = 'decidida' then
      'Encuesta cerrada · ' || (p_j->'options'->>((p_j->>'ganadora')::int))
    when p_j->>'resultado' = 'empate' then
      'Encuesta cerrada · Empate: ' || (
        select string_agg(p_j->'options'->>(e::int), ' o ' order by ord)
          from jsonb_array_elements_text(p_j->'empatadas') with ordinality as t(e, ord))
    else 'Encuesta cerrada sin votos'
  end;
$$;
revoke all on function public.fn_poll_preview(jsonb) from public, anon, authenticated;
grant execute on function public.fn_poll_preview(jsonb) to service_role;

-- Deja el mensaje {"type":"poll_cerrada"} y actualiza la lista de chats. Interna.
create or replace function public.fn_poll_aviso(p_chat_id uuid, p_poll_id bigint, p_actor uuid, p_j jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_preview text := public.fn_poll_preview(p_j);
  v_texto text;
  v_id bigint;
begin
  v_texto := jsonb_build_object('type', 'poll_cerrada', 'poll_id', p_poll_id,
                                'resultado', p_j->>'resultado', 'texto', v_preview)::text;
  insert into mensajes (chat_id, sender_id, texto, leido_por)
  values (p_chat_id, p_actor, v_texto, case when p_actor is null then '{}'::uuid[] else array[p_actor] end)
  returning id into v_id;
  update chat set last_message = v_preview, last_message_at = now() where id = p_chat_id;
  return jsonb_build_object('aviso_id', v_id, 'aviso_texto', v_texto);
end;
$$;
revoke all on function public.fn_poll_aviso(uuid, bigint, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_poll_aviso(uuid, bigint, uuid, jsonb) to service_role;

-- Cierra una encuesta ya bloqueada (interna). p_actor null = se cerró sola.
create or replace function public.fn_poll_cerrar_interno(p_mensaje_id bigint, p_actor uuid, p_auto boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_m record;
  v_j jsonb;
  v_res jsonb;
  v_actor_nombre text;
  v_aviso jsonb;
begin
  select id, chat_id, texto into v_m from mensajes where id = p_mensaje_id for update;
  v_j := public.try_jsonb(v_m.texto);
  if coalesce((v_j->>'closed')::boolean, false) then
    return jsonb_build_object('poll_texto', v_m.texto, 'ya_cerrada', true);
  end if;
  v_res := public.fn_poll_resultado(p_mensaje_id, jsonb_array_length(coalesce(v_j->'options', '[]'::jsonb)));
  select nombre into v_actor_nombre from usuarios where id = p_actor;
  v_j := v_j || v_res || jsonb_build_object(
    'closed', true,
    'closed_at', now(),
    'cierre', case when p_auto then 'auto' else 'manual' end,
    'closed_by', case when p_auto then null else p_actor end,
    'closed_by_nombre', case when p_auto then null else coalesce(v_actor_nombre, 'Alguien') end);
  v_j := jsonb_strip_nulls(v_j);
  update mensajes set texto = v_j::text where id = p_mensaje_id;
  v_aviso := public.fn_poll_aviso(v_m.chat_id, p_mensaje_id, p_actor, v_j);
  return jsonb_build_object('poll_texto', v_j::text) || v_aviso;
end;
$$;
revoke all on function public.fn_poll_cerrar_interno(bigint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.fn_poll_cerrar_interno(bigint, uuid, boolean) to service_role;

-- La encuesta de un mensaje, comprobando que eres del chat (interna).
create or replace function public.fn_poll_de(p_mensaje_id bigint,
  out id bigint, out chat_id uuid, out sender_id uuid, out j jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
begin
  select m.id, m.chat_id, m.sender_id, public.try_jsonb(m.texto)
    into id, chat_id, sender_id, j
    from mensajes m where m.id = p_mensaje_id;
  if id is null or not public.is_chat_member(chat_id) then
    raise exception 'Encuesta no encontrada' using errcode = '42501';
  end if;
  if j->>'type' is distinct from 'poll' then
    raise exception 'Ese mensaje no es una encuesta' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.fn_poll_de(bigint) from public, anon, authenticated;
grant execute on function public.fn_poll_de(bigint) to service_role;

-- 3) Cerrar.
drop function if exists public.fn_poll_close(bigint);
create function public.fn_poll_close(p_mensaje_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
  v_sender uuid;
  v_j jsonb;
begin
  select d.chat_id, d.sender_id, d.j into v_chat, v_sender, v_j
    from public.fn_poll_de(p_mensaje_id) d;
  if v_sender is not null and v_sender <> v_me and not public.fn_chat_es_admin(v_chat, v_me) then
    raise exception 'Solo quien creó la encuesta o un admin puede cerrarla' using errcode = '42501';
  end if;
  return public.fn_poll_cerrar_interno(p_mensaje_id, v_me, false);
end;
$$;

-- 2) Votar (y cierre automático cuando ha votado todo el chat).
drop function if exists public.fn_poll_vote(bigint, integer);
create function public.fn_poll_vote(p_mensaje_id bigint, p_option_index integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
  v_j jsonb;
  v_miembros int;
  v_votantes int;
begin
  select d.chat_id, d.j into v_chat, v_j
    from public.fn_poll_de(p_mensaje_id) d;
  if coalesce((v_j->>'closed')::boolean, false)
     or (v_j ? 'expires_at' and (v_j->>'expires_at')::timestamptz < now()) then
    raise exception 'La encuesta ya está cerrada' using errcode = '22023';
  end if;
  if p_option_index is null or p_option_index < 0
     or p_option_index >= jsonb_array_length(coalesce(v_j->'options', '[]'::jsonb)) then
    raise exception 'Opción no válida' using errcode = '22023';
  end if;

  insert into poll_votes (mensaje_id, user_id, option_index)
  values (p_mensaje_id, v_me, p_option_index)
  on conflict (mensaje_id, user_id) do update set option_index = excluded.option_index;

  select count(*) into v_miembros from chat_miembro where chat_id = v_chat;
  select count(*) into v_votantes from poll_votes v
   where v.mensaje_id = p_mensaje_id
     and exists (select 1 from chat_miembro cm where cm.chat_id = v_chat and cm.user_id = v.user_id);
  if v_miembros > 1 and v_votantes >= v_miembros then
    return jsonb_build_object('cerrada', true) || public.fn_poll_cerrar_interno(p_mensaje_id, v_me, true);
  end if;
  return jsonb_build_object('cerrada', false);
end;
$$;

-- Los recuentos de siempre, ahora solo para quien es del chat.
create or replace function public.fn_poll_get_votes(p_mensaje_id bigint)
 returns table(option_index integer, vote_count bigint, voted_by_me boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
begin
  perform public.fn_poll_de(p_mensaje_id);
  return query
  select v.option_index, count(*)::bigint, bool_or(v.user_id = auth.uid())
    from poll_votes v
   where v.mensaje_id = p_mensaje_id
   group by v.option_index;
end;
$$;

-- 6) Quién votó qué.
create or replace function public.fn_poll_votos(p_mensaje_id bigint)
 returns table(user_id uuid, nombre text, option_index integer)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
begin
  perform public.fn_poll_de(p_mensaje_id);
  return query
  select v.user_id, coalesce(u.nombre, 'Alguien')::text, v.option_index
    from poll_votes v
    left join usuarios u on u.id = v.user_id
   where v.mensaje_id = p_mensaje_id
   order by u.nombre;
end;
$$;

-- 4) Desempatar: encuesta nueva solo con las empatadas. Si ya existe, devuelve la que hay.
create or replace function public.fn_poll_desempatar(p_mensaje_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
  v_j jsonb;
  v_opciones jsonb;
  v_pregunta text;
  v_texto text;
  v_id bigint;
begin
  select d.chat_id into v_chat
    from public.fn_poll_de(p_mensaje_id) d;
  select public.try_jsonb(texto) into v_j from mensajes where id = p_mensaje_id for update;
  if v_j ? 'desempate_id' then
    select id, texto into v_id, v_texto from mensajes where id = (v_j->>'desempate_id')::bigint;
    if v_id is not null then
      return jsonb_build_object('mensaje_id', v_id, 'texto', v_texto, 'poll_texto', v_j::text, 'ya_existia', true);
    end if;
  end if;
  if v_j->>'resultado' is distinct from 'empate' or v_j ? 'decidida_por' then
    raise exception 'Solo se puede desempatar una encuesta cerrada con empate' using errcode = '22023';
  end if;

  select jsonb_agg(v_j->'options'->(e::int) order by ord) into v_opciones
    from jsonb_array_elements_text(v_j->'empatadas') with ordinality as t(e, ord);
  v_pregunta := '¿' || (select string_agg(o, ' o ' order by ord)
                          from jsonb_array_elements_text(v_opciones) with ordinality as t(o, ord)) || '?';
  v_texto := jsonb_build_object('type', 'poll', 'question', v_pregunta, 'options', v_opciones,
                                'desempate_de', p_mensaje_id, 'desempate_de_at', v_j->'closed_at')::text;
  insert into mensajes (chat_id, sender_id, texto, leido_por)
  values (v_chat, v_me, v_texto, array[v_me])
  returning id into v_id;
  update chat set last_message = 'Encuesta · ' || v_pregunta, last_message_at = now() where id = v_chat;

  v_j := v_j || jsonb_build_object('desempate_id', v_id);
  update mensajes set texto = v_j::text where id = p_mensaje_id;
  return jsonb_build_object('mensaje_id', v_id, 'texto', v_texto, 'poll_texto', v_j::text, 'ya_existia', false);
end;
$$;

-- 5) Decidir yo: quien la creó o un admin elige una de las empatadas.
create or replace function public.fn_poll_decidir(p_mensaje_id bigint, p_option_index integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
  v_sender uuid;
  v_j jsonb;
  v_nombre text;
  v_aviso jsonb;
begin
  select d.chat_id, d.sender_id into v_chat, v_sender
    from public.fn_poll_de(p_mensaje_id) d;
  if v_sender is distinct from v_me and not public.fn_chat_es_admin(v_chat, v_me) then
    raise exception 'Solo quien creó la encuesta o un admin puede decidir' using errcode = '42501';
  end if;
  select public.try_jsonb(texto) into v_j from mensajes where id = p_mensaje_id for update;
  if v_j->>'resultado' is distinct from 'empate' or v_j ? 'decidida_por' then
    raise exception 'Solo se puede decidir una encuesta cerrada con empate' using errcode = '22023';
  end if;
  if v_j ? 'desempate_id' then
    raise exception 'Ya hay un desempate abierto' using errcode = '22023';
  end if;
  if not (v_j->'empatadas') @> to_jsonb(p_option_index) then
    raise exception 'Elige una de las opciones empatadas' using errcode = '22023';
  end if;

  select nombre into v_nombre from usuarios where id = v_me;
  v_j := v_j || jsonb_build_object('resultado', 'decidida', 'ganadora', p_option_index, 'decision', 'manual',
                                   'decidida_por', v_me, 'decidida_por_nombre', coalesce(v_nombre, 'Alguien'),
                                   'decidida_at', now());
  update mensajes set texto = v_j::text where id = p_mensaje_id;
  v_aviso := public.fn_poll_aviso(v_chat, p_mensaje_id, v_me, v_j);
  return jsonb_build_object('poll_texto', v_j::text) || v_aviso;
end;
$$;

-- 7) Un empate (sin decidir) no es una decisión.
create or replace function public.fn_momento_decidido(p_j jsonb)
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $$
  select case
    when p_j is null then false
    when p_j->>'type' = 'poll' then
      case when p_j ? 'resultado' then p_j->>'resultado' = 'decidida'
           else coalesce((p_j->>'closed')::boolean, false)
                or (p_j ? 'expires_at' and (p_j->>'expires_at')::timestamptz < now()) end
    when p_j->>'type' in ('hito_plan', 'plan_creado') then true
    when p_j->>'type' = 'propuesta' then p_j->>'estado' = 'aceptada'
    else false
  end;
$$;

-- Encuestas ya cerradas antes de esta migración: se les guarda el resultado una vez.
update mensajes m
   set texto = (public.try_jsonb(m.texto)
                || public.fn_poll_resultado(m.id, jsonb_array_length(coalesce(public.try_jsonb(m.texto)->'options', '[]'::jsonb)))
                || jsonb_build_object('cierre', 'manual'))::text
 where left(m.texto, 1) = '{'
   and public.try_jsonb(m.texto)->>'type' = 'poll'
   and coalesce((public.try_jsonb(m.texto)->>'closed')::boolean, false)
   and not (public.try_jsonb(m.texto) ? 'resultado');

-- 7) La regla: igual que en 20261115000007, sin las encuestas cerradas sin votos.
create or replace function public.fn_chat_indice(p_chat_id uuid, p_tz text default 'Europe/Madrid')
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_tz text := coalesce(nullif(p_tz, ''), 'Europe/Madrid');
  v_corte bigint;
  v_last_read timestamptz;
  v_result jsonb;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'Europe/Madrid';
  end if;
  v_corte := public.fn_chat_vaciado_hasta(p_chat_id);
  select last_read_at into v_last_read from chat_miembro where chat_id = p_chat_id and user_id = v_me;

  with m as (
    select id, sender_id, created_at, texto,
           (row_number() over (order by id)) - 1 as ord,
           (created_at at time zone v_tz)::date as dia
      from mensajes
     where chat_id = p_chat_id and id > v_corte
       and not exists (select 1 from mensaje_oculto o where o.user_id = v_me and o.mensaje_id = mensajes.id)
  ),
  runs as (
    select *, case when lag(dia) over (order by ord) is distinct from dia then 1 else 0 end as starts
      from m
  ),
  grp as (
    select *, sum(starts) over (order by ord) as g from runs
  ),
  dias as (
    select min(dia) as dia, min(id) as primer_id, min(ord) as desde, count(*) as n
      from grp group by g
  ),
  hitos as (
    select id, ord, created_at, j
      from (select id, ord, created_at, public.try_jsonb(texto) as j from m where left(texto, 1) = '{') x
     where j->>'type' in ('poll', 'propuesta', 'hito_plan', 'plan_creado')
       and coalesce(j->>'estado', '') <> 'descartada'
       -- Una encuesta cerrada sin votos no es un hito (po-sistema).
       and not (j->>'type' = 'poll' and coalesce(j->>'resultado', '') = 'sin_votos')
  )
  select jsonb_build_object(
    'total', (select count(*) from m),
    'max_id', (select max(id) from m),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'primer_id', primer_id, 'desde', desde, 'n', n) order by desde) from dias), '[]'::jsonb),
    'hitos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id,
        'ord', ord,
        'created_at', created_at,
        'tipo', j->>'type',
        'titulo', case when j->>'type' = 'poll' then j->>'question'
                       when j->>'type' = 'plan_creado' then 'Plan creado: ' || (j->>'titulo')
                       else j->>'titulo' end,
        'estado', case when public.fn_momento_decidido(j) then 'decidido' else 'abierto' end
      ) order by ord) from hitos), '[]'::jsonb),
    'primer_no_leido', (
      select jsonb_build_object('id', id, 'ord', ord)
        from m
       where sender_id is distinct from v_me
         and v_last_read is not null and created_at > v_last_read
       order by ord limit 1)
  ) into v_result;

  return v_result;
end;
$$;


revoke all on function public.fn_chat_indice(uuid, text) from public, anon;

revoke all on function public.fn_poll_close(bigint) from public, anon;
grant execute on function public.fn_poll_close(bigint) to authenticated, service_role;
revoke all on function public.fn_poll_vote(bigint, integer) from public, anon;
grant execute on function public.fn_poll_vote(bigint, integer) to authenticated, service_role;
revoke all on function public.fn_poll_get_votes(bigint) from public, anon;
grant execute on function public.fn_poll_get_votes(bigint) to authenticated, service_role;
revoke all on function public.fn_poll_votos(bigint) from public, anon;
grant execute on function public.fn_poll_votos(bigint) to authenticated, service_role;
revoke all on function public.fn_poll_desempatar(bigint) from public, anon;
grant execute on function public.fn_poll_desempatar(bigint) to authenticated, service_role;
revoke all on function public.fn_poll_decidir(bigint, integer) from public, anon;
grant execute on function public.fn_poll_decidir(bigint, integer) to authenticated, service_role;

-- 8) Empate según el caso (po-sistema, revisión de Design 2026-11-16):
--    · falta gente por votar → «Reabrir para Lucía y Marcos»: vuelve a estar abierta, sin perder
--      votos, y a quien falta le llega un aviso (notificación poll_reopen);
--    · ya votaron todos → «Sortear»: el servidor elige al azar una sola vez entre las empatadas y
--      guarda quién lo lanzó («Decidido por sorteo · sorteado por Ana»).
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo = any (array[
  'like', 'comment', 'friend_request', 'friend_accept', 'plan_invite', 'mention', 'recordatorio',
  'recordatorio_deuda', 'plan_added', 'plan_join_request', 'poll_reopen', 'poll_draw'
]));

-- Vista previa: también «Decidido por sorteo · Madrid».
create or replace function public.fn_poll_preview(p_j jsonb)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $$
  select case
    when p_j->>'resultado' = 'decidida' and p_j->>'decision' = 'sorteo' then
      'Decidido por sorteo · ' || (p_j->'options'->>((p_j->>'ganadora')::int))
    when p_j->>'resultado' = 'decidida' and p_j ? 'decidida_por' then
      'Encuesta decidida · ' || (p_j->'options'->>((p_j->>'ganadora')::int))
    when p_j->>'resultado' = 'decidida' then
      'Encuesta cerrada · ' || (p_j->'options'->>((p_j->>'ganadora')::int))
    when p_j->>'resultado' = 'empate' then
      'Encuesta cerrada · Empate: ' || (
        select string_agg(p_j->'options'->>(e::int), ' o ' order by ord)
          from jsonb_array_elements_text(p_j->'empatadas') with ordinality as t(e, ord))
    else 'Encuesta cerrada sin votos'
  end;
$$;
revoke all on function public.fn_poll_preview(jsonb) from public, anon, authenticated;
grant execute on function public.fn_poll_preview(jsonb) to service_role;

-- Quién del chat aún no ha votado (interna).
create or replace function public.fn_poll_faltan(p_mensaje_id bigint, p_chat_id uuid)
 returns uuid[]
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select coalesce(array_agg(cm.user_id), '{}'::uuid[])
    from chat_miembro cm
   where cm.chat_id = p_chat_id
     and not exists (select 1 from poll_votes v where v.mensaje_id = p_mensaje_id and v.user_id = cm.user_id);
$$;
revoke all on function public.fn_poll_faltan(bigint, uuid) from public, anon, authenticated;
grant execute on function public.fn_poll_faltan(bigint, uuid) to service_role;

-- Reabrir un empate para quien falta (quien la creó o un admin; si la creó Frimee, cualquiera).
create or replace function public.fn_poll_reabrir(p_mensaje_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
  v_sender uuid;
  v_j jsonb;
  v_faltan uuid[];
  v_nombre text;
  v_preview text;
  v_texto text;
  v_id bigint;
begin
  select d.chat_id, d.sender_id into v_chat, v_sender
    from public.fn_poll_de(p_mensaje_id) d;
  if v_sender is not null and v_sender <> v_me and not public.fn_chat_es_admin(v_chat, v_me) then
    raise exception 'Solo quien creó la encuesta o un admin puede reabrirla' using errcode = '42501';
  end if;
  select public.try_jsonb(texto) into v_j from mensajes where id = p_mensaje_id for update;
  if not coalesce((v_j->>'closed')::boolean, false) then
    return jsonb_build_object('poll_texto', v_j::text, 'ya_abierta', true);
  end if;
  if v_j->>'resultado' is distinct from 'empate' or v_j ? 'decidida_por' or v_j ? 'desempate_id' then
    raise exception 'Solo se puede reabrir un empate sin decidir' using errcode = '22023';
  end if;
  v_faltan := public.fn_poll_faltan(p_mensaje_id, v_chat);
  if cardinality(v_faltan) = 0 then
    raise exception 'Ya ha votado todo el chat' using errcode = '22023';
  end if;

  select nombre into v_nombre from usuarios where id = v_me;
  v_j := (v_j - 'closed' - 'resultado' - 'ganadora' - 'empatadas' - 'votos' - 'total' - 'closed_at'
             - 'closed_by' - 'closed_by_nombre' - 'cierre' - 'expires_at')
         || jsonb_build_object('reabierta_at', now(), 'reabierta_por', v_me,
                               'reabierta_por_nombre', coalesce(v_nombre, 'Alguien'));
  update mensajes set texto = v_j::text where id = p_mensaje_id;

  -- Línea al final del chat: «Ana ha reabierto «¿Dónde vamos?» para Lucía y Marcos · Ir a la
  -- encuesta» (la encuesta sigue en su sitio). También alimenta la lista de chats.
  v_preview := 'Encuesta reabierta · ' || coalesce(v_j->>'question', '');
  v_texto := jsonb_build_object('type', 'poll_cerrada', 'poll_id', p_mensaje_id,
                                'resultado', 'reabierta', 'texto', v_preview,
                                'pregunta', v_j->>'question',
                                'para', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nombre', u.nombre) order by u.nombre), '[]'::jsonb)
                                           from usuarios u where u.id = any(v_faltan)))::text;
  insert into mensajes (chat_id, sender_id, texto, leido_por)
  values (v_chat, v_me, v_texto, array[v_me])
  returning id into v_id;
  update chat set last_message = v_preview, last_message_at = now() where id = v_chat;

  insert into notificaciones (user_id, tipo, actor_id, entity_id, entity_type)
  select u, 'poll_reopen', v_me,
         jsonb_build_object('chat_id', v_chat::text, 'mensaje_id', p_mensaje_id::text,
                            'pregunta', v_j->>'question')::text,
         'chat'
    from unnest(v_faltan) as u
   where u <> v_me;

  return jsonb_build_object('poll_texto', v_j::text, 'aviso_id', v_id, 'aviso_texto', v_texto,
                            'avisados', cardinality(v_faltan));
end;
$$;

-- Sortear un empate cuando ya ha votado todo el chat (cualquiera del chat). Una sola vez:
-- si ya está decidida, devuelve lo que hay.
create or replace function public.fn_poll_sortear(p_mensaje_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
  v_j jsonb;
  v_n int;
  v_ganadora int;
  v_nombre text;
  v_aviso jsonb;
begin
  select d.chat_id into v_chat
    from public.fn_poll_de(p_mensaje_id) d;
  select public.try_jsonb(texto) into v_j from mensajes where id = p_mensaje_id for update;
  if v_j->>'resultado' = 'decidida' then
    return jsonb_build_object('poll_texto', v_j::text, 'ya_decidida', true);
  end if;
  if v_j->>'resultado' is distinct from 'empate' or v_j ? 'desempate_id' then
    raise exception 'Solo se puede sortear un empate' using errcode = '22023';
  end if;
  if cardinality(public.fn_poll_faltan(p_mensaje_id, v_chat)) > 0 then
    raise exception 'Aún falta gente por votar: reabre la encuesta' using errcode = '22023';
  end if;

  v_n := jsonb_array_length(v_j->'empatadas');
  v_ganadora := (v_j->'empatadas'->>(floor(random() * v_n))::int)::int;
  select nombre into v_nombre from usuarios where id = v_me;
  v_j := v_j || jsonb_build_object('resultado', 'decidida', 'ganadora', v_ganadora, 'decision', 'sorteo',
                                   'decidida_por', v_me, 'decidida_por_nombre', coalesce(v_nombre, 'Alguien'),
                                   'decidida_at', now());
  update mensajes set texto = v_j::text where id = p_mensaje_id;
  v_aviso := public.fn_poll_aviso(v_chat, p_mensaje_id, v_me, v_j);

  -- Quien no lo ve en directo: «Finde en la sierra · Sorteo: vamos a Madrid» (y, si está en otra
  -- pantalla de la app, el aviso breve «Ana ha lanzado un sorteo · Ver»).
  insert into notificaciones (user_id, tipo, actor_id, entity_id, entity_type)
  select cm.user_id, 'poll_draw', v_me,
         jsonb_build_object('chat_id', v_chat::text, 'mensaje_id', p_mensaje_id::text,
                            'chat_nombre', coalesce(c.nombre, p.titulo, 'el chat'),
                            'pregunta', v_j->>'question',
                            'opcion', v_j->'options'->>v_ganadora,
                            'actor_nombre', coalesce(v_nombre, 'Alguien'))::text,
         'chat'
    from chat_miembro cm
    join chat c on c.id = cm.chat_id
    left join plan p on p.id = c.plan_id
   where cm.chat_id = v_chat and cm.user_id <> v_me;

  return jsonb_build_object('poll_texto', v_j::text) || v_aviso;
end;
$$;

revoke all on function public.fn_poll_reabrir(bigint) from public, anon;
grant execute on function public.fn_poll_reabrir(bigint) to authenticated, service_role;
revoke all on function public.fn_poll_sortear(bigint) from public, anon;
grant execute on function public.fn_poll_sortear(bigint) to authenticated, service_role;

-- 9) Entrar en un plan deja aviso en su chat (fallo visto el 2026-11-16: aceptar una invitación, entrar
--    por enlace o que te acepten la solicitud metía a la persona en el chat sin decir nada).
--    «Álex añadió a Marcos» si lo hace otra persona; «Marcos se unió al plan» si entra él mismo.
--    No avisa cuando el chat se crea en esa misma transacción (plan nuevo con su gente).
create or replace function public.fn_chat_aviso_gente(p_chat_id uuid, p_clase text, p_actor uuid, p_user uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_actor text;
  v_user text;
  v_preview text;
  v_texto text;
  v_id bigint;
begin
  select nombre into v_actor from usuarios where id = p_actor;
  select nombre into v_user from usuarios where id = p_user;
  v_texto := jsonb_build_object(
    'type', 'aviso', 'clase', p_clase,
    'actor_id', p_actor, 'actor_nombre', coalesce(v_actor, 'Alguien'),
    'user_id', p_user, 'user_nombre', coalesce(v_user, 'Alguien'))::text;
  insert into mensajes (chat_id, sender_id, texto, leido_por)
  values (p_chat_id, p_actor, v_texto, array[p_actor])
  returning id into v_id;
  v_preview := case p_clase
    when 'anadido' then coalesce(v_actor, 'Alguien') || ' añadió a ' || coalesce(v_user, 'alguien')
    when 'quitado' then coalesce(v_actor, 'Alguien') || ' quitó a ' || coalesce(v_user, 'alguien') || ' del grupo'
    when 'unio' then coalesce(v_user, 'Alguien') || ' se unió al plan'
    else coalesce(v_user, 'Alguien') || ' salió del grupo' end;
  update chat set last_message = v_preview, last_message_at = now() where id = p_chat_id;
  return jsonb_build_object('mensaje_id', v_id, 'texto', v_texto);
end;
$$;
revoke all on function public.fn_chat_aviso_gente(uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_chat_aviso_gente(uuid, text, uuid, uuid) to service_role;

create or replace function public.trg_plan_usuario_sync_chat()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_chat_id uuid;
  v_chat_creado timestamptz;
  v_n int;
  v_actor uuid := coalesce(auth.uid(), new.user_id);
begin
  select id, created_at into v_chat_id, v_chat_creado from chat where plan_id = new.plan_id;
  if v_chat_id is null then return new; end if;

  if (tg_op = 'INSERT' and new.estado = 'PARTICIPA') or (tg_op = 'UPDATE' and new.estado = 'PARTICIPA') then
    insert into chat_miembro (chat_id, user_id)
    values (v_chat_id, new.user_id)
    on conflict do nothing;
    get diagnostics v_n = row_count;
    -- Only if they really came in now, and not while the plan and its chat are being created.
    if v_n > 0 and v_chat_creado < now() then
      perform public.fn_chat_aviso_gente(v_chat_id,
        case when v_actor = new.user_id then 'unio' else 'anadido' end, v_actor, new.user_id);
    end if;
  elsif tg_op = 'UPDATE' then
    delete from chat_miembro where chat_id = v_chat_id and user_id = new.user_id;
  end if;

  return new;
end;
$$;
