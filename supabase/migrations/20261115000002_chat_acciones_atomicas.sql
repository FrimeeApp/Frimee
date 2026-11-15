-- Chat: actions that used to be several calls from the app become one transaction in the database,
-- so a dropped connection or a closed app never leaves them half done, and a retry never repeats them.
--
-- 1) fn_chat_registrar_gasto: the expense AND its message in the chat (the card, or the text of
--    @frimee's confirmation). Before, the app created the expense and then sent the card: if the
--    second call failed it said «No se pudo registrar el gasto» although it was registered, and
--    trying again created it twice.
-- 2) fn_propuesta_aceptar: accepting a proposal of @frimee AND doing what it proposes (expense, task,
--    activity, poll). Before, the app marked it accepted first: closing the app in between left it
--    accepted with nothing done, and nobody could accept it again.
--
-- Retries: each request carries a client_id (made when the sheet opens). chat_acciones keeps the
-- result of every one, so the same request twice returns the first result instead of running again.
-- The functions below (fn_gasto_create, fn_tarea_create, fn_subplan_create, fn_mensaje_send) keep
-- checking who you are (auth.uid()): membership and admin rules stay the same.

create table if not exists public.chat_acciones (
  client_id uuid primary key,
  user_id uuid not null,
  accion text not null,
  resultado jsonb,
  created_at timestamptz not null default now()
);
alter table public.chat_acciones enable row level security;
-- No policies: only the functions below (security definer) read or write it.
revoke all on public.chat_acciones from public, anon, authenticated;

create or replace function public.fn_chat_registrar_gasto(
  p_client_id uuid,
  p_chat_id uuid,
  p_plan_id bigint,
  p_titulo text,
  p_total numeric,
  p_pagado_por uuid,
  p_participantes uuid[],
  p_texto text default null
) returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_inserted boolean;
  v_prev jsonb;
  v_gasto bigint;
  v_msg bigint;
  v_nombre text;
  v_texto text;
  v_result jsonb;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  if not exists (select 1 from chat where id = p_chat_id and plan_id = p_plan_id) then
    raise exception 'El chat no es de este plan' using errcode = '22023';
  end if;
  if p_total is null or p_total <= 0 or coalesce(array_length(p_participantes, 1), 0) = 0 then
    raise exception 'Gasto no válido' using errcode = '22023';
  end if;

  -- Claim the request. A second one with the same client_id waits here for the first to finish,
  -- then gets its result.
  insert into chat_acciones (client_id, user_id, accion) values (p_client_id, auth.uid(), 'gasto')
  on conflict (client_id) do nothing;
  get diagnostics v_inserted = row_count;
  if not v_inserted then
    select resultado into v_prev from chat_acciones where client_id = p_client_id and user_id = auth.uid();
    if v_prev is not null then return v_prev; end if;
    raise exception 'Petición repetida' using errcode = '22023';
  end if;

  -- The 13-argument version (with receipt), so the call is never ambiguous.
  v_gasto := public.fn_gasto_create(
    p_plan_id, p_titulo, p_pagado_por, now(), p_total, 'IGUAL'::metodo_reparto,
    (select jsonb_agg(jsonb_build_object('user_id', u)) from unnest(p_participantes) as u),
    null, null, null, 'EUR', null, null);

  if p_texto is not null then
    v_texto := p_texto;
  else
    select split_part(coalesce(nombre, ''), ' ', 1) into v_nombre from usuarios where id = p_pagado_por;
    v_texto := jsonb_build_object(
      'type', 'gasto', 'titulo', p_titulo, 'total', p_total,
      'pagado_por_nombre', coalesce(nullif(v_nombre, ''), 'Alguien'),
      'participantes', array_length(p_participantes, 1))::text;
  end if;
  v_msg := public.fn_mensaje_send(p_chat_id, v_texto, null, null, null, null, null, null);

  v_result := jsonb_build_object('gasto_id', v_gasto, 'mensaje_id', v_msg, 'texto', v_texto);
  update chat_acciones set resultado = v_result where client_id = p_client_id;
  return v_result;
end;
$$;

create or replace function public.fn_propuesta_aceptar(p_mensaje_id bigint, p_resultado text default null)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_chat_id uuid;
  v_tipo text;
  v_parsed jsonb;
  v_pl jsonb;
  v_plan_id bigint;
  v_nombre text;
  v_inicio timestamptz;
  v_poll_id bigint;
  v_poll_texto text;
  v_texto text;
begin
  select chat_id, tipo, texto::jsonb into v_chat_id, v_tipo, v_parsed
    from mensajes where id = p_mensaje_id
    for update;
  if not found or v_tipo <> 'bot' or v_parsed->>'type' <> 'propuesta' then
    raise exception 'Not a proposal' using errcode = '22023';
  end if;
  perform public.assert_allowed(public.is_chat_member(v_chat_id));
  -- Someone got there first.
  if v_parsed->>'estado' is distinct from 'pendiente' then
    return jsonb_build_object('claimed', false, 'texto', v_parsed::text);
  end if;

  select plan_id into v_plan_id from chat where id = v_chat_id;
  v_pl := coalesce(v_parsed->'payload', '{}'::jsonb);

  -- Do what it proposes. Any error rolls everything back: the proposal stays pending.
  case v_parsed->>'kind'
    when 'gasto' then
      if v_plan_id is null then raise exception 'no_plan' using errcode = '22023'; end if;
      perform public.fn_gasto_create(
        v_plan_id, v_pl->>'titulo', (v_pl->>'pagado_por_id')::uuid, now(), (v_pl->>'total')::numeric, 'IGUAL'::metodo_reparto,
        (select jsonb_agg(jsonb_build_object('user_id', x)) from jsonb_array_elements_text(v_pl->'participantes') as x),
        null, null, null, 'EUR', null, null);
    when 'tarea' then
      if v_plan_id is null then raise exception 'no_plan' using errcode = '22023'; end if;
      perform public.fn_tarea_create(v_plan_id, v_pl->>'titulo', (v_pl->>'asignado_id')::uuid, (v_pl->>'categoria')::categoria_tarea);
    when 'actividad' then
      if v_plan_id is null then raise exception 'no_plan' using errcode = '22023'; end if;
      v_inicio := (v_pl->>'inicio')::timestamptz;
      -- A two-hour block in the itinerary; it can be changed in the plan.
      perform public.fn_subplan_create(
        v_plan_id, v_pl->>'titulo', coalesce(v_pl->>'detalle', ''), v_inicio, v_inicio + interval '2 hours', false,
        coalesce(v_pl->>'lugar', ''), null, null, 'ACTIVIDAD'::tipo_subplan, null, null, null, null, null, null, null);
    when 'encuesta' then
      v_poll_texto := jsonb_build_object('type', 'poll', 'question', v_pl->>'question', 'options', v_pl->'options')::text;
      v_poll_id := public.fn_mensaje_send(v_chat_id, v_poll_texto, null, null, null, null, null, null);
    else
      raise exception 'Unknown proposal' using errcode = '22023';
  end case;

  select split_part(coalesce(nombre, ''), ' ', 1) into v_nombre from usuarios where id = auth.uid();
  v_texto := (v_parsed || jsonb_build_object(
    'estado', 'aceptada',
    'resuelta_por', auth.uid(),
    'resuelta_por_nombre', coalesce(nullif(v_nombre, ''), 'Alguien'),
    'resuelta_at', now(),
    'resultado', p_resultado))::text;
  update mensajes set texto = v_texto where id = p_mensaje_id;

  return jsonb_build_object('claimed', true, 'texto', v_texto, 'poll_id', v_poll_id, 'poll_texto', v_poll_texto);
end;
$$;

revoke all on function public.fn_chat_registrar_gasto(uuid, uuid, bigint, text, numeric, uuid, uuid[], text) from public, anon;
grant execute on function public.fn_chat_registrar_gasto(uuid, uuid, bigint, text, numeric, uuid, uuid[], text) to authenticated, service_role;
revoke all on function public.fn_propuesta_aceptar(bigint, text) from public, anon;
grant execute on function public.fn_propuesta_aceptar(bigint, text) to authenticated, service_role;
