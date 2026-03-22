-- ============================================================
-- Soporte para imágenes y vídeos en mensajes
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Añadir columnas image_url e image_type a mensajes
ALTER TABLE mensajes
  ADD COLUMN IF NOT EXISTS image_url  text,
  ADD COLUMN IF NOT EXISTS image_type text;  -- mime type: image/jpeg, video/mp4, etc.


-- 2. Actualizar fn_mensaje_send
DROP FUNCTION IF EXISTS fn_mensaje_send(uuid, text, bigint, text, text, text);
DROP FUNCTION IF EXISTS fn_mensaje_send(uuid, text, bigint, text, text, text, text, text);

CREATE FUNCTION fn_mensaje_send(
  p_chat_id       uuid,
  p_texto         text,
  p_reply_to_id   bigint DEFAULT NULL,
  p_audio_url     text   DEFAULT NULL,
  p_document_url  text   DEFAULT NULL,
  p_document_name text   DEFAULT NULL,
  p_image_url     text   DEFAULT NULL,
  p_image_type    text   DEFAULT NULL
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id      bigint;
  v_preview text;
BEGIN
  INSERT INTO mensajes (chat_id, sender_id, texto, reply_to_id, audio_url, document_url, document_name, image_url, image_type)
  VALUES (p_chat_id, auth.uid(), trim(p_texto), p_reply_to_id, p_audio_url, p_document_url, p_document_name, p_image_url, p_image_type)
  RETURNING id INTO v_id;

  v_preview :=
    CASE
      WHEN p_audio_url    IS NOT NULL AND trim(p_texto) = '' THEN '🎤 Nota de voz'
      WHEN p_document_url IS NOT NULL AND trim(p_texto) = '' THEN '📄 ' || COALESCE(p_document_name, 'Documento')
      WHEN p_image_url    IS NOT NULL AND trim(p_texto) = '' THEN
        CASE WHEN p_image_type LIKE 'video/%' THEN '🎥 Vídeo' ELSE '📷 Foto' END
      ELSE trim(p_texto)
    END;

  UPDATE chat
  SET last_message    = v_preview,
      last_message_at = now()
  WHERE id = p_chat_id;

  RETURN v_id;
END; $$;


-- 3. Actualizar fn_mensajes_list
DROP FUNCTION IF EXISTS fn_mensajes_list(uuid, integer, bigint);

CREATE FUNCTION fn_mensajes_list(
  p_chat_id   uuid,
  p_limit     integer DEFAULT 30,
  p_cursor_id bigint  DEFAULT NULL
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
  reply_sender_nombre  text,
  audio_url            text,
  document_url         text,
  document_name        text,
  image_url            text,
  image_type           text
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
    rm.texto::text      AS reply_texto,
    ru.nombre::text     AS reply_sender_nombre,
    m.audio_url::text,
    m.document_url::text,
    m.document_name::text,
    m.image_url::text,
    m.image_type::text
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
