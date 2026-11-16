-- Invitar al plan (tableros inv-*), con la seguridad revisada.
--
-- 1. plan_invitaciones: las invitaciones dejan de ser solo un aviso. Guardan quién invitó y
--    su estado, para que «Enviada» pase a «En el plan» en directo (Realtime) y se puedan
--    cancelar. Las invitaciones pendientes que había (avisos 'plan_invite') se copian.
-- 2. Aceptar una invitación exige tenerla (antes cualquiera se unía a cualquier plan
--    llamando a fn_accept_plan_invite con su id).
-- 3. Solo los admins de un plan activo invitan, y solo a amigos o a gente de sus grupos,
--    nunca a quien te ha bloqueado o has bloqueado.
-- 4. Código corto por plan (8 caracteres sin 0/O/1/I/L, «7Q4K-XM9P»): el enlace y el QR lo
--    usan. El UUID largo de siempre sigue valiendo para los enlaces ya compartidos.
-- 5. Límite de intentos: 10 códigos que no existen por persona y hora; después se rechaza
--    durante esa hora, para que no se puedan probar códigos a ciegas.
-- 6. RLS: nadie puede darse de alta en un plan insertando en plan_usuarios (antes podía),
--    ni crear desde la app avisos de plan (invitaciones falsas).
--
-- Paso 2.36 de VERIFICACION_PUBLICACION.md.

-- ───────────────────────── 1. Tabla de invitaciones ─────────────────────────

create table if not exists public.plan_invitaciones (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.plan(id) on delete cascade,
  invitado_id uuid not null references public.usuarios(id) on delete cascade,
  invitado_por uuid references public.usuarios(id) on delete set null,
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'CANCELADA')),
  created_at timestamptz not null default now(),
  respondida_at timestamptz
);

-- Una sola pendiente por persona y plan.
create unique index if not exists plan_invitaciones_pendiente_uq
  on public.plan_invitaciones (plan_id, invitado_id) where estado = 'PENDIENTE';
create index if not exists plan_invitaciones_invitado_idx
  on public.plan_invitaciones (invitado_id) where estado = 'PENDIENTE';

alter table public.plan_invitaciones enable row level security;
alter table public.plan_invitaciones replica identity full;
revoke all on table public.plan_invitaciones from public, anon, authenticated;
grant select on table public.plan_invitaciones to authenticated;
grant all on table public.plan_invitaciones to service_role;

-- Leen: la persona invitada y quien participa en el plan. Escribir, solo las funciones.
drop policy if exists plan_invitaciones_select on public.plan_invitaciones;
create policy plan_invitaciones_select on public.plan_invitaciones
  for select to authenticated
  using (invitado_id = auth.uid() or public.is_plan_participant(plan_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_invitaciones'
  ) then
    alter publication supabase_realtime add table public.plan_invitaciones;
  end if;
end;
$$;

-- Las pendientes de antes (solo existían como aviso).
insert into public.plan_invitaciones (plan_id, invitado_id, invitado_por, created_at)
select distinct on (p.id, n.user_id) p.id, n.user_id, n.actor_id, n.created_at
  from public.notificaciones n
  join public.plan p on p.id::text = n.entity_id and p.deleted_at is null
 where n.tipo = 'plan_invite'
   and not exists (select 1 from public.plan_usuarios pu where pu.plan_id = p.id and pu.user_id = n.user_id)
 order by p.id, n.user_id, n.created_at desc
on conflict do nothing;

-- ───────────────────────── 2. Código corto por plan ─────────────────────────

-- 8 caracteres de 31 (sin 0, O, 1, I, L): 31^8 ≈ 852 000 millones de códigos.
-- Azar de gen_random_uuid() (criptográfico); se descartan los bytes ≥ 248 para no sesgar.
create or replace function public.fn_plan_codigo_nuevo()
 returns text
 language plpgsql
 volatile
 set search_path to 'public'
as $$
declare
  v_abc constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codigo text;
  v_bytes bytea;
  v_b int;
  i int;
begin
  loop
    v_codigo := '';
    while char_length(v_codigo) < 8 loop
      v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
      for i in 0 .. length(v_bytes) - 1 loop
        v_b := get_byte(v_bytes, i);
        if v_b < 248 and char_length(v_codigo) < 8 then
          v_codigo := v_codigo || substr(v_abc, (v_b % 31) + 1, 1);
        end if;
      end loop;
    end loop;
    exit when not exists (select 1 from plan where codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;
revoke all on function public.fn_plan_codigo_nuevo() from public, anon, authenticated;

alter table public.plan add column if not exists codigo text;

create or replace function public.trg_plan_codigo()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $$
begin
  if new.codigo is null then
    new.codigo := public.fn_plan_codigo_nuevo();
  end if;
  return new;
end;
$$;
revoke all on function public.trg_plan_codigo() from public, anon, authenticated;

drop trigger if exists trg_plan_codigo on public.plan;
create trigger trg_plan_codigo before insert on public.plan
  for each row execute function public.trg_plan_codigo();

-- Nadie lo cambia desde la app (el creador puede editar su plan, pero no ponerse un código
-- fácil de adivinar). Solo las migraciones o el servidor, sin sesión de usuario.
create or replace function public.trg_plan_codigo_fijo()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $$
begin
  if new.codigo is distinct from old.codigo and auth.uid() is not null then
    new.codigo := old.codigo;
  end if;
  return new;
end;
$$;
revoke all on function public.trg_plan_codigo_fijo() from public, anon, authenticated;

drop trigger if exists trg_plan_codigo_fijo on public.plan;
create trigger trg_plan_codigo_fijo before update of codigo on public.plan
  for each row execute function public.trg_plan_codigo_fijo();

do $$
declare r record;
begin
  for r in select id from public.plan where codigo is null loop
    update public.plan set codigo = public.fn_plan_codigo_nuevo() where id = r.id;
  end loop;
end;
$$;

alter table public.plan alter column codigo set not null;
create unique index if not exists plan_codigo_uq on public.plan (codigo);

-- Lo que escribe la persona («7q4k-xm9p», «frimee.es/join/7Q4KXM9P»…) → «7Q4KXM9P».
create or replace function public.fn_plan_codigo_normalizar(p_texto text)
 returns text
 language sql
 immutable
as $$
  select upper(regexp_replace(coalesce(p_texto, ''), '[^A-Za-z0-9]', '', 'g'));
$$;
revoke all on function public.fn_plan_codigo_normalizar(text) from public, anon, authenticated;

-- ───────────────────────── 3. Límite de intentos ─────────────────────────

create table if not exists public.plan_codigo_intentos (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists plan_codigo_intentos_idx on public.plan_codigo_intentos (user_id, at);
alter table public.plan_codigo_intentos enable row level security;
revoke all on table public.plan_codigo_intentos from public, anon, authenticated;

-- El plan de un código (corto o UUID antiguo), o null. Cuenta los fallos y corta a los 10/hora.
create or replace function public.fn_plan_por_codigo(p_codigo text)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_texto text := btrim(coalesce(p_codigo, ''));
  v_corto text := public.fn_plan_codigo_normalizar(p_codigo);
  v_plan bigint;
begin
  perform public.assert_allowed(v_me is not null);
  if (select count(*) from plan_codigo_intentos where user_id = v_me and at > now() - interval '1 hour') >= 10 then
    raise exception 'demasiados_intentos' using errcode = 'P0001';
  end if;

  if char_length(v_corto) = 8 then
    select id into v_plan from plan where codigo = v_corto and deleted_at is null and estado = 'ACTIVO';
  elsif char_length(v_texto) between 32 and 40 then
    select id into v_plan from plan where join_code = lower(v_texto) and deleted_at is null and estado = 'ACTIVO';
  end if;

  if v_plan is null then
    delete from plan_codigo_intentos where user_id = v_me and at < now() - interval '1 day';
    insert into plan_codigo_intentos (user_id) values (v_me);
  end if;
  return v_plan;
end;
$$;
revoke all on function public.fn_plan_por_codigo(text) from public, anon, authenticated;

-- ───────────────────────── 4. Quién puede invitar a quién ─────────────────────────

create or replace function public.fn_plan_es_admin(p_plan_id bigint, p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select exists (
    select 1 from plan_usuarios
     where plan_id = p_plan_id and user_id = p_user and rol = 'ADMIN' and estado = 'PARTICIPA'
  );
$$;
revoke all on function public.fn_plan_es_admin(bigint, uuid) from public, anon, authenticated;

-- Amigos, o gente con la que compartes un grupo; nunca con un bloqueo de por medio.
create or replace function public.fn_puede_invitar_a(p_yo uuid, p_otro uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select p_otro is not null and p_otro <> p_yo
     and exists (select 1 from usuarios u where u.id = p_otro and u.deleted_at is null)
     and not public.fn_bloqueado_por(p_yo, p_otro)
     and not public.fn_bloqueado_por(p_otro, p_yo)
     and (
       public.fn_son_amigos(p_yo, p_otro)
       or exists (
         select 1 from chat c
           join chat_miembro a on a.chat_id = c.id and a.user_id = p_yo
           join chat_miembro b on b.chat_id = c.id and b.user_id = p_otro
          where c.tipo = 'GRUPO'
       )
     );
$$;
revoke all on function public.fn_puede_invitar_a(uuid, uuid) from public, anon, authenticated;

-- Núcleo: crea las invitaciones y sus avisos. Devuelve a quién se ha invitado de verdad.
create or replace function public.fn_plan_invitar_core(p_plan_id bigint, p_yo uuid, p_users uuid[])
 returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_nuevos uuid[];
begin
  perform public.assert_allowed(
    p_yo is not null
    and public.fn_plan_es_admin(p_plan_id, p_yo)
    and exists (select 1 from plan where id = p_plan_id and deleted_at is null and estado = 'ACTIVO' and fin_at >= now())
  );
  if cardinality(coalesce(p_users, '{}')) > 100 then
    raise exception 'Demasiadas personas a la vez' using errcode = '22023';
  end if;

  with candidatos as (
    select distinct u as id from unnest(coalesce(p_users, '{}')) as u
  ), validos as (
    select c.id from candidatos c
     where public.fn_puede_invitar_a(p_yo, c.id)
       and not exists (select 1 from plan_usuarios pu where pu.plan_id = p_plan_id and pu.user_id = c.id and pu.estado = 'PARTICIPA')
  ), creadas as (
    insert into plan_invitaciones (plan_id, invitado_id, invitado_por)
    select p_plan_id, v.id, p_yo from validos v
    on conflict (plan_id, invitado_id) where estado = 'PENDIENTE' do nothing
    returning invitado_id
  )
  select coalesce(array_agg(invitado_id), '{}') into v_nuevos from creadas;

  insert into notificaciones (user_id, tipo, actor_id, entity_id, entity_type)
  select u, 'plan_invite', p_yo, p_plan_id::text, 'plan' from unnest(v_nuevos) as u;

  return v_nuevos;
end;
$$;
revoke all on function public.fn_plan_invitar_core(bigint, uuid, uuid[]) from public, anon, authenticated;

-- ───────────────────────── 5. Funciones para la app ─────────────────────────

create or replace function public.fn_plan_invitar(p_plan_id bigint, p_users uuid[])
 returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  return public.fn_plan_invitar_core(p_plan_id, auth.uid(), p_users);
end;
$$;
revoke all on function public.fn_plan_invitar(bigint, uuid[]) from public, anon;
grant execute on function public.fn_plan_invitar(bigint, uuid[]) to authenticated;

-- Un grupo: solo a quien falte. Hay que ser del grupo.
create or replace function public.fn_plan_invitar_grupo(p_plan_id bigint, p_chat_id uuid)
 returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_users uuid[];
begin
  perform public.assert_allowed(v_me is not null and exists (
    select 1 from chat c join chat_miembro cm on cm.chat_id = c.id and cm.user_id = v_me
     where c.id = p_chat_id and c.tipo = 'GRUPO'));
  select coalesce(array_agg(cm.user_id), '{}') into v_users
    from chat_miembro cm where cm.chat_id = p_chat_id and cm.user_id <> v_me;
  return public.fn_plan_invitar_core(p_plan_id, v_me, v_users);
end;
$$;
revoke all on function public.fn_plan_invitar_grupo(bigint, uuid) from public, anon;
grant execute on function public.fn_plan_invitar_grupo(bigint, uuid) to authenticated;

create or replace function public.fn_plan_cancelar_invitacion(p_plan_id bigint, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
begin
  perform public.assert_allowed(v_me is not null and public.fn_plan_es_admin(p_plan_id, v_me));
  update plan_invitaciones set estado = 'CANCELADA', respondida_at = now()
   where plan_id = p_plan_id and invitado_id = p_user_id and estado = 'PENDIENTE';
  if not found then
    return false;
  end if;
  delete from notificaciones
   where user_id = p_user_id and tipo = 'plan_invite' and entity_id = p_plan_id::text;
  return true;
end;
$$;
revoke all on function public.fn_plan_cancelar_invitacion(bigint, uuid) from public, anon;
grant execute on function public.fn_plan_cancelar_invitacion(bigint, uuid) to authenticated;

-- Aceptar: solo con una invitación pendiente.
create or replace function public.fn_accept_plan_invite(p_plan_id bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
begin
  perform public.assert_allowed(v_me is not null);
  update plan_invitaciones set estado = 'ACEPTADA', respondida_at = now()
   where plan_id = p_plan_id and invitado_id = v_me and estado = 'PENDIENTE';
  if not found then
    raise exception 'Esta invitación ya no está disponible' using errcode = 'P0002';
  end if;
  if not exists (select 1 from plan where id = p_plan_id and deleted_at is null and estado = 'ACTIVO') then
    raise exception 'Este plan ya no existe' using errcode = 'P0002';
  end if;

  insert into plan_usuarios (plan_id, user_id, rol, estado)
  values (p_plan_id, v_me, 'PARTICIPANTE', 'PARTICIPA')
  on conflict (plan_id, user_id) do update set estado = 'PARTICIPA', updated_at = now();
  -- Lo que ya hay en el chat del plan cuenta como leído.
  update chat_miembro set last_read_at = now()
   where user_id = v_me and chat_id = (select id from chat where plan_id = p_plan_id);
  delete from notificaciones where user_id = v_me and tipo = 'plan_invite' and entity_id = p_plan_id::text;
end;
$$;
revoke all on function public.fn_accept_plan_invite(bigint) from public, anon;
grant execute on function public.fn_accept_plan_invite(bigint) to authenticated;

create or replace function public.fn_rechazar_plan_invite(p_plan_id bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
begin
  perform public.assert_allowed(v_me is not null);
  update plan_invitaciones set estado = 'RECHAZADA', respondida_at = now()
   where plan_id = p_plan_id and invitado_id = v_me and estado = 'PENDIENTE';
  delete from notificaciones where user_id = v_me and tipo = 'plan_invite' and entity_id = p_plan_id::text;
end;
$$;
revoke all on function public.fn_rechazar_plan_invite(bigint) from public, anon;
grant execute on function public.fn_rechazar_plan_invite(bigint) to authenticated;

create or replace function public.fn_get_pending_plan_invite_user_ids(p_plan_id bigint)
 returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  perform public.assert_allowed(auth.uid() is not null and public.is_plan_participant(p_plan_id));
  return array(
    select invitado_id from plan_invitaciones where plan_id = p_plan_id and estado = 'PENDIENTE'
  );
end;
$$;
revoke all on function public.fn_get_pending_plan_invite_user_ids(bigint) from public, anon;
grant execute on function public.fn_get_pending_plan_invite_user_ids(bigint) to authenticated;

-- Lo que enseña la ventana de invitar: amigos (con quién has hablado en 30 días primero) y
-- grupos con sus miembros, y el código corto del enlace. estado: 'miembro' | 'pendiente' | null.
create or replace function public.fn_plan_invitar_lista(p_plan_id bigint)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_amigos jsonb;
  v_grupos jsonb;
begin
  perform public.assert_allowed(v_me is not null and public.is_plan_participant(p_plan_id));

  with amigos as (
    select case when a.user_id_1 = v_me then a.user_id_2 else a.user_id_1 end as id
      from amistades a
     where (a.user_id_1 = v_me or a.user_id_2 = v_me) and a.estado = 'ACTIVA'
  ), hablado as (
    select m.sender_id as id, max(m.created_at) as ultima
      from mensajes m
      join chat_miembro cm on cm.chat_id = m.chat_id and cm.user_id = v_me
     where m.created_at > now() - interval '30 days'
       and m.sender_id in (select id from amigos)
     group by m.sender_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id, 'nombre', u.nombre, 'username', u.username,
           'profile_image', public.fn_foto_visible(u.id, u.profile_image),
           'estado', case
             when exists (select 1 from plan_usuarios pu where pu.plan_id = p_plan_id and pu.user_id = u.id and pu.estado = 'PARTICIPA') then 'miembro'
             when exists (select 1 from plan_invitaciones i where i.plan_id = p_plan_id and i.invitado_id = u.id and i.estado = 'PENDIENTE') then 'pendiente'
           end,
           'reciente', h.ultima is not null)
         order by h.ultima desc nulls last, lower(u.nombre)), '[]'::jsonb)
    into v_amigos
    from amigos f
    join usuarios u on u.id = f.id and u.deleted_at is null
    left join hablado h on h.id = f.id
   where not public.fn_bloqueado_por(v_me, u.id) and not public.fn_bloqueado_por(u.id, v_me);

  select coalesce(jsonb_agg(g order by g->>'ultima' desc nulls last), '[]'::jsonb) into v_grupos
    from (
      select jsonb_build_object(
               'chat_id', c.id, 'nombre', c.nombre, 'foto', c.foto,
               'ultima', coalesce(c.last_message_at, c.created_at),
               'miembros', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'id', u.id, 'nombre', u.nombre,
                          'profile_image', public.fn_foto_visible(u.id, u.profile_image),
                          'estado', case
                            when exists (select 1 from plan_usuarios pu where pu.plan_id = p_plan_id and pu.user_id = u.id and pu.estado = 'PARTICIPA') then 'miembro'
                            when exists (select 1 from plan_invitaciones i where i.plan_id = p_plan_id and i.invitado_id = u.id and i.estado = 'PENDIENTE') then 'pendiente'
                          end) order by lower(u.nombre)), '[]'::jsonb)
                   from chat_miembro cm2
                   join usuarios u on u.id = cm2.user_id and u.deleted_at is null
                  where cm2.chat_id = c.id and cm2.user_id <> v_me
                    and not public.fn_bloqueado_por(v_me, u.id) and not public.fn_bloqueado_por(u.id, v_me))
             ) as g
        from chat c
        join chat_miembro cm on cm.chat_id = c.id and cm.user_id = v_me
       where c.tipo = 'GRUPO'
    ) s;

  return jsonb_build_object('amigos', v_amigos, 'grupos', v_grupos,
                            'codigo', (select codigo from plan where id = p_plan_id));
end;
$$;
revoke all on function public.fn_plan_invitar_lista(bigint) from public, anon;
grant execute on function public.fn_plan_invitar_lista(bigint) to authenticated;

-- ───────────────────────── 6. Unirse por enlace o QR ─────────────────────────

-- No se usaba y leía una tabla que no existe («planes»).
drop function if exists public.fn_get_plan_by_join_code(text);

create or replace function public.fn_join_plan_by_code(p_join_code text, p_preview_only boolean default false)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_plan_id bigint;
  v_plan json;
  v_estado estado_plan_usuario;
begin
  begin
    v_plan_id := public.fn_plan_por_codigo(p_join_code);
  exception when sqlstate 'P0001' then
    return json_build_object('error', 'too_many_attempts');
  end;
  if v_plan_id is null then
    return json_build_object('error', 'not_found');
  end if;

  select estado into v_estado from plan_usuarios where plan_id = v_plan_id and user_id = v_me;
  -- Quien fue expulsado no vuelve a entrar con el enlace.
  if v_estado = 'BLOQUEADO' then
    return json_build_object('error', 'not_allowed');
  end if;

  if not p_preview_only and v_estado is distinct from 'PARTICIPA' then
    insert into plan_usuarios (plan_id, user_id, rol, estado)
    values (v_plan_id, v_me, 'PARTICIPANTE', 'PARTICIPA')
    on conflict (plan_id, user_id) do update set estado = 'PARTICIPA', updated_at = now();
    update chat_miembro set last_read_at = now()
     where user_id = v_me and chat_id = (select id from chat where plan_id = v_plan_id);
    -- Si además tenía una invitación, queda aceptada.
    update plan_invitaciones set estado = 'ACEPTADA', respondida_at = now()
     where plan_id = v_plan_id and invitado_id = v_me and estado = 'PENDIENTE';
    delete from notificaciones where user_id = v_me and tipo = 'plan_invite' and entity_id = v_plan_id::text;
  end if;

  select row_to_json(r) into v_plan
  from (
    select p.id, p.titulo, p.descripcion, p.visibilidad,
      p.inicio_at, p.fin_at, p.all_day, p.ubicacion_nombre,
      p.foto_portada, p.owner_user_id, p.creado_por_user_id, p.codigo,
      u.nombre as creador_nombre, public.fn_foto_visible(u.id, u.profile_image) as creador_profile_image
    from plan p
    left join usuarios u on u.id = p.creado_por_user_id
    where p.id = v_plan_id
  ) r;

  return json_build_object('plan_id', v_plan_id, 'plan', v_plan, 'already_member', v_estado = 'PARTICIPA');
end;
$$;
revoke all on function public.fn_join_plan_by_code(text, boolean) from public, anon;
grant execute on function public.fn_join_plan_by_code(text, boolean) to authenticated;

-- ───────────────────────── 7. RLS ─────────────────────────

-- Darse de alta a uno mismo ya no: solo el creador (y las funciones, que no pasan por RLS).
drop policy if exists "plan_usuarios: insert" on public.plan_usuarios;
create policy "plan_usuarios: insert" on public.plan_usuarios
  for insert to authenticated
  with check (plan_id in (select p.id from public.plan p where p.creado_por_user_id = auth.uid()));

-- Desde la app solo se crean avisos sociales; los de planes, encuestas y deudas los crean
-- las funciones (si no, cualquiera podría mandar invitaciones falsas en su nombre).
drop policy if exists "notificaciones: insert como actor" on public.notificaciones;
create policy "notificaciones: insert como actor" on public.notificaciones
  for insert to authenticated
  with check (actor_id = auth.uid() and tipo in ('like', 'comment', 'friend_request', 'friend_accept', 'mention'));
