-- ============================================================
-- Caché de rutas para evitar llamadas repetidas a Directions API
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS route_cache (
  id          bigint generated always as identity primary key,
  origin_lat  float8 not null,
  origin_lng  float8 not null,
  dest_lat    float8 not null,
  dest_lng    float8 not null,
  polyline    text   not null,
  distance    text,
  duration    text,
  created_at  timestamptz default now()
);

-- Índice para lookup rápido por coordenadas
CREATE UNIQUE INDEX IF NOT EXISTS route_cache_coords_idx
  ON route_cache (origin_lat, origin_lng, dest_lat, dest_lng);

-- RLS: solo lectura pública, escritura solo desde service role
ALTER TABLE route_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "route_cache_select" ON route_cache;
CREATE POLICY "route_cache_select" ON route_cache
  FOR SELECT TO authenticated USING (true);
