-- ============================================================
-- RLS para grupos y miembros_grupo
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================


-- ─── grupos ───────────────────────────────────────────────────

ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;

-- SELECT: grupos públicos visibles para todos los autenticados;
--         grupos privados solo para sus miembros activos
CREATE POLICY "grupos_select"
ON grupos FOR SELECT
TO authenticated
USING (
  visibilidad = 'PUBLICO'
  OR creado_por_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM miembros_grupo m
    WHERE m.grupo_id = grupos.id
      AND m.user_id  = auth.uid()
      AND m.estado   = 'ACTIVO'
  )
);

-- INSERT: cualquier usuario autenticado puede crear un grupo,
--         pero el creado_por_user_id debe ser él mismo
CREATE POLICY "grupos_insert"
ON grupos FOR INSERT
TO authenticated
WITH CHECK (creado_por_user_id = auth.uid());

-- UPDATE: solo admins activos del grupo
CREATE POLICY "grupos_update"
ON grupos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM miembros_grupo m
    WHERE m.grupo_id = grupos.id
      AND m.user_id  = auth.uid()
      AND m.rol      = 'ADMIN'
      AND m.estado   = 'ACTIVO'
  )
);

-- DELETE: solo el creador del grupo
CREATE POLICY "grupos_delete"
ON grupos FOR DELETE
TO authenticated
USING (creado_por_user_id = auth.uid());


-- ─── miembros_grupo ───────────────────────────────────────────
-- Nota: fn_grupo_create y fn_grupo_add_member son SECURITY DEFINER
-- y bypasan RLS. Las políticas protegen el acceso directo a la tabla.

ALTER TABLE miembros_grupo ENABLE ROW LEVEL SECURITY;

-- SELECT: un usuario puede ver su propia fila de membresía
--         y las de otros miembros en grupos donde él también está activo.
--         La subquery no es circular: consulta la misma tabla pero
--         PostgreSQL no aplica RLS recursivamente dentro de políticas.
CREATE POLICY "miembros_grupo_select"
ON miembros_grupo FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM miembros_grupo m2
    WHERE m2.grupo_id = miembros_grupo.grupo_id
      AND m2.user_id  = auth.uid()
      AND m2.estado   = 'ACTIVO'
  )
);

-- INSERT: solo admins activos del grupo (o el creador en el momento inicial).
--         En la práctica esta política no se alcanza desde el frontend
--         porque fn_grupo_create y fn_grupo_add_member son SECURITY DEFINER.
CREATE POLICY "miembros_grupo_insert"
ON miembros_grupo FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM grupos g
    WHERE g.id = miembros_grupo.grupo_id
      AND g.creado_por_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM miembros_grupo m
    WHERE m.grupo_id = miembros_grupo.grupo_id
      AND m.user_id  = auth.uid()
      AND m.rol      = 'ADMIN'
      AND m.estado   = 'ACTIVO'
  )
);

-- UPDATE: solo admins activos del grupo
CREATE POLICY "miembros_grupo_update"
ON miembros_grupo FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM miembros_grupo m
    WHERE m.grupo_id = miembros_grupo.grupo_id
      AND m.user_id  = auth.uid()
      AND m.rol      = 'ADMIN'
      AND m.estado   = 'ACTIVO'
  )
);

-- DELETE: un miembro puede salir él mismo,
--         o un admin puede expulsar a otros
--         (el trigger protege contra eliminar el último admin)
CREATE POLICY "miembros_grupo_delete"
ON miembros_grupo FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM miembros_grupo m
    WHERE m.grupo_id = miembros_grupo.grupo_id
      AND m.user_id  = auth.uid()
      AND m.rol      = 'ADMIN'
      AND m.estado   = 'ACTIVO'
  )
);
