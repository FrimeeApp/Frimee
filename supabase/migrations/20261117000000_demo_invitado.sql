-- Cuenta de invitado con todo lo que hace Frimee (2026-11-17).
--
-- Hasta ahora el invitado recibía un solo plan (Lisboa con tres amigos). Ahora recibe:
--   · Amigos: Escapada a Lisboa, dentro de una semana, con la conversación larga, encuestas,
--     gastos y tareas (una suya).
--   · Familia: el cumpleaños sorpresa de mamá este sábado, organizado por Sara.
--   · Pareja: Escapada a Roma con Álex, terminada hace tres semanas: álbum con fotos,
--     cuentas saldadas y el resumen del viaje.
--   · Chats 1 a 1 con Álex y Lucía, el grupo «Familia», una solicitud de amistad de Pablo y
--     una invitación de Marcos a un concierto.
-- Todo es del invitado: cada visitante tiene sus propias personas y fn_guest_cleanup lo
-- borra con él a los 7 días.
--
-- También pasa al repositorio la conversación larga de Lisboa, que en dev y en producción
-- se aplicó a mano como dev_seed_chat_largo, ahora con nombre definitivo, y corrige los días
-- del plan de Lisboa: acababa a las 23:59 de Lisboa, que en España ya es el día siguiente,
-- y la app lo contaba como de cinco días.

-- ───────────────────────── 1. Piezas compartidas ─────────────────────────
drop function if exists public.dev_seed_chat_largo(uuid);

create or replace function public.fn_demo_chat_lisboa(p_chat uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tz constant text := 'Europe/Madrid';
  v_d date := (now() at time zone 'Europe/Madrid')::date;
  v_chat uuid;
  v_plan bigint;
  v_plan_titulo text;
  v_g uuid; v_l uuid; v_m uuid; v_a uuid;
  v_g_nombre text;
  v_fado bigint; v_fado_ini timestamptz; v_fado_fin timestamptz;
  v_ids jsonb := '{}'::jsonb;
  v_id bigint;
  v_ts timestamptz;
  v_last_ts timestamptz;
  v_last_txt text;
  v_ini timestamp;
  v_rango text;
  r record;
begin
  select c.id, p.id, p.titulo, p.inicio_at at time zone 'Europe/Madrid'
    into v_chat, v_plan, v_plan_titulo, v_ini
    from chat c join plan p on p.id = c.plan_id
   where c.id = p_chat;
  if v_chat is null then raise exception 'No existe el chat %', p_chat; end if;
  -- «21–24 de noviembre»: the dates the group voted for are the trip's.
  v_rango := extract(day from v_ini)::int || '–' || extract(day from v_ini + interval '3 days')::int || ' de '
    || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from v_ini + interval '3 days')::int];

  select cm.user_id into v_g from chat_miembro cm join auth.users u on u.id = cm.user_id
   where cm.chat_id = v_chat and u.raw_user_meta_data->>'demo_friend_of' is null limit 1;
  select cm.user_id into v_l from chat_miembro cm join auth.users u on u.id = cm.user_id
   where cm.chat_id = v_chat and u.raw_user_meta_data->>'full_name' = 'Lucía' limit 1;
  select cm.user_id into v_m from chat_miembro cm join auth.users u on u.id = cm.user_id
   where cm.chat_id = v_chat and u.raw_user_meta_data->>'full_name' = 'Marcos' limit 1;
  select cm.user_id into v_a from chat_miembro cm join auth.users u on u.id = cm.user_id
   where cm.chat_id = v_chat and u.raw_user_meta_data->>'full_name' = 'Ana' limit 1;
  if v_g is null or v_l is null or v_m is null or v_a is null then raise exception 'Faltan miembros de la demo en el chat %', v_chat; end if;

  select coalesce(nullif(trim(nombre), ''), 'Invitado') into v_g_nombre from usuarios where id = v_g;
  select id, inicio_at, fin_at into v_fado, v_fado_ini, v_fado_fin from subplan where plan_id = v_plan and orden = 12;

  update chat set pinned_message_id = null, pinned_by = null, pinned_at = null where id = v_chat;
  delete from mensajes where chat_id = v_chat;

  for r in
    select * from (values
      -- k, quien, día (hace N días), hora, hace (solo hoy), tipo, texto, responde_a
      ('bienvenida', 'BOT', 12, time '18:58', null::interval, 'bot', '¡Hola! Soy Frimee, el asistente del plan. Escribid @frimee y lo que necesitéis: el tiempo en Lisboa, cómo vais de cuentas o ideas para cenar. También puedo crear encuestas para que el grupo decida.', null),
      ('m1',  'M', 12, time '19:02', null, 'text', '¿Y si este mes nos escapamos a Lisboa? Hay vuelos baratos desde Barcelona', null),
      ('m2',  'L', 12, time '19:03', null, 'text', '¡Sí! Llevo años queriendo ir', null),
      ('m3',  'A', 12, time '19:03', null, 'text', 'Me apunto 🙌', null),
      ('m4',  'L', 12, time '19:04', null, 'text', 'Yo puedo cualquier finde menos el primero', null),
      ('m5',  'G', 12, time '19:10', null, 'text', 'Contad conmigo. ¿Cuatro días?', null),
      ('m6',  'M', 12, time '19:12', null, 'text', 'Cuatro días está perfecto', 'm5'),
      ('poll1','L', 12, time '19:20', null, 'text', jsonb_build_object('type','poll','question','¿Qué fechas os van mejor?','options',jsonb_build_array('Puente de diciembre','Del ' || v_rango,'Enero, después de Reyes'),'closed',true)::text, null),
      ('m7',  'A', 12, time '21:40', null, 'text', 'Votado. Si sale la segunda, pido los días mañana en el curro', null),

      ('m8',  'M', 11, time '09:15', null, 'text', 'Gana del ' || v_rango || ' 🎉', 'poll1'),
      ('m9',  'A', 11, time '09:16', null, 'text', 'Pedidos los días ✅', null),
      ('m10', 'G', 11, time '13:30', null, 'text', 'He mirado vuelos: sale uno a las 7:30 y el último día volvemos a las 15:30', null),
      ('m11', 'G', 11, time '13:31', null, 'text', 'Unos 128 € ida y vuelta por persona', null),
      ('m12', 'L', 11, time '13:40', null, 'text', 'Perfecto, cógelos tú y lo apuntamos en gastos', null),
      ('g1',  'G', 11, time '18:05', null, 'text', jsonb_build_object('type','gasto','titulo','Vuelos Barcelona–Lisboa (ida y vuelta)','total',512,'pagado_por_nombre',coalesce(v_g_nombre, 'Invitado'),'participantes',4)::text, null),
      ('m13', 'M', 11, time '18:06', null, 'text', 'Gracias crack', null),
      ('c1',  'M', 11, time '22:10', null, 'call_video', '1260', null),

      ('x10_1', 'L', 10, time '20:00', null, 'text', '¿Alguien ha mirado lo del seguro de viaje?', null),
      ('x10_2', 'M', 10, time '20:01', null, 'text', 'Yo tengo la tarjeta sanitaria europea, con eso vamos bien en Portugal', null),
      ('x10_3', 'A', 10, time '20:02', null, 'text', 'Yo también la tengo', null),
      ('x10_4', 'L', 10, time '20:04', null, 'text', 'Pues ya está, nada de seguro extra', null),
      ('x10_5', 'G', 10, time '20:05', null, 'text', '¿Facturamos maleta o vamos solo con mochila?', null),
      ('x10_6', 'M', 10, time '20:06', null, 'text', 'Solo mochila, que son cuatro días', null),
      ('x10_7', 'A', 10, time '20:08', null, 'text', 'Uf, yo sin maleta no sé vivir 😂', null),
      ('x10_8', 'L', 10, time '20:09', null, 'text', 'Ana, que es Lisboa, no una expedición', null),
      ('x10_9', 'A', 10, time '20:10', null, 'text', 'Vale vale, mochila grande', null),
      ('x10_10', 'G', 10, time '20:12', null, 'text', 'Ojo, el billete incluye mochila de 40×30×20', null),
      ('x10_11', 'M', 10, time '20:13', null, 'text', 'Pues me compro una nueva, la mía es enorme', null),
      ('x10_12', 'L', 10, time '20:14', null, 'text', '¿Y dónde cenamos el primer día?', null),
      ('x10_13', 'A', 10, time '20:16', null, 'text', 'En el Bairro Alto hay mil sitios', null),
      ('x10_14', 'M', 10, time '20:17', null, 'text', 'Me han dicho que de noche se llena muchísimo', null),
      ('x10_15', 'G', 10, time '20:18', null, 'text', 'Podemos cenar por la Baixa y luego subir a tomar algo', null),
      ('x10_16', 'L', 10, time '20:20', null, 'text', 'Me encanta el plan', null),
      ('x10_17', 'A', 10, time '20:21', null, 'text', '🙌', null),
      ('x10_18', 'M', 10, time '20:22', null, 'text', 'Hecho entonces', null),

      ('m14', 'L', 9, time '10:20', null, 'text', 'He encontrado este hotel en la Avenida, bien comunicado con el metro', null),
      ('lug1','L', 9, time '10:21', null, 'text', jsonb_build_object('type','lugar','nombre','Hotel Avenida Palace','direccion','Rua 1º de Dezembro 123, Lisboa','lat',38.7155,'lng',-9.1416)::text, null),
      ('m15', 'A', 9, time '10:25', null, 'text', 'Tiene una pinta increíble', 'lug1'),
      ('m16', 'M', 9, time '10:26', null, 'text', '¿Precio?', null),
      ('m17', 'L', 9, time '10:30', null, 'text', '160 € la noche la habitación cuádruple, 3 noches', 'm16'),
      ('m18', 'G', 9, time '10:45', null, 'text', 'Por mí reservado', null),
      ('m19', 'L', 9, time '11:02', null, 'text', '¡Hotel reservado! Ya he subido el gasto, me lo vais pasando 😊', null),
      ('g2',  'L', 9, time '11:03', null, 'text', jsonb_build_object('type','gasto','titulo','Hotel (3 noches)','total',480,'pagado_por_nombre','Lucía','participantes',4)::text, null),

      ('x8_1', 'A', 8, time '10:10', null, 'text', 'Buenos días, he hecho una lista de cosas que ver', null),
      ('x8_2', 'A', 8, time '10:11', null, 'text', 'Torre de Belém, Jerónimos, LX Factory, Alfama, Sintra y el Oceanário', null),
      ('x8_3', 'M', 8, time '10:12', null, 'text', 'Falta el tranvía 28', null),
      ('x8_4', 'L', 8, time '10:14', null, 'text', 'El 28 siempre va lleno, mejor cogerlo a primera hora', null),
      ('x8_5', 'G', 8, time '10:15', null, 'text', 'O el 12, que hace un recorrido parecido y va más vacío', null),
      ('x8_6', 'A', 8, time '10:16', null, 'text', 'No lo sabía, apuntado', null),
      ('x8_7', 'M', 8, time '10:18', null, 'text', '¿Belém un día entero?', null),
      ('x8_8', 'L', 8, time '10:19', null, 'text', 'Medio día, y por la tarde LX Factory, que pilla de camino', null),
      ('x8_9', 'G', 8, time '10:20', null, 'text', 'Y los pastéis de Belém, que ahí son obligatorios', null),
      ('x8_10', 'A', 8, time '10:22', null, 'text', 'Yo me como seis', null),
      ('x8_11', 'M', 8, time '10:23', null, 'text', 'Seis cada uno 😂', null),
      ('x8_12', 'L', 8, time '10:24', null, 'text', 'Las entradas de los Jerónimos mejor online, que la cola es eterna', null),
      ('x8_13', 'G', 8, time '10:26', null, 'text', 'Las compro yo esta noche', null),
      ('x8_14', 'A', 8, time '10:27', null, 'text', '¡Gracias!', null),
      ('x8_15', 'G', 8, time '10:28', null, 'text', 'Compradas: cuatro entradas para el segundo día a las 13:00', null),
      ('x8_16', 'M', 8, time '10:30', null, 'text', 'Crack', null),
      ('x8_17', 'L', 8, time '10:31', null, 'text', 'Qué bien organizados vamos', null),

      ('m20', 'M', 7, time '20:10', null, 'text', '@frimee apunta una cena con fado en Alfama el segundo día a las 20:30', null),
      ('prop1','BOT', 7, time '20:10', null, 'bot', 'PROPUESTA', null),
      ('m21', 'M', 7, time '20:14', null, 'text', 'He reservado mesa para el fado el segundo día a las 20:30', null),
      ('m22', 'A', 7, time '20:20', null, 'text', '😍😍', null),

      ('x6_1', 'M', 6, time '21:15', null, 'text', 'Oye, ¿y el Oceanário el último día?', null),
      ('x6_2', 'L', 6, time '21:16', null, 'text', 'Si el vuelo es a las 15:30 vamos justos', null),
      ('x6_3', 'G', 6, time '21:17', null, 'text', 'Abre a las 10, nos dan dos horas largas', null),
      ('x6_4', 'A', 6, time '21:19', null, 'text', 'Y está cerca del aeropuerto, ¿no?', null),
      ('x6_5', 'M', 6, time '21:20', null, 'text', 'Al lado, diez minutos en taxi', null),
      ('x6_6', 'L', 6, time '21:21', null, 'text', 'Entonces sí, lo dejamos para el último día', null),
      ('x6_7', 'A', 6, time '21:23', null, 'text', 'Me hace muchísima ilusión, dicen que el tanque central es enorme', null),
      ('x6_8', 'G', 6, time '21:24', null, 'text', 'Pillo las entradas cuando sepamos la hora', null),
      ('x6_9', 'M', 6, time '21:25', null, 'text', 'Cambiando de tema, ¿quién se viene a por ropa el sábado?', null),
      ('x6_10', 'A', 6, time '21:27', null, 'text', '¡Yo!', null),
      ('x6_11', 'L', 6, time '21:28', null, 'text', 'Yo no puedo, tengo un cumple', null),
      ('x6_12', 'G', 6, time '21:29', null, 'text', 'Paso, me apaño con lo que tengo', null),
      ('x6_13', 'M', 6, time '21:31', null, 'text', 'Ana y yo entonces', null),
      ('x6_14', 'A', 6, time '21:32', null, 'text', '🛍️', null),
      ('x6_15', 'L', 6, time '21:33', null, 'text', 'Llevad algo para la lluvia por si acaso', null),
      ('x6_16', 'M', 6, time '21:35', null, 'text', 'Frimee dirá que no llueve 😎', null),
      ('x6_17', 'L', 6, time '21:36', null, 'text', 'Por si acaso, he dicho', null),

      ('poll2','A', 5, time '18:00', null, 'text', jsonb_build_object('type','poll','question','¿Cómo vamos a Sintra?','options',jsonb_build_array('Tren desde Rossio','Alquilamos coche','Excursión organizada'),'expires_at',to_char((now() + interval '2 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'))::text, null),
      ('m23', 'A', 5, time '18:02', null, 'text', 'Votad, que hay que decidir antes del jueves', null),
      ('m24', 'M', 5, time '18:30', null, 'text', 'Yo voto coche pero me adapto', null),
      ('c2',  'L', 5, time '21:00', null, 'call_missed_audio', '0', null),
      ('m25', 'L', 5, time '21:05', null, 'text', 'Te he llamado, era para lo del seguro de viaje. Mañana lo hablamos', null),

      ('x4_1', 'L', 4, time '18:40', null, 'text', 'He visto que el día del fado juega el Benfica', null),
      ('x4_2', 'M', 4, time '18:41', null, 'text', 'Ostras, ¿habrá mucho lío?', null),
      ('x4_3', 'A', 4, time '18:42', null, 'text', 'El estadio está lejos de Alfama, no creo', null),
      ('x4_4', 'G', 4, time '18:44', null, 'text', 'Igual podemos verlo en un bar antes de cenar', null),
      ('x4_5', 'M', 4, time '18:45', null, 'text', 'Me apunto a eso', null),
      ('x4_6', 'L', 4, time '18:46', null, 'text', 'Vosotros y el fútbol...', null),
      ('x4_7', 'A', 4, time '18:48', null, 'text', 'Yo me quedo con Lucía viendo tiendas', null),
      ('x4_8', 'L', 4, time '18:49', null, 'text', 'Trato hecho', null),
      ('x4_9', 'M', 4, time '18:50', null, 'text', 'Por cierto, ¿cuánto efectivo llevamos?', null),
      ('x4_10', 'G', 4, time '18:52', null, 'text', 'Casi todo se paga con tarjeta', null),
      ('x4_11', 'A', 4, time '18:53', null, 'text', 'Para propinas y algún puesto, 50 € cada uno', null),
      ('x4_12', 'L', 4, time '18:54', null, 'text', 'Me parece bien', null),
      ('x4_13', 'M', 4, time '18:56', null, 'text', 'Hecho', null),
      ('x4_14', 'G', 4, time '18:57', null, 'text', 'Y descargad el mapa offline de Lisboa por si no hay datos', null),
      ('x4_15', 'A', 4, time '18:58', null, 'text', 'Buena idea, ahora lo hago', null),
      ('x4_16', 'M', 4, time '19:00', null, 'text', 'Descargado ✅', null),

      ('m26', 'G', 3, time '12:00', null, 'text', '@frimee ¿qué tiempo hará en Lisboa?', null),
      ('bot2','BOT', 3, time '12:00', null, 'bot', 'Para esos días se esperan entre 14 y 19 °C, sol casi todo el viaje y algo de viento por la tarde en Belém y Cabo da Roca. Llevad una chaqueta ligera 🧥', null),
      ('m27', 'A', 3, time '12:05', null, 'text', 'Perfecto, nada de paraguas', null),
      ('m28', 'M', 3, time '19:30', null, 'text', 'Os dejo la cena aquí para que la tengáis a mano', null),
      ('card1','M', 3, time '19:31', null, 'text', 'TARJETA', null),

      ('x2_1', 'A', 2, time '22:20', null, 'text', '¡¡Ya no queda nada!!', null),
      ('x2_2', 'L', 2, time '22:21', null, 'text', 'Esta semana se me está haciendo eterna', null),
      ('x2_3', 'M', 2, time '22:22', null, 'text', '¿A qué hora quedamos en el aeropuerto?', null),
      ('x2_4', 'G', 2, time '22:24', null, 'text', 'El vuelo sale a las 7:30: a las 5:45 en la T1', null),
      ('x2_5', 'A', 2, time '22:25', null, 'text', 'Madre mía, qué pronto 😴', null),
      ('x2_6', 'L', 2, time '22:26', null, 'text', 'Dormimos en el avión', null),
      ('x2_7', 'M', 2, time '22:28', null, 'text', 'Yo paso a por Ana con el coche', null),
      ('x2_8', 'A', 2, time '22:29', null, 'text', '¡Gracias!', null),
      ('x2_9', 'G', 2, time '22:30', null, 'text', 'Lucía, ¿te recojo yo?', null),
      ('x2_10', 'L', 2, time '22:32', null, 'text', 'Sí, porfa, a las 5:00 en mi portal', null),
      ('x2_11', 'G', 2, time '22:33', null, 'text', 'Perfecto', null),
      ('x2_12', 'M', 2, time '22:34', null, 'text', '¿Imprimimos algo o todo en el móvil?', null),
      ('x2_13', 'G', 2, time '22:36', null, 'text', 'Todo en el móvil, las entradas también están en el plan', null),
      ('x2_14', 'A', 2, time '22:37', null, 'text', 'Qué cómodo tenerlo todo en Frimee', null),
      ('x2_15', 'L', 2, time '22:38', null, 'text', '🙌', null),
      ('x2_16', 'M', 2, time '22:40', null, 'text', 'Venga, a dormir, que mañana curramos', null),

      ('m29', 'L', 1, time '22:00', null, 'text', '¿Quién lleva el cargador universal?', null),
      ('m30', 'M', 1, time '22:00', null, 'text', 'Yo', null),
      ('m31', 'A', 1, time '22:01', null, 'text', 'Yo llevo el adaptador', null),
      ('m32', 'G', 1, time '22:01', null, 'text', 'Y yo la power bank', null),
      ('m33', 'L', 1, time '22:02', null, 'text', 'Genial, entonces vamos sobrados', null),
      ('m34', 'A', 1, time '22:10', null, 'text', 'Qué ganas ya 😍', null),

      -- Hoy, sin leer
      ('h1', 'L', 0, null, interval '3 hours', 'text', '¡Buenos días! Recordad hacer el check-in online del vuelo', null),
      ('h2', 'M', 0, null, interval '2 hours 50 minutes', 'text', 'Hecho ✅', null),
      ('h3', 'A', 0, null, interval '2 hours', 'text', 'Yo también', null),
      ('h4', 'L', 0, null, interval '1 hour', 'text', '¿Alguien se encarga de la comida del primer día?', null),
      ('h5', 'M', 0, null, interval '40 minutes', 'text', 'Propongo el Time Out Market, hay de todo', 'h4'),
      ('h6', 'A', 0, null, interval '35 minutes', 'text', 'Me vale', null),
      ('h7', 'L', 0, null, interval '10 minutes', 'text', 'Pues decidido 🙌', null)
    ) as t(k, quien, dia, hora, hace, tipo, texto, responde)
  loop
    v_ts := case when r.hace is not null then now() - r.hace else ((v_d - r.dia) + r.hora) at time zone v_tz end;
    if r.texto = 'PROPUESTA' then
      r.texto := jsonb_build_object('type','propuesta','kind','actividad',
        'reply','Puedo añadir esta actividad al plan:',
        'titulo','Cena con fado en Alfama','detalle','Día 2 · 20:30 · Alfama, Lisboa',
        'command','/actividad', 'pedida_por','Marcos','estado','aceptada',
        'resuelta_por', v_m, 'resuelta_por_nombre','Marcos',
        'resuelta_at', to_char((v_ts + interval '3 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'resultado','Añadida al plan')::text;
    elsif r.texto = 'TARJETA' then
      r.texto := jsonb_build_object('type','tarjeta','kind','restaurante','plan_id',v_plan,'plan_titulo',v_plan_titulo,
        'subplan_id',v_fado,'titulo','Cena con fado en Alfama','inicio_at',v_fado_ini,'fin_at',v_fado_fin,
        'lugar','Alfama, Lisboa')::text;
    end if;
    insert into mensajes (chat_id, sender_id, texto, created_at, leido_por, tipo, reply_to_id)
    values (
      v_chat,
      case r.quien when 'G' then v_g when 'L' then v_l when 'M' then v_m when 'A' then v_a else null end,
      r.texto, v_ts,
      case when r.quien = 'BOT' then '{}'::uuid[]
           else array[case r.quien when 'G' then v_g when 'L' then v_l when 'M' then v_m else v_a end] end,
      r.tipo,
      case when r.responde is null then null else (v_ids->>r.responde)::bigint end
    ) returning id into v_id;
    v_ids := v_ids || jsonb_build_object(r.k, v_id);
    v_last_ts := v_ts;
    v_last_txt := r.texto;
  end loop;

  -- Votos: la de fechas, decidida (gana la segunda); la de Sintra abierta y sin tu voto.
  insert into poll_votes (mensaje_id, user_id, option_index) values
    ((v_ids->>'poll1')::bigint, v_g, 1), ((v_ids->>'poll1')::bigint, v_l, 1),
    ((v_ids->>'poll1')::bigint, v_m, 1), ((v_ids->>'poll1')::bigint, v_a, 0),
    ((v_ids->>'poll2')::bigint, v_a, 0), ((v_ids->>'poll2')::bigint, v_l, 0),
    ((v_ids->>'poll2')::bigint, v_m, 1);

  -- Reacciones de los amigos (las tuyas, para probarlas tú)
  insert into mensaje_reacciones (mensaje_id, user_id, emoji) values
    ((v_ids->>'m19')::bigint, v_m, '👍'), ((v_ids->>'m19')::bigint, v_a, '❤️'),
    ((v_ids->>'m21')::bigint, v_l, '🔥'), ((v_ids->>'m21')::bigint, v_a, '🔥'),
    ((v_ids->>'g1')::bigint, v_l, '🙌'),
    ((v_ids->>'m34')::bigint, v_l, '❤️'), ((v_ids->>'m34')::bigint, v_m, '❤️');

  -- Hotel fijado por Lucía; última lectura tuya: anoche (hoy quedan 7 sin leer)
  update chat set pinned_message_id = (v_ids->>'lug1')::bigint, pinned_by = v_l,
                  pinned_at = ((v_d - 9) + time '11:05') at time zone v_tz,
                  last_message = v_last_txt, last_message_at = v_last_ts
   where id = v_chat;
  update chat_miembro set last_read_at = ((v_d - 1) + time '22:30') at time zone v_tz
   where chat_id = v_chat and user_id = v_g;
  update chat_miembro set last_read_at = now() where chat_id = v_chat and user_id <> v_g;

end;
$function$;
revoke all on function public.fn_demo_chat_lisboa(uuid) from public, anon, authenticated;

-- Legs from the shared route cache: every guest gets the same trips, so after the first
-- one computed them the rest start with routes, times and distances and no Google call.
-- The previous activity is orden - 1 (the first of each day has no transport); after a
-- flight or a boat the leg starts where it landed.
create or replace function public.fn_demo_rutas_desde_cache(p_plan_id bigint)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $$
  update subplan d
     set ruta_polyline = rc.polyline,
         distancia_viaje = rc.distance,
         duracion_viaje = rc.duration
    from subplan o, route_cache rc
   where d.plan_id = p_plan_id
     and o.plan_id = p_plan_id
     and o.orden = d.orden - 1
     and d.transporte_llegada is not null
     and rc.origin_lat = round((case when o.tipo in ('VUELO', 'BARCO') and o.ubicacion_fin_lat is not null then o.ubicacion_fin_lat else o.ubicacion_lat end)::numeric, 4)::double precision
     and rc.origin_lng = round((case when o.tipo in ('VUELO', 'BARCO') and o.ubicacion_fin_lng is not null then o.ubicacion_fin_lng else o.ubicacion_lng end)::numeric, 4)::double precision
     and rc.dest_lat = round(d.ubicacion_lat::numeric, 4)::double precision
     and rc.dest_lng = round(d.ubicacion_lng::numeric, 4)::double precision
     and rc.modo = public.route_cache_modo(d.transporte_llegada);
$$;
revoke all on function public.fn_demo_rutas_desde_cache(bigint) from public, anon, authenticated;

-- ───────────────────────── 2. Personas de la demo ─────────────────────────
-- Una persona inventada, solo de este invitado: usuario anónimo con nombre y la marca
-- demo_friend_of, que fn_guest_cleanup usa para borrarla con él.
create or replace function public.fn_demo_persona(p_guest uuid, p_nombre text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, is_anonymous, raw_user_meta_data, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true,
          jsonb_build_object('full_name', p_nombre, 'demo_friend_of', p_guest), now(), now());
  return v_id;
end;
$$;
revoke all on function public.fn_demo_persona(uuid, text) from public, anon, authenticated;

-- A plan someone else from the demo created (Sara, Marcos). fn_plan_create only lets the
-- session's user create plans in their own name; trg_plan_create_add_creator makes the
-- creator its admin, as in the app.
create or replace function public.fn_demo_plan(p_titulo text, p_descripcion text, p_inicio timestamptz,
                                               p_fin timestamptz, p_lugar text, p_creador uuid, p_all_day boolean)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_id bigint;
begin
  insert into plan (titulo, descripcion, owner_user_id, creado_por_user_id, estado, inicio_at, fin_at,
                    all_day, visibilidad, ubicacion_nombre)
  values (p_titulo, p_descripcion, p_creador, p_creador, 'ACTIVO', p_inicio, p_fin,
          p_all_day, 'SOLO_GRUPO', p_lugar)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.fn_demo_plan(text, text, timestamptz, timestamptz, text, uuid, boolean) from public, anon, authenticated;

-- Mensajes de un chat de la demo, en orden. Cada fila: [quien (índice en p_gente, 0 = Frimee),
-- hace cuánto (interval), texto]. Lo que ya hubiera (la bienvenida de Frimee al crear el chat
-- del plan) pasa a justo antes del primero, y el último queda como vista previa del chat.
create or replace function public.fn_demo_mensajes(p_chat uuid, p_gente uuid[], p_filas jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  r jsonb;
  v_quien uuid;
  v_ts timestamptz;
  v_primero timestamptz := now() - (p_filas->0->>1)::interval;
begin
  update mensajes set created_at = v_primero - interval '2 minutes'
   where chat_id = p_chat and created_at > v_primero;
  for r in select value from jsonb_array_elements(p_filas) loop
    v_quien := case when (r->>0)::int = 0 then null else p_gente[(r->>0)::int] end;
    v_ts := now() - (r->>1)::interval;
    insert into mensajes (chat_id, sender_id, texto, created_at, leido_por, tipo)
    values (p_chat, v_quien, r->>2, v_ts,
            case when v_quien is null then '{}'::uuid[] else array[v_quien] end,
            case when v_quien is null then 'bot' else 'text' end);
  end loop;
  update chat c set last_message = m.texto, last_message_at = m.created_at
    from (select texto, created_at from mensajes where chat_id = p_chat order by created_at desc, id desc limit 1) m
   where c.id = p_chat;
end;
$$;
revoke all on function public.fn_demo_mensajes(uuid, uuid[], jsonb) from public, anon, authenticated;

-- ───────────────────────── 3. La cuenta de invitado ─────────────────────────
-- Tres planes en tres momentos (amigos dentro de una semana, familia este sábado, pareja
-- hace tres semanas), chats sueltos y de grupo, y avisos pendientes: lo justo para ver
-- todo lo que hace Frimee y, si quiere, crear lo suyo. Devuelve el plan de Lisboa.
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
  v_day1 date := (now() at time zone 'Europe/Madrid')::date + 7;
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

  -- ── Plan 1 · Amigos: Escapada a Lisboa, dentro de una semana ──
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
    true
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

  -- ── Plan 2 · Familia: el cumpleaños de mamá, este sábado ──
  -- Sara organises it; Carmen is not in the plan because it is a surprise.
  v_sabado := v_hoy + ((6 - extract(isodow from v_hoy)::int + 7) % 7);
  if v_sabado <= v_hoy then v_sabado := v_sabado + 7; end if;
  v_fam_plan := fn_demo_plan(
    'Cumpleaños de mamá',
    'Comida sorpresa por sus 60. Que no se entere.',
    (v_sabado + time '00:00') at time zone v_tz,
    (v_sabado + time '23:59') at time zone v_tz,
    'Barcelona',
    v_sara,
    true
  );
  insert into plan_usuarios (plan_id, user_id, rol, estado) values
    (v_fam_plan, v_guest, 'PARTICIPANTE', 'PARTICIPA'),
    (v_fam_plan, v_javier, 'PARTICIPANTE', 'PARTICIPA');
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
    true
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

-- ───────────────────────── 4. Limpieza ─────────────────────────
create or replace function public.fn_guest_cleanup(p_older_than interval DEFAULT '7 days'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_guest uuid;
  v_users uuid[];
  v_plan_id bigint;
  v_affected_plans bigint[];
  v_deleted integer := 0;
begin
  for v_guest in
    select id from auth.users
    where is_anonymous
      and created_at < now() - p_older_than
      and raw_user_meta_data->>'demo_friend_of' is null
  loop
    begin
      select array[v_guest] || coalesce(array_agg(id), '{}') into v_users
      from auth.users
      where raw_user_meta_data->>'demo_friend_of' = v_guest::text;

      -- 1. Their plans; the cascade takes activities, expenses, debts, chat…
      delete from factura_gastos
      where gasto_id in (
        select g.id from gastos g join plan p on p.id = g.plan_id
        where p.creado_por_user_id = any(v_users) or p.owner_user_id = any(v_users)
      );
      delete from plan where creado_por_user_id = any(v_users) or owner_user_id = any(v_users);

      -- 2. Leftovers in other people's plans (a guest can join one by invite link).
      select coalesce(array_agg(distinct plan_id), '{}') into v_affected_plans
      from gastos
      where created_by_user_id = any(v_users) or pagado_por_user_id = any(v_users)
         or id in (select gasto_id from gasto_partes where user_id = any(v_users));

      delete from factura_gastos
      where gasto_id in (select id from gastos where created_by_user_id = any(v_users) or pagado_por_user_id = any(v_users));
      delete from gastos where created_by_user_id = any(v_users) or pagado_por_user_id = any(v_users);
      delete from gasto_partes where user_id = any(v_users);
      foreach v_plan_id in array v_affected_plans loop
        perform fn_liquidaciones_recalculate_for_plan(v_plan_id);
      end loop;
      delete from liquidaciones where from_user_id = any(v_users) or to_user_id = any(v_users);

      delete from subplan where creado_por_user_id = any(v_users);
      delete from plan_tareas where creado_por_user_id = any(v_users);
      delete from plan_presupuestos where created_by_user_id = any(v_users);
      delete from presupuestos where created_by_user_id = any(v_users);
      delete from reservas where created_by_user_id = any(v_users);
      delete from evento where creado_por_user_id = any(v_users);
      delete from llamadas where iniciado_por_user_id = any(v_users);
      delete from categorias_gasto where owner_user_id = any(v_users);
      delete from facturas where emitida_por_user_id = any(v_users);
      delete from grupos where creado_por_user_id = any(v_users);

      -- Chats outside plans (1 a 1 and groups) where only the guest and their demo
      -- people are; a chat with someone real stays (the guest's messages go with the user).
      delete from chat c
       where c.tipo in ('DIRECTO', 'GRUPO')
         and exists (select 1 from chat_miembro m where m.chat_id = c.id and m.user_id = any(v_users))
         and not exists (select 1 from chat_miembro m where m.chat_id = c.id and not (m.user_id = any(v_users)));
      -- 3. The users; usuarios, messages, notifications… cascade from here.
      delete from auth.users where id = any(v_users);
      v_deleted := v_deleted + 1;
    exception when others then
      raise warning 'fn_guest_cleanup: no se pudo borrar el invitado %: %', v_guest, sqlerrm;
    end;
  end loop;

  return v_deleted;
end;
$function$;
revoke all on function public.fn_guest_cleanup(interval) from public, anon, authenticated;
