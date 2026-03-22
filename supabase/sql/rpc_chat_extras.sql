-- ============================================================
-- RPCs adicionales para chat de grupo
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

DROP FUNCTION IF EXISTS fn_chat_update_foto(uuid, text);
DROP FUNCTION IF EXISTS fn_chat_add_member(uuid, uuid);


-- ─── ACTUALIZAR FOTO DEL GRUPO ────────────────────────────
-- Cualquier miembro activo del chat puede cambiar la foto.

CREATE FUNCTION fn_chat_update_foto(p_chat_id uuid, p_foto text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chat_miembro
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No eres miembro de este chat';
  END IF;

  UPDATE chat SET foto = p_foto WHERE id = p_chat_id;
END; $$;


-- ─── AÑADIR MIEMBRO AL GRUPO ──────────────────────────────
-- Cualquier miembro activo puede añadir a otras personas.

CREATE FUNCTION fn_chat_add_member(p_chat_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_chat_nombre text;
  v_grupo_id    bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chat_miembro
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No eres miembro de este chat';
  END IF;

  -- 1. Añadir al chat de mensajería
  INSERT INTO chat_miembro (chat_id, user_id)
  VALUES (p_chat_id, p_user_id)
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  -- 2. Añadir a miembros_grupo si es un grupo
  SELECT nombre INTO v_chat_nombre
  FROM chat WHERE id = p_chat_id AND tipo = 'GRUPO';

  IF FOUND AND v_chat_nombre IS NOT NULL THEN
    SELECT id INTO v_grupo_id FROM grupos WHERE nombre = v_chat_nombre LIMIT 1;

    IF v_grupo_id IS NOT NULL THEN
      INSERT INTO miembros_grupo (grupo_id, user_id, rol, estado)
      VALUES (v_grupo_id, p_user_id, 'BASICO', 'ACTIVO')
      ON CONFLICT (grupo_id, user_id) DO UPDATE SET estado = 'ACTIVO';
    END IF;
  END IF;
END; $$;


-- ─── Refrescar caché de PostgREST ─────────────────────────
NOTIFY pgrst, 'reload schema';
