-- Salir de un plan y expulsar a alguien dejan aviso en el chat del plan (tablero cmd-17, cmd-18).
--
-- Antes, fn_plan_leave y fn_plan_kick_member borraban a la persona del chat sin decir nada:
-- nadie se enteraba de que alguien se había ido. Ahora:
--   · «Ana salió del plan» / «Álex quitó a Ana del plan» (aviso clase salio / quitado, con en = 'plan').
--   · fn_plan_salir y fn_plan_expulsar devuelven {resultado, aviso} para que la app lo reparta en vivo
--     (mensajes no va por realtime). fn_plan_leave y fn_plan_kick_member siguen devolviendo el texto
--     de siempre, así la app publicada no se rompe mientras se despliega la nueva.
-- Paso de publicación 2.33.

-- 1) Avisos: en los chats de plan dicen «del plan» en vez de «del grupo».
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
  v_donde text;
begin
  select nombre into v_actor from usuarios where id = p_actor;
  select nombre into v_user from usuarios where id = p_user;
  select case when tipo = 'PLAN' then 'plan' else 'grupo' end into v_donde from chat where id = p_chat_id;
  v_donde := coalesce(v_donde, 'grupo');
  v_texto := jsonb_build_object(
    'type', 'aviso', 'clase', p_clase, 'en', v_donde,
    'actor_id', p_actor, 'actor_nombre', coalesce(v_actor, 'Alguien'),
    'user_id', p_user, 'user_nombre', coalesce(v_user, 'Alguien'))::text;
  insert into mensajes (chat_id, sender_id, texto, leido_por)
  values (p_chat_id, p_actor, v_texto, array[p_actor])
  returning id into v_id;
  v_preview := case p_clase
    when 'anadido' then coalesce(v_actor, 'Alguien') || ' añadió a ' || coalesce(v_user, 'alguien')
    when 'quitado' then coalesce(v_actor, 'Alguien') || ' quitó a ' || coalesce(v_user, 'alguien') || ' del ' || v_donde
    when 'unio' then coalesce(v_user, 'Alguien') || ' se unió al plan'
    else coalesce(v_user, 'Alguien') || ' salió del ' || v_donde end;
  update chat set last_message = v_preview, last_message_at = now() where id = p_chat_id;
  return jsonb_build_object('mensaje_id', v_id, 'texto', v_texto);
end;
$$;
revoke all on function public.fn_chat_aviso_gente(uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_chat_aviso_gente(uuid, text, uuid, uuid) to service_role;

-- 2) Salir de un plan: mismas reglas que fn_plan_leave, con aviso.
create or replace function public.fn_plan_salir(p_plan_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_caller uuid := auth.uid();
  v_rol text;
  v_chat_id uuid;
  v_aviso jsonb;
begin
  select rol into v_rol from plan_usuarios where plan_id = p_plan_id and user_id = v_caller;
  if v_rol is null then return jsonb_build_object('resultado', 'not_member'); end if;
  if exists (select 1 from plan where id = p_plan_id and owner_user_id = v_caller) then
    return jsonb_build_object('resultado', 'owner_cannot_leave');
  end if;
  if v_rol = 'ADMIN' and not exists (
    select 1 from plan_usuarios where plan_id = p_plan_id and rol = 'ADMIN' and user_id <> v_caller) then
    return jsonb_build_object('resultado', 'last_admin');
  end if;

  delete from plan_usuarios where plan_id = p_plan_id and user_id = v_caller;
  select id into v_chat_id from chat where plan_id = p_plan_id and tipo = 'PLAN' limit 1;
  if v_chat_id is not null then
    delete from chat_miembro where chat_id = v_chat_id and user_id = v_caller;
    if found then
      v_aviso := public.fn_chat_aviso_gente(v_chat_id, 'salio', v_caller, v_caller);
    end if;
  end if;
  return jsonb_build_object('resultado', 'ok', 'aviso', v_aviso);
end;
$$;

-- 3) Expulsar: solo un admin, nunca al creador ni a uno mismo; con aviso.
create or replace function public.fn_plan_expulsar(p_plan_id bigint, p_target_user_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_caller uuid := auth.uid();
  v_rol text;
  v_chat_id uuid;
  v_aviso jsonb;
begin
  select rol into v_rol from plan_usuarios where plan_id = p_plan_id and user_id = v_caller;
  if v_rol is null then return jsonb_build_object('resultado', 'not_member'); end if;
  if v_rol <> 'ADMIN' then return jsonb_build_object('resultado', 'not_admin'); end if;
  if v_caller = p_target_user_id then return jsonb_build_object('resultado', 'cannot_kick_self'); end if;
  if exists (select 1 from plan where id = p_plan_id and owner_user_id = p_target_user_id) then
    return jsonb_build_object('resultado', 'cannot_kick_owner');
  end if;
  if not exists (select 1 from plan_usuarios where plan_id = p_plan_id and user_id = p_target_user_id) then
    return jsonb_build_object('resultado', 'target_not_member');
  end if;

  delete from plan_usuarios where plan_id = p_plan_id and user_id = p_target_user_id;
  select id into v_chat_id from chat where plan_id = p_plan_id and tipo = 'PLAN' limit 1;
  if v_chat_id is not null then
    delete from chat_miembro where chat_id = v_chat_id and user_id = p_target_user_id;
    if found then
      v_aviso := public.fn_chat_aviso_gente(v_chat_id, 'quitado', v_caller, p_target_user_id);
    end if;
  end if;
  return jsonb_build_object('resultado', 'ok', 'aviso', v_aviso);
end;
$$;

-- 4) Las de siempre delegan (la app publicada las sigue llamando hasta que se despliegue la nueva).
create or replace function public.fn_plan_leave(p_plan_id bigint)
 returns text
 language sql
 security definer
 set search_path to 'public'
as $$ select public.fn_plan_salir(p_plan_id) ->> 'resultado' $$;

create or replace function public.fn_plan_kick_member(p_plan_id bigint, p_target_user_id uuid)
 returns text
 language sql
 security definer
 set search_path to 'public'
as $$ select public.fn_plan_expulsar(p_plan_id, p_target_user_id) ->> 'resultado' $$;

revoke all on function public.fn_plan_salir(bigint) from public, anon;
grant execute on function public.fn_plan_salir(bigint) to authenticated, service_role;
revoke all on function public.fn_plan_expulsar(bigint, uuid) from public, anon;
grant execute on function public.fn_plan_expulsar(bigint, uuid) to authenticated, service_role;
revoke all on function public.fn_plan_leave(bigint) from public, anon;
grant execute on function public.fn_plan_leave(bigint) to authenticated, service_role;
revoke all on function public.fn_plan_kick_member(bigint, uuid) from public, anon;
grant execute on function public.fn_plan_kick_member(bigint, uuid) to authenticated, service_role;
