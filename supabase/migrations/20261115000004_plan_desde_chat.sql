-- Crear un plan desde un chat (canvas «Frimee · Chat · Bitácora», tableros cp-*).
--
-- El chat de origen (grupo o 1 a 1) NO cambia: el plan nace con su propio chat, que empieza con una
-- copia de la conversación (toda, o desde un mensaje). Todo en una transacción: si algo falla no
-- queda nada a medias, y un reintento con el mismo client_id devuelve el primer resultado.
--
-- Qué se copia: los mensajes con su autor y su fecha real; fotos, notas de voz y documentos apuntan
-- al mismo archivo (al borrar un mensaje nunca se borra su archivo, así que compartirlo es seguro);
-- las respuestas citadas apuntan a la copia del mensaje citado. Las encuestas se copian CERRADAS
-- con sus votos (foto de los resultados de ese momento); una propuesta de @frimee pendiente se
-- copia descartada (no se puede aceptar dos veces). No se copian reacciones, fijados ni destacados.
-- Los mensajes eliminados no existen (se borran) y de los editados queda el texto actual.
--
-- Los copiados llegan leídos (last_read_at = now(), y su fecha es anterior) y sin push: los avisos
-- salen de la tabla notificaciones, y aquí solo se crea «X te ha añadido a <plan>» (plan_added).
--
-- «Nada, empezar de cero» (p_copiar = false): no se copia nada; el chat del plan empieza con el hito,
-- que dice de qué chat viene y enlaza a él.
--
-- «Pedir unirme»: quien sigue en el chat de origen pero no entró en el plan ve el hito con ese botón.
-- La petición llega a los admins del plan como aviso (plan_join_request) con Aceptar / Rechazar.
--
-- Mensajes nuevos (texto JSON, como el resto de momentos):
--   {type: "copia_chat"}  separador «Antes del plan», primer mensaje del chat del plan.
--   {type: "plan_creado"} hito «Plan creado» en los dos chats (también en la regla).

-- 1) Aviso «te ha añadido a un plan».
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo = any (array[
  'like', 'comment', 'friend_request', 'friend_accept', 'plan_invite', 'mention', 'recordatorio',
  'recordatorio_deuda', 'plan_added', 'plan_join_request'
]));

-- 2) Cuántos mensajes se copiarían (el texto de la hoja: «248 mensajes · desde el 2 sept»).
create or replace function public.fn_chat_copia_recuento(p_chat_id uuid, p_desde_id bigint default null)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select public.assert_allowed(public.is_chat_member(p_chat_id));
  select jsonb_build_object(
    'total', count(*),
    'desde_at', min(created_at),
    'primer_id', min(id)
  )
    from mensajes
   where chat_id = p_chat_id
     and (p_desde_id is null or id >= p_desde_id);
$$;

-- 3) Crear el plan, su chat, los miembros y la copia.
-- (Earlier drafts were applied in dev: drop them so there is only one version.)
drop function if exists public.fn_plan_desde_chat(uuid, uuid, text, timestamptz, timestamptz, text, uuid[], bigint);
drop function if exists public.fn_plan_desde_chat(uuid, uuid, text, timestamptz, timestamptz, text, uuid[], bigint, boolean);
create or replace function public.fn_plan_desde_chat(
  p_client_id uuid,
  p_chat_id uuid,
  p_titulo text,
  p_inicio_at timestamptz,
  p_fin_at timestamptz,
  p_ubicacion text,
  p_miembros uuid[],
  p_desde_id bigint default null,
  p_copiar boolean default true,
  -- The message whose diamond opened «Crear plan» (null from the header): it loses its diamond.
  p_origen_id bigint default null
) returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  c_tope constant int := 5000;
  v_me uuid := auth.uid();
  v_inserted boolean;
  v_prev jsonb;
  v_chat chat%rowtype;
  v_origen_nombre text;
  v_miembros uuid[];
  v_total int;
  v_primero_at timestamptz;
  v_plan public.plan;
  v_plan_chat uuid;
  v_leido uuid[];
  v_creador text;
  v_hito jsonb;
  v_r record;
  v_j jsonb;
  v_texto text;
  v_new bigint;
  v_hito_id bigint;
  v_copiados int := 0;
  v_result jsonb;
begin
  perform public.assert_allowed(v_me is not null and public.is_chat_member(p_chat_id));

  select * into v_chat from chat where id = p_chat_id;
  if v_chat.plan_id is not null or v_chat.tipo not in ('GRUPO', 'DIRECTO') then
    raise exception 'Este chat ya es el de un plan' using errcode = '22023';
  end if;

  -- Reclamar la petición (doble toque o reintento: devuelve el primer resultado).
  insert into chat_acciones (client_id, user_id, accion) values (p_client_id, v_me, 'plan_desde_chat')
  on conflict (client_id) do nothing;
  get diagnostics v_inserted = row_count;
  if not v_inserted then
    select resultado into v_prev from chat_acciones where client_id = p_client_id and user_id = v_me;
    if v_prev is not null then return v_prev; end if;
    raise exception 'Petición repetida' using errcode = '22023';
  end if;

  -- Solo miembros del chat; tú siempre entras.
  select coalesce(array_agg(distinct cm.user_id), '{}') into v_miembros
    from chat_miembro cm
   where cm.chat_id = p_chat_id
     and cm.user_id <> v_me
     and cm.user_id = any(coalesce(p_miembros, '{}'));

  if coalesce(p_copiar, true) then
    select count(*), min(created_at) into v_total, v_primero_at
      from mensajes
     where chat_id = p_chat_id and (p_desde_id is null or id >= p_desde_id);
  else
    v_total := 0;
  end if;
  if v_total > c_tope then
    raise exception 'Demasiados mensajes para copiar (% de %)', v_total, c_tope using errcode = '22023';
  end if;

  -- Nombre del chat de origen: el del grupo, o el de la otra persona en un 1 a 1.
  v_origen_nombre := v_chat.nombre;
  if v_origen_nombre is null then
    select u.nombre into v_origen_nombre
      from chat_miembro cm join usuarios u on u.id = cm.user_id
     where cm.chat_id = p_chat_id and cm.user_id <> v_me
     limit 1;
  end if;
  v_origen_nombre := coalesce(v_origen_nombre, 'el chat');

  -- El plan (fn_plan_create valida título, fechas y que lo creas tú; el trigger te hace admin).
  v_plan := public.fn_plan_create(
    p_titulo,
    'Creado desde el chat «' || v_origen_nombre || '»',
    p_inicio_at, p_fin_at,
    coalesce(nullif(btrim(coalesce(p_ubicacion, '')), ''), 'Por decidir'),
    v_me, v_me);

  insert into plan_usuarios (plan_id, user_id, rol, estado)
  select v_plan.id, u, 'PARTICIPANTE', 'PARTICIPA' from unnest(v_miembros) as u
  on conflict (plan_id, user_id) do nothing;

  v_plan_chat := public.fn_plan_create_chat(v_plan.id);
  v_leido := array_append(v_miembros, v_me);

  -- Separador «Antes del plan»: justo antes del primer mensaje copiado (id y fecha).
  if v_total > 0 then
    insert into mensajes (chat_id, sender_id, texto, created_at, leido_por)
    values (v_plan_chat, null, jsonb_build_object(
      'type', 'copia_chat',
      'origen_chat_id', p_chat_id,
      'origen_nombre', v_origen_nombre,
      'copiados', v_total,
      'copiado_at', now()
    )::text, v_primero_at - interval '1 millisecond', v_leido);
  end if;

  -- La copia, en orden: así cada respuesta citada ya tiene la copia del mensaje al que apunta.
  create temp table if not exists _copia_map (viejo bigint primary key, nuevo bigint not null) on commit drop;
  truncate _copia_map;  -- (a DELETE without WHERE is refused by safeupdate)

  for v_r in
    select * from mensajes
     where v_total > 0
       and chat_id = p_chat_id and (p_desde_id is null or id >= p_desde_id)
     order by id
  loop
    v_texto := v_r.texto;
    if left(v_texto, 1) = '{' then
      v_j := public.try_jsonb(v_texto);
      if v_j->>'type' = 'poll' then
        v_texto := (v_j || jsonb_build_object('closed', true, 'copiada_at', now()))::text;
      elsif v_j->>'type' = 'propuesta' and v_j->>'estado' = 'pendiente' then
        v_texto := (v_j || jsonb_build_object('estado', 'descartada', 'copia', true))::text;
      end if;
    end if;

    insert into mensajes (chat_id, sender_id, texto, created_at, leido_por, reply_to_id,
                          audio_url, document_url, document_name, image_url, image_type, tipo)
    values (v_plan_chat, v_r.sender_id, v_texto, v_r.created_at, v_leido,
            (select nuevo from _copia_map where viejo = v_r.reply_to_id),
            v_r.audio_url, v_r.document_url, v_r.document_name, v_r.image_url, v_r.image_type, v_r.tipo)
    returning id into v_new;

    insert into _copia_map values (v_r.id, v_new);
    v_copiados := v_copiados + 1;
  end loop;

  -- Votos de las encuestas copiadas (cerradas: nadie puede cambiarlos).
  insert into poll_votes (mensaje_id, user_id, option_index, created_at)
  select m.nuevo, pv.user_id, pv.option_index, pv.created_at
    from poll_votes pv join _copia_map m on m.viejo = pv.mensaje_id;

  -- Hito «Plan creado» en los dos chats.
  select split_part(coalesce(nombre, ''), ' ', 1) into v_creador from usuarios where id = v_me;
  v_hito := jsonb_build_object(
    'type', 'plan_creado',
    'plan_id', v_plan.id,
    'titulo', v_plan.titulo,
    'inicio_at', v_plan.inicio_at,
    'fin_at', v_plan.fin_at,
    'creador_id', v_me,
    'creador_nombre', v_creador,
    'miembros', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nombre', split_part(coalesce(u.nombre, ''), ' ', 1)) order by u.nombre), '[]'::jsonb)
                   from usuarios u where u.id = any(v_leido)),
    'copiados', v_copiados,
    'origen_chat_id', p_chat_id,
    'origen_nombre', v_origen_nombre,
    'origen_mensaje_id', (select id from mensajes where id = p_origen_id and chat_id = p_chat_id)
  );
  insert into mensajes (chat_id, sender_id, texto, leido_por) values (p_chat_id, v_me, v_hito::text, array[v_me])
  returning id into v_hito_id;
  -- Just before @frimee's welcome (made with the plan's chat): the mark closes the copied part.
  insert into mensajes (chat_id, sender_id, texto, created_at, leido_por)
  values (v_plan_chat, v_me, v_hito::text, now() - interval '1 millisecond', v_leido);

  update chat set last_message = 'Plan creado · ' || v_plan.titulo, last_message_at = now()
   where id in (p_chat_id, v_plan_chat);

  -- Todo lo copiado llega leído.
  update chat_miembro set last_read_at = now() where chat_id = v_plan_chat;

  -- «Ana te ha añadido a Finde en Cercedilla».
  insert into notificaciones (user_id, tipo, actor_id, entity_id, entity_type)
  select u, 'plan_added', v_me,
         jsonb_build_object('plan_id', v_plan.id::text, 'destino', v_plan.titulo)::text, 'plan_chat'
    from unnest(v_miembros) as u;

  -- The app sends the original chat's mark to whoever has it open (the chat's realtime is a broadcast).
  v_result := jsonb_build_object('plan_id', v_plan.id, 'chat_id', v_plan_chat, 'copiados', v_copiados,
                                 'hito_id', v_hito_id, 'hito_texto', v_hito::text, 'miembros', to_jsonb(v_miembros));
  update chat_acciones set resultado = v_result where client_id = p_client_id;
  return v_result;
end;
$$;

-- 3b) El saludo de @frimee en el chat del plan: un plan sin sitio se guarda como «Por decidir», y
-- el saludo decía «el tiempo en Por decidir». Sin sitio, «el tiempo que hará».
create or replace function public.trg_chat_plan_welcome() returns trigger
    language plpgsql security definer
    set search_path = public
    as $$
declare
  v_destino text;
begin
  select nullif(nullif(trim(split_part(ubicacion_nombre, ',', 1)), ''), 'Por decidir')
    into v_destino
    from plan
   where id = new.plan_id;

  insert into mensajes (chat_id, sender_id, texto, tipo)
  values (
    new.id, null,
    '¡Hola! Soy Frimee, el asistente del plan. Escribid @frimee y lo que necesitéis: '
      || coalesce('el tiempo en ' || v_destino, 'el tiempo que hará')
      || ', cómo vais de cuentas o ideas para cenar. También puedo crear encuestas para que el grupo decida.',
    'bot'
  );

  update chat
     set last_message = '¡Hola! Soy Frimee, el asistente del plan. Escribid @frimee y lo que necesitéis.',
         last_message_at = now()
   where id = new.id;

  return null;
end;
$$;
revoke all on function public.trg_chat_plan_welcome() from public, anon, authenticated;

-- 4) «Pedir unirme» desde el hito del chat de origen, y la respuesta de un admin.
create or replace function public.fn_plan_pedir_unirme(p_plan_id bigint, p_chat_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_titulo text;
begin
  perform public.assert_allowed(v_me is not null and public.is_chat_member(p_chat_id));
  -- Only from a chat the plan was made from (its «Plan creado» mark is there).
  if not exists (
    select 1 from mensajes
     where chat_id = p_chat_id and left(texto, 1) = '{'
       and public.try_jsonb(texto)->>'type' = 'plan_creado'
       and public.try_jsonb(texto)->>'plan_id' = p_plan_id::text
  ) then
    raise exception 'Este plan no salió de este chat' using errcode = '22023';
  end if;
  if exists (select 1 from plan_usuarios where plan_id = p_plan_id and user_id = v_me and estado = 'PARTICIPA') then
    return 'ya_miembro';
  end if;
  if exists (
    select 1 from notificaciones
     where tipo = 'plan_join_request' and actor_id = v_me
       and public.try_jsonb(entity_id)->>'plan_id' = p_plan_id::text
  ) then
    return 'ya_pedido';
  end if;

  select titulo into v_titulo from plan where id = p_plan_id;
  insert into notificaciones (user_id, tipo, actor_id, entity_id, entity_type)
  select pu.user_id, 'plan_join_request', v_me,
         jsonb_build_object('plan_id', p_plan_id::text, 'destino', v_titulo, 'user_id', v_me)::text, 'plan_chat'
    from plan_usuarios pu
   where pu.plan_id = p_plan_id and pu.rol = 'ADMIN' and pu.estado = 'PARTICIPA';
  return 'ok';
end;
$$;

create or replace function public.fn_plan_responder_solicitud(p_plan_id bigint, p_user_id uuid, p_aceptar boolean)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_titulo text;
begin
  perform public.assert_allowed(v_me is not null and exists (
    select 1 from plan_usuarios where plan_id = p_plan_id and user_id = v_me and rol = 'ADMIN' and estado = 'PARTICIPA'));
  if not exists (
    select 1 from notificaciones
     where tipo = 'plan_join_request' and actor_id = p_user_id
       and public.try_jsonb(entity_id)->>'plan_id' = p_plan_id::text
  ) then
    return 'sin_solicitud';
  end if;

  -- The request goes away for every admin, whoever answers.
  delete from notificaciones
   where tipo = 'plan_join_request' and actor_id = p_user_id
     and public.try_jsonb(entity_id)->>'plan_id' = p_plan_id::text;
  if not coalesce(p_aceptar, false) then
    return 'rechazada';
  end if;

  insert into plan_usuarios (plan_id, user_id, rol, estado) values (p_plan_id, p_user_id, 'PARTICIPANTE', 'PARTICIPA')
  on conflict (plan_id, user_id) do update set estado = 'PARTICIPA', updated_at = now();
  -- Joining later: what is already in the plan's chat counts as read.
  update chat_miembro set last_read_at = now()
   where user_id = p_user_id and chat_id = (select id from chat where plan_id = p_plan_id);
  select titulo into v_titulo from plan where id = p_plan_id;
  insert into notificaciones (user_id, tipo, actor_id, entity_id, entity_type)
  values (p_user_id, 'plan_added', v_me, jsonb_build_object('plan_id', p_plan_id::text, 'destino', v_titulo)::text, 'plan_chat');
  return 'aceptada';
end;
$$;

-- 5) La regla del chat también marca «Plan creado» (decidido).
create or replace function public.fn_chat_indice(p_chat_id uuid, p_tz text default 'Europe/Madrid')
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_tz text := coalesce(nullif(p_tz, ''), 'Europe/Madrid');
  v_last_read timestamptz;
  v_result jsonb;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  -- An unknown zone falls back instead of failing the chat.
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'Europe/Madrid';
  end if;
  select last_read_at into v_last_read from chat_miembro where chat_id = p_chat_id and user_id = v_me;

  with m as (
    select id, sender_id, created_at, texto,
           (row_number() over (order by id)) - 1 as ord,
           (created_at at time zone v_tz)::date as dia
      from mensajes
     where chat_id = p_chat_id
  ),
  -- A day starts where the date changes (runs, so the order stays the one the chat shows).
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
  )
  select jsonb_build_object(
    'total', (select count(*) from m),
    -- Newer messages (realtime) are added on the client after this id.
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
        'estado', case
          when j->>'type' = 'poll' then
            case when coalesce((j->>'closed')::boolean, false)
                   or (j ? 'expires_at' and (j->>'expires_at')::timestamptz < now()) then 'decidido' else 'abierto' end
          when j->>'type' in ('hito_plan', 'plan_creado') or j->>'estado' = 'aceptada' then 'decidido'
          else 'abierto' end
      ) order by ord) from hitos), '[]'::jsonb),
    -- First message from someone else after your last read (null when you are up to date).
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

revoke all on function public.fn_chat_copia_recuento(uuid, bigint) from public, anon;
grant execute on function public.fn_chat_copia_recuento(uuid, bigint) to authenticated, service_role;
revoke all on function public.fn_plan_desde_chat(uuid, uuid, text, timestamptz, timestamptz, text, uuid[], bigint, boolean, bigint) from public, anon;
grant execute on function public.fn_plan_desde_chat(uuid, uuid, text, timestamptz, timestamptz, text, uuid[], bigint, boolean, bigint) to authenticated, service_role;
revoke all on function public.fn_plan_pedir_unirme(bigint, uuid) from public, anon;
grant execute on function public.fn_plan_pedir_unirme(bigint, uuid) to authenticated, service_role;
revoke all on function public.fn_plan_responder_solicitud(bigint, uuid, boolean) from public, anon;
grant execute on function public.fn_plan_responder_solicitud(bigint, uuid, boolean) to authenticated, service_role;
