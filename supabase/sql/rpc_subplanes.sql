-- ============================================================
-- RPCs para subplanes
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── LISTAR subplanes de un plan ─────────────────────────────

CREATE OR REPLACE FUNCTION fn_subplan_list(p_plan_id bigint)
RETURNS TABLE (
  id              bigint,
  plan_id         bigint,
  parent_subplan_id bigint,
  titulo          text,
  descripcion     text,
  inicio_at       timestamptz,
  fin_at          timestamptz,
  all_day         boolean,
  ubicacion_nombre text,
  ubicacion_direccion text,
  orden           int,
  estado          text,
  creado_por_user_id uuid,
  created_at      timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.plan_id,
    s.parent_subplan_id,
    s.titulo::text,
    s.descripcion,
    s.inicio_at,
    s.fin_at,
    s.all_day,
    s.ubicacion_nombre::text,
    s.ubicacion_direccion::text,
    s.orden,
    s.estado::text,
    s.creado_por_user_id,
    s.created_at
  FROM subplan s
  WHERE s.plan_id = p_plan_id
    AND s.estado = 'ACTIVO'
  ORDER BY s.inicio_at ASC, s.orden ASC;
END;
$$;

-- ─── CREAR subplan ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_subplan_create(
  p_plan_id           bigint,
  p_titulo            text,
  p_descripcion       text,
  p_inicio_at         timestamptz,
  p_fin_at            timestamptz,
  p_all_day           boolean DEFAULT false,
  p_ubicacion_nombre  text    DEFAULT '',
  p_ubicacion_direccion text  DEFAULT NULL,
  p_parent_subplan_id bigint  DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_orden int;
  v_id    bigint;
BEGIN
  -- Calcular siguiente orden dentro del mismo contexto (plan + parent)
  SELECT COALESCE(MAX(orden), 0) + 1
    INTO v_orden
    FROM subplan
   WHERE plan_id = p_plan_id
     AND (
       (p_parent_subplan_id IS NULL AND parent_subplan_id IS NULL)
       OR parent_subplan_id = p_parent_subplan_id
     );

  INSERT INTO subplan (
    plan_id, parent_subplan_id, titulo, descripcion,
    inicio_at, fin_at, all_day,
    ubicacion_nombre, ubicacion_direccion,
    orden, creado_por_user_id
  ) VALUES (
    p_plan_id, p_parent_subplan_id, p_titulo, p_descripcion,
    p_inicio_at, p_fin_at, p_all_day,
    p_ubicacion_nombre, p_ubicacion_direccion,
    v_orden, v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── ELIMINAR subplan (soft delete) ──────────────────────────

CREATE OR REPLACE FUNCTION fn_subplan_delete(p_subplan_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE subplan
     SET estado = 'CANCELADO'
   WHERE id = p_subplan_id
     AND creado_por_user_id = auth.uid();
END;
$$;
