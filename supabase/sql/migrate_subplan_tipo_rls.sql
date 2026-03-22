-- ============================================================
-- Migración subplan: tipo de actividad + ubicación destino + RLS
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. Enum tipo_subplan ─────────────────────────────────

CREATE TYPE tipo_subplan AS ENUM (
  'VUELO',
  'TREN',
  'BUS',
  'BARCO',
  'COCHE',
  'HOTEL',
  'RESTAURANTE',
  'ACTIVIDAD',
  'OTRO'
);

-- ─── 2. Nuevas columnas en subplan ────────────────────────

ALTER TABLE subplan
  ADD COLUMN IF NOT EXISTS tipo              tipo_subplan NOT NULL DEFAULT 'ACTIVIDAD',
  ADD COLUMN IF NOT EXISTS ubicacion_fin_nombre    text,
  ADD COLUMN IF NOT EXISTS ubicacion_fin_direccion text;

-- ─── 3. RLS ───────────────────────────────────────────────

ALTER TABLE subplan ENABLE ROW LEVEL SECURITY;

-- SELECT: miembros activos del plan o creador del plan
CREATE POLICY "subplan_select"
ON subplan FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM plan p
    WHERE p.id = subplan.plan_id
      AND (
        p.creado_por_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM plan_member pm
          WHERE pm.plan_id = p.id
            AND pm.user_id = auth.uid()
            AND pm.estado  = 'ACTIVO'
        )
      )
  )
);

-- INSERT: solo via RPC fn_subplan_create (SECURITY DEFINER)
--         pero por seguridad bloqueamos insert directo
CREATE POLICY "subplan_insert"
ON subplan FOR INSERT
TO authenticated
WITH CHECK (creado_por_user_id = auth.uid());

-- UPDATE: solo el creador del subplan
CREATE POLICY "subplan_update"
ON subplan FOR UPDATE
TO authenticated
USING (creado_por_user_id = auth.uid())
WITH CHECK (creado_por_user_id = auth.uid());

-- DELETE: bloqueado (usamos soft delete via fn_subplan_delete)
CREATE POLICY "subplan_delete"
ON subplan FOR DELETE
TO authenticated
USING (false);
