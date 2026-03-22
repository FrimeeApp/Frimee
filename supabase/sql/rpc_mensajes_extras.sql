-- ============================================================
-- RPCs para editar y eliminar mensajes
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

DROP FUNCTION IF EXISTS fn_mensaje_edit(bigint, text);
DROP FUNCTION IF EXISTS fn_mensaje_delete(bigint);


-- ─── EDITAR MENSAJE ───────────────────────────────────────
-- Solo el autor puede editar su propio mensaje.

CREATE FUNCTION fn_mensaje_edit(p_mensaje_id bigint, p_texto text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF trim(p_texto) = '' THEN
    RAISE EXCEPTION 'El mensaje no puede estar vacío';
  END IF;

  UPDATE mensajes
  SET texto = trim(p_texto)
  WHERE id        = p_mensaje_id
    AND sender_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permiso para editar este mensaje';
  END IF;
END; $$;


-- ─── ELIMINAR MENSAJE ─────────────────────────────────────
-- Solo el autor puede eliminar su propio mensaje.

CREATE FUNCTION fn_mensaje_delete(p_mensaje_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM mensajes
  WHERE id        = p_mensaje_id
    AND sender_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar este mensaje';
  END IF;
END; $$;


-- Refrescar caché de PostgREST
NOTIFY pgrst, 'reload schema';
