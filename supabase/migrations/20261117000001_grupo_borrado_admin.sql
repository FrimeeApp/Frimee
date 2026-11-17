-- Borrar un grupo con su administrador dentro (2026-11-17).
--
-- Al borrar un grupo, sus filas de miembros_grupo se borran en cascada, y el trigger que
-- impide quitar al último ADMIN lo bloqueaba: «No puedes eliminar al último ADMIN del grupo».
-- Así fallaba fn_guest_cleanup con los invitados que tienen el grupo «Familia» de la demo
-- (los saltaba enteros) y cualquier borrado de un grupo. El de planes ya dejaba pasar el
-- borrado cuando el plan se está borrando; el de grupos hace ahora lo mismo.

create or replace function public.trg_miembrosgrupo_cannot_remove_last_admin()
 returns trigger
 language plpgsql
as $function$
declare admin_count int;
begin
  if (tg_op = 'DELETE') then
    -- The group itself is being deleted (cascade): nothing to protect.
    if not exists (select 1 from grupos where id = old.grupo_id) then
      return old;
    end if;

    if old.rol = 'ADMIN' then
      select count(*) into admin_count
      from miembros_grupo
      where grupo_id = old.grupo_id
        and rol = 'ADMIN'
        and (user_id <> old.user_id);

      if admin_count = 0 then
        raise exception 'No puedes eliminar al último ADMIN del grupo.';
      end if;
    end if;
    return old;
  end if;

  if (tg_op = 'UPDATE') then
    if old.rol = 'ADMIN' and new.rol <> 'ADMIN' then
      select count(*) into admin_count
      from miembros_grupo
      where grupo_id = old.grupo_id
        and rol = 'ADMIN'
        and (user_id <> old.user_id);

      if admin_count = 0 then
        raise exception 'No puedes degradar al último ADMIN del grupo.';
      end if;
    end if;
    return new;
  end if;

  return null;
end $function$;
