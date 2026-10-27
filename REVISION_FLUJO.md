# Revisión del flujo principal

Fallos encontrados al recorrer la app contra el proyecto de Supabase de desarrollo (`frimee-dev`), con su causa y su arreglo.

Estado: ✅ arreglado y probado en dev · ⏳ pendiente de aplicar en producción · 🔲 pendiente

## Pendiente en producción

Las migraciones se prueban primero en dev. Al fusionar la rama, aplicar en producción en este orden:

- [ ] `supabase/migrations/20261027000000_sync_email_verified.sql`
- [ ] `supabase/migrations/20261027000001_seed_categorias_gasto.sql` (no cambia nada en producción: las filas ya existen)
- [ ] `supabase/migrations/20261027000002_subplan_delete_permissions.sql`

## Fallos

### 1. El perfil no se marca como verificado al confirmar el email ✅ ⏳

**Qué pasaba:** al registrarse con email y contraseña y confirmar el email, `auth.users.email_confirmed_at` se rellena, pero `public.usuarios.email_verified_at` se queda vacío para siempre. En producción afectaba a 34 de 44 usuarios (33 de email y 1 de Google).

**Causa:** el trigger `on_auth_user_update` llama a `handle_auth_user_update()`, que hacía `insert ... on conflict (id) do nothing`. El perfil ya existía (lo crea el trigger de inserción), así que la confirmación no llegaba nunca al perfil. Con Google casi no pasa porque la cuenta llega ya confirmada al crearse.

**Impacto:** nada visible todavía; la app lee el campo pero no decide nada con él. Se rompería en cuanto algo dependa de que el usuario esté verificado.

**Arreglo:** `20261027000000_sync_email_verified.sql`. El `on conflict` ahora actualiza solo `email_verified_at` (nombre y foto no se pisan, porque se editan desde la app), y un `update` corrige los perfiles existentes.

**Prueba:** en dev, dentro de una transacción con `rollback`: se vacía `email_verified_at`, se actualiza `email_confirmed_at` en `auth.users` y el perfil queda verificado.

### 2. Crear un gasto falla en un entorno nuevo ✅

**Qué pasaba:** en `frimee-dev`, guardar cualquier gasto daba error y el selector de categoría ni aparecía.

**Causa:** el baseline copia solo la estructura de la base, no los datos. `categorias_gasto` es un catálogo (25 categorías globales) y estaba vacía. El formulario (`AddGastoSheet`) usa por defecto la categoría `0` ("Otros"), así que el insert rompía la clave foránea `gastos_categoria_id_fkey`. En producción no pasa porque las categorías existen.

**Arreglo:** `20261027000001_seed_categorias_gasto.sql` carga las 25 categorías globales con los mismos ids que producción (`overriding system value`) y ajusta la secuencia. Cualquier entorno nuevo (dev, invitados, tests) las tendrá. Se revisaron todas las tablas: es el único catálogo; el resto son datos de usuarios o cachés.

### 3. No se podían borrar actividades (subplanes) ✅ ⏳

**Qué pasaba:** al editar una actividad no había opción de eliminarla.

**Causa:** la función `fn_subplan_delete` y el endpoint `deleteSubplan()` existían, pero ninguna pantalla los usaba. Además, la función solo dejaba borrar al creador de la actividad y, si lo intentaba otro, no hacía nada y no daba error, aunque editar sí lo permite a cualquier participante.

**Arreglo:**
- `20261027000002_subplan_delete_permissions.sql`: mismos permisos que `fn_subplan_update`, error `No autorizado` si no los tienes y `search_path` fijo (recomendación de seguridad de Supabase para funciones `security definer`). Sigue siendo un borrado lógico (`estado = 'CANCELADO'`).
- Gastos de la actividad: el borrado lógico no dispara el `ON DELETE SET NULL` de `gastos_subplan_id_fkey`, así que los gastos seguían apuntando a la actividad cancelada. Nuevo parámetro `p_delete_gastos` (por defecto `false`): sin marcar, los gastos se mantienen y se desvinculan (`subplan_id = null`); marcado, se anulan con `fn_gasto_anular`, que recalcula las deudas. Se elimina la firma antigua para no dejar dos sobrecargas.
- `AddSubplanSheet`: botón "Eliminar actividad" en modo edición, con confirmación. Si la actividad tiene gastos, el diálogo muestra un tick (desmarcado por defecto) para eliminarlos también.
- `DiscardChangesDialog`: acepta `children` para mostrar contenido extra bajo el mensaje.
- `PlanPageClient`: `handleSubplanDeleted` quita la actividad de la lista, limpia la ruta de la siguiente del mismo día (salía de la borrada) y recarga gastos y balances.

### 4. No se podían eliminar gastos ✅

**Qué pasaba:** un gasto creado por error no se podía quitar.

**Causa:** `fn_gasto_anular` y `deleteGastoEndpoint()` existían, pero ninguna pantalla los usaba.

**Arreglo:** botón "Eliminar gasto" en el modal de detalle (`PlanGastoDetailModal`), con confirmación. Anula el gasto (borrado lógico), quita sus partes y recalcula las deudas; la página recarga gastos y balances. Sin cambios en la base de datos.

### 5. Error al abrir el chat del plan ✅

**Qué pasaba:** al entrar en el chat de un plan salía `cannot add postgres_changes callbacks for realtime:msg:<id> after subscribe()`.

**Causa:** la página del plan y el chat se suscribían a un canal de Realtime con el mismo nombre, `msg:<chat_id>`. `supabase.channel(nombre)` no crea otro canal si ya existe uno con ese nombre: devuelve el mismo, ya suscrito, y los listeners `postgres_changes` solo se pueden añadir antes de `subscribe()`. Además, al salir del chat, `removeChannel` quitaba el canal compartido y la página dejaba de enterarse de los cambios de rol.

**Arreglo:** la página ya no usa ese canal. Detecta los cambios de rol con `postgres_changes` (`UPDATE` en `plan_usuarios`, que ya está en la publicación de Realtime) dentro de su propio canal. Es más fiable: antes dependía de un broadcast que enviaba el navegador de quien cambiaba el rol y solo desde el chat. Se quitan los dos envíos de `rol_change` del chat, que ya nadie escucha.

## Por revisar

Partes del flujo que aún no se han recorrido en dev (ver `TEST_PLAN.md` y `CHECKLIST.md`):

- [ ] Cambio de rol en vivo (fallo 5) con un segundo usuario: hacerle admin desde el chat y ver que su página se actualiza sin recargar.
- [ ] Perfil: editar nombre y foto, ajustes.
- [ ] Mis gastos: vista global de deudas y liquidaciones.
- [ ] Autenticación: recuperar contraseña, cerrar sesión, login con Google (no configurado en dev).
- [ ] Onboarding tras el registro (el checklist lo marca como bloqueador).
- [ ] Errores sin mostrar en el chat (bloqueador del checklist).
- [ ] Notificaciones push (bloqueador del checklist).
- [ ] Enlace de confirmación de email abierto en otro navegador: falla con `AuthPKCECodeVerifierMissingError` (visto en el log de dev).

## Pendiente de limpiar

- [ ] Dependabot: 135 vulnerabilidades en las dependencias de `main` (16 críticas, 69 altas, 44 moderadas, 6 bajas).
- [ ] `PlanPageClient.tsx` tiene 12 avisos de ESLint previos (imports y variables sin usar, `<img>` en lugar de `next/image`).
- [ ] Hay gastos sin opción de editar: `updateGastoEndpoint()` existe pero ninguna pantalla lo usa, y `fn_gasto_update` no acepta `p_receipt_url` aunque el endpoint lo envía.
