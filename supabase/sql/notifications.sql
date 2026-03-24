-- ============================================================
-- Tabla de notificaciones
-- ============================================================

CREATE TABLE IF NOT EXISTS notificaciones (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- destinatario
  tipo          text NOT NULL CHECK (tipo IN (
                  'like',           -- alguien da like a tu post
                  'comment',        -- alguien comenta tu post
                  'friend_request', -- solicitud de amistad
                  'friend_accept',  -- solicitud aceptada
                  'plan_invite',    -- invitación a un plan
                  'mention'         -- mencionado en comentario
                )),
  actor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- quien genera la notificación
  entity_id     text,   -- id del post/plan/comentario relacionado (flexible)
  entity_type   text,   -- 'post' | 'plan' | 'comment' | 'friendship'
  leida         boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS notificaciones_user_id_idx    ON notificaciones (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notificaciones_user_leida_idx ON notificaciones (user_id, leida) WHERE leida = false;

-- RLS
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificaciones: solo el destinatario" ON notificaciones
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Realtime (para badge en tiempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;

-- ── RPC: marcar como leídas ────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notificaciones_marcar_leidas(
  p_ids bigint[] DEFAULT NULL  -- NULL = marcar todas
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE notificaciones
  SET leida = true
  WHERE user_id = auth.uid()
    AND leida   = false
    AND (p_ids IS NULL OR id = ANY(p_ids));
END;
$$;

-- ── RPC: listar notificaciones con info del actor ──────────
CREATE OR REPLACE FUNCTION fn_notificaciones_list(
  p_limit  integer DEFAULT 30,
  p_cursor bigint  DEFAULT NULL
)
RETURNS TABLE (
  id          bigint,
  tipo        text,
  actor_id    uuid,
  actor_nombre text,
  actor_foto  text,
  entity_id   text,
  entity_type text,
  leida       boolean,
  created_at  timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.tipo,
    n.actor_id,
    u.nombre::text,
    u.profile_image::text,
    n.entity_id,
    n.entity_type,
    n.leida,
    n.created_at
  FROM notificaciones n
  LEFT JOIN usuarios u ON u.id = n.actor_id
  WHERE n.user_id = auth.uid()
    AND (p_cursor IS NULL OR n.id < p_cursor)
  ORDER BY n.created_at DESC
  LIMIT p_limit;
END;
$$;

NOTIFY pgrst, 'reload schema';
