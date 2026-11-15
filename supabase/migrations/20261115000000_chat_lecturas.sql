-- Chat Bitácora: sent / seen checks next to the time of your messages.
-- Each member can only read their own chat_miembro row (policy «chat_miembro: own rows»), so the
-- client cannot know how far the others have read. fn_chat_lecturas returns it for one chat:
-- the other members and their last_read_at, only to a member of that chat. The client marks a
-- message «visto» when every other member read past it, and refetches when someone broadcasts
-- that they read (realtime broadcast on the chat's channel, nothing stored).

create or replace function public.fn_chat_lecturas(p_chat_id uuid)
 returns table(user_id uuid, last_read_at timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
begin
  perform public.assert_allowed(public.is_chat_member(p_chat_id));
  return query
  select cm.user_id, cm.last_read_at
    from chat_miembro cm
   where cm.chat_id = p_chat_id
     and cm.user_id <> auth.uid();
end;
$$;

revoke all on function public.fn_chat_lecturas(uuid) from public, anon;
grant execute on function public.fn_chat_lecturas(uuid) to authenticated, service_role;
