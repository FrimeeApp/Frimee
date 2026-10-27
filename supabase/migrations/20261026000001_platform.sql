-- Platform objects outside the public schema that Frimee depends on.
-- The baseline (20261026000000_baseline.sql) only covers public; this file
-- recreates the rest by hand from production as of 2026-10-26.
-- pg_cron jobs are intentionally NOT recreated here: they call external APIs
-- (flight positions runs every minute) and belong to production only.

-- Extensions --------------------------------------------------------------

-- Same schemas as production. Explicit because the baseline empties search_path.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Auth: create and sync the Frimee profile when a Supabase user changes ----

create trigger on_auth_user_insert
  after insert on auth.users
  for each row execute function public.handle_auth_user_insert();

create trigger on_auth_user_update
  after update of email, email_confirmed_at, raw_user_meta_data on auth.users
  for each row execute function public.handle_auth_user_update();

-- Storage buckets ---------------------------------------------------------

insert into storage.buckets (id, name, public) values
  ('plan-tickets', 'plan-tickets', false),
  ('profile-images', 'profile-images', true),
  ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Storage policies --------------------------------------------------------
-- Paths: profile-images/<user_id>/..., receipts/<plan_id>/<user_id>/...,
-- plan-tickets/<plan_id>/<user_id>/...

create policy profile_images_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-images' and split_part(name, '/', 1) = auth.uid()::text);

create policy profile_images_select on storage.objects for select to authenticated
  using (bucket_id = 'profile-images');

create policy profile_images_update_own on storage.objects for update to authenticated
  using (bucket_id = 'profile-images' and split_part(name, '/', 1) = auth.uid()::text)
  with check (bucket_id = 'profile-images' and split_part(name, '/', 1) = auth.uid()::text);

create policy "receipts: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "receipts: read plan member" on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select p::text from public.get_user_plan_ids(auth.uid()) p)
  );

create policy "receipts: upload plan member" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select p::text from public.get_user_plan_ids(auth.uid()) p)
  );

create policy tickets_storage_delete on storage.objects for delete to public
  using (bucket_id = 'plan-tickets' and auth.uid()::text = (storage.foldername(name))[2]);

create policy tickets_storage_insert on storage.objects for insert to public
  with check (bucket_id = 'plan-tickets' and auth.uid()::text = (storage.foldername(name))[2]);

create policy tickets_storage_select on storage.objects for select to public
  using (bucket_id = 'plan-tickets' and auth.uid()::text = (storage.foldername(name))[2]);

-- Realtime ----------------------------------------------------------------

alter publication supabase_realtime add table
  public.chat_miembro,
  public.flight_positions,
  public.llamadas,
  public.notificaciones,
  public.plan_usuarios;
