-- ============================================================
-- Fix completo subplan: enum + columnas + RPCs + RLS
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. Enum ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE tipo_subplan AS ENUM (
    'VUELO','TREN','BUS','BARCO','COCHE',
    'HOTEL','RESTAURANTE','ACTIVIDAD','OTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Columnas ──────────────────────────────────────────
ALTER TABLE subplan
  ADD COLUMN IF NOT EXISTS tipo                    tipo_subplan NOT NULL DEFAULT 'ACTIVIDAD',
  ADD COLUMN IF NOT EXISTS ubicacion_fin_nombre    text,
  ADD COLUMN IF NOT EXISTS ubicacion_fin_direccion text;

-- ─── 3. RLS ───────────────────────────────────────────────
ALTER TABLE subplan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subplan_select" ON subplan;
DROP POLICY IF EXISTS "subplan_insert" ON subplan;
DROP POLICY IF EXISTS "subplan_update" ON subplan;
DROP POLICY IF EXISTS "subplan_delete" ON subplan;

CREATE POLICY "subplan_select" ON subplan FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM plan p
    WHERE p.id = subplan.plan_id
      AND (
        p.creado_por_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM plan_usuarios pu
          WHERE pu.plan_id = p.id
            AND pu.user_id = auth.uid()
            AND pu.estado  = 'PARTICIPA'
        )
      )
  )
);

CREATE POLICY "subplan_insert" ON subplan FOR INSERT TO authenticated
WITH CHECK (creado_por_user_id = auth.uid());

CREATE POLICY "subplan_update" ON subplan FOR UPDATE TO authenticated
USING (creado_por_user_id = auth.uid())
WITH CHECK (creado_por_user_id = auth.uid());

CREATE POLICY "subplan_delete" ON subplan FOR DELETE TO authenticated
USING (false);

-- ─── 4. fn_subplan_list ───────────────────────────────────
DROP FUNCTION IF EXISTS fn_subplan_list(bigint);

CREATE FUNCTION fn_subplan_list(p_plan_id bigint)
RETURNS TABLE (
  id                      bigint,
  plan_id                 bigint,
  parent_subplan_id       bigint,
  titulo                  text,
  descripcion             text,
  inicio_at               timestamptz,
  fin_at                  timestamptz,
  all_day                 boolean,
  ubicacion_nombre        text,
  ubicacion_direccion     text,
  tipo                    text,
  ubicacion_fin_nombre    text,
  ubicacion_fin_direccion text,
  orden                   int,
  estado                  text,
  creado_por_user_id      uuid,
  created_at              timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.plan_id, s.parent_subplan_id,
    s.titulo::text, s.descripcion,
    s.inicio_at, s.fin_at, s.all_day,
    s.ubicacion_nombre::text, s.ubicacion_direccion::text,
    s.tipo::text,
    s.ubicacion_fin_nombre::text, s.ubicacion_fin_direccion::text,
    s.orden, s.estado::text,
    s.creado_por_user_id, s.created_at
  FROM subplan s
  WHERE s.plan_id = p_plan_id
    AND s.estado = 'ACTIVO'
  ORDER BY s.inicio_at ASC, s.orden ASC;
END;
$$;

-- ─── 5. fn_subplan_create ─────────────────────────────────
CREATE OR REPLACE FUNCTION fn_subplan_create(
  p_plan_id                bigint,
  p_titulo                 text,
  p_descripcion            text,
  p_inicio_at              timestamptz,
  p_fin_at                 timestamptz,
  p_all_day                boolean      DEFAULT false,
  p_ubicacion_nombre       text         DEFAULT '',
  p_ubicacion_direccion    text         DEFAULT NULL,
  p_parent_subplan_id      bigint       DEFAULT NULL,
  p_tipo                   tipo_subplan DEFAULT 'ACTIVIDAD',
  p_ubicacion_fin_nombre   text         DEFAULT NULL,
  p_ubicacion_fin_direccion text        DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_orden int;
  v_id    bigint;
BEGIN
  SELECT COALESCE(MAX(orden), 0) + 1 INTO v_orden
    FROM subplan
   WHERE plan_id = p_plan_id
     AND (
       (p_parent_subplan_id IS NULL AND parent_subplan_id IS NULL)
       OR parent_subplan_id = p_parent_subplan_id
     );

  INSERT INTO subplan (
    plan_id, parent_subplan_id, titulo, descripcion,
    inicio_at, fin_at, all_day,
    tipo, ubicacion_nombre, ubicacion_direccion,
    ubicacion_fin_nombre, ubicacion_fin_direccion,
    orden, creado_por_user_id
  ) VALUES (
    p_plan_id, p_parent_subplan_id, p_titulo, p_descripcion,
    p_inicio_at, p_fin_at, p_all_day,
    p_tipo, p_ubicacion_nombre, p_ubicacion_direccion,
    p_ubicacion_fin_nombre, p_ubicacion_fin_direccion,
    v_orden, v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
