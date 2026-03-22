-- ============================================================
-- Tabla y RPCs para reacciones a mensajes
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tabla
CREATE TABLE IF NOT EXISTS mensaje_reacciones (
  mensaje_id bigint NOT NULL REFERENCES mensajes(id) ON DELETE CASCADE,
  user_id    uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text   NOT NULL,
  PRIMARY KEY (mensaje_id, user_id)
);

-- 2. RLS
ALTER TABLE mensaje_reacciones ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede leer sus propias reacciones.
-- Los RPCs son SECURITY DEFINER y gestionan el acceso a reacciones ajenas.
CREATE POLICY "mr_select" ON mensaje_reacciones FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "mr_insert" ON mensaje_reacciones FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "mr_update" ON mensaje_reacciones FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "mr_delete" ON mensaje_reacciones FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- 3. fn_mensaje_react — añadir, cambiar o quitar reacción
--    Pasar emoji vacío ('') para eliminar la reacción existente.
DROP FUNCTION IF EXISTS fn_mensaje_react(bigint, text);

CREATE FUNCTION fn_mensaje_react(p_mensaje_id bigint, p_emoji text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_emoji = '' THEN
    DELETE FROM mensaje_reacciones
    WHERE mensaje_id = p_mensaje_id AND user_id = auth.uid();
  ELSE
    INSERT INTO mensaje_reacciones (mensaje_id, user_id, emoji)
    VALUES (p_mensaje_id, auth.uid(), p_emoji)
    ON CONFLICT (mensaje_id, user_id)
    DO UPDATE SET emoji = EXCLUDED.emoji;
  END IF;
END; $$;


-- 4. fn_chat_mis_reacciones — obtener las reacciones del usuario en un chat
DROP FUNCTION IF EXISTS fn_chat_mis_reacciones(uuid);

CREATE FUNCTION fn_chat_mis_reacciones(p_chat_id uuid)
RETURNS TABLE (mensaje_id bigint, emoji text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT mr.mensaje_id, mr.emoji
  FROM mensaje_reacciones mr
  JOIN mensajes m ON m.id = mr.mensaje_id
  WHERE m.chat_id  = p_chat_id
    AND mr.user_id = auth.uid();
END; $$;


-- Refrescar caché de PostgREST
NOTIFY pgrst, 'reload schema';
