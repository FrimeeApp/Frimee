-- ============================================================
-- Añadir duracion_viaje y distancia_viaje al subplan
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE subplan
  ADD COLUMN IF NOT EXISTS duracion_viaje  text,
  ADD COLUMN IF NOT EXISTS distancia_viaje text;

-- Recrear fn_subplan_list con los nuevos campos
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
  duracion_viaje          text,
  distancia_viaje         text,
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
    s.duracion_viaje::text, s.distancia_viaje::text,
    s.orden, s.estado::text,
    s.creado_por_user_id, s.created_at
  FROM subplan s
  WHERE s.plan_id = p_plan_id
    AND s.estado = 'ACTIVO'
  ORDER BY s.inicio_at ASC, s.orden ASC;
END;
$$;
