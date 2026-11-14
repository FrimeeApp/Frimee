-- Calls on Android with Frimee closed or the phone locked (design phase 4, board M19).
--
-- 1. fn_trigger_call_push: when a call starts ringing, and when it stops ringing (answered,
--    declined, busy, missed, expired), the send-push function tells the others' phones: they
--    show the call full screen, or take it away.
-- 2. fn_call_decline: "Rechazar" pressed in that notification, sent by the call-action function
--    with a signed code (no session on the phone at that moment). One-to-one calls only: in a
--    group, others may still answer.
--
-- Uses the same Vault secrets as fn_trigger_send_push (app_supabase_url, app_service_role_key).

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

drop trigger if exists trg_call_push on public.llamadas;
create trigger trg_call_push
  after insert or update of estado on public.llamadas
  for each row execute function public.fn_trigger_call_push();


create or replace function public.fn_call_decline(p_llamada_id bigint, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_call record;
begin
  select l.id, l.estado, l.iniciado_por_user_id, c.tipo as chat_tipo
    into v_call
    from llamadas l
    join chat c on c.id = l.chat_id
   where l.id = p_llamada_id
     and exists (select 1 from chat_miembro m where m.chat_id = l.chat_id and m.user_id = p_user_id);

  if not found then return 'not_found'; end if;
  if v_call.iniciado_por_user_id = p_user_id then return 'caller'; end if;
  if v_call.estado <> 'ringing' then return 'not_ringing'; end if;
  if v_call.chat_tipo <> 'DIRECTO' then return 'group'; end if;

  update llamadas set estado = 'rejected', finalizada_at = now()
   where id = p_llamada_id and estado = 'ringing';
  return 'rejected';
end;
$function$;

revoke all on function public.fn_call_decline(bigint, uuid) from public, anon, authenticated;
grant execute on function public.fn_call_decline(bigint, uuid) to service_role;
