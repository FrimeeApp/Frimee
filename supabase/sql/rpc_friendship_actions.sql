-- ============================================================
-- Amistad — obtener estado bulk + cancelar/eliminar
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── fn_friendship_statuses ──────────────────────────────────
-- Dado un array de user_ids, devuelve el estado de amistad
-- con el usuario autenticado para cada uno.
-- Posibles valores: 'none' | 'pending' | 'friends'
CREATE OR REPLACE FUNCTION fn_friendship_statuses(p_user_ids uuid[])
RETURNS TABLE(other_user_id uuid, status text)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    u_id AS other_user_id,
    COALESCE(
      (
        SELECT
          CASE
            WHEN a.estado = 'ACTIVA'    THEN 'friends'
            WHEN a.estado = 'PENDIENTE' THEN 'pending'
            ELSE 'none'
          END
        FROM amistades a
        WHERE (
          (a.user_id_1 = auth.uid() AND a.user_id_2 = u_id)
          OR
          (a.user_id_2 = auth.uid() AND a.user_id_1 = u_id)
        )
        LIMIT 1
      ),
      'none'
    ) AS status
  FROM unnest(p_user_ids) AS u_id;
$$;

-- ─── fn_friend_request_cancel ────────────────────────────────
-- Cancela una solicitud PENDIENTE del usuario actual
CREATE OR REPLACE FUNCTION fn_friend_request_cancel(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM amistades
  WHERE estado = 'PENDIENTE'
    AND (
      (user_id_1 = auth.uid() AND user_id_2 = p_target_user_id)
      OR
      (user_id_2 = auth.uid() AND user_id_1 = p_target_user_id)
    );
END;
$$;

-- ─── fn_friend_remove ────────────────────────────────────────
-- Elimina una amistad activa
CREATE OR REPLACE FUNCTION fn_friend_remove(p_other_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM amistades
  WHERE estado = 'ACTIVA'
    AND (
      (user_id_1 = auth.uid() AND user_id_2 = p_other_user_id)
      OR
      (user_id_2 = auth.uid() AND user_id_1 = p_other_user_id)
    );
END;
$$;
