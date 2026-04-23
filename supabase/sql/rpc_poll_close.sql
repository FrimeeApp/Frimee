-- ============================================================
-- fn_poll_close — cierra una encuesta
-- Permite a cualquier miembro del chat cerrarla,
-- independientemente de quién la creó (incluyendo el bot).
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION fn_poll_close(p_mensaje_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_chat_id uuid;
  v_texto   text;
  v_parsed  jsonb;
BEGIN
  -- Get message
  SELECT chat_id, texto INTO v_chat_id, v_texto
  FROM mensajes
  WHERE id = p_mensaje_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Caller must be a chat member
  IF NOT EXISTS (
    SELECT 1 FROM chat_miembro
    WHERE chat_id = v_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;

  -- Must be a poll
  v_parsed := v_texto::jsonb;
  IF v_parsed->>'type' != 'poll' THEN
    RAISE EXCEPTION 'Not a poll message';
  END IF;

  -- Close it
  UPDATE mensajes
  SET texto = (v_parsed || '{"closed": true}')::text
  WHERE id = p_mensaje_id;
END;
$$;
