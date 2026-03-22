-- ============================================================
-- Actualizar fn_chat_leave para también salir de miembros_grupo
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

DROP FUNCTION IF EXISTS fn_chat_leave(uuid);

CREATE FUNCTION fn_chat_leave(p_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_chat_nombre text;
  v_grupo_id    bigint;
  v_new_admin   uuid;
BEGIN
  -- 1. Si es un grupo, gestionar admin antes de salir de miembros_grupo
  SELECT nombre INTO v_chat_nombre
  FROM chat
  WHERE id = p_chat_id AND tipo = 'GRUPO';

  IF FOUND AND v_chat_nombre IS NOT NULL THEN
    SELECT id INTO v_grupo_id FROM grupos WHERE nombre = v_chat_nombre LIMIT 1;

    IF v_grupo_id IS NOT NULL THEN
      -- Si soy el último ADMIN, promover a otro miembro aleatoriamente
      IF (
        SELECT COUNT(*) FROM miembros_grupo
        WHERE grupo_id = v_grupo_id AND rol = 'ADMIN' AND estado = 'ACTIVO'
      ) = 1
      AND EXISTS (
        SELECT 1 FROM miembros_grupo
        WHERE grupo_id = v_grupo_id AND user_id = auth.uid() AND rol = 'ADMIN'
      ) THEN
        -- Elegir otro miembro activo que no sea yo
        SELECT user_id INTO v_new_admin
        FROM miembros_grupo
        WHERE grupo_id = v_grupo_id
          AND user_id <> auth.uid()
          AND estado = 'ACTIVO'
        ORDER BY random()
        LIMIT 1;

        IF v_new_admin IS NOT NULL THEN
          UPDATE miembros_grupo
          SET rol = 'ADMIN'
          WHERE grupo_id = v_grupo_id AND user_id = v_new_admin;
        END IF;
      END IF;

      -- Salir de miembros_grupo
      DELETE FROM miembros_grupo
      WHERE grupo_id = v_grupo_id AND user_id = auth.uid();
    END IF;
  END IF;

  -- 2. Salir del chat de mensajería
  DELETE FROM chat_miembro
  WHERE chat_id = p_chat_id AND user_id = auth.uid();
END; $$;

-- Refrescar caché de PostgREST
NOTIFY pgrst, 'reload schema';
