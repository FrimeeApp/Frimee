-- Tabla de llamadas (1:1 y grupales)
CREATE TABLE IF NOT EXISTS llamadas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id     uuid NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
  room_name   text NOT NULL UNIQUE,
  iniciado_por_user_id uuid NOT NULL REFERENCES auth.users(id),
  tipo        text NOT NULL DEFAULT 'audio' CHECK (tipo IN ('audio', 'video')),
  estado      text NOT NULL DEFAULT 'ringing' CHECK (estado IN ('ringing', 'active', 'ended', 'missed')),
  iniciada_at timestamptz NOT NULL DEFAULT now(),
  finalizada_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE llamadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "llamadas: chat members" ON llamadas
  FOR ALL TO authenticated USING (
    chat_id IN (
      SELECT chat_id FROM chat_miembro WHERE user_id = auth.uid()
    )
  );

-- Realtime para notificaciones de llamada entrante
ALTER PUBLICATION supabase_realtime ADD TABLE llamadas;
