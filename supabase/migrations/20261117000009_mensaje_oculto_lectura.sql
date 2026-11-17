-- La política mensajes_select consulta mensaje_oculto, pero authenticated no tenía permiso
-- sobre esa tabla: cualquier lectura directa de mensajes (y Realtime, que evalúa la política
-- con el rol del usuario) fallaba con «permission denied for table mensaje_oculto».
-- Se permite solo leer las filas propias; escribir sigue siendo solo por las funciones.
grant select on table public.mensaje_oculto to authenticated;

drop policy if exists mensaje_oculto_select_propio on public.mensaje_oculto;
create policy mensaje_oculto_select_propio on public.mensaje_oculto
  for select to authenticated
  using (user_id = (select auth.uid()));
