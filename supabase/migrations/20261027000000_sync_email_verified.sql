-- Email sign-ups never got usuarios.email_verified_at: the profile is created
-- unconfirmed on insert, and the update trigger ignored existing profiles
-- (on conflict do nothing) when the user later confirmed the email.
-- Now the update trigger syncs only email_verified_at; name and avatar stay
-- untouched so profile edits made in the app are not overwritten.

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
    split_part(coalesce(new.email, ''), '@', 1),
    'Usuario'
  );

  v_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  v_email := coalesce(
    new.email,
    new.raw_user_meta_data->>'email'
  );

  if v_email is null then
    raise exception 'Email nulo en update de auth.users para id=%', new.id;
  end if;

  -- Si no existe (caso raro), lo crea. Si existe, solo sincroniza la verificación
  -- del email: nombre y foto se editan desde la app y no se pisan.
  insert into public.usuarios (id, nombre, email, fecha_registro, profile_image, email_verified_at)
  values (new.id, v_name, v_email, now(), v_avatar, new.email_confirmed_at)
  on conflict (id) do update
    set email_verified_at = excluded.email_verified_at
    where usuarios.email_verified_at is distinct from excluded.email_verified_at;

  return new;
end;
$$;

-- Backfill profiles of users who confirmed before this fix.
update public.usuarios u
set email_verified_at = a.email_confirmed_at
from auth.users a
where a.id = u.id
  and a.email_confirmed_at is not null
  and u.email_verified_at is null;
