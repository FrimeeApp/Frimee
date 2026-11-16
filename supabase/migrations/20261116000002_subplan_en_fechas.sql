-- Paso 2.31 · Una actividad siempre empieza dentro de los días de su plan (tablero po-16).
-- fn_subplan_create / fn_subplan_update no lo comprobaban: lo hace un trigger en la tabla, así
-- vale para todos los caminos (hoja del plan, «Añadir al plan» del chat, copias, @frimee).
-- Se compara por DÍA en hora de España: los planes se eligen por días y se guardan a 10:00/18:00
-- locales o a medianoche UTC (ediciones antiguas). Una actividad puede acabar al día siguiente.
-- Solo se mira al crear o al cambiar el inicio o el plan: editar el título de una actividad que
-- ya estaba fuera sigue funcionando.

create or replace function public.trg_subplan_en_fechas_plan()
  returns trigger
  language plpgsql
  set search_path to 'public'
as $$
declare
  v_ini timestamptz;
  v_fin timestamptz;
  v_dia date;
begin
  if tg_op = 'UPDATE' and new.inicio_at is not distinct from old.inicio_at and new.plan_id = old.plan_id then
    return new;
  end if;
  select inicio_at, fin_at into v_ini, v_fin from plan where id = new.plan_id;
  if v_ini is null or v_fin is null then
    return new;
  end if;
  v_dia := (new.inicio_at at time zone 'Europe/Madrid')::date;
  if v_dia < (v_ini at time zone 'Europe/Madrid')::date or v_dia > (v_fin at time zone 'Europe/Madrid')::date then
    raise exception 'La actividad tiene que estar dentro de las fechas del plan' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_subplan_en_fechas_plan on public.subplan;
create trigger trg_subplan_en_fechas_plan
  before insert or update of inicio_at, plan_id on public.subplan
  for each row execute function public.trg_subplan_en_fechas_plan();
