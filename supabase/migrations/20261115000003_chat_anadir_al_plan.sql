-- Chat: «Añadir al plan» from the chat itself (boards m-anadir, d-anadir, e-anadir, g-proponer).
--
-- 1) fn_chat_anadir_al_plan: the activity AND its mark in the chat («Añadiste «Taberna da Rua» al plan ·
--    Día 2, 21:00»), in one transaction, with a client_id so a retry or a double tap never adds it
--    twice (chat_acciones, from 20261115000002). The mark is a message {type: "hito_plan"}: a filled
--    diamond on the spine that the ruler counts as a decided milestone. fn_subplan_create keeps checking
--    that you are an admin of that plan.
-- 2) fn_chat_deshacer_anadir: «Deshacer» in the toast: removes the activity and its mark, only by
--    whoever added it and only for a few minutes (after that, from the plan, like any activity).
-- 3) fn_chat_indice: the marks count as decided milestones of the ruler.

create or replace function public.fn_chat_anadir_al_plan(
  p_client_id uuid,
  p_chat_id uuid,
  p_plan_id bigint,
  p_titulo text,
  p_tipo tipo_subplan,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_ubicacion_nombre text default '',
  p_lat double precision default null,
  p_lng double precision default null,
  p_origen_id bigint default null
) returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_inserted boolean;
  v_prev jsonb;
  v_subplan bigint;
  v_plan_titulo text;
  v_texto text;
  v_msg bigint;
  v_result jsonb;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  if coalesce(trim(p_titulo), '') = '' or p_inicio is null or p_fin is null or p_fin < p_inicio then
    raise exception 'Actividad no válida' using errcode = '22023';
  end if;

  insert into chat_acciones (client_id, user_id, accion) values (p_client_id, auth.uid(), 'plan')
  on conflict (client_id) do nothing;
  get diagnostics v_inserted = row_count;
  if not v_inserted then
    select resultado into v_prev from chat_acciones where client_id = p_client_id and user_id = auth.uid();
    if v_prev is not null then return v_prev; end if;
    raise exception 'Petición repetida' using errcode = '22023';
  end if;

  -- Admins only (checked inside), within the plan's dates.
  v_subplan := public.fn_subplan_create(
    p_plan_id, trim(p_titulo), '', p_inicio, p_fin, false,
    coalesce(p_ubicacion_nombre, ''), null, null, p_tipo, null, null, p_lat, p_lng, null, null, null);

  select titulo into v_plan_titulo from plan where id = p_plan_id;
  v_texto := jsonb_build_object(
    'type', 'hito_plan', 'subplan_id', v_subplan, 'plan_id', p_plan_id, 'plan_titulo', v_plan_titulo,
    'titulo', trim(p_titulo), 'tipo', p_tipo, 'inicio_at', p_inicio, 'lugar', nullif(p_ubicacion_nombre, ''),
    'origen_id', p_origen_id)::text;
  v_msg := public.fn_mensaje_send(p_chat_id, v_texto, p_origen_id, null, null, null, null, null);

  v_result := jsonb_build_object('subplan_id', v_subplan, 'mensaje_id', v_msg, 'texto', v_texto);
  update chat_acciones set resultado = v_result where client_id = p_client_id;
  return v_result;
end;
$$;

create or replace function public.fn_chat_deshacer_anadir(p_mensaje_id bigint)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_sender uuid;
  v_created timestamptz;
  v_j jsonb;
begin
  select sender_id, created_at, public.try_jsonb(texto) into v_sender, v_created, v_j
    from mensajes where id = p_mensaje_id
    for update;
  if not found or v_j->>'type' is distinct from 'hito_plan' then
    raise exception 'No es una marca del plan' using errcode = '22023';
  end if;
  if v_sender is distinct from auth.uid() then
    raise exception 'Solo quien lo añadió puede deshacerlo' using errcode = '42501';
  end if;
  if v_created < now() - interval '10 minutes' then
    raise exception 'Ya no se puede deshacer desde el chat' using errcode = '22023';
  end if;
  perform public.fn_subplan_delete((v_j->>'subplan_id')::bigint, false);
  delete from mensajes where id = p_mensaje_id;
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
     where j->>'type' in ('poll', 'propuesta', 'hito_plan')
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
          when j->>'type' = 'hito_plan' or j->>'estado' = 'aceptada' then 'decidido'
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

revoke all on function public.fn_chat_anadir_al_plan(uuid, uuid, bigint, text, tipo_subplan, timestamptz, timestamptz, text, double precision, double precision, bigint) from public, anon;
grant execute on function public.fn_chat_anadir_al_plan(uuid, uuid, bigint, text, tipo_subplan, timestamptz, timestamptz, text, double precision, double precision, bigint) to authenticated, service_role;
revoke all on function public.fn_chat_deshacer_anadir(bigint) from public, anon;
grant execute on function public.fn_chat_deshacer_anadir(bigint) to authenticated, service_role;
