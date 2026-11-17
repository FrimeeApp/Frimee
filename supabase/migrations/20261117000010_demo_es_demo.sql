-- Demo efímera, paso 1: saber qué planes y grupos son de ejemplo.
--
-- Hasta ahora lo único que distinguía la demo eran los perfiles ficticios
-- (auth.users.raw_user_meta_data.demo_friend_of = la persona a la que acompañan). Para poder
-- borrar el ejemplo sin tocar nada real, los planes y grupos también llevan la marca.
--
-- Regla: un plan o grupo es de ejemplo si tiene dentro a algún perfil ficticio de esa persona.
-- Un plan real nunca los contiene, así que la misma función sirve para marcar lo que crea el
-- seed y para recuperar lo que ya existe.

alter table public.plan   add column if not exists es_demo boolean not null default false;
alter table public.grupos add column if not exists es_demo boolean not null default false;

create or replace function public.fn_demo_marcar(p_user uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  update plan p set es_demo = true
   where not p.es_demo
     and exists (select 1
                   from plan_usuarios pu
                   join auth.users u on u.id = pu.user_id
                  where pu.plan_id = p.id
                    and u.raw_user_meta_data->>'demo_friend_of' = p_user::text);

  update grupos g set es_demo = true
   where not g.es_demo
     and exists (select 1
                   from chat c
                   join chat_miembro cm on cm.chat_id = c.id
                   join auth.users u on u.id = cm.user_id
                  where c.grupo_id = g.id
                    and u.raw_user_meta_data->>'demo_friend_of' = p_user::text);
end;
$$;
revoke all on function public.fn_demo_marcar(uuid) from public, anon, authenticated;

-- El seed actual pasa a ser interno y la función pública lo envuelve: así no se duplica
-- su cuerpo y las migraciones anteriores siguen siendo la fuente de lo que siembra.
alter function public.fn_guest_seed_demo() rename to fn_demo_sembrar;
revoke all on function public.fn_demo_sembrar() from public, anon, authenticated;

create or replace function public.fn_guest_seed_demo()
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_plan_id bigint;
begin
  v_plan_id := fn_demo_sembrar();
  perform fn_demo_marcar(auth.uid());
  return v_plan_id;
end;
$$;
revoke all on function public.fn_guest_seed_demo() from public, anon;
grant execute on function public.fn_guest_seed_demo() to authenticated;

-- Lo que ya existía (invitados y cuentas que pulsaron «Ver el ejemplo»).
do $$
declare
  v_user uuid;
begin
  for v_user in
    select distinct (raw_user_meta_data->>'demo_friend_of')::uuid
      from auth.users
     where raw_user_meta_data ? 'demo_friend_of'
  loop
    perform fn_demo_marcar(v_user);
  end loop;
end;
$$;
