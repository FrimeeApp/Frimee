-- Demo efímera, paso 2: borrar el ejemplo de una persona sin tocar su cuenta.
--
-- fn_guest_cleanup borra a un invitado entero (cuenta incluida). Aquí se hace lo mismo con
-- lo que es de ejemplo —planes y grupos con es_demo, los perfiles ficticios y lo que cuelga
-- de ellos— y la cuenta se queda: su perfil, sus planes reales, sus amigos y chats reales.
--
-- · fn_demo_borrar_de(usuario): interna (no la llama nadie desde la app). La usará la limpieza
--   nocturna de respaldo.
-- · fn_demo_borrar(): la llama la propia persona, solo sobre sí misma. En una cuenta de
--   invitado no hace nada: el invitado conserva su ejemplo hasta que se borra la cuenta.
--
-- Devuelve cuántos planes, grupos, chats y perfiles ficticios se han borrado.

create or replace function public.fn_demo_borrar_de(p_user uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_pers uuid[];   -- perfiles ficticios de esta persona
  v_todos uuid[];  -- ella y sus perfiles ficticios
  v_planes integer := 0;
  v_grupos integer := 0;
  v_chats integer := 0;
  v_n integer;
begin
  select coalesce(array_agg(id), '{}') into v_pers
    from auth.users
   where raw_user_meta_data->>'demo_friend_of' = p_user::text;
  v_todos := array[p_user] || v_pers;

  -- 1. Planes de ejemplo: la cascada se lleva actividades, gastos, deudas y el chat del plan.
  delete from factura_gastos
   where gasto_id in (
     select g.id from gastos g
       join plan p on p.id = g.plan_id
      where p.es_demo
        and exists (select 1 from plan_usuarios pu where pu.plan_id = p.id and pu.user_id = any(v_todos)));
  delete from plan p
   where p.es_demo
     and exists (select 1 from plan_usuarios pu where pu.plan_id = p.id and pu.user_id = any(v_todos));
  get diagnostics v_planes = row_count;

  -- 2. Lo que los perfiles ficticios hubieran dejado fuera de esos planes.
  if cardinality(v_pers) > 0 then
    delete from factura_gastos
     where gasto_id in (select id from gastos where created_by_user_id = any(v_pers) or pagado_por_user_id = any(v_pers));
    delete from gastos where created_by_user_id = any(v_pers) or pagado_por_user_id = any(v_pers);
    delete from gasto_partes where user_id = any(v_pers);
    delete from liquidaciones where from_user_id = any(v_pers) or to_user_id = any(v_pers);
    delete from subplan where creado_por_user_id = any(v_pers);
    delete from plan_tareas where creado_por_user_id = any(v_pers);
    delete from plan_presupuestos where created_by_user_id = any(v_pers);
    delete from presupuestos where created_by_user_id = any(v_pers);
    delete from reservas where created_by_user_id = any(v_pers);
    delete from evento where creado_por_user_id = any(v_pers);
    delete from llamadas where iniciado_por_user_id = any(v_pers);
    delete from categorias_gasto where owner_user_id = any(v_pers);
    delete from facturas where emitida_por_user_id = any(v_pers);
  end if;

  -- 3. Grupos de ejemplo (el trigger del último admin deja borrar un grupo entero).
  delete from grupos g
   where g.es_demo
     and (g.creado_por_user_id = any(v_todos)
          or exists (select 1 from chat c
                       join chat_miembro cm on cm.chat_id = c.id
                      where c.grupo_id = g.id and cm.user_id = any(v_todos)));
  get diagnostics v_grupos = row_count;

  -- 4. Chats donde solo están ella y sus perfiles ficticios (1 a 1 y grupos). Uno con alguien
  --    real se queda.
  if cardinality(v_pers) > 0 then
    delete from chat c
     where c.tipo in ('DIRECTO', 'GRUPO')
       and exists (select 1 from chat_miembro m where m.chat_id = c.id and m.user_id = any(v_pers))
       and not exists (select 1 from chat_miembro m where m.chat_id = c.id and not (m.user_id = any(v_todos)));
    get diagnostics v_chats = row_count;

    -- 5. Avisos y amistades que vienen de la demo (Pablo, el concierto…).
    delete from notificaciones where user_id = p_user and actor_id = any(v_pers);
    delete from amistades where user_id_1 = any(v_pers) or user_id_2 = any(v_pers);

    -- 6. Los perfiles ficticios; su fila de usuarios y lo que quedara cuelga de aquí.
    delete from auth.users where id = any(v_pers);
    get diagnostics v_n = row_count;
  else
    v_n := 0;
  end if;

  return jsonb_build_object('planes', v_planes, 'grupos', v_grupos, 'chats', v_chats, 'personas', v_n);
end;
$$;
revoke all on function public.fn_demo_borrar_de(uuid) from public, anon, authenticated;

create or replace function public.fn_demo_borrar()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Hace falta una sesión';
  end if;
  if exists (select 1 from auth.users where id = v_user and is_anonymous) then
    return jsonb_build_object('planes', 0, 'grupos', 0, 'chats', 0, 'personas', 0);
  end if;
  return fn_demo_borrar_de(v_user);
end;
$$;
revoke all on function public.fn_demo_borrar() from public, anon;
grant execute on function public.fn_demo_borrar() to authenticated;
