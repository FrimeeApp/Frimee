-- Información del chat (tableros gi-*, gi-sistema) · paso de publicación 2.29.
--
-- 1) Por miembro: silenciar el chat, vaciarlo (solo para ti) y eliminar un 1 a 1 de tu lista
--    (vuelve si la otra persona escribe).
-- 2) Renombrar el grupo (cualquiera) y quitar a alguien (solo admin), con aviso en el chat.
-- 3) fn_chat_info: recuentos de «En el chat», planes del grupo, planes en común y amistad (1 a 1).
-- 4) fn_chat_contenido: las listas de «En el chat» (fotos, sitios, enlaces, decisiones) por páginas.
-- 5) Lo vaciado deja de verse: listas de mensajes, tramo, índice (regla), búsqueda, fijado y lista
--    de chats.
--
-- 6) Eliminar mensajes: para mí (mensaje_oculto) o para todos (autor, o admin con los de otros),
--    que deja «Se eliminó este mensaje» y actualiza la lista de chats (chat-17).
-- 7) Avisos en el chat: «Álex añadió a Marcos», «Ana salió del grupo», «Álex quitó a Ana».
-- 8) «En el chat» con vídeos (junto a las fotos) y archivos: mensajes.document_size (lo guarda
--    fn_mensaje_send, que además pasa a exigir ser miembro del chat y deja de estar abierta a anon).
--
-- Funciones de la app afectadas: fn_mensajes_list, fn_mensajes_tramo, fn_mensajes_list_despues,
-- fn_chat_indice, fn_chat_buscar_mensajes, fn_chat_pinned, fn_chat_add_miembro, fn_chat_leave,
-- fn_mensaje_delete, fn_mensaje_edit y fn_chats_list (ahora devuelve también
-- `silenciado`).

-- 1) Estado por miembro.
alter table public.chat_miembro add column if not exists silenciado boolean not null default false;
-- Último id de mensaje vaciado: los mensajes con id <= este no se ven para este miembro.
alter table public.chat_miembro add column if not exists vaciado_hasta bigint;
-- 1 a 1 eliminado de tu lista: vuelve en cuanto llega un mensaje posterior.
alter table public.chat_miembro add column if not exists eliminado_at timestamptz;
-- Tamaño en bytes de un documento enviado («Ana · 13 nov · 184 KB»); null en los de antes.
alter table public.mensajes add column if not exists document_size bigint;

-- «Eliminar para mí»: mensajes que alguien ha quitado solo de su vista.
create table if not exists public.mensaje_oculto (
  user_id uuid not null references auth.users(id) on delete cascade,
  mensaje_id bigint not null references public.mensajes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, mensaje_id)
);
alter table public.mensaje_oculto enable row level security;
-- Sin políticas: solo se toca desde las funciones de abajo (security definer).
revoke all on table public.mensaje_oculto from anon, authenticated;

-- Desde qué id se ven los mensajes (0 = todos). Interna: la usan las funciones de abajo.
create or replace function public.fn_chat_vaciado_hasta(p_chat_id uuid)
 returns bigint
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select coalesce((select vaciado_hasta from chat_miembro where chat_id = p_chat_id and user_id = auth.uid()), 0);
$$;
revoke all on function public.fn_chat_vaciado_hasta(uuid) from public, anon, authenticated;
grant execute on function public.fn_chat_vaciado_hasta(uuid) to service_role;

-- ¿Este mensaje (JSON de momento) es una decisión tomada? Igual que el estado «decidido» de la regla.
create or replace function public.fn_momento_decidido(p_j jsonb)
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $$
  select case
    when p_j is null then false
    when p_j->>'type' = 'poll' then
      coalesce((p_j->>'closed')::boolean, false)
      or (p_j ? 'expires_at' and (p_j->>'expires_at')::timestamptz < now())
    when p_j->>'type' in ('hito_plan', 'plan_creado') then true
    when p_j->>'type' = 'propuesta' then p_j->>'estado' = 'aceptada'
    else false
  end;
$$;
revoke all on function public.fn_momento_decidido(jsonb) from public, anon;
grant execute on function public.fn_momento_decidido(jsonb) to authenticated, service_role;

-- 2) Silenciar, vaciar y eliminar (solo afectan a quien lo hace).
create or replace function public.fn_chat_silenciar(p_chat_id uuid, p_silenciado boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  update chat_miembro set silenciado = coalesce(p_silenciado, false)
   where chat_id = p_chat_id and user_id = auth.uid();
  if not found then
    raise exception 'No eres miembro de este chat' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.fn_chat_vaciar(p_chat_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_max bigint;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  select max(id) into v_max from mensajes where chat_id = p_chat_id;
  update chat_miembro
     set vaciado_hasta = greatest(coalesce(vaciado_hasta, 0), coalesce(v_max, 0)),
         last_read_at = now()
   where chat_id = p_chat_id and user_id = auth.uid();
end;
$$;

-- Solo 1 a 1: lo vacía y lo quita de tu lista hasta que llegue un mensaje nuevo.
create or replace function public.fn_chat_eliminar(p_chat_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  if not exists (select 1 from chat where id = p_chat_id and tipo = 'DIRECTO') then
    raise exception 'Solo se puede eliminar un chat 1 a 1' using errcode = '22023';
  end if;
  perform public.fn_chat_vaciar(p_chat_id);
  update chat_miembro set eliminado_at = now() where chat_id = p_chat_id and user_id = auth.uid();
end;
$$;

-- 3) Renombrar el grupo: cualquiera del grupo. Deja «Ana cambió el nombre a «X»» en el chat.
-- Las que dejan un aviso lo devuelven ({mensaje_id, texto}): `mensajes` no emite cambios en tiempo
-- real, así que la app de quien lo hace lo reparte por broadcast (como «Plan creado»).
drop function if exists public.fn_chat_renombrar(uuid, text);
drop function if exists public.fn_chat_quitar_miembro(uuid, uuid);
drop function if exists public.fn_chat_aviso_gente(uuid, text, uuid, uuid);
drop function if exists public.fn_chat_add_miembro(uuid, uuid);
drop function if exists public.fn_chat_leave(uuid);

create or replace function public.fn_chat_renombrar(p_chat_id uuid, p_nombre text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_chat record;
  v_actor text;
  v_texto text;
  v_id bigint;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  select id, tipo, nombre, grupo_id into v_chat from chat where id = p_chat_id for update;
  if v_chat.tipo <> 'GRUPO' then
    raise exception 'Solo se puede renombrar un grupo' using errcode = '22023';
  end if;
  if char_length(v_nombre) = 0 or char_length(v_nombre) > 80 then
    raise exception 'El nombre del grupo es obligatorio (máximo 80)' using errcode = '22023';
  end if;
  if v_nombre = coalesce(v_chat.nombre, '') then
    return null;
  end if;

  update chat set nombre = v_nombre where id = p_chat_id;
  if v_chat.grupo_id is not null then
    update grupos set nombre = v_nombre where id = v_chat.grupo_id;
  end if;

  select nombre into v_actor from usuarios where id = v_me;
  v_texto := jsonb_build_object(
    'type', 'aviso', 'clase', 'renombrado',
    'actor_id', v_me, 'actor_nombre', coalesce(v_actor, 'Alguien'),
    'nombre', v_nombre)::text;
  insert into mensajes (chat_id, sender_id, texto, leido_por)
  values (p_chat_id, v_me, v_texto, array[v_me])
  returning id into v_id;
  update chat set last_message = coalesce(v_actor, 'Alguien') || ' cambió el nombre a «' || v_nombre || '»',
                  last_message_at = now()
   where id = p_chat_id;
  return jsonb_build_object('mensaje_id', v_id, 'texto', v_texto);
end;
$$;

-- Quitar a alguien: solo un admin del grupo (grupos enlazados). Deja el aviso en el chat.
create or replace function public.fn_chat_quitar_miembro(p_chat_id uuid, p_user_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_grupo bigint;
begin
  select grupo_id into v_grupo from chat where id = p_chat_id and tipo = 'GRUPO';
  if v_grupo is null or not exists (
    select 1 from miembros_grupo
     where grupo_id = v_grupo and user_id = v_me and rol = 'ADMIN' and estado = 'ACTIVO') then
    raise exception 'Solo un admin del grupo puede quitar a alguien' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_me then
    raise exception 'Para irte, usa «Salir del grupo»' using errcode = '22023';
  end if;

  delete from chat_miembro where chat_id = p_chat_id and user_id = p_user_id;
  if not found then
    return null; -- ya no estaba: nada que avisar
  end if;
  delete from miembros_grupo where grupo_id = v_grupo and user_id = p_user_id;
  return public.fn_chat_aviso_gente(p_chat_id, 'quitado', v_me, p_user_id);
end;
$$;

-- Aviso en el chat cuando cambia la gente (interna). p_clase: 'anadido' | 'quitado' | 'salio'.
create or replace function public.fn_chat_aviso_gente(p_chat_id uuid, p_clase text, p_actor uuid, p_user uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_actor text;
  v_user text;
  v_preview text;
  v_texto text;
  v_id bigint;
begin
  select nombre into v_actor from usuarios where id = p_actor;
  select nombre into v_user from usuarios where id = p_user;
  v_texto := jsonb_build_object(
    'type', 'aviso', 'clase', p_clase,
    'actor_id', p_actor, 'actor_nombre', coalesce(v_actor, 'Alguien'),
    'user_id', p_user, 'user_nombre', coalesce(v_user, 'Alguien'))::text;
  insert into mensajes (chat_id, sender_id, texto, leido_por)
  values (p_chat_id, p_actor, v_texto, array[p_actor])
  returning id into v_id;
  v_preview := case p_clase
    when 'anadido' then coalesce(v_actor, 'Alguien') || ' añadió a ' || coalesce(v_user, 'alguien')
    when 'quitado' then coalesce(v_actor, 'Alguien') || ' quitó a ' || coalesce(v_user, 'alguien') || ' del grupo'
    else coalesce(v_user, 'Alguien') || ' salió del grupo' end;
  update chat set last_message = v_preview, last_message_at = now() where id = p_chat_id;
  return jsonb_build_object('mensaje_id', v_id, 'texto', v_texto);
end;
$$;
revoke all on function public.fn_chat_aviso_gente(uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_chat_aviso_gente(uuid, text, uuid, uuid) to service_role;

-- Añadir a alguien: como 20261115000006, con aviso «Álex añadió a Marcos» (solo si no estaba).
create or replace function public.fn_chat_add_miembro(p_chat_id uuid, p_user_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_grupo bigint;
  v_nuevo boolean;
begin
  if not exists (select 1 from chat_miembro where chat_id = p_chat_id and user_id = auth.uid()) then
    raise exception 'No eres miembro de este chat' using errcode = '42501';
  end if;

  insert into chat_miembro (chat_id, user_id)
  values (p_chat_id, p_user_id)
  on conflict (chat_id, user_id) do nothing;
  v_nuevo := found;

  select grupo_id into v_grupo from chat where id = p_chat_id and tipo = 'GRUPO';
  if v_grupo is not null then
    insert into miembros_grupo (grupo_id, user_id, rol, estado)
    values (v_grupo, p_user_id, 'BASICO', 'ACTIVO')
    on conflict (grupo_id, user_id) do update set estado = 'ACTIVO';
  end if;

  if v_nuevo and exists (select 1 from chat where id = p_chat_id and tipo = 'GRUPO') then
    return public.fn_chat_aviso_gente(p_chat_id, 'anadido', auth.uid(), p_user_id);
  end if;
  return null;
end;
$$;

-- La app llamaba a esta versión antigua, que aún buscaba el grupo POR NOMBRE (el fallo que
-- 20261115000006 arreglaba en fn_chat_add_miembro). Ahora es la misma función.
create or replace function public.fn_chat_add_member(p_chat_id uuid, p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  perform public.fn_chat_add_miembro(p_chat_id, p_user_id);
end;
$$;

-- Salir: como 20261115000006, con aviso «Ana salió del grupo» en los grupos.
create or replace function public.fn_chat_leave(p_chat_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_tipo text;
  v_grupo bigint;
  v_new_admin uuid;
begin
  select tipo, grupo_id into v_tipo, v_grupo from chat where id = p_chat_id;

  if v_tipo = 'GRUPO' and v_grupo is not null then
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
  if found and v_tipo = 'GRUPO' then
    return public.fn_chat_aviso_gente(p_chat_id, 'salio', auth.uid(), auth.uid());
  end if;
  return null;
end;
$$;

-- Eliminar un mensaje. Para todos: el autor, o un admin del grupo / del plan con los de otros; el
-- mensaje queda como «Se eliminó este mensaje» (sin adjuntos, reacciones ni fijado). Para mí:
-- cualquier mensaje que veas, solo desaparece de tu vista.
create or replace function public.fn_mensaje_eliminar(p_mensaje_id bigint, p_para_todos boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_m record;
  v_chat record;
  v_admin boolean;
  v_lapida jsonb;
begin
  select id, chat_id, sender_id, texto into v_m from mensajes where id = p_mensaje_id;
  if v_m.id is null or not public.is_chat_member(v_m.chat_id) then
    raise exception 'Mensaje no encontrado' using errcode = '42501';
  end if;

  if not coalesce(p_para_todos, false) then
    insert into mensaje_oculto (user_id, mensaje_id) values (v_me, p_mensaje_id)
    on conflict do nothing;
    return;
  end if;

  if public.try_jsonb(v_m.texto)->>'type' = 'eliminado' then
    return; -- ya estaba eliminado
  end if;

  select c.id, c.tipo, c.grupo_id, c.plan_id, c.pinned_message_id into v_chat from chat c where c.id = v_m.chat_id;
  v_admin := (v_chat.grupo_id is not null and exists (
                select 1 from miembros_grupo where grupo_id = v_chat.grupo_id and user_id = v_me
                   and rol = 'ADMIN' and estado = 'ACTIVO'))
          or (v_chat.tipo = 'PLAN' and v_chat.plan_id is not null and exists (
                select 1 from plan_usuarios where plan_id = v_chat.plan_id and user_id = v_me
                   and rol = 'ADMIN' and estado = 'PARTICIPA'));
  if v_m.sender_id is distinct from v_me and not v_admin then
    raise exception 'Solo puedes eliminar para todos tus mensajes' using errcode = '42501';
  end if;

  v_lapida := jsonb_build_object('type', 'eliminado',
                                 'por', case when v_m.sender_id is distinct from v_me then 'admin' else 'autor' end);
  update mensajes
     set texto = v_lapida::text, audio_url = null, document_url = null, document_name = null,
         image_url = null, image_type = null, tipo = 'text'
   where id = p_mensaje_id;
  delete from mensaje_reacciones where mensaje_id = p_mensaje_id;
  if v_chat.pinned_message_id = p_mensaje_id then
    update chat set pinned_message_id = null, pinned_by = null, pinned_at = null where id = v_chat.id;
  end if;
  -- chat-17: si era el último, la lista de chats deja de enseñarlo.
  if not exists (select 1 from mensajes where chat_id = v_chat.id and id > p_mensaje_id) then
    update chat set last_message = case when v_lapida->>'por' = 'admin' then 'El admin eliminó este mensaje'
                                        else 'Se eliminó este mensaje' end
     where id = v_chat.id;
  end if;
end;
$$;

-- El borrado de siempre (apps aún sin actualizar): ahora es «eliminar para todos» de un mensaje tuyo.
create or replace function public.fn_mensaje_delete(p_mensaje_id bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if not exists (select 1 from mensajes where id = p_mensaje_id and sender_id = auth.uid()) then
    raise exception 'No tienes permiso para eliminar este mensaje';
  end if;
  perform public.fn_mensaje_eliminar(p_mensaje_id, true);
end;
$$;

-- Un mensaje eliminado ya no se puede editar.
create or replace function public.fn_mensaje_edit(p_mensaje_id bigint, p_texto text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if trim(coalesce(p_texto, '')) = '' then
    raise exception 'El mensaje no puede estar vacío';
  end if;

  update mensajes
     set texto = trim(p_texto)
   where id = p_mensaje_id
     and sender_id = auth.uid()
     and coalesce(public.try_jsonb(texto)->>'type', '') <> 'eliminado';

  if not found then
    raise exception 'No tienes permiso para editar este mensaje';
  end if;
end;
$$;

-- 4) Lo que enseña el panel de información.
create or replace function public.fn_chat_info(p_chat_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_corte bigint;
  v_chat record;
  v_otro uuid;
  v_result jsonb;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  v_corte := public.fn_chat_vaciado_hasta(p_chat_id);
  select c.id, c.tipo, c.grupo_id, c.plan_id, g.creado_por_user_id as grupo_creador
    into v_chat
    from chat c left join grupos g on g.id = c.grupo_id
   where c.id = p_chat_id;

  if v_chat.tipo = 'DIRECTO' then
    select user_id into v_otro from chat_miembro where chat_id = p_chat_id and user_id <> v_me limit 1;
  end if;

  with vis as (
    select id, texto, tipo, image_url, image_type, document_url,
           case when left(texto, 1) = '{' then public.try_jsonb(texto) end as j
      from mensajes
     where chat_id = p_chat_id and id > v_corte
       and not exists (select 1 from mensaje_oculto o where o.user_id = v_me and o.mensaje_id = mensajes.id)
  )
  select jsonb_build_object(
    'tipo', v_chat.tipo,
    'silenciado', (select silenciado from chat_miembro where chat_id = p_chat_id and user_id = v_me),
    'creador_id', case when v_chat.tipo = 'GRUPO' then v_chat.grupo_creador
                       when v_chat.tipo = 'PLAN' then (select creado_por_user_id from plan where id = v_chat.plan_id) end,
    'admins', case when v_chat.grupo_id is not null then coalesce((
        select jsonb_agg(user_id) from miembros_grupo
         where grupo_id = v_chat.grupo_id and rol = 'ADMIN' and estado = 'ACTIVO'), '[]'::jsonb)
      else '[]'::jsonb end,
    'recuentos', jsonb_build_object(
      -- Fotos y vídeos van juntos; archivos = documentos (las notas de voz no cuentan).
      'fotos', (select count(*) from vis where image_url is not null and (coalesce(image_type, 'image/') like 'image/%' or image_type like 'video/%')),
      'archivos', (select count(*) from vis where document_url is not null),
      'sitios', (select count(*) from vis where j->>'type' = 'lugar'),
      'enlaces', (select count(*) from vis where j is null and tipo = 'text' and texto ~* 'https?://'),
      'decisiones', (select count(*) from vis where public.fn_momento_decidido(j)),
      -- Destacados (chat-20): solo los míos (mensaje_destacado es por persona), sin los eliminados.
      'destacados', (select count(*) from vis
                      where exists (select 1 from mensaje_destacado d where d.mensaje_id = vis.id and d.user_id = v_me)
                        and coalesce(j->>'type', '') <> 'eliminado')
    ),
    -- Planes creados desde este chat (marca «Plan creado»), los que siguen activos.
    'planes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'titulo', p.titulo, 'inicio_at', p.inicio_at, 'fin_at', p.fin_at,
               'soy_miembro', exists (select 1 from plan_usuarios pu
                                       where pu.plan_id = p.id and pu.user_id = v_me and pu.estado = 'PARTICIPA'))
             order by p.inicio_at desc)
        from plan p
       where p.deleted_at is null and p.estado = 'ACTIVO'
         and p.id in (select (j->>'plan_id')::bigint from vis where j->>'type' = 'plan_creado')
    ), '[]'::jsonb),
    -- 1 a 1: planes en los que estáis los dos (los que vienen primero, luego los pasados).
    'comun', case when v_otro is null then '[]'::jsonb else coalesce((
      select jsonb_agg(x.o order by x.pasado, x.orden)
        from (
          select jsonb_build_object('id', p.id, 'titulo', p.titulo, 'inicio_at', p.inicio_at, 'fin_at', p.fin_at) as o,
                 (p.fin_at < now()) as pasado,
                 case when p.fin_at < now() then -extract(epoch from p.inicio_at) else extract(epoch from p.inicio_at) end as orden
            from plan p
           where p.deleted_at is null and p.estado = 'ACTIVO'
             and exists (select 1 from plan_usuarios a where a.plan_id = p.id and a.user_id = v_me and a.estado = 'PARTICIPA')
             and exists (select 1 from plan_usuarios b where b.plan_id = p.id and b.user_id = v_otro and b.estado = 'PARTICIPA')
           order by (p.fin_at < now()), case when p.fin_at < now() then -extract(epoch from p.inicio_at) else extract(epoch from p.inicio_at) end
           limit 5
        ) x), '[]'::jsonb) end,
    'amigos_desde', case when v_otro is null then null else (
      select created_at from amistades
       where user_id_1 = least(v_me, v_otro) and user_id_2 = greatest(v_me, v_otro) and estado = 'ACTIVA') end
  ) into v_result;

  return v_result;
end;
$$;

-- Las listas de «En el chat», de la más nueva a la más vieja, por páginas (p_antes_id = cursor).
-- Cambia lo que devuelve (documentos): se borra antes de crearla.
drop function if exists public.fn_chat_contenido(uuid, text, bigint, integer);
create or replace function public.fn_chat_contenido(p_chat_id uuid, p_tipo text, p_antes_id bigint default null, p_limit integer default 30)
 returns table(id bigint, created_at timestamptz, sender_id uuid, sender_nombre text, texto text, image_url text, image_type text,
               document_url text, document_name text, document_size bigint)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_corte bigint;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  if p_tipo not in ('fotos', 'archivos', 'sitios', 'enlaces', 'decisiones', 'destacados') then
    raise exception 'Tipo desconocido: %', p_tipo using errcode = '22023';
  end if;
  v_corte := public.fn_chat_vaciado_hasta(p_chat_id);

  return query
  select m.id, m.created_at, m.sender_id, coalesce(u.nombre, 'Frimee')::text, m.texto, m.image_url, m.image_type,
         m.document_url, m.document_name, m.document_size
    from mensajes m
    left join usuarios u on u.id = m.sender_id
   where m.chat_id = p_chat_id
     and m.id > v_corte
     and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = m.id)
     and (p_antes_id is null or m.id < p_antes_id)
     and case p_tipo
           when 'fotos' then m.image_url is not null and (coalesce(m.image_type, 'image/') like 'image/%' or m.image_type like 'video/%')
           when 'archivos' then m.document_url is not null
           when 'sitios' then left(m.texto, 1) = '{' and public.try_jsonb(m.texto)->>'type' = 'lugar'
           when 'enlaces' then left(m.texto, 1) <> '{' and m.tipo = 'text' and m.texto ~* 'https?://'
           -- Solo mis estrellas: nadie ve lo que destacan los demás.
           when 'destacados' then exists (select 1 from mensaje_destacado d where d.mensaje_id = m.id and d.user_id = auth.uid())
                                  and coalesce(public.try_jsonb(m.texto)->>'type', '') <> 'eliminado'
           else left(m.texto, 1) = '{' and public.fn_momento_decidido(public.try_jsonb(m.texto))
         end
   order by m.id desc
   limit least(greatest(coalesce(p_limit, 30), 1), 60);
end;
$$;

-- 5) Lo vaciado no se ve. Mismas firmas que antes; solo se añade el corte.
create or replace function public.fn_mensajes_list(p_chat_id uuid, p_limit integer default 30, p_cursor_id bigint default null::bigint)
 returns table(id bigint, sender_id uuid, sender_nombre text, sender_profile_image text, texto text, created_at timestamp with time zone, reply_to_id bigint, reply_texto text, reply_sender_nombre text, audio_url text, document_url text, document_name text, image_url text, image_type text, tipo text)
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select public.assert_allowed(public.is_chat_member(p_chat_id));
  select
    m.id, m.sender_id, coalesce(u.nombre, 'Frimee'), u.profile_image, m.texto, m.created_at,
    m.reply_to_id, r.texto, coalesce(ru.nombre, 'Frimee'),
    m.audio_url, m.document_url, m.document_name, m.image_url, m.image_type, m.tipo
  from mensajes m
  left join usuarios u  on u.id = m.sender_id
  left join mensajes r  on r.id = m.reply_to_id
  left join usuarios ru on ru.id = r.sender_id
  where m.chat_id = p_chat_id
    and m.id > public.fn_chat_vaciado_hasta(p_chat_id)
    and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = m.id)
    and (p_cursor_id is null or m.id < p_cursor_id)
  order by m.id desc
  limit p_limit;
$$;

create or replace function public.fn_mensajes_tramo(p_chat_id uuid, p_mensaje_id bigint, p_antes integer default 25, p_despues integer default 25)
 returns table(id bigint, sender_id uuid, sender_nombre text, sender_profile_image text, texto text, created_at timestamp with time zone, reply_to_id bigint, reply_texto text, reply_sender_nombre text, audio_url text, document_url text, document_name text, image_url text, image_type text, tipo text, orden bigint)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_corte bigint;
  v_desde bigint;
  v_hasta bigint;
  v_base bigint;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  v_corte := public.fn_chat_vaciado_hasta(p_chat_id);
  -- The stretch: p_antes messages up to the target (included) and p_despues after it.
  select min(x.id) into v_desde from (
    select mm.id from mensajes mm where mm.chat_id = p_chat_id and mm.id > v_corte and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = mm.id) and mm.id <= p_mensaje_id order by mm.id desc limit greatest(p_antes, 0) + 1
  ) x;
  select max(x.id) into v_hasta from (
    select mm.id from mensajes mm where mm.chat_id = p_chat_id and mm.id > v_corte and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = mm.id) and mm.id > p_mensaje_id order by mm.id asc limit greatest(p_despues, 0)
  ) x;
  v_hasta := coalesce(v_hasta, p_mensaje_id);
  if v_desde is null then
    return;
  end if;
  select count(*) into v_base from mensajes mm where mm.chat_id = p_chat_id and mm.id > v_corte and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = mm.id) and mm.id < v_desde;

  return query
  select m.id, m.sender_id, coalesce(u.nombre, 'Frimee')::text, u.profile_image::text, m.texto, m.created_at,
         m.reply_to_id, r.texto, coalesce(ru.nombre, 'Frimee')::text,
         m.audio_url, m.document_url, m.document_name, m.image_url, m.image_type, m.tipo,
         v_base + (row_number() over (order by m.id)) - 1
    from mensajes m
    left join usuarios u  on u.id = m.sender_id
    left join mensajes r  on r.id = m.reply_to_id
    left join usuarios ru on ru.id = r.sender_id
   where m.chat_id = p_chat_id and m.id between v_desde and v_hasta
     and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = m.id)
   order by m.id;
end;
$$;

create or replace function public.fn_mensajes_list_despues(p_chat_id uuid, p_cursor_id bigint, p_limit integer default 50)
 returns table(id bigint, sender_id uuid, sender_nombre text, sender_profile_image text, texto text, created_at timestamp with time zone, reply_to_id bigint, reply_texto text, reply_sender_nombre text, audio_url text, document_url text, document_name text, image_url text, image_type text, tipo text)
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select public.assert_allowed(public.is_chat_member(p_chat_id));
  select m.id, m.sender_id, coalesce(u.nombre, 'Frimee')::text, u.profile_image::text, m.texto, m.created_at,
         m.reply_to_id, r.texto, coalesce(ru.nombre, 'Frimee')::text,
         m.audio_url, m.document_url, m.document_name, m.image_url, m.image_type, m.tipo
    from mensajes m
    left join usuarios u  on u.id = m.sender_id
    left join mensajes r  on r.id = m.reply_to_id
    left join usuarios ru on ru.id = r.sender_id
   where m.chat_id = p_chat_id
     and m.id > greatest(p_cursor_id, public.fn_chat_vaciado_hasta(p_chat_id))
     and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = m.id)
   order by m.id asc
   limit p_limit;
$$;

-- Índice de la regla: como 20261115000004, contando solo lo que se ve.
create or replace function public.fn_chat_indice(p_chat_id uuid, p_tz text default 'Europe/Madrid')
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_tz text := coalesce(nullif(p_tz, ''), 'Europe/Madrid');
  v_corte bigint;
  v_last_read timestamptz;
  v_result jsonb;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'Europe/Madrid';
  end if;
  v_corte := public.fn_chat_vaciado_hasta(p_chat_id);
  select last_read_at into v_last_read from chat_miembro where chat_id = p_chat_id and user_id = v_me;

  with m as (
    select id, sender_id, created_at, texto,
           (row_number() over (order by id)) - 1 as ord,
           (created_at at time zone v_tz)::date as dia
      from mensajes
     where chat_id = p_chat_id and id > v_corte
       and not exists (select 1 from mensaje_oculto o where o.user_id = v_me and o.mensaje_id = mensajes.id)
  ),
  runs as (
    select *, case when lag(dia) over (order by ord) is distinct from dia then 1 else 0 end as starts
      from m
  ),
  grp as (
    select *, sum(starts) over (order by ord) as g from runs
  ),
  dias as (
    select min(dia) as dia, min(id) as primer_id, min(ord) as desde, count(*) as n
      from grp group by g
  ),
  hitos as (
    select id, ord, created_at, j
      from (select id, ord, created_at, public.try_jsonb(texto) as j from m where left(texto, 1) = '{') x
     where j->>'type' in ('poll', 'propuesta', 'hito_plan', 'plan_creado')
       and coalesce(j->>'estado', '') <> 'descartada'
  )
  select jsonb_build_object(
    'total', (select count(*) from m),
    'max_id', (select max(id) from m),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'primer_id', primer_id, 'desde', desde, 'n', n) order by desde) from dias), '[]'::jsonb),
    'hitos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id,
        'ord', ord,
        'created_at', created_at,
        'tipo', j->>'type',
        'titulo', case when j->>'type' = 'poll' then j->>'question'
                       when j->>'type' = 'plan_creado' then 'Plan creado: ' || (j->>'titulo')
                       else j->>'titulo' end,
        'estado', case when public.fn_momento_decidido(j) then 'decidido' else 'abierto' end
      ) order by ord) from hitos), '[]'::jsonb),
    'primer_no_leido', (
      select jsonb_build_object('id', id, 'ord', ord)
        from m
       where sender_id is distinct from v_me
         and v_last_read is not null and created_at > v_last_read
       order by ord limit 1)
  ) into v_result;

  return v_result;
end;
$$;

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
    and m.id > coalesce(cm.vaciado_hasta, 0)
    and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = m.id)
    and m.tipo = 'text'
    and left(m.texto, 1) <> '{'
    and m.texto ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.fn_chat_pinned(p_chat_id uuid)
 returns table(mensaje_id bigint, pinned_by uuid, pinned_at timestamptz)
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select c.pinned_message_id, c.pinned_by, c.pinned_at
  from chat c
  join chat_miembro cm on cm.chat_id = c.id and cm.user_id = auth.uid()
  where c.id = p_chat_id and c.pinned_message_id is not null
    and c.pinned_message_id > coalesce(cm.vaciado_hasta, 0)
    and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = c.pinned_message_id);
$$;

-- Lista de chats: añade `silenciado`; un chat vaciado no enseña su último mensaje ni no leídos
-- anteriores; un 1 a 1 eliminado no sale hasta que llega un mensaje nuevo. Cambia el tipo de
-- retorno, así que se recrea.
drop function if exists public.fn_chats_list();
create function public.fn_chats_list()
 returns table(chat_id uuid, tipo text, nombre text, foto text, last_message text, last_message_at timestamp with time zone, unread_count bigint, miembros jsonb, plan_id bigint, plan_titulo text, plan_inicio_at timestamp with time zone, plan_fin_at timestamp with time zone, plan_ubicacion text, plan_foto text, silenciado boolean)
 language sql
 security definer
 set search_path to 'public'
as $$
  select
    c.id as chat_id,
    c.tipo::text,
    c.nombre::text,
    c.foto::text,
    case when cm_me.vaciado_hasta is not null
              and not exists (select 1 from mensajes m where m.chat_id = c.id and m.id > cm_me.vaciado_hasta)
         then null else c.last_message::text end as last_message,
    c.last_message_at,
    (
      select count(*)
      from mensajes m
      where m.chat_id = c.id
        and m.id > coalesce(cm_me.vaciado_hasta, 0)
        and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = m.id)
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
    p.foto_portada as plan_foto,
    cm_me.silenciado
  from chat c
  join chat_miembro cm_me on cm_me.chat_id = c.id and cm_me.user_id = auth.uid()
  left join plan p on p.id = c.plan_id and p.deleted_at is null
  where (c.tipo <> 'DIRECTO' or exists (select 1 from mensajes m where m.chat_id = c.id))
    and (cm_me.eliminado_at is null
         or exists (select 1 from mensajes m where m.chat_id = c.id and m.created_at > cm_me.eliminado_at))
  -- A group created «sin escribir» has no message yet: it goes by when it was created, at the top.
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

-- 8) «Eliminar el plan» desde la información de su chat: solo quien lo creó y solo cuando es la única
--    persona del plan (si sale, el plan se quedaría vacío; fn_plan_leave ni le deja salir). Se marca
--    como borrado (deleted_at), como el resto de la app espera, y su chat sale de la lista.
create or replace function public.fn_plan_eliminar(p_plan_id bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
begin
  if not exists (select 1 from plan
                  where id = p_plan_id and deleted_at is null
                    and (owner_user_id = v_me or creado_por_user_id = v_me)) then
    raise exception 'Solo quien creó el plan puede eliminarlo' using errcode = '42501';
  end if;
  if exists (select 1 from plan_usuarios
              where plan_id = p_plan_id and user_id <> v_me and estado = 'PARTICIPA') then
    raise exception 'El plan tiene más personas: no se puede eliminar' using errcode = '22023';
  end if;

  update plan set deleted_at = now() where id = p_plan_id;
  delete from chat_miembro
   where user_id = v_me and chat_id in (select id from chat where plan_id = p_plan_id and tipo = 'PLAN');
end;
$$;
revoke all on function public.fn_plan_eliminar(bigint) from public, anon;
grant execute on function public.fn_plan_eliminar(bigint) to authenticated, service_role;

-- Permisos: nada para visitantes sin sesión.
revoke all on function public.fn_chats_list() from public, anon;
grant execute on function public.fn_chats_list() to authenticated, service_role;
revoke all on function public.fn_chat_silenciar(uuid, boolean) from public, anon;
grant execute on function public.fn_chat_silenciar(uuid, boolean) to authenticated, service_role;
revoke all on function public.fn_chat_vaciar(uuid) from public, anon;
grant execute on function public.fn_chat_vaciar(uuid) to authenticated, service_role;
revoke all on function public.fn_chat_eliminar(uuid) from public, anon;
grant execute on function public.fn_chat_eliminar(uuid) to authenticated, service_role;
revoke all on function public.fn_chat_renombrar(uuid, text) from public, anon;
grant execute on function public.fn_chat_renombrar(uuid, text) to authenticated, service_role;
revoke all on function public.fn_chat_quitar_miembro(uuid, uuid) from public, anon;
grant execute on function public.fn_chat_quitar_miembro(uuid, uuid) to authenticated, service_role;
revoke all on function public.fn_mensaje_eliminar(bigint, boolean) from public, anon;
grant execute on function public.fn_mensaje_eliminar(bigint, boolean) to authenticated, service_role;
revoke all on function public.fn_mensaje_delete(bigint) from public, anon;
revoke all on function public.fn_mensaje_edit(bigint, text) from public, anon;
revoke all on function public.fn_chat_add_miembro(uuid, uuid) from public, anon;
grant execute on function public.fn_chat_add_miembro(uuid, uuid) to authenticated, service_role;
revoke all on function public.fn_chat_add_member(uuid, uuid) from public, anon;
revoke all on function public.fn_chat_leave(uuid) from public, anon;
grant execute on function public.fn_chat_leave(uuid) to authenticated, service_role;
revoke all on function public.fn_chat_info(uuid) from public, anon;
grant execute on function public.fn_chat_info(uuid) to authenticated, service_role;
revoke all on function public.fn_chat_contenido(uuid, text, bigint, integer) from public, anon;
grant execute on function public.fn_chat_contenido(uuid, text, bigint, integer) to authenticated, service_role;
revoke all on function public.fn_mensajes_list(uuid, integer, bigint) from public, anon;
revoke all on function public.fn_mensajes_tramo(uuid, bigint, integer, integer) from public, anon;
revoke all on function public.fn_mensajes_list_despues(uuid, bigint, integer) from public, anon;
revoke all on function public.fn_chat_indice(uuid, text) from public, anon;
revoke all on function public.fn_chat_buscar_mensajes(text, int) from public, anon;
revoke all on function public.fn_chat_pinned(uuid) from public, anon;

-- 8) Enviar un mensaje: guarda el tamaño de los documentos y exige ser miembro del chat.
drop function if exists public.fn_mensaje_send(uuid, text, bigint, text, text, text, text, text);
create or replace function public.fn_mensaje_send(
  p_chat_id uuid, p_texto text, p_reply_to_id bigint default null, p_audio_url text default null,
  p_document_url text default null, p_document_name text default null, p_image_url text default null,
  p_image_type text default null, p_document_size bigint default null)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_id      bigint;
  v_preview text;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));

  insert into mensajes (chat_id, sender_id, texto, reply_to_id, audio_url, document_url, document_name, document_size, image_url, image_type)
  values (p_chat_id, auth.uid(), trim(p_texto), p_reply_to_id, p_audio_url, p_document_url, p_document_name,
          case when p_document_url is not null and p_document_size > 0 then p_document_size end, p_image_url, p_image_type)
  returning id into v_id;

  v_preview :=
    case
      when p_audio_url    is not null and trim(p_texto) = '' then '🎤 Nota de voz'
      when p_document_url is not null and trim(p_texto) = '' then '📄 ' || coalesce(p_document_name, 'Documento')
      when p_image_url    is not null and trim(p_texto) = '' then
        case when p_image_type like 'video/%' then '🎥 Vídeo' else '📷 Foto' end
      else trim(p_texto)
    end;

  update chat set last_message = v_preview, last_message_at = now() where id = p_chat_id;

  return v_id;
end;
$$;
revoke all on function public.fn_mensaje_send(uuid, text, bigint, text, text, text, text, text, bigint) from public, anon;
grant execute on function public.fn_mensaje_send(uuid, text, bigint, text, text, text, text, text, bigint) to authenticated, service_role;
