-- "Eliminar cuenta" deleted the user from Auth, which failed for anyone who had created a
-- plan, an activity or an expense (14 foreign keys to auth.users are RESTRICT), and a user
-- with nothing could not sign up again with the same email for 30 days (the soft-deleted
-- profile kept it).
--
-- Now the account is anonymised instead: the auth row stays (so nothing it points to has to
-- go) but is emptied and locked, and the profile becomes "Usuario eliminado".
--   * Plans nobody else takes part in are deleted with everything in them.
--   * Shared plans with debts still pending with the user keep them as "Usuario eliminado",
--     so the others' balances still add up.
--   * Shared plans without pending debts: the user leaves them; what they added (expenses
--     they paid, activities, messages, photos) stays, shown as "Usuario eliminado".
--   * If they were a plan's last admin, the longest-standing member becomes admin.
--   * Personal data goes: settings, friends and followers, devices, notifications, calendar
--     events, wallet tickets, Google and Stripe links, sessions and sign-in methods.
-- The email is freed: the person can create a new account with it right away.
-- Called by /api/account/delete with the service role, never from the browser.

create or replace function public.fn_account_delete(p_user_id uuid) returns jsonb
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_placeholder text := format('eliminado-%s@frimee.invalid', p_user_id);
  v_plan record;
  v_new_admin uuid;
  v_deleted int := 0;
  v_left int := 0;
  v_kept int := 0;
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Usuario no encontrado';
  end if;

  -- 1. Plans nobody else takes part in: deleted with their activities, expenses, chat…
  for v_plan in
    select p.id from plan p
    where (p.creado_por_user_id = p_user_id or p.owner_user_id = p_user_id
           or exists (select 1 from plan_usuarios pu where pu.plan_id = p.id and pu.user_id = p_user_id))
      and not exists (
        select 1 from plan_usuarios pu
        where pu.plan_id = p.id and pu.user_id <> p_user_id and pu.estado = 'PARTICIPA'
      )
  loop
    delete from factura_gastos where gasto_id in (select id from gastos where plan_id = v_plan.id);
    delete from plan where id = v_plan.id;
    v_deleted := v_deleted + 1;
  end loop;

  -- 2. Shared plans: someone else is admin; the user stays only where debts are pending.
  for v_plan in select pu.plan_id, pu.rol from plan_usuarios pu where pu.user_id = p_user_id loop
    if v_plan.rol = 'ADMIN' and not exists (
      select 1 from plan_usuarios
      where plan_id = v_plan.plan_id and user_id <> p_user_id and rol = 'ADMIN' and estado = 'PARTICIPA'
    ) then
      select user_id into v_new_admin from plan_usuarios
      where plan_id = v_plan.plan_id and user_id <> p_user_id and estado = 'PARTICIPA'
      order by created_at nulls last, user_id
      limit 1;
      update plan_usuarios set rol = 'ADMIN' where plan_id = v_plan.plan_id and user_id = v_new_admin;
    end if;

    if exists (
      select 1 from liquidaciones l
      where l.plan_id = v_plan.plan_id
        and (l.from_user_id = p_user_id or l.to_user_id = p_user_id)
        and l.estado in ('PENDIENTE', 'EN_REVISION')
        and l.importe > 0.01
    ) then
      v_kept := v_kept + 1;
    else
      -- The chat sync trigger only reacts to inserts and updates: leave the chat here too.
      delete from chat_miembro where user_id = p_user_id and chat_id in (select id from chat where plan_id = v_plan.plan_id);
      delete from plan_usuarios where plan_id = v_plan.plan_id and user_id = p_user_id;
      v_left := v_left + 1;
    end if;
  end loop;

  -- 3. Personal data.
  delete from plan_tareas_asignados where user_id = p_user_id;
  delete from subplan_usuarios where user_id = p_user_id;
  delete from chat_miembro where user_id = p_user_id
    and chat_id not in (
      select c.id from chat c join plan_usuarios pu on pu.plan_id = c.plan_id where pu.user_id = p_user_id
    );
  delete from mensaje_reacciones where user_id = p_user_id;
  delete from plan_ticket_shares where user_id = p_user_id
     or ticket_id in (select id from plan_tickets where user_id = p_user_id);
  delete from plan_tickets where user_id = p_user_id;
  delete from evento where owner_user_id = p_user_id or creado_por_user_id = p_user_id;
  delete from planes_guardados where user_id = p_user_id;
  delete from amistades where user_id_1 = p_user_id or user_id_2 = p_user_id;
  delete from seguidores where follower_id = p_user_id or following_id = p_user_id;
  delete from invitaciones where invited_by_user_id = p_user_id or invited_user_id = p_user_id;
  delete from miembros_grupo where user_id = p_user_id;
  delete from notificaciones where user_id = p_user_id;
  delete from push_tokens where user_id = p_user_id;
  delete from calendar_sync_state where user_id = p_user_id;
  delete from llm_uso_diario where user_id = p_user_id;
  delete from user_settings where user_id = p_user_id;

  -- 4. Auth: no way back in, and the email is free again.
  delete from auth.identities where user_id = p_user_id;
  delete from auth.refresh_tokens where user_id = p_user_id::text;
  delete from auth.sessions where user_id = p_user_id;
  update auth.users
     set email = v_placeholder,
         encrypted_password = '',
         phone = null,
         raw_user_meta_data = jsonb_build_object('deleted', true),
         banned_until = now() + interval '100 years',
         updated_at = now()
   where id = p_user_id;

  -- 5. Profile, after the auth update (its trigger syncs the profile).
  update usuarios
     set nombre = 'Usuario eliminado',
         email = v_placeholder,
         username = null,
         profile_image = null,
         fecha_nac = null,
         google_refresh_token = null,
         stripe_account_id = null,
         stripe_onboarded = false,
         email_verified_at = null,
         estado = 'INACTIVA'
   where id = p_user_id;

  return jsonb_build_object('planes_borrados', v_deleted, 'planes_dejados', v_left, 'planes_con_deudas', v_kept);
end;
$$;

revoke all on function public.fn_account_delete(uuid) from public, anon, authenticated;
grant execute on function public.fn_account_delete(uuid) to service_role;
