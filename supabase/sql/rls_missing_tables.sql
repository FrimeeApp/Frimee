-- ============================================================
-- RLS para tablas sin Row Level Security
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- audit_log: solo el propio actor ve sus registros
-- ------------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log: read own" ON audit_log
  FOR SELECT TO authenticated USING (actor_user_id = auth.uid());

-- ------------------------------------------------------------
-- categorias_gasto: propias o globales (sin owner)
-- ------------------------------------------------------------
ALTER TABLE categorias_gasto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_gasto: read own or global" ON categorias_gasto
  FOR SELECT TO authenticated USING (
    owner_user_id IS NULL OR owner_user_id = auth.uid()
  );
CREATE POLICY "categorias_gasto: manage own" ON categorias_gasto
  FOR ALL TO authenticated USING (owner_user_id = auth.uid());

-- ------------------------------------------------------------
-- plan: creador o miembro
-- ------------------------------------------------------------
ALTER TABLE plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan: creator full access" ON plan
  FOR ALL TO authenticated USING (creado_por_user_id = auth.uid());
CREATE POLICY "plan: members read" ON plan
  FOR SELECT TO authenticated USING (
    id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- plan_usuarios: miembros ven su plan; creador del plan gestiona
-- ------------------------------------------------------------
ALTER TABLE plan_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_usuarios: read if member" ON plan_usuarios
  FOR SELECT TO authenticated USING (
    plan_id IN (SELECT plan_id FROM plan_usuarios pu WHERE pu.user_id = auth.uid())
  );
CREATE POLICY "plan_usuarios: creator manage" ON plan_usuarios
  FOR ALL TO authenticated USING (
    plan_id IN (SELECT id FROM plan WHERE creado_por_user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- user_settings: solo el propio usuario
-- ------------------------------------------------------------
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_settings: own only" ON user_settings
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- gastos: miembros del plan
-- ------------------------------------------------------------
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gastos: plan members" ON gastos
  FOR ALL TO authenticated USING (
    plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- gasto_items: via gasto -> plan
-- ------------------------------------------------------------
ALTER TABLE gasto_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gasto_items: via gasto" ON gasto_items
  FOR ALL TO authenticated USING (
    gasto_id IN (
      SELECT id FROM gastos
      WHERE plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- gasto_item_usuarios: via gasto_item -> gasto -> plan
-- ------------------------------------------------------------
ALTER TABLE gasto_item_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gasto_item_usuarios: via gasto" ON gasto_item_usuarios
  FOR ALL TO authenticated USING (
    gasto_item_id IN (
      SELECT gi.id FROM gasto_items gi
      JOIN gastos g ON g.id = gi.gasto_id
      WHERE g.plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- gasto_partes: usuario propio o miembro del plan
-- ------------------------------------------------------------
ALTER TABLE gasto_partes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gasto_partes: own or plan member" ON gasto_partes
  FOR ALL TO authenticated USING (
    user_id = auth.uid()
    OR gasto_id IN (
      SELECT id FROM gastos
      WHERE plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- factura_gastos: via gasto -> plan
-- ------------------------------------------------------------
ALTER TABLE factura_gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "factura_gastos: via gasto" ON factura_gastos
  FOR ALL TO authenticated USING (
    gasto_id IN (
      SELECT id FROM gastos
      WHERE plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- facturas: miembros del plan
-- ------------------------------------------------------------
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facturas: plan members" ON facturas
  FOR ALL TO authenticated USING (
    plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- invitaciones: quien la envió o quien la recibió
-- ------------------------------------------------------------
ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitaciones: sender or receiver" ON invitaciones
  FOR ALL TO authenticated USING (
    invited_user_id = auth.uid() OR invited_by_user_id = auth.uid()
  );

-- ------------------------------------------------------------
-- liquidaciones: implicados (from o to) o miembros del plan
-- ------------------------------------------------------------
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liquidaciones: involved users" ON liquidaciones
  FOR ALL TO authenticated USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- presupuestos: miembros del plan
-- ------------------------------------------------------------
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presupuestos: plan members" ON presupuestos
  FOR ALL TO authenticated USING (
    plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- reservas: miembros del plan
-- ------------------------------------------------------------
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservas: plan members" ON reservas
  FOR ALL TO authenticated USING (
    plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- subplan_usuarios: miembros del plan padre
-- ------------------------------------------------------------
ALTER TABLE subplan_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subplan_usuarios: plan members" ON subplan_usuarios
  FOR ALL TO authenticated USING (
    subplan_id IN (
      SELECT s.id FROM subplan s
      WHERE s.plan_id IN (SELECT plan_id FROM plan_usuarios WHERE user_id = auth.uid())
    )
  );
