-- Chat Bitácora: what @frimee sees in a message, so the chat only offers «Añadir al plan» (rombo, P)
-- and «Registrar como gasto» (G) where they make sense, with the sheet already filled in.
-- The edge function chat-sugerencias classifies text messages in batches with Claude and stores
-- the result here, once per message for everybody: es_plan with title/date/time/place/type, and
-- es_gasto with concept/amount. Members of the chat read it; only the service role writes it.

create table if not exists public.mensaje_sugerencias (
  mensaje_id bigint primary key references public.mensajes(id) on delete cascade,
  chat_id uuid not null references public.chat(id) on delete cascade,
  -- {es_plan, titulo, fecha (YYYY-MM-DD or ""), hora (HH:MM or ""), lugar, tipo}
  plan jsonb not null default '{"es_plan": false}'::jsonb,
  -- {es_gasto, concepto, importe}
  gasto jsonb not null default '{"es_gasto": false}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mensaje_sugerencias_chat_idx on public.mensaje_sugerencias (chat_id);

alter table public.mensaje_sugerencias enable row level security;

drop policy if exists "mensaje_sugerencias: members read" on public.mensaje_sugerencias;
create policy "mensaje_sugerencias: members read" on public.mensaje_sugerencias
  for select to authenticated using (public.is_chat_member(chat_id));

revoke all on public.mensaje_sugerencias from anon;
grant select on public.mensaje_sugerencias to authenticated;
grant all on public.mensaje_sugerencias to service_role;
