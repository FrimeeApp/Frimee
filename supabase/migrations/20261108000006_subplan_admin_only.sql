-- Creating and editing itinerary activities is for the plan's admins, as deleting already is
-- (20261027000002) and as the app shows it (only admins see the activity form).
-- fn_subplan_create checked nothing: any signed-in user could add activities to any plan,
-- even one they were not in. fn_subplan_update let any member edit.
-- Members can still save the computed route of a leg (fn_subplan_save_viaje) and change its
-- transport (fn_subplan_save_transporte): the app offers both to every member.
-- Bodies copied from production on 2026-11-08; only the check (and a fixed search_path) change.

CREATE OR REPLACE FUNCTION public.fn_subplan_create(p_plan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean DEFAULT false, p_ubicacion_nombre text DEFAULT ''::text, p_ubicacion_direccion text DEFAULT NULL::text, p_parent_subplan_id bigint DEFAULT NULL::bigint, p_tipo tipo_subplan DEFAULT 'ACTIVIDAD'::tipo_subplan, p_ubicacion_fin_nombre text DEFAULT NULL::text, p_ubicacion_fin_direccion text DEFAULT NULL::text, p_ubicacion_lat double precision DEFAULT NULL::double precision, p_ubicacion_lng double precision DEFAULT NULL::double precision, p_ubicacion_fin_lat double precision DEFAULT NULL::double precision, p_ubicacion_fin_lng double precision DEFAULT NULL::double precision, p_transporte_llegada text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_orden int;
  v_id    bigint;
BEGIN
  -- Only the plan's admins add activities (the app only shows them the form).
  IF NOT EXISTS (
    SELECT 1 FROM plan_usuarios pu
    WHERE pu.plan_id = p_plan_id
      AND pu.user_id = v_uid
      AND pu.estado = 'PARTICIPA'
      AND pu.rol = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.fn_subplan_update(p_subplan_id bigint, p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_all_day boolean, p_tipo text, p_ubicacion_nombre text, p_ubicacion_fin_nombre text, p_ubicacion_lat numeric, p_ubicacion_lng numeric, p_ubicacion_fin_lat numeric, p_ubicacion_fin_lng numeric, p_transporte_llegada text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM subplan sp
    JOIN plan_usuarios pu ON pu.plan_id = sp.plan_id
    WHERE sp.id = p_subplan_id
      AND pu.user_id = auth.uid()
      AND pu.estado = 'PARTICIPA'
      AND pu.rol = 'ADMIN'
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
$function$;
