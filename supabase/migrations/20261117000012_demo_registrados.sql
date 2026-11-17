-- El ejemplo vuelve a poder crearse en cuentas registradas.
--
-- Una versión anterior del seed (la rama fix/demo-temporal, aplicada a mano en algún entorno,
-- nunca fusionada) rechazaba a quien no es invitado con «El plan de ejemplo es solo para el modo
-- invitado». Tras 20261117000010 ese cuerpo vive en fn_demo_sembrar, así que el botón «Ver el
-- ejemplo» de una cuenta registrada fallaba. Se quita solo esa comprobación del cuerpo que haya
-- en el entorno; si no existe (como en el esquema de las migraciones), no hace nada.

do $$
declare
  v_def text;
  v_nueva text;
begin
  v_def := pg_get_functiondef('public.fn_demo_sembrar()'::regprocedure);
  if v_def not like '%solo para el modo invitado%' then
    return;
  end if;

  v_nueva := regexp_replace(
    v_def,
    'if not exists \(select 1 from auth\.users where id = v_guest and is_anonymous\) then\s+raise exception ''El plan de ejemplo es solo para el modo invitado''[^;]*;\s+end if;',
    '',
    'g'
  );

  if v_nueva like '%solo para el modo invitado%' then
    raise exception 'No se ha podido quitar la comprobación de invitado de fn_demo_sembrar; revisar a mano';
  end if;

  execute v_nueva;
end;
$$;
