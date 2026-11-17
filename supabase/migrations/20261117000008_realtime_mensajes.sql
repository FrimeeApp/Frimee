-- The sidebar listens for new messages to refresh its unread badge in realtime.
-- The mensajes SELECT policy limits events to chats the authenticated user can read.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensajes'
  ) then
    alter publication supabase_realtime add table public.mensajes;
  end if;
end;
$$;
