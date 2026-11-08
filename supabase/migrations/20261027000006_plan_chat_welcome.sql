-- Every new plan chat starts with a message from Frimee that explains the @frimee assistant
-- and names the trip's destination ("Lisboa, Portugal" -> "Lisboa"). A trigger on chat covers
-- every way a plan chat is created: fn_plan_create_chat, fn_get_or_create_plan_chat (the app
-- creates the chat the first time it is opened) and the guest demo plan.
--
-- Same shape as fn_bot_message_insert: no sender and tipo 'bot'. There are no triggers on
-- mensajes, so it sends no push notification.

create or replace function public.trg_chat_plan_welcome() returns trigger
    language plpgsql security definer
    set search_path = public
    as $$
declare
  v_destino text;
begin
  select nullif(trim(split_part(ubicacion_nombre, ',', 1)), '')
    into v_destino
    from plan
   where id = new.plan_id;

  insert into mensajes (chat_id, sender_id, texto, tipo)
  values (
    new.id, null,
    '¡Hola! Soy Frimee, el asistente del plan. Escribid @frimee y lo que necesitéis: '
      || coalesce('el tiempo en ' || v_destino, 'el tiempo que hará')
      || ', cómo vais de cuentas o ideas para cenar. También puedo crear encuestas para que el grupo decida.',
    'bot'
  );

  update chat
     set last_message = '¡Hola! Soy Frimee, el asistente del plan. Escribid @frimee y lo que necesitéis.',
         last_message_at = now()
   where id = new.id;

  return null;
end;
$$;

-- Only the trigger calls it.
revoke all on function public.trg_chat_plan_welcome() from public, anon, authenticated;

drop trigger if exists trg_chat_plan_welcome on public.chat;
create trigger trg_chat_plan_welcome
  after insert on public.chat
  for each row
  when (new.tipo = 'PLAN' and new.plan_id is not null)
  execute function public.trg_chat_plan_welcome();
