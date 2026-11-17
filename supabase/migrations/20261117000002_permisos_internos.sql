-- Funciones internas que se podían llamar desde fuera (2026-11-17).
--
-- Estas funciones son SECURITY DEFINER y tenían permiso de ejecución para anon y
-- authenticated, así que cualquiera con la clave pública de la web podía llamarlas:
--   · check_rate_limit: sumar intentos a la clave de otro (agotarle el cupo a otro usuario
--     o a una ruta entera). La usan las rutas /api y frimee-assistant con la clave de servicio.
--   · fn_cron_recordatorios_deuda, fn_cron_resumen_post_viaje, purge_soft_deleted_usuarios:
--     tareas de pg_cron que cualquiera podía lanzar cuando quisiera.
-- pg_cron las ejecuta como su dueño, así que siguen funcionando.
--
-- También quita la tarea update-flight-positions: llamaba cada minuto a una función edge
-- que no existe (no está desplegada ni en el repositorio), con la clave de servicio escrita
-- en el propio comando.

revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

revoke execute on function public.fn_cron_recordatorios_deuda() from public, anon, authenticated;
revoke execute on function public.fn_cron_resumen_post_viaje() from public, anon, authenticated;
revoke execute on function public.purge_soft_deleted_usuarios() from public, anon, authenticated;

-- The job and its run history (each run stored the command, key included).
delete from cron.job_run_details
 where jobid in (select jobid from cron.job where jobname = 'update-flight-positions');
select cron.unschedule(jobid) from cron.job where jobname = 'update-flight-positions';
