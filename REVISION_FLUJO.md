# Revisión del flujo principal

Fallos encontrados al recorrer la app contra el proyecto de Supabase de desarrollo (`frimee-dev`), con su causa y su arreglo.

Estado: ✅ arreglado y probado en dev · ⏳ pendiente de aplicar en producción · 🔲 pendiente

## Pendiente en producción

Las migraciones se prueban primero en dev. Al fusionar la rama, aplicar en producción en este orden:

- [ ] `supabase/migrations/20261027000000_sync_email_verified.sql`
- [ ] `supabase/migrations/20261027000001_seed_categorias_gasto.sql` (no cambia nada en producción: las filas ya existen)
- [ ] `supabase/migrations/20261027000002_subplan_delete_permissions.sql`
- [ ] `supabase/migrations/20261027000003_guest_profiles.sql`
- [ ] `supabase/migrations/20261027000004_guest_demo_seed.sql`
- [ ] `supabase/migrations/20261027000005_guest_cleanup.sql` (crea la tarea `guest-cleanup` de pg_cron)
- [ ] Desplegar la Edge Function `frimee-assistant` (fallo 6). Es compatible con la app actual: la app ya envía el token.

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

### 6. El asistente confiaba en el usuario y el plan que enviaba el navegador ✅ ⏳

**Qué pasaba:** la Edge Function `frimee-assistant` leía `userId`, `isAdmin` y `planId` del cuerpo de la petición. Con las herramientas del navegador se podía mandar un `userId` inventado en cada mensaje (cupo de IA ilimitado, a cargo de Frimee) o un `planId` ajeno: la función usa la service role key, que se salta RLS, y le pasaba a la IA las actividades e información de ese plan.

**Causa:** la identidad no salía del token de sesión, que `supabase.functions.invoke` ya envía en la cabecera `Authorization`.

**Arreglo:** el usuario sale de `auth.getUser(token)` (401 si no hay sesión), el rol de `plan_usuarios` y, si no eres miembro del plan, 403. Los invitados tienen además una bolsa común diaria de 200 mensajes. Pendiente de desplegar.

### 7. Ningún plan se podía borrar ✅ ⏳

**Qué pasaba:** al probar la limpieza de invitados, borrar un plan fallaba con "No puedes eliminar al último ADMIN del plan".

**Causa:** `trg_planusuarios_cannot_remove_last_admin` impide quitar al último admin de un plan. Al borrar el plan entero, la cascada borra sus miembros y el trigger lo bloqueaba también. La app hoy no borra planes físicamente, así que no se notaba.

**Arreglo** (en `20261027000005_guest_cleanup.sql`): si el plan ya no existe (la cascada se ejecuta después de borrar la fila del plan), el trigger deja pasar el borrado. Probado: quitar al último admin sin borrar el plan sigue dando error.

### 8. "Eliminar mi cuenta" no borra los datos personales 🔲

**Qué pasa:** `/api/account/delete` borra el usuario de `auth.users`, pero `trg_usuarios_soft_delete` intercepta el borrado en cascada de `usuarios`: marca el perfil `INACTIVA` y devuelve `NULL`, que cancela el borrado sin dar error. El perfil queda huérfano con nombre, email y foto.

**Impacto:** el derecho de supresión (RGPD) no se cumple, y esa persona no podría volver a registrarse con el mismo email (`usuarios.email` es `UNIQUE`). En producción hay 1 perfil así de 45. Además, un usuario que haya creado planes o gastos no podría borrar su cuenta: esas FK a `auth.users` son `RESTRICT`.

**Hecho:** solo para invitados (email `@frimee.invalid`) el trigger deja pasar el borrado físico.

**Pendiente de decidir:** qué hacer con las cuentas reales. Opción probable: anonimizar el perfil (vaciar nombre, email y foto) y conservar gastos y mensajes como "Usuario eliminado" para no romper los planes de los demás.

## Modo invitado

Usuarios anónimos de Supabase (`signInAnonymously()`). Decisiones: cupo diario pequeño en lo que cuesta dinero, cuentas borradas a los 7 días y opción de convertir la cuenta en una real conservando los datos.

- [x] **Perfil del invitado** (`20261027000003_guest_profiles.sql`): los triggers de `auth.users` exigían email y `usuarios.email` es `NOT NULL UNIQUE`, así que entrar como invitado fallaba. Ahora reciben `invitado-<id>@frimee.invalid` (`.invalid` es un dominio reservado, RFC 2606) y, al convertir la cuenta, el email real lo sustituye. Probado en dev: crear, actualizar metadatos y convertir.
- [x] **Anónimos activados en `frimee-dev`** (Authentication → Sign In / Providers). En producción, todavía no.
- [x] **Cupos diarios** (`src/lib/rate-limit.ts` → `checkGuestDailyLimit`): por invitado y una bolsa común para todos (OCR de tickets y recibos 3/100, LiveKit 2/50). El asistente ya tenía 5 mensajes al día por usuario gratuito y suma una bolsa común de 200. Probado en dev: la tercera petición a LiveKit de un invitado da 429.
- [x] **Plan de ejemplo** (`20261027000004_guest_demo_seed.sql` → `fn_guest_seed_demo()`): "Escapada a Lisboa" dentro de 7 días con 3 amigos ficticios (Lucía, Marcos y Ana, usuarios anónimos marcados con `demo_friend_of`), 7 actividades con coordenadas reales, 4 gastos repartidos a partes iguales con sus deudas y 4 mensajes en el chat. Lo llama la app después de `signInAnonymously()` (no el trigger de registro, para que un fallo no impida entrar). Solo invitados, una vez por invitado. Las rutas del mapa salen de `route_cache` a partir del primer invitado. Probado en dev por la API REST con un token de invitado: plan creado, segunda llamada sin duplicados y sin sesión → `permission denied`.
- [x] **Borrado automático** (`20261027000005_guest_cleanup.sql` → `fn_guest_cleanup()`, tarea `guest-cleanup` de pg_cron a las 03:30 UTC): borra los invitados de más de 7 días, sus amigos ficticios y sus datos. Como 15 FK a `auth.users` son `RESTRICT`/`NO ACTION`, primero borra sus planes (cascada) y lo que dejaron en planes ajenos, recalculando las deudas de esos planes. Cada invitado va en su propia subtransacción: si uno falla, se anota un aviso y se sigue. Sin permiso de ejecución para `anon`/`authenticated` (si no, cualquiera podría borrar a todos los invitados). Probado en dev con `rollback`: 3 invitados y 3 amigos borrados, 0 perfiles huérfanos, el usuario real y su plan intactos y llamada por la API → `permission denied`. La tarea queda activa en dev.
- [x] **Botón "Probar como invitado"** en `/login` (`src/services/auth/guest.ts` → `startGuestSession`): entra como anónimo, crea el plan de ejemplo y lleva a él. La página de login no redirige por su cuenta mientras se crea el plan.
- [x] **Aviso y "Guardar mi cuenta"** (`src/components/auth/GuestBanner.tsx`): pastilla flotante arriba con tres estados: invitado → pide nombre y email (`updateUser`, Supabase manda un email de confirmación); email pendiente de confirmar; email confirmado → pide la contraseña (Supabase solo deja ponerla después de confirmar; se marca con `pending_password` en los metadatos). Al confirmar, el trigger cambia a la vez el email y el nombre de relleno por los reales. El enlace hay que abrirlo en el mismo navegador (PKCE). Probado el trigger en dev con `rollback`: pedir, confirmar y editar el nombre después.
- [x] **Invitado ya borrado** (`AuthGuard`): la sesión guardada en el navegador puede parecer válida hasta una hora; para invitados se pregunta al servidor (`getUser`) y, si ya no existe, se cierra la sesión y se vuelve a `/login`.
- [x] **Enlace de confirmación abierto en otra ventana** (probado en el navegador): Supabase confirma el email en su servidor, pero el intercambio PKCE falla fuera del navegador que empezó el proceso. Ahora `/auth/callback` muestra "Email confirmado, vuelve a la ventana donde estabas", y la ventana del invitado renueva su token (`refreshSession`) al recuperar el foco, así que ve la cuenta confirmada y se le abre "Pon tu contraseña".
- [x] **Contraseña puesta por otra vía** (probado en el navegador: "¿Has olvidado tu contraseña?" seguía pidiéndola): el trigger `on_auth_user_password_set` (`BEFORE UPDATE` en `auth.users`) quita `pending_password` siempre que cambia la contraseña, venga de donde venga.
- [ ] Repetir la prueba completa en el navegador con estos dos arreglos.
- Nota: `frimee-dev` usa el correo de serie de Supabase (unos 2 correos por hora para todo el proyecto) y salta `email rate limit exceeded` enseguida. Producción tiene SMTP propio. Si molesta, configurar en dev el mismo proveedor (Authentication → Emails → SMTP Settings). Con SMTP propio sigue aplicando el tope de Authentication → Rate Limits; revisarlo antes de abrir el modo invitado al público.

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

- [ ] `frimee-assistant` tiene 5 errores de tipos previos (`deno check`): importa `supabase-js@2` de esm.sh sin fijar versión.
- [ ] Dependabot: 135 vulnerabilidades en las dependencias de `main` (16 críticas, 69 altas, 44 moderadas, 6 bajas).
- [ ] `PlanPageClient.tsx` tiene 12 avisos de ESLint previos (imports y variables sin usar, `<img>` en lugar de `next/image`).
- [ ] Hay gastos sin opción de editar: `updateGastoEndpoint()` existe pero ninguna pantalla lo usa, y `fn_gasto_update` no acepta `p_receipt_url` aunque el endpoint lo envía.
