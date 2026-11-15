-- Chat Bitácora phase 3: the ruler covers the WHOLE conversation, not only the 50 loaded messages.
--
-- 1) fn_chat_indice: a light index fetched when a chat opens: total of messages, the days (first
--    message, position and how many), the milestones (polls and @frimee proposals: id, position,
--    state, title, date) and your first unread message. Positions are the message's order in the
--    chat (by id, as fn_mensajes_list pages), so a day with 200 messages takes more ruler than one
--    with 3. Milestones come from the moments in mensajes.texto for now; phase 5 (sealed
--    milestones) moves them to their own table without changing this shape.
-- 2) fn_mensajes_tramo: the messages around one (jumping to an old milestone loads only that
--    stretch, not everything in between), each with its position.
-- 3) fn_mensajes_list_despues: newer messages after a cursor (scrolling down from that stretch).
-- Same row shape as fn_mensajes_list, same membership check.

-- texto -> jsonb without throwing on plain text or broken JSON.
create or replace function public.try_jsonb(p text) returns jsonb
    language plpgsql immutable
    as $$
begin
  if p is null or left(p, 1) <> '{' then
    return null;
  end if;
  return p::jsonb;
exception when others then
  return null;
end;
$$;

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
     where j->>'type' in ('poll', 'propuesta')
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
        'titulo', case when j->>'type' = 'poll' then j->>'question' else j->>'titulo' end,
        'estado', case
          when j->>'type' = 'poll' then
            case when coalesce((j->>'closed')::boolean, false)
                   or (j ? 'expires_at' and (j->>'expires_at')::timestamptz < now()) then 'decidido' else 'abierto' end
          when j->>'estado' = 'aceptada' then 'decidido'
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

create or replace function public.fn_mensajes_tramo(p_chat_id uuid, p_mensaje_id bigint, p_antes integer default 25, p_despues integer default 25)
 returns table(id bigint, sender_id uuid, sender_nombre text, sender_profile_image text, texto text, created_at timestamp with time zone, reply_to_id bigint, reply_texto text, reply_sender_nombre text, audio_url text, document_url text, document_name text, image_url text, image_type text, tipo text, orden bigint)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_desde bigint;
  v_hasta bigint;
  v_base bigint;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  -- The stretch: p_antes messages up to the target (included) and p_despues after it.
  select min(x.id) into v_desde from (
    select mm.id from mensajes mm where mm.chat_id = p_chat_id and mm.id <= p_mensaje_id order by mm.id desc limit greatest(p_antes, 0) + 1
  ) x;
  select max(x.id) into v_hasta from (
    select mm.id from mensajes mm where mm.chat_id = p_chat_id and mm.id > p_mensaje_id order by mm.id asc limit greatest(p_despues, 0)
  ) x;
  v_hasta := coalesce(v_hasta, p_mensaje_id);
  if v_desde is null then
    return;
  end if;
  select count(*) into v_base from mensajes mm where mm.chat_id = p_chat_id and mm.id < v_desde;

  return query
  select m.id, m.sender_id, coalesce(u.nombre, 'Frimee')::text, u.profile_image::text, m.texto, m.created_at,
         m.reply_to_id, r.texto, coalesce(ru.nombre, 'Frimee')::text,
         m.audio_url, m.document_url, m.document_name, m.image_url, m.image_type, m.tipo,
         v_base + (row_number() over (order by m.id)) - 1
    from mensajes m
    left join usuarios u  on u.id = m.sender_id
    left join mensajes r  on r.id = m.reply_to_id
    left join usuarios ru on ru.id = r.sender_id
   where m.chat_id = p_chat_id and m.id between v_desde and v_hasta
   order by m.id;
end;
$$;

create or replace function public.fn_mensajes_list_despues(p_chat_id uuid, p_cursor_id bigint, p_limit integer default 50)
 returns table(id bigint, sender_id uuid, sender_nombre text, sender_profile_image text, texto text, created_at timestamp with time zone, reply_to_id bigint, reply_texto text, reply_sender_nombre text, audio_url text, document_url text, document_name text, image_url text, image_type text, tipo text)
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select public.assert_allowed(public.is_chat_member(p_chat_id));
  select m.id, m.sender_id, coalesce(u.nombre, 'Frimee')::text, u.profile_image::text, m.texto, m.created_at,
         m.reply_to_id, r.texto, coalesce(ru.nombre, 'Frimee')::text,
         m.audio_url, m.document_url, m.document_name, m.image_url, m.image_type, m.tipo
    from mensajes m
    left join usuarios u  on u.id = m.sender_id
    left join mensajes r  on r.id = m.reply_to_id
    left join usuarios ru on ru.id = r.sender_id
   where m.chat_id = p_chat_id and m.id > p_cursor_id
   order by m.id asc
   limit p_limit;
$$;

revoke all on function public.try_jsonb(text) from public, anon;
grant execute on function public.try_jsonb(text) to authenticated, service_role;
revoke all on function public.fn_chat_indice(uuid, text) from public, anon;
grant execute on function public.fn_chat_indice(uuid, text) to authenticated, service_role;
revoke all on function public.fn_mensajes_tramo(uuid, bigint, integer, integer) from public, anon;
grant execute on function public.fn_mensajes_tramo(uuid, bigint, integer, integer) to authenticated, service_role;
revoke all on function public.fn_mensajes_list_despues(uuid, bigint, integer) from public, anon;
grant execute on function public.fn_mensajes_list_despues(uuid, bigint, integer) to authenticated, service_role;
