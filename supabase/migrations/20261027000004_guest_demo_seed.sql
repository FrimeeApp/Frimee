-- Demo content for guest (anonymous) users: a 4-day trip to Lisbon with three
-- made-up friends, activities on the map, shared expenses and a few chat
-- messages, so a visitor lands on a living plan instead of an empty app.
--
-- The app calls it right after signInAnonymously(). It is not run from the
-- auth trigger on purpose: if seeding failed there, signing in would fail too.
-- Friends are anonymous users tagged with raw_user_meta_data.demo_friend_of so
-- the guest cleanup job can delete them together with their guest.
-- All coordinates are fixed, so after the first guest every route comes from
-- route_cache instead of the Google Directions API.

create or replace function public.fn_guest_seed_demo() returns bigint
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_guest uuid := auth.uid();
  v_tz constant text := 'Europe/Lisbon';
  v_day1 date := (now() at time zone v_tz)::date + 7;
  v_friends uuid[] := '{}';
  v_friend uuid;
  v_name text;
  v_plan_id bigint;
  v_chat_id uuid;
  v_everyone jsonb;
  v_hotel bigint;
  v_market bigint;
  v_fado bigint;
  v_sintra bigint;
  v_gasto_id bigint;
  v_gasto record;
  v_msg record;
begin
  if v_guest is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true then
    raise exception 'Solo para invitados';
  end if;

  -- Once per guest: if they already have a plan, leave it alone.
  select plan_id into v_plan_id from plan_usuarios where user_id = v_guest limit 1;
  if v_plan_id is not null then
    return v_plan_id;
  end if;

  -- Friends (handle_auth_user_insert creates their usuarios row from full_name).
  foreach v_name in array array['Lucía', 'Marcos', 'Ana'] loop
    v_friend := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, is_anonymous, raw_user_meta_data, created_at, updated_at)
    values (
      v_friend, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true,
      jsonb_build_object('full_name', v_name, 'demo_friend_of', v_guest), now(), now()
    );
    v_friends := v_friends || v_friend;
  end loop;

  -- Plan: the guest is creator and admin (trg_plan_create_add_creator).
  select id into v_plan_id from fn_plan_create(
    'Escapada a Lisboa',
    'Cuatro días de miradouros, pastéis de nata y fado con los amigos.',
    (v_day1 + time '00:00') at time zone v_tz,
    (v_day1 + 3 + time '23:59') at time zone v_tz,
    'Lisboa, Portugal',
    v_guest,
    v_guest,
    true
  );

  insert into plan_usuarios (plan_id, user_id, rol, estado)
  select v_plan_id, unnest(v_friends), 'PARTICIPANTE', 'PARTICIPA';

  -- Chat with every current member (later members join via trg_plan_usuario_sync_chat).
  v_chat_id := fn_plan_create_chat(v_plan_id);

  -- Activities.
  insert into subplan (plan_id, titulo, descripcion, creado_por_user_id, inicio_at, fin_at,
                       ubicacion_nombre, ubicacion_lat, ubicacion_lng, tipo, orden)
  select v_plan_id, a.titulo, a.descripcion, a.creador,
         (v_day1 + a.dia + a.inicio) at time zone v_tz,
         (v_day1 + a.dia + a.fin) at time zone v_tz,
         a.lugar, a.lat, a.lng, a.tipo::tipo_subplan, a.orden
  from (values
    (0, time '11:00', time '12:00', 'Check-in en el hotel', 'Dejamos las maletas y salimos a explorar.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 1, v_friends[1]),
    (0, time '13:30', time '15:00', 'Comida en el Time Out Market', 'Cada uno elige puesto y comemos juntos.', 'Time Out Market Lisboa', 38.7069, -9.1458, 'RESTAURANTE', 2, v_guest),
    (0, time '18:30', time '20:00', 'Atardecer en el Miradouro da Senhora do Monte', 'Las mejores vistas de la ciudad.', 'Miradouro da Senhora do Monte', 38.7194, -9.1325, 'ACTIVIDAD', 3, v_friends[3]),
    (1, time '10:00', time '12:30', 'Torre de Belém y pastéis de nata', 'Parada obligatoria en Pastéis de Belém.', 'Torre de Belém', 38.6916, -9.2160, 'ACTIVIDAD', 4, v_friends[2]),
    (1, time '13:00', time '14:30', 'Monasterio de los Jerónimos', 'Entradas compradas online.', 'Mosteiro dos Jerónimos', 38.6979, -9.2068, 'ACTIVIDAD', 5, v_friends[2]),
    (1, time '21:00', time '23:00', 'Cena con fado en Alfama', 'Mesa reservada a las 21:00.', 'Alfama, Lisboa', 38.7114, -9.1302, 'RESTAURANTE', 6, v_friends[2]),
    (2, time '09:30', time '17:00', 'Excursión a Sintra', 'Tren desde Rossio y subida al Palacio da Pena.', 'Palácio Nacional da Pena', 38.7876, -9.3906, 'ACTIVIDAD', 7, v_friends[3])
  ) as a(dia, inicio, fin, titulo, descripcion, lugar, lat, lng, tipo, orden, creador);

  select id into v_hotel  from subplan where plan_id = v_plan_id and orden = 1;
  select id into v_market from subplan where plan_id = v_plan_id and orden = 2;
  select id into v_fado   from subplan where plan_id = v_plan_id and orden = 6;
  select id into v_sintra from subplan where plan_id = v_plan_id and orden = 7;

  -- Expenses split equally between the four, paid by different people.
  v_everyone := (
    select jsonb_agg(jsonb_build_object('user_id', u))
    from unnest(array[v_guest] || v_friends) as u
  );

  for v_gasto in
    select * from (values
      ('Hotel (3 noches)', 480.00, v_friends[1], 9,  v_hotel,  0, time '11:00'),
      ('Comida Time Out Market', 64.00, v_guest, 13, v_market, 0, time '15:00'),
      ('Cena con fado', 120.00, v_friends[2], 13, v_fado, 1, time '23:00'),
      ('Tren a Sintra', 18.40, v_friends[3], 3, v_sintra, 2, time '09:30')
    ) as g(titulo, total, pagador, categoria, subplan_id, dia, hora)
  loop
    insert into gastos (plan_id, subplan_id, titulo, created_by_user_id, pagado_por_user_id,
                        fecha_gasto, total, moneda, metodo_reparto, categoria_id, estado)
    values (v_plan_id, v_gasto.subplan_id, v_gasto.titulo, v_gasto.pagador, v_gasto.pagador,
            (v_day1 + v_gasto.dia + v_gasto.hora) at time zone v_tz, v_gasto.total, 'EUR',
            'IGUAL', v_gasto.categoria, 'CONFIRMADO')
    returning id into v_gasto_id;
    perform fn_gasto_insert_partes(v_gasto_id, v_gasto.pagador, v_gasto.total, 'IGUAL', v_everyone, null);
  end loop;

  perform fn_liquidaciones_recalculate_for_plan(v_plan_id);

  -- A short chat history from the friends.
  for v_msg in
    select * from (values
      (v_friends[1], '¡Hotel reservado! Ya he subido el gasto, me lo vais pasando 😊', interval '2 days'),
      (v_friends[2], 'He reservado mesa para el fado el segundo día a las 21:00', interval '1 day 3 hours'),
      (v_friends[3], 'Para Sintra mejor el tren de primera hora desde Rossio, que luego se llena', interval '5 hours'),
      (v_friends[1], '¿Alguien se encarga de la comida del primer día?', interval '20 minutes')
    ) as m(sender, texto, hace)
  loop
    insert into mensajes (chat_id, sender_id, texto, created_at, leido_por)
    values (v_chat_id, v_msg.sender, v_msg.texto, now() - v_msg.hace, array[v_msg.sender]);
  end loop;

  update chat
     set last_message = '¿Alguien se encarga de la comida del primer día?',
         last_message_at = now() - interval '20 minutes'
   where id = v_chat_id;

  return v_plan_id;
end;
$$;

revoke all on function public.fn_guest_seed_demo() from public, anon;
grant execute on function public.fn_guest_seed_demo() to authenticated;
