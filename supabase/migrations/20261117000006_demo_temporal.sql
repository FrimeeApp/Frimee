-- El plan de ejemplo de una cuenta registrada es temporal (2026-11-17).
--
-- «Ver un plan de ejemplo» (Mis planes vacío) crea la demo en una cuenta real, y hasta ahora
-- se quedaba para siempre: guest-cleanup solo borra invitados. Ahora la demo de una cuenta
-- registrada (sus personas inventadas, los planes que se crearon con ellas, sus chats y avisos)
-- se borra a las 24 horas o en cuanto el usuario crea su primer plan propio. Lo que el usuario
-- haya creado después, y cualquier plan o chat con gente real, se queda.

create or replace function public.fn_demo_ejemplo_borrar(p_user uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_friends uuid[];
  v_users uuid[];
  v_seed timestamptz;
  v_plans bigint[];
begin
  select coalesce(array_agg(id), '{}'), min(created_at) into v_friends, v_seed
    from auth.users where raw_user_meta_data->>'demo_friend_of' = p_user::text;
  if cardinality(v_friends) = 0 then return; end if;
  v_users := v_friends || p_user;

  -- Plans made by the seed: created with the demo people (within two minutes) and with nobody
  -- else in them. A plan the user made later, or one with a real person, is not touched.
  select coalesce(array_agg(p.id), '{}') into v_plans
    from plan p
   where p.created_at < v_seed + interval '2 minutes'
     and exists (select 1 from plan_usuarios pu where pu.plan_id = p.id and pu.user_id = any(v_friends))
     and not exists (select 1 from plan_usuarios pu where pu.plan_id = p.id and not (pu.user_id = any(v_users)));

  delete from factura_gastos where gasto_id in (select id from gastos where plan_id = any(v_plans));
  delete from plan where id = any(v_plans);

  delete from gastos where created_by_user_id = any(v_friends) or pagado_por_user_id = any(v_friends);
  delete from liquidaciones where from_user_id = any(v_friends) or to_user_id = any(v_friends);
  delete from subplan where creado_por_user_id = any(v_friends);
  delete from plan_tareas where creado_por_user_id = any(v_friends);
  delete from llamadas where iniciado_por_user_id = any(v_friends);

  -- Chats outside plans with only the user and their demo people (the «Familia» group too).
  delete from grupos g
   where exists (select 1 from chat c where c.grupo_id = g.id)
     and not exists (select 1 from chat c join chat_miembro m on m.chat_id = c.id
                      where c.grupo_id = g.id and not (m.user_id = any(v_users)));
  delete from chat c
   where c.tipo in ('DIRECTO', 'GRUPO')
     and exists (select 1 from chat_miembro m where m.chat_id = c.id and m.user_id = any(v_friends))
     and not exists (select 1 from chat_miembro m where m.chat_id = c.id and not (m.user_id = any(v_users)));

  delete from notificaciones where user_id = p_user and actor_id = any(v_friends);
  delete from grupos where creado_por_user_id = any(v_friends);
  delete from auth.users where id = any(v_friends);
end;
$$;
revoke all on function public.fn_demo_ejemplo_borrar(uuid) from public, anon, authenticated;

-- Nightly: the registered users whose demo is older than 24 hours.
create or replace function public.fn_demo_ejemplo_cleanup()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_user uuid;
  v_n integer := 0;
begin
  for v_user in
    select distinct o.id
      from auth.users f
      join auth.users o on o.id::text = f.raw_user_meta_data->>'demo_friend_of'
     where not o.is_anonymous and f.created_at < now() - interval '24 hours'
  loop
    begin
      perform public.fn_demo_ejemplo_borrar(v_user);
      v_n := v_n + 1;
    exception when others then
      raise warning 'fn_demo_ejemplo_cleanup: %: %', v_user, sqlerrm;
    end;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.fn_demo_ejemplo_cleanup() from public, anon, authenticated;

-- The user's first own plan: the example goes away at once.
create or replace function public.trg_plan_borra_demo_ejemplo()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if exists (select 1 from auth.users u where u.id = new.creado_por_user_id and not u.is_anonymous)
     and exists (select 1 from auth.users f where f.raw_user_meta_data->>'demo_friend_of' = new.creado_por_user_id::text
                 and f.created_at < new.created_at - interval '2 minutes') then
    perform public.fn_demo_ejemplo_borrar(new.creado_por_user_id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_plan_borra_demo_ejemplo on public.plan;
create trigger trg_plan_borra_demo_ejemplo after insert on public.plan
  for each row execute function public.trg_plan_borra_demo_ejemplo();

select cron.unschedule(jobid) from cron.job where jobname = 'demo-ejemplo-cleanup';
select cron.schedule('demo-ejemplo-cleanup', '15 3 * * *', $$select public.fn_demo_ejemplo_cleanup()$$);
