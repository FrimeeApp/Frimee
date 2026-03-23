-- ============================================================
-- Patch fn_friend_request_send: inserta notificación al enviar
-- fn_friend_request_accept: acepta y notifica al solicitante
-- ============================================================

-- ─── fn_friend_request_send (con notificación) ───────────────
CREATE OR REPLACE FUNCTION fn_friend_request_send(p_target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_user1 uuid;
  v_user2 uuid;
BEGIN
  IF v_uid = p_target_user_id THEN
    RAISE EXCEPTION 'No puedes añadirte a ti mismo como amigo';
  END IF;

  IF v_uid < p_target_user_id THEN
    v_user1 := v_uid;  v_user2 := p_target_user_id;
  ELSE
    v_user1 := p_target_user_id;  v_user2 := v_uid;
  END IF;

  INSERT INTO amistades (user_id_1, user_id_2, estado)
  VALUES (v_user1, v_user2, 'PENDIENTE')
  ON CONFLICT (user_id_1, user_id_2) DO NOTHING;

  -- Notificar al destinatario solo si se creó la fila
  IF FOUND THEN
    INSERT INTO notificaciones (user_id, tipo, actor_id, entity_type)
    VALUES (p_target_user_id, 'friend_request', v_uid, 'friendship');
  END IF;
END; $$;


-- ─── fn_friend_request_accept ────────────────────────────────
-- El usuario autenticado acepta la solicitud del p_requester_user_id
CREATE OR REPLACE FUNCTION fn_friend_request_accept(p_requester_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_user1 uuid;
  v_user2 uuid;
BEGIN
  IF v_uid < p_requester_user_id THEN
    v_user1 := v_uid;  v_user2 := p_requester_user_id;
  ELSE
    v_user1 := p_requester_user_id;  v_user2 := v_uid;
  END IF;

  UPDATE amistades
  SET estado = 'ACTIVA'
  WHERE user_id_1 = v_user1
    AND user_id_2 = v_user2
    AND estado = 'PENDIENTE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  -- Eliminar la notificación de solicitud recibida (ya no es accionable)
  DELETE FROM notificaciones
  WHERE user_id = v_uid
    AND tipo = 'friend_request'
    AND actor_id = p_requester_user_id;

  -- Notificar al que envió la solicitud
  INSERT INTO notificaciones (user_id, tipo, actor_id, entity_type)
  VALUES (p_requester_user_id, 'friend_accept', v_uid, 'friendship');
END; $$;


-- ─── fn_friend_request_reject ────────────────────────────────
CREATE OR REPLACE FUNCTION fn_friend_request_reject(p_requester_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_user1 uuid;
  v_user2 uuid;
BEGIN
  IF v_uid < p_requester_user_id THEN
    v_user1 := v_uid;  v_user2 := p_requester_user_id;
  ELSE
    v_user1 := p_requester_user_id;  v_user2 := v_uid;
  END IF;

  DELETE FROM amistades
  WHERE user_id_1 = v_user1
    AND user_id_2 = v_user2
    AND estado = 'PENDIENTE';

  -- Eliminar la notificación de solicitud recibida
  DELETE FROM notificaciones
  WHERE user_id = v_uid
    AND tipo = 'friend_request'
    AND actor_id = p_requester_user_id;
END; $$;

NOTIFY pgrst, 'reload schema';
