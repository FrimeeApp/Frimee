-- Demo efímera, paso 3: el ejemplo de una cuenta registrada se borra solo.
--
-- · Al crearse un plan real, desaparece todo el ejemplo (trigger sobre plan): no tiene sentido
--   que sigan saliendo amigos y planes inventados al lado de planes de verdad. Vale para todas
--   las vías de creación (modal, «Crear plan con este chat», @frimee).
-- · Al arrancar la app, el front llama a fn_demo_borrar(): ahora sale enseguida cuando no hay
--   nada que borrar, porque se llama en cada carga de página.
-- · Cada noche, un respaldo borra los ejemplos de cuentas registradas que llevan más de 12 horas.
-- Los invitados no cambian: conservan su ejemplo hasta que se borra la cuenta.

-- 1. El seed crea planes reales (Lisboa va por fn_plan_create): el trigger no debe actuar
--    mientras se siembra, o el ejemplo se borraría a sí mismo.
create or replace function public.fn_guest_seed_demo()
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_plan_id bigint;
begin
  perform set_config('frimee.sembrando', '1', true);
  v_plan_id := fn_demo_sembrar();
  perform fn_demo_marcar(auth.uid());
  perform set_config('frimee.sembrando', '', true);
  return v_plan_id;
end;
$$;
revoke all on function public.fn_guest_seed_demo() from public, anon;
grant execute on function public.fn_guest_seed_demo() to authenticated;

-- 2. Salida rápida: sin planes de ejemplo ni perfiles ficticios no se toca nada.
create or replace function public.fn_demo_borrar()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_nada constant jsonb := jsonb_build_object('planes', 0, 'grupos', 0, 'chats', 0, 'personas', 0);
begin
  if v_user is null then
    raise exception 'Hace falta una sesión';
  end if;
  if exists (select 1 from auth.users where id = v_user and is_anonymous) then
    return v_nada;
  end if;

  if not exists (select 1 from plan_usuarios pu join plan p on p.id = pu.plan_id
                  where pu.user_id = v_user and p.es_demo)
     and not exists (select 1
                       from amistades a
                       join auth.users u on u.id = case when a.user_id_1 = v_user then a.user_id_2 else a.user_id_1 end
                      where (a.user_id_1 = v_user or a.user_id_2 = v_user)
                        and u.raw_user_meta_data->>'demo_friend_of' = v_user::text) then
    return v_nada;
  end if;

  return fn_demo_borrar_de(v_user);
end;
$$;
revoke all on function public.fn_demo_borrar() from public, anon;
grant execute on function public.fn_demo_borrar() to authenticated;

-- 3. Al crear un plan real se borra el ejemplo de quien lo crea.
create or replace function public.trg_plan_borra_demo()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_user uuid := coalesce(new.creado_por_user_id, new.owner_user_id);
begin
  if new.es_demo or v_user is null or current_setting('frimee.sembrando', true) = '1' then
    return new;
  end if;
  -- Invitados y perfiles ficticios (anónimos) no cuentan.
  if exists (select 1 from auth.users where id = v_user and is_anonymous) then
    return new;
  end if;
  perform fn_demo_borrar_de(v_user);
  return new;
end;
$$;
revoke all on function public.trg_plan_borra_demo() from public, anon, authenticated;

drop trigger if exists trg_plan_borra_demo on public.plan;
create trigger trg_plan_borra_demo
  after insert on public.plan
  for each row execute function public.trg_plan_borra_demo();

-- 4. Respaldo nocturno: cuentas registradas cuyo ejemplo lleva más de p_older.
create or replace function public.fn_demo_limpiar_antiguas(p_older interval default '12 hours'::interval)
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
    select distinct (p.raw_user_meta_data->>'demo_friend_of')::uuid
      from auth.users p
      join auth.users o on o.id = (p.raw_user_meta_data->>'demo_friend_of')::uuid
     where p.raw_user_meta_data ? 'demo_friend_of'
       and p.created_at < now() - p_older
       and not o.is_anonymous
  loop
    begin
      perform fn_demo_borrar_de(v_user);
      v_n := v_n + 1;
    exception when others then
      raise warning 'fn_demo_limpiar_antiguas: no se pudo borrar el ejemplo de %: %', v_user, sqlerrm;
    end;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.fn_demo_limpiar_antiguas(interval) from public, anon, authenticated;

select cron.schedule('demo-limpiar', '30 3 * * *', 'select public.fn_demo_limpiar_antiguas()');
