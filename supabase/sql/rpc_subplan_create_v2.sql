-- ============================================================
-- Actualizar fn_subplan_create con tipo + ubicacion_fin
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION fn_subplan_create(
  p_plan_id                bigint,
  p_titulo                 text,
  p_descripcion            text,
  p_inicio_at              timestamptz,
  p_fin_at                 timestamptz,
  p_all_day                boolean       DEFAULT false,
  p_ubicacion_nombre       text          DEFAULT '',
  p_ubicacion_direccion    text          DEFAULT NULL,
  p_parent_subplan_id      bigint        DEFAULT NULL,
  p_tipo                   tipo_subplan  DEFAULT 'ACTIVIDAD',
  p_ubicacion_fin_nombre   text          DEFAULT NULL,
  p_ubicacion_fin_direccion text         DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_orden int;
  v_id    bigint;
BEGIN
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
    tipo, ubicacion_fin_nombre, ubicacion_fin_direccion,
    orden, creado_por_user_id
  ) VALUES (
    p_plan_id, p_parent_subplan_id, p_titulo, p_descripcion,
    p_inicio_at, p_fin_at, p_all_day,
    p_ubicacion_nombre, p_ubicacion_direccion,
    p_tipo, p_ubicacion_fin_nombre, p_ubicacion_fin_direccion,
    v_orden, v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
