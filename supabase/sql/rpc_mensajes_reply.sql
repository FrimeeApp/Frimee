-- ============================================================
-- Soporte para respuestas (reply) en mensajes
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Añadir columna reply_to_id a mensajes (si no existe)
ALTER TABLE mensajes
  ADD COLUMN IF NOT EXISTS reply_to_id bigint REFERENCES mensajes(id) ON DELETE SET NULL;


-- 2. Actualizar fn_mensaje_send para aceptar reply_to_id opcional
--    Solo añade el parámetro — el resto de la lógica queda igual que el original.
DROP FUNCTION IF EXISTS fn_mensaje_send(uuid, text);
DROP FUNCTION IF EXISTS fn_mensaje_send(uuid, text, bigint);

CREATE FUNCTION fn_mensaje_send(
  p_chat_id     uuid,
  p_texto       text,
  p_reply_to_id bigint DEFAULT NULL
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO mensajes (chat_id, sender_id, texto, reply_to_id)
  VALUES (p_chat_id, auth.uid(), trim(p_texto), p_reply_to_id)
  RETURNING id INTO v_id;

  UPDATE chat
  SET last_message    = trim(p_texto),
      last_message_at = now()
  WHERE id = p_chat_id;

  RETURN v_id;
END; $$;


-- 3. Actualizar fn_mensajes_list para devolver info de respuesta
DROP FUNCTION IF EXISTS fn_mensajes_list(uuid, integer, bigint);

CREATE FUNCTION fn_mensajes_list(
  p_chat_id  uuid,
  p_limit    integer DEFAULT 30,
  p_cursor_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id                   bigint,
  sender_id            uuid,
  sender_nombre        text,
  sender_profile_image text,
  texto                text,
  created_at           timestamptz,
  reply_to_id          bigint,
  reply_texto          text,
  reply_sender_nombre  text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.sender_id,
    u.nombre::text,
    u.profile_image::text,
    m.texto,
    m.created_at,
    m.reply_to_id,
    rm.texto::text       AS reply_texto,
    ru.nombre::text      AS reply_sender_nombre
  FROM mensajes m
  JOIN usuarios u  ON u.id = m.sender_id
  LEFT JOIN mensajes rm ON rm.id = m.reply_to_id
  LEFT JOIN usuarios ru ON ru.id = rm.sender_id
  WHERE m.chat_id = p_chat_id
    AND (p_cursor_id IS NULL OR m.id < p_cursor_id)
  ORDER BY m.id DESC
  LIMIT p_limit;
END; $$;


-- Refrescar caché de PostgREST
NOTIFY pgrst, 'reload schema';
