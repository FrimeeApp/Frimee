-- «Nuevo plan» (2026-11-16): la descripción es opcional (paso «Detalles»). fn_plan_create ya no la
-- exige; sin descripción guarda '' (plan.descripcion sigue NOT NULL; fn_plan_update ya aceptaba '').
-- Mismo cuerpo que en 20261108000001_lock_definer_functions.sql salvo esa comprobación.

CREATE OR REPLACE FUNCTION public.fn_plan_create(p_titulo text, p_descripcion text, p_inicio_at timestamp with time zone, p_fin_at timestamp with time zone, p_ubicacion_nombre text, p_owner_user_id uuid, p_creado_por_user_id uuid, p_all_day boolean DEFAULT false, p_visibilidad visibilidad_plan DEFAULT 'SOLO_GRUPO'::visibilidad_plan, p_ubicacion_direccion text DEFAULT NULL::text, p_foto_portada text DEFAULT NULL::text)
 RETURNS plan
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.plan;
begin
  perform public.assert_allowed(auth.uid() is not null and p_creado_por_user_id = auth.uid() and (p_owner_user_id is null or p_owner_user_id = auth.uid()));
  if p_titulo is null or btrim(p_titulo) = '' then
    raise exception 'Titulo requerido';
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
    btrim(coalesce(p_descripcion, '')),
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
$function$;
