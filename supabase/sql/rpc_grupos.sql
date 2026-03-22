-- ============================================================
-- RPCs para grupos y miembros_grupo
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

DROP FUNCTION IF EXISTS fn_grupo_create(text, text, text, uuid[]);
DROP FUNCTION IF EXISTS fn_grupo_add_member(bigint, uuid);


-- ─── CREAR GRUPO ──────────────────────────────────────────────
-- Inserta en `grupos` (el trigger trg_grupos_creator_is_member añade
-- automáticamente al creador como ADMIN en miembros_grupo).
-- Luego inserta los miembros iniciales como BASICO.

CREATE FUNCTION fn_grupo_create(
  p_nombre      text,
  p_visibilidad text,
  p_imagen      text   DEFAULT NULL,
  p_miembros    uuid[] DEFAULT '{}'
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id  bigint;
  v_uid uuid := auth.uid();
BEGIN
  IF trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre del grupo no puede estar vacío';
  END IF;

  INSERT INTO grupos (nombre, visibilidad, creado_por_user_id, imagen)
  VALUES (trim(p_nombre), p_visibilidad::visibilidad_grupo, v_uid, nullif(trim(p_imagen), ''))
  RETURNING id INTO v_id;

  -- Añadir miembros iniciales (excluyendo al creador, que ya lo añade el trigger)
  INSERT INTO miembros_grupo (grupo_id, user_id, rol, estado)
  SELECT v_id, u.id, 'BASICO'::rol_grupo, 'ACTIVO'::estado_miembro_grupo
  FROM unnest(p_miembros) AS u(id)
  WHERE u.id <> v_uid
  ON CONFLICT (grupo_id, user_id) DO NOTHING;

  RETURN v_id;
END; $$;


-- ─── AÑADIR MIEMBRO ───────────────────────────────────────────
-- Solo un ADMIN activo del grupo puede añadir nuevos miembros.

CREATE FUNCTION fn_grupo_add_member(p_grupo_id bigint, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM miembros_grupo
    WHERE grupo_id = p_grupo_id
      AND user_id  = auth.uid()
      AND rol      = 'ADMIN'
      AND estado   = 'ACTIVO'
  ) THEN
    RAISE EXCEPTION 'No tienes permisos de administrador en este grupo';
  END IF;

  INSERT INTO miembros_grupo (grupo_id, user_id, rol, estado)
  VALUES (p_grupo_id, p_user_id, 'BASICO'::rol_grupo, 'ACTIVO'::estado_miembro_grupo)
  ON CONFLICT (grupo_id, user_id) DO UPDATE SET estado = 'ACTIVO'::estado_miembro_grupo;
END; $$;


-- ─── Refrescar caché de PostgREST ─────────────────────────────
NOTIFY pgrst, 'reload schema';
