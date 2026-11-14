-- Chat redesign «Bitácora», phase 2 (message actions).
-- 1) Pinned message, shared by the whole chat: chat.pinned_message_id (+ who and when).
--    Until now «Fijar» only lived in the page's memory and nobody else saw it.
-- 2) Starred messages, per person: mensaje_destacado. Same: they were lost on reload.
-- 3) Reactions of everyone: fn_chat_reacciones returns each emoji with its count and whether
--    it is mine (until now only my own reaction was read back).
-- 4) fn_mensaje_react checks that the caller belongs to the message's chat (it did not).
-- 5) fn_propuesta_resolver: accept or dismiss a proposal of @frimee (bot message with JSON).
-- All functions are SECURITY DEFINER and check membership with auth.uid(); anon loses EXECUTE.

-- 1) Pinned message --------------------------------------------------------------------------

ALTER TABLE public.chat
  ADD COLUMN IF NOT EXISTS pinned_message_id bigint REFERENCES public.mensajes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_by uuid,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

-- p_mensaje_id NULL unpins. Any member may pin or unpin (as in WhatsApp groups by default).
CREATE OR REPLACE FUNCTION public.fn_chat_pin(p_chat_id uuid, p_mensaje_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM chat_miembro WHERE chat_id = p_chat_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this chat' USING ERRCODE = '42501';
  END IF;
  IF p_mensaje_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM mensajes WHERE id = p_mensaje_id AND chat_id = p_chat_id) THEN
    RAISE EXCEPTION 'Message not in this chat' USING ERRCODE = '22023';
  END IF;
  UPDATE chat
     SET pinned_message_id = p_mensaje_id,
         pinned_by = CASE WHEN p_mensaje_id IS NULL THEN NULL ELSE auth.uid() END,
         pinned_at = CASE WHEN p_mensaje_id IS NULL THEN NULL ELSE now() END
   WHERE id = p_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_chat_pinned(p_chat_id uuid)
 RETURNS TABLE(mensaje_id bigint, pinned_by uuid, pinned_at timestamptz)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT c.pinned_message_id, c.pinned_by, c.pinned_at
  FROM chat c
  JOIN chat_miembro cm ON cm.chat_id = c.id AND cm.user_id = auth.uid()
  WHERE c.id = p_chat_id AND c.pinned_message_id IS NOT NULL;
$$;

-- 2) Starred messages ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mensaje_destacado (
  mensaje_id bigint NOT NULL REFERENCES public.mensajes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mensaje_id, user_id)
);
CREATE INDEX IF NOT EXISTS mensaje_destacado_user_idx ON public.mensaje_destacado (user_id);

-- Only reached through the functions below.
ALTER TABLE public.mensaje_destacado ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mensaje_destacado FROM public, anon, authenticated;
GRANT ALL ON TABLE public.mensaje_destacado TO service_role;

-- Returns the new state: true = starred.
CREATE OR REPLACE FUNCTION public.fn_mensaje_destacar(p_mensaje_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM mensajes m
    JOIN chat_miembro cm ON cm.chat_id = m.chat_id AND cm.user_id = auth.uid()
    WHERE m.id = p_mensaje_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this chat' USING ERRCODE = '42501';
  END IF;
  DELETE FROM mensaje_destacado WHERE mensaje_id = p_mensaje_id AND user_id = auth.uid();
  IF FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO mensaje_destacado (mensaje_id, user_id) VALUES (p_mensaje_id, auth.uid());
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_chat_mis_destacados(p_chat_id uuid)
 RETURNS TABLE(mensaje_id bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT d.mensaje_id
  FROM mensaje_destacado d
  JOIN mensajes m ON m.id = d.mensaje_id
  WHERE m.chat_id = p_chat_id AND d.user_id = auth.uid();
$$;

-- 3) Reactions of everyone -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_chat_reacciones(p_chat_id uuid)
 RETURNS TABLE(mensaje_id bigint, emoji text, total bigint, mia boolean)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT mr.mensaje_id, mr.emoji, COUNT(*) AS total, bool_or(mr.user_id = auth.uid()) AS mia
  FROM mensaje_reacciones mr
  JOIN mensajes m ON m.id = mr.mensaje_id
  WHERE m.chat_id = p_chat_id
    AND EXISTS (SELECT 1 FROM chat_miembro cm WHERE cm.chat_id = p_chat_id AND cm.user_id = auth.uid())
  GROUP BY mr.mensaje_id, mr.emoji;
$$;

-- 4) fn_mensaje_react: same body plus the membership check -----------------------------------

CREATE OR REPLACE FUNCTION public.fn_mensaje_react(p_mensaje_id bigint, p_emoji text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM mensajes m
    JOIN chat_miembro cm ON cm.chat_id = m.chat_id AND cm.user_id = auth.uid()
    WHERE m.id = p_mensaje_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this chat' USING ERRCODE = '42501';
  END IF;
  IF p_emoji = '' THEN
    DELETE FROM mensaje_reacciones
    WHERE mensaje_id = p_mensaje_id AND user_id = auth.uid();
  ELSE
    INSERT INTO mensaje_reacciones (mensaje_id, user_id, emoji)
    VALUES (p_mensaje_id, auth.uid(), p_emoji)
    ON CONFLICT (mensaje_id, user_id)
    DO UPDATE SET emoji = EXCLUDED.emoji;
  END IF;
END;
$$;

-- 5) @frimee proposals ------------------------------------------------------------------------
-- A plan-changing answer of @frimee is stored as a bot message whose texto is JSON
-- {"type":"propuesta","estado":"pendiente",...}. Nothing changes until a member accepts it.
-- Claiming is atomic: pendiente → aceptada|descartada only once (two people tapping at the same
-- time: the second gets false). If the action then fails, the same person returns it to
-- pendiente. resuelta_por_nombre is copied so the line «Lucía añadió …» survives renames.

CREATE OR REPLACE FUNCTION public.fn_propuesta_resolver(p_mensaje_id bigint, p_estado text, p_resultado text DEFAULT NULL)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_chat_id uuid;
  v_tipo    text;
  v_parsed  jsonb;
  v_nombre  text;
BEGIN
  IF p_estado NOT IN ('aceptada', 'descartada', 'pendiente') THEN
    RAISE EXCEPTION 'Invalid state' USING ERRCODE = '22023';
  END IF;

  SELECT chat_id, tipo, texto::jsonb INTO v_chat_id, v_tipo, v_parsed
  FROM mensajes WHERE id = p_mensaje_id
  FOR UPDATE;
  IF NOT FOUND OR v_tipo <> 'bot' OR v_parsed->>'type' <> 'propuesta' THEN
    RAISE EXCEPTION 'Not a proposal' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM chat_miembro WHERE chat_id = v_chat_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this chat' USING ERRCODE = '42501';
  END IF;

  IF p_estado = 'pendiente' THEN
    -- Undo of a failed acceptance: only by whoever claimed it.
    IF v_parsed->>'estado' = 'pendiente' THEN RETURN true; END IF;
    IF v_parsed->>'resuelta_por' IS DISTINCT FROM auth.uid()::text THEN RETURN false; END IF;
    UPDATE mensajes
       SET texto = (v_parsed - 'resuelta_por' - 'resuelta_por_nombre' - 'resuelta_at' - 'resultado'
                    || jsonb_build_object('estado', 'pendiente'))::text
     WHERE id = p_mensaje_id;
    RETURN true;
  END IF;

  IF v_parsed->>'estado' IS DISTINCT FROM 'pendiente' THEN
    RETURN false;
  END IF;

  SELECT split_part(COALESCE(nombre, ''), ' ', 1) INTO v_nombre FROM usuarios WHERE id = auth.uid();
  UPDATE mensajes
     SET texto = (v_parsed || jsonb_build_object(
           'estado', p_estado,
           'resuelta_por', auth.uid(),
           'resuelta_por_nombre', COALESCE(NULLIF(v_nombre, ''), 'Alguien'),
           'resuelta_at', now(),
           'resultado', p_resultado))::text
   WHERE id = p_mensaje_id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_propuesta_resolver(bigint, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_propuesta_resolver(bigint, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fn_chat_pin(uuid, bigint) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_chat_pinned(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_mensaje_destacar(bigint) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_chat_mis_destacados(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_chat_reacciones(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_mensaje_react(bigint, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_chat_pin(uuid, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_chat_pinned(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_mensaje_destacar(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_chat_mis_destacados(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_chat_reacciones(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_mensaje_react(bigint, text) TO authenticated, service_role;
