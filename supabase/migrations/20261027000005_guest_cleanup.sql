-- Nightly cleanup of guest accounts: anonymous users older than 7 days, their
-- demo friends (raw_user_meta_data.demo_friend_of) and everything they created.
--
-- Deleting from auth.users cascades most data, but several foreign keys to
-- auth.users are ON DELETE RESTRICT (plan, subplan, gastos, liquidaciones…),
-- so their plans and their leftovers in other people's plans go first.
-- Each guest runs in its own subtransaction: one odd case logs a warning
-- instead of blocking the cleanup of everyone else.

-- The "last admin" guard on plan_usuarios also fired when the whole plan was
-- deleted (the cascade removes its members), so no plan could ever be deleted.
-- The cascade runs after the plan row is gone: if the plan no longer exists,
-- removing its members is part of deleting it, not leaving it without admin.
create or replace function public.trg_planusuarios_cannot_remove_last_admin() returns trigger
    language plpgsql
    as $$
declare admin_count int;
begin
  if (tg_op = 'DELETE') then
    if not exists (select 1 from plan where id = old.plan_id) then
      return old;
    end if;

    if old.rol = 'ADMIN' then
      select count(*) into admin_count
      from plan_usuarios
      where plan_id = old.plan_id
        and rol = 'ADMIN'
        and (user_id <> old.user_id);

      if admin_count = 0 then
        raise exception 'No puedes eliminar al último ADMIN del plan.';
      end if;
    end if;
    return old;
  end if;

  if (tg_op = 'UPDATE') then
    if old.rol = 'ADMIN' and new.rol <> 'ADMIN' then
      select count(*) into admin_count
      from plan_usuarios
      where plan_id = old.plan_id
        and rol = 'ADMIN'
        and (user_id <> old.user_id);

      if admin_count = 0 then
        raise exception 'No puedes degradar al último ADMIN del plan.';
      end if;
    end if;
    return new;
  end if;

  return null;
end $$;

-- usuarios has a soft delete: a BEFORE DELETE trigger marks the row INACTIVA
-- and returns NULL, which silently cancels the delete, even when it comes from
-- the auth.users cascade. Guest profiles hold no real personal data, so they
-- are deleted for real; everyone else keeps the current behaviour.
create or replace function public.fn_usuarios_soft_delete() returns trigger
    language plpgsql
    as $$
BEGIN
  IF OLD.email = public.fn_guest_email(OLD.id) THEN
    RETURN OLD; -- invitado: borrado físico
  END IF;

  UPDATE public.usuarios
     SET deleted_at = now(),
         estado = 'INACTIVA'
   WHERE id = OLD.id;

  RETURN NULL; -- cancela el DELETE físico
END;
$$;

create or replace function public.fn_guest_cleanup(p_older_than interval default interval '7 days')
    returns integer
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_guest uuid;
  v_users uuid[];
  v_plan_id bigint;
  v_affected_plans bigint[];
  v_deleted integer := 0;
begin
  for v_guest in
    select id from auth.users
    where is_anonymous
      and created_at < now() - p_older_than
      and raw_user_meta_data->>'demo_friend_of' is null
  loop
    begin
      select array[v_guest] || coalesce(array_agg(id), '{}') into v_users
      from auth.users
      where raw_user_meta_data->>'demo_friend_of' = v_guest::text;

      -- 1. Their plans; the cascade takes activities, expenses, debts, chat…
      delete from factura_gastos
      where gasto_id in (
        select g.id from gastos g join plan p on p.id = g.plan_id
        where p.creado_por_user_id = any(v_users) or p.owner_user_id = any(v_users)
      );
      delete from plan where creado_por_user_id = any(v_users) or owner_user_id = any(v_users);

      -- 2. Leftovers in other people's plans (a guest can join one by invite link).
      select coalesce(array_agg(distinct plan_id), '{}') into v_affected_plans
      from gastos
      where created_by_user_id = any(v_users) or pagado_por_user_id = any(v_users)
         or id in (select gasto_id from gasto_partes where user_id = any(v_users));

      delete from factura_gastos
      where gasto_id in (select id from gastos where created_by_user_id = any(v_users) or pagado_por_user_id = any(v_users));
      delete from gastos where created_by_user_id = any(v_users) or pagado_por_user_id = any(v_users);
      delete from gasto_partes where user_id = any(v_users);
      foreach v_plan_id in array v_affected_plans loop
        perform fn_liquidaciones_recalculate_for_plan(v_plan_id);
      end loop;
      delete from liquidaciones where from_user_id = any(v_users) or to_user_id = any(v_users);

      delete from subplan where creado_por_user_id = any(v_users);
      delete from plan_tareas where creado_por_user_id = any(v_users);
      delete from plan_presupuestos where created_by_user_id = any(v_users);
      delete from presupuestos where created_by_user_id = any(v_users);
      delete from reservas where created_by_user_id = any(v_users);
      delete from evento where creado_por_user_id = any(v_users);
      delete from llamadas where iniciado_por_user_id = any(v_users);
      delete from categorias_gasto where owner_user_id = any(v_users);
      delete from facturas where emitida_por_user_id = any(v_users);
      delete from grupos where creado_por_user_id = any(v_users);

      -- 3. The users; usuarios, messages, notifications… cascade from here.
      delete from auth.users where id = any(v_users);
      v_deleted := v_deleted + 1;
    exception when others then
      raise warning 'fn_guest_cleanup: no se pudo borrar el invitado %: %', v_guest, sqlerrm;
    end;
  end loop;

  return v_deleted;
end;
$$;

-- Never callable through the API: anyone could pass '0 seconds' and wipe every guest.
revoke all on function public.fn_guest_cleanup(interval) from public, anon, authenticated;

-- Every night at 03:30 UTC. cron.schedule updates the job if the name already exists.
select cron.schedule('guest-cleanup', '30 3 * * *', 'select public.fn_guest_cleanup()');
