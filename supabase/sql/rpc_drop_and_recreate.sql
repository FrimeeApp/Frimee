-- ============================================================
-- 0. Añadir valor PENDIENTE al enum estado_amistad (si no existe)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'estado_amistad'::regtype
      AND enumlabel = 'PENDIENTE'
  ) THEN
    ALTER TYPE estado_amistad ADD VALUE 'PENDIENTE';
  END IF;
END $$;

-- ============================================================
-- 1. DROP funciones existentes (necesario al cambiar tipos)
-- ============================================================

-- Drop integer-signature variants (original)
DROP FUNCTION IF EXISTS fn_liquidaciones_list_for_user();
DROP FUNCTION IF EXISTS fn_liquidacion_request_confirmation(integer);
DROP FUNCTION IF EXISTS fn_liquidacion_confirm_receipt(integer);
DROP FUNCTION IF EXISTS fn_liquidacion_reject_receipt(integer);
DROP FUNCTION IF EXISTS fn_plans_get_by_ids(integer[]);
DROP FUNCTION IF EXISTS fn_plans_get_for_user(uuid, integer);
DROP FUNCTION IF EXISTS fn_users_search_public(text, integer, uuid);
DROP FUNCTION IF EXISTS fn_user_profile_get_public(uuid);
DROP FUNCTION IF EXISTS fn_user_settings_get();
DROP FUNCTION IF EXISTS fn_evento_insert_local(text, text, text, timestamptz, timestamptz, boolean, text, text, text);
DROP FUNCTION IF EXISTS fn_eventos_get_google_for_sync(timestamptz, timestamptz, integer);
DROP FUNCTION IF EXISTS fn_eventos_delete_batch(integer[]);
DROP FUNCTION IF EXISTS fn_eventos_upsert_google_batch(jsonb);
DROP FUNCTION IF EXISTS fn_evento_update_sync_info(integer, text, text);
DROP FUNCTION IF EXISTS fn_evento_delete(integer);
DROP FUNCTION IF EXISTS fn_calendar_sync_state_upsert(boolean, boolean, text, text, timestamptz, timestamptz, integer, integer, integer);
DROP FUNCTION IF EXISTS fn_user_update_google_refresh_token(text);

DROP FUNCTION IF EXISTS fn_friend_request_send(uuid);
DROP FUNCTION IF EXISTS fn_friends_list_active();

-- Drop bigint-signature variants (in case already partially recreated)
DROP FUNCTION IF EXISTS fn_liquidacion_request_confirmation(bigint);
DROP FUNCTION IF EXISTS fn_liquidacion_confirm_receipt(bigint);
DROP FUNCTION IF EXISTS fn_liquidacion_reject_receipt(bigint);
DROP FUNCTION IF EXISTS fn_plans_get_by_ids(bigint[]);
DROP FUNCTION IF EXISTS fn_plans_get_for_user(uuid, integer);
DROP FUNCTION IF EXISTS fn_eventos_get_google_for_sync(timestamptz, timestamptz, integer);
DROP FUNCTION IF EXISTS fn_eventos_delete_batch(bigint[]);
DROP FUNCTION IF EXISTS fn_evento_update_sync_info(bigint, text, text);
DROP FUNCTION IF EXISTS fn_evento_delete(bigint);

-- ============================================================
-- 2. RECREAR con tipos correctos (bigint para IDs)
-- ============================================================

-- ─── LIQUIDACIONES ───────────────────────────────────────────

CREATE FUNCTION fn_liquidaciones_list_for_user()
RETURNS TABLE (
  id            bigint,
  plan_id       bigint,
  plan_titulo   text,
  from_user_id  uuid,
  to_user_id    uuid,
  importe       numeric,
  fecha         timestamptz,
  nota          text,
  estado        text,
  counterparty_id            uuid,
  counterparty_nombre        text,
  counterparty_profile_image text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.plan_id,
    p.titulo::text                                                  AS plan_titulo,
    l.from_user_id,
    l.to_user_id,
    l.importe,
    l.fecha,
    l.nota::text,
    l.estado::text,
    CASE WHEN l.from_user_id = v_uid THEN l.to_user_id ELSE l.from_user_id END AS counterparty_id,
    u.nombre::text                                                  AS counterparty_nombre,
    u.profile_image::text                                           AS counterparty_profile_image
  FROM liquidaciones l
  LEFT JOIN plan     p ON p.id  = l.plan_id
  LEFT JOIN usuarios u ON u.id  = CASE WHEN l.from_user_id = v_uid THEN l.to_user_id ELSE l.from_user_id END
  WHERE (l.from_user_id = v_uid OR l.to_user_id = v_uid)
    AND l.estado IN ('PENDIENTE','EN_REVISION','CONFIRMADA')
  ORDER BY l.fecha DESC;
END;
$$;

CREATE FUNCTION fn_liquidacion_request_confirmation(p_liquidacion_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE liquidaciones SET estado = 'EN_REVISION'
  WHERE id = p_liquidacion_id AND from_user_id = auth.uid() AND estado = 'PENDIENTE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Liquidacion % no encontrada o no autorizada', p_liquidacion_id; END IF;
END; $$;

CREATE FUNCTION fn_liquidacion_confirm_receipt(p_liquidacion_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE liquidaciones SET estado = 'CONFIRMADA'
  WHERE id = p_liquidacion_id AND to_user_id = auth.uid() AND estado = 'EN_REVISION';
  IF NOT FOUND THEN RAISE EXCEPTION 'Liquidacion % no encontrada o no autorizada', p_liquidacion_id; END IF;
END; $$;

CREATE FUNCTION fn_liquidacion_reject_receipt(p_liquidacion_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE liquidaciones SET estado = 'PENDIENTE'
  WHERE id = p_liquidacion_id AND to_user_id = auth.uid() AND estado = 'EN_REVISION';
  IF NOT FOUND THEN RAISE EXCEPTION 'Liquidacion % no encontrada o no autorizada', p_liquidacion_id; END IF;
END; $$;


-- ─── PLANS ────────────────────────────────────────────────────

CREATE FUNCTION fn_plans_get_by_ids(p_plan_ids bigint[])
RETURNS TABLE (
  id bigint, created_at timestamptz, titulo text, descripcion text, visibilidad text,
  inicio_at timestamptz, fin_at timestamptz, all_day boolean, ubicacion_nombre text,
  foto_portada text, owner_user_id uuid, creado_por_user_id uuid,
  creador_nombre text, creador_profile_image text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.created_at,
    p.titulo::text, p.descripcion::text, p.visibilidad::text,
    p.inicio_at, p.fin_at, p.all_day,
    p.ubicacion_nombre::text, p.foto_portada::text,
    p.owner_user_id, p.creado_por_user_id,
    u.nombre::text AS creador_nombre, u.profile_image::text AS creador_profile_image
  FROM plan p LEFT JOIN usuarios u ON u.id = p.creado_por_user_id
  WHERE p.id = ANY(p_plan_ids) AND p.deleted_at IS NULL AND p.estado = 'ACTIVO';
END; $$;

CREATE FUNCTION fn_plans_get_for_user(p_user_id uuid, p_limit integer DEFAULT 300)
RETURNS TABLE (
  id bigint, created_at timestamptz, titulo text, descripcion text, visibilidad text,
  inicio_at timestamptz, fin_at timestamptz, all_day boolean, ubicacion_nombre text,
  foto_portada text, owner_user_id uuid, creado_por_user_id uuid,
  creador_nombre text, creador_profile_image text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.created_at,
    p.titulo::text, p.descripcion::text, p.visibilidad::text,
    p.inicio_at, p.fin_at, p.all_day,
    p.ubicacion_nombre::text, p.foto_portada::text,
    p.owner_user_id, p.creado_por_user_id,
    u.nombre::text AS creador_nombre, u.profile_image::text AS creador_profile_image
  FROM plan p LEFT JOIN usuarios u ON u.id = p.creado_por_user_id
  WHERE (p.creado_por_user_id = p_user_id OR p.owner_user_id = p_user_id)
    AND p.deleted_at IS NULL AND p.estado = 'ACTIVO'
  ORDER BY p.inicio_at ASC LIMIT p_limit;
END; $$;


-- ─── USERS ────────────────────────────────────────────────────

CREATE FUNCTION fn_users_search_public(p_query text, p_limit integer DEFAULT 8, p_exclude_user_id uuid DEFAULT NULL)
RETURNS TABLE (id uuid, nombre text, profile_image text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nombre::text, u.profile_image::text FROM usuarios_public u
  WHERE u.nombre ILIKE '%' || p_query || '%'
    AND (p_exclude_user_id IS NULL OR u.id <> p_exclude_user_id)
  ORDER BY u.nombre ASC LIMIT p_limit;
END; $$;

CREATE FUNCTION fn_user_profile_get_public(p_user_id uuid)
RETURNS TABLE (id uuid, nombre text, profile_image text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nombre::text, u.profile_image::text FROM usuarios_public u WHERE u.id = p_user_id;
END; $$;


-- ─── SETTINGS ─────────────────────────────────────────────────

CREATE FUNCTION fn_user_settings_get()
RETURNS TABLE (
  user_id uuid, theme text, language text, timezone text,
  notify_push boolean, notify_email boolean, notify_in_app boolean,
  profile_visibility text, allow_friend_requests boolean,
  google_sync_enabled boolean, google_sync_export_plans boolean
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT s.user_id, s.theme::text, s.language::text, s.timezone::text,
    s.notify_push, s.notify_email, s.notify_in_app,
    s.profile_visibility::text, s.allow_friend_requests,
    s.google_sync_enabled, s.google_sync_export_plans
  FROM user_settings s WHERE s.user_id = auth.uid() AND s.deleted_at IS NULL;
END; $$;


-- ─── EVENTOS ──────────────────────────────────────────────────

CREATE FUNCTION fn_evento_insert_local(
  p_title text, p_description text DEFAULT NULL, p_category text DEFAULT 'OTRO',
  p_starts_at timestamptz DEFAULT NULL, p_ends_at timestamptz DEFAULT NULL,
  p_all_day boolean DEFAULT false, p_color text DEFAULT NULL,
  p_location_name text DEFAULT NULL, p_location_address text DEFAULT NULL
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id bigint; v_uid uuid := auth.uid();
BEGIN
  INSERT INTO evento (
    owner_user_id, creado_por_user_id, titulo, descripcion, categoria,
    inicio_at, fin_at, all_day, color, ubicacion_nombre, ubicacion_direccion,
    source, sync_status, estado
  ) VALUES (
    v_uid, v_uid, p_title, p_description, p_category,
    p_starts_at, p_ends_at, p_all_day, p_color, p_location_name, p_location_address,
    'LOCAL', 'SYNCED', 'ACTIVO'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE FUNCTION fn_eventos_get_google_for_sync(p_time_min timestamptz, p_time_max timestamptz, p_limit integer DEFAULT 3000)
RETURNS TABLE (id bigint, google_calendar_id text, google_event_id text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.google_calendar_id::text, e.google_event_id::text FROM evento e
  WHERE e.owner_user_id = auth.uid() AND e.source = 'GOOGLE' AND e.deleted_at IS NULL
    AND e.inicio_at <= p_time_max AND e.fin_at >= p_time_min
  LIMIT p_limit;
END; $$;

CREATE FUNCTION fn_eventos_delete_batch(p_event_ids bigint[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM evento WHERE id = ANY(p_event_ids) AND owner_user_id = auth.uid();
END; $$;

CREATE FUNCTION fn_eventos_upsert_google_batch(p_events jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_row jsonb;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_events) LOOP
    INSERT INTO evento (
      owner_user_id, creado_por_user_id, titulo, descripcion, categoria,
      inicio_at, fin_at, all_day, color, ubicacion_nombre, ubicacion_direccion,
      source, google_calendar_id, google_event_id, sync_status, estado, deleted_at, last_synced_at, sync_error
    ) VALUES (
      v_uid, v_uid,
      (v_row->>'titulo'), (v_row->>'descripcion'), COALESCE(v_row->>'categoria','OTRO'),
      (v_row->>'inicio_at')::timestamptz, (v_row->>'fin_at')::timestamptz,
      (v_row->>'all_day')::boolean, (v_row->>'color'),
      (v_row->>'ubicacion_nombre'), (v_row->>'ubicacion_direccion'),
      (v_row->>'source'), (v_row->>'google_calendar_id'), (v_row->>'google_event_id'),
      COALESCE(v_row->>'sync_status','SYNCED'), COALESCE(v_row->>'estado','ACTIVO'),
      NULL, (v_row->>'last_synced_at')::timestamptz, NULL
    )
    ON CONFLICT (owner_user_id, google_calendar_id, google_event_id) DO UPDATE SET
      titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion,
      inicio_at = EXCLUDED.inicio_at, fin_at = EXCLUDED.fin_at,
      all_day = EXCLUDED.all_day, color = EXCLUDED.color,
      ubicacion_nombre = EXCLUDED.ubicacion_nombre, ubicacion_direccion = EXCLUDED.ubicacion_direccion,
      sync_status = EXCLUDED.sync_status, estado = EXCLUDED.estado,
      deleted_at = NULL, last_synced_at = EXCLUDED.last_synced_at, sync_error = NULL;
  END LOOP;
END; $$;

CREATE FUNCTION fn_evento_update_sync_info(p_event_id bigint, p_google_calendar_id text, p_google_event_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE evento SET
    google_calendar_id = p_google_calendar_id, google_event_id = p_google_event_id,
    last_synced_at = NOW(), sync_status = 'SYNCED', sync_error = NULL
  WHERE id = p_event_id AND owner_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento % no encontrado o no autorizado', p_event_id; END IF;
END; $$;

CREATE FUNCTION fn_evento_delete(p_event_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM evento WHERE id = p_event_id AND owner_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento % no encontrado o no autorizado', p_event_id; END IF;
END; $$;

CREATE FUNCTION fn_calendar_sync_state_upsert(
  p_sync_enabled_snapshot boolean, p_export_plans_snapshot boolean, p_last_status text,
  p_last_error text DEFAULT NULL, p_last_started_at timestamptz DEFAULT NULL,
  p_last_finished_at timestamptz DEFAULT NULL, p_last_imported_count integer DEFAULT 0,
  p_last_exported_count integer DEFAULT 0, p_last_calendars_count integer DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO calendar_sync_state (
    user_id, sync_enabled_snapshot, export_plans_snapshot,
    last_status, last_error, last_started_at, last_finished_at,
    last_imported_count, last_exported_count, last_calendars_count
  ) VALUES (
    auth.uid(), p_sync_enabled_snapshot, p_export_plans_snapshot,
    p_last_status, p_last_error, p_last_started_at, p_last_finished_at,
    p_last_imported_count, p_last_exported_count, p_last_calendars_count
  )
  ON CONFLICT (user_id) DO UPDATE SET
    sync_enabled_snapshot = EXCLUDED.sync_enabled_snapshot,
    export_plans_snapshot = EXCLUDED.export_plans_snapshot,
    last_status = EXCLUDED.last_status, last_error = EXCLUDED.last_error,
    last_started_at  = COALESCE(EXCLUDED.last_started_at,  calendar_sync_state.last_started_at),
    last_finished_at = COALESCE(EXCLUDED.last_finished_at, calendar_sync_state.last_finished_at),
    last_imported_count = EXCLUDED.last_imported_count,
    last_exported_count = EXCLUDED.last_exported_count,
    last_calendars_count = EXCLUDED.last_calendars_count;
END; $$;


-- ─── AMISTADES ────────────────────────────────────────────────

CREATE FUNCTION fn_friend_request_send(p_target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_user1 uuid;
  v_user2 uuid;
BEGIN
  IF v_uid = p_target_user_id THEN
    RAISE EXCEPTION 'No puedes añadirte a ti mismo como amigo';
  END IF;

  -- Canonical ordering required by constraint: user_id_1 < user_id_2
  IF v_uid < p_target_user_id THEN
    v_user1 := v_uid;
    v_user2 := p_target_user_id;
  ELSE
    v_user1 := p_target_user_id;
    v_user2 := v_uid;
  END IF;

  INSERT INTO amistades (user_id_1, user_id_2, estado)
  VALUES (v_user1, v_user2, 'PENDIENTE')
  ON CONFLICT (user_id_1, user_id_2) DO NOTHING;
END; $$;


CREATE FUNCTION fn_friends_list_active()
RETURNS TABLE (id uuid, nombre text, profile_image text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN a.user_id_1 = v_uid THEN a.user_id_2 ELSE a.user_id_1 END AS id,
    u.nombre::text,
    u.profile_image::text
  FROM amistades a
  JOIN usuarios u ON u.id = CASE WHEN a.user_id_1 = v_uid THEN a.user_id_2 ELSE a.user_id_1 END
  WHERE (a.user_id_1 = v_uid OR a.user_id_2 = v_uid)
    AND a.estado = 'ACTIVA'
  ORDER BY u.nombre ASC;
END; $$;


-- ─── AUTH / USUARIOS ──────────────────────────────────────────

CREATE FUNCTION fn_user_update_google_refresh_token(p_refresh_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE usuarios SET google_refresh_token = p_refresh_token WHERE id = auth.uid();
END; $$;


-- ─── Refrescar caché de PostgREST ─────────────────────────────
NOTIFY pgrst, 'reload schema';
