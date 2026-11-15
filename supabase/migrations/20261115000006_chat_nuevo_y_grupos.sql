-- Nuevo chat y grupos (canvas «Frimee · Chat · Bitácora», tableros nc-*).
--
-- 1) Cada chat de grupo apunta a su fila de `grupos` (chat.grupo_id). Hasta ahora añadir a alguien
--    o salir del grupo buscaba esa fila POR NOMBRE (`where nombre = … limit 1`), así que con dos
--    grupos llamados igual (y ahora «Nuevo grupo» es el nombre de partida) se tocaba el grupo de
--    otra persona: dar de alta, quitar o cambiar el admin en un grupo ajeno.
-- 2) fn_chat_create_grupo crea el chat Y su grupo en una sola transacción (antes la app hacía dos
--    llamadas en paralelo sin nada que las uniera). Nombre obligatorio (nunca vacío ni con los
--    nombres de los miembros), al menos 2 personas además de ti, y todas amigas tuyas.
-- 3) fn_chat_get_or_create_directo: exige sesión y amistad para CREAR (un chat que ya existe se
--    devuelve aunque ya no seáis amigos: su historial sigue siendo vuestro) y bloquea la pareja
--    mientras busca o crea, así dos llamadas a la vez no dejan dos chats con la misma persona.
-- 4) fn_chats_list no enseña los chats 1 a 1 sin mensajes: el chat se crea al enviar el primero, y
--    si ese envío falla no queda un chat vacío en la lista. También oculta los vacíos de antes.
--    Un grupo recién creado sin mensajes se ordena por su fecha de creación (arriba, no al final).
-- 5) fn_chat_buscar_mensajes: el bloque «Mensajes» del buscador (texto de tus chats).
-- 6) fn_chat_amigos_sugeridos: «Amigos con los que hablar», 5 amigos sin chat, los más relevantes.
--
-- Funciones de la app afectadas: fn_chat_add_miembro y fn_chat_leave (ahora por grupo_id).

-- 1) Referencia chat → grupos.
alter table public.chat add column if not exists grupo_id bigint
  references public.grupos(id) on delete set null;
create unique index if not exists chat_grupo_id_key on public.chat (grupo_id) where grupo_id is not null;

-- Grupos que ya existen: una sola vez, por nombre y con algún miembro en común; si hay varios,
-- el más antiguo. Un grupo de `grupos` solo se enlaza a un chat (el índice único).
do $$
declare
  r record;
  v_grupo bigint;
begin
  for r in select c.id, c.nombre from public.chat c
           where c.tipo = 'GRUPO' and c.grupo_id is null and c.nombre is not null
           order by c.created_at
  loop
    select g.id into v_grupo
    from public.grupos g
    where g.nombre = r.nombre
      and not exists (select 1 from public.chat c2 where c2.grupo_id = g.id)
      and exists (
        select 1 from public.miembros_grupo mg
        join public.chat_miembro cm on cm.user_id = mg.user_id and cm.chat_id = r.id
        where mg.grupo_id = g.id
      )
    order by g.fecha_registro, g.id
    limit 1;
    if v_grupo is not null then
      update public.chat set grupo_id = v_grupo where id = r.id;
    end if;
  end loop;
end $$;

-- ¿Son amigos (amistad activa)? amistades guarda la pareja ordenada (user_id_1 < user_id_2).
create or replace function public.fn_son_amigos(p_a uuid, p_b uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select exists (
    select 1 from amistades
    where user_id_1 = least(p_a, p_b) and user_id_2 = greatest(p_a, p_b) and estado = 'ACTIVA'
  );
$$;
revoke execute on function public.fn_son_amigos(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_son_amigos(uuid, uuid) to service_role;

-- 2) Crear un grupo: chat + grupo + miembros, todo o nada.
create or replace function public.fn_chat_create_grupo(p_nombre text, p_foto text default null, p_miembros uuid[] default '{}')
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_otros uuid[];
  v_grupo bigint;
  v_chat uuid;
begin
  if v_uid is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_nombre = '' then
    raise exception 'El grupo necesita un nombre' using errcode = '22023';
  end if;
  if char_length(v_nombre) > 80 then
    raise exception 'El nombre del grupo es demasiado largo' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct m), '{}') into v_otros
  from unnest(coalesce(p_miembros, '{}')) as m
  where m is not null and m <> v_uid;

  if cardinality(v_otros) < 2 then
    raise exception 'Elige al menos 2 personas' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_otros) as m where not fn_son_amigos(v_uid, m)) then
    raise exception 'Solo puedes añadir a tus amigos' using errcode = '42501';
  end if;

  -- El trigger trg_grupos_creator_is_member da de alta al creador como ADMIN.
  insert into grupos (nombre, visibilidad, creado_por_user_id, imagen)
  values (v_nombre, 'PRIVADO', v_uid, nullif(btrim(p_foto), ''))
  returning id into v_grupo;

  insert into miembros_grupo (grupo_id, user_id, rol, estado)
  select v_grupo, m, 'BASICO', 'ACTIVO' from unnest(v_otros) as m
  on conflict (grupo_id, user_id) do nothing;

  insert into chat (tipo, nombre, foto, grupo_id)
  values ('GRUPO', v_nombre, nullif(btrim(p_foto), ''), v_grupo)
  returning id into v_chat;

  insert into chat_miembro (chat_id, user_id)
  select v_chat, m from unnest(array_append(v_otros, v_uid)) as m
  on conflict do nothing;

  return v_chat;
end;
$$;
revoke execute on function public.fn_chat_create_grupo(text, text, uuid[]) from public, anon;
grant execute on function public.fn_chat_create_grupo(text, text, uuid[]) to authenticated, service_role;

-- 3) Chat 1 a 1: el que ya existe, o uno nuevo si sois amigos.
create or replace function public.fn_chat_get_or_create_directo(p_other_user_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_chat uuid;
begin
  if v_uid is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_other_user_id is null or p_other_user_id = v_uid then
    raise exception 'Persona no válida' using errcode = '22023';
  end if;

  -- Una pareja a la vez (el bloqueo se suelta al acabar la transacción).
  perform pg_advisory_xact_lock(hashtextextended(
    'chat_directo:' || least(v_uid, p_other_user_id)::text || ':' || greatest(v_uid, p_other_user_id)::text, 0));

  select c.id into v_chat
  from chat c
  join chat_miembro a on a.chat_id = c.id and a.user_id = v_uid
  join chat_miembro b on b.chat_id = c.id and b.user_id = p_other_user_id
  where c.tipo = 'DIRECTO'
  order by c.created_at
  limit 1;

  if v_chat is not null then
    return v_chat;
  end if;

  if not fn_son_amigos(v_uid, p_other_user_id) then
    raise exception 'Solo puedes escribir a tus amigos' using errcode = '42501';
  end if;

  insert into chat (tipo) values ('DIRECTO') returning id into v_chat;
  insert into chat_miembro (chat_id, user_id) values (v_chat, v_uid), (v_chat, p_other_user_id);
  return v_chat;
end;
$$;
revoke execute on function public.fn_chat_get_or_create_directo(uuid) from public, anon;
grant execute on function public.fn_chat_get_or_create_directo(uuid) to authenticated, service_role;

-- Añadir a alguien a un chat: el alta en su grupo va por grupo_id.
create or replace function public.fn_chat_add_miembro(p_chat_id uuid, p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_grupo bigint;
begin
  if not exists (select 1 from chat_miembro where chat_id = p_chat_id and user_id = auth.uid()) then
    raise exception 'No eres miembro de este chat' using errcode = '42501';
  end if;

  insert into chat_miembro (chat_id, user_id)
  values (p_chat_id, p_user_id)
  on conflict (chat_id, user_id) do nothing;

  select grupo_id into v_grupo from chat where id = p_chat_id and tipo = 'GRUPO';
  if v_grupo is not null then
    insert into miembros_grupo (grupo_id, user_id, rol, estado)
    values (v_grupo, p_user_id, 'BASICO', 'ACTIVO')
    on conflict (grupo_id, user_id) do update set estado = 'ACTIVO';
  end if;
end;
$$;

-- Salir de un chat: si era un grupo y eras su último admin, otro miembro pasa a admin.
create or replace function public.fn_chat_leave(p_chat_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_grupo bigint;
  v_new_admin uuid;
begin
  select grupo_id into v_grupo from chat where id = p_chat_id and tipo = 'GRUPO';

  if v_grupo is not null then
    if (select count(*) from miembros_grupo
        where grupo_id = v_grupo and rol = 'ADMIN' and estado = 'ACTIVO') = 1
       and exists (select 1 from miembros_grupo
                   where grupo_id = v_grupo and user_id = auth.uid() and rol = 'ADMIN') then
      select user_id into v_new_admin
      from miembros_grupo
      where grupo_id = v_grupo and user_id <> auth.uid() and estado = 'ACTIVO'
      order by random()
      limit 1;
      if v_new_admin is not null then
        update miembros_grupo set rol = 'ADMIN' where grupo_id = v_grupo and user_id = v_new_admin;
      end if;
    end if;

    delete from miembros_grupo where grupo_id = v_grupo and user_id = auth.uid();
  end if;

  delete from chat_miembro where chat_id = p_chat_id and user_id = auth.uid();
end;
$$;

-- 4) Lista de chats: como 20261114000001, sin los 1 a 1 que aún no tienen mensajes.
create or replace function public.fn_chats_list()
 returns table(chat_id uuid, tipo text, nombre text, foto text, last_message text, last_message_at timestamp with time zone, unread_count bigint, miembros jsonb, plan_id bigint, plan_titulo text, plan_inicio_at timestamp with time zone, plan_fin_at timestamp with time zone, plan_ubicacion text, plan_foto text)
 language sql
 security definer
 set search_path to 'public'
as $$
  select
    c.id as chat_id,
    c.tipo::text,
    c.nombre::text,
    c.foto::text,
    c.last_message::text,
    c.last_message_at,
    (
      select count(*)
      from mensajes m
      where m.chat_id = c.id
        and m.created_at > coalesce(cm_me.last_read_at, '-infinity'::timestamptz)
        and m.sender_id <> auth.uid()
    ) as unread_count,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', u.id,
          'nombre', u.nombre,
          'username', u.username,
          'profile_image', u.profile_image
        ))
        from chat_miembro cm_all
        join usuarios u on u.id = cm_all.user_id and u.deleted_at is null
        where cm_all.chat_id = c.id
      ),
      '[]'::jsonb
    ) as miembros,
    p.id as plan_id,
    p.titulo::text as plan_titulo,
    p.inicio_at as plan_inicio_at,
    p.fin_at as plan_fin_at,
    p.ubicacion_nombre::text as plan_ubicacion,
    p.foto_portada as plan_foto
  from chat c
  join chat_miembro cm_me on cm_me.chat_id = c.id and cm_me.user_id = auth.uid()
  left join plan p on p.id = c.plan_id and p.deleted_at is null
  where c.tipo <> 'DIRECTO' or exists (select 1 from mensajes m where m.chat_id = c.id)
  -- A group created «sin escribir» has no message yet: it goes by when it was created, at the top.
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;
revoke execute on function public.fn_chats_list() from public, anon;
grant execute on function public.fn_chats_list() to authenticated, service_role;

-- 5) Buscar en tus mensajes (texto de personas; ni JSON de momentos ni @frimee). Mínimo 2 letras.
create or replace function public.fn_chat_buscar_mensajes(p_q text, p_limit int default 20)
 returns table(mensaje_id bigint, chat_id uuid, texto text, created_at timestamptz, sender_id uuid, sender_nombre text)
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select m.id, m.chat_id, m.texto, m.created_at, m.sender_id, u.nombre::text
  from mensajes m
  join chat_miembro cm on cm.chat_id = m.chat_id and cm.user_id = auth.uid()
  left join usuarios u on u.id = m.sender_id
  where char_length(btrim(coalesce(p_q, ''))) >= 2
    and m.tipo = 'text'
    and left(m.texto, 1) <> '{'
    and m.texto ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke execute on function public.fn_chat_buscar_mensajes(text, int) from public, anon;
grant execute on function public.fn_chat_buscar_mensajes(text, int) to authenticated, service_role;

-- 6) «Amigos con los que hablar» (buscador sin escribir): amigos con los que aún no tengo un chat
--    1 a 1 con mensajes, los más relevantes primero: con los que comparto más planes o grupos, luego
--    los de actividad compartida más reciente, luego las amistades más nuevas. El resto se encuentra
--    escribiendo su nombre.
create or replace function public.fn_chat_amigos_sugeridos(p_limit int default 5)
 returns table(id uuid, nombre text, username text, profile_image text, compartidos int)
 language sql
 stable security definer
 set search_path to 'public'
as $$
  with amigos as (
    select case when a.user_id_1 = auth.uid() then a.user_id_2 else a.user_id_1 end as id, a.created_at
    from amistades a
    where (a.user_id_1 = auth.uid() or a.user_id_2 = auth.uid()) and a.estado = 'ACTIVA'
  ),
  con_chat as (
    select b.user_id as id
    from chat c
    join chat_miembro a on a.chat_id = c.id and a.user_id = auth.uid()
    join chat_miembro b on b.chat_id = c.id and b.user_id <> auth.uid()
    where c.tipo = 'DIRECTO' and exists (select 1 from mensajes m where m.chat_id = c.id)
  ),
  juntos as (
    select b.user_id as id, count(*)::int as n, max(coalesce(c.last_message_at, c.created_at)) as ultima
    from chat c
    join chat_miembro a on a.chat_id = c.id and a.user_id = auth.uid()
    join chat_miembro b on b.chat_id = c.id and b.user_id <> auth.uid()
    where c.tipo in ('GRUPO', 'PLAN')
    group by b.user_id
  )
  select u.id, u.nombre::text, u.username::text, u.profile_image::text, coalesce(j.n, 0)
  from amigos f
  join usuarios u on u.id = f.id and u.deleted_at is null
  left join juntos j on j.id = f.id
  where auth.uid() is not null and f.id not in (select id from con_chat)
  order by coalesce(j.n, 0) desc, j.ultima desc nulls last, f.created_at desc, u.nombre
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;
revoke execute on function public.fn_chat_amigos_sugeridos(int) from public, anon;
grant execute on function public.fn_chat_amigos_sugeridos(int) to authenticated, service_role;
