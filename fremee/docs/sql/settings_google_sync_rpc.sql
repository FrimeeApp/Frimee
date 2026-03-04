-- Extiende user_settings con flags de sincronizacion Google Calendar
alter table public.user_settings
  add column if not exists google_sync_enabled boolean not null default false,
  add column if not exists google_sync_export_plans boolean not null default true;

create or replace function public.fn_user_settings_upsert(
  p_user_id uuid,
  p_theme public.theme_preference default null,
  p_language varchar default null,
  p_timezone varchar default null,
  p_notify_push boolean default null,
  p_notify_email boolean default null,
  p_notify_in_app boolean default null,
  p_profile_visibility varchar default null,
  p_allow_friend_requests boolean default null,
  p_google_sync_enabled boolean default null,
  p_google_sync_export_plans boolean default null
)
returns public.user_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_settings;
begin
  insert into public.user_settings (
    user_id,
    theme,
    language,
    timezone,
    notify_push,
    notify_email,
    notify_in_app,
    profile_visibility,
    allow_friend_requests,
    google_sync_enabled,
    google_sync_export_plans
  )
  values (
    p_user_id,
    coalesce(p_theme, 'SYSTEM'::public.theme_preference),
    coalesce(p_language, 'es'),
    coalesce(p_timezone, 'Europe/Madrid'),
    coalesce(p_notify_push, true),
    coalesce(p_notify_email, true),
    coalesce(p_notify_in_app, true),
    coalesce(p_profile_visibility, 'PUBLICO'),
    coalesce(p_allow_friend_requests, true),
    coalesce(p_google_sync_enabled, false),
    coalesce(p_google_sync_export_plans, true)
  )
  on conflict (user_id)
  do update set
    theme = coalesce(p_theme, public.user_settings.theme),
    language = coalesce(p_language, public.user_settings.language),
    timezone = coalesce(p_timezone, public.user_settings.timezone),
    notify_push = coalesce(p_notify_push, public.user_settings.notify_push),
    notify_email = coalesce(p_notify_email, public.user_settings.notify_email),
    notify_in_app = coalesce(p_notify_in_app, public.user_settings.notify_in_app),
    profile_visibility = coalesce(p_profile_visibility, public.user_settings.profile_visibility),
    allow_friend_requests = coalesce(p_allow_friend_requests, public.user_settings.allow_friend_requests),
    google_sync_enabled = coalesce(p_google_sync_enabled, public.user_settings.google_sync_enabled),
    google_sync_export_plans = coalesce(p_google_sync_export_plans, public.user_settings.google_sync_export_plans),
    deleted_at = null,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.fn_user_profile_and_settings_upsert(
  p_user_id uuid,
  p_nombre text default null,
  p_fecha_nac date default null,
  p_profile_image text default null,
  p_theme public.theme_preference default null,
  p_language varchar default null,
  p_timezone varchar default null,
  p_notify_push boolean default null,
  p_notify_email boolean default null,
  p_notify_in_app boolean default null,
  p_profile_visibility varchar default null,
  p_allow_friend_requests boolean default null,
  p_google_sync_enabled boolean default null,
  p_google_sync_export_plans boolean default null
)
returns table (
  user_id uuid,
  nombre text,
  fecha_nac date,
  profile_image text,
  theme public.theme_preference,
  language varchar,
  timezone varchar,
  notify_push boolean,
  notify_email boolean,
  notify_in_app boolean,
  profile_visibility varchar,
  allow_friend_requests boolean,
  google_sync_enabled boolean,
  google_sync_export_plans boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, fecha_nac, profile_image, email)
  values (
    p_user_id,
    coalesce(nullif(trim(p_nombre), ''), 'Usuario'),
    p_fecha_nac,
    p_profile_image,
    (select au.email from auth.users au where au.id = p_user_id)
  )
  on conflict (id)
  do update set
    nombre = coalesce(nullif(trim(p_nombre), ''), public.usuarios.nombre),
    fecha_nac = coalesce(p_fecha_nac, public.usuarios.fecha_nac),
    profile_image = coalesce(p_profile_image, public.usuarios.profile_image),
    deleted_at = null;

  perform public.fn_user_settings_upsert(
    p_user_id,
    p_theme,
    p_language,
    p_timezone,
    p_notify_push,
    p_notify_email,
    p_notify_in_app,
    p_profile_visibility,
    p_allow_friend_requests,
    p_google_sync_enabled,
    p_google_sync_export_plans
  );

  return query
  select
    u.id as user_id,
    u.nombre,
    u.fecha_nac,
    u.profile_image,
    s.theme,
    s.language,
    s.timezone,
    s.notify_push,
    s.notify_email,
    s.notify_in_app,
    s.profile_visibility,
    s.allow_friend_requests,
    s.google_sync_enabled,
    s.google_sync_export_plans
  from public.usuarios u
  join public.user_settings s
    on s.user_id = u.id
  where u.id = p_user_id
    and u.deleted_at is null
    and s.deleted_at is null;
end;
$$;

create or replace function public.fn_user_auth_snapshot_get(
  p_user_id uuid
)
returns table (
  id uuid,
  nombre text,
  fecha_nac date,
  email text,
  rol text,
  profile_image text,
  estado text,
  email_verified_at timestamptz,
  deleted_at timestamptz,
  user_id uuid,
  theme public.theme_preference,
  language varchar,
  timezone varchar,
  notify_push boolean,
  notify_email boolean,
  notify_in_app boolean,
  profile_visibility varchar,
  allow_friend_requests boolean,
  google_sync_enabled boolean,
  google_sync_export_plans boolean
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.nombre,
    u.fecha_nac,
    u.email,
    u.rol,
    u.profile_image,
    u.estado,
    u.email_verified_at,
    u.deleted_at,
    s.user_id,
    s.theme,
    s.language,
    s.timezone,
    s.notify_push,
    s.notify_email,
    s.notify_in_app,
    s.profile_visibility,
    s.allow_friend_requests,
    s.google_sync_enabled,
    s.google_sync_export_plans
  from public.usuarios u
  left join public.user_settings s
    on s.user_id = u.id
   and s.deleted_at is null
  where u.id = p_user_id
  limit 1;
$$;

grant execute on function public.fn_user_settings_upsert(
  uuid,
  public.theme_preference,
  varchar,
  varchar,
  boolean,
  boolean,
  boolean,
  varchar,
  boolean,
  boolean,
  boolean
) to authenticated;

grant execute on function public.fn_user_profile_and_settings_upsert(
  uuid,
  text,
  date,
  text,
  public.theme_preference,
  varchar,
  varchar,
  boolean,
  boolean,
  boolean,
  varchar,
  boolean,
  boolean,
  boolean
) to authenticated;

grant execute on function public.fn_user_auth_snapshot_get(uuid) to authenticated;
