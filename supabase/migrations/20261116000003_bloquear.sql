-- Bloquear a una persona (diseño: docs/superpowers/specs/2026-11-16-bloquear-design.md).
-- Paso de publicación 2.32. No se borra nada: ni chats, ni mensajes, ni amistades.
--
-- 1) Tabla bloqueos y funciones para bloquear, desbloquear y saber a quién he bloqueado yo.
--    Nunca se devuelve al cliente quién ME ha bloqueado.
-- 2) Mensajes 1 a 1 de quien te ha bloqueado: se guardan, pero quedan en mensaje_oculto para ti
--    (como «Eliminar para mí»), así que no salen en el chat, en tiempo real, en no leídos ni en tu
--    lista de chats. Quien ha bloqueado no puede escribir en ese 1 a 1. Las lecturas no pasan del
--    momento del bloqueo, así que al bloqueado nunca le sale «visto».
-- 3) Notificaciones (también invitaciones a planes), llamadas 1 a 1 y altas en grupos/planes del
--    bloqueado no te llegan.
-- 4) El bloqueado deja de ver tu foto (vacía en todas las listas) y no os salís en «Amigos con los
--    que hablar» ni en el buscador de amigos para empezar chat.

-- ───────────────────────── 1) Tabla y funciones básicas ─────────────────────────

create table if not exists public.bloqueos (
  bloqueador_id uuid not null references auth.users(id) on delete cascade,
  bloqueado_id  uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (bloqueador_id, bloqueado_id),
  constraint bloqueos_no_a_si_mismo check (bloqueador_id <> bloqueado_id)
);
create index if not exists bloqueos_bloqueado_idx on public.bloqueos (bloqueado_id);
alter table public.bloqueos enable row level security;
-- Sin políticas: solo se toca desde las funciones de abajo (security definer).
revoke all on table public.bloqueos from anon, authenticated;

-- ¿p_bloqueador ha bloqueado a p_bloqueado? Interna.
create or replace function public.fn_bloqueado_por(p_bloqueador uuid, p_bloqueado uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select exists (select 1 from bloqueos where bloqueador_id = p_bloqueador and bloqueado_id = p_bloqueado);
$$;
revoke all on function public.fn_bloqueado_por(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_bloqueado_por(uuid, uuid) to service_role;

-- La foto de p_owner tal como la ve quien pregunta: vacía si p_owner le ha bloqueado. Interna
-- (no se da a authenticated: sería una forma directa de preguntar «¿me ha bloqueado X?»).
create or replace function public.fn_foto_visible(p_owner uuid, p_url text)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select case when p_owner is not null and auth.uid() is not null
                   and public.fn_bloqueado_por(p_owner, auth.uid()) then null
              else p_url end;
$$;
revoke all on function public.fn_foto_visible(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_foto_visible(uuid, text) to service_role;

create or replace function public.fn_bloquear(p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'No puedes bloquearte a ti' using errcode = '22023';
  end if;
  insert into bloqueos (bloqueador_id, bloqueado_id) values (auth.uid(), p_user_id)
  on conflict do nothing;
end;
$$;
revoke all on function public.fn_bloquear(uuid) from public, anon;
grant execute on function public.fn_bloquear(uuid) to authenticated, service_role;

create or replace function public.fn_desbloquear(p_user_id uuid)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $$
  delete from bloqueos where bloqueador_id = auth.uid() and bloqueado_id = p_user_id;
$$;
revoke all on function public.fn_desbloquear(uuid) from public, anon;
grant execute on function public.fn_desbloquear(uuid) to authenticated, service_role;

-- Solo a quién he bloqueado YO.
create or replace function public.fn_mis_bloqueados()
 returns uuid[]
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select coalesce(array_agg(bloqueado_id), '{}') from bloqueos where bloqueador_id = auth.uid();
$$;
revoke all on function public.fn_mis_bloqueados() from public, anon;
grant execute on function public.fn_mis_bloqueados() to authenticated, service_role;

-- ─────────────────── 2) Mensajes, lista de chats y lecturas ───────────────────

-- Quien ha bloqueado no puede escribir en el 1 a 1 con esa persona (solo lo ve quien bloquea).
create or replace function public.fn_trigger_mensaje_bloqueo_antes()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if new.sender_id is not null
     and exists (select 1 from chat c where c.id = new.chat_id and c.tipo = 'DIRECTO')
     and exists (select 1 from chat_miembro cm
                   join bloqueos b on b.bloqueador_id = new.sender_id and b.bloqueado_id = cm.user_id
                  where cm.chat_id = new.chat_id and cm.user_id <> new.sender_id) then
    raise exception 'No puedes escribir en este chat' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.fn_trigger_mensaje_bloqueo_antes() from public, anon, authenticated;

drop trigger if exists trg_mensaje_bloqueo_antes on public.mensajes;
create trigger trg_mensaje_bloqueo_antes
  before insert on public.mensajes
  for each row execute function public.fn_trigger_mensaje_bloqueo_antes();

-- El mensaje del bloqueado se guarda (a él le sale enviado), pero queda oculto para quien bloqueó.
-- Con trigger y no en fn_mensaje_send: la política mensajes_insert también deja insertar directo.
create or replace function public.fn_trigger_mensaje_bloqueo_despues()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if new.sender_id is null then
    return null;
  end if;
  insert into mensaje_oculto (user_id, mensaje_id)
  select cm.user_id, new.id
    from chat c
    join chat_miembro cm on cm.chat_id = c.id and cm.user_id <> new.sender_id
    join bloqueos b on b.bloqueador_id = cm.user_id and b.bloqueado_id = new.sender_id
   where c.id = new.chat_id and c.tipo = 'DIRECTO'
  on conflict do nothing;
  return null;
end;
$$;
revoke all on function public.fn_trigger_mensaje_bloqueo_despues() from public, anon, authenticated;

drop trigger if exists trg_mensaje_bloqueo_despues on public.mensajes;
create trigger trg_mensaje_bloqueo_despues
  after insert on public.mensajes
  for each row execute function public.fn_trigger_mensaje_bloqueo_despues();

-- Tiempo real (postgres_changes) respeta esta política: lo oculto para mí tampoco me llega en vivo.
-- (Arregla también «Eliminar para mí», que hasta ahora se colaba en vivo.)
drop policy if exists mensajes_select on public.mensajes;
create policy mensajes_select on public.mensajes for select using (
  exists (select 1 from public.chat_miembro
           where chat_miembro.chat_id = mensajes.chat_id and chat_miembro.user_id = auth.uid())
  and not exists (select 1 from public.mensaje_oculto o
                   where o.user_id = auth.uid() and o.mensaje_id = mensajes.id)
);

-- Vista previa de un mensaje en la lista de chats (la misma que pone fn_mensaje_send).
create or replace function public.fn_mensaje_preview(
  p_texto text, p_audio_url text, p_document_url text, p_document_name text, p_image_url text, p_image_type text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $$
  select case
    when p_audio_url    is not null and trim(p_texto) = '' then '🎤 Nota de voz'
    when p_document_url is not null and trim(p_texto) = '' then '📄 ' || coalesce(p_document_name, 'Documento')
    when p_image_url    is not null and trim(p_texto) = '' then
      case when p_image_type like 'video/%' then '🎥 Vídeo' else '📷 Foto' end
    else trim(p_texto)
  end;
$$;
revoke all on function public.fn_mensaje_preview(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fn_mensaje_preview(text, text, text, text, text, text) to service_role;

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
  v_id bigint;
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));

  insert into mensajes (chat_id, sender_id, texto, reply_to_id, audio_url, document_url, document_name, document_size, image_url, image_type)
  values (p_chat_id, auth.uid(), trim(p_texto), p_reply_to_id, p_audio_url, p_document_url, p_document_name,
          case when p_document_url is not null and p_document_size > 0 then p_document_size end, p_image_url, p_image_type)
  returning id into v_id;

  update chat
     set last_message = public.fn_mensaje_preview(p_texto, p_audio_url, p_document_url, p_document_name, p_image_url, p_image_type),
         last_message_at = now()
   where id = p_chat_id;

  return v_id;
end;
$$;
revoke all on function public.fn_mensaje_send(uuid, text, bigint, text, text, text, text, text, bigint) from public, anon;
grant execute on function public.fn_mensaje_send(uuid, text, bigint, text, text, text, text, text, bigint) to authenticated, service_role;

-- Lista de chats: si lo último del chat está oculto para mí, la vista previa y la hora salen del
-- último mensaje que sí veo (así el chat no sube ni enseña el texto del bloqueado). Un 1 a 1 que
-- solo tiene mensajes ocultos para mí no sale, y un mensaje oculto no devuelve un chat eliminado.
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
    case
      when tapado.si then public.fn_mensaje_preview(uv.texto, uv.audio_url, uv.document_url, uv.document_name, uv.image_url, uv.image_type)
      when cm_me.vaciado_hasta is not null
           and not exists (select 1 from mensajes m where m.chat_id = c.id and m.id > cm_me.vaciado_hasta)
        then null
      else c.last_message::text
    end as last_message,
    case when tapado.si then coalesce(uv.created_at, c.created_at) else c.last_message_at end as last_message_at,
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
          'profile_image', public.fn_foto_visible(u.id, u.profile_image)
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
  -- Último mensaje que veo.
  left join lateral (
    select m.texto, m.audio_url, m.document_url, m.document_name, m.image_url, m.image_type, m.created_at, m.id
      from mensajes m
     where m.chat_id = c.id
       and m.id > coalesce(cm_me.vaciado_hasta, 0)
       and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = m.id)
     order by m.id desc
     limit 1
  ) uv on true
  -- ¿Hay algo oculto para mí más nuevo que lo último que veo?
  cross join lateral (
    select exists (
      select 1 from mensaje_oculto o
        join mensajes m on m.id = o.mensaje_id
       where o.user_id = auth.uid() and m.chat_id = c.id and m.id > coalesce(uv.id, 0)
    ) as si
  ) tapado
  where (c.tipo <> 'DIRECTO'
         or exists (select 1 from mensajes m where m.chat_id = c.id
                       and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = m.id)))
    and (cm_me.eliminado_at is null
         or exists (select 1 from mensajes m where m.chat_id = c.id and m.created_at > cm_me.eliminado_at
                       and not exists (select 1 from mensaje_oculto o where o.user_id = auth.uid() and o.mensaje_id = m.id)))
  -- A group created «sin escribir» has no message yet: it goes by when it was created, at the top.
  order by case when tapado.si then coalesce(uv.created_at, c.created_at) else coalesce(c.last_message_at, c.created_at) end desc;
$$;
revoke all on function public.fn_chats_list() from public, anon;
grant execute on function public.fn_chats_list() to authenticated, service_role;

-- Lecturas: para quien me ha bloqueado, su lectura no pasa del momento del bloqueo (nunca «visto»).
create or replace function public.fn_chat_lecturas(p_chat_id uuid)
 returns table(user_id uuid, last_read_at timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  return query
  select cm.user_id,
         case when b.created_at is null then cm.last_read_at else least(cm.last_read_at, b.created_at) end
    from chat_miembro cm
    left join bloqueos b on b.bloqueador_id = cm.user_id and b.bloqueado_id = auth.uid()
   where cm.chat_id = p_chat_id
     and cm.user_id <> auth.uid();
end;
$$;
revoke all on function public.fn_chat_lecturas(uuid) from public, anon;
grant execute on function public.fn_chat_lecturas(uuid) to authenticated, service_role;

-- ──────────── 3) Notificaciones, llamadas y altas en grupos o planes ────────────

-- No te llega nada generado por alguien a quien has bloqueado (tampoco invitaciones a planes,
-- que la app crea como plan_invite). BEFORE: la fila ni se crea, así que no hay push.
create or replace function public.fn_trigger_notificacion_bloqueo()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if new.actor_id is not null and public.fn_bloqueado_por(new.user_id, new.actor_id) then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function public.fn_trigger_notificacion_bloqueo() from public, anon, authenticated;

drop trigger if exists trg_notificacion_bloqueo on public.notificaciones;
create trigger trg_notificacion_bloqueo
  before insert on public.notificaciones
  for each row execute function public.fn_trigger_notificacion_bloqueo();

-- ¿Esta llamada 1 a 1 es de alguien a quien p_yo ha bloqueado? Entonces a p_yo no le suena (ni push
-- ni en la app); a quien llama le sigue sonando hasta que caduca como perdida.
create or replace function public.fn_llamada_tapada(p_chat_id uuid, p_iniciador uuid, p_yo uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select exists (select 1 from chat c where c.id = p_chat_id and c.tipo = 'DIRECTO')
     and public.fn_bloqueado_por(p_yo, p_iniciador);
$$;
revoke all on function public.fn_llamada_tapada(uuid, uuid, uuid) from public, anon;
grant execute on function public.fn_llamada_tapada(uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists "llamadas: select" on public.llamadas;
create policy "llamadas: select" on public.llamadas for select to authenticated using (
  public.is_chat_member(chat_id)
  and not public.fn_llamada_tapada(chat_id, iniciado_por_user_id, auth.uid())
);

create or replace function public.fn_trigger_call_push()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_url text;
  v_key text;
begin
  -- Only two moments matter: a new call ringing, and a ringing call that stopped.
  if tg_op = 'INSERT' and new.estado <> 'ringing' then
    return new;
  end if;
  if tg_op = 'UPDATE' and not (old.estado = 'ringing' and new.estado <> 'ringing') then
    return new;
  end if;
  -- 1 a 1 con quien ha bloqueado a quien llama: no se avisa a su móvil.
  if exists (select 1 from chat_miembro cm
              where cm.chat_id = new.chat_id and cm.user_id <> new.iniciado_por_user_id
                and public.fn_llamada_tapada(new.chat_id, new.iniciado_por_user_id, cm.user_id)) then
    return new;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_supabase_url' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'app_service_role_key' limit 1;
  if v_url is null or v_key is null then
    raise warning '[call-push] vault secrets not configured';
    return new;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := jsonb_build_object('type', tg_op, 'table', 'llamadas', 'record', to_jsonb(new))
  );
  return new;
end;
$function$;
revoke all on function public.fn_trigger_call_push() from public, anon, authenticated;

-- Crear un grupo: quien te ha bloqueado se queda fuera sin decir nada (si quedan menos de 2,
-- salta el aviso de siempre).
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
  where m is not null and m <> v_uid
    and not public.fn_bloqueado_por(m, v_uid);

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

-- Añadir a alguien que te ha bloqueado: falla sin decir por qué.
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
  if public.fn_bloqueado_por(p_user_id, auth.uid()) then
    raise exception 'No se ha podido añadir a esta persona' using errcode = '22023';
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
revoke all on function public.fn_chat_add_miembro(uuid, uuid) from public, anon;
grant execute on function public.fn_chat_add_miembro(uuid, uuid) to authenticated, service_role;

-- Plan desde un chat: igual que 20261115000004, pero quien te ha bloqueado no entra en el plan
-- (sus mensajes se copian igual, como los de cualquiera que se queda fuera).
create or replace function public.fn_plan_desde_chat(
  p_client_id uuid,
  p_chat_id uuid,
  p_titulo text,
  p_inicio_at timestamptz,
  p_fin_at timestamptz,
  p_ubicacion text,
  p_miembros uuid[],
  p_desde_id bigint default null,
  p_copiar boolean default true,
  -- The message whose diamond opened «Crear plan» (null from the header): it loses its diamond.
  p_origen_id bigint default null
) returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  c_tope constant int := 5000;
  v_me uuid := auth.uid();
  v_inserted boolean;
  v_prev jsonb;
  v_chat chat%rowtype;
  v_origen_nombre text;
  v_miembros uuid[];
  v_total int;
  v_primero_at timestamptz;
  v_plan public.plan;
  v_plan_chat uuid;
  v_leido uuid[];
  v_creador text;
  v_hito jsonb;
  v_r record;
  v_j jsonb;
  v_texto text;
  v_new bigint;
  v_hito_id bigint;
  v_copiados int := 0;
  v_result jsonb;
begin
  perform public.assert_allowed(v_me is not null and public.is_chat_member(p_chat_id));

  select * into v_chat from chat where id = p_chat_id;
  if v_chat.plan_id is not null or v_chat.tipo not in ('GRUPO', 'DIRECTO') then
    raise exception 'Este chat ya es el de un plan' using errcode = '22023';
  end if;

  -- Reclamar la petición (doble toque o reintento: devuelve el primer resultado).
  insert into chat_acciones (client_id, user_id, accion) values (p_client_id, v_me, 'plan_desde_chat')
  on conflict (client_id) do nothing;
  get diagnostics v_inserted = row_count;
  if not v_inserted then
    select resultado into v_prev from chat_acciones where client_id = p_client_id and user_id = v_me;
    if v_prev is not null then return v_prev; end if;
    raise exception 'Petición repetida' using errcode = '22023';
  end if;

  -- Solo miembros del chat; tú siempre entras.
  select coalesce(array_agg(distinct cm.user_id), '{}') into v_miembros
    from chat_miembro cm
   where cm.chat_id = p_chat_id
     and cm.user_id <> v_me
     and cm.user_id = any(coalesce(p_miembros, '{}'))
     and not public.fn_bloqueado_por(cm.user_id, v_me);

  if coalesce(p_copiar, true) then
    select count(*), min(created_at) into v_total, v_primero_at
      from mensajes
     where chat_id = p_chat_id and (p_desde_id is null or id >= p_desde_id);
  else
    v_total := 0;
  end if;
  if v_total > c_tope then
    raise exception 'Demasiados mensajes para copiar (% de %)', v_total, c_tope using errcode = '22023';
  end if;

  -- Nombre del chat de origen: el del grupo, o el de la otra persona en un 1 a 1.
  v_origen_nombre := v_chat.nombre;
  if v_origen_nombre is null then
    select u.nombre into v_origen_nombre
      from chat_miembro cm join usuarios u on u.id = cm.user_id
     where cm.chat_id = p_chat_id and cm.user_id <> v_me
     limit 1;
  end if;
  v_origen_nombre := coalesce(v_origen_nombre, 'el chat');

  -- El plan (fn_plan_create valida título, fechas y que lo creas tú; el trigger te hace admin).
  v_plan := public.fn_plan_create(
    p_titulo,
    'Creado desde el chat «' || v_origen_nombre || '»',
    p_inicio_at, p_fin_at,
    coalesce(nullif(btrim(coalesce(p_ubicacion, '')), ''), 'Por decidir'),
    v_me, v_me);

  insert into plan_usuarios (plan_id, user_id, rol, estado)
  select v_plan.id, u, 'PARTICIPANTE', 'PARTICIPA' from unnest(v_miembros) as u
  on conflict (plan_id, user_id) do nothing;

  v_plan_chat := public.fn_plan_create_chat(v_plan.id);
  v_leido := array_append(v_miembros, v_me);

  -- Separador «Antes del plan»: justo antes del primer mensaje copiado (id y fecha).
  if v_total > 0 then
    insert into mensajes (chat_id, sender_id, texto, created_at, leido_por)
    values (v_plan_chat, null, jsonb_build_object(
      'type', 'copia_chat',
      'origen_chat_id', p_chat_id,
      'origen_nombre', v_origen_nombre,
      'copiados', v_total,
      'copiado_at', now()
    )::text, v_primero_at - interval '1 millisecond', v_leido);
  end if;

  -- La copia, en orden: así cada respuesta citada ya tiene la copia del mensaje al que apunta.
  create temp table if not exists _copia_map (viejo bigint primary key, nuevo bigint not null) on commit drop;
  truncate _copia_map;  -- (a DELETE without WHERE is refused by safeupdate)

  for v_r in
    select * from mensajes
     where v_total > 0
       and chat_id = p_chat_id and (p_desde_id is null or id >= p_desde_id)
     order by id
  loop
    v_texto := v_r.texto;
    if left(v_texto, 1) = '{' then
      v_j := public.try_jsonb(v_texto);
      if v_j->>'type' = 'poll' then
        v_texto := (v_j || jsonb_build_object('closed', true, 'copiada_at', now()))::text;
      elsif v_j->>'type' = 'propuesta' and v_j->>'estado' = 'pendiente' then
        v_texto := (v_j || jsonb_build_object('estado', 'descartada', 'copia', true))::text;
      end if;
    end if;

    insert into mensajes (chat_id, sender_id, texto, created_at, leido_por, reply_to_id,
                          audio_url, document_url, document_name, image_url, image_type, tipo)
    values (v_plan_chat, v_r.sender_id, v_texto, v_r.created_at, v_leido,
            (select nuevo from _copia_map where viejo = v_r.reply_to_id),
            v_r.audio_url, v_r.document_url, v_r.document_name, v_r.image_url, v_r.image_type, v_r.tipo)
    returning id into v_new;

    insert into _copia_map values (v_r.id, v_new);
    v_copiados := v_copiados + 1;
  end loop;

  -- Votos de las encuestas copiadas (cerradas: nadie puede cambiarlos).
  insert into poll_votes (mensaje_id, user_id, option_index, created_at)
  select m.nuevo, pv.user_id, pv.option_index, pv.created_at
    from poll_votes pv join _copia_map m on m.viejo = pv.mensaje_id;

  -- Hito «Plan creado» en los dos chats.
  select split_part(coalesce(nombre, ''), ' ', 1) into v_creador from usuarios where id = v_me;
  v_hito := jsonb_build_object(
    'type', 'plan_creado',
    'plan_id', v_plan.id,
    'titulo', v_plan.titulo,
    'inicio_at', v_plan.inicio_at,
    'fin_at', v_plan.fin_at,
    'creador_id', v_me,
    'creador_nombre', v_creador,
    'miembros', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nombre', split_part(coalesce(u.nombre, ''), ' ', 1)) order by u.nombre), '[]'::jsonb)
                   from usuarios u where u.id = any(v_leido)),
    'copiados', v_copiados,
    'origen_chat_id', p_chat_id,
    'origen_nombre', v_origen_nombre,
    'origen_mensaje_id', (select id from mensajes where id = p_origen_id and chat_id = p_chat_id)
  );
  insert into mensajes (chat_id, sender_id, texto, leido_por) values (p_chat_id, v_me, v_hito::text, array[v_me])
  returning id into v_hito_id;
  -- Just before @frimee's welcome (made with the plan's chat): the mark closes the copied part.
  insert into mensajes (chat_id, sender_id, texto, created_at, leido_por)
  values (v_plan_chat, v_me, v_hito::text, now() - interval '1 millisecond', v_leido);

  update chat set last_message = 'Plan creado · ' || v_plan.titulo, last_message_at = now()
   where id in (p_chat_id, v_plan_chat);

  -- Todo lo copiado llega leído.
  update chat_miembro set last_read_at = now() where chat_id = v_plan_chat;

  -- «Ana te ha añadido a Finde en Cercedilla».
  insert into notificaciones (user_id, tipo, actor_id, entity_id, entity_type)
  select u, 'plan_added', v_me,
         jsonb_build_object('plan_id', v_plan.id::text, 'destino', v_plan.titulo)::text, 'plan_chat'
    from unnest(v_miembros) as u;

  -- The app sends the original chat's mark to whoever has it open (the chat's realtime is a broadcast).
  v_result := jsonb_build_object('plan_id', v_plan.id, 'chat_id', v_plan_chat, 'copiados', v_copiados,
                                 'hito_id', v_hito_id, 'hito_texto', v_hito::text, 'miembros', to_jsonb(v_miembros));
  update chat_acciones set resultado = v_result where client_id = p_client_id;
  return v_result;
end;
$$;
revoke all on function public.fn_plan_desde_chat(uuid, uuid, text, timestamptz, timestamptz, text, uuid[], bigint, boolean, bigint) from public, anon;
grant execute on function public.fn_plan_desde_chat(uuid, uuid, text, timestamptz, timestamptz, text, uuid[], bigint, boolean, bigint) to authenticated, service_role;

-- ───────────────────── 4) Foto de perfil y listas de amigos ─────────────────────

-- (fn_foto_visible está en la sección 1: fn_chats_list ya la usa.)

-- La vista pública de usuarios (la usan gastos, miembros del plan, álbum, llamadas y la cartera).
create or replace view public.usuarios_public as
 select id,
    nombre,
    public.fn_foto_visible(id, profile_image) as profile_image,
    deleted_at,
    username
   from public.usuarios;

-- Funciones que leen la foto de usuarios directamente: igual que su última versión, con la foto
-- pasada por fn_foto_visible.

-- fn_mensajes_list (de 20261115000007_chat_info.sql)
create or replace function public.fn_mensajes_list(p_chat_id uuid, p_limit integer default 30, p_cursor_id bigint default null::bigint)
 returns table(id bigint, sender_id uuid, sender_nombre text, sender_profile_image text, texto text, created_at timestamp with time zone, reply_to_id bigint, reply_texto text, reply_sender_nombre text, audio_url text, document_url text, document_name text, image_url text, image_type text, tipo text)
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select public.assert_allowed(public.is_chat_member(p_chat_id));
  select
    m.id, m.sender_id, coalesce(u.nombre, 'Frimee'), public.fn_foto_visible(u.id, u.profile_image), m.texto, m.created_at,
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

-- fn_mensajes_tramo (de 20261115000007_chat_info.sql)
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
  select m.id, m.sender_id, coalesce(u.nombre, 'Frimee')::text, public.fn_foto_visible(u.id, u.profile_image)::text, m.texto, m.created_at,
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

-- fn_mensajes_list_despues (de 20261115000007_chat_info.sql)
create or replace function public.fn_mensajes_list_despues(p_chat_id uuid, p_cursor_id bigint, p_limit integer default 50)
 returns table(id bigint, sender_id uuid, sender_nombre text, sender_profile_image text, texto text, created_at timestamp with time zone, reply_to_id bigint, reply_texto text, reply_sender_nombre text, audio_url text, document_url text, document_name text, image_url text, image_type text, tipo text)
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select public.assert_allowed(public.is_chat_member(p_chat_id));
  select m.id, m.sender_id, coalesce(u.nombre, 'Frimee')::text, public.fn_foto_visible(u.id, u.profile_image)::text, m.texto, m.created_at,
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

-- fn_chat_get_miembros (de 20261026000000_baseline.sql)
CREATE OR REPLACE FUNCTION public.fn_chat_get_miembros(p_chat_id uuid) RETURNS TABLE(id uuid, nombre text, username text, profile_image text, joined_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT u.id, u.nombre, u.username, public.fn_foto_visible(u.id, u.profile_image), cm.joined_at
  FROM chat_miembro cm
  JOIN usuarios u ON u.id = cm.user_id AND u.deleted_at IS NULL
  WHERE cm.chat_id = p_chat_id
    AND EXISTS (
      SELECT 1 FROM chat_miembro
      WHERE chat_id = p_chat_id AND user_id = auth.uid()
    );
$$;

-- fn_user_profile_get_public (de 20261026000000_baseline.sql)
CREATE OR REPLACE FUNCTION public.fn_user_profile_get_public(p_user_id uuid) RETURNS TABLE(id uuid, nombre text, username text, profile_image text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nombre::text, u.username::text, public.fn_foto_visible(u.id, u.profile_image)::text
  FROM usuarios_public u WHERE u.id = p_user_id;
END;
$$;

-- fn_users_search_public (de 20261026000000_baseline.sql)
CREATE OR REPLACE FUNCTION public.fn_users_search_public(p_query text, p_limit integer DEFAULT 8, p_exclude_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, nombre text, username text, profile_image text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    u.id,
    u.nombre,
    u.username,
    public.fn_foto_visible(u.id, u.profile_image)
  FROM usuarios u
  WHERE u.deleted_at IS NULL
    AND (p_exclude_user_id IS NULL OR u.id <> p_exclude_user_id)
    AND (
      u.nombre   ILIKE '%' || p_query || '%'
      OR u.username ILIKE '%' || p_query || '%'
    )
  ORDER BY
    CASE WHEN u.username ILIKE p_query || '%' THEN 0
         WHEN u.nombre   ILIKE p_query || '%' THEN 1
         ELSE 2
    END,
    u.nombre
  LIMIT p_limit;
$$;

-- fn_notificaciones_list (de 20261026000000_baseline.sql)
CREATE OR REPLACE FUNCTION public.fn_notificaciones_list(p_limit integer DEFAULT 30, p_cursor bigint DEFAULT NULL::bigint) RETURNS TABLE(id bigint, tipo text, actor_id uuid, actor_nombre text, actor_username text, actor_foto text, entity_id text, entity_type text, leida boolean, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    n.id,
    n.tipo,
    n.actor_id,
    u.nombre       AS actor_nombre,
    u.username     AS actor_username,
    public.fn_foto_visible(u.id, u.profile_image) AS actor_foto,
    n.entity_id,
    n.entity_type,
    n.leida,
    n.created_at
  FROM notificaciones n
  LEFT JOIN usuarios u ON u.id = n.actor_id
  WHERE n.user_id = auth.uid()
    AND (p_cursor IS NULL OR n.id < p_cursor)
  ORDER BY n.created_at DESC
  LIMIT p_limit;
$$;

-- fn_liquidaciones_list_for_user (de 20261026000000_baseline.sql)
CREATE OR REPLACE FUNCTION public.fn_liquidaciones_list_for_user() RETURNS TABLE(id bigint, plan_id bigint, plan_titulo text, from_user_id uuid, to_user_id uuid, importe numeric, fecha timestamp with time zone, nota text, estado text, counterparty_id uuid, counterparty_nombre text, counterparty_username text, counterparty_profile_image text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.plan_id, p.titulo::text,
    l.from_user_id, l.to_user_id, l.importe,
    l.fecha, l.nota::text, l.estado::text,
    CASE WHEN l.from_user_id = v_uid THEN l.to_user_id ELSE l.from_user_id END,
    u.nombre::text, u.username::text, public.fn_foto_visible(u.id, u.profile_image)::text
  FROM liquidaciones l
  LEFT JOIN plan p ON p.id = l.plan_id
  LEFT JOIN usuarios u ON u.id = CASE WHEN l.from_user_id = v_uid THEN l.to_user_id ELSE l.from_user_id END
  WHERE (l.from_user_id = v_uid OR l.to_user_id = v_uid)
    AND l.estado IN ('PENDIENTE','EN_REVISION','CONFIRMADA')
  ORDER BY l.fecha DESC;
END;
$$;

-- fn_plans_get_for_user (de 20261108000001_lock_definer_functions.sql)
CREATE OR REPLACE FUNCTION public.fn_plans_get_for_user(p_user_id uuid, p_limit integer DEFAULT 300)
 RETURNS TABLE(id bigint, created_at timestamp with time zone, titulo text, descripcion text, visibilidad text, inicio_at timestamp with time zone, fin_at timestamp with time zone, all_day boolean, ubicacion_nombre text, foto_portada text, owner_user_id uuid, creado_por_user_id uuid, creador_nombre text, creador_profile_image text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id, p.created_at,
    p.titulo::text, p.descripcion::text, p.visibilidad::text,
    p.inicio_at, p.fin_at, p.all_day,
    p.ubicacion_nombre::text, p.foto_portada::text,
    p.owner_user_id, p.creado_por_user_id,
    u.nombre::text AS creador_nombre, public.fn_foto_visible(u.id, u.profile_image)::text AS creador_profile_image
  FROM plan p
  LEFT JOIN usuarios u ON u.id = p.creado_por_user_id
  WHERE p.deleted_at IS NULL
    AND p.estado = 'ACTIVO'
    AND (p_user_id = auth.uid() OR p.visibilidad = 'PÚBLICO' OR public.is_plan_member(p.id))
    AND (
      p.creado_por_user_id = p_user_id
      OR p.owner_user_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM plan_usuarios pu
        WHERE pu.plan_id = p.id
          AND pu.user_id = p_user_id
          AND pu.estado = 'PARTICIPA'
      )
    )
  ORDER BY p.inicio_at ASC LIMIT p_limit;
END; $function$;

-- fn_plans_get_by_ids (de 20261108000001_lock_definer_functions.sql)
CREATE OR REPLACE FUNCTION public.fn_plans_get_by_ids(p_plan_ids bigint[])
 RETURNS TABLE(id bigint, created_at timestamp with time zone, titulo text, descripcion text, visibilidad text, inicio_at timestamp with time zone, fin_at timestamp with time zone, all_day boolean, ubicacion_nombre text, foto_portada text, owner_user_id uuid, creado_por_user_id uuid, creador_nombre text, creador_profile_image text, join_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.created_at,
    p.titulo::text, p.descripcion::text, p.visibilidad::text,
    p.inicio_at, p.fin_at, p.all_day,
    p.ubicacion_nombre::text, p.foto_portada::text,
    p.owner_user_id, p.creado_por_user_id,
    u.nombre::text AS creador_nombre, public.fn_foto_visible(u.id, u.profile_image)::text AS creador_profile_image,
    CASE WHEN public.is_plan_member(p.id) THEN p.join_code::text END
  FROM plan p LEFT JOIN usuarios u ON u.id = p.creado_por_user_id
  WHERE p.id = ANY(p_plan_ids) AND p.deleted_at IS NULL AND p.estado = 'ACTIVO'
    AND (p.visibilidad <> 'SOLO_GRUPO' OR public.is_plan_member(p.id));
END;
$function$;

-- fn_friends_list_active (de 20261026000000_baseline.sql): sin bloqueos en ningún sentido
CREATE OR REPLACE FUNCTION public.fn_friends_list_active() RETURNS TABLE(id uuid, nombre text, username text, profile_image text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN a.user_id_1 = v_uid THEN a.user_id_2 ELSE a.user_id_1 END AS id,
    u.nombre::text,
    u.username::text,
    public.fn_foto_visible(u.id, u.profile_image)::text
  FROM amistades a
  JOIN usuarios u ON u.id = CASE WHEN a.user_id_1 = v_uid THEN a.user_id_2 ELSE a.user_id_1 END
  WHERE (a.user_id_1 = v_uid OR a.user_id_2 = v_uid)
    AND a.estado = 'ACTIVA'
    AND NOT EXISTS (SELECT 1 FROM bloqueos b
                     WHERE (b.bloqueador_id = v_uid AND b.bloqueado_id = u.id)
                        OR (b.bloqueador_id = u.id AND b.bloqueado_id = v_uid))
  ORDER BY u.nombre ASC;
END;
$$;

-- fn_chat_amigos_sugeridos (de 20261115000006_chat_nuevo_y_grupos.sql): sin bloqueos en ningún sentido
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
  select u.id, u.nombre::text, u.username::text, public.fn_foto_visible(u.id, u.profile_image)::text, coalesce(j.n, 0)
  from amigos f
  join usuarios u on u.id = f.id and u.deleted_at is null
  left join juntos j on j.id = f.id
  where auth.uid() is not null and f.id not in (select id from con_chat)
    and not exists (select 1 from bloqueos b
                     where (b.bloqueador_id = auth.uid() and b.bloqueado_id = f.id)
                        or (b.bloqueador_id = f.id and b.bloqueado_id = auth.uid()))
  order by coalesce(j.n, 0) desc, j.ultima desc nulls last, f.created_at desc, u.nombre
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;
