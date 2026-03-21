-- ============================================================
-- RLS para la tabla amistades
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE amistades ENABLE ROW LEVEL SECURITY;

-- ─── SELECT ───────────────────────────────────────────────────
-- Un usuario solo puede ver las filas donde él es una de las dos partes
CREATE POLICY "amistades_select_own"
ON amistades FOR SELECT
TO authenticated
USING (
  user_id_1 = auth.uid() OR user_id_2 = auth.uid()
);

-- ─── INSERT ───────────────────────────────────────────────────
-- Solo se puede insertar una fila donde el usuario autenticado es una de las partes.
-- fn_friend_request_send es SECURITY DEFINER y ya maneja el orden canónico,
-- pero esta política protege acceso directo a la tabla.
CREATE POLICY "amistades_insert_own"
ON amistades FOR INSERT
TO authenticated
WITH CHECK (
  user_id_1 = auth.uid() OR user_id_2 = auth.uid()
);

-- ─── UPDATE ───────────────────────────────────────────────────
-- Cualquiera de las dos partes puede actualizar (para aceptar/rechazar solicitudes).
-- La lógica de quién puede hacer qué se controlará en los RPCs (SECURITY DEFINER).
CREATE POLICY "amistades_update_own"
ON amistades FOR UPDATE
TO authenticated
USING (
  user_id_1 = auth.uid() OR user_id_2 = auth.uid()
)
WITH CHECK (
  user_id_1 = auth.uid() OR user_id_2 = auth.uid()
);

-- ─── DELETE ───────────────────────────────────────────────────
-- Cualquiera de las dos partes puede eliminar la amistad o cancelar la solicitud
CREATE POLICY "amistades_delete_own"
ON amistades FOR DELETE
TO authenticated
USING (
  user_id_1 = auth.uid() OR user_id_2 = auth.uid()
);
