-- ============================================================
-- Fix RLS: separar SELECT (solo destinatario) e INSERT (actor)
-- ============================================================

-- Eliminar la política genérica FOR ALL
DROP POLICY IF EXISTS "notificaciones: solo el destinatario" ON notificaciones;

-- SELECT/UPDATE/DELETE: solo el destinatario ve y gestiona las suyas
CREATE POLICY "notificaciones: select propio" ON notificaciones
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notificaciones: update propio" ON notificaciones
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notificaciones: delete propio" ON notificaciones
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- INSERT: cualquier usuario autenticado puede crear notificaciones
-- donde él es el actor (evita que alguien notifique en nombre de otro)
CREATE POLICY "notificaciones: insert como actor" ON notificaciones
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

NOTIFY pgrst, 'reload schema';
