-- ============================================================
-- POLLS — tabla de votos + funciones RPC
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabla de votos
CREATE TABLE IF NOT EXISTS poll_votes (
  mensaje_id  bigint  NOT NULL,
  user_id     uuid    NOT NULL DEFAULT auth.uid(),
  option_index int    NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mensaje_id, user_id),
  FOREIGN KEY (mensaje_id) REFERENCES mensajes(id) ON DELETE CASCADE
);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Solo miembros del chat pueden ver/añadir votos
CREATE POLICY "chat_members_poll_votes" ON poll_votes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_miembros cm
      JOIN mensajes m ON m.chat_id = cm.chat_id
      WHERE m.id = poll_votes.mensaje_id
        AND cm.user_id = auth.uid()
    )
  );

-- ─── fn_poll_vote ────────────────────────────────────────────
-- Vota o cambia el voto en una encuesta (upsert)
CREATE OR REPLACE FUNCTION fn_poll_vote(
  p_mensaje_id bigint,
  p_option_index int
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO poll_votes(mensaje_id, user_id, option_index)
  VALUES(p_mensaje_id, auth.uid(), p_option_index)
  ON CONFLICT(mensaje_id, user_id)
  DO UPDATE SET option_index = EXCLUDED.option_index;
END;
$$;

-- ─── fn_poll_get_votes ───────────────────────────────────────
-- Devuelve los votos agrupados por opción y si el usuario actual ya votó
CREATE OR REPLACE FUNCTION fn_poll_get_votes(p_mensaje_id bigint)
RETURNS TABLE(
  option_index  int,
  vote_count    bigint,
  voted_by_me   boolean
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    v.option_index,
    COUNT(*)::bigint                       AS vote_count,
    bool_or(v.user_id = auth.uid())        AS voted_by_me
  FROM poll_votes v
  WHERE v.mensaje_id = p_mensaje_id
  GROUP BY v.option_index;
$$;
