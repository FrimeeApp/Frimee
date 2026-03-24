-- ============================================================
-- RPC para guardar datos de viaje en subplan
-- Cualquier miembro del plan puede guardar la polyline calculada.
-- SECURITY DEFINER evita el bloqueo de la RLS de UPDATE.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_subplan_save_viaje(
  p_subplan_id    bigint,
  p_duracion      text,
  p_distancia     text,
  p_polyline      text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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

CREATE OR REPLACE FUNCTION fn_subplan_save_transporte(
  p_subplan_id      bigint,
  p_transporte      text  -- NULL para eliminar
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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

NOTIFY pgrst, 'reload schema';
