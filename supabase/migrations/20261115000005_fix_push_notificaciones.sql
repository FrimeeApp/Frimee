-- Avisos: el trigger que manda el push de cada fila de notificaciones llamaba a net.http_post con
-- body de tipo text, pero pg_net solo tiene la versión con body jsonb. El INSERT entero fallaba
-- («function net.http_post(url => text, headers => jsonb, body => text) does not exist»), así que
-- ningún aviso llegaba a crearse (en dev, 0 filas en notificaciones). Igual que el de llamadas
-- (20261109000001_call_push.sql): body en jsonb.
create or replace function public.fn_trigger_send_push()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'vault'
as $$
declare
  v_url      text;
  v_key      text;
  v_payload  jsonb;
begin
  -- Lee los secretos desde el Vault de Supabase
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'app_supabase_url' limit 1;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'app_service_role_key' limit 1;

  if v_url is null or v_key is null then
    raise warning '[send-push] vault secrets not configured';
    return NEW;
  end if;

  v_url := v_url || '/functions/v1/send-push';

  v_payload := jsonb_build_object(
    'type',   'INSERT',
    'table',  'notificaciones',
    'record', row_to_json(NEW)::jsonb
  );

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := v_payload
  );

  return NEW;
end;
$$;
