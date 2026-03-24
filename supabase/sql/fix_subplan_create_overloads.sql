-- ============================================================
-- Eliminar todos los overloads de fn_subplan_create y recrear
-- la versión definitiva con todos los parámetros actuales.
-- ============================================================

-- Borrar todas las versiones existentes (distintas firmas)
DROP FUNCTION IF EXISTS fn_subplan_create(bigint, text, text, timestamptz, timestamptz, boolean, text, text, bigint);
DROP FUNCTION IF EXISTS fn_subplan_create(bigint, text, text, timestamptz, timestamptz, boolean, text, text, bigint, tipo_subplan, text, text);
DROP FUNCTION IF EXISTS fn_subplan_create(bigint, text, text, timestamptz, timestamptz, boolean, text, text, bigint, tipo_subplan, text, text, float8, float8, float8, float8);
DROP FUNCTION IF EXISTS fn_subplan_create(bigint, text, text, timestamptz, timestamptz, boolean, text, text, bigint, tipo_subplan, text, text, float8, float8, float8, float8, text);

-- Versión definitiva con todos los parámetros
CREATE FUNCTION fn_subplan_create(
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
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
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

NOTIFY pgrst, 'reload schema';
