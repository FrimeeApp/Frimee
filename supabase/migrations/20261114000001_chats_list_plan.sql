-- fn_chats_list also returns the plan of a plan's chat (id, title, dates, place, cover), so the
-- Messages list can show plan chats with their trip and open them with the trip's header
-- (chat redesign «Bitácora»). Until now plan chats were only reachable from the plan page.
-- The return type changes, so the function is dropped and created again. Body as in
-- 20261026000000_baseline.sql plus the LEFT JOIN on plan; anon loses EXECUTE (it filters by
-- auth.uid() anyway), as the other locked definer functions.

DROP FUNCTION IF EXISTS public.fn_chats_list();

CREATE FUNCTION public.fn_chats_list()
 RETURNS TABLE(chat_id uuid, tipo text, nombre text, foto text, last_message text, last_message_at timestamp with time zone, unread_count bigint, miembros jsonb, plan_id bigint, plan_titulo text, plan_inicio_at timestamp with time zone, plan_fin_at timestamp with time zone, plan_ubicacion text, plan_foto text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    c.id AS chat_id,
    c.tipo::text,
    c.nombre::text,
    c.foto::text,
    c.last_message::text,
    c.last_message_at,
    (
      SELECT COUNT(*)
      FROM mensajes m
      WHERE m.chat_id = c.id
        AND m.created_at > COALESCE(cm_me.last_read_at, '-infinity'::timestamptz)
        AND m.sender_id <> auth.uid()
    ) AS unread_count,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', u.id,
          'nombre', u.nombre,
          'username', u.username,
          'profile_image', u.profile_image
        ))
        FROM chat_miembro cm_all
        JOIN usuarios u ON u.id = cm_all.user_id AND u.deleted_at IS NULL
        WHERE cm_all.chat_id = c.id
      ),
      '[]'::jsonb
    ) AS miembros,
    p.id AS plan_id,
    p.titulo::text AS plan_titulo,
    p.inicio_at AS plan_inicio_at,
    p.fin_at AS plan_fin_at,
    p.ubicacion_nombre::text AS plan_ubicacion,
    p.foto_portada AS plan_foto
  FROM chat c
  JOIN chat_miembro cm_me ON cm_me.chat_id = c.id AND cm_me.user_id = auth.uid()
  LEFT JOIN plan p ON p.id = c.plan_id AND p.deleted_at IS NULL
  ORDER BY c.last_message_at DESC NULLS LAST;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_chats_list() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_chats_list() TO authenticated, service_role;
