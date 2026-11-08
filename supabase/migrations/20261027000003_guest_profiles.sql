-- Guest access with Supabase anonymous users (auth.users.is_anonymous).
-- Anonymous users have no email, but usuarios.email is NOT NULL and UNIQUE,
-- so both auth triggers raised 'Email nulo' and sign-in failed. Guests now get
-- a placeholder under the reserved .invalid TLD (RFC 2606: never deliverable).
-- When a guest converts the account (updateUser({ email }) + confirmation),
-- the update trigger swaps the placeholder for the real email; the user id is
-- the same, so plans and expenses are kept.

create or replace function public.fn_guest_email(p_user_id uuid) returns text
    language sql immutable
    as $$
  select format('invitado-%s@frimee.invalid', p_user_id);
$$;

create or replace function public.handle_auth_user_insert() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_name text;
  v_avatar text;
  v_email text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    case when new.is_anonymous then 'Invitado' end,
    split_part(coalesce(new.email, ''), '@', 1),
    'Usuario'
  );

  v_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  v_email := coalesce(
    new.email,
    new.raw_user_meta_data->>'email',
    case when new.is_anonymous then fn_guest_email(new.id) end
  );

  if v_email is null then
    raise exception 'Email nulo en auth.users para id=%', new.id;
  end if;

  -- Solo crear si no existe. Si ya existe, NO modificar.
  insert into public.usuarios (id, nombre, email, fecha_registro, profile_image, email_verified_at)
  values (new.id, v_name, v_email, now(), v_avatar, new.email_confirmed_at)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.handle_auth_user_update() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_name text;
  v_avatar text;
  v_email text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    case when new.is_anonymous then 'Invitado' end,
    split_part(coalesce(new.email, ''), '@', 1),
    'Usuario'
  );

  v_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  v_email := coalesce(
    new.email,
    new.raw_user_meta_data->>'email',
    case when new.is_anonymous then fn_guest_email(new.id) end
  );

  if v_email is null then
    raise exception 'Email nulo en update de auth.users para id=%', new.id;
  end if;

  -- Si no existe (caso raro), lo crea. Si existe, solo sincroniza la verificación
  -- del email y, si era un invitado que ha convertido su cuenta, su email real y
  -- el nombre que puso al guardarla (full_name). Fuera de eso, nombre y foto se
  -- editan desde la app y no se pisan.
  insert into public.usuarios (id, nombre, email, fecha_registro, profile_image, email_verified_at)
  values (new.id, v_name, v_email, now(), v_avatar, new.email_confirmed_at)
  on conflict (id) do update
    set email_verified_at = excluded.email_verified_at,
        email = case when usuarios.email = fn_guest_email(usuarios.id) then excluded.email
                     else usuarios.email end,
        nombre = case when usuarios.email = fn_guest_email(usuarios.id) and excluded.email <> usuarios.email
                      then excluded.nombre else usuarios.nombre end
    where usuarios.email_verified_at is distinct from excluded.email_verified_at
       or (usuarios.email = fn_guest_email(usuarios.id) and excluded.email <> usuarios.email);

  return new;
end;
$$;

-- "Guardar mi cuenta" marks raw_user_meta_data.pending_password because Supabase
-- only lets a converted guest set a password after confirming the email. The
-- password can then be set from several places (that form, "¿Has olvidado tu
-- contraseña?", settings), so the mark is cleared here, whenever it changes.
create or replace function public.fn_auth_user_clear_pending_password() returns trigger
    language plpgsql
    set search_path to ''
    as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and coalesce(new.encrypted_password, '') <> '' then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'pending_password';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_password_set on auth.users;
create trigger on_auth_user_password_set
  before update of encrypted_password on auth.users
  for each row execute function public.fn_auth_user_clear_pending_password();

-- Users who already set a password some other way.
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'pending_password'
where raw_user_meta_data ? 'pending_password'
  and coalesce(encrypted_password, '') <> '';
