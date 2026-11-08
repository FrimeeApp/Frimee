-- The example trip becomes the full one: Barcelona -> Lisbon by plane, 21 connected
-- activities with the hotel between days, the flight back, expenses and 13 photos
-- (fremee/public/demo/lisboa, credits in src/config/demo-photos.ts).
-- Replaces the short trip of 20261027000004 and keeps the guard of 20261108000002
-- (any account with no plans, not only guests). Plans created before keep their trip.
--
-- Demo content for guest (anonymous) users: a 4-day trip from Barcelona to Lisbon
-- with three made-up friends (flights there and back, every day starting and ending
-- at the hotel), shared expenses, album photos and a few chat messages, so a visitor
-- lands on a living plan instead of an empty app.
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
  v_vuelo bigint;
  v_hotel bigint;
  v_market bigint;
  v_fado bigint;
  v_sintra bigint;
  v_regaleira bigint;
  v_oceanario bigint;
  v_gasto_id bigint;
  v_gasto record;
  v_msg record;
begin
  if v_guest is null then
    raise exception 'Hace falta una sesión';
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

  -- Activities, in order (orden). transporte = how you get there from the previous
  -- activity of the day (null for the first one of each day). Flights carry their
  -- landing place in ubicacion_fin_*: the next leg starts there. Times are Lisbon time
  -- (the flight from Barcelona leaves at 08:30 there, 07:30 here).
  insert into subplan (plan_id, titulo, descripcion, creado_por_user_id, inicio_at, fin_at,
                       ubicacion_nombre, ubicacion_lat, ubicacion_lng, tipo, orden, transporte_llegada,
                       ubicacion_fin_nombre, ubicacion_fin_lat, ubicacion_fin_lng)
  select v_plan_id, a.titulo, a.descripcion, a.creador,
         (v_day1 + a.dia + a.inicio) at time zone v_tz,
         (v_day1 + a.dia + a.fin) at time zone v_tz,
         a.lugar, a.lat, a.lng, a.tipo::tipo_subplan, a.orden, a.transporte,
         a.fin_lugar, a.fin_lat, a.fin_lng
  from (values
    -- Día 1: Barcelona → Lisboa, el centro
    (0, time '07:30', time '09:45', 'Vuelo Barcelona → Lisboa', 'Salimos de El Prat a primera hora.', 'Aeropuerto de Barcelona-El Prat', 41.2974, 2.0833, 'VUELO', 1, v_guest, null, 'Aeropuerto de Lisboa', 38.7742::float8, -9.1342::float8),
    (0, time '10:30', time '11:30', 'Check-in en el hotel', 'Dejamos las maletas y salimos a explorar.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 2, v_friends[1], 'METRO', null, null, null),
    (0, time '13:30', time '15:00', 'Comida en el Time Out Market', 'Cada uno elige puesto y comemos juntos.', 'Time Out Market Lisboa', 38.7069, -9.1458, 'RESTAURANTE', 3, v_guest, 'APIE', null, null, null),
    (0, time '15:45', time '16:45', 'Praça do Comércio', 'Paseo por la Baixa hasta el Arco da Rua Augusta y el río.', 'Praça do Comércio', 38.7075, -9.1364, 'ACTIVIDAD', 4, v_friends[2], 'APIE', null, null, null),
    (0, time '18:30', time '20:00', 'Atardecer en el Miradouro da Senhora do Monte', 'Las mejores vistas de la ciudad.', 'Miradouro da Senhora do Monte', 38.7194, -9.1325, 'ACTIVIDAD', 5, v_friends[3], 'TAXI', null, null, null),
    (0, time '20:45', time '21:30', 'Vuelta al hotel', 'Ducha rápida y a descansar.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 6, v_friends[1], 'APIE', null, null, null),
    -- Día 2: Belém y Alfama
    (1, time '08:30', time '09:30', 'Desayuno en el hotel', 'Café y tostadas antes de ir a Belém.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 7, v_friends[1], null, null, null, null),
    (1, time '10:15', time '11:45', 'Torre de Belém', 'Subimos a la terraza de la torre.', 'Torre de Belém', 38.6916, -9.2160, 'ACTIVIDAD', 8, v_friends[2], 'BUS', null, null, null),
    (1, time '12:00', time '12:45', 'Pastéis de Belém', 'Parada obligatoria: pastéis recién hechos.', 'Pastéis de Belém', 38.6975, -9.2032, 'RESTAURANTE', 9, v_friends[2], 'APIE', null, null, null),
    (1, time '13:00', time '14:30', 'Monasterio de los Jerónimos', 'Entradas compradas online.', 'Mosteiro dos Jerónimos', 38.6979, -9.2068, 'ACTIVIDAD', 10, v_friends[2], 'APIE', null, null, null),
    (1, time '15:30', time '17:30', 'LX Factory', 'Librería Ler Devagar y tiendas bajo el puente.', 'LX Factory', 38.7032, -9.1786, 'ACTIVIDAD', 11, v_friends[3], 'BUS', null, null, null),
    (1, time '20:30', time '22:30', 'Cena con fado en Alfama', 'Mesa reservada a las 20:30.', 'Alfama, Lisboa', 38.7114, -9.1302, 'RESTAURANTE', 12, v_friends[2], 'TAXI', null, null, null),
    -- Before 23:00 in Lisbon: past midnight in Spain the album (viewer's time) would move it to the next day.
    (1, time '22:45', time '23:00', 'Vuelta al hotel', 'Paseo de vuelta por la Baixa.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 13, v_friends[1], 'APIE', null, null, null),
    -- Día 3: Sintra y Cabo da Roca
    (2, time '08:00', time '08:45', 'Desayuno en el hotel', 'Salimos pronto para evitar las colas.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 14, v_friends[1], null, null, null, null),
    (2, time '10:00', time '13:00', 'Palácio Nacional da Pena', 'Tren desde Rossio y subida al palacio.', 'Palácio Nacional da Pena', 38.7876, -9.3906, 'ACTIVIDAD', 15, v_friends[3], 'TREN', null, null, null),
    (2, time '13:45', time '15:45', 'Quinta da Regaleira', 'El pozo iniciático y los jardines.', 'Quinta da Regaleira', 38.7963, -9.3961, 'ACTIVIDAD', 16, v_friends[3], 'APIE', null, null, null),
    (2, time '17:15', time '18:30', 'Atardecer en Cabo da Roca', 'El punto más occidental de Europa.', 'Cabo da Roca', 38.7804, -9.4989, 'ACTIVIDAD', 17, v_friends[1], 'BUS', null, null, null),
    (2, time '19:45', time '20:30', 'Vuelta al hotel', 'Cena tranquila cerca del hotel.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 18, v_friends[1], 'COCHE', null, null, null),
    -- Día 4: Oceanário y vuelta a Barcelona
    (3, time '08:30', time '09:15', 'Desayuno y check-out', 'Maletas en consigna hasta la tarde.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 19, v_friends[1], null, null, null, null),
    (3, time '10:00', time '12:00', 'Oceanário de Lisboa', 'El gran tanque central, imprescindible.', 'Oceanário de Lisboa', 38.7633, -9.0937, 'ACTIVIDAD', 20, v_guest, 'METRO', null, null, null),
    (3, time '15:30', time '17:45', 'Vuelo Lisboa → Barcelona', 'Vuelta a casa con la mochila llena.', 'Aeropuerto de Lisboa', 38.7742, -9.1342, 'VUELO', 21, v_guest, 'TAXI', 'Aeropuerto de Barcelona-El Prat', 41.2974::float8, 2.0833::float8)
  ) as a(dia, inicio, fin, titulo, descripcion, lugar, lat, lng, tipo, orden, creador, transporte, fin_lugar, fin_lat, fin_lng);

  -- Legs from the shared route cache: every guest gets the same trip, so after the
  -- first one computed them (in the itinerary or the album) the rest start with
  -- routes, times and distances and no Google call. The previous activity is
  -- orden - 1 (the first of each day has no transport). Needs route_cache.modo
  -- and route_cache_modo() from 20261027000007, applied before any guest signs in.
  update subplan d
     set ruta_polyline = rc.polyline,
         distancia_viaje = rc.distance,
         duracion_viaje = rc.duration
    from subplan o, route_cache rc
   where d.plan_id = v_plan_id
     and o.plan_id = v_plan_id
     and o.orden = d.orden - 1
     and d.transporte_llegada is not null
     -- After a flight the leg starts where it landed.
     and rc.origin_lat = round((case when o.tipo in ('VUELO', 'BARCO') and o.ubicacion_fin_lat is not null then o.ubicacion_fin_lat else o.ubicacion_lat end)::numeric, 4)::double precision
     and rc.origin_lng = round((case when o.tipo in ('VUELO', 'BARCO') and o.ubicacion_fin_lng is not null then o.ubicacion_fin_lng else o.ubicacion_lng end)::numeric, 4)::double precision
     and rc.dest_lat = round(d.ubicacion_lat::numeric, 4)::double precision
     and rc.dest_lng = round(d.ubicacion_lng::numeric, 4)::double precision
     and rc.modo = public.route_cache_modo(d.transporte_llegada);

  select id into v_vuelo     from subplan where plan_id = v_plan_id and orden = 1;
  select id into v_hotel     from subplan where plan_id = v_plan_id and orden = 2;
  select id into v_market    from subplan where plan_id = v_plan_id and orden = 3;
  select id into v_fado      from subplan where plan_id = v_plan_id and orden = 12;
  select id into v_sintra    from subplan where plan_id = v_plan_id and orden = 15;
  select id into v_regaleira from subplan where plan_id = v_plan_id and orden = 16;
  select id into v_oceanario from subplan where plan_id = v_plan_id and orden = 20;

  -- Photos for the trip album: Wikimedia Commons images shipped with the app
  -- (fremee/public/demo/lisboa, credits in src/config/demo-photos.ts). Dated on
  -- their day so the album places each one in its chapter. No Firebase file
  -- behind them: storage_path only marks where they come from.
  insert into plan_fotos (plan_id, user_id, url, storage_path, created_at)
  select v_plan_id, f.autor, '/demo/lisboa/' || f.archivo || '.webp', 'demo/lisboa/' || f.archivo || '.webp',
         (v_day1 + f.dia + f.hora) at time zone v_tz
  from (values
    (0, time '11:00', 'hotel', v_friends[1]),
    (0, time '14:10', 'time-out-market', v_guest),
    (0, time '19:30', 'miradouro', v_friends[3]),
    (1, time '10:40', 'torre-belem', v_friends[2]),
    (1, time '12:15', 'pastel-de-nata', v_friends[2]),
    (1, time '13:40', 'jeronimos', v_friends[1]),
    (1, time '21:45', 'alfama', v_guest),
    (0, time '16:10', 'praca-comercio', v_friends[2]),
    (1, time '16:00', 'lx-factory', v_friends[3]),
    (2, time '11:30', 'pena', v_friends[3]),
    (2, time '14:30', 'regaleira', v_friends[3]),
    (2, time '17:45', 'cabo-da-roca', v_friends[1]),
    (3, time '10:45', 'oceanario', v_guest)
  ) as f(dia, hora, archivo, autor);

  -- Expenses split equally between the four, paid by different people.
  v_everyone := (
    select jsonb_agg(jsonb_build_object('user_id', u))
    from unnest(array[v_guest] || v_friends) as u
  );

  for v_gasto in
    select * from (values
      ('Vuelos Barcelona–Lisboa (ida y vuelta)', 512.00, v_guest, 1, v_vuelo, 0, time '07:00'),
      ('Hotel (3 noches)', 480.00, v_friends[1], 9,  v_hotel,  0, time '10:30'),
      ('Comida Time Out Market', 64.00, v_guest, 13, v_market, 0, time '15:00'),
      ('Cena con fado', 120.00, v_friends[2], 13, v_fado, 1, time '22:30'),
      ('Tren a Sintra', 18.40, v_friends[3], 3, v_sintra, 2, time '09:30'),
      -- Ticket prices from the official sites (read 2026-11-08), for four adults.
      ('Entradas Palácio da Pena (visita esencial)', 80.00, v_friends[3], 16, v_sintra, 2, time '10:00'),
      ('Entradas Quinta da Regaleira', 80.00, v_friends[1], 16, v_regaleira, 2, time '13:45'),
      ('Entradas Oceanário (franja de las 10:00)', 119.60, v_friends[2], 16, v_oceanario, 3, time '10:00')
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
      (v_friends[2], 'He reservado mesa para el fado el segundo día a las 20:30', interval '1 day 3 hours'),
      (v_friends[3], 'Para Sintra mejor el tren de primera hora desde Rossio, que luego se llena', interval '5 hours'),
      (v_friends[1], '¿Alguien se encarga de la comida del primer día?', interval '20 minutes')
    ) as m(sender, texto, hace)
  loop
    insert into mensajes (chat_id, sender_id, texto, created_at, leido_por)
    values (v_chat_id, v_msg.sender, v_msg.texto, now() - v_msg.hace, array[v_msg.sender]);
  end loop;

  -- The chat's last message is Frimee's welcome, added by trg_chat_plan_welcome
  -- (20261027000006) when fn_plan_create_chat created the chat: it is newer than these.

  return v_plan_id;
end;
$$;

revoke all on function public.fn_guest_seed_demo() from public, anon;
grant execute on function public.fn_guest_seed_demo() to authenticated;
