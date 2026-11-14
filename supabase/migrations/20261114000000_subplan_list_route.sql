-- fn_subplan_list returns the saved leg of each activity (duracion_viaje, distancia_viaje,
-- ruta_polyline). Without them every reload of the itinerary lost the travel time and the map
-- asked Google for every leg again, although fn_subplan_save_viaje had stored them.
-- The return type changes, so the function is dropped and created again (CREATE OR REPLACE
-- cannot change RETURNS TABLE). Body as in 20261108000001_lock_definer_functions.sql plus the
-- three columns and a fixed search_path.

DROP FUNCTION IF EXISTS public.fn_subplan_list(bigint);

CREATE FUNCTION public.fn_subplan_list(p_plan_id bigint)
 RETURNS TABLE(id bigint, plan_id bigint, parent_subplan_id bigint, titulo text, descripcion text, inicio_at timestamp with time zone, fin_at timestamp with time zone, all_day boolean, ubicacion_nombre text, ubicacion_direccion text, tipo text, ubicacion_fin_nombre text, ubicacion_fin_direccion text, ubicacion_lat double precision, ubicacion_lng double precision, ubicacion_fin_lat double precision, ubicacion_fin_lng double precision, transporte_llegada text, duracion_viaje text, distancia_viaje text, ruta_polyline text, orden integer, estado text, creado_por_user_id uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    s.duracion_viaje, s.distancia_viaje, s.ruta_polyline,
    s.orden, s.estado::text,
    s.creado_por_user_id, s.created_at
  FROM subplan s
  WHERE s.plan_id = p_plan_id
    AND s.estado = 'ACTIVO'
  ORDER BY s.inicio_at ASC, s.orden ASC;
END;
$function$;

-- Same privileges as before: members call it signed in (also guests), never anon.
REVOKE EXECUTE ON FUNCTION public.fn_subplan_list(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_subplan_list(bigint) TO authenticated, service_role;
