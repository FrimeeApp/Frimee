--
-- PostgreSQL database dump
--

\restrict S8McbnVjq0UF7KaIPamBjC4fE7QwHv7AWqeVidJNGvRd9RHznAOlPIqOh8tkJYo

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: categoria_tarea; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.categoria_tarea AS ENUM (
    'vuelo',
    'ferry',
    'coche',
    'alojamiento',
    'actividad',
    'comida',
    'otro',
    'organizador'
);


--
-- Name: estado_amistad; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_amistad AS ENUM (
    'ACTIVA',
    'ELIMINADA',
    'PENDIENTE'
);


--
-- Name: estado_factura; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_factura AS ENUM (
    'BORRADOR',
    'EMITIDA',
    'CERRADA',
    'CANCELADA'
);


--
-- Name: estado_gasto; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_gasto AS ENUM (
    'BORRADOR',
    'CONFIRMADO',
    'ANULADO'
);


--
-- Name: estado_invite; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_invite AS ENUM (
    'PENDIENTE',
    'ACEPTADA',
    'RECHAZADA',
    'EXPIRADA',
    'CANCELADA'
);


--
-- Name: estado_liquidacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_liquidacion AS ENUM (
    'PENDIENTE',
    'CONFIRMADA',
    'ANULADA',
    'EN_REVISION'
);


--
-- Name: estado_miembro_grupo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_miembro_grupo AS ENUM (
    'ACTIVO',
    'BLOQUEADO',
    'PENDIENTE',
    'ELIMINADO'
);


--
-- Name: estado_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_plan AS ENUM (
    'ACTIVO',
    'TERMINADO',
    'CANCELADO',
    'BORRADOR'
);


--
-- Name: estado_plan_usuario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_plan_usuario AS ENUM (
    'PARTICIPA',
    'RECHAZADO',
    'BLOQUEADO'
);


--
-- Name: estado_subplan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_subplan AS ENUM (
    'ACTIVO',
    'TERMINADO',
    'CANCELADO',
    'BORRADOR'
);


--
-- Name: estado_tarea; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_tarea AS ENUM (
    'pendiente',
    'en_progreso',
    'hecho'
);


--
-- Name: estado_usuario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_usuario AS ENUM (
    'ACTIVA',
    'INACTIVA'
);


--
-- Name: fuente_parte; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fuente_parte AS ENUM (
    'AUTO',
    'MANUAL'
);


--
-- Name: metodo_pago; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.metodo_pago AS ENUM (
    'EFECTIVO',
    'BIZUM',
    'TRANSFERENCIA',
    'OTRO',
    'STRIPE'
);


--
-- Name: metodo_reparto; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.metodo_reparto AS ENUM (
    'IGUAL',
    'PORCENTAJE',
    'CANTIDAD',
    'POR_ITEMS'
);


--
-- Name: rol_chat; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_chat AS ENUM (
    'ADMIN',
    'MEMBER'
);


--
-- Name: rol_grupo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_grupo AS ENUM (
    'ADMIN',
    'BASICO'
);


--
-- Name: rol_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_plan AS ENUM (
    'ADMIN',
    'PARTICIPANTE'
);


--
-- Name: rol_usuario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_usuario AS ENUM (
    'MIEMBRO',
    'ADMIN'
);


--
-- Name: scope_chat; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.scope_chat AS ENUM (
    'GROUP',
    'PLAN'
);


--
-- Name: target_invite; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.target_invite AS ENUM (
    'GROUP',
    'PLAN',
    'FRIEND'
);


--
-- Name: theme_preference; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.theme_preference AS ENUM (
    'SYSTEM',
    'LIGHT',
    'DARK'
);


--
-- Name: tipo_factura; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_factura AS ENUM (
    'PARCIAL',
    'FINAL'
);


--
-- Name: tipo_reserva; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_reserva AS ENUM (
    'VUELO',
    'HOTEL',
    'TREN',
    'ACTIVIDAD',
    'OTRO'
);


--
-- Name: tipo_subplan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_subplan AS ENUM (
    'VUELO',
    'TREN',
    'BUS',
    'BARCO',
    'COCHE',
    'HOTEL',
    'RESTAURANTE',
    'ACTIVIDAD',
    'OTRO'
);


--
-- Name: visibilidad_grupo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visibilidad_grupo AS ENUM (
    'PRIVADO',
    'PUBLICO'
);


--
-- Name: visibilidad_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visibilidad_plan AS ENUM (
    'SOLO_GRUPO',
    'SOLO_AMIGOS',
    'SOLO_FOLLOW',
    'PÚBLICO'
);


--
-- Name: audit_if_modified(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_if_modified() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_actor uuid;
  v_old jsonb;
  v_new jsonb;
  v_pk  jsonb := '{}'::jsonb;
  v_changed jsonb := '{}'::jsonb;
  col text;
  cols text[];
  v_old_val jsonb;
  v_new_val jsonb;

  -- opcionales si los seteas desde tu app:
  v_req_id text;
  v_ua text;
begin
  -- Quién ejecuta (Supabase): auth.uid() existe si hay JWT (RLS context)
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;

  -- request_id / user_agent (opcional): tu app puede hacer:
  -- select set_config('app.request_id', '...', true);
  -- select set_config('app.user_agent', '...', true);
  v_req_id := current_setting('app.request_id', true);
  v_ua     := current_setting('app.user_agent', true);

  if (tg_op = 'INSERT') then
    v_old := null;
    v_new := to_jsonb(new);
  elsif (tg_op = 'DELETE') then
    v_old := to_jsonb(old);
    v_new := null;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  end if;

  -- PK columns vienen por argumentos del trigger: TG_ARGV[0..]
  cols := tg_argv;

  if cols is not null then
    foreach col in array cols loop
      if (tg_op = 'DELETE') then
        v_pk := v_pk || jsonb_build_object(col, v_old -> col);
      else
        v_pk := v_pk || jsonb_build_object(col, v_new -> col);
      end if;
    end loop;
  end if;

  -- changed_fields solo para UPDATE (comparación por JSONB)
  if (tg_op = 'UPDATE') then
    -- Recorremos las keys del new_row
    for col in select key from jsonb_each(v_new) loop
      v_old_val := v_old -> col;
      v_new_val := v_new -> col;

      if v_old_val is distinct from v_new_val then
        v_changed := v_changed || jsonb_build_object(
          col, jsonb_build_object('from', v_old_val, 'to', v_new_val)
        );
      end if;
    end loop;
  else
    v_changed := null;
  end if;

  insert into public.audit_log(
    schema_name, table_name, action,
    record_pk, old_row, new_row, changed_fields,
    actor_user_id, txid, client_ip, user_agent, request_id
  )
  values (
    coalesce(tg_table_schema, 'public'),
    tg_table_name,
    tg_op,
    nullif(v_pk, '{}'::jsonb),
    v_old,
    v_new,
    v_changed,
    v_actor,
    txid_current(),
    inet_client_addr(),
    v_ua,
    v_req_id
  );

  -- No alteramos la operación original
  if (tg_op = 'DELETE') then
    return old;
  else
    return new;
  end if;
end;
$$;


--
-- Name: check_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer) RETURNS TABLE(allowed boolean, remaining integer, retry_after integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_reset_at timestamptz;
  v_count integer;
begin
  insert into public.rate_limits as rl (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update
  set
    count = case
      when rl.reset_at <= v_now then 1
      else rl.count + 1
    end,
    reset_at = case
      when rl.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds)
      else rl.reset_at
    end
  returning rl.count, rl.reset_at into v_count, v_reset_at;

  if v_count > p_limit then
    return query select
      false,
      0,
      greatest(1, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
  end if;

  return query select
    true,
    greatest(0, p_limit - v_count),
    0;
end;
$$;


--
-- Name: feed_explore(integer, timestamp with time zone, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.feed_explore(p_limit integer DEFAULT 20, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_plan_id bigint DEFAULT NULL::bigint) RETURNS TABLE(plan_id bigint, created_at timestamp with time zone, titulo text, descripcion text, visibilidad text, inicio_at timestamp with time zone, fin_at timestamp with time zone, ubicacion_nombre text, foto_portada text, creador_id uuid, creador_nombre text, creador_profile_image text)
    LANGUAGE sql STABLE
    AS $$
  select
    p.id as plan_id,
    p.created_at,
    p.titulo::text,
    p.descripcion::text,
    p.visibilidad::text,
    p.inicio_at,
    p.fin_at,
    p.ubicacion_nombre::text,
    p.foto_portada::text as foto_portada,   -- 👈 NUEVO
    p.creado_por_user_id as creador_id,
    u.nombre::text as creador_nombre,
    u.profile_image::text as creador_profile_image
  from public.plan p
  join public.usuarios_public u on u.id = p.creado_por_user_id
  where
    p.deleted_at is null
    and p.estado <> 'BORRADOR'
    and p.visibilidad = 'PÚBLICO'
    and u.deleted_at is null
    and (
      p_cursor_created_at is null
      or (p.created_at, p.id) < (p_cursor_created_at, p_cursor_plan_id)
    )
  order by p.created_at desc, p.id desc
  limit greatest(p_limit, 1);
$$;


--
-- Name: feed_explore(timestamp with time zone, bigint, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.feed_explore(p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_plan_id bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 20) RETURNS TABLE(plan_id bigint, created_at timestamp with time zone, titulo text, descripcion text, visibilidad text, inicio_at timestamp with time zone, fin_at timestamp with time zone, ubicacion_nombre text, foto_portada text, creador_id uuid, creador_nombre text, creador_username text, creador_profile_image text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    p.id, p.created_at,
    p.titulo::text, p.descripcion::text, p.visibilidad::text,
    p.inicio_at, p.fin_at,
    p.ubicacion_nombre::text, p.foto_portada::text,
    p.creado_por_user_id,
    u.nombre::text, u.username::text, u.profile_image::text
  FROM public.plan p
  JOIN public.usuarios_public u ON u.id = p.creado_por_user_id
  WHERE p.deleted_at IS NULL
    AND p.estado <> 'BORRADOR'
    AND p.visibilidad = 'PÚBLICO'
    AND u.deleted_at IS NULL
    AND (
      p_cursor_created_at IS NULL
      OR (p.created_at, p.id) < (p_cursor_created_at, p_cursor_plan_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT GREATEST(p_limit, 1);
$$;


--
-- Name: fn_accept_plan_invite(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_accept_plan_invite(p_plan_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO plan_usuarios (plan_id, user_id, rol, estado)
  VALUES (p_plan_id, auth.uid(), 'PARTICIPANTE', 'PARTICIPA')
  ON CONFLICT (plan_id, user_id) DO NOTHING;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: plan_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id bigint,
    type text NOT NULL,
    title text NOT NULL,
    subtitle text,
    from_label text,
    to_label text,
    place_label text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    booking_code text,
    seat_label text,
    gate_label text,
    terminal_label text,
    passenger_name text,
    notes text,
    qr_image_url text,
    barcode_value text,
    source_image_url text,
    source_pdf_url text,
    cover_color text,
    status text DEFAULT 'upcoming'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plan_tickets_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'used'::text, 'cancelled'::text]))),
    CONSTRAINT plan_tickets_type_check CHECK ((type = ANY (ARRAY['flight'::text, 'ferry'::text, 'train'::text, 'concert'::text, 'match'::text, 'hotel'::text, 'other'::text])))
);


--
-- Name: fn_active_friend_ferries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_active_friend_ferries() RETURNS SETOF public.plan_tickets
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT *
  FROM plan_tickets
  WHERE type = 'ferry'
    AND status = 'upcoming'
    AND starts_at <= NOW()
    AND (ends_at IS NULL OR ends_at >= NOW())
    AND user_id != auth.uid();
$$;


--
-- Name: fn_active_friend_flights(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_active_friend_flights() RETURNS TABLE(id uuid, user_id uuid, plan_id bigint, type text, title text, subtitle text, from_label text, to_label text, place_label text, starts_at timestamp with time zone, ends_at timestamp with time zone, booking_code text, seat_label text, gate_label text, terminal_label text, passenger_name text, notes text, qr_image_url text, barcode_value text, source_image_url text, source_pdf_url text, cover_color text, status text, created_at timestamp with time zone, updated_at timestamp with time zone, shared_by_user_id uuid, shared_by_nombre text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    pt.id, pt.user_id, pt.plan_id,
    pt.type, pt.title, pt.subtitle,
    pt.from_label, pt.to_label, pt.place_label,
    pt.starts_at, pt.ends_at,
    pt.booking_code, pt.seat_label, pt.gate_label, pt.terminal_label,
    pt.passenger_name, pt.notes, pt.qr_image_url, pt.barcode_value,
    pt.source_image_url, pt.source_pdf_url, pt.cover_color,
    pt.status, pt.created_at, pt.updated_at,
    pt.user_id  AS shared_by_user_id,
    u.nombre    AS shared_by_nombre
  FROM plan_tickets pt
  JOIN usuarios u ON u.id = pt.user_id
  JOIN amistades a
    ON a.estado = 'ACTIVA'
    AND (
      (a.user_id_1 = auth.uid() AND a.user_id_2 = pt.user_id)
      OR
      (a.user_id_2 = auth.uid() AND a.user_id_1 = pt.user_id)
    )
  WHERE pt.type = 'flight'
    AND pt.starts_at <= now()
    AND pt.ends_at   >= now()
$$;


--
-- Name: fn_balances_for_plan(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_balances_for_plan(p_plan_id bigint) RETURNS TABLE(liquidacion_id bigint, from_user_id uuid, from_nombre text, from_profile_image text, to_user_id uuid, to_nombre text, to_profile_image text, importe numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
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
$$;


--
-- Name: fn_bot_message_insert(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_bot_message_insert(p_chat_id uuid, p_texto text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chat_miembro
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  INSERT INTO mensajes (chat_id, sender_id, texto, tipo)
  VALUES (p_chat_id, null, p_texto, 'bot')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: fn_calendar_sync_state_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_calendar_sync_state_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: fn_calendar_sync_state_upsert(boolean, boolean, text, text, timestamp with time zone, timestamp with time zone, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_calendar_sync_state_upsert(p_sync_enabled_snapshot boolean, p_export_plans_snapshot boolean, p_last_status text, p_last_error text DEFAULT NULL::text, p_last_started_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_last_finished_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_last_imported_count integer DEFAULT 0, p_last_exported_count integer DEFAULT 0, p_last_calendars_count integer DEFAULT 0) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


--
-- Name: fn_chat_add_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_chat_add_member(p_chat_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_chat_nombre text;
  v_grupo_id    bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chat_miembro
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No eres miembro de este chat';
  END IF;

  INSERT INTO chat_miembro (chat_id, user_id)
  VALUES (p_chat_id, p_user_id)
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  SELECT nombre INTO v_chat_nombre
  FROM chat WHERE id = p_chat_id AND tipo = 'GRUPO';

  IF FOUND AND v_chat_nombre IS NOT NULL THEN
    SELECT id INTO v_grupo_id FROM grupos WHERE nombre = v_chat_nombre LIMIT 1;
    IF v_grupo_id IS NOT NULL THEN
      INSERT INTO miembros_grupo (grupo_id, user_id, rol, estado)
      VALUES (v_grupo_id, p_user_id, 'BASICO', 'ACTIVO')
      ON CONFLICT (grupo_id, user_id) DO UPDATE SET estado = 'ACTIVO';
    END IF;
  END IF;
END; $$;


--
-- Name: fn_chat_add_miembro(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_chat_add_miembro(p_chat_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Solo miembros existentes pueden añadir
  IF NOT EXISTS (
    SELECT 1 FROM chat_miembro WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No eres miembro de este chat';
  END IF;

  INSERT INTO chat_miembro (chat_id, user_id)
  VALUES (p_chat_id, p_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;


--
-- Name: fn_chat_create_grupo(text, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_chat_create_grupo(p_nombre text, p_foto text DEFAULT NULL::text, p_miembros uuid[] DEFAULT '{}'::uuid[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_chat_id uuid;
  v_miembro uuid;
BEGIN
  INSERT INTO chat (tipo, nombre, foto) VALUES ('GRUPO', p_nombre, p_foto)
  RETURNING id INTO v_chat_id;

  -- Añadir al creador
  INSERT INTO chat_miembro (chat_id, user_id) VALUES (v_chat_id, auth.uid());

  -- Añadir el resto de miembros
  FOREACH v_miembro IN ARRAY p_miembros LOOP
    IF v_miembro <> auth.uid() THEN
      INSERT INTO chat_miembro (chat_id, user_id) VALUES (v_chat_id, v_miembro)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_chat_id;
END;
$$;


--
-- Name: fn_chat_get_miembros(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_chat_get_miembros(p_chat_id uuid) RETURNS TABLE(id uuid, nombre text, username text, profile_image text, joined_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT u.id, u.nombre, u.username, u.profile_image, cm.joined_at
  FROM chat_miembro cm
  JOIN usuarios u ON u.id = cm.user_id AND u.deleted_at IS NULL
  WHERE cm.chat_id = p_chat_id
    AND EXISTS (
      SELECT 1 FROM chat_miembro
      WHERE chat_id = p_chat_id AND user_id = auth.uid()
    );
$$;


--
-- Name: fn_chat_get_or_create_directo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_chat_get_or_create_directo(p_other_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_chat_id uuid;
BEGIN
  -- Buscar si ya existe un chat directo entre los dos usuarios
  SELECT cm1.chat_id INTO v_chat_id
  FROM chat_miembro cm1
  JOIN chat_miembro cm2 ON cm1.chat_id = cm2.chat_id
  JOIN chat c ON c.id = cm1.chat_id
  WHERE cm1.user_id = auth.uid()
    AND cm2.user_id = p_other_user_id
    AND c.tipo = 'DIRECTO';

  IF v_chat_id IS NOT NULL THEN
    RETURN v_chat_id;
  END IF;

  -- Crear chat nuevo
  INSERT INTO chat (tipo) VALUES ('DIRECTO') RETURNING id INTO v_chat_id;

  -- Añadir ambos miembros
  INSERT INTO chat_miembro (chat_id, user_id) VALUES
    (v_chat_id, auth.uid()),
    (v_chat_id, p_other_user_id);

  RETURN v_chat_id;
END;
$$;


--
-- Name: fn_chat_leave(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_chat_leave(p_chat_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_chat_nombre text;
  v_grupo_id    bigint;
  v_new_admin   uuid;
BEGIN
  -- 1. Si es un grupo, gestionar admin antes de salir de miembros_grupo
  SELECT nombre INTO v_chat_nombre
  FROM chat
  WHERE id = p_chat_id AND tipo = 'GRUPO';

  IF FOUND AND v_chat_nombre IS NOT NULL THEN
    SELECT id INTO v_grupo_id FROM grupos WHERE nombre = v_chat_nombre LIMIT 1;

    IF v_grupo_id IS NOT NULL THEN
      -- Si soy el último ADMIN, promover a otro miembro aleatoriamente
      IF (
        SELECT COUNT(*) FROM miembros_grupo
        WHERE grupo_id = v_grupo_id AND rol = 'ADMIN' AND estado = 'ACTIVO'
      ) = 1
      AND EXISTS (
        SELECT 1 FROM miembros_grupo
        WHERE grupo_id = v_grupo_id AND user_id = auth.uid() AND rol = 'ADMIN'
      ) THEN
        SELECT user_id INTO v_new_admin
        FROM miembros_grupo
        WHERE grupo_id = v_grupo_id
          AND user_id <> auth.uid()
          AND estado = 'ACTIVO'
        ORDER BY random()
        LIMIT 1;

        IF v_new_admin IS NOT NULL THEN
          UPDATE miembros_grupo SET rol = 'ADMIN'
          WHERE grupo_id = v_grupo_id AND user_id = v_new_admin;
        END IF;
      END IF;

      DELETE FROM miembros_grupo
      WHERE grupo_id = v_grupo_id AND user_id = auth.uid();
    END IF;
  END IF;

  -- 2. Salir del chat de mensajería
  DELETE FROM chat_miembro
  WHERE chat_id = p_chat_id AND user_id = auth.uid();
END; $$;


--
-- Name: fn_chat_mark_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_chat_mark_read(p_chat_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  UPDATE chat_miembro
  SET last_read_at = now()
  WHERE chat_id = p_chat_id AND user_id = auth.uid();
$$;


--
-- Name: fn_chat_mis_reacciones(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_chat_mis_reacciones(p_chat_id uuid) RETURNS TABLE(mensaje_id bigint, emoji text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT mr.mensaje_id, mr.emoji
  FROM mensaje_reacciones mr
  JOIN mensajes m ON m.id = mr.mensaje_id
  WHERE m.chat_id  = p_chat_id
    AND mr.user_id = auth.uid();
END; $$;


--
-- Name: fn_chat_update_foto(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_chat_update_foto(p_chat_id uuid, p_foto text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chat_miembro
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No eres miembro de este chat';
  END IF;
  UPDATE chat SET foto = p_foto WHERE id = p_chat_id;
END; $$;


--
-- Name: fn_chats_list(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_chats_list() RETURNS TABLE(chat_id uuid, tipo text, nombre text, foto text, last_message text, last_message_at timestamp with time zone, unread_count bigint, miembros jsonb)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    c.id AS chat_id,
    c.tipo::text,
    c.nombre::text,
    c.foto::text,
    c.last_message::text,
    c.last_message_at,
    (
      SELECT COUNT(*)
      FROM mensajes m
      WHERE m.chat_id = c.id
        AND m.created_at > COALESCE(cm_me.last_read_at, '-infinity'::timestamptz)
        AND m.sender_id <> auth.uid()
    ) AS unread_count,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', u.id,
          'nombre', u.nombre,
          'username', u.username,
          'profile_image', u.profile_image
        ))
        FROM chat_miembro cm_all
        JOIN usuarios u ON u.id = cm_all.user_id AND u.deleted_at IS NULL
        WHERE cm_all.chat_id = c.id
      ),
      '[]'::jsonb
    ) AS miembros
  FROM chat c
  JOIN chat_miembro cm_me ON cm_me.chat_id = c.id AND cm_me.user_id = auth.uid()
  ORDER BY c.last_message_at DESC NULLS LAST;
$$;


--
-- Name: fn_cron_recordatorios_deuda(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_cron_recordatorios_deuda() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_dia int;
  v_templates text[];
  v_idx int;
  v_mensaje text;
  v_importe_txt text;
  r RECORD;
BEGIN
  FOREACH v_dia IN ARRAY ARRAY[3, 7, 30] LOOP

    v_templates := CASE v_dia
      WHEN 3 THEN ARRAY[
        'Han pasado 3 dias desde %s y aun tienes %s pendientes con tus companeros de viaje.',
        'Volviste de %s hace 3 dias. Aun quedan %s por saldar con el grupo.',
        'El viaje a %s fue hace 3 dias. No olvides los %s que aun debes.'
      ]
      WHEN 7 THEN ARRAY[
        'Una semana ya desde %s y tus companeros siguen esperando los %s que les debes.',
        'Siete dias desde %s. Los %s pendientes no se van a pagar solos.',
        'Ya va una semana desde %s. Tus %s pendientes tambien cuentan los dias.'
      ]
      ELSE ARRAY[
        'Un mes entero desde %s y los %s que debes siguen vivos. Esto ya es historia.',
        'Hace un mes volviste de %s. Los %s pendientes llevan el mismo tiempo esperando.',
        'Treinta dias desde %s. Tus companeros ya no lo dicen, pero los %s siguen ahi.'
      ]
    END;

    FOR r IN
      SELECT
        l.plan_id,
        l.from_user_id AS deudor_id,
        SUM(l.importe) AS total_deuda,
        p.titulo AS plan_titulo
      FROM liquidaciones l
      JOIN plan p ON p.id = l.plan_id
      WHERE l.estado = 'PENDIENTE'
        AND p.deleted_at IS NULL
        AND DATE(p.fin_at AT TIME ZONE 'UTC') + v_dia = CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM recordatorios_deuda_enviados rde
          WHERE rde.plan_id = l.plan_id
            AND rde.user_id = l.from_user_id
            AND rde.dia = v_dia
        )
      GROUP BY l.plan_id, l.from_user_id, p.titulo
    LOOP
      v_importe_txt := TO_CHAR(r.total_deuda, 'FM999990.00') || '€';
      v_idx := 1 + (floor(random() * 3))::int;
      v_mensaje := format(v_templates[v_idx], r.plan_titulo, v_importe_txt);

      INSERT INTO notificaciones (user_id, tipo, actor_id, entity_id, entity_type, leida, created_at)
      VALUES (
        r.deudor_id,
        'recordatorio_deuda',
        NULL,
        json_build_object(
          'mensaje',     v_mensaje,
          'plan_id',     r.plan_id,
          'plan_titulo', r.plan_titulo,
          'importe',     r.total_deuda,
          'dia',         v_dia
        )::text,
        'plan',
        false,
        NOW()
      );

      INSERT INTO recordatorios_deuda_enviados (plan_id, user_id, dia)
      VALUES (r.plan_id, r.deudor_id, v_dia)
      ON CONFLICT DO NOTHING;
    END LOOP;

  END LOOP;
END;
$$;


--
-- Name: fn_cron_resumen_post_viaje(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_cron_resumen_post_viaje() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM plan
    WHERE fin_at < NOW()
      AND resumen_enviado = false
      AND deleted_at IS NULL
  LOOP
    PERFORM fn_resumen_post_viaje(r.id);
  END LOOP;
END;
$$;


--
-- Name: fn_debug2(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_debug2(p_plan_id bigint) RETURNS TABLE(gp_total bigint, gastos_total bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM gasto_partes),
    (SELECT COUNT(*) FROM gastos WHERE plan_id = p_plan_id);
END;
$$;


--
-- Name: fn_debug3(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_debug3(p_plan_id bigint) RETURNS TABLE(gasto_id bigint, gp_user_id uuid, pagado_por uuid, amt numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, gp.user_id, g.pagado_por_user_id, gp.importe
  FROM gastos g
  JOIN gasto_partes gp ON gp.gasto_id = g.id
  WHERE g.plan_id = p_plan_id;
END;
$$;


--
-- Name: fn_debug4(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_debug4(p_plan_id bigint) RETURNS TABLE(debtor_id uuid, creditor_id uuid, amt numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT gp.user_id, g.pagado_por_user_id, gp.importe
  FROM gastos g
  JOIN gasto_partes gp ON gp.gasto_id = g.id
  WHERE g.plan_id = p_plan_id
    AND g.estado::text != 'ANULADO'
    AND gp.user_id != g.pagado_por_user_id;
END;
$$;


--
-- Name: fn_evento_delete(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_evento_delete(p_event_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM evento WHERE id = p_event_id AND owner_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento % no encontrado o no autorizado', p_event_id; END IF;
END; $$;


--
-- Name: fn_evento_insert_local(text, text, text, timestamp with time zone, timestamp with time zone, boolean, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_evento_insert_local(p_title text, p_description text DEFAULT NULL::text, p_category text DEFAULT 'OTRO'::text, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_all_day boolean DEFAULT false, p_color text DEFAULT NULL::text, p_location_name text DEFAULT NULL::text, p_location_address text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


--
-- Name: fn_evento_list_by_range(uuid, timestamp with time zone, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_evento_list_by_range(p_user_id uuid, p_range_start_at timestamp with time zone, p_range_end_at timestamp with time zone, p_limit integer DEFAULT 500) RETURNS TABLE(id bigint, created_at timestamp with time zone, updated_at timestamp with time zone, owner_user_id uuid, creado_por_user_id uuid, titulo text, descripcion text, categoria text, inicio_at timestamp with time zone, fin_at timestamp with time zone, all_day boolean, color text, ubicacion_nombre text, ubicacion_direccion text, source text, google_calendar_id text, google_event_id text, sync_status text)
    LANGUAGE sql STABLE
    AS $$
  select
    e.id,
    e.created_at,
    e.updated_at,
    e.owner_user_id,
    e.creado_por_user_id,
    e.titulo,
    e.descripcion,
    e.categoria,
    e.inicio_at,
    e.fin_at,
    e.all_day,
    e.color,
    e.ubicacion_nombre,
    e.ubicacion_direccion,
    e.source,
    e.google_calendar_id,
    e.google_event_id,
    e.sync_status
  from public.evento e
  where auth.uid() = p_user_id
    and e.owner_user_id = p_user_id
    and e.deleted_at is null
    and e.estado = 'ACTIVO'
    and e.inicio_at <= p_range_end_at
    and e.fin_at >= p_range_start_at
  order by e.inicio_at asc
  limit greatest(1, least(coalesce(p_limit, 500), 2000));
$$;


--
-- Name: fn_evento_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_evento_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: fn_evento_update_sync_info(bigint, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_evento_update_sync_info(p_event_id bigint, p_google_calendar_id text, p_google_event_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE evento SET
    google_calendar_id = p_google_calendar_id, google_event_id = p_google_event_id,
    last_synced_at = NOW(), sync_status = 'SYNCED', sync_error = NULL
  WHERE id = p_event_id AND owner_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento % no encontrado o no autorizado', p_event_id; END IF;
END; $$;


--
-- Name: fn_eventos_delete_batch(bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_eventos_delete_batch(p_event_ids bigint[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM evento WHERE id = ANY(p_event_ids) AND owner_user_id = auth.uid();
END; $$;


--
-- Name: fn_eventos_get_google_for_sync(timestamp with time zone, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_eventos_get_google_for_sync(p_time_min timestamp with time zone, p_time_max timestamp with time zone, p_limit integer DEFAULT 3000) RETURNS TABLE(id bigint, google_calendar_id text, google_event_id text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.google_calendar_id::text, e.google_event_id::text FROM evento e
  WHERE e.owner_user_id = auth.uid() AND e.source = 'GOOGLE' AND e.deleted_at IS NULL
    AND e.inicio_at <= p_time_max AND e.fin_at >= p_time_min
  LIMIT p_limit;
END; $$;


--
-- Name: fn_eventos_upsert_google_batch(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_eventos_upsert_google_batch(p_events jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


--
-- Name: fn_friend_remove(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_friend_remove(p_other_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM amistades
  WHERE estado = 'ACTIVA'
    AND (
      (user_id_1 = auth.uid() AND user_id_2 = p_other_user_id)
      OR
      (user_id_2 = auth.uid() AND user_id_1 = p_other_user_id)
    );
END;
$$;


--
-- Name: fn_friend_request_accept(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_friend_request_accept(p_requester_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_user1 uuid;
  v_user2 uuid;
BEGIN
  IF v_uid < p_requester_user_id THEN
    v_user1 := v_uid;  v_user2 := p_requester_user_id;
  ELSE
    v_user1 := p_requester_user_id;  v_user2 := v_uid;
  END IF;

  UPDATE amistades
  SET estado = 'ACTIVA'
  WHERE user_id_1 = v_user1
    AND user_id_2 = v_user2
    AND estado = 'PENDIENTE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  -- Eliminar la notificación de solicitud recibida (ya no es accionable)
  DELETE FROM notificaciones
  WHERE user_id = v_uid
    AND tipo = 'friend_request'
    AND actor_id = p_requester_user_id;

  -- Notificar al que envió la solicitud
  INSERT INTO notificaciones (user_id, tipo, actor_id, entity_type)
  VALUES (p_requester_user_id, 'friend_accept', v_uid, 'friendship');
END; $$;


--
-- Name: fn_friend_request_cancel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_friend_request_cancel(p_target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM amistades
  WHERE estado = 'PENDIENTE'
    AND (
      (user_id_1 = auth.uid() AND user_id_2 = p_target_user_id)
      OR
      (user_id_2 = auth.uid() AND user_id_1 = p_target_user_id)
    );
END;
$$;


--
-- Name: fn_friend_request_reject(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_friend_request_reject(p_requester_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_user1 uuid;
  v_user2 uuid;
BEGIN
  IF v_uid < p_requester_user_id THEN
    v_user1 := v_uid;  v_user2 := p_requester_user_id;
  ELSE
    v_user1 := p_requester_user_id;  v_user2 := v_uid;
  END IF;

  DELETE FROM amistades
  WHERE user_id_1 = v_user1
    AND user_id_2 = v_user2
    AND estado = 'PENDIENTE';

  -- Eliminar la notificación de solicitud recibida
  DELETE FROM notificaciones
  WHERE user_id = v_uid
    AND tipo = 'friend_request'
    AND actor_id = p_requester_user_id;
END; $$;


--
-- Name: fn_friend_request_send(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_friend_request_send(p_target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_user1 uuid;
  v_user2 uuid;
BEGIN
  IF v_uid = p_target_user_id THEN
    RAISE EXCEPTION 'No puedes añadirte a ti mismo como amigo';
  END IF;

  IF v_uid < p_target_user_id THEN
    v_user1 := v_uid;  v_user2 := p_target_user_id;
  ELSE
    v_user1 := p_target_user_id;  v_user2 := v_uid;
  END IF;

  INSERT INTO amistades (user_id_1, user_id_2, estado)
  VALUES (v_user1, v_user2, 'PENDIENTE')
  ON CONFLICT (user_id_1, user_id_2) DO NOTHING;

  -- Notificar al destinatario solo si se creó la fila
  IF FOUND THEN
    INSERT INTO notificaciones (user_id, tipo, actor_id, entity_type)
    VALUES (p_target_user_id, 'friend_request', v_uid, 'friendship');
  END IF;
END; $$;


--
-- Name: fn_friends_list_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_friends_list_active() RETURNS TABLE(id uuid, nombre text, username text, profile_image text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN a.user_id_1 = v_uid THEN a.user_id_2 ELSE a.user_id_1 END AS id,
    u.nombre::text,
    u.username::text,
    u.profile_image::text
  FROM amistades a
  JOIN usuarios u ON u.id = CASE WHEN a.user_id_1 = v_uid THEN a.user_id_2 ELSE a.user_id_1 END
  WHERE (a.user_id_1 = v_uid OR a.user_id_2 = v_uid)
    AND a.estado = 'ACTIVA'
  ORDER BY u.nombre ASC;
END;
$$;


--
-- Name: fn_friendship_statuses(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_friendship_statuses(p_user_ids uuid[]) RETURNS TABLE(other_user_id uuid, status text)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT
    u_id AS other_user_id,
    COALESCE(
      (
        SELECT
          CASE
            WHEN a.estado = 'ACTIVA'    THEN 'friends'
            WHEN a.estado = 'PENDIENTE' THEN 'pending'
            ELSE 'none'
          END
        FROM amistades a
        WHERE (
          (a.user_id_1 = auth.uid() AND a.user_id_2 = u_id)
          OR
          (a.user_id_2 = auth.uid() AND a.user_id_1 = u_id)
        )
        LIMIT 1
      ),
      'none'
    ) AS status
  FROM unnest(p_user_ids) AS u_id;
$$;


--
-- Name: fn_gasto_anular(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_gasto_anular(p_gasto_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
DECLARE v_plan_id bigint;
BEGIN
  SELECT plan_id INTO v_plan_id FROM gastos WHERE id = p_gasto_id AND deleted_at IS NULL
    AND plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid());
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'Gasto no encontrado o sin acceso'; END IF;
  UPDATE gastos SET estado = 'ANULADO', deleted_at = now(), updated_at = now() WHERE id = p_gasto_id;
  DELETE FROM gasto_item_usuarios WHERE gasto_item_id IN (SELECT id FROM gasto_items WHERE gasto_id = p_gasto_id);
  DELETE FROM gasto_items WHERE gasto_id = p_gasto_id;
  DELETE FROM gasto_partes WHERE gasto_id = p_gasto_id;
  PERFORM fn_liquidaciones_recalculate_for_plan(v_plan_id);
END;
$$;


--
-- Name: fn_gasto_create(bigint, text, uuid, timestamp with time zone, numeric, public.metodo_reparto, jsonb, text, bigint, bigint, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_gasto_create(p_plan_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text DEFAULT NULL::text, p_subplan_id bigint DEFAULT NULL::bigint, p_categoria_id bigint DEFAULT NULL::bigint, p_moneda text DEFAULT 'EUR'::text, p_items jsonb DEFAULT NULL::jsonb) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
DECLARE v_gasto_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'No eres miembro de este plan';
  END IF;
  INSERT INTO gastos (plan_id, subplan_id, titulo, descripcion, created_by_user_id, pagado_por_user_id, fecha_gasto, total, moneda, metodo_reparto, categoria_id, estado)
  VALUES (p_plan_id, p_subplan_id, p_titulo, p_descripcion, auth.uid(), p_pagado_por_user_id, p_fecha_gasto, p_total, p_moneda::char(3), p_metodo_reparto, p_categoria_id, 'CONFIRMADO')
  RETURNING id INTO v_gasto_id;
  PERFORM fn_gasto_insert_partes(v_gasto_id, p_pagado_por_user_id, p_total, p_metodo_reparto, p_participantes, p_items);
  PERFORM fn_liquidaciones_recalculate_for_plan(p_plan_id);
  RETURN v_gasto_id;
END;
$$;


--
-- Name: fn_gasto_create(bigint, text, uuid, timestamp with time zone, numeric, public.metodo_reparto, jsonb, text, bigint, bigint, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_gasto_create(p_plan_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text DEFAULT NULL::text, p_subplan_id bigint DEFAULT NULL::bigint, p_categoria_id bigint DEFAULT NULL::bigint, p_moneda text DEFAULT 'EUR'::text, p_items jsonb DEFAULT NULL::jsonb, p_receipt_url text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
DECLARE v_gasto_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'No eres miembro de este plan';
  END IF;
  INSERT INTO gastos (plan_id, subplan_id, titulo, descripcion, created_by_user_id, pagado_por_user_id, fecha_gasto, total, moneda, metodo_reparto, categoria_id, estado, receipt_url)
  VALUES (p_plan_id, p_subplan_id, p_titulo, p_descripcion, auth.uid(), p_pagado_por_user_id, p_fecha_gasto, p_total, p_moneda::char(3), p_metodo_reparto, p_categoria_id, 'CONFIRMADO', p_receipt_url)
  RETURNING id INTO v_gasto_id;
  PERFORM fn_gasto_insert_partes(v_gasto_id, p_pagado_por_user_id, p_total, p_metodo_reparto, p_participantes, p_items);
  PERFORM fn_liquidaciones_recalculate_for_plan(p_plan_id);
  RETURN v_gasto_id;
END;
$$;


--
-- Name: fn_gasto_insert_partes(bigint, uuid, numeric, public.metodo_reparto, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_gasto_insert_partes(p_gasto_id bigint, p_pagado_por_user_id uuid, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_items jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
DECLARE
  v_parte jsonb; v_item jsonb; v_usuario jsonb; v_item_id bigint;
  v_importe numeric; v_count int; v_user_id uuid;
  v_key text; v_val numeric; v_user_map jsonb := '{}';
BEGIN
  IF p_metodo_reparto = 'IGUAL' THEN
    v_count := jsonb_array_length(p_participantes);
    IF v_count > 0 THEN
      v_importe := ROUND(p_total / v_count, 2);
      FOR v_parte IN SELECT value FROM jsonb_array_elements(p_participantes) LOOP
        v_user_id := (v_parte->>'user_id')::uuid;
        IF v_user_id != p_pagado_por_user_id THEN
          INSERT INTO gasto_partes (gasto_id, user_id, importe, fuente) VALUES (p_gasto_id, v_user_id, v_importe, 'AUTO');
        END IF;
      END LOOP;
    END IF;
  ELSIF p_metodo_reparto = 'CANTIDAD' THEN
    FOR v_parte IN SELECT value FROM jsonb_array_elements(p_participantes) LOOP
      v_user_id := (v_parte->>'user_id')::uuid;
      v_importe  := COALESCE((v_parte->>'importe')::numeric, 0);
      IF v_user_id != p_pagado_por_user_id AND v_importe > 0 THEN
        INSERT INTO gasto_partes (gasto_id, user_id, importe, fuente) VALUES (p_gasto_id, v_user_id, v_importe, 'AUTO');
      END IF;
    END LOOP;
  ELSIF p_metodo_reparto = 'PORCENTAJE' THEN
    FOR v_parte IN SELECT value FROM jsonb_array_elements(p_participantes) LOOP
      v_user_id := (v_parte->>'user_id')::uuid;
      v_importe  := ROUND(p_total * COALESCE((v_parte->>'porcentaje')::numeric, 0) / 100, 2);
      IF v_user_id != p_pagado_por_user_id AND v_importe > 0 THEN
        INSERT INTO gasto_partes (gasto_id, user_id, importe, fuente) VALUES (p_gasto_id, v_user_id, v_importe, 'AUTO');
      END IF;
    END LOOP;
  ELSIF p_metodo_reparto = 'POR_ITEMS' AND p_items IS NOT NULL THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
      INSERT INTO gasto_items (gasto_id, nombre, cantidad, precio_unitario, subtotal)
      VALUES (p_gasto_id, v_item->>'nombre', (v_item->>'cantidad')::numeric, (v_item->>'precio_unitario')::numeric, (v_item->>'subtotal')::numeric)
      RETURNING id INTO v_item_id;
      FOR v_usuario IN SELECT value FROM jsonb_array_elements(v_item->'usuarios') LOOP
        INSERT INTO gasto_item_usuarios (gasto_item_id, user_id, subtotal_asignado)
        VALUES (v_item_id, (v_usuario->>'user_id')::uuid, (v_usuario->>'subtotal_asignado')::numeric);
        v_key := v_usuario->>'user_id';
        v_val := COALESCE((v_user_map->>v_key)::numeric, 0) + (v_usuario->>'subtotal_asignado')::numeric;
        v_user_map := jsonb_set(v_user_map, ARRAY[v_key], to_jsonb(v_val));
      END LOOP;
    END LOOP;
    FOR v_key, v_val IN SELECT key, value::numeric FROM jsonb_each_text(v_user_map) LOOP
      IF v_key::uuid != p_pagado_por_user_id AND v_val > 0 THEN
        INSERT INTO gasto_partes (gasto_id, user_id, importe, fuente) VALUES (p_gasto_id, v_key::uuid, v_val, 'AUTO');
      END IF;
    END LOOP;
  END IF;
END;
$$;


--
-- Name: fn_gasto_update(bigint, text, uuid, timestamp with time zone, numeric, public.metodo_reparto, jsonb, text, bigint, bigint, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_gasto_update(p_gasto_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text DEFAULT NULL::text, p_subplan_id bigint DEFAULT NULL::bigint, p_categoria_id bigint DEFAULT NULL::bigint, p_moneda text DEFAULT 'EUR'::text, p_items jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
DECLARE v_plan_id bigint;
BEGIN
  SELECT plan_id INTO v_plan_id FROM gastos WHERE id = p_gasto_id AND deleted_at IS NULL
    AND plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid());
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'Gasto no encontrado o sin acceso'; END IF;
  UPDATE gastos SET titulo = p_titulo, descripcion = p_descripcion, pagado_por_user_id = p_pagado_por_user_id,
    fecha_gasto = p_fecha_gasto, total = p_total, moneda = p_moneda::char(3),
    metodo_reparto = p_metodo_reparto, categoria_id = p_categoria_id, subplan_id = p_subplan_id, updated_at = now()
  WHERE id = p_gasto_id;
  DELETE FROM gasto_item_usuarios WHERE gasto_item_id IN (SELECT id FROM gasto_items WHERE gasto_id = p_gasto_id);
  DELETE FROM gasto_items WHERE gasto_id = p_gasto_id;
  DELETE FROM gasto_partes WHERE gasto_id = p_gasto_id;
  PERFORM fn_gasto_insert_partes(p_gasto_id, p_pagado_por_user_id, p_total, p_metodo_reparto, p_participantes, p_items);
  PERFORM fn_liquidaciones_recalculate_for_plan(v_plan_id);
END;
$$;


--
-- Name: fn_gastos_list_for_plan(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_gastos_list_for_plan(p_plan_id bigint) RETURNS TABLE(id bigint, titulo text, descripcion text, total numeric, moneda text, fecha_gasto timestamp with time zone, metodo_reparto text, categoria_id bigint, categoria_nombre text, categoria_icono text, categoria_color text, estado text, subplan_id bigint, subplan_titulo text, pagado_por_user_id uuid, pagado_por_nombre text, pagado_por_foto text, partes jsonb, created_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: fn_get_or_create_plan_chat(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_or_create_plan_chat(p_plan_id bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_chat_id uuid;
  v_titulo  text;
BEGIN
  -- Get existing chat
  SELECT id INTO v_chat_id
  FROM chat
  WHERE plan_id = p_plan_id AND tipo = 'PLAN'
  LIMIT 1;

  -- Create if missing
  IF v_chat_id IS NULL THEN
    SELECT titulo INTO v_titulo FROM plan WHERE id = p_plan_id;
    INSERT INTO chat (tipo, nombre, plan_id)
    VALUES ('PLAN', v_titulo, p_plan_id)
    RETURNING id INTO v_chat_id;
  END IF;

  -- Ensure caller is a member
  INSERT INTO chat_miembro (chat_id, user_id, joined_at)
  VALUES (v_chat_id, auth.uid(), now())
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  -- Ensure all plan members are chat members
  INSERT INTO chat_miembro (chat_id, user_id, joined_at)
  SELECT v_chat_id, pu.user_id, now()
  FROM plan_usuarios pu
  WHERE pu.plan_id = p_plan_id
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  RETURN v_chat_id;
END;
$$;


--
-- Name: fn_get_pending_plan_invite_user_ids(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_pending_plan_invite_user_ids(p_plan_id bigint) RETURNS uuid[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM plan_usuarios
    WHERE plan_id = p_plan_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this plan';
  END IF;

  RETURN ARRAY(
    SELECT user_id::uuid
    FROM notificaciones
    WHERE tipo = 'plan_invite'
      AND entity_id = p_plan_id::text
  );
END;
$$;


--
-- Name: fn_get_plan_by_join_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_plan_by_join_code(p_join_code text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result json;
BEGIN
  SELECT row_to_json(r) INTO v_result
  FROM (
    SELECT
      p.id, p.created_at, p.titulo, p.descripcion, p.visibilidad,
      p.inicio_at, p.fin_at, p.all_day, p.ubicacion_nombre, p.foto_portada,
      p.owner_user_id, p.creado_por_user_id, p.join_code,
      u.nombre AS creador_nombre, u.profile_image AS creador_profile_image
    FROM planes p
    LEFT JOIN usuarios u ON u.id = p.creado_por_user_id
    WHERE p.join_code = p_join_code
      AND p.deleted_at IS NULL
      AND p.estado = 'ACTIVO'
    LIMIT 1
  ) r;
  RETURN v_result;
END;
$$;


--
-- Name: fn_get_plan_chat_id(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_plan_chat_id(p_plan_id bigint) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id::text FROM chat WHERE plan_id = p_plan_id LIMIT 1;
$$;


--
-- Name: fn_get_plan_member_ids(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_plan_member_ids(p_plan_id bigint) RETURNS TABLE(user_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT pu.user_id FROM plan_usuarios pu
  WHERE pu.plan_id = p_plan_id AND pu.estado = 'PARTICIPA';
END;
$$;


--
-- Name: fn_get_plan_user_rol(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_plan_user_rol(p_plan_id bigint, p_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT rol::text FROM plan_usuarios
  WHERE plan_id = p_plan_id AND user_id = p_user_id;
$$;


--
-- Name: fn_grupo_add_member(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_grupo_add_member(p_grupo_id bigint, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM miembros_grupo
    WHERE grupo_id = p_grupo_id
      AND user_id  = auth.uid()
      AND rol      = 'ADMIN'
      AND estado   = 'ACTIVO'
  ) THEN
    RAISE EXCEPTION 'No tienes permisos de administrador en este grupo';
  END IF;

  INSERT INTO miembros_grupo (grupo_id, user_id, rol, estado)
  VALUES (p_grupo_id, p_user_id, 'BASICO'::rol_grupo, 'ACTIVO'::estado_miembro_grupo)
  ON CONFLICT (grupo_id, user_id) DO UPDATE SET estado = 'ACTIVO'::estado_miembro_grupo;
END; $$;


--
-- Name: fn_grupo_create(text, text, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_grupo_create(p_nombre text, p_visibilidad text, p_imagen text DEFAULT NULL::text, p_miembros uuid[] DEFAULT '{}'::uuid[]) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id  bigint;
  v_uid uuid := auth.uid();
BEGIN
  IF trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre del grupo no puede estar vacío';
  END IF;

  INSERT INTO grupos (nombre, visibilidad, creado_por_user_id, imagen)
  VALUES (trim(p_nombre), p_visibilidad::visibilidad_grupo, v_uid, nullif(trim(p_imagen), ''))
  RETURNING id INTO v_id;

  -- Añadir miembros iniciales (excluyendo al creador, que ya lo añade el trigger)
  INSERT INTO miembros_grupo (grupo_id, user_id, rol, estado)
  SELECT v_id, u.id, 'BASICO'::rol_grupo, 'ACTIVO'::estado_miembro_grupo
  FROM unnest(p_miembros) AS u(id)
  WHERE u.id <> v_uid
  ON CONFLICT (grupo_id, user_id) DO NOTHING;

  RETURN v_id;
END; $$;


--
-- Name: fn_join_plan_by_code(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_join_plan_by_code(p_join_code text, p_preview_only boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_plan_id bigint;
  v_plan json;
  v_user_id uuid := auth.uid();
  v_already_member boolean := false;
BEGIN
  SELECT p.id INTO v_plan_id
  FROM plan p
  WHERE p.join_code = p_join_code AND p.deleted_at IS NULL AND p.estado = 'ACTIVO';

  IF v_plan_id IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM plan_usuarios
    WHERE plan_id = v_plan_id AND user_id = v_user_id
  ) INTO v_already_member;

  IF NOT p_preview_only AND NOT v_already_member THEN
    INSERT INTO plan_usuarios (plan_id, user_id, rol, estado)
    VALUES (v_plan_id, v_user_id, 'PARTICIPANTE', 'PARTICIPA')
    ON CONFLICT (plan_id, user_id) DO NOTHING;
  END IF;

  SELECT row_to_json(r) INTO v_plan
  FROM (
    SELECT p.id, p.titulo, p.descripcion, p.visibilidad,
      p.inicio_at, p.fin_at, p.all_day, p.ubicacion_nombre,
      p.foto_portada, p.owner_user_id, p.creado_por_user_id, p.join_code,
      u.nombre AS creador_nombre, u.profile_image AS creador_profile_image
    FROM plan p
    LEFT JOIN usuarios u ON u.id = p.creado_por_user_id
    WHERE p.id = v_plan_id
  ) r;

  RETURN json_build_object('plan_id', v_plan_id, 'plan', v_plan, 'already_member', v_already_member);
END;
$$;


--
-- Name: fn_liquidacion_pagar(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_liquidacion_pagar(p_liquidacion_id bigint, p_comprobante_url text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE liquidaciones 
  SET estado = 'CONFIRMADA',
      comprobante_url = p_comprobante_url,
      fecha = now()
  WHERE id = p_liquidacion_id 
    AND from_user_id = auth.uid() 
    AND estado = 'PENDIENTE';
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Liquidacion % no encontrada o no autorizada', p_liquidacion_id; 
  END IF;
END;
$$;


--
-- Name: fn_liquidaciones_list_for_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_liquidaciones_list_for_user() RETURNS TABLE(id bigint, plan_id bigint, plan_titulo text, from_user_id uuid, to_user_id uuid, importe numeric, fecha timestamp with time zone, nota text, estado text, counterparty_id uuid, counterparty_nombre text, counterparty_username text, counterparty_profile_image text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.plan_id, p.titulo::text,
    l.from_user_id, l.to_user_id, l.importe,
    l.fecha, l.nota::text, l.estado::text,
    CASE WHEN l.from_user_id = v_uid THEN l.to_user_id ELSE l.from_user_id END,
    u.nombre::text, u.username::text, u.profile_image::text
  FROM liquidaciones l
  LEFT JOIN plan p ON p.id = l.plan_id
  LEFT JOIN usuarios u ON u.id = CASE WHEN l.from_user_id = v_uid THEN l.to_user_id ELSE l.from_user_id END
  WHERE (l.from_user_id = v_uid OR l.to_user_id = v_uid)
    AND l.estado IN ('PENDIENTE','EN_REVISION','CONFIRMADA')
  ORDER BY l.fecha DESC;
END;
$$;


--
-- Name: fn_liquidaciones_recalculate_for_plan(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_liquidaciones_recalculate_for_plan(p_plan_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
DECLARE
  v_user_a uuid; v_user_b uuid;
  v_a_bruto_b numeric; v_b_bruto_a numeric;
  v_a_pagado_b numeric; v_b_pagado_a numeric;
  v_neto numeric;
BEGIN
  -- Limpiar PENDIENTES antes de recalcular (nunca dejar duplicados)
  DELETE FROM liquidaciones WHERE plan_id = p_plan_id AND estado = 'PENDIENTE';

  FOR v_user_a, v_user_b IN
    SELECT LEAST(pu1.user_id::text, pu2.user_id::text)::uuid,
           GREATEST(pu1.user_id::text, pu2.user_id::text)::uuid
    FROM plan_usuarios pu1
    JOIN plan_usuarios pu2 ON pu1.plan_id = pu2.plan_id
    WHERE pu1.plan_id = p_plan_id AND pu1.user_id::text < pu2.user_id::text
  LOOP
    SELECT COALESCE(SUM(gp.importe), 0) INTO v_a_bruto_b
    FROM gasto_partes gp JOIN gastos g ON g.id = gp.gasto_id
    WHERE g.plan_id = p_plan_id AND g.estado = 'CONFIRMADO' AND g.deleted_at IS NULL
      AND gp.user_id = v_user_a AND g.pagado_por_user_id = v_user_b;

    SELECT COALESCE(SUM(gp.importe), 0) INTO v_b_bruto_a
    FROM gasto_partes gp JOIN gastos g ON g.id = gp.gasto_id
    WHERE g.plan_id = p_plan_id AND g.estado = 'CONFIRMADO' AND g.deleted_at IS NULL
      AND gp.user_id = v_user_b AND g.pagado_por_user_id = v_user_a;

    SELECT COALESCE(SUM(importe), 0) INTO v_a_pagado_b FROM liquidaciones
    WHERE plan_id = p_plan_id AND from_user_id = v_user_a AND to_user_id = v_user_b AND estado = 'CONFIRMADA';

    SELECT COALESCE(SUM(importe), 0) INTO v_b_pagado_a FROM liquidaciones
    WHERE plan_id = p_plan_id AND from_user_id = v_user_b AND to_user_id = v_user_a AND estado = 'CONFIRMADA';

    v_neto := (v_a_bruto_b - v_a_pagado_b) - (v_b_bruto_a - v_b_pagado_a);

    IF v_neto > 0.01 THEN
      INSERT INTO liquidaciones (plan_id, from_user_id, to_user_id, importe, estado)
      VALUES (p_plan_id, v_user_a, v_user_b, v_neto, 'PENDIENTE');
    ELSIF v_neto < -0.01 THEN
      INSERT INTO liquidaciones (plan_id, from_user_id, to_user_id, importe, estado)
      VALUES (p_plan_id, v_user_b, v_user_a, -v_neto, 'PENDIENTE');
    END IF;
  END LOOP;
END;
$$;


--
-- Name: fn_llamada_record(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_llamada_record(p_chat_id uuid, p_tipo text, p_duracion integer DEFAULT NULL::integer) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id      bigint;
  v_preview text;
BEGIN
  INSERT INTO mensajes (chat_id, sender_id, texto, tipo)
  VALUES (
    p_chat_id,
    auth.uid(),
    COALESCE(p_duracion::text, '0'),
    p_tipo
  )
  RETURNING id INTO v_id;

  v_preview :=
    CASE p_tipo
      WHEN 'call_audio'        THEN '📞 Llamada de audio'
      WHEN 'call_video'        THEN '📹 Videollamada'
      WHEN 'call_missed_audio' THEN '📞 Llamada perdida'
      WHEN 'call_missed_video' THEN '📹 Videollamada perdida'
      ELSE '📞 Llamada'
    END;

  UPDATE chat
  SET last_message    = v_preview,
      last_message_at = now()
  WHERE id = p_chat_id;

  RETURN v_id;
END; $$;


--
-- Name: fn_mensaje_delete(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_mensaje_delete(p_mensaje_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM mensajes
  WHERE id        = p_mensaje_id
    AND sender_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar este mensaje';
  END IF;
END; $$;


--
-- Name: fn_mensaje_edit(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_mensaje_edit(p_mensaje_id bigint, p_texto text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF trim(p_texto) = '' THEN
    RAISE EXCEPTION 'El mensaje no puede estar vacío';
  END IF;

  UPDATE mensajes
  SET texto = trim(p_texto)
  WHERE id        = p_mensaje_id
    AND sender_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permiso para editar este mensaje';
  END IF;
END; $$;


--
-- Name: fn_mensaje_react(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_mensaje_react(p_mensaje_id bigint, p_emoji text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF p_emoji = '' THEN
    DELETE FROM mensaje_reacciones
    WHERE mensaje_id = p_mensaje_id AND user_id = auth.uid();
  ELSE
    INSERT INTO mensaje_reacciones (mensaje_id, user_id, emoji)
    VALUES (p_mensaje_id, auth.uid(), p_emoji)
    ON CONFLICT (mensaje_id, user_id)
    DO UPDATE SET emoji = EXCLUDED.emoji;
  END IF;
END; $$;


--
-- Name: fn_mensaje_send(uuid, text, bigint, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_mensaje_send(p_chat_id uuid, p_texto text, p_reply_to_id bigint DEFAULT NULL::bigint, p_audio_url text DEFAULT NULL::text, p_document_url text DEFAULT NULL::text, p_document_name text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_image_type text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id      bigint;
  v_preview text;
BEGIN
  INSERT INTO mensajes (chat_id, sender_id, texto, reply_to_id, audio_url, document_url, document_name, image_url, image_type)
  VALUES (p_chat_id, auth.uid(), trim(p_texto), p_reply_to_id, p_audio_url, p_document_url, p_document_name, p_image_url, p_image_type)
  RETURNING id INTO v_id;

  v_preview :=
    CASE
      WHEN p_audio_url    IS NOT NULL AND trim(p_texto) = '' THEN '🎤 Nota de voz'
      WHEN p_document_url IS NOT NULL AND trim(p_texto) = '' THEN '📄 ' || COALESCE(p_document_name, 'Documento')
      WHEN p_image_url    IS NOT NULL AND trim(p_texto) = '' THEN
        CASE WHEN p_image_type LIKE 'video/%' THEN '🎥 Vídeo' ELSE '📷 Foto' END
      ELSE trim(p_texto)
    END;

  UPDATE chat
  SET last_message    = v_preview,
      last_message_at = now()
  WHERE id = p_chat_id;

  RETURN v_id;
END; $$;


--
-- Name: fn_mensajes_list(uuid, integer, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_mensajes_list(p_chat_id uuid, p_limit integer DEFAULT 30, p_cursor_id bigint DEFAULT NULL::bigint) RETURNS TABLE(id bigint, sender_id uuid, sender_nombre text, sender_profile_image text, texto text, created_at timestamp with time zone, reply_to_id bigint, reply_texto text, reply_sender_nombre text, audio_url text, document_url text, document_name text, image_url text, image_type text, tipo text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: fn_mis_tareas(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_mis_tareas(p_plan_id bigint) RETURNS TABLE(id bigint, titulo text, categoria text, estado text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT t.id, t.titulo::text, t.categoria::text, t.estado::text
  FROM plan_tareas t
  JOIN plan_tareas_asignados a ON a.tarea_id = t.id
  WHERE t.plan_id = p_plan_id AND a.user_id = auth.uid()
  ORDER BY t.created_at;
$$;


--
-- Name: fn_notificaciones_list(integer, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_notificaciones_list(p_limit integer DEFAULT 30, p_cursor bigint DEFAULT NULL::bigint) RETURNS TABLE(id bigint, tipo text, actor_id uuid, actor_nombre text, actor_username text, actor_foto text, entity_id text, entity_type text, leida boolean, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    n.id,
    n.tipo,
    n.actor_id,
    u.nombre       AS actor_nombre,
    u.username     AS actor_username,
    u.profile_image AS actor_foto,
    n.entity_id,
    n.entity_type,
    n.leida,
    n.created_at
  FROM notificaciones n
  LEFT JOIN usuarios u ON u.id = n.actor_id
  WHERE n.user_id = auth.uid()
    AND (p_cursor IS NULL OR n.id < p_cursor)
  ORDER BY n.created_at DESC
  LIMIT p_limit;
$$;


--
-- Name: fn_notificaciones_marcar_leidas(bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_notificaciones_marcar_leidas(p_ids bigint[] DEFAULT NULL::bigint[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE notificaciones
  SET leida = true
  WHERE user_id = auth.uid()
    AND leida   = false
    AND (p_ids IS NULL OR id = ANY(p_ids));
END;
$$;


--
-- Name: fn_notification_preferences_get(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_notification_preferences_get() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_prefs jsonb;
begin
  select notification_preferences
  into v_prefs
  from public.user_settings
  where user_id = auth.uid();

  return coalesce(v_prefs, '{}'::jsonb);
end;
$$;


--
-- Name: fn_notification_preferences_upsert(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_notification_preferences_upsert(p_preferences jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_prefs jsonb;
begin
  insert into public.user_settings (user_id, notification_preferences)
  values (auth.uid(), p_preferences)
  on conflict (user_id)
  do update set notification_preferences = p_preferences;

  select notification_preferences
  into v_prefs
  from public.user_settings
  where user_id = auth.uid();

  return v_prefs;
end;
$$;


--
-- Name: plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan (
    id bigint NOT NULL,
    titulo character varying NOT NULL,
    descripcion text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_user_id uuid,
    owner_group_id bigint,
    creado_por_user_id uuid NOT NULL,
    estado public.estado_plan DEFAULT 'ACTIVO'::public.estado_plan NOT NULL,
    inicio_at timestamp with time zone NOT NULL,
    fin_at timestamp with time zone NOT NULL,
    all_day boolean DEFAULT false NOT NULL,
    visibilidad public.visibilidad_plan DEFAULT 'SOLO_GRUPO'::public.visibilidad_plan NOT NULL,
    deleted_at timestamp with time zone,
    ubicacion_nombre character varying NOT NULL,
    ubicacion_direccion character varying,
    foto_portada text,
    join_code text DEFAULT (gen_random_uuid())::text NOT NULL,
    resumen_enviado boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_plan_owner_exclusive CHECK ((((owner_user_id IS NOT NULL) AND (owner_group_id IS NULL)) OR ((owner_user_id IS NULL) AND (owner_group_id IS NOT NULL)))),
    CONSTRAINT chk_plan_time CHECK ((fin_at >= inicio_at))
);


--
-- Name: fn_plan_create(text, text, timestamp with time zone, timestamp with time zone, text, uuid, uuid, boolean, public.visibilidad_plan, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_plan_create(p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_ubicacion_nombre text, p_owner_user_id uuid, p_creado_por_user_id uuid, p_all_day boolean DEFAULT false, p_visibilidad public.visibilidad_plan DEFAULT 'SOLO_GRUPO'::public.visibilidad_plan, p_ubicacion_direccion text DEFAULT NULL::text, p_foto_portada text DEFAULT NULL::text) RETURNS public.plan
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row public.plan;
begin
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
$$;


--
-- Name: fn_plan_create_chat(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_plan_create_chat(p_plan_id bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_chat_id uuid;
  v_titulo text;
BEGIN
  SELECT id INTO v_chat_id FROM chat WHERE plan_id = p_plan_id;
  IF v_chat_id IS NOT NULL THEN
    RETURN v_chat_id;
  END IF;

  SELECT titulo INTO v_titulo FROM plan WHERE id = p_plan_id;

  INSERT INTO chat (tipo, nombre, plan_id)
  VALUES ('PLAN', v_titulo, p_plan_id)
  RETURNING id INTO v_chat_id;

  INSERT INTO chat_miembro (chat_id, user_id)
  SELECT v_chat_id, user_id
  FROM plan_usuarios
  WHERE plan_id = p_plan_id AND estado = 'PARTICIPA';

  RETURN v_chat_id;
END;
$$;


--
-- Name: fn_plan_demote_admin(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_plan_demote_admin(p_plan_id bigint, p_target_user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_rol text;
  v_target_rol text;
  v_owner_id uuid;
BEGIN
  SELECT rol INTO v_caller_rol FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = v_caller;
  IF v_caller_rol IS NULL THEN RETURN 'not_member'; END IF;
  IF v_caller_rol != 'ADMIN' THEN RETURN 'not_admin'; END IF;
  IF v_caller = p_target_user_id THEN RETURN 'cannot_demote_self'; END IF;
  SELECT owner_user_id INTO v_owner_id FROM plan WHERE id = p_plan_id;
  IF p_target_user_id = v_owner_id THEN RETURN 'cannot_demote_owner'; END IF;
  SELECT rol INTO v_target_rol FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = p_target_user_id;
  IF v_target_rol IS NULL THEN RETURN 'target_not_member'; END IF;
  IF v_target_rol != 'ADMIN' THEN RETURN 'not_admin_target'; END IF;
  UPDATE plan_usuarios SET rol = 'PARTICIPANTE', updated_at = now() WHERE plan_id = p_plan_id AND user_id = p_target_user_id;
  RETURN 'ok';
END; $$;


--
-- Name: fn_plan_get_miembros(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_plan_get_miembros(p_plan_id bigint) RETURNS TABLE(user_id uuid, nombre text, username text, foto text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT pu.user_id, up.nombre, up.username, up.profile_image AS foto
  FROM plan_usuarios pu
  JOIN usuarios_public up ON up.id = pu.user_id
  WHERE pu.plan_id = p_plan_id
    AND pu.estado = 'PARTICIPA';
$$;


--
-- Name: fn_plan_kick_member(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_plan_kick_member(p_plan_id bigint, p_target_user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_rol text;
  v_owner_id uuid;
  v_chat_id uuid;
BEGIN
  SELECT rol INTO v_caller_rol FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = v_caller;
  IF v_caller_rol IS NULL THEN RETURN 'not_member'; END IF;
  IF v_caller_rol != 'ADMIN' THEN RETURN 'not_admin'; END IF;
  IF v_caller = p_target_user_id THEN RETURN 'cannot_kick_self'; END IF;
  SELECT owner_user_id INTO v_owner_id FROM plan WHERE id = p_plan_id;
  IF p_target_user_id = v_owner_id THEN RETURN 'cannot_kick_owner'; END IF;
  IF NOT EXISTS (SELECT 1 FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = p_target_user_id) THEN RETURN 'target_not_member'; END IF;
  DELETE FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = p_target_user_id;
  SELECT id INTO v_chat_id FROM chat WHERE plan_id = p_plan_id AND tipo = 'PLAN' LIMIT 1;
  IF v_chat_id IS NOT NULL THEN
    DELETE FROM chat_miembro WHERE chat_id = v_chat_id AND user_id = p_target_user_id;
  END IF;
  RETURN 'ok';
END; $$;


--
-- Name: fn_plan_leave(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_plan_leave(p_plan_id bigint) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_rol text;
  v_owner_id uuid;
  v_other_admins int;
  v_chat_id uuid;
BEGIN
  SELECT rol INTO v_caller_rol FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = v_caller;
  IF v_caller_rol IS NULL THEN RETURN 'not_member'; END IF;
  SELECT owner_user_id INTO v_owner_id FROM plan WHERE id = p_plan_id;
  IF v_caller = v_owner_id THEN RETURN 'owner_cannot_leave'; END IF;
  IF v_caller_rol = 'ADMIN' THEN
    SELECT COUNT(*) INTO v_other_admins FROM plan_usuarios WHERE plan_id = p_plan_id AND rol = 'ADMIN' AND user_id != v_caller;
    IF v_other_admins = 0 THEN RETURN 'last_admin'; END IF;
  END IF;
  DELETE FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = v_caller;
  SELECT id INTO v_chat_id FROM chat WHERE plan_id = p_plan_id AND tipo = 'PLAN' LIMIT 1;
  IF v_chat_id IS NOT NULL THEN
    DELETE FROM chat_miembro WHERE chat_id = v_chat_id AND user_id = v_caller;
  END IF;
  RETURN 'ok';
END; $$;


--
-- Name: fn_plan_promote_admin(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_plan_promote_admin(p_plan_id bigint, p_target_user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_rol text;
BEGIN
  SELECT rol INTO v_caller_rol FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = v_caller;
  IF v_caller_rol IS NULL THEN RETURN 'not_member'; END IF;
  IF v_caller_rol != 'ADMIN' THEN RETURN 'not_admin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = p_target_user_id) THEN RETURN 'target_not_member'; END IF;
  IF p_target_user_id = v_caller THEN RETURN 'already_admin'; END IF;
  UPDATE plan_usuarios SET rol = 'ADMIN', updated_at = now() WHERE plan_id = p_plan_id AND user_id = p_target_user_id;
  RETURN 'ok';
END; $$;


--
-- Name: fn_plan_update(bigint, text, text, text, text, text, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_plan_update(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at text, p_fin_at text, p_ubicacion_nombre text, p_all_day boolean DEFAULT false, p_visibilidad text DEFAULT 'SOLO_GRUPO'::text, p_foto_portada text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM plan_usuarios
    WHERE plan_id = p_plan_id
      AND user_id = auth.uid()
      AND rol = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  UPDATE plan
  SET
    titulo           = p_titulo,
    descripcion      = p_descripcion,
    inicio_at        = p_inicio_at::timestamptz,
    fin_at           = p_fin_at::timestamptz,
    ubicacion_nombre = p_ubicacion_nombre,
    all_day          = p_all_day,
    visibilidad      = p_visibilidad::visibilidad_plan,
    foto_portada     = p_foto_portada,
    updated_at       = now()
  WHERE id = p_plan_id;
END;
$$;


--
-- Name: fn_plans_get_by_ids(bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_plans_get_by_ids(p_plan_ids bigint[]) RETURNS TABLE(id bigint, created_at timestamp with time zone, titulo text, descripcion text, visibilidad text, inicio_at timestamp with time zone, fin_at timestamp with time zone, all_day boolean, ubicacion_nombre text, foto_portada text, owner_user_id uuid, creado_por_user_id uuid, creador_nombre text, creador_profile_image text, join_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.created_at,
    p.titulo::text, p.descripcion::text, p.visibilidad::text,
    p.inicio_at, p.fin_at, p.all_day,
    p.ubicacion_nombre::text, p.foto_portada::text,
    p.owner_user_id, p.creado_por_user_id,
    u.nombre::text AS creador_nombre, u.profile_image::text AS creador_profile_image,
    p.join_code::text
  FROM plan p LEFT JOIN usuarios u ON u.id = p.creado_por_user_id
  WHERE p.id = ANY(p_plan_ids) AND p.deleted_at IS NULL AND p.estado = 'ACTIVO';
END;
$$;


--
-- Name: fn_plans_get_for_user(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_plans_get_for_user(p_user_id uuid, p_limit integer DEFAULT 300) RETURNS TABLE(id bigint, created_at timestamp with time zone, titulo text, descripcion text, visibilidad text, inicio_at timestamp with time zone, fin_at timestamp with time zone, all_day boolean, ubicacion_nombre text, foto_portada text, owner_user_id uuid, creado_por_user_id uuid, creador_nombre text, creador_profile_image text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
END; $$;


--
-- Name: fn_poll_close(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_poll_close(p_mensaje_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_chat_id uuid;
  v_texto   text;
  v_parsed  jsonb;
BEGIN
  SELECT chat_id, texto INTO v_chat_id, v_texto
  FROM mensajes WHERE id = p_mensaje_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM chat_miembro
    WHERE chat_id = v_chat_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not a member of this chat'; END IF;

  v_parsed := v_texto::jsonb;
  IF v_parsed->>'type' != 'poll' THEN RAISE EXCEPTION 'Not a poll message'; END IF;

  UPDATE mensajes SET texto = (v_parsed || '{"closed": true}')::text WHERE id = p_mensaje_id;
END;
$$;


--
-- Name: fn_poll_get_votes(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_poll_get_votes(p_mensaje_id bigint) RETURNS TABLE(option_index integer, vote_count bigint, voted_by_me boolean)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT
    v.option_index,
    COUNT(*)::bigint                       AS vote_count,
    bool_or(v.user_id = auth.uid())        AS voted_by_me
  FROM poll_votes v
  WHERE v.mensaje_id = p_mensaje_id
  GROUP BY v.option_index;
$$;


--
-- Name: fn_poll_vote(bigint, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_poll_vote(p_mensaje_id bigint, p_option_index integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO poll_votes(mensaje_id, user_id, option_index)
  VALUES(p_mensaje_id, auth.uid(), p_option_index)
  ON CONFLICT(mensaje_id, user_id)
  DO UPDATE SET option_index = EXCLUDED.option_index;
END;
$$;


--
-- Name: fn_push_token_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_push_token_delete() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from public.push_tokens where user_id = auth.uid();
end;
$$;


--
-- Name: fn_push_token_upsert(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_push_token_upsert(p_token text, p_platform text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.push_tokens (user_id, token, platform)
  values (auth.uid(), p_token, p_platform)
  on conflict (user_id, token)
  do update set platform = excluded.platform, created_at = now();
end;
$$;


--
-- Name: fn_recordar(bigint, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_recordar(p_plan_id bigint, p_from_user_id uuid, p_to_user_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_last_sent timestamptz;
  v_hours_remaining int;
  v_has_debts boolean;
  v_has_tasks boolean;
  v_deuda_total numeric;
  v_plan_titulo text;
  v_meta jsonb;
BEGIN
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
$$;


--
-- Name: fn_resumen_post_viaje(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_resumen_post_viaje(p_plan_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_chat_id uuid;
  v_total numeric;
  v_miembros int;
  v_top_nombre text;
  v_top_importe numeric;
  v_deudas int;
  v_actividades int;
BEGIN
  SELECT id INTO v_chat_id FROM chat WHERE plan_id = p_plan_id AND tipo = 'PLAN' LIMIT 1;
  IF v_chat_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(total), 0) INTO v_total
    FROM gastos WHERE plan_id = p_plan_id AND estado != 'ANULADO';

  SELECT COUNT(*) INTO v_miembros FROM plan_usuarios WHERE plan_id = p_plan_id;

  SELECT u.nombre, SUM(g.total)
    INTO v_top_nombre, v_top_importe
    FROM gastos g JOIN usuarios u ON u.id = g.pagado_por_user_id
    WHERE g.plan_id = p_plan_id AND g.estado != 'ANULADO'
    GROUP BY g.pagado_por_user_id, u.nombre
    ORDER BY 2 DESC LIMIT 1;

  SELECT COUNT(*) INTO v_deudas
    FROM liquidaciones WHERE plan_id = p_plan_id AND estado = 'PENDIENTE';

  SELECT COUNT(*) INTO v_actividades FROM subplan WHERE plan_id = p_plan_id;

  INSERT INTO mensajes (chat_id, sender_id, texto, tipo, created_at)
  VALUES (
    v_chat_id,
    NULL,
    json_build_object(
      'type', 'resumen_viaje',
      'total', v_total,
      'por_persona', CASE WHEN v_miembros > 1 THEN ROUND(v_total / v_miembros, 2) ELSE v_total END,
      'num_miembros', v_miembros,
      'top_pagador', v_top_nombre,
      'top_pagador_importe', v_top_importe,
      'deudas_pendientes', v_deudas,
      'actividades', v_actividades
    )::text,
    'bot',
    NOW()
  );

  UPDATE plan SET resumen_enviado = true WHERE id = p_plan_id;
END;
$$;


--
-- Name: fn_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: fn_subplan_create(bigint, text, text, timestamp with time zone, timestamp with time zone, boolean, text, text, bigint, public.tipo_subplan, text, text, double precision, double precision, double precision, double precision, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_subplan_create(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean DEFAULT false, p_ubicacion_nombre text DEFAULT ''::text, p_ubicacion_direccion text DEFAULT NULL::text, p_parent_subplan_id bigint DEFAULT NULL::bigint, p_tipo public.tipo_subplan DEFAULT 'ACTIVIDAD'::public.tipo_subplan, p_ubicacion_fin_nombre text DEFAULT NULL::text, p_ubicacion_fin_direccion text DEFAULT NULL::text, p_ubicacion_lat double precision DEFAULT NULL::double precision, p_ubicacion_lng double precision DEFAULT NULL::double precision, p_ubicacion_fin_lat double precision DEFAULT NULL::double precision, p_ubicacion_fin_lng double precision DEFAULT NULL::double precision, p_transporte_llegada text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_orden int;
  v_id    bigint;
BEGIN
  SELECT COALESCE(MAX(orden), 0) + 1 INTO v_orden
    FROM subplan
   WHERE plan_id = p_plan_id
     AND (
       (p_parent_subplan_id IS NULL AND parent_subplan_id IS NULL)
       OR parent_subplan_id = p_parent_subplan_id
     );

  INSERT INTO subplan (
    plan_id, parent_subplan_id, titulo, descripcion,
    inicio_at, fin_at, all_day,
    tipo, ubicacion_nombre, ubicacion_direccion,
    ubicacion_fin_nombre, ubicacion_fin_direccion,
    ubicacion_lat, ubicacion_lng,
    ubicacion_fin_lat, ubicacion_fin_lng,
    transporte_llegada,
    orden, creado_por_user_id
  ) VALUES (
    p_plan_id, p_parent_subplan_id, p_titulo, p_descripcion,
    p_inicio_at, p_fin_at, p_all_day,
    p_tipo, p_ubicacion_nombre, p_ubicacion_direccion,
    p_ubicacion_fin_nombre, p_ubicacion_fin_direccion,
    p_ubicacion_lat, p_ubicacion_lng,
    p_ubicacion_fin_lat, p_ubicacion_fin_lng,
    p_transporte_llegada,
    v_orden, v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: fn_subplan_delete(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_subplan_delete(p_subplan_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE subplan
     SET estado = 'CANCELADO'
   WHERE id = p_subplan_id
     AND creado_por_user_id = auth.uid();
END;
$$;


--
-- Name: fn_subplan_list(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_subplan_list(p_plan_id bigint) RETURNS TABLE(id bigint, plan_id bigint, parent_subplan_id bigint, titulo text, descripcion text, inicio_at timestamp with time zone, fin_at timestamp with time zone, all_day boolean, ubicacion_nombre text, ubicacion_direccion text, tipo text, ubicacion_fin_nombre text, ubicacion_fin_direccion text, ubicacion_lat double precision, ubicacion_lng double precision, ubicacion_fin_lat double precision, ubicacion_fin_lng double precision, transporte_llegada text, orden integer, estado text, creado_por_user_id uuid, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
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
$$;


--
-- Name: fn_subplan_save_transporte(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_subplan_save_transporte(p_subplan_id bigint, p_transporte text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM subplan s
    JOIN plan p ON p.id = s.plan_id
    LEFT JOIN plan_usuarios pu ON pu.plan_id = p.id AND pu.user_id = auth.uid()
    WHERE s.id = p_subplan_id
      AND (p.creado_por_user_id = auth.uid() OR pu.user_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este plan';
  END IF;

  -- Borrar caché de ruta para forzar recálculo con el nuevo modo de transporte
  UPDATE subplan
  SET transporte_llegada = p_transporte,
      ruta_polyline      = NULL,
      duracion_viaje     = NULL,
      distancia_viaje    = NULL
  WHERE id = p_subplan_id;
END;
$$;


--
-- Name: fn_subplan_save_viaje(bigint, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_subplan_save_viaje(p_subplan_id bigint, p_duracion text, p_distancia text, p_polyline text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM subplan s
    JOIN plan p ON p.id = s.plan_id
    LEFT JOIN plan_usuarios pu ON pu.plan_id = p.id AND pu.user_id = auth.uid()
    WHERE s.id = p_subplan_id
      AND (p.creado_por_user_id = auth.uid() OR pu.user_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este plan';
  END IF;

  UPDATE subplan
  SET duracion_viaje  = p_duracion,
      distancia_viaje = p_distancia,
      ruta_polyline   = p_polyline
  WHERE id = p_subplan_id;
END;
$$;


--
-- Name: fn_subplan_update(bigint, text, text, timestamp with time zone, timestamp with time zone, boolean, text, text, text, numeric, numeric, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_subplan_update(p_subplan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean, p_tipo text, p_ubicacion_nombre text, p_ubicacion_fin_nombre text, p_ubicacion_lat numeric, p_ubicacion_lng numeric, p_ubicacion_fin_lat numeric, p_ubicacion_fin_lng numeric, p_transporte_llegada text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM subplan sp
    JOIN plan_usuarios pu ON pu.plan_id = sp.plan_id
    WHERE sp.id = p_subplan_id
      AND pu.user_id = auth.uid()
      AND pu.estado = 'PARTICIPA'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE subplan SET
    titulo               = p_titulo,
    descripcion          = p_descripcion,
    inicio_at            = p_inicio_at,
    fin_at               = p_fin_at,
    all_day              = p_all_day,
    tipo                 = p_tipo::tipo_subplan,
    ubicacion_nombre     = p_ubicacion_nombre,
    ubicacion_fin_nombre = p_ubicacion_fin_nombre,
    ubicacion_lat        = p_ubicacion_lat,
    ubicacion_lng        = p_ubicacion_lng,
    ubicacion_fin_lat    = p_ubicacion_fin_lat,
    ubicacion_fin_lng    = p_ubicacion_fin_lng,
    transporte_llegada   = p_transporte_llegada,
    updated_at           = now()
  WHERE id = p_subplan_id;
END;
$$;


--
-- Name: fn_tarea_create(bigint, text, uuid, public.categoria_tarea); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_tarea_create(p_plan_id bigint, p_titulo text, p_asignado_user_id uuid, p_categoria public.categoria_tarea) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = auth.uid() AND rol = 'ADMIN'
  ) THEN RAISE EXCEPTION 'not_admin'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM plan_usuarios WHERE plan_id = p_plan_id AND user_id = p_asignado_user_id
  ) THEN RAISE EXCEPTION 'not_member'; END IF;

  INSERT INTO plan_tareas (plan_id, titulo, categoria, creado_por_user_id)
  VALUES (p_plan_id, p_titulo, p_categoria, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO plan_tareas_asignados (tarea_id, user_id) VALUES (v_id, p_asignado_user_id);
  RETURN v_id;
END;
$$;


--
-- Name: fn_tarea_update_estado(bigint, public.estado_tarea); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_tarea_update_estado(p_tarea_id bigint, p_estado public.estado_tarea) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM plan_tareas t
    JOIN plan_usuarios pu ON pu.plan_id = t.plan_id AND pu.user_id = auth.uid() AND pu.rol = 'ADMIN'
    WHERE t.id = p_tarea_id
  ) AND NOT EXISTS (
    SELECT 1 FROM plan_tareas_asignados WHERE tarea_id = p_tarea_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  UPDATE plan_tareas SET estado = p_estado WHERE id = p_tarea_id;
END;
$$;


--
-- Name: fn_test_gastos(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_test_gastos(p_plan_id bigint) RETURNS TABLE(plan_id_result bigint, gasto_count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT g.plan_id, COUNT(*)
  FROM gastos g
  WHERE g.plan_id = p_plan_id
  GROUP BY g.plan_id;
$$;


--
-- Name: fn_ticket_create(bigint, text, text, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text, text, text, text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_ticket_create(p_plan_id bigint, p_type text, p_title text, p_subtitle text, p_from_label text, p_to_label text, p_place_label text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_booking_code text, p_seat_label text, p_gate_label text, p_terminal_label text, p_passenger_name text, p_notes text, p_qr_image_url text, p_barcode_value text, p_source_image_url text, p_source_pdf_url text, p_cover_color text, p_status text) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into plan_tickets (
    user_id, plan_id, type, title, subtitle,
    from_label, to_label, place_label,
    starts_at, ends_at, booking_code,
    seat_label, gate_label, terminal_label,
    passenger_name, notes, qr_image_url, barcode_value,
    source_image_url, source_pdf_url, cover_color, status
  ) values (
    auth.uid(), p_plan_id, p_type, p_title, p_subtitle,
    p_from_label, p_to_label, p_place_label,
    p_starts_at, p_ends_at, p_booking_code,
    p_seat_label, p_gate_label, p_terminal_label,
    p_passenger_name, p_notes, p_qr_image_url, p_barcode_value,
    p_source_image_url, p_source_pdf_url, p_cover_color, p_status
  )
  returning id;
$$;


--
-- Name: fn_tickets_list(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_tickets_list() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(row_to_json(r) order by r.starts_at asc), '[]'::jsonb)
  from (
    select
      t.*,
      p.titulo as plan_titulo,
      null::uuid  as shared_by_user_id,
      null::text  as shared_by_nombre
    from plan_tickets t
    left join plan p on p.id = t.plan_id
    where t.user_id = auth.uid()

    union all

    select
      t.*,
      p.titulo as plan_titulo,
      t.user_id as shared_by_user_id,
      u.nombre  as shared_by_nombre
    from plan_ticket_shares s
    join plan_tickets t on t.id = s.ticket_id
    left join plan p on p.id = t.plan_id
    left join usuarios u on u.id = t.user_id
    where s.user_id = auth.uid()
  ) r;
$$;


--
-- Name: fn_tickets_list_for_plan(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_tickets_list_for_plan(p_plan_id bigint) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(row_to_json(r) order by r.starts_at asc), '[]'::jsonb)
  from (
    select
      t.*,
      p.titulo as plan_titulo,
      null::uuid  as shared_by_user_id,
      null::text  as shared_by_nombre
    from plan_tickets t
    left join plan p on p.id = t.plan_id
    where t.plan_id = p_plan_id
      and t.user_id = auth.uid()

    union all

    select
      t.*,
      p.titulo as plan_titulo,
      t.user_id as shared_by_user_id,
      u.nombre  as shared_by_nombre
    from plan_ticket_shares s
    join plan_tickets t on t.id = s.ticket_id
    left join plan p on p.id = t.plan_id
    left join usuarios u on u.id = t.user_id
    where t.plan_id = p_plan_id
      and s.user_id = auth.uid()
  ) r;
$$;


--
-- Name: fn_todas_tareas(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_todas_tareas(p_plan_id bigint) RETURNS TABLE(id bigint, titulo text, categoria text, estado text, asignado_nombre text, asignado_username text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT t.id, t.titulo::text, t.categoria::text, t.estado::text,
         u.nombre::text, u.username::text
  FROM plan_tareas t
  JOIN plan_tareas_asignados a ON a.tarea_id = t.id
  JOIN usuarios u ON u.id = a.user_id
  WHERE t.plan_id = p_plan_id
  ORDER BY t.created_at;
$$;


--
-- Name: fn_trigger_send_push(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_trigger_send_push() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault'
    AS $$
declare
  v_url      text;
  v_key      text;
  v_payload  jsonb;
begin
  -- Lee los secretos desde el Vault de Supabase
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'app_supabase_url' limit 1;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'app_service_role_key' limit 1;

  if v_url is null or v_key is null then
    raise warning '[send-push] vault secrets not configured';
    return NEW;
  end if;

  v_url := v_url || '/functions/v1/send-push';

  v_payload := jsonb_build_object(
    'type',   'INSERT',
    'table',  'notificaciones',
    'record', row_to_json(NEW)::jsonb
  );

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := v_payload::text
  );

  return NEW;
end;
$$;


--
-- Name: fn_user_auth_snapshot_get(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_user_auth_snapshot_get(p_user_id uuid) RETURNS TABLE(id uuid, nombre text, username text, fecha_nac date, email text, rol text, profile_image text, estado text, email_verified_at timestamp with time zone, deleted_at timestamp with time zone, settings_user_id uuid, theme text, language character varying, timezone character varying, notify_push boolean, notify_email boolean, notify_in_app boolean, profile_visibility character varying, allow_friend_requests boolean, google_sync_enabled boolean, google_sync_export_plans boolean)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: fn_user_profile_and_settings_upsert(uuid, character varying, date, text, public.theme_preference, character varying, character varying, boolean, boolean, boolean, character varying, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre character varying DEFAULT NULL::character varying, p_fecha_nac date DEFAULT NULL::date, p_profile_image text DEFAULT NULL::text, p_theme public.theme_preference DEFAULT NULL::public.theme_preference, p_language character varying DEFAULT NULL::character varying, p_timezone character varying DEFAULT NULL::character varying, p_notify_push boolean DEFAULT NULL::boolean, p_notify_email boolean DEFAULT NULL::boolean, p_notify_in_app boolean DEFAULT NULL::boolean, p_profile_visibility character varying DEFAULT NULL::character varying, p_allow_friend_requests boolean DEFAULT NULL::boolean) RETURNS TABLE(user_id uuid, nombre character varying, fecha_nac date, profile_image text, theme public.theme_preference, language character varying, timezone character varying, notify_push boolean, notify_email boolean, notify_in_app boolean, profile_visibility character varying, allow_friend_requests boolean)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
BEGIN
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
$$;


--
-- Name: fn_user_profile_and_settings_upsert(uuid, text, text, date, text, public.theme_preference, character varying, character varying, boolean, boolean, boolean, character varying, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre text DEFAULT NULL::text, p_username text DEFAULT NULL::text, p_fecha_nac date DEFAULT NULL::date, p_profile_image text DEFAULT NULL::text, p_theme public.theme_preference DEFAULT NULL::public.theme_preference, p_language character varying DEFAULT NULL::character varying, p_timezone character varying DEFAULT NULL::character varying, p_notify_push boolean DEFAULT NULL::boolean, p_notify_email boolean DEFAULT NULL::boolean, p_notify_in_app boolean DEFAULT NULL::boolean, p_profile_visibility character varying DEFAULT NULL::character varying, p_allow_friend_requests boolean DEFAULT NULL::boolean, p_google_sync_enabled boolean DEFAULT NULL::boolean, p_google_sync_export_plans boolean DEFAULT NULL::boolean) RETURNS TABLE(id uuid, nombre text, username text, fecha_nac date, profile_image text, theme public.theme_preference, language character varying, timezone character varying, notify_push boolean, notify_email boolean, notify_in_app boolean, profile_visibility character varying, allow_friend_requests boolean, google_sync_enabled boolean, google_sync_export_plans boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
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
$$;


--
-- Name: fn_user_profile_get_public(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_user_profile_get_public(p_user_id uuid) RETURNS TABLE(id uuid, nombre text, username text, profile_image text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nombre::text, u.username::text, u.profile_image::text
  FROM usuarios_public u WHERE u.id = p_user_id;
END;
$$;


--
-- Name: fn_user_settings_get(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_user_settings_get() RETURNS TABLE(user_id uuid, theme text, language text, timezone text, notify_push boolean, notify_email boolean, notify_in_app boolean, profile_visibility text, allow_friend_requests boolean, google_sync_enabled boolean, google_sync_export_plans boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT s.user_id, s.theme::text, s.language::text, s.timezone::text,
    s.notify_push, s.notify_email, s.notify_in_app,
    s.profile_visibility::text, s.allow_friend_requests,
    s.google_sync_enabled, s.google_sync_export_plans
  FROM user_settings s WHERE s.user_id = auth.uid() AND s.deleted_at IS NULL;
END; $$;


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    user_id uuid NOT NULL,
    theme public.theme_preference DEFAULT 'SYSTEM'::public.theme_preference NOT NULL,
    language character varying(10) DEFAULT 'es'::character varying NOT NULL,
    timezone character varying(64) DEFAULT 'Europe/Madrid'::character varying NOT NULL,
    notify_push boolean DEFAULT true NOT NULL,
    notify_email boolean DEFAULT true NOT NULL,
    notify_in_app boolean DEFAULT true NOT NULL,
    profile_visibility character varying(20) DEFAULT 'PUBLICO'::character varying NOT NULL,
    allow_friend_requests boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    google_sync_enabled boolean DEFAULT false NOT NULL,
    google_sync_export_plans boolean DEFAULT true NOT NULL,
    notification_preferences jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: fn_user_settings_upsert(uuid, public.theme_preference, character varying, character varying, boolean, boolean, boolean, character varying, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_user_settings_upsert(p_user_id uuid, p_theme public.theme_preference DEFAULT NULL::public.theme_preference, p_language character varying DEFAULT NULL::character varying, p_timezone character varying DEFAULT NULL::character varying, p_notify_push boolean DEFAULT NULL::boolean, p_notify_email boolean DEFAULT NULL::boolean, p_notify_in_app boolean DEFAULT NULL::boolean, p_profile_visibility character varying DEFAULT NULL::character varying, p_allow_friend_requests boolean DEFAULT NULL::boolean) RETURNS public.user_settings
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_row public.user_settings;
BEGIN
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
$$;


--
-- Name: fn_user_settings_upsert(uuid, public.theme_preference, character varying, character varying, boolean, boolean, boolean, character varying, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_user_settings_upsert(p_user_id uuid, p_theme public.theme_preference DEFAULT NULL::public.theme_preference, p_language character varying DEFAULT NULL::character varying, p_timezone character varying DEFAULT NULL::character varying, p_notify_push boolean DEFAULT NULL::boolean, p_notify_email boolean DEFAULT NULL::boolean, p_notify_in_app boolean DEFAULT NULL::boolean, p_profile_visibility character varying DEFAULT NULL::character varying, p_allow_friend_requests boolean DEFAULT NULL::boolean, p_google_sync_enabled boolean DEFAULT NULL::boolean, p_google_sync_export_plans boolean DEFAULT NULL::boolean) RETURNS public.user_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row public.user_settings;
begin
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
$$;


--
-- Name: fn_user_update_google_refresh_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_user_update_google_refresh_token(p_refresh_token text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE usuarios SET google_refresh_token = p_refresh_token WHERE id = auth.uid();
END; $$;


--
-- Name: fn_users_search_public(text, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_users_search_public(p_query text, p_limit integer DEFAULT 8, p_exclude_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, nombre text, username text, profile_image text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    u.id,
    u.nombre,
    u.username,
    u.profile_image
  FROM usuarios u
  WHERE u.deleted_at IS NULL
    AND (p_exclude_user_id IS NULL OR u.id <> p_exclude_user_id)
    AND (
      u.nombre   ILIKE '%' || p_query || '%'
      OR u.username ILIKE '%' || p_query || '%'
    )
  ORDER BY
    CASE WHEN u.username ILIKE p_query || '%' THEN 0
         WHEN u.nombre   ILIKE p_query || '%' THEN 1
         ELSE 2
    END,
    u.nombre
  LIMIT p_limit;
$$;


--
-- Name: fn_usuarios_email_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_usuarios_email_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- En update, nunca permitas perder el email previo
  IF TG_OP = 'UPDATE' THEN
    NEW.email := COALESCE(NEW.email, OLD.email);
  END IF;

  -- En insert/update, bloquea null con error claro
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION
      'Email nulo en usuarios (op=%, id=%). Trigger origen: %',
      TG_OP, NEW.id, TG_NAME;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_usuarios_immutable_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_usuarios_immutable_email() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      -- Si estaba verificado y NO es admin, no se permite cambiar email
      IF OLD.email_verified_at IS NOT NULL AND COALESCE(OLD.rol, 'MIEMBRO') <> 'ADMIN' THEN
        RAISE EXCEPTION 'No se puede cambiar el email de un usuario verificado (salvo rol ADMIN)';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_usuarios_password_hash_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_usuarios_password_hash_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.password_hash IS NULL OR length(btrim(NEW.password_hash)) = 0 THEN
    RAISE EXCEPTION 'password_hash no puede ser NULL o vacío';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: fn_usuarios_soft_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_usuarios_soft_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.usuarios
     SET deleted_at = now(),
         estado = 'INACTIVA'
   WHERE id = OLD.id;

  RETURN NULL; -- cancela el DELETE físico
END;
$$;


--
-- Name: get_user_plan_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_plan_ids(p_user_id uuid) RETURNS SETOF bigint
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  SELECT plan_id FROM plan_usuarios WHERE user_id = p_user_id;
$$;


--
-- Name: handle_auth_user_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_auth_user_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_name text;
  v_avatar text;
  v_email text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Usuario'
  );

  v_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  v_email := coalesce(
    new.email,
    new.raw_user_meta_data->>'email'
  );

  if v_email is null then
    raise exception 'Email nulo en auth.users para id=%', new.id;
  end if;

  -- Solo crear si no existe. Si ya existe, NO modificar.
  insert into public.usuarios (id, nombre, email, fecha_registro, profile_image, email_verified_at)
  values (new.id, v_name, v_email, now(), v_avatar, new.email_confirmed_at)
  on conflict (id) do nothing;

  return new;
end;
$$;


--
-- Name: handle_auth_user_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_auth_user_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_name text;
  v_avatar text;
  v_email text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Usuario'
  );

  v_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  v_email := coalesce(
    new.email,
    new.raw_user_meta_data->>'email'
  );

  if v_email is null then
    raise exception 'Email nulo en update de auth.users para id=%', new.id;
  end if;

  -- Si no existe (caso raro), lo crea. Si existe, NO modifica.
  insert into public.usuarios (id, nombre, email, fecha_registro, profile_image, email_verified_at)
  values (new.id, v_name, v_email, now(), v_avatar, new.email_confirmed_at)
  on conflict (id) do nothing;

  return new;
end;
$$;


--
-- Name: is_chat_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_chat_member(p_chat_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_miembro
    WHERE chat_id = p_chat_id
      AND user_id = auth.uid()
  );
$$;


--
-- Name: is_plan_member(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_plan_member(p_plan_id bigint) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM plan_usuarios
    WHERE plan_id = p_plan_id AND user_id = auth.uid()
  );
$$;


--
-- Name: purge_soft_deleted_usuarios(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_soft_deleted_usuarios() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  delete from public.usuarios
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';
$$;


--
-- Name: set_updated_at_route_cache(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_route_cache() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sync_route_cache_from_subplan(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_route_cache_from_subplan(p_subplan_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  dest_row public.subplan%rowtype;
  origin_row public.subplan%rowtype;
begin
  select *
  into dest_row
  from public.subplan
  where id = p_subplan_id;

  if not found then
    return;
  end if;

  if coalesce(dest_row.ruta_polyline, '') = '' then
    return;
  end if;

  if dest_row.ubicacion_lat is null or dest_row.ubicacion_lng is null then
    return;
  end if;

  select *
  into origin_row
  from public.subplan s
  where s.plan_id = dest_row.plan_id
    and s.estado = 'ACTIVO'
    and (s.inicio_at at time zone 'utc')::date = (dest_row.inicio_at at time zone 'utc')::date
    and (s.inicio_at, s.orden, s.created_at, s.id) < (dest_row.inicio_at, dest_row.orden, dest_row.created_at, dest_row.id)
    and s.ubicacion_lat is not null
    and s.ubicacion_lng is not null
  order by s.inicio_at desc, s.orden desc, s.created_at desc, s.id desc
  limit 1;

  if not found then
    return;
  end if;

  insert into public.route_cache (
    origin_lat,
    origin_lng,
    dest_lat,
    dest_lng,
    polyline,
    distance,
    duration
  )
  values (
    round(origin_row.ubicacion_lat::numeric, 4)::double precision,
    round(origin_row.ubicacion_lng::numeric, 4)::double precision,
    round(dest_row.ubicacion_lat::numeric, 4)::double precision,
    round(dest_row.ubicacion_lng::numeric, 4)::double precision,
    dest_row.ruta_polyline,
    dest_row.distancia_viaje,
    dest_row.duracion_viaje
  )
  on conflict (origin_lat, origin_lng, dest_lat, dest_lng)
  do update set
    polyline = excluded.polyline,
    distance = excluded.distance,
    duration = excluded.duration,
    updated_at = now();
end;
$$;


--
-- Name: trg_chats_creator_is_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_chats_creator_is_member() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into chat_miembros (chat_id, user_id, rol)
  values (new.id, new.created_by_user_id, 'ADMIN')
  on conflict (chat_id, user_id) do nothing;
  return new;
end $$;


--
-- Name: trg_gastos_pagador_must_be_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_gastos_pagador_must_be_member() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare ok boolean;
begin
  select exists(
    select 1 from plan_usuarios
    where plan_id = new.plan_id
      and user_id = new.pagado_por_user_id
      and estado = 'PARTICIPA'
  ) into ok;

  if not ok then
    raise exception 'pagado_por_user_id debe ser miembro del plan.';
  end if;

  return new;
end $$;


--
-- Name: trg_gastos_plan_subplan_match(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_gastos_plan_subplan_match() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare sp_plan_id bigint;
begin
  if new.subplan_id is null then
    return new;
  end if;

  select plan_id into sp_plan_id from subplan where id = new.subplan_id;
  if sp_plan_id is null then
    raise exception 'subplan no existe.';
  end if;

  if sp_plan_id <> new.plan_id then
    raise exception 'subplan_id no pertenece al plan_id del gasto.';
  end if;

  return new;
end $$;


--
-- Name: trg_grupos_creator_is_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_grupos_creator_is_member() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into miembros_grupo (grupo_id, user_id, rol, fecha_alta, estado)
  values (new.id, new.creado_por_user_id, 'ADMIN', current_date, 'ACTIVO')
  on conflict (grupo_id, user_id) do nothing;
  return new;
end $$;


--
-- Name: trg_items_only_if_por_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_items_only_if_por_items() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare mr metodo_reparto;
begin
  select metodo_reparto into mr from gastos where id = new.gasto_id;
  if mr is null then
    raise exception 'gasto no existe.';
  end if;

  if mr <> 'POR_ITEMS' then
    raise exception 'Solo puedes crear gasto_items si el gasto.metodo_reparto = POR_ITEMS.';
  end if;

  return new;
end $$;


--
-- Name: trg_items_subtotal_calc(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_items_subtotal_calc() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.subtotal is null and new.cantidad is not null and new.precio_unitario is not null then
    new.subtotal := round(new.cantidad * new.precio_unitario, 2);
  end if;
  return new;
end $$;


--
-- Name: trg_miembrosgrupo_cannot_remove_last_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_miembrosgrupo_cannot_remove_last_admin() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare admin_count int;
begin
  if (tg_op = 'DELETE') then
    if old.rol = 'ADMIN' then
      select count(*) into admin_count
      from miembros_grupo
      where grupo_id = old.grupo_id
        and rol = 'ADMIN'
        and (user_id <> old.user_id);

      if admin_count = 0 then
        raise exception 'No puedes eliminar al último ADMIN del grupo.';
      end if;
    end if;
    return old;
  end if;

  if (tg_op = 'UPDATE') then
    if old.rol = 'ADMIN' and new.rol <> 'ADMIN' then
      select count(*) into admin_count
      from miembros_grupo
      where grupo_id = old.grupo_id
        and rol = 'ADMIN'
        and (user_id <> old.user_id);

      if admin_count = 0 then
        raise exception 'No puedes degradar al último ADMIN del grupo.';
      end if;
    end if;
    return new;
  end if;

  return null;
end $$;


--
-- Name: trg_plan_create_add_creator(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_plan_create_add_creator() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into plan_usuarios (plan_id, user_id, rol, estado)
  values (new.id, new.creado_por_user_id, 'ADMIN', 'PARTICIPA')
  on conflict (plan_id, user_id) do nothing;
  return new;
end $$;


--
-- Name: trg_plan_group_owner_requires_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_plan_group_owner_requires_member() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare is_member boolean;
begin
  if new.owner_group_id is null then
    return new;
  end if;

  select exists(
    select 1 from miembros_grupo
    where grupo_id = new.owner_group_id
      and user_id = new.creado_por_user_id
      and estado = 'ACTIVO'
  ) into is_member;

  if not is_member then
    raise exception 'El creador debe ser miembro ACTIVO del grupo owner.';
  end if;

  return new;
end $$;


--
-- Name: trg_plan_usuario_sync_chat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_plan_usuario_sync_chat() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_chat_id uuid;
BEGIN
  SELECT id INTO v_chat_id FROM chat WHERE plan_id = NEW.plan_id;
  IF v_chat_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' AND NEW.estado = 'PARTICIPA' THEN
    INSERT INTO chat_miembro (chat_id, user_id)
    VALUES (v_chat_id, NEW.user_id)
    ON CONFLICT DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.estado = 'PARTICIPA' THEN
      INSERT INTO chat_miembro (chat_id, user_id)
      VALUES (v_chat_id, NEW.user_id)
      ON CONFLICT DO NOTHING;
    ELSE
      DELETE FROM chat_miembro WHERE chat_id = v_chat_id AND user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trg_planusuarios_cannot_remove_last_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_planusuarios_cannot_remove_last_admin() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare admin_count int;
begin
  if (tg_op = 'DELETE') then
    if old.rol = 'ADMIN' then
      select count(*) into admin_count
      from plan_usuarios
      where plan_id = old.plan_id
        and rol = 'ADMIN'
        and (user_id <> old.user_id);

      if admin_count = 0 then
        raise exception 'No puedes eliminar al último ADMIN del plan.';
      end if;
    end if;
    return old;
  end if;

  if (tg_op = 'UPDATE') then
    if old.rol = 'ADMIN' and new.rol <> 'ADMIN' then
      select count(*) into admin_count
      from plan_usuarios
      where plan_id = old.plan_id
        and rol = 'ADMIN'
        and (user_id <> old.user_id);

      if admin_count = 0 then
        raise exception 'No puedes degradar al último ADMIN del plan.';
      end if;
    end if;
    return new;
  end if;

  return null;
end $$;


--
-- Name: trg_reservas_plan_subplan_match(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_reservas_plan_subplan_match() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare sp_plan_id bigint;
begin
  if new.subplan_id is null then
    return new;
  end if;

  select plan_id into sp_plan_id from subplan where id = new.subplan_id;
  if sp_plan_id is null then
    raise exception 'subplan no existe.';
  end if;

  if sp_plan_id <> new.plan_id then
    raise exception 'subplan_id no pertenece al plan_id de la reserva.';
  end if;

  return new;
end $$;


--
-- Name: trg_subplan_parent_same_plan(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_subplan_parent_same_plan() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare parent_plan_id bigint;
begin
  if new.parent_subplan_id is null then
    return new;
  end if;

  select plan_id into parent_plan_id
  from subplan
  where id = new.parent_subplan_id;

  if parent_plan_id is null then
    raise exception 'parent_subplan_id no existe.';
  end if;

  if parent_plan_id <> new.plan_id then
    raise exception 'El subplan padre debe pertenecer al mismo plan.';
  end if;

  return new;
end $$;


--
-- Name: trg_subplanusuarios_require_plan_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_subplanusuarios_require_plan_member() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare sp_plan_id bigint;
declare is_member boolean;
begin
  select plan_id into sp_plan_id from subplan where id = new.subplan_id;
  if sp_plan_id is null then
    raise exception 'subplan no existe.';
  end if;

  select exists(
    select 1 from plan_usuarios
    where plan_id = sp_plan_id
      and user_id = new.user_id
      and estado = 'PARTICIPA'
  ) into is_member;

  if not is_member then
    raise exception 'El usuario debe ser miembro del plan para entrar en el subplan.';
  end if;

  return new;
end $$;


--
-- Name: trg_sync_route_cache_from_subplan(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_sync_route_cache_from_subplan() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if coalesce(new.ruta_polyline, '') <> '' then
    perform public.sync_route_cache_from_subplan(new.id);
  end if;
  return new;
end;
$$;


--
-- Name: amistades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amistades (
    user_id_1 uuid NOT NULL,
    user_id_2 uuid NOT NULL,
    estado public.estado_amistad DEFAULT 'ACTIVA'::public.estado_amistad NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_amistad_canonical CHECK ((user_id_1 < user_id_2)),
    CONSTRAINT chk_amistad_no_self CHECK ((user_id_1 <> user_id_2))
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    schema_name text DEFAULT 'public'::text NOT NULL,
    table_name text NOT NULL,
    action text NOT NULL,
    record_pk jsonb,
    old_row jsonb,
    new_row jsonb,
    changed_fields jsonb,
    actor_user_id uuid,
    txid bigint DEFAULT txid_current() NOT NULL,
    client_ip inet,
    user_agent text,
    request_id text,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: calendar_sync_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_sync_state (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_started_at timestamp with time zone,
    last_finished_at timestamp with time zone,
    last_status text DEFAULT 'IDLE'::text NOT NULL,
    last_error text,
    sync_enabled_snapshot boolean DEFAULT false NOT NULL,
    export_plans_snapshot boolean DEFAULT true NOT NULL,
    last_imported_count integer DEFAULT 0 NOT NULL,
    last_exported_count integer DEFAULT 0 NOT NULL,
    last_calendars_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT calendar_sync_state_last_status_check CHECK ((last_status = ANY (ARRAY['IDLE'::text, 'RUNNING'::text, 'SUCCESS'::text, 'ERROR'::text])))
);


--
-- Name: categorias_gasto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias_gasto (
    id bigint NOT NULL,
    nombre character varying NOT NULL,
    icono character varying,
    color character varying,
    owner_user_id uuid,
    owner_group_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_categorias_owner_rule CHECK ((((owner_user_id IS NULL) AND (owner_group_id IS NULL)) OR ((owner_user_id IS NOT NULL) AND (owner_group_id IS NULL)) OR ((owner_user_id IS NULL) AND (owner_group_id IS NOT NULL))))
);


--
-- Name: categorias_gasto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.categorias_gasto ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.categorias_gasto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: chat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    nombre text,
    foto text,
    last_message text,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_id bigint,
    CONSTRAINT chat_tipo_check CHECK ((tipo = ANY (ARRAY['DIRECTO'::text, 'GRUPO'::text, 'PLAN'::text])))
);


--
-- Name: chat_miembro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_miembro (
    chat_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    last_read_at timestamp with time zone
);

ALTER TABLE ONLY public.chat_miembro REPLICA IDENTITY FULL;


--
-- Name: evento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evento (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    estado text DEFAULT 'ACTIVO'::text NOT NULL,
    owner_user_id uuid NOT NULL,
    creado_por_user_id uuid NOT NULL,
    titulo text NOT NULL,
    descripcion text,
    categoria text DEFAULT 'OTRO'::text NOT NULL,
    inicio_at timestamp with time zone NOT NULL,
    fin_at timestamp with time zone NOT NULL,
    all_day boolean DEFAULT false NOT NULL,
    color text,
    ubicacion_nombre text,
    ubicacion_direccion text,
    source text DEFAULT 'LOCAL'::text NOT NULL,
    google_calendar_id text,
    google_event_id text,
    sync_status text DEFAULT 'SYNCED'::text NOT NULL,
    last_synced_at timestamp with time zone,
    sync_error text,
    CONSTRAINT evento_categoria_check CHECK ((categoria = ANY (ARRAY['TRABAJO'::text, 'MEDICO'::text, 'CLASE'::text, 'PERSONAL'::text, 'OTRO'::text]))),
    CONSTRAINT evento_date_range_chk CHECK ((fin_at >= inicio_at)),
    CONSTRAINT evento_estado_check CHECK ((estado = ANY (ARRAY['ACTIVO'::text, 'CANCELADO'::text]))),
    CONSTRAINT evento_source_check CHECK ((source = ANY (ARRAY['LOCAL'::text, 'GOOGLE'::text]))),
    CONSTRAINT evento_sync_status_check CHECK ((sync_status = ANY (ARRAY['SYNCED'::text, 'PENDING_CREATE'::text, 'PENDING_UPDATE'::text, 'PENDING_DELETE'::text, 'ERROR'::text]))),
    CONSTRAINT evento_titulo_check CHECK (((char_length(TRIM(BOTH FROM titulo)) > 0) AND (char_length(titulo) <= 120)))
);


--
-- Name: evento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.evento ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.evento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: factura_gastos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.factura_gastos (
    factura_id bigint NOT NULL,
    gasto_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: facturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facturas (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    tipo public.tipo_factura NOT NULL,
    estado public.estado_factura DEFAULT 'BORRADOR'::public.estado_factura NOT NULL,
    emitida_por_user_id uuid NOT NULL,
    titulo character varying NOT NULL,
    descripcion text,
    moneda character(3) NOT NULL,
    total numeric(10,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: facturas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.facturas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.facturas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: flight_positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flight_positions (
    callsign text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    altitude_m double precision,
    velocity_ms double precision,
    heading double precision,
    on_ground boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gasto_item_usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gasto_item_usuarios (
    gasto_item_id bigint NOT NULL,
    user_id uuid NOT NULL,
    subtotal_asignado numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_itemusuarios_nonneg CHECK ((subtotal_asignado >= (0)::numeric))
);


--
-- Name: gasto_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gasto_items (
    id bigint NOT NULL,
    gasto_id bigint NOT NULL,
    nombre character varying NOT NULL,
    cantidad numeric(10,2),
    precio_unitario numeric(10,2),
    subtotal numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_item_nonneg CHECK ((subtotal >= (0)::numeric))
);


--
-- Name: gasto_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.gasto_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.gasto_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: gasto_partes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gasto_partes (
    gasto_id bigint NOT NULL,
    user_id uuid NOT NULL,
    importe numeric(10,2) NOT NULL,
    fuente public.fuente_parte DEFAULT 'AUTO'::public.fuente_parte NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_gastopartes_no_negatives CHECK ((importe >= (0)::numeric))
);


--
-- Name: gastos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gastos (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    subplan_id bigint,
    titulo character varying NOT NULL,
    descripcion text,
    created_by_user_id uuid NOT NULL,
    pagado_por_user_id uuid NOT NULL,
    fecha_gasto timestamp with time zone NOT NULL,
    total numeric(10,2) NOT NULL,
    moneda character(3) NOT NULL,
    metodo_reparto public.metodo_reparto NOT NULL,
    categoria_id bigint DEFAULT 0,
    estado public.estado_gasto DEFAULT 'BORRADOR'::public.estado_gasto NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    receipt_url text,
    CONSTRAINT chk_gasto_total_nonneg CHECK ((total >= (0)::numeric))
);


--
-- Name: gastos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.gastos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.gastos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: grupos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grupos (
    id bigint NOT NULL,
    nombre character varying NOT NULL,
    imagen character varying,
    visibilidad public.visibilidad_grupo NOT NULL,
    fecha_registro date DEFAULT CURRENT_DATE NOT NULL,
    creado_por_user_id uuid NOT NULL
);


--
-- Name: grupos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.grupos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.grupos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invitaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitaciones (
    id bigint NOT NULL,
    target_type public.target_invite NOT NULL,
    target_id bigint,
    invited_user_id uuid NOT NULL,
    invited_by_user_id uuid NOT NULL,
    token character varying NOT NULL,
    estado public.estado_invite DEFAULT 'PENDIENTE'::public.estado_invite NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    responded_at timestamp with time zone,
    CONSTRAINT chk_invite_friend_targetid_null CHECK (((target_type <> 'FRIEND'::public.target_invite) OR (target_id IS NULL)))
);


--
-- Name: invitaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.invitaciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invitaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: liquidaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquidaciones (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    factura_id bigint,
    importe numeric(10,2) NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    metodo public.metodo_pago,
    nota text,
    estado public.estado_liquidacion DEFAULT 'PENDIENTE'::public.estado_liquidacion NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_session_id text,
    stripe_payment_intent_id text,
    comprobante_url text,
    CONSTRAINT chk_liq_importe_nonneg CHECK ((importe >= (0)::numeric)),
    CONSTRAINT chk_liq_no_self_pay CHECK ((from_user_id <> to_user_id))
);


--
-- Name: liquidaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.liquidaciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.liquidaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: llamadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llamadas (
    id bigint NOT NULL,
    chat_id uuid NOT NULL,
    room_name text NOT NULL,
    iniciado_por_user_id uuid NOT NULL,
    tipo text DEFAULT 'audio'::text NOT NULL,
    estado text DEFAULT 'ringing'::text NOT NULL,
    iniciada_at timestamp with time zone DEFAULT now() NOT NULL,
    finalizada_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT llamadas_estado_check CHECK ((estado = ANY (ARRAY['ringing'::text, 'active'::text, 'ended'::text, 'missed'::text]))),
    CONSTRAINT llamadas_tipo_check CHECK ((tipo = ANY (ARRAY['audio'::text, 'video'::text])))
);


--
-- Name: llamadas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.llamadas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.llamadas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: llm_uso_diario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_uso_diario (
    user_id uuid NOT NULL,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    llamadas integer DEFAULT 0 NOT NULL
);


--
-- Name: mensaje_reacciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensaje_reacciones (
    mensaje_id bigint NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL
);


--
-- Name: mensajes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensajes (
    id bigint NOT NULL,
    texto text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    chat_id uuid NOT NULL,
    sender_id uuid,
    leido_por uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    reply_to_id bigint,
    audio_url text,
    document_url text,
    document_name text,
    image_url text,
    image_type text,
    tipo text DEFAULT 'text'::text NOT NULL
);


--
-- Name: mensajes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mensajes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mensajes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: miembros_grupo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.miembros_grupo (
    grupo_id bigint NOT NULL,
    user_id uuid NOT NULL,
    rol public.rol_grupo DEFAULT 'BASICO'::public.rol_grupo NOT NULL,
    fecha_alta date DEFAULT CURRENT_DATE NOT NULL,
    estado public.estado_miembro_grupo DEFAULT 'ACTIVO'::public.estado_miembro_grupo NOT NULL
);


--
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificaciones (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    tipo text NOT NULL,
    actor_id uuid,
    entity_id text,
    entity_type text,
    leida boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notificaciones_tipo_check CHECK ((tipo = ANY (ARRAY['like'::text, 'comment'::text, 'friend_request'::text, 'friend_accept'::text, 'plan_invite'::text, 'mention'::text, 'recordatorio'::text, 'recordatorio_deuda'::text])))
);


--
-- Name: notificaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notificaciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notificaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: plan_fotos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_fotos (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    user_id uuid NOT NULL,
    url text NOT NULL,
    storage_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plan_fotos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.plan_fotos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.plan_fotos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: plan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.plan ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.plan_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: plan_presupuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_presupuestos (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    categoria_id bigint,
    limite numeric(10,2) NOT NULL,
    moneda character(3) DEFAULT 'EUR'::bpchar NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_presupuesto_positivo CHECK ((limite > (0)::numeric))
);


--
-- Name: plan_presupuestos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.plan_presupuestos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.plan_presupuestos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: plan_tareas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_tareas (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    titulo character varying NOT NULL,
    categoria public.categoria_tarea DEFAULT 'otro'::public.categoria_tarea NOT NULL,
    estado public.estado_tarea DEFAULT 'pendiente'::public.estado_tarea NOT NULL,
    creado_por_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plan_tareas_asignados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_tareas_asignados (
    tarea_id bigint NOT NULL,
    user_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plan_tareas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.plan_tareas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.plan_tareas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: plan_ticket_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_ticket_shares (
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: plan_usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_usuarios (
    plan_id bigint NOT NULL,
    user_id uuid NOT NULL,
    rol public.rol_plan DEFAULT 'PARTICIPANTE'::public.rol_plan NOT NULL,
    estado public.estado_plan_usuario DEFAULT 'PARTICIPA'::public.estado_plan_usuario NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.plan_usuarios REPLICA IDENTITY FULL;


--
-- Name: planes_guardados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planes_guardados (
    user_id uuid NOT NULL,
    plan_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: poll_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll_votes (
    mensaje_id bigint NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    option_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: presupuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presupuestos (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    categoria_id bigint,
    limite numeric(10,2) NOT NULL,
    moneda character(3) NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_presupuesto_nonneg CHECK ((limite >= (0)::numeric))
);


--
-- Name: presupuestos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.presupuestos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.presupuestos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text])))
);


--
-- Name: push_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_tokens_id_seq OWNED BY public.push_tokens.id;


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    reset_at timestamp with time zone NOT NULL
);


--
-- Name: recordatorios_deuda_enviados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recordatorios_deuda_enviados (
    plan_id bigint NOT NULL,
    user_id uuid NOT NULL,
    dia integer NOT NULL
);


--
-- Name: reservas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    subplan_id bigint,
    tipo public.tipo_reserva NOT NULL,
    proveedor character varying,
    codigo_reserva character varying,
    importe_total numeric(10,2) NOT NULL,
    moneda character(3) NOT NULL,
    inicio_at timestamp with time zone NOT NULL,
    fin_at timestamp with time zone,
    notas text,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_reserva_time CHECK (((fin_at IS NULL) OR (fin_at >= inicio_at)))
);


--
-- Name: reservas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.reservas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.reservas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: route_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.route_cache (
    id bigint NOT NULL,
    origin_lat double precision NOT NULL,
    origin_lng double precision NOT NULL,
    dest_lat double precision NOT NULL,
    dest_lng double precision NOT NULL,
    polyline text NOT NULL,
    distance text,
    duration text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE route_cache; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.route_cache IS 'Cache de rutas entre coordenadas para reutilizar polyline, distancia y duracion sin volver a pedir Directions.';


--
-- Name: route_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.route_cache ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.route_cache_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: seguidores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seguidores (
    id bigint NOT NULL,
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seguidores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seguidores_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seguidores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seguidores_id_seq OWNED BY public.seguidores.id;


--
-- Name: subplan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subplan (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    parent_subplan_id bigint,
    titulo character varying NOT NULL,
    descripcion text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    creado_por_user_id uuid NOT NULL,
    estado public.estado_subplan DEFAULT 'ACTIVO'::public.estado_subplan NOT NULL,
    inicio_at timestamp with time zone NOT NULL,
    fin_at timestamp with time zone NOT NULL,
    all_day boolean DEFAULT false NOT NULL,
    ubicacion_nombre character varying NOT NULL,
    ubicacion_direccion character varying,
    orden integer NOT NULL,
    tipo public.tipo_subplan DEFAULT 'ACTIVIDAD'::public.tipo_subplan NOT NULL,
    ubicacion_fin_nombre text,
    ubicacion_fin_direccion text,
    ubicacion_lat double precision,
    ubicacion_lng double precision,
    ubicacion_fin_lat double precision,
    ubicacion_fin_lng double precision,
    transporte_llegada text,
    duracion_viaje text,
    distancia_viaje text,
    ruta_polyline text,
    CONSTRAINT chk_subplan_time CHECK ((fin_at >= inicio_at))
);


--
-- Name: subplan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.subplan ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.subplan_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: subplan_usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subplan_usuarios (
    subplan_id bigint NOT NULL,
    user_id uuid NOT NULL,
    estado public.estado_plan_usuario DEFAULT 'PARTICIPA'::public.estado_plan_usuario NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid NOT NULL,
    nombre character varying(200) NOT NULL,
    email character varying(320) NOT NULL,
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL,
    rol public.rol_usuario DEFAULT 'MIEMBRO'::public.rol_usuario NOT NULL,
    fecha_nac date,
    estado public.estado_usuario DEFAULT 'ACTIVA'::public.estado_usuario NOT NULL,
    email_verified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    profile_image text,
    stripe_account_id text,
    stripe_onboarded boolean DEFAULT false NOT NULL,
    google_refresh_token text,
    suscripcion text DEFAULT 'free'::text NOT NULL,
    username text,
    CONSTRAINT usuarios_suscripcion_check CHECK ((suscripcion = ANY (ARRAY['free'::text, 'pro'::text, 'admin'::text])))
);


--
-- Name: usuarios_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.usuarios_public AS
 SELECT id,
    nombre,
    profile_image,
    deleted_at,
    username
   FROM public.usuarios;


--
-- Name: waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    source text DEFAULT 'landing'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: push_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens ALTER COLUMN id SET DEFAULT nextval('public.push_tokens_id_seq'::regclass);


--
-- Name: seguidores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguidores ALTER COLUMN id SET DEFAULT nextval('public.seguidores_id_seq'::regclass);


--
-- Name: amistades amistades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amistades
    ADD CONSTRAINT amistades_pkey PRIMARY KEY (user_id_1, user_id_2);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: calendar_sync_state calendar_sync_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sync_state
    ADD CONSTRAINT calendar_sync_state_pkey PRIMARY KEY (user_id);


--
-- Name: categorias_gasto categorias_gasto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_gasto
    ADD CONSTRAINT categorias_gasto_pkey PRIMARY KEY (id);


--
-- Name: chat_miembro chat_miembro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_miembro
    ADD CONSTRAINT chat_miembro_pkey PRIMARY KEY (chat_id, user_id);


--
-- Name: chat chat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat
    ADD CONSTRAINT chat_pkey PRIMARY KEY (id);


--
-- Name: evento evento_google_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento
    ADD CONSTRAINT evento_google_unique UNIQUE (owner_user_id, google_calendar_id, google_event_id);


--
-- Name: evento evento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento
    ADD CONSTRAINT evento_pkey PRIMARY KEY (id);


--
-- Name: factura_gastos factura_gastos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factura_gastos
    ADD CONSTRAINT factura_gastos_pkey PRIMARY KEY (factura_id, gasto_id);


--
-- Name: facturas facturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_pkey PRIMARY KEY (id);


--
-- Name: flight_positions flight_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_positions
    ADD CONSTRAINT flight_positions_pkey PRIMARY KEY (callsign);


--
-- Name: gasto_item_usuarios gasto_item_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_item_usuarios
    ADD CONSTRAINT gasto_item_usuarios_pkey PRIMARY KEY (gasto_item_id, user_id);


--
-- Name: gasto_items gasto_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_items
    ADD CONSTRAINT gasto_items_pkey PRIMARY KEY (id);


--
-- Name: gasto_partes gasto_partes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_partes
    ADD CONSTRAINT gasto_partes_pkey PRIMARY KEY (gasto_id, user_id);


--
-- Name: gastos gastos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_pkey PRIMARY KEY (id);


--
-- Name: grupos grupos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_pkey PRIMARY KEY (id);


--
-- Name: invitaciones invitaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitaciones
    ADD CONSTRAINT invitaciones_pkey PRIMARY KEY (id);


--
-- Name: invitaciones invitaciones_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitaciones
    ADD CONSTRAINT invitaciones_token_key UNIQUE (token);


--
-- Name: liquidaciones liquidaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liquidaciones_pkey PRIMARY KEY (id);


--
-- Name: liquidaciones liquidaciones_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liquidaciones_stripe_session_id_key UNIQUE (stripe_session_id);


--
-- Name: llamadas llamadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llamadas
    ADD CONSTRAINT llamadas_pkey PRIMARY KEY (id);


--
-- Name: llamadas llamadas_room_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llamadas
    ADD CONSTRAINT llamadas_room_name_key UNIQUE (room_name);


--
-- Name: llm_uso_diario llm_uso_diario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_uso_diario
    ADD CONSTRAINT llm_uso_diario_pkey PRIMARY KEY (user_id, fecha);


--
-- Name: mensaje_reacciones mensaje_reacciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje_reacciones
    ADD CONSTRAINT mensaje_reacciones_pkey PRIMARY KEY (mensaje_id, user_id);


--
-- Name: mensajes mensajes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_pkey PRIMARY KEY (id);


--
-- Name: miembros_grupo miembros_grupo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miembros_grupo
    ADD CONSTRAINT miembros_grupo_pkey PRIMARY KEY (grupo_id, user_id);


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id);


--
-- Name: plan_fotos plan_fotos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_fotos
    ADD CONSTRAINT plan_fotos_pkey PRIMARY KEY (id);


--
-- Name: plan plan_join_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan
    ADD CONSTRAINT plan_join_code_key UNIQUE (join_code);


--
-- Name: plan plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan
    ADD CONSTRAINT plan_pkey PRIMARY KEY (id);


--
-- Name: plan_presupuestos plan_presupuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_presupuestos
    ADD CONSTRAINT plan_presupuestos_pkey PRIMARY KEY (id);


--
-- Name: plan_tareas_asignados plan_tareas_asignados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tareas_asignados
    ADD CONSTRAINT plan_tareas_asignados_pkey PRIMARY KEY (tarea_id, user_id);


--
-- Name: plan_tareas plan_tareas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tareas
    ADD CONSTRAINT plan_tareas_pkey PRIMARY KEY (id);


--
-- Name: plan_ticket_shares plan_ticket_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_ticket_shares
    ADD CONSTRAINT plan_ticket_shares_pkey PRIMARY KEY (ticket_id, user_id);


--
-- Name: plan_tickets plan_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tickets
    ADD CONSTRAINT plan_tickets_pkey PRIMARY KEY (id);


--
-- Name: plan_usuarios plan_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_usuarios
    ADD CONSTRAINT plan_usuarios_pkey PRIMARY KEY (plan_id, user_id);


--
-- Name: planes_guardados planes_guardados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes_guardados
    ADD CONSTRAINT planes_guardados_pkey PRIMARY KEY (user_id, plan_id);


--
-- Name: poll_votes poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_pkey PRIMARY KEY (mensaje_id, user_id);


--
-- Name: presupuestos presupuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuestos
    ADD CONSTRAINT presupuestos_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_user_token_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_token_uq UNIQUE (user_id, token);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key);


--
-- Name: recordatorios_deuda_enviados recordatorios_deuda_enviados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recordatorios_deuda_enviados
    ADD CONSTRAINT recordatorios_deuda_enviados_pkey PRIMARY KEY (plan_id, user_id, dia);


--
-- Name: reservas reservas_codigo_reserva_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_codigo_reserva_key UNIQUE (codigo_reserva);


--
-- Name: reservas reservas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_pkey PRIMARY KEY (id);


--
-- Name: route_cache route_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_cache
    ADD CONSTRAINT route_cache_pkey PRIMARY KEY (id);


--
-- Name: seguidores seguidores_follower_id_following_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguidores
    ADD CONSTRAINT seguidores_follower_id_following_id_key UNIQUE (follower_id, following_id);


--
-- Name: seguidores seguidores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguidores
    ADD CONSTRAINT seguidores_pkey PRIMARY KEY (id);


--
-- Name: subplan subplan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subplan
    ADD CONSTRAINT subplan_pkey PRIMARY KEY (id);


--
-- Name: subplan_usuarios subplan_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subplan_usuarios
    ADD CONSTRAINT subplan_usuarios_pkey PRIMARY KEY (subplan_id, user_id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: categorias_gasto ux_categoria_nombre_owner; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_gasto
    ADD CONSTRAINT ux_categoria_nombre_owner UNIQUE (nombre, owner_user_id, owner_group_id);


--
-- Name: plan_presupuestos ux_plan_presupuesto_categoria; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_presupuestos
    ADD CONSTRAINT ux_plan_presupuesto_categoria UNIQUE (plan_id, categoria_id);


--
-- Name: waitlist waitlist_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_email_key UNIQUE (email);


--
-- Name: waitlist waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_pkey PRIMARY KEY (id);


--
-- Name: chat_miembro_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_miembro_user_idx ON public.chat_miembro USING btree (user_id);


--
-- Name: idx_calendar_sync_state_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_sync_state_status ON public.calendar_sync_state USING btree (last_status);


--
-- Name: idx_evento_google_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evento_google_ids ON public.evento USING btree (owner_user_id, google_calendar_id, google_event_id) WHERE ((source = 'GOOGLE'::text) AND (deleted_at IS NULL));


--
-- Name: idx_evento_owner_fin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evento_owner_fin ON public.evento USING btree (owner_user_id, fin_at) WHERE ((deleted_at IS NULL) AND (estado = 'ACTIVO'::text));


--
-- Name: idx_evento_owner_inicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evento_owner_inicio ON public.evento USING btree (owner_user_id, inicio_at) WHERE ((deleted_at IS NULL) AND (estado = 'ACTIVO'::text));


--
-- Name: idx_evento_owner_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evento_owner_source ON public.evento USING btree (owner_user_id, source) WHERE (deleted_at IS NULL);


--
-- Name: idx_user_settings_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_settings_deleted_at ON public.user_settings USING btree (deleted_at);


--
-- Name: idx_user_settings_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_settings_theme ON public.user_settings USING btree (theme);


--
-- Name: idx_usuarios_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_deleted_at ON public.usuarios USING btree (deleted_at);


--
-- Name: idx_usuarios_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_estado ON public.usuarios USING btree (estado);


--
-- Name: idx_usuarios_stripe_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_stripe_account_id ON public.usuarios USING btree (stripe_account_id);


--
-- Name: idx_usuarios_username_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_usuarios_username_lower ON public.usuarios USING btree (lower(username));


--
-- Name: ix_audit_log_actor_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_log_actor_time ON public.audit_log USING btree (actor_user_id, occurred_at DESC);


--
-- Name: ix_audit_log_record_pk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_log_record_pk ON public.audit_log USING gin (record_pk);


--
-- Name: ix_audit_log_table_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_log_table_time ON public.audit_log USING btree (table_name, occurred_at DESC);


--
-- Name: mensajes_chat_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mensajes_chat_id_idx ON public.mensajes USING btree (chat_id, created_at DESC);


--
-- Name: mensajes_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mensajes_created_at_idx ON public.mensajes USING btree (created_at DESC);


--
-- Name: notificaciones_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notificaciones_user_id_idx ON public.notificaciones USING btree (user_id, created_at DESC);


--
-- Name: notificaciones_user_leida_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notificaciones_user_leida_idx ON public.notificaciones USING btree (user_id, leida) WHERE (leida = false);


--
-- Name: plan_tareas_asignados_user_id_tarea_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_tareas_asignados_user_id_tarea_id_idx ON public.plan_tareas_asignados USING btree (user_id, tarea_id);


--
-- Name: plan_tareas_plan_id_categoria_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_tareas_plan_id_categoria_idx ON public.plan_tareas USING btree (plan_id, categoria);


--
-- Name: plan_ticket_shares_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_ticket_shares_user_idx ON public.plan_ticket_shares USING btree (user_id);


--
-- Name: plan_tickets_plan_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_tickets_plan_id_idx ON public.plan_tickets USING btree (plan_id);


--
-- Name: plan_tickets_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_tickets_starts_at_idx ON public.plan_tickets USING btree (starts_at);


--
-- Name: plan_tickets_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_tickets_user_id_idx ON public.plan_tickets USING btree (user_id);


--
-- Name: route_cache_origin_dest_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX route_cache_origin_dest_key ON public.route_cache USING btree (origin_lat, origin_lng, dest_lat, dest_lng);


--
-- Name: route_cache_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX route_cache_updated_at_idx ON public.route_cache USING btree (updated_at DESC);


--
-- Name: seguidores_follower_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seguidores_follower_id_idx ON public.seguidores USING btree (follower_id);


--
-- Name: seguidores_following_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seguidores_following_id_idx ON public.seguidores USING btree (following_id);


--
-- Name: ux_chat_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_chat_plan_id ON public.chat USING btree (plan_id) WHERE (plan_id IS NOT NULL);


--
-- Name: ux_subplan_order_ctx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_subplan_order_ctx ON public.subplan USING btree (plan_id, parent_subplan_id, orden);


--
-- Name: categorias_gasto audit_categorias_gasto; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_categorias_gasto AFTER INSERT OR DELETE OR UPDATE ON public.categorias_gasto FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: factura_gastos audit_factura_gastos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_factura_gastos AFTER INSERT OR DELETE OR UPDATE ON public.factura_gastos FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('factura_id', 'gasto_id');


--
-- Name: facturas audit_facturas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_facturas AFTER INSERT OR DELETE OR UPDATE ON public.facturas FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: gasto_item_usuarios audit_gasto_item_usuarios; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_gasto_item_usuarios AFTER INSERT OR DELETE OR UPDATE ON public.gasto_item_usuarios FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('gasto_item_id', 'user_id');


--
-- Name: gasto_items audit_gasto_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_gasto_items AFTER INSERT OR DELETE OR UPDATE ON public.gasto_items FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: gasto_partes audit_gasto_partes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_gasto_partes AFTER INSERT OR DELETE OR UPDATE ON public.gasto_partes FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('gasto_id', 'user_id');


--
-- Name: gastos audit_gastos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_gastos AFTER INSERT OR DELETE OR UPDATE ON public.gastos FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: invitaciones audit_invitaciones; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_invitaciones AFTER INSERT OR DELETE OR UPDATE ON public.invitaciones FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: liquidaciones audit_liquidaciones; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_liquidaciones AFTER INSERT OR DELETE OR UPDATE ON public.liquidaciones FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: miembros_grupo audit_miembros_grupo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_miembros_grupo AFTER INSERT OR DELETE OR UPDATE ON public.miembros_grupo FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('grupo_id', 'user_id');


--
-- Name: plan audit_plan; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_plan AFTER INSERT OR DELETE OR UPDATE ON public.plan FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: plan_usuarios audit_plan_usuarios; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_plan_usuarios AFTER INSERT OR DELETE OR UPDATE ON public.plan_usuarios FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('plan_id', 'user_id');


--
-- Name: presupuestos audit_presupuestos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_presupuestos AFTER INSERT OR DELETE OR UPDATE ON public.presupuestos FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: reservas audit_reservas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_reservas AFTER INSERT OR DELETE OR UPDATE ON public.reservas FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: subplan audit_subplan; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_subplan AFTER INSERT OR DELETE OR UPDATE ON public.subplan FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: usuarios audit_usuarios; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_usuarios AFTER INSERT OR DELETE OR UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.audit_if_modified('id');


--
-- Name: route_cache route_cache_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER route_cache_set_updated_at BEFORE UPDATE ON public.route_cache FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_route_cache();


--
-- Name: subplan subplan_sync_route_cache; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subplan_sync_route_cache AFTER INSERT OR UPDATE OF ruta_polyline, distancia_viaje, duracion_viaje, ubicacion_lat, ubicacion_lng ON public.subplan FOR EACH ROW EXECUTE FUNCTION public.trg_sync_route_cache_from_subplan();


--
-- Name: usuarios sync-firebase-creator; Type: TRIGGER; Schema: public; Owner: -
--

-- Production only: Database Webhook calling the sync-firebase-creator Edge Function. Not versioned (contains a key) and must not run outside production.


--
-- Name: plan sync-firebase-plan; Type: TRIGGER; Schema: public; Owner: -
--

-- Production only: Database Webhook calling the sync-firebase-plan Edge Function. Not versioned (contains a key) and must not run outside production.


--
-- Name: calendar_sync_state trg_calendar_sync_state_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_calendar_sync_state_set_updated_at BEFORE UPDATE ON public.calendar_sync_state FOR EACH ROW EXECUTE FUNCTION public.fn_calendar_sync_state_set_updated_at();


--
-- Name: evento trg_evento_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_evento_set_updated_at BEFORE UPDATE ON public.evento FOR EACH ROW EXECUTE FUNCTION public.fn_evento_set_updated_at();


--
-- Name: gastos trg_gastos_pagador_must_be_member; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gastos_pagador_must_be_member BEFORE INSERT OR UPDATE ON public.gastos FOR EACH ROW EXECUTE FUNCTION public.trg_gastos_pagador_must_be_member();


--
-- Name: gastos trg_gastos_plan_subplan_match; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gastos_plan_subplan_match BEFORE INSERT OR UPDATE ON public.gastos FOR EACH ROW EXECUTE FUNCTION public.trg_gastos_plan_subplan_match();


--
-- Name: grupos trg_grupos_creator_is_member; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_grupos_creator_is_member AFTER INSERT ON public.grupos FOR EACH ROW EXECUTE FUNCTION public.trg_grupos_creator_is_member();


--
-- Name: gasto_items trg_items_only_if_por_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_items_only_if_por_items BEFORE INSERT OR UPDATE ON public.gasto_items FOR EACH ROW EXECUTE FUNCTION public.trg_items_only_if_por_items();


--
-- Name: gasto_items trg_items_subtotal_calc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_items_subtotal_calc BEFORE INSERT OR UPDATE ON public.gasto_items FOR EACH ROW EXECUTE FUNCTION public.trg_items_subtotal_calc();


--
-- Name: miembros_grupo trg_miembrosgrupo_cannot_remove_last_admin_d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_miembrosgrupo_cannot_remove_last_admin_d BEFORE DELETE ON public.miembros_grupo FOR EACH ROW EXECUTE FUNCTION public.trg_miembrosgrupo_cannot_remove_last_admin();


--
-- Name: miembros_grupo trg_miembrosgrupo_cannot_remove_last_admin_u; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_miembrosgrupo_cannot_remove_last_admin_u BEFORE UPDATE ON public.miembros_grupo FOR EACH ROW EXECUTE FUNCTION public.trg_miembrosgrupo_cannot_remove_last_admin();


--
-- Name: plan trg_plan_create_add_creator; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plan_create_add_creator AFTER INSERT ON public.plan FOR EACH ROW EXECUTE FUNCTION public.trg_plan_create_add_creator();


--
-- Name: plan trg_plan_group_owner_requires_member; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plan_group_owner_requires_member BEFORE INSERT OR UPDATE ON public.plan FOR EACH ROW EXECUTE FUNCTION public.trg_plan_group_owner_requires_member();


--
-- Name: plan_usuarios trg_plan_usuario_sync_chat; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plan_usuario_sync_chat AFTER INSERT OR UPDATE ON public.plan_usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_plan_usuario_sync_chat();


--
-- Name: plan_usuarios trg_planusuarios_cannot_remove_last_admin_d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_planusuarios_cannot_remove_last_admin_d BEFORE DELETE ON public.plan_usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_planusuarios_cannot_remove_last_admin();


--
-- Name: plan_usuarios trg_planusuarios_cannot_remove_last_admin_u; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_planusuarios_cannot_remove_last_admin_u BEFORE UPDATE ON public.plan_usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_planusuarios_cannot_remove_last_admin();


--
-- Name: reservas trg_reservas_plan_subplan_match; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reservas_plan_subplan_match BEFORE INSERT OR UPDATE ON public.reservas FOR EACH ROW EXECUTE FUNCTION public.trg_reservas_plan_subplan_match();


--
-- Name: notificaciones trg_send_push_on_notif; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_send_push_on_notif AFTER INSERT ON public.notificaciones FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_send_push();


--
-- Name: subplan trg_subplan_parent_same_plan; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_subplan_parent_same_plan BEFORE INSERT OR UPDATE ON public.subplan FOR EACH ROW EXECUTE FUNCTION public.trg_subplan_parent_same_plan();


--
-- Name: subplan_usuarios trg_subplanusuarios_require_plan_member; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_subplanusuarios_require_plan_member BEFORE INSERT OR UPDATE ON public.subplan_usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_subplanusuarios_require_plan_member();


--
-- Name: user_settings trg_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: usuarios trg_usuarios_email_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usuarios_email_guard BEFORE INSERT OR UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.fn_usuarios_email_guard();


--
-- Name: usuarios trg_usuarios_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usuarios_soft_delete BEFORE DELETE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.fn_usuarios_soft_delete();


--
-- Name: amistades amistades_user_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amistades
    ADD CONSTRAINT amistades_user_id_1_fkey FOREIGN KEY (user_id_1) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: amistades amistades_user_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amistades
    ADD CONSTRAINT amistades_user_id_2_fkey FOREIGN KEY (user_id_2) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: calendar_sync_state calendar_sync_state_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sync_state
    ADD CONSTRAINT calendar_sync_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: categorias_gasto categorias_gasto_owner_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_gasto
    ADD CONSTRAINT categorias_gasto_owner_group_id_fkey FOREIGN KEY (owner_group_id) REFERENCES public.grupos(id) ON DELETE RESTRICT;


--
-- Name: categorias_gasto categorias_gasto_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_gasto
    ADD CONSTRAINT categorias_gasto_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: chat_miembro chat_miembro_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_miembro
    ADD CONSTRAINT chat_miembro_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id) ON DELETE CASCADE;


--
-- Name: chat_miembro chat_miembro_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_miembro
    ADD CONSTRAINT chat_miembro_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: chat chat_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat
    ADD CONSTRAINT chat_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: evento evento_creado_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento
    ADD CONSTRAINT evento_creado_por_user_id_fkey FOREIGN KEY (creado_por_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: evento evento_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento
    ADD CONSTRAINT evento_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: factura_gastos factura_gastos_factura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factura_gastos
    ADD CONSTRAINT factura_gastos_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas(id) ON DELETE CASCADE;


--
-- Name: factura_gastos factura_gastos_gasto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factura_gastos
    ADD CONSTRAINT factura_gastos_gasto_id_fkey FOREIGN KEY (gasto_id) REFERENCES public.gastos(id) ON DELETE RESTRICT;


--
-- Name: facturas facturas_emitida_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_emitida_por_user_id_fkey FOREIGN KEY (emitida_por_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: facturas facturas_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: gasto_item_usuarios gasto_item_usuarios_gasto_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_item_usuarios
    ADD CONSTRAINT gasto_item_usuarios_gasto_item_id_fkey FOREIGN KEY (gasto_item_id) REFERENCES public.gasto_items(id) ON DELETE CASCADE;


--
-- Name: gasto_item_usuarios gasto_item_usuarios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_item_usuarios
    ADD CONSTRAINT gasto_item_usuarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gasto_items gasto_items_gasto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_items
    ADD CONSTRAINT gasto_items_gasto_id_fkey FOREIGN KEY (gasto_id) REFERENCES public.gastos(id) ON DELETE CASCADE;


--
-- Name: gasto_partes gasto_partes_gasto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_partes
    ADD CONSTRAINT gasto_partes_gasto_id_fkey FOREIGN KEY (gasto_id) REFERENCES public.gastos(id) ON DELETE CASCADE;


--
-- Name: gasto_partes gasto_partes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_partes
    ADD CONSTRAINT gasto_partes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gastos gastos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_gasto(id) ON DELETE SET NULL;


--
-- Name: gastos gastos_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: gastos gastos_pagado_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_pagado_por_user_id_fkey FOREIGN KEY (pagado_por_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: gastos gastos_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: gastos gastos_subplan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_subplan_id_fkey FOREIGN KEY (subplan_id) REFERENCES public.subplan(id) ON DELETE SET NULL;


--
-- Name: grupos grupos_creado_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_creado_por_user_id_fkey FOREIGN KEY (creado_por_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: invitaciones invitaciones_invited_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitaciones
    ADD CONSTRAINT invitaciones_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: invitaciones invitaciones_invited_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitaciones
    ADD CONSTRAINT invitaciones_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: liquidaciones liquidaciones_factura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liquidaciones_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas(id) ON DELETE SET NULL;


--
-- Name: liquidaciones liquidaciones_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liquidaciones_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: liquidaciones liquidaciones_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liquidaciones_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: liquidaciones liquidaciones_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liquidaciones_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: llamadas llamadas_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llamadas
    ADD CONSTRAINT llamadas_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id) ON DELETE CASCADE;


--
-- Name: llamadas llamadas_iniciado_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llamadas
    ADD CONSTRAINT llamadas_iniciado_por_user_id_fkey FOREIGN KEY (iniciado_por_user_id) REFERENCES auth.users(id);


--
-- Name: llm_uso_diario llm_uso_diario_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_uso_diario
    ADD CONSTRAINT llm_uso_diario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mensaje_reacciones mensaje_reacciones_mensaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje_reacciones
    ADD CONSTRAINT mensaje_reacciones_mensaje_id_fkey FOREIGN KEY (mensaje_id) REFERENCES public.mensajes(id) ON DELETE CASCADE;


--
-- Name: mensaje_reacciones mensaje_reacciones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje_reacciones
    ADD CONSTRAINT mensaje_reacciones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mensajes mensajes_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id) ON DELETE CASCADE;


--
-- Name: mensajes mensajes_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.mensajes(id) ON DELETE SET NULL;


--
-- Name: mensajes mensajes_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: miembros_grupo miembros_grupo_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miembros_grupo
    ADD CONSTRAINT miembros_grupo_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id) ON DELETE CASCADE;


--
-- Name: miembros_grupo miembros_grupo_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miembros_grupo
    ADD CONSTRAINT miembros_grupo_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notificaciones notificaciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: notificaciones notificaciones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: plan plan_creado_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan
    ADD CONSTRAINT plan_creado_por_user_id_fkey FOREIGN KEY (creado_por_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: plan_fotos plan_fotos_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_fotos
    ADD CONSTRAINT plan_fotos_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: plan_fotos plan_fotos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_fotos
    ADD CONSTRAINT plan_fotos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: plan plan_owner_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan
    ADD CONSTRAINT plan_owner_group_id_fkey FOREIGN KEY (owner_group_id) REFERENCES public.grupos(id) ON DELETE RESTRICT;


--
-- Name: plan plan_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan
    ADD CONSTRAINT plan_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: plan_presupuestos plan_presupuestos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_presupuestos
    ADD CONSTRAINT plan_presupuestos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_gasto(id) ON DELETE SET NULL;


--
-- Name: plan_presupuestos plan_presupuestos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_presupuestos
    ADD CONSTRAINT plan_presupuestos_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: plan_presupuestos plan_presupuestos_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_presupuestos
    ADD CONSTRAINT plan_presupuestos_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: plan_tareas_asignados plan_tareas_asignados_tarea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tareas_asignados
    ADD CONSTRAINT plan_tareas_asignados_tarea_id_fkey FOREIGN KEY (tarea_id) REFERENCES public.plan_tareas(id) ON DELETE CASCADE;


--
-- Name: plan_tareas_asignados plan_tareas_asignados_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tareas_asignados
    ADD CONSTRAINT plan_tareas_asignados_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: plan_tareas plan_tareas_creado_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tareas
    ADD CONSTRAINT plan_tareas_creado_por_user_id_fkey FOREIGN KEY (creado_por_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: plan_tareas plan_tareas_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tareas
    ADD CONSTRAINT plan_tareas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: plan_ticket_shares plan_ticket_shares_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_ticket_shares
    ADD CONSTRAINT plan_ticket_shares_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.plan_tickets(id) ON DELETE CASCADE;


--
-- Name: plan_ticket_shares plan_ticket_shares_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_ticket_shares
    ADD CONSTRAINT plan_ticket_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: plan_tickets plan_tickets_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tickets
    ADD CONSTRAINT plan_tickets_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE SET NULL;


--
-- Name: plan_tickets plan_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tickets
    ADD CONSTRAINT plan_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: plan_usuarios plan_usuarios_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_usuarios
    ADD CONSTRAINT plan_usuarios_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: plan_usuarios plan_usuarios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_usuarios
    ADD CONSTRAINT plan_usuarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: planes_guardados planes_guardados_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes_guardados
    ADD CONSTRAINT planes_guardados_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_mensaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_mensaje_id_fkey FOREIGN KEY (mensaje_id) REFERENCES public.mensajes(id) ON DELETE CASCADE;


--
-- Name: presupuestos presupuestos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuestos
    ADD CONSTRAINT presupuestos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_gasto(id) ON DELETE SET NULL;


--
-- Name: presupuestos presupuestos_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuestos
    ADD CONSTRAINT presupuestos_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: presupuestos presupuestos_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuestos
    ADD CONSTRAINT presupuestos_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reservas reservas_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: reservas reservas_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: reservas reservas_subplan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_subplan_id_fkey FOREIGN KEY (subplan_id) REFERENCES public.subplan(id) ON DELETE SET NULL;


--
-- Name: seguidores seguidores_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguidores
    ADD CONSTRAINT seguidores_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: seguidores seguidores_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguidores
    ADD CONSTRAINT seguidores_following_id_fkey FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subplan subplan_creado_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subplan
    ADD CONSTRAINT subplan_creado_por_user_id_fkey FOREIGN KEY (creado_por_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: subplan subplan_parent_subplan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subplan
    ADD CONSTRAINT subplan_parent_subplan_id_fkey FOREIGN KEY (parent_subplan_id) REFERENCES public.subplan(id) ON DELETE CASCADE;


--
-- Name: subplan subplan_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subplan
    ADD CONSTRAINT subplan_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plan(id) ON DELETE CASCADE;


--
-- Name: subplan_usuarios subplan_usuarios_subplan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subplan_usuarios
    ADD CONSTRAINT subplan_usuarios_subplan_id_fkey FOREIGN KEY (subplan_id) REFERENCES public.subplan(id) ON DELETE CASCADE;


--
-- Name: subplan_usuarios subplan_usuarios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subplan_usuarios
    ADD CONSTRAINT subplan_usuarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: waitlist Allow public waitlist inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public waitlist inserts" ON public.waitlist FOR INSERT TO anon WITH CHECK (((email IS NOT NULL) AND (email <> ''::text)));


--
-- Name: seguidores Cualquiera puede ver seguidores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cualquiera puede ver seguidores" ON public.seguidores FOR SELECT USING (true);


--
-- Name: plan_tareas_asignados Miembros del plan pueden ver asignaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Miembros del plan pueden ver asignaciones" ON public.plan_tareas_asignados FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.plan_tareas t
     JOIN public.plan_usuarios pu ON ((pu.plan_id = t.plan_id)))
  WHERE ((t.id = plan_tareas_asignados.tarea_id) AND (pu.user_id = auth.uid())))));


--
-- Name: plan_tareas Miembros del plan pueden ver tareas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Miembros del plan pueden ver tareas" ON public.plan_tareas FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.plan_usuarios
  WHERE ((plan_usuarios.plan_id = plan_tareas.plan_id) AND (plan_usuarios.user_id = auth.uid())))));


--
-- Name: seguidores Solo el follower puede eliminar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo el follower puede eliminar" ON public.seguidores FOR DELETE USING ((auth.uid() = follower_id));


--
-- Name: seguidores Solo el follower puede insertar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo el follower puede insertar" ON public.seguidores FOR INSERT WITH CHECK ((auth.uid() = follower_id));


--
-- Name: seguidores Users can follow others; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can follow others" ON public.seguidores FOR INSERT TO authenticated WITH CHECK ((follower_id = auth.uid()));


--
-- Name: planes_guardados Users can manage their own saved plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own saved plans" ON public.planes_guardados USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: seguidores Users can read follows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read follows" ON public.seguidores FOR SELECT TO authenticated USING (true);


--
-- Name: seguidores Users can unfollow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unfollow" ON public.seguidores FOR DELETE TO authenticated USING ((follower_id = auth.uid()));


--
-- Name: push_tokens Users manage own push tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own push tokens" ON public.push_tokens USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: amistades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.amistades ENABLE ROW LEVEL SECURITY;

--
-- Name: amistades amistades_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY amistades_delete_own ON public.amistades FOR DELETE TO authenticated USING (((user_id_1 = auth.uid()) OR (user_id_2 = auth.uid())));


--
-- Name: amistades amistades_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY amistades_insert_own ON public.amistades FOR INSERT TO authenticated WITH CHECK (((user_id_1 = auth.uid()) OR (user_id_2 = auth.uid())));


--
-- Name: amistades amistades_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY amistades_select_own ON public.amistades FOR SELECT TO authenticated USING (((user_id_1 = auth.uid()) OR (user_id_2 = auth.uid())));


--
-- Name: amistades amistades_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY amistades_update_own ON public.amistades FOR UPDATE TO authenticated USING (((user_id_1 = auth.uid()) OR (user_id_2 = auth.uid()))) WITH CHECK (((user_id_1 = auth.uid()) OR (user_id_2 = auth.uid())));


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log: read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit_log: read own" ON public.audit_log FOR SELECT TO authenticated USING ((actor_user_id = auth.uid()));


--
-- Name: flight_positions auth users can upsert flight positions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth users can upsert flight positions" ON public.flight_positions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: flight_positions authenticated users can read flight positions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can read flight positions" ON public.flight_positions FOR SELECT TO authenticated USING (true);


--
-- Name: calendar_sync_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_sync_state ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_sync_state calendar_sync_state_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_sync_state_insert_own ON public.calendar_sync_state FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: calendar_sync_state calendar_sync_state_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_sync_state_select_own ON public.calendar_sync_state FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: calendar_sync_state calendar_sync_state_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_sync_state_update_own ON public.calendar_sync_state FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: categorias_gasto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categorias_gasto ENABLE ROW LEVEL SECURITY;

--
-- Name: categorias_gasto categorias_gasto: manage own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "categorias_gasto: manage own" ON public.categorias_gasto TO authenticated USING ((owner_user_id = auth.uid()));


--
-- Name: categorias_gasto categorias_gasto: read own or global; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "categorias_gasto: read own or global" ON public.categorias_gasto FOR SELECT TO authenticated USING (((owner_user_id IS NULL) OR (owner_user_id = auth.uid())));


--
-- Name: chat; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat ENABLE ROW LEVEL SECURITY;

--
-- Name: chat chat_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_insert ON public.chat FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: poll_votes chat_members_poll_votes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_members_poll_votes ON public.poll_votes USING ((EXISTS ( SELECT 1
   FROM (public.chat_miembro cm
     JOIN public.mensajes m ON ((m.chat_id = cm.chat_id)))
  WHERE ((m.id = poll_votes.mensaje_id) AND (cm.user_id = auth.uid())))));


--
-- Name: chat_miembro; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_miembro ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_miembro chat_miembro: own rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat_miembro: own rows" ON public.chat_miembro FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: chat_miembro chat_miembro_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_miembro_delete ON public.chat_miembro FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: chat_miembro chat_miembro_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_miembro_insert ON public.chat_miembro FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.chat_miembro cm
  WHERE ((cm.chat_id = chat_miembro.chat_id) AND (cm.user_id = auth.uid())))) OR (auth.uid() = user_id)));


--
-- Name: chat_miembro chat_miembro_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_miembro_update ON public.chat_miembro FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: chat chat_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_select ON public.chat FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.chat_miembro
  WHERE ((chat_miembro.chat_id = chat.id) AND (chat_miembro.user_id = auth.uid())))));


--
-- Name: chat chat_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_update ON public.chat FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.chat_miembro
  WHERE ((chat_miembro.chat_id = chat.id) AND (chat_miembro.user_id = auth.uid())))));


--
-- Name: evento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evento ENABLE ROW LEVEL SECURITY;

--
-- Name: evento evento_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evento_delete_own ON public.evento FOR DELETE TO authenticated USING (((owner_user_id = auth.uid()) AND (deleted_at IS NULL)));


--
-- Name: evento evento_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evento_insert_own ON public.evento FOR INSERT TO authenticated WITH CHECK (((owner_user_id = auth.uid()) AND (creado_por_user_id = auth.uid())));


--
-- Name: evento evento_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evento_select_own ON public.evento FOR SELECT TO authenticated USING (((owner_user_id = auth.uid()) AND (deleted_at IS NULL)));


--
-- Name: evento evento_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evento_update_own ON public.evento FOR UPDATE TO authenticated USING (((owner_user_id = auth.uid()) AND (deleted_at IS NULL))) WITH CHECK ((owner_user_id = auth.uid()));


--
-- Name: factura_gastos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.factura_gastos ENABLE ROW LEVEL SECURITY;

--
-- Name: factura_gastos factura_gastos: via gasto; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "factura_gastos: via gasto" ON public.factura_gastos TO authenticated USING ((gasto_id IN ( SELECT gastos.id
   FROM public.gastos
  WHERE (gastos.plan_id IN ( SELECT plan_usuarios.plan_id
           FROM public.plan_usuarios
          WHERE (plan_usuarios.user_id = auth.uid()))))));


--
-- Name: facturas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

--
-- Name: facturas facturas: plan members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "facturas: plan members" ON public.facturas TO authenticated USING ((plan_id IN ( SELECT plan_usuarios.plan_id
   FROM public.plan_usuarios
  WHERE (plan_usuarios.user_id = auth.uid()))));


--
-- Name: flight_positions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.flight_positions ENABLE ROW LEVEL SECURITY;

--
-- Name: gasto_item_usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gasto_item_usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: gasto_item_usuarios gasto_item_usuarios: via gasto; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "gasto_item_usuarios: via gasto" ON public.gasto_item_usuarios TO authenticated USING ((gasto_item_id IN ( SELECT gi.id
   FROM (public.gasto_items gi
     JOIN public.gastos g ON ((g.id = gi.gasto_id)))
  WHERE (g.plan_id IN ( SELECT plan_usuarios.plan_id
           FROM public.plan_usuarios
          WHERE (plan_usuarios.user_id = auth.uid()))))));


--
-- Name: gasto_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gasto_items ENABLE ROW LEVEL SECURITY;

--
-- Name: gasto_items gasto_items: via gasto; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "gasto_items: via gasto" ON public.gasto_items TO authenticated USING ((gasto_id IN ( SELECT gastos.id
   FROM public.gastos
  WHERE (gastos.plan_id IN ( SELECT plan_usuarios.plan_id
           FROM public.plan_usuarios
          WHERE (plan_usuarios.user_id = auth.uid()))))));


--
-- Name: gasto_partes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gasto_partes ENABLE ROW LEVEL SECURITY;

--
-- Name: gasto_partes gasto_partes: own or plan member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "gasto_partes: own or plan member" ON public.gasto_partes TO authenticated USING (((user_id = auth.uid()) OR (gasto_id IN ( SELECT gastos.id
   FROM public.gastos
  WHERE (gastos.plan_id IN ( SELECT plan_usuarios.plan_id
           FROM public.plan_usuarios
          WHERE (plan_usuarios.user_id = auth.uid())))))));


--
-- Name: gastos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

--
-- Name: gastos gastos: plan members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "gastos: plan members" ON public.gastos TO authenticated USING ((plan_id IN ( SELECT plan_usuarios.plan_id
   FROM public.plan_usuarios
  WHERE (plan_usuarios.user_id = auth.uid()))));


--
-- Name: liquidaciones gestión de estados de liquidacion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "gestión de estados de liquidacion" ON public.liquidaciones FOR UPDATE USING (((auth.uid() = from_user_id) OR (auth.uid() = to_user_id))) WITH CHECK (((auth.uid() = from_user_id) OR (auth.uid() = to_user_id)));


--
-- Name: grupos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

--
-- Name: grupos grupos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grupos_delete ON public.grupos FOR DELETE TO authenticated USING ((creado_por_user_id = auth.uid()));


--
-- Name: grupos grupos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grupos_insert ON public.grupos FOR INSERT TO authenticated WITH CHECK ((creado_por_user_id = auth.uid()));


--
-- Name: grupos grupos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grupos_select ON public.grupos FOR SELECT TO authenticated USING (((visibilidad = 'PUBLICO'::public.visibilidad_grupo) OR (creado_por_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.miembros_grupo m
  WHERE ((m.grupo_id = grupos.id) AND (m.user_id = auth.uid()) AND (m.estado = 'ACTIVO'::public.estado_miembro_grupo))))));


--
-- Name: grupos grupos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grupos_update ON public.grupos FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.miembros_grupo m
  WHERE ((m.grupo_id = grupos.id) AND (m.user_id = auth.uid()) AND (m.rol = 'ADMIN'::public.rol_grupo) AND (m.estado = 'ACTIVO'::public.estado_miembro_grupo)))));


--
-- Name: invitaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: invitaciones invitaciones: sender or receiver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invitaciones: sender or receiver" ON public.invitaciones TO authenticated USING (((invited_user_id = auth.uid()) OR (invited_by_user_id = auth.uid())));


--
-- Name: liquidaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: liquidaciones liquidaciones: involved users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "liquidaciones: involved users" ON public.liquidaciones TO authenticated USING (((from_user_id = auth.uid()) OR (to_user_id = auth.uid()) OR (plan_id IN ( SELECT plan_usuarios.plan_id
   FROM public.plan_usuarios
  WHERE (plan_usuarios.user_id = auth.uid())))));


--
-- Name: llamadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.llamadas ENABLE ROW LEVEL SECURITY;

--
-- Name: llamadas llamadas: insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "llamadas: insert" ON public.llamadas FOR INSERT TO authenticated WITH CHECK (((iniciado_por_user_id = auth.uid()) AND public.is_chat_member(chat_id)));


--
-- Name: llamadas llamadas: select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "llamadas: select" ON public.llamadas FOR SELECT TO authenticated USING (public.is_chat_member(chat_id));


--
-- Name: llamadas llamadas: update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "llamadas: update" ON public.llamadas FOR UPDATE TO authenticated USING (public.is_chat_member(chat_id));


--
-- Name: mensaje_reacciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mensaje_reacciones ENABLE ROW LEVEL SECURITY;

--
-- Name: mensajes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

--
-- Name: mensajes mensajes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajes_delete ON public.mensajes FOR DELETE USING ((sender_id = auth.uid()));


--
-- Name: mensajes mensajes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajes_insert ON public.mensajes FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.chat_miembro
  WHERE ((chat_miembro.chat_id = mensajes.chat_id) AND (chat_miembro.user_id = auth.uid()))))));


--
-- Name: mensajes mensajes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajes_select ON public.mensajes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.chat_miembro
  WHERE ((chat_miembro.chat_id = mensajes.chat_id) AND (chat_miembro.user_id = auth.uid())))));


--
-- Name: miembros_grupo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.miembros_grupo ENABLE ROW LEVEL SECURITY;

--
-- Name: miembros_grupo miembros_grupo_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY miembros_grupo_delete ON public.miembros_grupo FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.miembros_grupo m
  WHERE ((m.grupo_id = miembros_grupo.grupo_id) AND (m.user_id = auth.uid()) AND (m.rol = 'ADMIN'::public.rol_grupo) AND (m.estado = 'ACTIVO'::public.estado_miembro_grupo))))));


--
-- Name: miembros_grupo miembros_grupo_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY miembros_grupo_insert ON public.miembros_grupo FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.grupos g
  WHERE ((g.id = miembros_grupo.grupo_id) AND (g.creado_por_user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.miembros_grupo m
  WHERE ((m.grupo_id = miembros_grupo.grupo_id) AND (m.user_id = auth.uid()) AND (m.rol = 'ADMIN'::public.rol_grupo) AND (m.estado = 'ACTIVO'::public.estado_miembro_grupo))))));


--
-- Name: miembros_grupo miembros_grupo_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY miembros_grupo_select ON public.miembros_grupo FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.miembros_grupo m2
  WHERE ((m2.grupo_id = miembros_grupo.grupo_id) AND (m2.user_id = auth.uid()) AND (m2.estado = 'ACTIVO'::public.estado_miembro_grupo))))));


--
-- Name: miembros_grupo miembros_grupo_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY miembros_grupo_update ON public.miembros_grupo FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.miembros_grupo m
  WHERE ((m.grupo_id = miembros_grupo.grupo_id) AND (m.user_id = auth.uid()) AND (m.rol = 'ADMIN'::public.rol_grupo) AND (m.estado = 'ACTIVO'::public.estado_miembro_grupo)))));


--
-- Name: mensaje_reacciones mr_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_delete ON public.mensaje_reacciones FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: mensaje_reacciones mr_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_insert ON public.mensaje_reacciones FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: mensaje_reacciones mr_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_select ON public.mensaje_reacciones FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.mensajes m
     JOIN public.chat_miembro cm ON ((cm.chat_id = m.chat_id)))
  WHERE ((m.id = mensaje_reacciones.mensaje_id) AND (cm.user_id = auth.uid())))));


--
-- Name: mensaje_reacciones mr_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_update ON public.mensaje_reacciones FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notificaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: notificaciones notificaciones: delete propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notificaciones: delete propio" ON public.notificaciones FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notificaciones notificaciones: insert como actor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notificaciones: insert como actor" ON public.notificaciones FOR INSERT TO authenticated WITH CHECK ((actor_id = auth.uid()));


--
-- Name: notificaciones notificaciones: select propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notificaciones: select propio" ON public.notificaciones FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notificaciones notificaciones: update propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notificaciones: update propio" ON public.notificaciones FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: plan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan ENABLE ROW LEVEL SECURITY;

--
-- Name: plan plan: creator full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan: creator full access" ON public.plan TO authenticated USING ((creado_por_user_id = auth.uid()));


--
-- Name: plan plan: members read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan: members read" ON public.plan FOR SELECT TO authenticated USING ((id IN ( SELECT plan_usuarios.plan_id
   FROM public.plan_usuarios
  WHERE (plan_usuarios.user_id = auth.uid()))));


--
-- Name: plan_fotos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_fotos ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_fotos plan_fotos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_fotos_delete ON public.plan_fotos FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: plan_fotos plan_fotos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_fotos_insert ON public.plan_fotos FOR INSERT WITH CHECK (((user_id = auth.uid()) AND public.is_plan_member(plan_id)));


--
-- Name: plan_fotos plan_fotos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_fotos_select ON public.plan_fotos FOR SELECT USING (public.is_plan_member(plan_id));


--
-- Name: plan_tareas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_tareas ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_tareas_asignados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_tareas_asignados ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_ticket_shares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_ticket_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_usuarios plan_usuarios: insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan_usuarios: insert" ON public.plan_usuarios FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR (plan_id IN ( SELECT plan.id
   FROM public.plan
  WHERE (plan.creado_por_user_id = auth.uid())))));


--
-- Name: plan_usuarios plan_usuarios: select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan_usuarios: select" ON public.plan_usuarios FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (plan_id IN ( SELECT plan.id
   FROM public.plan
  WHERE (plan.creado_por_user_id = auth.uid())))));


--
-- Name: plan_usuarios plan_usuarios: update delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan_usuarios: update delete" ON public.plan_usuarios TO authenticated USING ((plan_id IN ( SELECT plan.id
   FROM public.plan
  WHERE (plan.creado_por_user_id = auth.uid()))));


--
-- Name: planes_guardados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.planes_guardados ENABLE ROW LEVEL SECURITY;

--
-- Name: poll_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: presupuestos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

--
-- Name: presupuestos presupuestos: plan members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "presupuestos: plan members" ON public.presupuestos TO authenticated USING ((plan_id IN ( SELECT plan_usuarios.plan_id
   FROM public.plan_usuarios
  WHERE (plan_usuarios.user_id = auth.uid()))));


--
-- Name: push_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: reservas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

--
-- Name: reservas reservas: plan members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reservas: plan members" ON public.reservas TO authenticated USING ((plan_id IN ( SELECT plan_usuarios.plan_id
   FROM public.plan_usuarios
  WHERE (plan_usuarios.user_id = auth.uid()))));


--
-- Name: route_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: route_cache route_cache_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_cache_select_authenticated ON public.route_cache FOR SELECT TO authenticated USING (true);


--
-- Name: seguidores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seguidores ENABLE ROW LEVEL SECURITY;

--
-- Name: flight_positions service role can upsert flight positions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role can upsert flight positions" ON public.flight_positions TO service_role USING (true);


--
-- Name: subplan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subplan ENABLE ROW LEVEL SECURITY;

--
-- Name: subplan subplan_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subplan_delete ON public.subplan FOR DELETE TO authenticated USING (false);


--
-- Name: subplan subplan_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subplan_insert ON public.subplan FOR INSERT TO authenticated WITH CHECK ((creado_por_user_id = auth.uid()));


--
-- Name: subplan subplan_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subplan_select ON public.subplan FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.plan p
  WHERE ((p.id = subplan.plan_id) AND ((p.creado_por_user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.plan_usuarios pu
          WHERE ((pu.plan_id = p.id) AND (pu.user_id = auth.uid()) AND (pu.estado = 'PARTICIPA'::public.estado_plan_usuario)))))))));


--
-- Name: subplan subplan_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subplan_update ON public.subplan FOR UPDATE TO authenticated USING ((creado_por_user_id = auth.uid())) WITH CHECK ((creado_por_user_id = auth.uid()));


--
-- Name: subplan_usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subplan_usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: subplan_usuarios subplan_usuarios: plan members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "subplan_usuarios: plan members" ON public.subplan_usuarios TO authenticated USING ((subplan_id IN ( SELECT s.id
   FROM public.subplan s
  WHERE (s.plan_id IN ( SELECT plan_usuarios.plan_id
           FROM public.plan_usuarios
          WHERE (plan_usuarios.user_id = auth.uid()))))));


--
-- Name: plan_ticket_shares ticket_shares_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ticket_shares_owner_all ON public.plan_ticket_shares USING ((EXISTS ( SELECT 1
   FROM public.plan_tickets t
  WHERE ((t.id = plan_ticket_shares.ticket_id) AND (t.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.plan_tickets t
  WHERE ((t.id = plan_ticket_shares.ticket_id) AND (t.user_id = auth.uid())))));


--
-- Name: plan_ticket_shares ticket_shares_recipient_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ticket_shares_recipient_select ON public.plan_ticket_shares FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: plan_tickets tickets_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tickets_owner_all ON public.plan_tickets USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: plan_tickets tickets_shared_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tickets_shared_select ON public.plan_tickets FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.plan_ticket_shares s
  WHERE ((s.ticket_id = plan_tickets.id) AND (s.user_id = auth.uid())))));


--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings user_settings: own only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_settings: own only" ON public.user_settings TO authenticated USING ((user_id = auth.uid()));


--
-- Name: usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: liquidaciones usuarios pueden ver sus liquidaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "usuarios pueden ver sus liquidaciones" ON public.liquidaciones FOR SELECT USING (((auth.uid() = from_user_id) OR (auth.uid() = to_user_id)));


--
-- Name: usuarios usuarios_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usuarios_insert_own ON public.usuarios FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: usuarios usuarios_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usuarios_select_own ON public.usuarios FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: usuarios usuarios_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usuarios_update_own ON public.usuarios FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION audit_if_modified(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.audit_if_modified() TO anon;
GRANT ALL ON FUNCTION public.audit_if_modified() TO authenticated;
GRANT ALL ON FUNCTION public.audit_if_modified() TO service_role;


--
-- Name: FUNCTION check_rate_limit(p_key text, p_limit integer, p_window_seconds integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer) TO anon;
GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer) TO authenticated;
GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer) TO service_role;


--
-- Name: FUNCTION feed_explore(p_limit integer, p_cursor_created_at timestamp with time zone, p_cursor_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.feed_explore(p_limit integer, p_cursor_created_at timestamp with time zone, p_cursor_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.feed_explore(p_limit integer, p_cursor_created_at timestamp with time zone, p_cursor_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.feed_explore(p_limit integer, p_cursor_created_at timestamp with time zone, p_cursor_plan_id bigint) TO service_role;


--
-- Name: FUNCTION feed_explore(p_cursor_created_at timestamp with time zone, p_cursor_plan_id bigint, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.feed_explore(p_cursor_created_at timestamp with time zone, p_cursor_plan_id bigint, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.feed_explore(p_cursor_created_at timestamp with time zone, p_cursor_plan_id bigint, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.feed_explore(p_cursor_created_at timestamp with time zone, p_cursor_plan_id bigint, p_limit integer) TO service_role;


--
-- Name: FUNCTION fn_accept_plan_invite(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_accept_plan_invite(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_accept_plan_invite(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_accept_plan_invite(p_plan_id bigint) TO service_role;


--
-- Name: TABLE plan_tickets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_tickets TO anon;
GRANT ALL ON TABLE public.plan_tickets TO authenticated;
GRANT ALL ON TABLE public.plan_tickets TO service_role;


--
-- Name: FUNCTION fn_active_friend_ferries(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_active_friend_ferries() TO anon;
GRANT ALL ON FUNCTION public.fn_active_friend_ferries() TO authenticated;
GRANT ALL ON FUNCTION public.fn_active_friend_ferries() TO service_role;


--
-- Name: FUNCTION fn_active_friend_flights(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_active_friend_flights() TO anon;
GRANT ALL ON FUNCTION public.fn_active_friend_flights() TO authenticated;
GRANT ALL ON FUNCTION public.fn_active_friend_flights() TO service_role;


--
-- Name: FUNCTION fn_balances_for_plan(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_balances_for_plan(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_balances_for_plan(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_balances_for_plan(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_bot_message_insert(p_chat_id uuid, p_texto text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_bot_message_insert(p_chat_id uuid, p_texto text) TO anon;
GRANT ALL ON FUNCTION public.fn_bot_message_insert(p_chat_id uuid, p_texto text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_bot_message_insert(p_chat_id uuid, p_texto text) TO service_role;


--
-- Name: FUNCTION fn_calendar_sync_state_set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_calendar_sync_state_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.fn_calendar_sync_state_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.fn_calendar_sync_state_set_updated_at() TO service_role;


--
-- Name: FUNCTION fn_calendar_sync_state_upsert(p_sync_enabled_snapshot boolean, p_export_plans_snapshot boolean, p_last_status text, p_last_error text, p_last_started_at timestamp with time zone, p_last_finished_at timestamp with time zone, p_last_imported_count integer, p_last_exported_count integer, p_last_calendars_count integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_calendar_sync_state_upsert(p_sync_enabled_snapshot boolean, p_export_plans_snapshot boolean, p_last_status text, p_last_error text, p_last_started_at timestamp with time zone, p_last_finished_at timestamp with time zone, p_last_imported_count integer, p_last_exported_count integer, p_last_calendars_count integer) TO anon;
GRANT ALL ON FUNCTION public.fn_calendar_sync_state_upsert(p_sync_enabled_snapshot boolean, p_export_plans_snapshot boolean, p_last_status text, p_last_error text, p_last_started_at timestamp with time zone, p_last_finished_at timestamp with time zone, p_last_imported_count integer, p_last_exported_count integer, p_last_calendars_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.fn_calendar_sync_state_upsert(p_sync_enabled_snapshot boolean, p_export_plans_snapshot boolean, p_last_status text, p_last_error text, p_last_started_at timestamp with time zone, p_last_finished_at timestamp with time zone, p_last_imported_count integer, p_last_exported_count integer, p_last_calendars_count integer) TO service_role;


--
-- Name: FUNCTION fn_chat_add_member(p_chat_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_chat_add_member(p_chat_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_chat_add_member(p_chat_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_chat_add_member(p_chat_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_chat_add_miembro(p_chat_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_chat_add_miembro(p_chat_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_chat_add_miembro(p_chat_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_chat_add_miembro(p_chat_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_chat_create_grupo(p_nombre text, p_foto text, p_miembros uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_chat_create_grupo(p_nombre text, p_foto text, p_miembros uuid[]) TO anon;
GRANT ALL ON FUNCTION public.fn_chat_create_grupo(p_nombre text, p_foto text, p_miembros uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.fn_chat_create_grupo(p_nombre text, p_foto text, p_miembros uuid[]) TO service_role;


--
-- Name: FUNCTION fn_chat_get_miembros(p_chat_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_chat_get_miembros(p_chat_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_chat_get_miembros(p_chat_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_chat_get_miembros(p_chat_id uuid) TO service_role;


--
-- Name: FUNCTION fn_chat_get_or_create_directo(p_other_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_chat_get_or_create_directo(p_other_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_chat_get_or_create_directo(p_other_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_chat_get_or_create_directo(p_other_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_chat_leave(p_chat_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_chat_leave(p_chat_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_chat_leave(p_chat_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_chat_leave(p_chat_id uuid) TO service_role;


--
-- Name: FUNCTION fn_chat_mark_read(p_chat_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_chat_mark_read(p_chat_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_chat_mark_read(p_chat_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_chat_mark_read(p_chat_id uuid) TO service_role;


--
-- Name: FUNCTION fn_chat_mis_reacciones(p_chat_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_chat_mis_reacciones(p_chat_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_chat_mis_reacciones(p_chat_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_chat_mis_reacciones(p_chat_id uuid) TO service_role;


--
-- Name: FUNCTION fn_chat_update_foto(p_chat_id uuid, p_foto text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_chat_update_foto(p_chat_id uuid, p_foto text) TO anon;
GRANT ALL ON FUNCTION public.fn_chat_update_foto(p_chat_id uuid, p_foto text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_chat_update_foto(p_chat_id uuid, p_foto text) TO service_role;


--
-- Name: FUNCTION fn_chats_list(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_chats_list() TO anon;
GRANT ALL ON FUNCTION public.fn_chats_list() TO authenticated;
GRANT ALL ON FUNCTION public.fn_chats_list() TO service_role;


--
-- Name: FUNCTION fn_cron_recordatorios_deuda(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_cron_recordatorios_deuda() TO anon;
GRANT ALL ON FUNCTION public.fn_cron_recordatorios_deuda() TO authenticated;
GRANT ALL ON FUNCTION public.fn_cron_recordatorios_deuda() TO service_role;


--
-- Name: FUNCTION fn_cron_resumen_post_viaje(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_cron_resumen_post_viaje() TO anon;
GRANT ALL ON FUNCTION public.fn_cron_resumen_post_viaje() TO authenticated;
GRANT ALL ON FUNCTION public.fn_cron_resumen_post_viaje() TO service_role;


--
-- Name: FUNCTION fn_debug2(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_debug2(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_debug2(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_debug2(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_debug3(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_debug3(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_debug3(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_debug3(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_debug4(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_debug4(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_debug4(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_debug4(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_evento_delete(p_event_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_evento_delete(p_event_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_evento_delete(p_event_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_evento_delete(p_event_id bigint) TO service_role;


--
-- Name: FUNCTION fn_evento_insert_local(p_title text, p_description text, p_category text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_all_day boolean, p_color text, p_location_name text, p_location_address text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_evento_insert_local(p_title text, p_description text, p_category text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_all_day boolean, p_color text, p_location_name text, p_location_address text) TO anon;
GRANT ALL ON FUNCTION public.fn_evento_insert_local(p_title text, p_description text, p_category text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_all_day boolean, p_color text, p_location_name text, p_location_address text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_evento_insert_local(p_title text, p_description text, p_category text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_all_day boolean, p_color text, p_location_name text, p_location_address text) TO service_role;


--
-- Name: FUNCTION fn_evento_list_by_range(p_user_id uuid, p_range_start_at timestamp with time zone, p_range_end_at timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_evento_list_by_range(p_user_id uuid, p_range_start_at timestamp with time zone, p_range_end_at timestamp with time zone, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.fn_evento_list_by_range(p_user_id uuid, p_range_start_at timestamp with time zone, p_range_end_at timestamp with time zone, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.fn_evento_list_by_range(p_user_id uuid, p_range_start_at timestamp with time zone, p_range_end_at timestamp with time zone, p_limit integer) TO service_role;


--
-- Name: FUNCTION fn_evento_set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_evento_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.fn_evento_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.fn_evento_set_updated_at() TO service_role;


--
-- Name: FUNCTION fn_evento_update_sync_info(p_event_id bigint, p_google_calendar_id text, p_google_event_id text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_evento_update_sync_info(p_event_id bigint, p_google_calendar_id text, p_google_event_id text) TO anon;
GRANT ALL ON FUNCTION public.fn_evento_update_sync_info(p_event_id bigint, p_google_calendar_id text, p_google_event_id text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_evento_update_sync_info(p_event_id bigint, p_google_calendar_id text, p_google_event_id text) TO service_role;


--
-- Name: FUNCTION fn_eventos_delete_batch(p_event_ids bigint[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_eventos_delete_batch(p_event_ids bigint[]) TO anon;
GRANT ALL ON FUNCTION public.fn_eventos_delete_batch(p_event_ids bigint[]) TO authenticated;
GRANT ALL ON FUNCTION public.fn_eventos_delete_batch(p_event_ids bigint[]) TO service_role;


--
-- Name: FUNCTION fn_eventos_get_google_for_sync(p_time_min timestamp with time zone, p_time_max timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_eventos_get_google_for_sync(p_time_min timestamp with time zone, p_time_max timestamp with time zone, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.fn_eventos_get_google_for_sync(p_time_min timestamp with time zone, p_time_max timestamp with time zone, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.fn_eventos_get_google_for_sync(p_time_min timestamp with time zone, p_time_max timestamp with time zone, p_limit integer) TO service_role;


--
-- Name: FUNCTION fn_eventos_upsert_google_batch(p_events jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_eventos_upsert_google_batch(p_events jsonb) TO anon;
GRANT ALL ON FUNCTION public.fn_eventos_upsert_google_batch(p_events jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fn_eventos_upsert_google_batch(p_events jsonb) TO service_role;


--
-- Name: FUNCTION fn_friend_remove(p_other_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_friend_remove(p_other_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_friend_remove(p_other_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_friend_remove(p_other_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_friend_request_accept(p_requester_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_friend_request_accept(p_requester_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_friend_request_accept(p_requester_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_friend_request_accept(p_requester_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_friend_request_cancel(p_target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_friend_request_cancel(p_target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_friend_request_cancel(p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_friend_request_cancel(p_target_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_friend_request_reject(p_requester_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_friend_request_reject(p_requester_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_friend_request_reject(p_requester_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_friend_request_reject(p_requester_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_friend_request_send(p_target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_friend_request_send(p_target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_friend_request_send(p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_friend_request_send(p_target_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_friends_list_active(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_friends_list_active() TO anon;
GRANT ALL ON FUNCTION public.fn_friends_list_active() TO authenticated;
GRANT ALL ON FUNCTION public.fn_friends_list_active() TO service_role;


--
-- Name: FUNCTION fn_friendship_statuses(p_user_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_friendship_statuses(p_user_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.fn_friendship_statuses(p_user_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.fn_friendship_statuses(p_user_ids uuid[]) TO service_role;


--
-- Name: FUNCTION fn_gasto_anular(p_gasto_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_gasto_anular(p_gasto_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_gasto_anular(p_gasto_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_gasto_anular(p_gasto_id bigint) TO service_role;


--
-- Name: FUNCTION fn_gasto_create(p_plan_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_gasto_create(p_plan_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb) TO anon;
GRANT ALL ON FUNCTION public.fn_gasto_create(p_plan_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fn_gasto_create(p_plan_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb) TO service_role;


--
-- Name: FUNCTION fn_gasto_create(p_plan_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb, p_receipt_url text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_gasto_create(p_plan_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb, p_receipt_url text) TO anon;
GRANT ALL ON FUNCTION public.fn_gasto_create(p_plan_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb, p_receipt_url text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_gasto_create(p_plan_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb, p_receipt_url text) TO service_role;


--
-- Name: FUNCTION fn_gasto_insert_partes(p_gasto_id bigint, p_pagado_por_user_id uuid, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_gasto_insert_partes(p_gasto_id bigint, p_pagado_por_user_id uuid, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_items jsonb) TO anon;
GRANT ALL ON FUNCTION public.fn_gasto_insert_partes(p_gasto_id bigint, p_pagado_por_user_id uuid, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_items jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fn_gasto_insert_partes(p_gasto_id bigint, p_pagado_por_user_id uuid, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_items jsonb) TO service_role;


--
-- Name: FUNCTION fn_gasto_update(p_gasto_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_gasto_update(p_gasto_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb) TO anon;
GRANT ALL ON FUNCTION public.fn_gasto_update(p_gasto_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fn_gasto_update(p_gasto_id bigint, p_titulo text, p_pagado_por_user_id uuid, p_fecha_gasto timestamp with time zone, p_total numeric, p_metodo_reparto public.metodo_reparto, p_participantes jsonb, p_descripcion text, p_subplan_id bigint, p_categoria_id bigint, p_moneda text, p_items jsonb) TO service_role;


--
-- Name: FUNCTION fn_gastos_list_for_plan(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_gastos_list_for_plan(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_gastos_list_for_plan(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_gastos_list_for_plan(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_get_or_create_plan_chat(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_get_or_create_plan_chat(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_get_or_create_plan_chat(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_get_or_create_plan_chat(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_get_pending_plan_invite_user_ids(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_get_pending_plan_invite_user_ids(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_get_pending_plan_invite_user_ids(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_get_pending_plan_invite_user_ids(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_get_plan_by_join_code(p_join_code text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_get_plan_by_join_code(p_join_code text) TO anon;
GRANT ALL ON FUNCTION public.fn_get_plan_by_join_code(p_join_code text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_get_plan_by_join_code(p_join_code text) TO service_role;


--
-- Name: FUNCTION fn_get_plan_chat_id(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_get_plan_chat_id(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_get_plan_chat_id(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_get_plan_chat_id(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_get_plan_member_ids(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_get_plan_member_ids(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_get_plan_member_ids(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_get_plan_member_ids(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_get_plan_user_rol(p_plan_id bigint, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_get_plan_user_rol(p_plan_id bigint, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_get_plan_user_rol(p_plan_id bigint, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_get_plan_user_rol(p_plan_id bigint, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_grupo_add_member(p_grupo_id bigint, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_grupo_add_member(p_grupo_id bigint, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_grupo_add_member(p_grupo_id bigint, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_grupo_add_member(p_grupo_id bigint, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_grupo_create(p_nombre text, p_visibilidad text, p_imagen text, p_miembros uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_grupo_create(p_nombre text, p_visibilidad text, p_imagen text, p_miembros uuid[]) TO anon;
GRANT ALL ON FUNCTION public.fn_grupo_create(p_nombre text, p_visibilidad text, p_imagen text, p_miembros uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.fn_grupo_create(p_nombre text, p_visibilidad text, p_imagen text, p_miembros uuid[]) TO service_role;


--
-- Name: FUNCTION fn_join_plan_by_code(p_join_code text, p_preview_only boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_join_plan_by_code(p_join_code text, p_preview_only boolean) TO anon;
GRANT ALL ON FUNCTION public.fn_join_plan_by_code(p_join_code text, p_preview_only boolean) TO authenticated;
GRANT ALL ON FUNCTION public.fn_join_plan_by_code(p_join_code text, p_preview_only boolean) TO service_role;


--
-- Name: FUNCTION fn_liquidacion_pagar(p_liquidacion_id bigint, p_comprobante_url text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_liquidacion_pagar(p_liquidacion_id bigint, p_comprobante_url text) TO anon;
GRANT ALL ON FUNCTION public.fn_liquidacion_pagar(p_liquidacion_id bigint, p_comprobante_url text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_liquidacion_pagar(p_liquidacion_id bigint, p_comprobante_url text) TO service_role;


--
-- Name: FUNCTION fn_liquidaciones_list_for_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_liquidaciones_list_for_user() TO anon;
GRANT ALL ON FUNCTION public.fn_liquidaciones_list_for_user() TO authenticated;
GRANT ALL ON FUNCTION public.fn_liquidaciones_list_for_user() TO service_role;


--
-- Name: FUNCTION fn_liquidaciones_recalculate_for_plan(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_liquidaciones_recalculate_for_plan(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_liquidaciones_recalculate_for_plan(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_liquidaciones_recalculate_for_plan(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_llamada_record(p_chat_id uuid, p_tipo text, p_duracion integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_llamada_record(p_chat_id uuid, p_tipo text, p_duracion integer) TO anon;
GRANT ALL ON FUNCTION public.fn_llamada_record(p_chat_id uuid, p_tipo text, p_duracion integer) TO authenticated;
GRANT ALL ON FUNCTION public.fn_llamada_record(p_chat_id uuid, p_tipo text, p_duracion integer) TO service_role;


--
-- Name: FUNCTION fn_mensaje_delete(p_mensaje_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_mensaje_delete(p_mensaje_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_mensaje_delete(p_mensaje_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_mensaje_delete(p_mensaje_id bigint) TO service_role;


--
-- Name: FUNCTION fn_mensaje_edit(p_mensaje_id bigint, p_texto text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_mensaje_edit(p_mensaje_id bigint, p_texto text) TO anon;
GRANT ALL ON FUNCTION public.fn_mensaje_edit(p_mensaje_id bigint, p_texto text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_mensaje_edit(p_mensaje_id bigint, p_texto text) TO service_role;


--
-- Name: FUNCTION fn_mensaje_react(p_mensaje_id bigint, p_emoji text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_mensaje_react(p_mensaje_id bigint, p_emoji text) TO anon;
GRANT ALL ON FUNCTION public.fn_mensaje_react(p_mensaje_id bigint, p_emoji text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_mensaje_react(p_mensaje_id bigint, p_emoji text) TO service_role;


--
-- Name: FUNCTION fn_mensaje_send(p_chat_id uuid, p_texto text, p_reply_to_id bigint, p_audio_url text, p_document_url text, p_document_name text, p_image_url text, p_image_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_mensaje_send(p_chat_id uuid, p_texto text, p_reply_to_id bigint, p_audio_url text, p_document_url text, p_document_name text, p_image_url text, p_image_type text) TO anon;
GRANT ALL ON FUNCTION public.fn_mensaje_send(p_chat_id uuid, p_texto text, p_reply_to_id bigint, p_audio_url text, p_document_url text, p_document_name text, p_image_url text, p_image_type text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_mensaje_send(p_chat_id uuid, p_texto text, p_reply_to_id bigint, p_audio_url text, p_document_url text, p_document_name text, p_image_url text, p_image_type text) TO service_role;


--
-- Name: FUNCTION fn_mensajes_list(p_chat_id uuid, p_limit integer, p_cursor_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_mensajes_list(p_chat_id uuid, p_limit integer, p_cursor_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_mensajes_list(p_chat_id uuid, p_limit integer, p_cursor_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_mensajes_list(p_chat_id uuid, p_limit integer, p_cursor_id bigint) TO service_role;


--
-- Name: FUNCTION fn_mis_tareas(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_mis_tareas(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_mis_tareas(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_mis_tareas(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_notificaciones_list(p_limit integer, p_cursor bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_notificaciones_list(p_limit integer, p_cursor bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_notificaciones_list(p_limit integer, p_cursor bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_notificaciones_list(p_limit integer, p_cursor bigint) TO service_role;


--
-- Name: FUNCTION fn_notificaciones_marcar_leidas(p_ids bigint[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_notificaciones_marcar_leidas(p_ids bigint[]) TO anon;
GRANT ALL ON FUNCTION public.fn_notificaciones_marcar_leidas(p_ids bigint[]) TO authenticated;
GRANT ALL ON FUNCTION public.fn_notificaciones_marcar_leidas(p_ids bigint[]) TO service_role;


--
-- Name: FUNCTION fn_notification_preferences_get(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_notification_preferences_get() TO anon;
GRANT ALL ON FUNCTION public.fn_notification_preferences_get() TO authenticated;
GRANT ALL ON FUNCTION public.fn_notification_preferences_get() TO service_role;


--
-- Name: FUNCTION fn_notification_preferences_upsert(p_preferences jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_notification_preferences_upsert(p_preferences jsonb) TO anon;
GRANT ALL ON FUNCTION public.fn_notification_preferences_upsert(p_preferences jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.fn_notification_preferences_upsert(p_preferences jsonb) TO service_role;


--
-- Name: TABLE plan; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan TO anon;
GRANT ALL ON TABLE public.plan TO authenticated;
GRANT ALL ON TABLE public.plan TO service_role;


--
-- Name: FUNCTION fn_plan_create(p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_ubicacion_nombre text, p_owner_user_id uuid, p_creado_por_user_id uuid, p_all_day boolean, p_visibilidad public.visibilidad_plan, p_ubicacion_direccion text, p_foto_portada text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_plan_create(p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_ubicacion_nombre text, p_owner_user_id uuid, p_creado_por_user_id uuid, p_all_day boolean, p_visibilidad public.visibilidad_plan, p_ubicacion_direccion text, p_foto_portada text) TO anon;
GRANT ALL ON FUNCTION public.fn_plan_create(p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_ubicacion_nombre text, p_owner_user_id uuid, p_creado_por_user_id uuid, p_all_day boolean, p_visibilidad public.visibilidad_plan, p_ubicacion_direccion text, p_foto_portada text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_plan_create(p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_ubicacion_nombre text, p_owner_user_id uuid, p_creado_por_user_id uuid, p_all_day boolean, p_visibilidad public.visibilidad_plan, p_ubicacion_direccion text, p_foto_portada text) TO service_role;


--
-- Name: FUNCTION fn_plan_create_chat(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_plan_create_chat(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_plan_create_chat(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_plan_create_chat(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_plan_demote_admin(p_plan_id bigint, p_target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_plan_demote_admin(p_plan_id bigint, p_target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_plan_demote_admin(p_plan_id bigint, p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_plan_demote_admin(p_plan_id bigint, p_target_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_plan_get_miembros(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_plan_get_miembros(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_plan_get_miembros(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_plan_get_miembros(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_plan_kick_member(p_plan_id bigint, p_target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_plan_kick_member(p_plan_id bigint, p_target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_plan_kick_member(p_plan_id bigint, p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_plan_kick_member(p_plan_id bigint, p_target_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_plan_leave(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_plan_leave(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_plan_leave(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_plan_leave(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_plan_promote_admin(p_plan_id bigint, p_target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_plan_promote_admin(p_plan_id bigint, p_target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_plan_promote_admin(p_plan_id bigint, p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_plan_promote_admin(p_plan_id bigint, p_target_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_plan_update(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at text, p_fin_at text, p_ubicacion_nombre text, p_all_day boolean, p_visibilidad text, p_foto_portada text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_plan_update(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at text, p_fin_at text, p_ubicacion_nombre text, p_all_day boolean, p_visibilidad text, p_foto_portada text) TO anon;
GRANT ALL ON FUNCTION public.fn_plan_update(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at text, p_fin_at text, p_ubicacion_nombre text, p_all_day boolean, p_visibilidad text, p_foto_portada text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_plan_update(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at text, p_fin_at text, p_ubicacion_nombre text, p_all_day boolean, p_visibilidad text, p_foto_portada text) TO service_role;


--
-- Name: FUNCTION fn_plans_get_by_ids(p_plan_ids bigint[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_plans_get_by_ids(p_plan_ids bigint[]) TO anon;
GRANT ALL ON FUNCTION public.fn_plans_get_by_ids(p_plan_ids bigint[]) TO authenticated;
GRANT ALL ON FUNCTION public.fn_plans_get_by_ids(p_plan_ids bigint[]) TO service_role;


--
-- Name: FUNCTION fn_plans_get_for_user(p_user_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_plans_get_for_user(p_user_id uuid, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.fn_plans_get_for_user(p_user_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.fn_plans_get_for_user(p_user_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION fn_poll_close(p_mensaje_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_poll_close(p_mensaje_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_poll_close(p_mensaje_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_poll_close(p_mensaje_id bigint) TO service_role;


--
-- Name: FUNCTION fn_poll_get_votes(p_mensaje_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_poll_get_votes(p_mensaje_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_poll_get_votes(p_mensaje_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_poll_get_votes(p_mensaje_id bigint) TO service_role;


--
-- Name: FUNCTION fn_poll_vote(p_mensaje_id bigint, p_option_index integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_poll_vote(p_mensaje_id bigint, p_option_index integer) TO anon;
GRANT ALL ON FUNCTION public.fn_poll_vote(p_mensaje_id bigint, p_option_index integer) TO authenticated;
GRANT ALL ON FUNCTION public.fn_poll_vote(p_mensaje_id bigint, p_option_index integer) TO service_role;


--
-- Name: FUNCTION fn_push_token_delete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_push_token_delete() TO anon;
GRANT ALL ON FUNCTION public.fn_push_token_delete() TO authenticated;
GRANT ALL ON FUNCTION public.fn_push_token_delete() TO service_role;


--
-- Name: FUNCTION fn_push_token_upsert(p_token text, p_platform text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_push_token_upsert(p_token text, p_platform text) TO anon;
GRANT ALL ON FUNCTION public.fn_push_token_upsert(p_token text, p_platform text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_push_token_upsert(p_token text, p_platform text) TO service_role;


--
-- Name: FUNCTION fn_recordar(p_plan_id bigint, p_from_user_id uuid, p_to_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_recordar(p_plan_id bigint, p_from_user_id uuid, p_to_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_recordar(p_plan_id bigint, p_from_user_id uuid, p_to_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_recordar(p_plan_id bigint, p_from_user_id uuid, p_to_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_resumen_post_viaje(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_resumen_post_viaje(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_resumen_post_viaje(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_resumen_post_viaje(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.fn_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.fn_set_updated_at() TO service_role;


--
-- Name: FUNCTION fn_subplan_create(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean, p_ubicacion_nombre text, p_ubicacion_direccion text, p_parent_subplan_id bigint, p_tipo public.tipo_subplan, p_ubicacion_fin_nombre text, p_ubicacion_fin_direccion text, p_ubicacion_lat double precision, p_ubicacion_lng double precision, p_ubicacion_fin_lat double precision, p_ubicacion_fin_lng double precision, p_transporte_llegada text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_subplan_create(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean, p_ubicacion_nombre text, p_ubicacion_direccion text, p_parent_subplan_id bigint, p_tipo public.tipo_subplan, p_ubicacion_fin_nombre text, p_ubicacion_fin_direccion text, p_ubicacion_lat double precision, p_ubicacion_lng double precision, p_ubicacion_fin_lat double precision, p_ubicacion_fin_lng double precision, p_transporte_llegada text) TO anon;
GRANT ALL ON FUNCTION public.fn_subplan_create(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean, p_ubicacion_nombre text, p_ubicacion_direccion text, p_parent_subplan_id bigint, p_tipo public.tipo_subplan, p_ubicacion_fin_nombre text, p_ubicacion_fin_direccion text, p_ubicacion_lat double precision, p_ubicacion_lng double precision, p_ubicacion_fin_lat double precision, p_ubicacion_fin_lng double precision, p_transporte_llegada text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_subplan_create(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean, p_ubicacion_nombre text, p_ubicacion_direccion text, p_parent_subplan_id bigint, p_tipo public.tipo_subplan, p_ubicacion_fin_nombre text, p_ubicacion_fin_direccion text, p_ubicacion_lat double precision, p_ubicacion_lng double precision, p_ubicacion_fin_lat double precision, p_ubicacion_fin_lng double precision, p_transporte_llegada text) TO service_role;


--
-- Name: FUNCTION fn_subplan_delete(p_subplan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_subplan_delete(p_subplan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_subplan_delete(p_subplan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_subplan_delete(p_subplan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_subplan_list(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_subplan_list(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_subplan_list(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_subplan_list(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_subplan_save_transporte(p_subplan_id bigint, p_transporte text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_subplan_save_transporte(p_subplan_id bigint, p_transporte text) TO anon;
GRANT ALL ON FUNCTION public.fn_subplan_save_transporte(p_subplan_id bigint, p_transporte text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_subplan_save_transporte(p_subplan_id bigint, p_transporte text) TO service_role;


--
-- Name: FUNCTION fn_subplan_save_viaje(p_subplan_id bigint, p_duracion text, p_distancia text, p_polyline text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_subplan_save_viaje(p_subplan_id bigint, p_duracion text, p_distancia text, p_polyline text) TO anon;
GRANT ALL ON FUNCTION public.fn_subplan_save_viaje(p_subplan_id bigint, p_duracion text, p_distancia text, p_polyline text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_subplan_save_viaje(p_subplan_id bigint, p_duracion text, p_distancia text, p_polyline text) TO service_role;


--
-- Name: FUNCTION fn_subplan_update(p_subplan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean, p_tipo text, p_ubicacion_nombre text, p_ubicacion_fin_nombre text, p_ubicacion_lat numeric, p_ubicacion_lng numeric, p_ubicacion_fin_lat numeric, p_ubicacion_fin_lng numeric, p_transporte_llegada text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_subplan_update(p_subplan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean, p_tipo text, p_ubicacion_nombre text, p_ubicacion_fin_nombre text, p_ubicacion_lat numeric, p_ubicacion_lng numeric, p_ubicacion_fin_lat numeric, p_ubicacion_fin_lng numeric, p_transporte_llegada text) TO anon;
GRANT ALL ON FUNCTION public.fn_subplan_update(p_subplan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean, p_tipo text, p_ubicacion_nombre text, p_ubicacion_fin_nombre text, p_ubicacion_lat numeric, p_ubicacion_lng numeric, p_ubicacion_fin_lat numeric, p_ubicacion_fin_lng numeric, p_transporte_llegada text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_subplan_update(p_subplan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean, p_tipo text, p_ubicacion_nombre text, p_ubicacion_fin_nombre text, p_ubicacion_lat numeric, p_ubicacion_lng numeric, p_ubicacion_fin_lat numeric, p_ubicacion_fin_lng numeric, p_transporte_llegada text) TO service_role;


--
-- Name: FUNCTION fn_tarea_create(p_plan_id bigint, p_titulo text, p_asignado_user_id uuid, p_categoria public.categoria_tarea); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_tarea_create(p_plan_id bigint, p_titulo text, p_asignado_user_id uuid, p_categoria public.categoria_tarea) TO anon;
GRANT ALL ON FUNCTION public.fn_tarea_create(p_plan_id bigint, p_titulo text, p_asignado_user_id uuid, p_categoria public.categoria_tarea) TO authenticated;
GRANT ALL ON FUNCTION public.fn_tarea_create(p_plan_id bigint, p_titulo text, p_asignado_user_id uuid, p_categoria public.categoria_tarea) TO service_role;


--
-- Name: FUNCTION fn_tarea_update_estado(p_tarea_id bigint, p_estado public.estado_tarea); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_tarea_update_estado(p_tarea_id bigint, p_estado public.estado_tarea) TO anon;
GRANT ALL ON FUNCTION public.fn_tarea_update_estado(p_tarea_id bigint, p_estado public.estado_tarea) TO authenticated;
GRANT ALL ON FUNCTION public.fn_tarea_update_estado(p_tarea_id bigint, p_estado public.estado_tarea) TO service_role;


--
-- Name: FUNCTION fn_test_gastos(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_test_gastos(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_test_gastos(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_test_gastos(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_ticket_create(p_plan_id bigint, p_type text, p_title text, p_subtitle text, p_from_label text, p_to_label text, p_place_label text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_booking_code text, p_seat_label text, p_gate_label text, p_terminal_label text, p_passenger_name text, p_notes text, p_qr_image_url text, p_barcode_value text, p_source_image_url text, p_source_pdf_url text, p_cover_color text, p_status text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_ticket_create(p_plan_id bigint, p_type text, p_title text, p_subtitle text, p_from_label text, p_to_label text, p_place_label text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_booking_code text, p_seat_label text, p_gate_label text, p_terminal_label text, p_passenger_name text, p_notes text, p_qr_image_url text, p_barcode_value text, p_source_image_url text, p_source_pdf_url text, p_cover_color text, p_status text) TO anon;
GRANT ALL ON FUNCTION public.fn_ticket_create(p_plan_id bigint, p_type text, p_title text, p_subtitle text, p_from_label text, p_to_label text, p_place_label text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_booking_code text, p_seat_label text, p_gate_label text, p_terminal_label text, p_passenger_name text, p_notes text, p_qr_image_url text, p_barcode_value text, p_source_image_url text, p_source_pdf_url text, p_cover_color text, p_status text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_ticket_create(p_plan_id bigint, p_type text, p_title text, p_subtitle text, p_from_label text, p_to_label text, p_place_label text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_booking_code text, p_seat_label text, p_gate_label text, p_terminal_label text, p_passenger_name text, p_notes text, p_qr_image_url text, p_barcode_value text, p_source_image_url text, p_source_pdf_url text, p_cover_color text, p_status text) TO service_role;


--
-- Name: FUNCTION fn_tickets_list(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_tickets_list() TO anon;
GRANT ALL ON FUNCTION public.fn_tickets_list() TO authenticated;
GRANT ALL ON FUNCTION public.fn_tickets_list() TO service_role;


--
-- Name: FUNCTION fn_tickets_list_for_plan(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_tickets_list_for_plan(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_tickets_list_for_plan(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_tickets_list_for_plan(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_todas_tareas(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_todas_tareas(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_todas_tareas(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_todas_tareas(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION fn_trigger_send_push(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_trigger_send_push() TO anon;
GRANT ALL ON FUNCTION public.fn_trigger_send_push() TO authenticated;
GRANT ALL ON FUNCTION public.fn_trigger_send_push() TO service_role;


--
-- Name: FUNCTION fn_user_auth_snapshot_get(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_user_auth_snapshot_get(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_user_auth_snapshot_get(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_user_auth_snapshot_get(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre character varying, p_fecha_nac date, p_profile_image text, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre character varying, p_fecha_nac date, p_profile_image text, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean) TO anon;
GRANT ALL ON FUNCTION public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre character varying, p_fecha_nac date, p_profile_image text, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean) TO authenticated;
GRANT ALL ON FUNCTION public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre character varying, p_fecha_nac date, p_profile_image text, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean) TO service_role;


--
-- Name: FUNCTION fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre text, p_username text, p_fecha_nac date, p_profile_image text, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean, p_google_sync_enabled boolean, p_google_sync_export_plans boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre text, p_username text, p_fecha_nac date, p_profile_image text, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean, p_google_sync_enabled boolean, p_google_sync_export_plans boolean) TO anon;
GRANT ALL ON FUNCTION public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre text, p_username text, p_fecha_nac date, p_profile_image text, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean, p_google_sync_enabled boolean, p_google_sync_export_plans boolean) TO authenticated;
GRANT ALL ON FUNCTION public.fn_user_profile_and_settings_upsert(p_user_id uuid, p_nombre text, p_username text, p_fecha_nac date, p_profile_image text, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean, p_google_sync_enabled boolean, p_google_sync_export_plans boolean) TO service_role;


--
-- Name: FUNCTION fn_user_profile_get_public(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_user_profile_get_public(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_user_profile_get_public(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_user_profile_get_public(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_user_settings_get(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_user_settings_get() TO anon;
GRANT ALL ON FUNCTION public.fn_user_settings_get() TO authenticated;
GRANT ALL ON FUNCTION public.fn_user_settings_get() TO service_role;


--
-- Name: TABLE user_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_settings TO anon;
GRANT ALL ON TABLE public.user_settings TO authenticated;
GRANT ALL ON TABLE public.user_settings TO service_role;


--
-- Name: FUNCTION fn_user_settings_upsert(p_user_id uuid, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_user_settings_upsert(p_user_id uuid, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean) TO anon;
GRANT ALL ON FUNCTION public.fn_user_settings_upsert(p_user_id uuid, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean) TO authenticated;
GRANT ALL ON FUNCTION public.fn_user_settings_upsert(p_user_id uuid, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean) TO service_role;


--
-- Name: FUNCTION fn_user_settings_upsert(p_user_id uuid, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean, p_google_sync_enabled boolean, p_google_sync_export_plans boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_user_settings_upsert(p_user_id uuid, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean, p_google_sync_enabled boolean, p_google_sync_export_plans boolean) TO anon;
GRANT ALL ON FUNCTION public.fn_user_settings_upsert(p_user_id uuid, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean, p_google_sync_enabled boolean, p_google_sync_export_plans boolean) TO authenticated;
GRANT ALL ON FUNCTION public.fn_user_settings_upsert(p_user_id uuid, p_theme public.theme_preference, p_language character varying, p_timezone character varying, p_notify_push boolean, p_notify_email boolean, p_notify_in_app boolean, p_profile_visibility character varying, p_allow_friend_requests boolean, p_google_sync_enabled boolean, p_google_sync_export_plans boolean) TO service_role;


--
-- Name: FUNCTION fn_user_update_google_refresh_token(p_refresh_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_user_update_google_refresh_token(p_refresh_token text) TO anon;
GRANT ALL ON FUNCTION public.fn_user_update_google_refresh_token(p_refresh_token text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_user_update_google_refresh_token(p_refresh_token text) TO service_role;


--
-- Name: FUNCTION fn_users_search_public(p_query text, p_limit integer, p_exclude_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_users_search_public(p_query text, p_limit integer, p_exclude_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_users_search_public(p_query text, p_limit integer, p_exclude_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_users_search_public(p_query text, p_limit integer, p_exclude_user_id uuid) TO service_role;


--
-- Name: FUNCTION fn_usuarios_email_guard(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_usuarios_email_guard() TO anon;
GRANT ALL ON FUNCTION public.fn_usuarios_email_guard() TO authenticated;
GRANT ALL ON FUNCTION public.fn_usuarios_email_guard() TO service_role;


--
-- Name: FUNCTION fn_usuarios_immutable_email(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_usuarios_immutable_email() TO anon;
GRANT ALL ON FUNCTION public.fn_usuarios_immutable_email() TO authenticated;
GRANT ALL ON FUNCTION public.fn_usuarios_immutable_email() TO service_role;


--
-- Name: FUNCTION fn_usuarios_password_hash_only(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_usuarios_password_hash_only() TO anon;
GRANT ALL ON FUNCTION public.fn_usuarios_password_hash_only() TO authenticated;
GRANT ALL ON FUNCTION public.fn_usuarios_password_hash_only() TO service_role;


--
-- Name: FUNCTION fn_usuarios_soft_delete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_usuarios_soft_delete() TO anon;
GRANT ALL ON FUNCTION public.fn_usuarios_soft_delete() TO authenticated;
GRANT ALL ON FUNCTION public.fn_usuarios_soft_delete() TO service_role;


--
-- Name: FUNCTION get_user_plan_ids(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_plan_ids(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_plan_ids(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_plan_ids(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_auth_user_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_auth_user_insert() TO anon;
GRANT ALL ON FUNCTION public.handle_auth_user_insert() TO authenticated;
GRANT ALL ON FUNCTION public.handle_auth_user_insert() TO service_role;


--
-- Name: FUNCTION handle_auth_user_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_auth_user_update() TO anon;
GRANT ALL ON FUNCTION public.handle_auth_user_update() TO authenticated;
GRANT ALL ON FUNCTION public.handle_auth_user_update() TO service_role;


--
-- Name: FUNCTION is_chat_member(p_chat_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_chat_member(p_chat_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_chat_member(p_chat_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_chat_member(p_chat_id uuid) TO service_role;


--
-- Name: FUNCTION is_plan_member(p_plan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_plan_member(p_plan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.is_plan_member(p_plan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.is_plan_member(p_plan_id bigint) TO service_role;


--
-- Name: FUNCTION purge_soft_deleted_usuarios(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.purge_soft_deleted_usuarios() TO anon;
GRANT ALL ON FUNCTION public.purge_soft_deleted_usuarios() TO authenticated;
GRANT ALL ON FUNCTION public.purge_soft_deleted_usuarios() TO service_role;


--
-- Name: FUNCTION set_updated_at_route_cache(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at_route_cache() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at_route_cache() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at_route_cache() TO service_role;


--
-- Name: FUNCTION sync_route_cache_from_subplan(p_subplan_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_route_cache_from_subplan(p_subplan_id bigint) TO anon;
GRANT ALL ON FUNCTION public.sync_route_cache_from_subplan(p_subplan_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.sync_route_cache_from_subplan(p_subplan_id bigint) TO service_role;


--
-- Name: FUNCTION trg_chats_creator_is_member(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_chats_creator_is_member() TO anon;
GRANT ALL ON FUNCTION public.trg_chats_creator_is_member() TO authenticated;
GRANT ALL ON FUNCTION public.trg_chats_creator_is_member() TO service_role;


--
-- Name: FUNCTION trg_gastos_pagador_must_be_member(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_gastos_pagador_must_be_member() TO anon;
GRANT ALL ON FUNCTION public.trg_gastos_pagador_must_be_member() TO authenticated;
GRANT ALL ON FUNCTION public.trg_gastos_pagador_must_be_member() TO service_role;


--
-- Name: FUNCTION trg_gastos_plan_subplan_match(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_gastos_plan_subplan_match() TO anon;
GRANT ALL ON FUNCTION public.trg_gastos_plan_subplan_match() TO authenticated;
GRANT ALL ON FUNCTION public.trg_gastos_plan_subplan_match() TO service_role;


--
-- Name: FUNCTION trg_grupos_creator_is_member(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_grupos_creator_is_member() TO anon;
GRANT ALL ON FUNCTION public.trg_grupos_creator_is_member() TO authenticated;
GRANT ALL ON FUNCTION public.trg_grupos_creator_is_member() TO service_role;


--
-- Name: FUNCTION trg_items_only_if_por_items(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_items_only_if_por_items() TO anon;
GRANT ALL ON FUNCTION public.trg_items_only_if_por_items() TO authenticated;
GRANT ALL ON FUNCTION public.trg_items_only_if_por_items() TO service_role;


--
-- Name: FUNCTION trg_items_subtotal_calc(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_items_subtotal_calc() TO anon;
GRANT ALL ON FUNCTION public.trg_items_subtotal_calc() TO authenticated;
GRANT ALL ON FUNCTION public.trg_items_subtotal_calc() TO service_role;


--
-- Name: FUNCTION trg_miembrosgrupo_cannot_remove_last_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_miembrosgrupo_cannot_remove_last_admin() TO anon;
GRANT ALL ON FUNCTION public.trg_miembrosgrupo_cannot_remove_last_admin() TO authenticated;
GRANT ALL ON FUNCTION public.trg_miembrosgrupo_cannot_remove_last_admin() TO service_role;


--
-- Name: FUNCTION trg_plan_create_add_creator(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_plan_create_add_creator() TO anon;
GRANT ALL ON FUNCTION public.trg_plan_create_add_creator() TO authenticated;
GRANT ALL ON FUNCTION public.trg_plan_create_add_creator() TO service_role;


--
-- Name: FUNCTION trg_plan_group_owner_requires_member(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_plan_group_owner_requires_member() TO anon;
GRANT ALL ON FUNCTION public.trg_plan_group_owner_requires_member() TO authenticated;
GRANT ALL ON FUNCTION public.trg_plan_group_owner_requires_member() TO service_role;


--
-- Name: FUNCTION trg_plan_usuario_sync_chat(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_plan_usuario_sync_chat() TO anon;
GRANT ALL ON FUNCTION public.trg_plan_usuario_sync_chat() TO authenticated;
GRANT ALL ON FUNCTION public.trg_plan_usuario_sync_chat() TO service_role;


--
-- Name: FUNCTION trg_planusuarios_cannot_remove_last_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_planusuarios_cannot_remove_last_admin() TO anon;
GRANT ALL ON FUNCTION public.trg_planusuarios_cannot_remove_last_admin() TO authenticated;
GRANT ALL ON FUNCTION public.trg_planusuarios_cannot_remove_last_admin() TO service_role;


--
-- Name: FUNCTION trg_reservas_plan_subplan_match(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_reservas_plan_subplan_match() TO anon;
GRANT ALL ON FUNCTION public.trg_reservas_plan_subplan_match() TO authenticated;
GRANT ALL ON FUNCTION public.trg_reservas_plan_subplan_match() TO service_role;


--
-- Name: FUNCTION trg_subplan_parent_same_plan(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_subplan_parent_same_plan() TO anon;
GRANT ALL ON FUNCTION public.trg_subplan_parent_same_plan() TO authenticated;
GRANT ALL ON FUNCTION public.trg_subplan_parent_same_plan() TO service_role;


--
-- Name: FUNCTION trg_subplanusuarios_require_plan_member(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_subplanusuarios_require_plan_member() TO anon;
GRANT ALL ON FUNCTION public.trg_subplanusuarios_require_plan_member() TO authenticated;
GRANT ALL ON FUNCTION public.trg_subplanusuarios_require_plan_member() TO service_role;


--
-- Name: FUNCTION trg_sync_route_cache_from_subplan(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_sync_route_cache_from_subplan() TO anon;
GRANT ALL ON FUNCTION public.trg_sync_route_cache_from_subplan() TO authenticated;
GRANT ALL ON FUNCTION public.trg_sync_route_cache_from_subplan() TO service_role;


--
-- Name: TABLE amistades; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.amistades TO anon;
GRANT ALL ON TABLE public.amistades TO authenticated;
GRANT ALL ON TABLE public.amistades TO service_role;


--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_log TO anon;
GRANT ALL ON TABLE public.audit_log TO authenticated;
GRANT ALL ON TABLE public.audit_log TO service_role;


--
-- Name: SEQUENCE audit_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.audit_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.audit_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.audit_log_id_seq TO service_role;


--
-- Name: TABLE calendar_sync_state; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.calendar_sync_state TO anon;
GRANT ALL ON TABLE public.calendar_sync_state TO authenticated;
GRANT ALL ON TABLE public.calendar_sync_state TO service_role;


--
-- Name: TABLE categorias_gasto; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categorias_gasto TO anon;
GRANT ALL ON TABLE public.categorias_gasto TO authenticated;
GRANT ALL ON TABLE public.categorias_gasto TO service_role;


--
-- Name: SEQUENCE categorias_gasto_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.categorias_gasto_id_seq TO anon;
GRANT ALL ON SEQUENCE public.categorias_gasto_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.categorias_gasto_id_seq TO service_role;


--
-- Name: TABLE chat; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat TO anon;
GRANT ALL ON TABLE public.chat TO authenticated;
GRANT ALL ON TABLE public.chat TO service_role;


--
-- Name: TABLE chat_miembro; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_miembro TO anon;
GRANT ALL ON TABLE public.chat_miembro TO authenticated;
GRANT ALL ON TABLE public.chat_miembro TO service_role;


--
-- Name: TABLE evento; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.evento TO anon;
GRANT ALL ON TABLE public.evento TO authenticated;
GRANT ALL ON TABLE public.evento TO service_role;


--
-- Name: SEQUENCE evento_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.evento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.evento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.evento_id_seq TO service_role;


--
-- Name: TABLE factura_gastos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.factura_gastos TO anon;
GRANT ALL ON TABLE public.factura_gastos TO authenticated;
GRANT ALL ON TABLE public.factura_gastos TO service_role;


--
-- Name: TABLE facturas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.facturas TO anon;
GRANT ALL ON TABLE public.facturas TO authenticated;
GRANT ALL ON TABLE public.facturas TO service_role;


--
-- Name: SEQUENCE facturas_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.facturas_id_seq TO anon;
GRANT ALL ON SEQUENCE public.facturas_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.facturas_id_seq TO service_role;


--
-- Name: TABLE flight_positions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.flight_positions TO anon;
GRANT ALL ON TABLE public.flight_positions TO authenticated;
GRANT ALL ON TABLE public.flight_positions TO service_role;


--
-- Name: TABLE gasto_item_usuarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gasto_item_usuarios TO anon;
GRANT ALL ON TABLE public.gasto_item_usuarios TO authenticated;
GRANT ALL ON TABLE public.gasto_item_usuarios TO service_role;


--
-- Name: TABLE gasto_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gasto_items TO anon;
GRANT ALL ON TABLE public.gasto_items TO authenticated;
GRANT ALL ON TABLE public.gasto_items TO service_role;


--
-- Name: SEQUENCE gasto_items_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.gasto_items_id_seq TO anon;
GRANT ALL ON SEQUENCE public.gasto_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.gasto_items_id_seq TO service_role;


--
-- Name: TABLE gasto_partes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gasto_partes TO anon;
GRANT ALL ON TABLE public.gasto_partes TO authenticated;
GRANT ALL ON TABLE public.gasto_partes TO service_role;


--
-- Name: TABLE gastos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gastos TO anon;
GRANT ALL ON TABLE public.gastos TO authenticated;
GRANT ALL ON TABLE public.gastos TO service_role;


--
-- Name: SEQUENCE gastos_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.gastos_id_seq TO anon;
GRANT ALL ON SEQUENCE public.gastos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.gastos_id_seq TO service_role;


--
-- Name: TABLE grupos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.grupos TO anon;
GRANT ALL ON TABLE public.grupos TO authenticated;
GRANT ALL ON TABLE public.grupos TO service_role;


--
-- Name: SEQUENCE grupos_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.grupos_id_seq TO anon;
GRANT ALL ON SEQUENCE public.grupos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.grupos_id_seq TO service_role;


--
-- Name: TABLE invitaciones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invitaciones TO anon;
GRANT ALL ON TABLE public.invitaciones TO authenticated;
GRANT ALL ON TABLE public.invitaciones TO service_role;


--
-- Name: SEQUENCE invitaciones_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.invitaciones_id_seq TO anon;
GRANT ALL ON SEQUENCE public.invitaciones_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.invitaciones_id_seq TO service_role;


--
-- Name: TABLE liquidaciones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.liquidaciones TO anon;
GRANT ALL ON TABLE public.liquidaciones TO authenticated;
GRANT ALL ON TABLE public.liquidaciones TO service_role;


--
-- Name: SEQUENCE liquidaciones_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.liquidaciones_id_seq TO anon;
GRANT ALL ON SEQUENCE public.liquidaciones_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.liquidaciones_id_seq TO service_role;


--
-- Name: TABLE llamadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.llamadas TO anon;
GRANT ALL ON TABLE public.llamadas TO authenticated;
GRANT ALL ON TABLE public.llamadas TO service_role;


--
-- Name: SEQUENCE llamadas_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.llamadas_id_seq TO anon;
GRANT ALL ON SEQUENCE public.llamadas_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.llamadas_id_seq TO service_role;


--
-- Name: TABLE llm_uso_diario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.llm_uso_diario TO anon;
GRANT ALL ON TABLE public.llm_uso_diario TO authenticated;
GRANT ALL ON TABLE public.llm_uso_diario TO service_role;


--
-- Name: TABLE mensaje_reacciones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mensaje_reacciones TO anon;
GRANT ALL ON TABLE public.mensaje_reacciones TO authenticated;
GRANT ALL ON TABLE public.mensaje_reacciones TO service_role;


--
-- Name: TABLE mensajes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mensajes TO anon;
GRANT ALL ON TABLE public.mensajes TO authenticated;
GRANT ALL ON TABLE public.mensajes TO service_role;


--
-- Name: SEQUENCE mensajes_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.mensajes_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mensajes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mensajes_id_seq TO service_role;


--
-- Name: TABLE miembros_grupo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.miembros_grupo TO anon;
GRANT ALL ON TABLE public.miembros_grupo TO authenticated;
GRANT ALL ON TABLE public.miembros_grupo TO service_role;


--
-- Name: TABLE notificaciones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notificaciones TO anon;
GRANT ALL ON TABLE public.notificaciones TO authenticated;
GRANT ALL ON TABLE public.notificaciones TO service_role;


--
-- Name: SEQUENCE notificaciones_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.notificaciones_id_seq TO anon;
GRANT ALL ON SEQUENCE public.notificaciones_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.notificaciones_id_seq TO service_role;


--
-- Name: TABLE plan_fotos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_fotos TO anon;
GRANT ALL ON TABLE public.plan_fotos TO authenticated;
GRANT ALL ON TABLE public.plan_fotos TO service_role;


--
-- Name: SEQUENCE plan_fotos_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.plan_fotos_id_seq TO anon;
GRANT ALL ON SEQUENCE public.plan_fotos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.plan_fotos_id_seq TO service_role;


--
-- Name: SEQUENCE plan_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.plan_id_seq TO anon;
GRANT ALL ON SEQUENCE public.plan_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.plan_id_seq TO service_role;


--
-- Name: TABLE plan_presupuestos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_presupuestos TO anon;
GRANT ALL ON TABLE public.plan_presupuestos TO authenticated;
GRANT ALL ON TABLE public.plan_presupuestos TO service_role;


--
-- Name: SEQUENCE plan_presupuestos_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.plan_presupuestos_id_seq TO anon;
GRANT ALL ON SEQUENCE public.plan_presupuestos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.plan_presupuestos_id_seq TO service_role;


--
-- Name: TABLE plan_tareas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_tareas TO anon;
GRANT ALL ON TABLE public.plan_tareas TO authenticated;
GRANT ALL ON TABLE public.plan_tareas TO service_role;


--
-- Name: TABLE plan_tareas_asignados; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_tareas_asignados TO anon;
GRANT ALL ON TABLE public.plan_tareas_asignados TO authenticated;
GRANT ALL ON TABLE public.plan_tareas_asignados TO service_role;


--
-- Name: SEQUENCE plan_tareas_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.plan_tareas_id_seq TO anon;
GRANT ALL ON SEQUENCE public.plan_tareas_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.plan_tareas_id_seq TO service_role;


--
-- Name: TABLE plan_ticket_shares; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_ticket_shares TO anon;
GRANT ALL ON TABLE public.plan_ticket_shares TO authenticated;
GRANT ALL ON TABLE public.plan_ticket_shares TO service_role;


--
-- Name: TABLE plan_usuarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_usuarios TO anon;
GRANT ALL ON TABLE public.plan_usuarios TO authenticated;
GRANT ALL ON TABLE public.plan_usuarios TO service_role;


--
-- Name: TABLE planes_guardados; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.planes_guardados TO anon;
GRANT ALL ON TABLE public.planes_guardados TO authenticated;
GRANT ALL ON TABLE public.planes_guardados TO service_role;


--
-- Name: TABLE poll_votes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.poll_votes TO anon;
GRANT ALL ON TABLE public.poll_votes TO authenticated;
GRANT ALL ON TABLE public.poll_votes TO service_role;


--
-- Name: TABLE presupuestos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.presupuestos TO anon;
GRANT ALL ON TABLE public.presupuestos TO authenticated;
GRANT ALL ON TABLE public.presupuestos TO service_role;


--
-- Name: SEQUENCE presupuestos_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.presupuestos_id_seq TO anon;
GRANT ALL ON SEQUENCE public.presupuestos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.presupuestos_id_seq TO service_role;


--
-- Name: TABLE push_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.push_tokens TO anon;
GRANT ALL ON TABLE public.push_tokens TO authenticated;
GRANT ALL ON TABLE public.push_tokens TO service_role;


--
-- Name: SEQUENCE push_tokens_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.push_tokens_id_seq TO anon;
GRANT ALL ON SEQUENCE public.push_tokens_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.push_tokens_id_seq TO service_role;


--
-- Name: TABLE rate_limits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rate_limits TO service_role;


--
-- Name: TABLE recordatorios_deuda_enviados; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recordatorios_deuda_enviados TO anon;
GRANT ALL ON TABLE public.recordatorios_deuda_enviados TO authenticated;
GRANT ALL ON TABLE public.recordatorios_deuda_enviados TO service_role;


--
-- Name: TABLE reservas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reservas TO anon;
GRANT ALL ON TABLE public.reservas TO authenticated;
GRANT ALL ON TABLE public.reservas TO service_role;


--
-- Name: SEQUENCE reservas_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.reservas_id_seq TO anon;
GRANT ALL ON SEQUENCE public.reservas_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.reservas_id_seq TO service_role;


--
-- Name: TABLE route_cache; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.route_cache TO anon;
GRANT ALL ON TABLE public.route_cache TO authenticated;
GRANT ALL ON TABLE public.route_cache TO service_role;


--
-- Name: SEQUENCE route_cache_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.route_cache_id_seq TO anon;
GRANT ALL ON SEQUENCE public.route_cache_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.route_cache_id_seq TO service_role;


--
-- Name: TABLE seguidores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.seguidores TO anon;
GRANT ALL ON TABLE public.seguidores TO authenticated;
GRANT ALL ON TABLE public.seguidores TO service_role;


--
-- Name: SEQUENCE seguidores_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.seguidores_id_seq TO anon;
GRANT ALL ON SEQUENCE public.seguidores_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.seguidores_id_seq TO service_role;


--
-- Name: TABLE subplan; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subplan TO anon;
GRANT ALL ON TABLE public.subplan TO authenticated;
GRANT ALL ON TABLE public.subplan TO service_role;


--
-- Name: SEQUENCE subplan_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.subplan_id_seq TO anon;
GRANT ALL ON SEQUENCE public.subplan_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.subplan_id_seq TO service_role;


--
-- Name: TABLE subplan_usuarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subplan_usuarios TO anon;
GRANT ALL ON TABLE public.subplan_usuarios TO authenticated;
GRANT ALL ON TABLE public.subplan_usuarios TO service_role;


--
-- Name: TABLE usuarios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.usuarios TO anon;
GRANT ALL ON TABLE public.usuarios TO authenticated;
GRANT ALL ON TABLE public.usuarios TO service_role;


--
-- Name: TABLE usuarios_public; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.usuarios_public TO anon;
GRANT ALL ON TABLE public.usuarios_public TO authenticated;
GRANT ALL ON TABLE public.usuarios_public TO service_role;


--
-- Name: TABLE waitlist; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.waitlist TO anon;
GRANT ALL ON TABLE public.waitlist TO authenticated;
GRANT ALL ON TABLE public.waitlist TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

\unrestrict S8McbnVjq0UF7KaIPamBjC4fE7QwHv7AWqeVidJNGvRd9RHznAOlPIqOh8tkJYo

