-- Los usuarios anónimos y los personajes ficticios solo existen para la demo.
-- No deben salir en el directorio global de personas, pero siguen visibles en
-- los planes/chats de la demo mediante las consultas de sus participantes.
create or replace function public.fn_users_search_public(
  p_query text,
  p_limit integer default 8,
  p_exclude_user_id uuid default null
)
returns table(id uuid, nombre text, username text, profile_image text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    u.id,
    u.nombre,
    u.username,
    public.fn_foto_visible(u.id, u.profile_image)
  from public.usuarios u
  where u.deleted_at is null
    and (p_exclude_user_id is null or u.id <> p_exclude_user_id)
    and not exists (
      select 1
      from auth.users au
      where au.id = u.id
        and (au.is_anonymous or au.raw_user_meta_data ? 'demo_friend_of')
    )
    and (
      u.nombre ilike '%' || p_query || '%'
      or u.username ilike '%' || p_query || '%'
    )
  order by
    case when u.username ilike p_query || '%' then 0
         when u.nombre ilike p_query || '%' then 1
         else 2
    end,
    u.nombre
  limit p_limit;
$$;
