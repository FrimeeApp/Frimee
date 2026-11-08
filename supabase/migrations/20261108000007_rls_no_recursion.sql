-- The read policies of plan and plan_usuarios queried each other ("plan: members read" reads
-- plan_usuarios, "plan_usuarios: select" reads plan), so any read of either table, or of a
-- table whose policy goes through them such as subplan, failed with "infinite recursion
-- detected in policy for relation plan_usuarios". That includes Supabase Realtime, which
-- checks these policies for every change: the itinerary and member changes never reached the
-- other members live (the app reads through security-definer functions, which skip RLS, so
-- only realtime showed it).
--
-- The policies now ask security-definer helpers, which read plan_usuarios without RLS and
-- break the loop. Same access as before, except that members now see each other's membership
-- rows (only the plan's creator did): realtime needs it to tell a member another one became
-- admin, and the member list is already shown to them by fn_plan_get_miembros.

-- Taking part in a plan (is_plan_member also counts declined or blocked rows).
create or replace function public.is_plan_participant(p_plan_id bigint) returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$
  select exists (
    select 1 from plan_usuarios
    where plan_id = p_plan_id and user_id = auth.uid() and estado = 'PARTICIPA'
  );
$$;

revoke all on function public.is_plan_participant(bigint) from public, anon;
grant execute on function public.is_plan_participant(bigint) to authenticated, service_role;

drop policy if exists "plan: members read" on public.plan;
create policy "plan: members read" on public.plan
  for select to authenticated
  using (public.is_plan_member(id));

drop policy if exists "plan_usuarios: select" on public.plan_usuarios;
create policy "plan_usuarios: select" on public.plan_usuarios
  for select to authenticated
  using (user_id = auth.uid() or public.is_plan_participant(plan_id));

drop policy if exists subplan_select on public.subplan;
create policy subplan_select on public.subplan
  for select to authenticated
  using (
    public.is_plan_participant(plan_id)
    or exists (select 1 from public.plan p where p.id = subplan.plan_id and p.creado_por_user_id = auth.uid())
  );

-- The app listens to subplan changes (PlanPageClient) but the table was never published to
-- Realtime, so itinerary changes made by others only showed after a reload.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'subplan'
  ) then
    alter publication supabase_realtime add table public.subplan;
  end if;
end $$;
