-- ============================================================
-- Registro de llamadas en el chat
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Añadir columna tipo a mensajes (default 'text' para mensajes existentes)
ALTER TABLE mensajes
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'text';

-- 2. Función para insertar registro de llamada en el chat
--    Llamada desde el iniciador al colgar.
--    SECURITY DEFINER para poder insertar sin problemas de RLS.
CREATE OR REPLACE FUNCTION fn_llamada_record(
  p_chat_id   uuid,
  p_tipo      text,     -- 'call_audio' | 'call_video' | 'call_missed_audio' | 'call_missed_video'
  p_duracion  integer DEFAULT NULL  -- segundos; NULL = llamada perdida/cancelada
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id      bigint;
  v_preview text;
BEGIN
  INSERT INTO mensajes (chat_id, sender_id, texto, tipo)
  VALUES (
    p_chat_id,
    auth.uid(),
    COALESCE(p_duracion::text, '0'),
    p_tipo
  )
  RETURNING id INTO v_id;

  v_preview :=
    CASE p_tipo
      WHEN 'call_audio'        THEN '📞 Llamada de audio'
      WHEN 'call_video'        THEN '📹 Videollamada'
      WHEN 'call_missed_audio' THEN '📞 Llamada perdida'
      WHEN 'call_missed_video' THEN '📹 Videollamada perdida'
      ELSE '📞 Llamada'
    END;

  UPDATE chat
  SET last_message    = v_preview,
      last_message_at = now()
  WHERE id = p_chat_id;

  RETURN v_id;
END; $$;

-- 3. Actualizar fn_mensajes_list para devolver tipo
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
  image_type           text,
  tipo                 text
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
    m.image_type::text,
    m.tipo::text
  FROM mensajes m
  JOIN usuarios u  ON u.id = m.sender_id
  LEFT JOIN mensajes rm ON rm.id = m.reply_to_id
  LEFT JOIN usuarios ru ON ru.id = rm.sender_id
  WHERE m.chat_id = p_chat_id
    AND (p_cursor_id IS NULL OR m.id < p_cursor_id)
  ORDER BY m.id DESC
  LIMIT p_limit;
END; $$;

NOTIFY pgrst, 'reload schema';
