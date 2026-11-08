-- Calls: the states and checks the app needs to handle the edge cases.
--
-- 1. Two more states, so the caller learns what happened: 'rejected' (the other person
--    declined) and 'busy' (they were already in a call). Both only for one-to-one calls.
-- 2. fn_llamada_record wrote a call message into any chat it was given: now only into a
--    chat the caller belongs to.
-- 3. fn_call_info: who is calling, for the incoming-call screen (the app downloaded the
--    whole chat list to find one chat).
-- 4. Calls left 'ringing' or 'active' forever (an app closed mid-call, no answer): a
--    cleanup every 5 minutes, and the ones stuck today closed now.

-- 1. States.
alter table public.llamadas drop constraint if exists llamadas_estado_check;
alter table public.llamadas
  add constraint llamadas_estado_check
  check (estado in ('ringing', 'active', 'ended', 'missed', 'rejected', 'busy'));

-- 2. Call messages only into your own chats.
create or replace function public.fn_llamada_record(p_chat_id uuid, p_tipo text, p_duracion integer default null)
    returns bigint
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_id      bigint;
  v_preview text;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  if p_tipo not in ('call_audio', 'call_video', 'call_missed_audio', 'call_missed_video') then
    raise exception 'Tipo de llamada no válido';
  end if;

  insert into mensajes (chat_id, sender_id, texto, tipo)
  values (p_chat_id, auth.uid(), coalesce(p_duracion::text, '0'), p_tipo)
  returning id into v_id;

  v_preview :=
    case p_tipo
      when 'call_audio'        then '📞 Llamada de audio'
      when 'call_video'        then '📹 Videollamada'
      when 'call_missed_audio' then '📞 Llamada perdida'
      when 'call_missed_video' then '📹 Videollamada perdida'
    end;

  update chat
  set last_message    = v_preview,
      last_message_at = now()
  where id = p_chat_id;

  return v_id;
end;
$$;

revoke all on function public.fn_llamada_record(uuid, text, integer) from public, anon;
grant execute on function public.fn_llamada_record(uuid, text, integer) to authenticated, service_role;

-- 3. Who is calling: the chat and its members, for members of that chat only.
create or replace function public.fn_call_info(p_chat_id uuid) returns jsonb
    language sql stable security definer
    set search_path to 'public'
    as $$
  select public.assert_allowed(public.is_chat_member(p_chat_id));
  select jsonb_build_object(
    'tipo', c.tipo,
    'nombre', c.nombre,
    'foto', c.foto,
    'miembros', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'nombre', u.nombre, 'foto', u.profile_image))
      from chat_miembro cm
      join usuarios_public u on u.id = cm.user_id
      where cm.chat_id = c.id
    ), '[]'::jsonb)
  )
  from chat c
  where c.id = p_chat_id;
$$;

revoke all on function public.fn_call_info(uuid) from public, anon;
grant execute on function public.fn_call_info(uuid) to authenticated, service_role;

-- 4. Stale calls. The app stops ringing after 45 s; anything still ringing after 2 minutes
--    was abandoned. A call "active" for 6 hours lost its participants long ago.
create or replace function public.fn_llamadas_expire() returns jsonb
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_missed int;
  v_ended int;
begin
  update llamadas set estado = 'missed', finalizada_at = now()
   where estado = 'ringing' and iniciada_at < now() - interval '2 minutes';
  get diagnostics v_missed = row_count;

  update llamadas set estado = 'ended', finalizada_at = now()
   where estado = 'active' and iniciada_at < now() - interval '6 hours';
  get diagnostics v_ended = row_count;

  return jsonb_build_object('perdidas', v_missed, 'cerradas', v_ended);
end;
$$;

revoke all on function public.fn_llamadas_expire() from public, anon, authenticated;

select cron.schedule('llamadas-expire', '*/5 * * * *', 'select public.fn_llamadas_expire()');

-- The ones stuck today.
select public.fn_llamadas_expire();
