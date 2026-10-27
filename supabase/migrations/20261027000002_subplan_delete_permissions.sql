-- fn_subplan_delete only worked for the subplan's creator and silently did
-- nothing for anyone else, so the app showed it as deleted. Align it with
-- fn_subplan_update (any participant of the plan) and fail loudly otherwise.
-- Still a soft delete: fn_subplan_list only returns ACTIVO subplans.
--
-- The subplan's expenses are either voided (p_delete_gastos) or kept and
-- unlinked: the soft delete never fires gastos_subplan_id_fkey's ON DELETE
-- SET NULL, so without this they would keep pointing at a cancelled subplan.

-- New signature: drop the old one so PostgREST does not see two overloads.
drop function if exists public.fn_subplan_delete(bigint);

create function public.fn_subplan_delete(p_subplan_id bigint, p_delete_gastos boolean default false)
    returns void
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_gasto_id bigint;
begin
  if not exists (
    select 1 from subplan sp
    join plan_usuarios pu on pu.plan_id = sp.plan_id
    where sp.id = p_subplan_id
      and pu.user_id = auth.uid()
      and pu.estado = 'PARTICIPA'
  ) then
    raise exception 'No autorizado';
  end if;

  if p_delete_gastos then
    -- Same path as voiding one expense in the app: removes its shares and recalculates balances.
    for v_gasto_id in
      select id from gastos where subplan_id = p_subplan_id and deleted_at is null
    loop
      perform fn_gasto_anular(v_gasto_id);
    end loop;
  else
    update gastos
       set subplan_id = null, updated_at = now()
     where subplan_id = p_subplan_id and deleted_at is null;
  end if;

  update subplan
     set estado = 'CANCELADO'
   where id = p_subplan_id;
end;
$$;

grant execute on function public.fn_subplan_delete(bigint, boolean) to authenticated, service_role;
