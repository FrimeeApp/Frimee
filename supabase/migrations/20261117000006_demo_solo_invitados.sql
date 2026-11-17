-- La demo es solo para invitados (2026-11-17).
-- «Ver un plan de ejemplo» en una cuenta registrada le dejaba para siempre amigos inventados,
-- chats y avisos. El botón desaparece de la app y fn_guest_seed_demo rechaza a quien no es
-- invitado. Solo cambia esa comprobación respecto a 20261117000003.

create or replace function public.fn_guest_seed_demo()
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_guest uuid := auth.uid();
  v_tz constant text := 'Europe/Madrid';
  v_lis constant text := 'Europe/Lisbon';
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_day1 date := (now() at time zone 'Europe/Madrid')::date;
  v_sabado date;
  v_roma1 date := (now() at time zone 'Europe/Madrid')::date - 24;
  v_lucia uuid; v_marcos uuid; v_ana uuid;
  v_carmen uuid; v_javier uuid; v_sara uuid;
  v_alex uuid; v_pablo uuid;
  v_otro uuid;
  v_friends uuid[];
  v_plan_id bigint;
  v_chat_id uuid;
  v_fam_plan bigint; v_fam_chat uuid;
  v_roma bigint; v_roma_chat uuid;
  v_concierto bigint;
  v_chat uuid;
  v_everyone jsonb;
  v_vuelo bigint; v_hotel bigint; v_market bigint; v_fado bigint;
  v_sintra bigint; v_regaleira bigint; v_oceanario bigint;
  v_comida bigint;
  v_tarea bigint;
  v_gasto_id bigint;
  v_gasto record;
  v_msg bigint;
begin
  if v_guest is null then
    raise exception 'Hace falta una sesión';
  end if;
  -- Only guests: in a real account it would leave invented friends, chats and notices.
  if not exists (select 1 from auth.users where id = v_guest and is_anonymous) then
    raise exception 'El plan de ejemplo es solo para el modo invitado' using errcode = '42501';
  end if;

  -- Once per guest: if they already have a plan, leave it alone.
  select plan_id into v_plan_id from plan_usuarios where user_id = v_guest limit 1;
  if v_plan_id is not null then
    return v_plan_id;
  end if;

  -- People (handle_auth_user_insert creates their usuarios row from full_name).
  v_lucia  := fn_demo_persona(v_guest, 'Lucía');
  v_marcos := fn_demo_persona(v_guest, 'Marcos');
  v_ana    := fn_demo_persona(v_guest, 'Ana');
  v_carmen := fn_demo_persona(v_guest, 'Carmen');
  v_javier := fn_demo_persona(v_guest, 'Javier');
  v_sara   := fn_demo_persona(v_guest, 'Sara');
  v_alex   := fn_demo_persona(v_guest, 'Álex');
  v_pablo  := fn_demo_persona(v_guest, 'Pablo');
  v_friends := array[v_lucia, v_marcos, v_ana];

  -- Friends with everyone but Pablo, whose request is waiting in the notifications.
  foreach v_otro in array array[v_lucia, v_marcos, v_ana, v_carmen, v_javier, v_sara, v_alex] loop
    insert into amistades (user_id_1, user_id_2, estado)
    values (least(v_guest, v_otro), greatest(v_guest, v_otro), 'ACTIVA');
  end loop;
  insert into amistades (user_id_1, user_id_2, estado)
  values (least(v_guest, v_pablo), greatest(v_guest, v_pablo), 'PENDIENTE');
  insert into notificaciones (user_id, tipo, actor_id, entity_type, created_at)
  values (v_guest, 'friend_request', v_pablo, 'friendship', now() - interval '3 hours');

  -- ── Plan 1 · Amigos: Escapada a Lisboa, empieza hoy (el viaje en curso) ──
  -- The plan's days are Spanish days (that is how the app counts them); the activities,
  -- Lisbon time (the flight from Barcelona leaves at 08:30 there, 07:30 here).
  select id into v_plan_id from fn_plan_create(
    'Escapada a Lisboa',
    'Cuatro días de miradouros, pastéis de nata y fado con los amigos.',
    (v_day1 + time '00:00') at time zone v_tz,
    (v_day1 + 3 + time '23:59') at time zone v_tz,
    'Lisboa, Portugal',
    v_guest,
    v_guest,
    true,
    'SOLO_GRUPO',
    null,
    '/demo/lisboa/miradouro.webp'
  );

  insert into plan_usuarios (plan_id, user_id, rol, estado)
  select v_plan_id, unnest(v_friends), 'PARTICIPANTE', 'PARTICIPA';

  -- Chat with every current member (later members join via trg_plan_usuario_sync_chat).
  v_chat_id := fn_plan_create_chat(v_plan_id);

  -- Activities, in order (orden). transporte = how you get there from the previous
  -- activity of the day (null for the first one of each day). Flights carry their
  -- landing place in ubicacion_fin_*: the next leg starts there.
  insert into subplan (plan_id, titulo, descripcion, creado_por_user_id, inicio_at, fin_at,
                       ubicacion_nombre, ubicacion_lat, ubicacion_lng, tipo, orden, transporte_llegada,
                       ubicacion_fin_nombre, ubicacion_fin_lat, ubicacion_fin_lng)
  select v_plan_id, a.titulo, a.descripcion, a.creador,
         (v_day1 + a.dia + a.inicio) at time zone v_lis,
         (v_day1 + a.dia + a.fin) at time zone v_lis,
         a.lugar, a.lat, a.lng, a.tipo::tipo_subplan, a.orden, a.transporte,
         a.fin_lugar, a.fin_lat, a.fin_lng
  from (values
    -- Día 1: Barcelona → Lisboa, el centro
    (0, time '07:30', time '09:45', 'Vuelo Barcelona → Lisboa', 'Salimos de El Prat a primera hora.', 'Aeropuerto de Barcelona-El Prat', 41.2974, 2.0833, 'VUELO', 1, v_guest, null, 'Aeropuerto de Lisboa', 38.7742::float8, -9.1342::float8),
    (0, time '10:30', time '11:30', 'Check-in en el hotel', 'Dejamos las maletas y salimos a explorar.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 2, v_lucia, 'METRO', null, null, null),
    (0, time '13:30', time '15:00', 'Comida en el Time Out Market', 'Cada uno elige puesto y comemos juntos.', 'Time Out Market Lisboa', 38.7069, -9.1458, 'RESTAURANTE', 3, v_guest, 'APIE', null, null, null),
    (0, time '15:45', time '16:45', 'Praça do Comércio', 'Paseo por la Baixa hasta el Arco da Rua Augusta y el río.', 'Praça do Comércio', 38.7075, -9.1364, 'ACTIVIDAD', 4, v_marcos, 'APIE', null, null, null),
    (0, time '18:30', time '20:00', 'Atardecer en el Miradouro da Senhora do Monte', 'Las mejores vistas de la ciudad.', 'Miradouro da Senhora do Monte', 38.7194, -9.1325, 'ACTIVIDAD', 5, v_ana, 'TAXI', null, null, null),
    (0, time '20:45', time '21:30', 'Vuelta al hotel', 'Ducha rápida y a descansar.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 6, v_lucia, 'APIE', null, null, null),
    -- Día 2: Belém y Alfama
    (1, time '08:30', time '09:30', 'Desayuno en el hotel', 'Café y tostadas antes de ir a Belém.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 7, v_lucia, null, null, null, null),
    (1, time '10:15', time '11:45', 'Torre de Belém', 'Subimos a la terraza de la torre.', 'Torre de Belém', 38.6916, -9.2160, 'ACTIVIDAD', 8, v_marcos, 'BUS', null, null, null),
    (1, time '12:00', time '12:45', 'Pastéis de Belém', 'Parada obligatoria: pastéis recién hechos.', 'Pastéis de Belém', 38.6975, -9.2032, 'RESTAURANTE', 9, v_marcos, 'APIE', null, null, null),
    (1, time '13:00', time '14:30', 'Monasterio de los Jerónimos', 'Entradas compradas online.', 'Mosteiro dos Jerónimos', 38.6979, -9.2068, 'ACTIVIDAD', 10, v_marcos, 'APIE', null, null, null),
    (1, time '15:30', time '17:30', 'LX Factory', 'Librería Ler Devagar y tiendas bajo el puente.', 'LX Factory', 38.7032, -9.1786, 'ACTIVIDAD', 11, v_ana, 'BUS', null, null, null),
    (1, time '20:30', time '22:30', 'Cena con fado en Alfama', 'Mesa reservada a las 20:30.', 'Alfama, Lisboa', 38.7114, -9.1302, 'RESTAURANTE', 12, v_marcos, 'TAXI', null, null, null),
    -- Before 23:00 in Lisbon: past midnight in Spain the album (viewer's time) would move it to the next day.
    (1, time '22:45', time '23:00', 'Vuelta al hotel', 'Paseo de vuelta por la Baixa.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 13, v_lucia, 'APIE', null, null, null),
    -- Día 3: Sintra y Cabo da Roca
    (2, time '08:00', time '08:45', 'Desayuno en el hotel', 'Salimos pronto para evitar las colas.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 14, v_lucia, null, null, null, null),
    (2, time '10:00', time '13:00', 'Palácio Nacional da Pena', 'Tren desde Rossio y subida al palacio.', 'Palácio Nacional da Pena', 38.7876, -9.3906, 'ACTIVIDAD', 15, v_ana, 'TREN', null, null, null),
    (2, time '13:45', time '15:45', 'Quinta da Regaleira', 'El pozo iniciático y los jardines.', 'Quinta da Regaleira', 38.7963, -9.3961, 'ACTIVIDAD', 16, v_ana, 'APIE', null, null, null),
    (2, time '17:15', time '18:30', 'Atardecer en Cabo da Roca', 'El punto más occidental de Europa.', 'Cabo da Roca', 38.7804, -9.4989, 'ACTIVIDAD', 17, v_lucia, 'BUS', null, null, null),
    (2, time '19:45', time '20:30', 'Vuelta al hotel', 'Cena tranquila cerca del hotel.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 18, v_lucia, 'COCHE', null, null, null),
    -- Día 4: Oceanário y vuelta a Barcelona
    (3, time '08:30', time '09:15', 'Desayuno y check-out', 'Maletas en consigna hasta la tarde.', 'Hotel Avenida Palace', 38.7155, -9.1416, 'HOTEL', 19, v_lucia, null, null, null, null),
    (3, time '10:00', time '12:00', 'Oceanário de Lisboa', 'El gran tanque central, imprescindible.', 'Oceanário de Lisboa', 38.7633, -9.0937, 'ACTIVIDAD', 20, v_guest, 'METRO', null, null, null),
    (3, time '15:30', time '17:45', 'Vuelo Lisboa → Barcelona', 'Vuelta a casa con la mochila llena.', 'Aeropuerto de Lisboa', 38.7742, -9.1342, 'VUELO', 21, v_guest, 'TAXI', 'Aeropuerto de Barcelona-El Prat', 41.2974::float8, 2.0833::float8)
  ) as a(dia, inicio, fin, titulo, descripcion, lugar, lat, lng, tipo, orden, creador, transporte, fin_lugar, fin_lat, fin_lng);

  perform fn_demo_rutas_desde_cache(v_plan_id);

  select id into v_vuelo     from subplan where plan_id = v_plan_id and orden = 1;
  select id into v_hotel     from subplan where plan_id = v_plan_id and orden = 2;
  select id into v_market    from subplan where plan_id = v_plan_id and orden = 3;
  select id into v_fado      from subplan where plan_id = v_plan_id and orden = 12;
  select id into v_sintra    from subplan where plan_id = v_plan_id and orden = 15;
  select id into v_regaleira from subplan where plan_id = v_plan_id and orden = 16;
  select id into v_oceanario from subplan where plan_id = v_plan_id and orden = 20;

  -- Expenses split equally between the four, paid by different people.
  v_everyone := (select jsonb_agg(jsonb_build_object('user_id', u)) from unnest(array[v_guest] || v_friends) as u);
  for v_gasto in
    select * from (values
      ('Vuelos Barcelona–Lisboa (ida y vuelta)', 512.00, v_guest, 1, v_vuelo, 0, time '07:00'),
      ('Hotel (3 noches)', 480.00, v_lucia, 9,  v_hotel,  0, time '10:30'),
      ('Comida Time Out Market', 64.00, v_guest, 13, v_market, 0, time '15:00'),
      ('Cena con fado', 120.00, v_marcos, 13, v_fado, 1, time '22:30'),
      ('Tren a Sintra', 18.40, v_ana, 3, v_sintra, 2, time '09:30'),
      -- Ticket prices from the official sites (read 2026-11-08), for four adults.
      ('Entradas Palácio da Pena (visita esencial)', 80.00, v_ana, 16, v_sintra, 2, time '10:00'),
      ('Entradas Quinta da Regaleira', 80.00, v_lucia, 16, v_regaleira, 2, time '13:45'),
      ('Entradas Oceanário (franja de las 10:00)', 119.60, v_marcos, 16, v_oceanario, 3, time '10:00')
    ) as g(titulo, total, pagador, categoria, subplan_id, dia, hora)
  loop
    insert into gastos (plan_id, subplan_id, titulo, created_by_user_id, pagado_por_user_id,
                        fecha_gasto, total, moneda, metodo_reparto, categoria_id, estado)
    values (v_plan_id, v_gasto.subplan_id, v_gasto.titulo, v_gasto.pagador, v_gasto.pagador,
            (v_day1 + v_gasto.dia + v_gasto.hora) at time zone v_lis, v_gasto.total, 'EUR',
            'IGUAL', v_gasto.categoria, 'CONFIRMADO')
    returning id into v_gasto_id;
    perform fn_gasto_insert_partes(v_gasto_id, v_gasto.pagador, v_gasto.total, 'IGUAL', v_everyone, null);
  end loop;
  perform fn_liquidaciones_recalculate_for_plan(v_plan_id);

  -- What is left to do before the trip; one of them is the guest's.
  for v_gasto in
    select * from (values
      ('Comprar las entradas del Oceanário', 'actividad', 'hecho', v_marcos, v_marcos),
      ('Reservar la cena con fado', 'comida', 'hecho', v_marcos, v_marcos),
      ('Imprimir las tarjetas de embarque', 'vuelo', 'pendiente', v_lucia, v_guest),
      ('Llevar un adaptador de enchufe', 'otro', 'pendiente', v_ana, v_ana)
    ) as t(titulo, categoria, estado, creador, asignado)
  loop
    insert into plan_tareas (plan_id, titulo, categoria, estado, creado_por_user_id)
    values (v_plan_id, v_gasto.titulo, v_gasto.categoria::categoria_tarea, v_gasto.estado::estado_tarea, v_gasto.creador)
    returning id into v_tarea;
    insert into plan_tareas_asignados (tarea_id, user_id) values (v_tarea, v_gasto.asignado);
  end loop;

  -- The long conversation: polls (one still open), a pinned message, reactions, @frimee.
  perform fn_demo_chat_lisboa(v_chat_id);

  -- ── Plan 2 · Familia: el cumpleaños de mamá, el primer sábado después de Lisboa ──
  -- Sara organises it; Carmen is not in the plan because it is a surprise.
  v_sabado := (v_day1 + 4) + ((6 - extract(isodow from v_day1 + 4)::int + 7) % 7);
  v_fam_plan := fn_demo_plan(
    'Cumpleaños de mamá',
    'Comida sorpresa por sus 50. Que no se entere.',
    (v_sabado + time '00:00') at time zone v_tz,
    (v_sabado + time '23:59') at time zone v_tz,
    'Barcelona',
    v_sara,
    true
  );
  insert into plan_usuarios (plan_id, user_id, rol, estado) values
    (v_fam_plan, v_guest, 'PARTICIPANTE', 'PARTICIPA'),
    (v_fam_plan, v_javier, 'PARTICIPANTE', 'PARTICIPA');
  update plan set foto_portada = '/demo/portadas/cumpleanos.webp' where id = v_fam_plan;
  v_fam_chat := fn_plan_create_chat(v_fam_plan);

  insert into subplan (plan_id, titulo, descripcion, creado_por_user_id, inicio_at, fin_at,
                       ubicacion_nombre, ubicacion_lat, ubicacion_lng, tipo, orden, transporte_llegada)
  values
    (v_fam_plan, 'Comida en Can Cortada', 'Mesa para cuatro a nombre de Sara.', v_sara,
     (v_sabado + time '13:30') at time zone v_tz, (v_sabado + time '16:00') at time zone v_tz,
     'Can Cortada, Barcelona', 41.4296, 2.1515, 'RESTAURANTE', 1, null),
    (v_fam_plan, 'Tarta y regalos en casa', 'Papá la entretiene mientras preparamos la mesa.', v_javier,
     (v_sabado + time '17:00') at time zone v_tz, (v_sabado + time '19:00') at time zone v_tz,
     'Casa de los padres, Gràcia', 41.4036, 2.1564, 'OTRO', 2, 'COCHE');
  perform fn_demo_rutas_desde_cache(v_fam_plan);
  select id into v_comida from subplan where plan_id = v_fam_plan and orden = 1;

  v_everyone := jsonb_build_array(jsonb_build_object('user_id', v_guest), jsonb_build_object('user_id', v_sara),
                                  jsonb_build_object('user_id', v_javier));
  insert into gastos (plan_id, subplan_id, titulo, created_by_user_id, pagado_por_user_id,
                      fecha_gasto, total, moneda, metodo_reparto, categoria_id, estado)
  values (v_fam_plan, null, 'Regalo: pañuelo de seda y un libro', v_sara, v_sara,
          now() - interval '1 day', 90.00, 'EUR', 'IGUAL', 16, 'CONFIRMADO')
  returning id into v_gasto_id;
  perform fn_gasto_insert_partes(v_gasto_id, v_sara, 90.00, 'IGUAL', v_everyone, null);
  perform fn_liquidaciones_recalculate_for_plan(v_fam_plan);

  insert into plan_tareas (plan_id, titulo, categoria, estado, creado_por_user_id)
  values (v_fam_plan, 'Encargar la tarta', 'comida', 'pendiente', v_sara) returning id into v_tarea;
  insert into plan_tareas_asignados (tarea_id, user_id) values (v_tarea, v_guest);
  insert into plan_tareas (plan_id, titulo, categoria, estado, creado_por_user_id)
  values (v_fam_plan, 'Comprar las velas', 'otro', 'hecho', v_javier) returning id into v_tarea;
  insert into plan_tareas_asignados (tarea_id, user_id) values (v_tarea, v_javier);

  perform fn_demo_mensajes(v_fam_chat, array[v_sara, v_javier, v_guest], jsonb_build_array(
    jsonb_build_array(1, '2 days 3 hours', 'He reservado en Can Cortada el sábado a las 13:30, somos cuatro contando a mamá'),
    jsonb_build_array(2, '2 days 2 hours', 'Perfecto. Yo me encargo de que no sospeche nada'),
    jsonb_build_array(1, '1 day 2 hours', 'Ya tengo el regalo, os lo he puesto en gastos'),
    jsonb_build_array(2, '1 day 1 hour', '¿Quién encarga la tarta?'),
    jsonb_build_array(1, '50 minutes', 'Te la he apuntado en tareas, que tú pasas por la pastelería 🎂')
  ));
  update chat_miembro set last_read_at = now() - interval '1 hour' where chat_id = v_fam_chat and user_id = v_guest;
  update chat_miembro set last_read_at = now() where chat_id = v_fam_chat and user_id <> v_guest;
  -- Sara added the guest when she created the plan.
  insert into notificaciones (user_id, tipo, actor_id, entity_id, entity_type, created_at)
  values (v_guest, 'plan_added', v_sara,
          jsonb_build_object('plan_id', v_fam_plan::text, 'destino', 'Cumpleaños de mamá')::text, 'plan_chat',
          now() - interval '2 days 3 hours');

  -- ── Plan 3 · Pareja: Escapada a Roma, terminada hace tres semanas ──
  select id into v_roma from fn_plan_create(
    'Escapada a Roma',
    'Tres días comiendo pasta y andando sin parar.',
    (v_roma1 + time '00:00') at time zone v_tz,
    (v_roma1 + 2 + time '23:59') at time zone v_tz,
    'Roma, Italia',
    v_guest,
    v_guest,
    true,
    'SOLO_GRUPO',
    null,
    '/demo/roma/coliseo.webp'
  );
  insert into plan_usuarios (plan_id, user_id, rol, estado) values (v_roma, v_alex, 'PARTICIPANTE', 'PARTICIPA');
  v_roma_chat := fn_plan_create_chat(v_roma);

  insert into subplan (plan_id, titulo, descripcion, creado_por_user_id, inicio_at, fin_at,
                       ubicacion_nombre, ubicacion_lat, ubicacion_lng, tipo, orden, transporte_llegada,
                       ubicacion_fin_nombre, ubicacion_fin_lat, ubicacion_fin_lng)
  select v_roma, a.titulo, a.descripcion, a.creador,
         (v_roma1 + a.dia + a.inicio) at time zone v_tz,
         (v_roma1 + a.dia + a.fin) at time zone v_tz,
         a.lugar, a.lat, a.lng, a.tipo::tipo_subplan, a.orden, a.transporte,
         a.fin_lugar, a.fin_lat, a.fin_lng
  from (values
    (0, time '09:00', time '10:55', 'Vuelo Barcelona → Roma', 'Llegada a Fiumicino.', 'Aeropuerto de Barcelona-El Prat', 41.2974, 2.0833, 'VUELO', 1, v_guest, null, 'Aeropuerto de Roma-Fiumicino', 41.8003::float8, 12.2389::float8),
    (0, time '12:30', time '13:00', 'Check-in en el hotel', 'Al lado de Piazza Navona.', 'Hotel Raphael, Roma', 41.8996, 12.4718, 'HOTEL', 2, v_alex, 'TREN', null, null, null),
    (0, time '15:00', time '17:30', 'Coliseo y Foro Romano', 'Entradas con hora a las 15:00.', 'Coliseo', 41.8902, 12.4922, 'ACTIVIDAD', 3, v_alex, 'METRO', null, null, null),
    (0, time '19:00', time '19:45', 'Fontana di Trevi', 'La moneda de espaldas, como manda la tradición.', 'Fontana di Trevi', 41.9009, 12.4833, 'ACTIVIDAD', 4, v_guest, 'APIE', null, null, null),
    (1, time '09:30', time '13:00', 'Plaza de San Pedro y Museos Vaticanos', 'Madrugamos para la Capilla Sixtina.', 'Plaza de San Pedro', 41.9022, 12.4569, 'ACTIVIDAD', 5, v_alex, null, null, null, null),
    (1, time '14:00', time '17:00', 'Comida y paseo por el Trastevere', 'Cacio e pepe y la iglesia de Santa Maria.', 'Santa Maria in Trastevere', 41.8894, 12.4700, 'RESTAURANTE', 6, v_guest, 'APIE', null, null, null),
    (1, time '19:00', time '20:00', 'Piazza Navona', 'Helado mirando la fuente de los Cuatro Ríos.', 'Piazza Navona', 41.8992, 12.4731, 'ACTIVIDAD', 7, v_alex, 'APIE', null, null, null),
    (2, time '10:00', time '11:30', 'Escalinata de la plaza de España', 'Último paseo antes de volver.', 'Piazza di Spagna', 41.9060, 12.4828, 'ACTIVIDAD', 8, v_guest, null, null, null, null),
    (2, time '16:00', time '17:45', 'Vuelo Roma → Barcelona', 'De vuelta a casa.', 'Aeropuerto de Roma-Fiumicino', 41.8003, 12.2389, 'VUELO', 9, v_guest, 'TREN', 'Aeropuerto de Barcelona-El Prat', 41.2974::float8, 2.0833::float8)
  ) as a(dia, inicio, fin, titulo, descripcion, lugar, lat, lng, tipo, orden, creador, transporte, fin_lugar, fin_lat, fin_lng);
  perform fn_demo_rutas_desde_cache(v_roma);

  -- Photos for the album (fremee/public/demo/roma, credits in src/config/demo-photos.ts).
  insert into plan_fotos (plan_id, user_id, url, storage_path, created_at)
  select v_roma, f.autor, '/demo/roma/' || f.archivo || '.webp', 'demo/roma/' || f.archivo || '.webp',
         (v_roma1 + f.dia + f.hora) at time zone v_tz
  from (values
    (0, time '16:20', 'coliseo', v_alex),
    (0, time '19:15', 'trevi', v_guest),
    (1, time '12:40', 'san-pedro', v_alex),
    (1, time '15:30', 'trastevere', v_guest),
    (1, time '19:20', 'navona', v_alex),
    (2, time '10:40', 'escalinata', v_guest)
  ) as f(dia, hora, archivo, autor);

  v_everyone := jsonb_build_array(jsonb_build_object('user_id', v_guest), jsonb_build_object('user_id', v_alex));
  for v_gasto in
    select * from (values
      ('Vuelos Barcelona–Roma (ida y vuelta)', 236.00, v_guest, 1, 0, time '08:30'),
      ('Hotel (2 noches)', 310.00, v_alex, 9, 0, time '12:30'),
      ('Entradas Coliseo y Foro', 48.00, v_alex, 16, 0, time '14:50'),
      ('Comida en el Trastevere', 54.00, v_guest, 13, 1, time '15:30'),
      ('Museos Vaticanos', 40.00, v_guest, 16, 1, time '09:20')
    ) as g(titulo, total, pagador, categoria, dia, hora)
  loop
    insert into gastos (plan_id, titulo, created_by_user_id, pagado_por_user_id,
                        fecha_gasto, total, moneda, metodo_reparto, categoria_id, estado)
    values (v_roma, v_gasto.titulo, v_gasto.pagador, v_gasto.pagador,
            (v_roma1 + v_gasto.dia + v_gasto.hora) at time zone v_tz, v_gasto.total, 'EUR',
            'IGUAL', v_gasto.categoria, 'CONFIRMADO')
    returning id into v_gasto_id;
    perform fn_gasto_insert_partes(v_gasto_id, v_gasto.pagador, v_gasto.total, 'IGUAL', v_everyone, null);
  end loop;
  perform fn_liquidaciones_recalculate_for_plan(v_roma);
  -- Settled by Bizum two days after coming back.
  update liquidaciones set estado = 'CONFIRMADA', metodo = 'BIZUM',
         fecha = (v_roma1 + 4 + time '20:00') at time zone v_tz
   where plan_id = v_roma and estado = 'PENDIENTE';

  perform fn_demo_mensajes(v_roma_chat, array[v_alex, v_guest], jsonb_build_array(
    jsonb_build_array(1, (v_hoy - v_roma1 + 6) || ' days', '¿Y si nos escapamos a Roma el mes que viene?'),
    jsonb_build_array(2, (v_hoy - v_roma1 + 6) || ' days', 'Vamos. Miro vuelos'),
    jsonb_build_array(1, (v_hoy - v_roma1 + 5) || ' days', 'Hotel reservado al lado de Navona 🙌'),
    jsonb_build_array(2, (v_hoy - v_roma1 - 1) || ' days', 'Mira qué foto del Coliseo'),
    jsonb_build_array(1, (v_hoy - v_roma1 - 4) || ' days', 'Ya te he pagado por Bizum lo que te debía')
  ));
  -- The trip summary @frimee posts the night after (fn_cron_resumen_post_viaje), dated then.
  perform fn_resumen_post_viaje(v_roma);
  update mensajes set created_at = (v_roma1 + 3 + time '02:00') at time zone v_tz
   where chat_id = v_roma_chat and sender_id is null and texto like '%resumen_viaje%';
  update plan set resumen_enviado = true where id = v_roma;
  update chat_miembro set last_read_at = now() where chat_id = v_roma_chat;

  -- ── Chats sueltos ──
  -- With Álex, one unread message.
  v_chat := fn_chat_get_or_create_directo(v_alex);
  perform fn_demo_mensajes(v_chat, array[v_alex, v_guest], jsonb_build_array(
    jsonb_build_array(2, '1 day 4 hours', 'Ya están las fotos de Roma en el álbum'),
    jsonb_build_array(1, '1 day 3 hours', 'Qué ganas de volver 🥲'),
    jsonb_build_array(1, '25 minutes', '¿Esta noche peli en casa?')
  ));
  update chat_miembro set last_read_at = now() - interval '1 day' where chat_id = v_chat and user_id = v_guest;
  update chat_miembro set last_read_at = now() where chat_id = v_chat and user_id = v_alex;

  -- With Lucía, read, with a reaction.
  v_chat := fn_chat_get_or_create_directo(v_lucia);
  perform fn_demo_mensajes(v_chat, array[v_lucia, v_guest], jsonb_build_array(
    jsonb_build_array(1, '6 hours', '¿Te has mirado ya el tiempo para Lisboa?'),
    jsonb_build_array(2, '5 hours', 'Sol y unos 18 grados, pero lleva chaqueta para Sintra'),
    jsonb_build_array(1, '4 hours', 'Apuntado, gracias')
  ));
  select id into v_msg from mensajes where chat_id = v_chat and sender_id = v_guest order by id desc limit 1;
  insert into mensaje_reacciones (mensaje_id, user_id, emoji) values (v_msg, v_lucia, '❤️');
  update chat_miembro set last_read_at = now() where chat_id = v_chat;

  -- The family group (with Carmen, who is not in the birthday plan), two unread.
  v_chat := fn_chat_create_grupo('Familia', null, array[v_carmen, v_javier, v_sara]);
  perform fn_demo_mensajes(v_chat, array[v_carmen, v_javier, v_sara, v_guest], jsonb_build_array(
    jsonb_build_array(1, '3 days', '¿Este domingo venís a comer?'),
    jsonb_build_array(4, '3 days', 'Yo sí'),
    jsonb_build_array(3, '2 days 23 hours', 'Y yo, llevo el postre'),
    jsonb_build_array(2, '2 hours', 'He visto que va a llover el sábado, coged paraguas'),
    jsonb_build_array(1, '1 hour', '¿Qué tramáis vosotros para el sábado? 🤔')
  ));
  update chat_miembro set last_read_at = now() - interval '3 hours' where chat_id = v_chat and user_id = v_guest;
  update chat_miembro set last_read_at = now() where chat_id = v_chat and user_id <> v_guest;

  -- ── Una invitación pendiente: Marcos organiza un concierto ──
  v_concierto := fn_demo_plan(
    'Concierto en el Palau Sant Jordi',
    'Entradas a la venta el viernes, ¿quién se apunta?',
    (v_hoy + 35 + time '21:00') at time zone v_tz,
    (v_hoy + 35 + time '23:30') at time zone v_tz,
    'Palau Sant Jordi, Barcelona',
    v_marcos,
    false
  );
  insert into plan_usuarios (plan_id, user_id, rol, estado) values (v_concierto, v_lucia, 'PARTICIPANTE', 'PARTICIPA');
  perform fn_plan_create_chat(v_concierto);
  perform fn_plan_invitar_core(v_concierto, v_marcos, array[v_guest]);
  update notificaciones set created_at = now() - interval '40 minutes'
   where user_id = v_guest and tipo = 'plan_invite';

  return v_plan_id;
end;
$$;
revoke all on function public.fn_guest_seed_demo() from public, anon;
grant execute on function public.fn_guest_seed_demo() to authenticated;
