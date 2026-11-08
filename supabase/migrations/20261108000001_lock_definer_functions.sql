-- Lock down security-definer functions that trusted their arguments.
-- Audit 2026-11-08 (production): these ran with full rights, were callable by anyone
-- (even without a session, with the public anon key) and did not check who called:
-- profile/settings of any user could be changed, plans created or reminders sent in
-- someone else's name, and any plan's itinerary, expenses, members or chat read.
-- Each function keeps its body; public.assert_allowed() raises 42501 otherwise.

create or replace function public.assert_allowed(ok boolean) returns void
language plpgsql set search_path = public as $$
begin
  if not coalesce(ok, false) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
end;
$$;

-- 1. Debug leftovers, used by nothing.
drop function if exists public.fn_debug2(bigint);
drop function if exists public.fn_debug3(bigint);
drop function if exists public.fn_debug4(bigint);
drop function if exists public.fn_test_gastos(bigint);

-- 2. Internal helpers: only other definer functions, triggers and cron use them.
revoke execute on function public.fn_gasto_insert_partes(bigint, uuid, numeric, metodo_reparto, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_liquidaciones_recalculate_for_plan(bigint) from public, anon, authenticated;
revoke execute on function public.fn_plan_create_chat(bigint) from public, anon, authenticated;
revoke execute on function public.fn_resumen_post_viaje(bigint) from public, anon, authenticated;
revoke execute on function public.fn_get_plan_chat_id(bigint) from public, anon, authenticated;
revoke execute on function public.get_user_plan_ids(uuid) from public, anon, authenticated;
revoke execute on function public.sync_route_cache_from_subplan(bigint) from public, anon, authenticated;

-- 3. Guarded functions (members of the plan or chat; yourself for user data).
CREATE OR REPLACE FUNCTION public.fn_subplan_list(p_plan_id bigint)
 RETURNS TABLE(id bigint, plan_id bigint, parent_subplan_id bigint, titulo text, descripcion text, inicio_at timestamp with time zone, fin_at timestamp with time zone, all_day boolean, ubicacion_nombre text, ubicacion_direccion text, tipo text, ubicacion_fin_nombre text, ubicacion_fin_direccion text, ubicacion_lat double precision, ubicacion_lng double precision, ubicacion_fin_lat double precision, ubicacion_fin_lng double precision, transporte_llegada text, orden integer, estado text, creado_por_user_id uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  perform public.assert_allowed(public.is_plan_member(p_plan_id));
  RETURN QUERY
  SELECT
    s.id, s.plan_id, s.parent_subplan_id,
    s.titulo::text, s.descripcion,
    s.inicio_at, s.fin_at, s.all_day,
    s.ubicacion_nombre::text, s.ubicacion_direccion::text,
    s.tipo::text,
    s.ubicacion_fin_nombre::text, s.ubicacion_fin_direccion::text,
    s.ubicacion_lat, s.ubicacion_lng,
    s.ubicacion_fin_lat, s.ubicacion_fin_lng,
    s.transporte_llegada::text,
    s.orden, s.estado::text,
    s.creado_por_user_id, s.created_at
  FROM subplan s
  WHERE s.plan_id = p_plan_id
    AND s.estado = 'ACTIVO'
  ORDER BY s.inicio_at ASC, s.orden ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_gastos_list_for_plan(p_plan_id bigint)
 RETURNS TABLE(id bigint, titulo text, descripcion text, total numeric, moneda text, fecha_gasto timestamp with time zone, metodo_reparto text, categoria_id bigint, categoria_nombre text, categoria_icono text, categoria_color text, estado text, subplan_id bigint, subplan_titulo text, pagado_por_user_id uuid, pagado_por_nombre text, pagado_por_foto text, partes jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.assert_allowed(public.is_plan_member(p_plan_id));
  SELECT
    g.id, g.titulo, g.descripcion, g.total, g.moneda,
    g.fecha_gasto, g.metodo_reparto::text,
    g.categoria_id,
    c.nombre, c.icono, c.color,
    g.estado::text, g.subplan_id, s.titulo,
    g.pagado_por_user_id, up.nombre, up.profile_image,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', gp.user_id,
        'importe', gp.importe,
        'nombre',  upt.nombre,
        'username', upt.username,
        'foto',    upt.profile_image
      ))
      FROM gasto_partes gp
      LEFT JOIN usuarios_public upt ON upt.id = gp.user_id
      WHERE gp.gasto_id = g.id
    ),
    g.created_at
  FROM gastos g
  LEFT JOIN subplan s ON s.id = g.subplan_id
  LEFT JOIN categorias_gasto c ON c.id = g.categoria_id
  LEFT JOIN usuarios_public up ON up.id = g.pagado_por_user_id
  WHERE g.plan_id = p_plan_id
    AND g.estado != 'ANULADO'
  ORDER BY g.fecha_gasto DESC, g.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.fn_plan_get_miembros(p_plan_id bigint)
 RETURNS TABLE(user_id uuid, nombre text, username text, foto text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.assert_allowed(public.is_plan_member(p_plan_id));
  SELECT pu.user_id, up.nombre, up.username, up.profile_image AS foto
  FROM plan_usuarios pu
  JOIN usuarios_public up ON up.id = pu.user_id
  WHERE pu.plan_id = p_plan_id
    AND pu.estado = 'PARTICIPA';
$function$;

CREATE OR REPLACE FUNCTION public.fn_get_plan_member_ids(p_plan_id bigint)
 RETURNS TABLE(user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  perform public.assert_allowed(public.is_plan_member(p_plan_id));
  RETURN QUERY
  SELECT pu.user_id FROM plan_usuarios pu
  WHERE pu.plan_id = p_plan_id AND pu.estado = 'PARTICIPA';
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_todas_tareas(p_plan_id bigint)
 RETURNS TABLE(id bigint, titulo text, categoria text, estado text, asignado_nombre text, asignado_username text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.assert_allowed(public.is_plan_member(p_plan_id));
  SELECT t.id, t.titulo::text, t.categoria::text, t.estado::text,
         u.nombre::text, u.username::text
  FROM plan_tareas t
  JOIN plan_tareas_asignados a ON a.tarea_id = t.id
  JOIN usuarios u ON u.id = a.user_id
  WHERE t.plan_id = p_plan_id
  ORDER BY t.created_at;
$function$;

CREATE OR REPLACE FUNCTION public.fn_balances_for_plan(p_plan_id bigint)
 RETURNS TABLE(liquidacion_id bigint, from_user_id uuid, from_nombre text, from_profile_image text, to_user_id uuid, to_nombre text, to_profile_image text, importe numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  perform public.assert_allowed(coalesce(auth.role(), '') = 'service_role' or public.is_plan_member(p_plan_id));
  RETURN QUERY
  SELECT
    l.id,
    l.from_user_id,
    COALESCE(uf.nombre, 'Desconocido')::text,
    COALESCE(uf.profile_image, '')::text,
    l.to_user_id,
    COALESCE(ut.nombre, 'Desconocido')::text,
    COALESCE(ut.profile_image, '')::text,
    l.importe
  FROM liquidaciones l
  LEFT JOIN usuarios uf ON uf.id = l.from_user_id
  LEFT JOIN usuarios ut ON ut.id = l.to_user_id
  WHERE l.plan_id = p_plan_id
    AND l.estado::text = 'PENDIENTE'
    AND l.importe > 0.01
    AND EXISTS (SELECT 1 FROM plan_usuarios pu WHERE pu.plan_id = p_plan_id AND pu.user_id = l.from_user_id)
    AND EXISTS (SELECT 1 FROM plan_usuarios pu WHERE pu.plan_id = p_plan_id AND pu.user_id = l.to_user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_get_plan_user_rol(p_plan_id bigint, p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select public.assert_allowed(p_user_id = auth.uid() or public.is_plan_member(p_plan_id));
  SELECT rol::text FROM plan_usuarios
  WHERE plan_id = p_plan_id AND user_id = p_user_id;
$function$;

CREATE OR REPLACE FUNCTION public.fn_mensajes_list(p_chat_id uuid, p_limit integer DEFAULT 30, p_cursor_id bigint DEFAULT NULL::bigint)
 RETURNS TABLE(id bigint, sender_id uuid, sender_nombre text, sender_profile_image text, texto text, created_at timestamp with time zone, reply_to_id bigint, reply_texto text, reply_sender_nombre text, audio_url text, document_url text, document_name text, image_url text, image_type text, tipo text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select public.assert_allowed(public.is_chat_member(p_chat_id));
  SELECT
    m.id,
    m.sender_id,
    COALESCE(u.nombre, 'Frimee')  AS sender_nombre,
    u.profile_image                AS sender_profile_image,
    m.texto,
    m.created_at,
    m.reply_to_id,
    r.texto                        AS reply_texto,
    COALESCE(ru.nombre, 'Frimee') AS reply_sender_nombre,
    m.audio_url,
    m.document_url,
    m.document_name,
    m.image_url,
    m.image_type,
    m.tipo
  FROM mensajes m
  LEFT JOIN usuarios u  ON u.id = m.sender_id
  LEFT JOIN mensajes r  ON r.id = m.reply_to_id
  LEFT JOIN usuarios ru ON ru.id = r.sender_id
  WHERE m.chat_id = p_chat_id
    AND (p_cursor_id IS NULL OR m.id < p_cursor_id)
  ORDER BY m.id DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.fn_recordar(p_plan_id bigint, p_from_user_id uuid, p_to_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_last_sent timestamptz;
  v_hours_remaining int;
  v_has_debts boolean;
  v_has_tasks boolean;
  v_deuda_total numeric;
  v_plan_titulo text;
  v_meta jsonb;
BEGIN
  perform public.assert_allowed(auth.uid() is not null and p_from_user_id = auth.uid() and public.is_plan_member(p_plan_id));
  SELECT created_at INTO v_last_sent
  FROM notificaciones
  WHERE tipo = 'recordatorio'
    AND actor_id = p_from_user_id
    AND user_id = p_to_user_id
    AND entity_id::jsonb->>'plan_id' = p_plan_id::text
    AND created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_hours_remaining := GREATEST(1, CEIL(
      EXTRACT(EPOCH FROM (v_last_sent + INTERVAL '24 hours' - NOW())) / 3600
    )::int);
    RETURN -v_hours_remaining;
  END IF;

  SELECT COALESCE(SUM(importe), 0)
  INTO v_deuda_total
  FROM liquidaciones
  WHERE plan_id = p_plan_id
    AND from_user_id = p_to_user_id
    AND estado::text = 'PENDIENTE'
    AND importe > 0.01;

  v_has_debts := v_deuda_total > 0.01;

  SELECT EXISTS (
    SELECT 1 FROM plan_tareas pt
    JOIN plan_tareas_asignados pta ON pta.tarea_id = pt.id
    WHERE pt.plan_id = p_plan_id
      AND pta.user_id = p_to_user_id
      AND pt.estado::text != 'hecho'
  ) INTO v_has_tasks;

  IF NOT v_has_debts AND NOT v_has_tasks THEN
    RETURN 0;
  END IF;

  SELECT titulo INTO v_plan_titulo FROM plan WHERE id = p_plan_id;

  v_meta := jsonb_build_object(
    'plan_id', p_plan_id,
    'plan_titulo', v_plan_titulo,
    'importe', v_deuda_total,
    'has_tasks', v_has_tasks
  );

  INSERT INTO notificaciones (user_id, tipo, actor_id, entity_id, entity_type, leida, created_at)
  VALUES (p_to_user_id, 'recordatorio', p_from_user_id, v_meta::text, 'plan', false, NOW());

  RETURN 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_plan_create(p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_ubicacion_nombre text, p_owner_user_id uuid, p_creado_por_user_id uuid, p_all_day boolean DEFAULT false, p_visibilidad visibilidad_plan DEFAULT 'SOLO_GRUPO'::visibilidad_plan, p_ubicacion_direccion text DEFAULT NULL::text, p_foto_portada text DEFAULT NULL::text)
 RETURNS plan
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.plan;
begin
  perform public.assert_allowed(auth.uid() is not null and p_creado_por_user_id = auth.uid() and (p_owner_user_id is null or p_owner_user_id = auth.uid()));
  if p_titulo is null or btrim(p_titulo) = '' then
    raise exception 'Titulo requerido';
  end if;

  if p_descripcion is null or btrim(p_descripcion) = '' then
    raise exception 'Descripcion requerida';
  end if;

  if p_ubicacion_nombre is null or btrim(p_ubicacion_nombre) = '' then
    raise exception 'Ubicacion requerida';
  end if;

  if p_inicio_at is null or p_fin_at is null then
    raise exception 'Inicio/fin requeridos';
  end if;

  if p_fin_at < p_inicio_at then
    raise exception 'fin_at no puede ser menor que inicio_at';
  end if;

  insert into public.plan (
    titulo, descripcion, owner_user_id, owner_group_id, creado_por_user_id, estado,
    inicio_at, fin_at, all_day, visibilidad, ubicacion_nombre, ubicacion_direccion, foto_portada
  )
  values (
    btrim(p_titulo),
    btrim(p_descripcion),
    p_owner_user_id,
    null,
    p_creado_por_user_id,
    'ACTIVO',
    p_inicio_at,
    p_fin_at,
    coalesce(p_all_day, false),
    coalesce(p_visibilidad, 'SOLO_GRUPO'),
    btrim(p_ubicacion_nombre),
    nullif(btrim(coalesce(p_ubicacion_direccion, '')), ''),
    nullif(btrim(coalesce(p_foto_portada, '')), '')
  )
  returning * into v_row;

  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_user_auth_snapshot_get(p_user_id uuid)
 RETURNS TABLE(id uuid, nombre text, username text, fecha_nac date, email text, rol text, profile_image text, estado text, email_verified_at timestamp with time zone, deleted_at timestamp with time zone, settings_user_id uuid, theme text, language character varying, timezone character varying, notify_push boolean, notify_email boolean, notify_in_app boolean, profile_visibility character varying, allow_friend_requests boolean, google_sync_enabled boolean, google_sync_export_plans boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.assert_allowed(auth.uid() is not null and p_user_id = auth.uid());
  SELECT
    u.id, u.nombre::text, u.username::text, u.fecha_nac, u.email::text,
    u.rol::text, u.profile_image::text, u.estado::text,
    u.email_verified_at, u.deleted_at,
    s.user_id, s.theme::text, s.language, s.timezone,
    s.notify_push, s.notify_email, s.notify_in_app,
    s.profile_visibility, s.allow_friend_requests,
    s.google_sync_enabled, s.google_sync_export_plans
  FROM public.usuarios u
  LEFT JOIN public.user_settings s ON s.user_id = u.id AND s.deleted_at IS NULL
  WHERE u.id = p_user_id
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre character varying DEFAULT NULL::character varying, p_fecha_nac date DEFAULT NULL::date, p_profile_image text DEFAULT NULL::text, p_theme theme_preference DEFAULT NULL::theme_preference, p_language character varying DEFAULT NULL::character varying, p_timezone character varying DEFAULT NULL::character varying, p_notify_push boolean DEFAULT NULL::boolean, p_notify_email boolean DEFAULT NULL::boolean, p_notify_in_app boolean DEFAULT NULL::boolean, p_profile_visibility character varying DEFAULT NULL::character varying, p_allow_friend_requests boolean DEFAULT NULL::boolean)
 RETURNS TABLE(user_id uuid, nombre character varying, fecha_nac date, profile_image text, theme theme_preference, language character varying, timezone character varying, notify_push boolean, notify_email boolean, notify_in_app boolean, profile_visibility character varying, allow_friend_requests boolean)
 LANGUAGE plpgsql
AS $function$
#variable_conflict use_column
BEGIN
  perform public.assert_allowed(auth.uid() is not null and p_user_id = auth.uid());
  UPDATE public.usuarios AS u
  SET
    nombre = COALESCE(p_nombre, u.nombre),
    fecha_nac = COALESCE(p_fecha_nac, u.fecha_nac),
    profile_image = COALESCE(p_profile_image, u.profile_image)
  WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no existe: %', p_user_id;
  END IF;

  INSERT INTO public.user_settings AS us (
    user_id, theme, language, timezone,
    notify_push, notify_email, notify_in_app,
    profile_visibility, allow_friend_requests
  )
  VALUES (
    p_user_id,
    COALESCE(p_theme, 'SYSTEM'::public.theme_preference),
    COALESCE(p_language, 'es'),
    COALESCE(p_timezone, 'Europe/Madrid'),
    COALESCE(p_notify_push, true),
    COALESCE(p_notify_email, true),
    COALESCE(p_notify_in_app, true),
    COALESCE(p_profile_visibility, 'PUBLICO'),
    COALESCE(p_allow_friend_requests, true)
  )
  ON CONFLICT ON CONSTRAINT user_settings_pkey
  DO UPDATE SET
    theme = COALESCE(EXCLUDED.theme, us.theme),
    language = COALESCE(EXCLUDED.language, us.language),
    timezone = COALESCE(EXCLUDED.timezone, us.timezone),
    notify_push = COALESCE(EXCLUDED.notify_push, us.notify_push),
    notify_email = COALESCE(EXCLUDED.notify_email, us.notify_email),
    notify_in_app = COALESCE(EXCLUDED.notify_in_app, us.notify_in_app),
    profile_visibility = COALESCE(EXCLUDED.profile_visibility, us.profile_visibility),
    allow_friend_requests = COALESCE(EXCLUDED.allow_friend_requests, us.allow_friend_requests),
    deleted_at = NULL;

  RETURN QUERY
  SELECT
    u.id,
    u.nombre,
    u.fecha_nac,
    u.profile_image,
    s.theme,
    s.language,
    s.timezone,
    s.notify_push,
    s.notify_email,
    s.notify_in_app,
    s.profile_visibility,
    s.allow_friend_requests
  FROM public.usuarios AS u
  JOIN public.user_settings AS s ON s.user_id = u.id
  WHERE u.id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre text DEFAULT NULL::text, p_username text DEFAULT NULL::text, p_fecha_nac date DEFAULT NULL::date, p_profile_image text DEFAULT NULL::text, p_theme theme_preference DEFAULT NULL::theme_preference, p_language character varying DEFAULT NULL::character varying, p_timezone character varying DEFAULT NULL::character varying, p_notify_push boolean DEFAULT NULL::boolean, p_notify_email boolean DEFAULT NULL::boolean, p_notify_in_app boolean DEFAULT NULL::boolean, p_profile_visibility character varying DEFAULT NULL::character varying, p_allow_friend_requests boolean DEFAULT NULL::boolean, p_google_sync_enabled boolean DEFAULT NULL::boolean, p_google_sync_export_plans boolean DEFAULT NULL::boolean)
 RETURNS TABLE(id uuid, nombre text, username text, fecha_nac date, profile_image text, theme theme_preference, language character varying, timezone character varying, notify_push boolean, notify_email boolean, notify_in_app boolean, profile_visibility character varying, allow_friend_requests boolean, google_sync_enabled boolean, google_sync_export_plans boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  perform public.assert_allowed(auth.uid() is not null and p_user_id = auth.uid());
  -- Validar unicidad de username si se está cambiando
  IF p_username IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE lower(username) = lower(p_username) AND id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'username_taken';
    END IF;
  END IF;

  UPDATE public.usuarios AS u SET
    nombre        = COALESCE(NULLIF(TRIM(p_nombre), ''), u.nombre),
    username      = COALESCE(p_username, u.username),
    fecha_nac     = COALESCE(p_fecha_nac, u.fecha_nac),
    profile_image = COALESCE(p_profile_image, u.profile_image)
  WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no existe: %', p_user_id;
  END IF;

  INSERT INTO public.user_settings AS us (
    user_id, theme, language, timezone,
    notify_push, notify_email, notify_in_app,
    profile_visibility, allow_friend_requests,
    google_sync_enabled, google_sync_export_plans
  ) VALUES (
    p_user_id,
    COALESCE(p_theme, 'SYSTEM'::public.theme_preference),
    COALESCE(p_language, 'es'),
    COALESCE(p_timezone, 'Europe/Madrid'),
    COALESCE(p_notify_push, true),
    COALESCE(p_notify_email, true),
    COALESCE(p_notify_in_app, true),
    COALESCE(p_profile_visibility, 'PUBLICO'),
    COALESCE(p_allow_friend_requests, true),
    COALESCE(p_google_sync_enabled, false),
    COALESCE(p_google_sync_export_plans, true)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    theme                  = COALESCE(EXCLUDED.theme, us.theme),
    language               = COALESCE(EXCLUDED.language, us.language),
    timezone               = COALESCE(EXCLUDED.timezone, us.timezone),
    notify_push            = COALESCE(EXCLUDED.notify_push, us.notify_push),
    notify_email           = COALESCE(EXCLUDED.notify_email, us.notify_email),
    notify_in_app          = COALESCE(EXCLUDED.notify_in_app, us.notify_in_app),
    profile_visibility     = COALESCE(EXCLUDED.profile_visibility, us.profile_visibility),
    allow_friend_requests  = COALESCE(EXCLUDED.allow_friend_requests, us.allow_friend_requests),
    google_sync_enabled    = COALESCE(EXCLUDED.google_sync_enabled, us.google_sync_enabled),
    google_sync_export_plans = COALESCE(EXCLUDED.google_sync_export_plans, us.google_sync_export_plans),
    deleted_at = NULL;

  RETURN QUERY
  SELECT
    u.id, u.nombre::text, u.username::text, u.fecha_nac, u.profile_image::text,
    s.theme, s.language, s.timezone,
    s.notify_push, s.notify_email, s.notify_in_app,
    s.profile_visibility, s.allow_friend_requests,
    s.google_sync_enabled, s.google_sync_export_plans
  FROM public.usuarios u
  JOIN public.user_settings s ON s.user_id = u.id
  WHERE u.id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_user_settings_upsert(p_user_id uuid, p_theme theme_preference DEFAULT NULL::theme_preference, p_language character varying DEFAULT NULL::character varying, p_timezone character varying DEFAULT NULL::character varying, p_notify_push boolean DEFAULT NULL::boolean, p_notify_email boolean DEFAULT NULL::boolean, p_notify_in_app boolean DEFAULT NULL::boolean, p_profile_visibility character varying DEFAULT NULL::character varying, p_allow_friend_requests boolean DEFAULT NULL::boolean)
 RETURNS user_settings
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_row public.user_settings;
BEGIN
  perform public.assert_allowed(auth.uid() is not null and p_user_id = auth.uid());
  INSERT INTO public.user_settings AS us (
    user_id,
    theme,
    language,
    timezone,
    notify_push,
    notify_email,
    notify_in_app,
    profile_visibility,
    allow_friend_requests
  )
  VALUES (
    p_user_id,
    COALESCE(p_theme, 'SYSTEM'::public.theme_preference),
    COALESCE(p_language, 'es'),
    COALESCE(p_timezone, 'Europe/Madrid'),
    COALESCE(p_notify_push, true),
    COALESCE(p_notify_email, true),
    COALESCE(p_notify_in_app, true),
    COALESCE(p_profile_visibility, 'PUBLICO'),
    COALESCE(p_allow_friend_requests, true)
  )
  ON CONFLICT ON CONSTRAINT user_settings_pkey DO UPDATE
  SET
    theme = COALESCE(EXCLUDED.theme, us.theme),
    language = COALESCE(EXCLUDED.language, us.language),
    timezone = COALESCE(EXCLUDED.timezone, us.timezone),
    notify_push = COALESCE(EXCLUDED.notify_push, us.notify_push),
    notify_email = COALESCE(EXCLUDED.notify_email, us.notify_email),
    notify_in_app = COALESCE(EXCLUDED.notify_in_app, us.notify_in_app),
    profile_visibility = COALESCE(EXCLUDED.profile_visibility, us.profile_visibility),
    allow_friend_requests = COALESCE(EXCLUDED.allow_friend_requests, us.allow_friend_requests),
    deleted_at = NULL
  RETURNING us.* INTO v_row;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_user_settings_upsert(p_user_id uuid, p_theme theme_preference DEFAULT NULL::theme_preference, p_language character varying DEFAULT NULL::character varying, p_timezone character varying DEFAULT NULL::character varying, p_notify_push boolean DEFAULT NULL::boolean, p_notify_email boolean DEFAULT NULL::boolean, p_notify_in_app boolean DEFAULT NULL::boolean, p_profile_visibility character varying DEFAULT NULL::character varying, p_allow_friend_requests boolean DEFAULT NULL::boolean, p_google_sync_enabled boolean DEFAULT NULL::boolean, p_google_sync_export_plans boolean DEFAULT NULL::boolean)
 RETURNS user_settings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.user_settings;
begin
  perform public.assert_allowed(auth.uid() is not null and p_user_id = auth.uid());
  insert into public.user_settings (
    user_id,
    theme,
    language,
    timezone,
    notify_push,
    notify_email,
    notify_in_app,
    profile_visibility,
    allow_friend_requests,
    google_sync_enabled,
    google_sync_export_plans
  )
  values (
    p_user_id,
    coalesce(p_theme, 'SYSTEM'::public.theme_preference),
    coalesce(p_language, 'es'),
    coalesce(p_timezone, 'Europe/Madrid'),
    coalesce(p_notify_push, true),
    coalesce(p_notify_email, true),
    coalesce(p_notify_in_app, true),
    coalesce(p_profile_visibility, 'PUBLICO'),
    coalesce(p_allow_friend_requests, true),
    coalesce(p_google_sync_enabled, false),
    coalesce(p_google_sync_export_plans, true)
  )
  on conflict (user_id)
  do update set
    theme = coalesce(p_theme, public.user_settings.theme),
    language = coalesce(p_language, public.user_settings.language),
    timezone = coalesce(p_timezone, public.user_settings.timezone),
    notify_push = coalesce(p_notify_push, public.user_settings.notify_push),
    notify_email = coalesce(p_notify_email, public.user_settings.notify_email),
    notify_in_app = coalesce(p_notify_in_app, public.user_settings.notify_in_app),
    profile_visibility = coalesce(p_profile_visibility, public.user_settings.profile_visibility),
    allow_friend_requests = coalesce(p_allow_friend_requests, public.user_settings.allow_friend_requests),
    google_sync_enabled = coalesce(p_google_sync_enabled, public.user_settings.google_sync_enabled),
    google_sync_export_plans = coalesce(p_google_sync_export_plans, public.user_settings.google_sync_export_plans),
    deleted_at = null
  returning * into v_row;

  return v_row;
end;
$function$;

-- 4. Plan lists.
CREATE OR REPLACE FUNCTION public.fn_plans_get_for_user(p_user_id uuid, p_limit integer DEFAULT 300)
 RETURNS TABLE(id bigint, created_at timestamp with time zone, titulo text, descripcion text, visibilidad text, inicio_at timestamp with time zone, fin_at timestamp with time zone, all_day boolean, ubicacion_nombre text, foto_portada text, owner_user_id uuid, creado_por_user_id uuid, creador_nombre text, creador_profile_image text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id, p.created_at,
    p.titulo::text, p.descripcion::text, p.visibilidad::text,
    p.inicio_at, p.fin_at, p.all_day,
    p.ubicacion_nombre::text, p.foto_portada::text,
    p.owner_user_id, p.creado_por_user_id,
    u.nombre::text AS creador_nombre, u.profile_image::text AS creador_profile_image
  FROM plan p
  LEFT JOIN usuarios u ON u.id = p.creado_por_user_id
  WHERE p.deleted_at IS NULL
    AND p.estado = 'ACTIVO'
    AND (p_user_id = auth.uid() OR p.visibilidad = 'PÚBLICO' OR public.is_plan_member(p.id))
    AND (
      p.creado_por_user_id = p_user_id
      OR p.owner_user_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM plan_usuarios pu
        WHERE pu.plan_id = p.id
          AND pu.user_id = p_user_id
          AND pu.estado = 'PARTICIPA'
      )
    )
  ORDER BY p.inicio_at ASC LIMIT p_limit;
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_plans_get_by_ids(p_plan_ids bigint[])
 RETURNS TABLE(id bigint, created_at timestamp with time zone, titulo text, descripcion text, visibilidad text, inicio_at timestamp with time zone, fin_at timestamp with time zone, all_day boolean, ubicacion_nombre text, foto_portada text, owner_user_id uuid, creado_por_user_id uuid, creador_nombre text, creador_profile_image text, join_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.created_at,
    p.titulo::text, p.descripcion::text, p.visibilidad::text,
    p.inicio_at, p.fin_at, p.all_day,
    p.ubicacion_nombre::text, p.foto_portada::text,
    p.owner_user_id, p.creado_por_user_id,
    u.nombre::text AS creador_nombre, u.profile_image::text AS creador_profile_image,
    CASE WHEN public.is_plan_member(p.id) THEN p.join_code::text END
  FROM plan p LEFT JOIN usuarios u ON u.id = p.creado_por_user_id
  WHERE p.id = ANY(p_plan_ids) AND p.deleted_at IS NULL AND p.estado = 'ACTIVO'
    AND (p.visibilidad <> 'SOLO_GRUPO' OR public.is_plan_member(p.id));
END;
$function$;

-- 5. Nothing here is for visitors without a session (guests are signed in).
revoke execute on function public.fn_balances_for_plan(bigint) from public, anon;
revoke execute on function public.fn_gastos_list_for_plan(bigint) from public, anon;
revoke execute on function public.fn_get_plan_member_ids(bigint) from public, anon;
revoke execute on function public.fn_get_plan_user_rol(bigint, uuid) from public, anon;
revoke execute on function public.fn_mensajes_list(uuid, integer, bigint) from public, anon;
revoke execute on function public.fn_plan_get_miembros(bigint) from public, anon;
revoke execute on function public.fn_plans_get_by_ids(bigint[]) from public, anon;
revoke execute on function public.fn_plans_get_for_user(uuid, integer) from public, anon;
revoke execute on function public.fn_recordar(bigint, uuid, uuid) from public, anon;
revoke execute on function public.fn_subplan_list(bigint) from public, anon;
revoke execute on function public.fn_todas_tareas(bigint) from public, anon;
revoke execute on function public.fn_user_auth_snapshot_get(uuid) from public, anon;
revoke execute on function public.fn_plan_create(p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_ubicacion_nombre text, p_owner_user_id uuid, p_creado_por_user_id uuid, p_all_day boolean, p_visibilidad visibilidad_plan, p_ubicacion_direccion text, p_foto_portada text) from public, anon;
revoke execute on function public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre character varying, p_fecha_nac date, p_profile_image text, p_theme theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean) from public, anon;
revoke execute on function public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre text, p_username text, p_fecha_nac date, p_profile_image text, p_theme theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean, p_google_sync_enabled boolean, p_google_sync_export_plans boolean) from public, anon;
revoke execute on function public.fn_user_settings_upsert(p_user_id uuid, p_theme theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean) from public, anon;
revoke execute on function public.fn_user_settings_upsert(p_user_id uuid, p_theme theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean, p_google_sync_enabled boolean, p_google_sync_export_plans boolean) from public, anon;
