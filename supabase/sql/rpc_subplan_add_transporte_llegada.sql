-- ============================================================
-- Añadir transporte_llegada: cómo se viaja hasta cada actividad
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. Columna ───────────────────────────────────────────
ALTER TABLE subplan
  ADD COLUMN IF NOT EXISTS transporte_llegada text; -- APIE, COCHE, TAXI, BUS, METRO, TREN

-- ─── 2. fn_subplan_list (recrear con nuevo campo) ─────────
DROP FUNCTION IF EXISTS fn_subplan_list(bigint);

CREATE FUNCTION fn_subplan_list(p_plan_id bigint)
RETURNS TABLE (
  id                      bigint,
  plan_id                 bigint,
  parent_subplan_id       bigint,
  titulo                  text,
  descripcion             text,
  inicio_at               timestamptz,
  fin_at                  timestamptz,
  all_day                 boolean,
  ubicacion_nombre        text,
  ubicacion_direccion     text,
  tipo                    text,
  ubicacion_fin_nombre    text,
  ubicacion_fin_direccion text,
  ubicacion_lat           float8,
  ubicacion_lng           float8,
  ubicacion_fin_lat       float8,
  ubicacion_fin_lng       float8,
  transporte_llegada      text,
  orden                   int,
  estado                  text,
  creado_por_user_id      uuid,
  created_at              timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- ─── 3. fn_subplan_create (recrear con nuevo parámetro) ───
CREATE OR REPLACE FUNCTION fn_subplan_create(
  p_plan_id                 bigint,
  p_titulo                  text,
  p_descripcion             text,
  p_inicio_at               timestamptz,
  p_fin_at                  timestamptz,
  p_all_day                 boolean      DEFAULT false,
  p_ubicacion_nombre        text         DEFAULT '',
  p_ubicacion_direccion     text         DEFAULT NULL,
  p_parent_subplan_id       bigint       DEFAULT NULL,
  p_tipo                    tipo_subplan DEFAULT 'ACTIVIDAD',
  p_ubicacion_fin_nombre    text         DEFAULT NULL,
  p_ubicacion_fin_direccion text         DEFAULT NULL,
  p_ubicacion_lat           float8       DEFAULT NULL,
  p_ubicacion_lng           float8       DEFAULT NULL,
  p_ubicacion_fin_lat       float8       DEFAULT NULL,
  p_ubicacion_fin_lng       float8       DEFAULT NULL,
  p_transporte_llegada      text         DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER AS $$
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
