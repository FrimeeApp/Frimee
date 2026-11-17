-- Actividades: las añade, edita y borra cualquier miembro del plan (2026-11-17).
--
-- Hasta ahora solo los administradores (20261108000006). Decisión de producto: en un plan de
-- grupo todos aportan actividades y gastos (los gastos ya los permitía la base de datos);
-- editar el plan, invitar, expulsar y borrarlo siguen siendo de los administradores.
-- Sigue sin poder tocarlas quien no está en el plan (estado PARTICIPA).
-- Más adelante, roles dentro del plan asignados por el administrador podrán restringirlo.
-- Cuerpos copiados de producción el 2026-11-17; solo cambia la comprobación.

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
  -- Any member of the plan adds activities.
  IF NOT EXISTS (
    SELECT 1 FROM plan_usuarios pu
    WHERE pu.plan_id = p_plan_id
      AND pu.user_id = v_uid
      AND pu.estado = 'PARTICIPA'
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

CREATE OR REPLACE FUNCTION public.fn_subplan_delete(p_subplan_id bigint, p_delete_gastos boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_gasto_id bigint;
begin
  if not exists (
    select 1 from subplan sp
    join plan_usuarios pu on pu.plan_id = sp.plan_id
    where sp.id = p_subplan_id
      and pu.user_id = auth.uid()
      and pu.estado = 'PARTICIPA'
  ) then
    raise exception 'No autorizado';
  end if;

  if p_delete_gastos then
    -- Same path as voiding one expense in the app: removes its shares and recalculates balances.
    for v_gasto_id in
      select id from gastos where subplan_id = p_subplan_id and deleted_at is null
    loop
      perform fn_gasto_anular(v_gasto_id);
    end loop;
  else
    update gastos
       set subplan_id = null, updated_at = now()
     where subplan_id = p_subplan_id and deleted_at is null;
  end if;

  update subplan
     set estado = 'CANCELADO'
   where id = p_subplan_id;
end;
$function$;
