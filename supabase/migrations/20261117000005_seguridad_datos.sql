-- Datos que se podían leer o cambiar con la clave pública (2026-11-17).
--
-- · llm_uso_diario, recordatorios_deuda_enviados y plan_presupuestos no tenían RLS y anon y
--   authenticated tenían todos los permisos: cualquiera con la clave de la web podía leerlas
--   y escribirlas. En llm_uso_diario eso permitía ponerse a cero el contador de @frimee y
--   saltarse el límite diario (coste en Anthropic). Solo las usan frimee-assistant (clave de
--   servicio), pg_cron y funciones SECURITY DEFINER, que no pasan por RLS: RLS activado, sin
--   políticas, y sin permisos para anon ni authenticated.
-- · usuarios_public (nombre, usuario y foto de todos) y seguidores se podían leer sin sesión.
--   La app solo las lee con sesión: fuera el permiso de anon.

alter table public.llm_uso_diario enable row level security;
alter table public.recordatorios_deuda_enviados enable row level security;
alter table public.plan_presupuestos enable row level security;
revoke all on table public.llm_uso_diario from anon, authenticated;
revoke all on table public.recordatorios_deuda_enviados from anon, authenticated;
revoke all on table public.plan_presupuestos from anon, authenticated;

revoke select on public.usuarios_public from anon;
revoke all on table public.seguidores from anon;
