# Verificación de la publicación: flujo principal y modo invitado

Lista para comprobar, paso a paso, que la rama `fix/flujo-principal` (PR #35) funciona antes y
después de publicarla. Cada comprobación tiene dos casillas:

- **Local**: `npm run dev` contra **frimee-dev**, en `http://localhost:3000`. Antes de publicar.
- **Live**: **frimee.es** y el proyecto de Supabase de producción. Justo después de publicar.

Si una comprobación falla en local, no se publica. Si falla en live, ver
[Si algo sale mal](#7-si-algo-sale-mal).

Las consultas SQL de esta lista son de solo lectura (`select`). En producción se lanzan desde
el SQL Editor del panel de Supabase.

---

## 1. Antes de tocar producción

| # | Comprobación | Live |
|---|---|---|
| 1.1 | `pg_cron` está activado (Database → Extensions). Lo necesita la limpieza de invitados. | [ ] |
| 1.2 | SMTP propio configurado (Authentication → Emails → SMTP Settings). | [ ] |
| 1.3 | Límites de Authentication → Rate Limits revisados: cada invitado que guarda su cuenta envía un email. | [ ] |
| 1.4 | Copia de seguridad hecha (Database → Backups, o `pg_dump`). | [ ] |
| 1.5 | Los usuarios anónimos siguen **desactivados** hasta el paso 4. | [ ] |
| 1.6 | La prueba local completa (secciones 4 y 5, columna Local) está toda en verde. | [ ] |

---

## 2. Migraciones en producción

Se aplican **una a una y en este orden**, pegando cada fichero en el SQL Editor. **No usar
`supabase db push`**: intentaría aplicar también la baseline (`20261026000000_*`), que es una
copia del esquema de producción. Después de cada una, su comprobación.

| # | Migración | Comprobación (debe dar) | Live |
|---|---|---|---|
| 2.1 | `20261027000000_sync_email_verified.sql` | `select count(*) from public.usuarios u join auth.users a on a.id = u.id where a.email_confirmed_at is not null and u.email_verified_at is null;` → **0** | [x] |
| 2.2 | `20261027000001_seed_categorias_gasto.sql` | `select count(*) from public.categorias_gasto;` → **25** o más (en producción ya existían) | [x] |
| 2.3 | `20261027000002_subplan_delete_permissions.sql` | `select pg_get_function_identity_arguments(p.oid) from pg_proc p where p.proname = 'fn_subplan_delete';` → **una sola fila**, con `p_delete_gastos boolean` · `select position('''ADMIN''' in pg_get_functiondef('public.fn_subplan_delete(bigint, boolean)'::regprocedure)) > 0;` → **true** | [x] |
| 2.4 | `20261027000003_guest_profiles.sql` | `select tgname from pg_trigger where tgname = 'on_auth_user_password_set';` → **1 fila** · `select public.fn_guest_email('00000000-0000-0000-0000-000000000000');` → `invitado-…@frimee.invalid` | [x] |
| 2.5 | `20261027000004_guest_demo_seed.sql` | `select has_function_privilege('anon', 'public.fn_guest_seed_demo()', 'execute');` → **false** | [x] |
| 2.6 | `20261027000005_guest_cleanup.sql` | `select jobname, schedule, active from cron.job where jobname = 'guest-cleanup';` → **1 fila, `30 3 * * *`, true** · `select has_function_privilege('authenticated', 'public.fn_guest_cleanup(interval)', 'execute');` → **false** | [x] |
| 2.7 | `20261027000006_plan_chat_welcome.sql` | `select tgenabled from pg_trigger where tgname = 'trg_chat_plan_welcome';` → **O** (activo) · `select has_function_privilege('authenticated', 'public.trg_chat_plan_welcome()', 'execute');` → **false** | [x] |
| 2.8 | `20261027000007_route_cache_modo.sql` | `select indexdef from pg_indexes where indexname = 'route_cache_origin_dest_modo_key';` → incluye **modo** · `select has_function_privilege('authenticated', 'public.sync_route_cache_from_subplan(bigint)', 'execute');` → **false** · `select count(*) from route_cache;` → **0** justo después de aplicarla · `select jobname, schedule, active from cron.job where jobname = 'route-cache-expire';` → **1 fila, `45 3 * * *`, true** | [x] |
| 2.9 | `20261108000001_lock_definer_functions.sql` | `select count(*) from pg_proc where proname in ('fn_debug2','fn_debug3','fn_debug4','fn_test_gastos');` → **0** · `select has_function_privilege('anon', 'public.fn_subplan_list(bigint)', 'execute');` → **false** · `select has_function_privilege('authenticated', 'public.fn_gasto_insert_partes(bigint, uuid, numeric, metodo_reparto, jsonb, jsonb)', 'execute');` → **false** · Después, en la app: abrir un plan, ver gastos y chat, guardar ajustes y crear un plan funcionan | [x] |
| 2.10 | `20261108000002_example_plan_for_new_users.sql` | `select position('Solo para invitados' in pg_get_functiondef('public.fn_guest_seed_demo()'::regprocedure)) = 0;` → **true** (la función sigue mencionando `is_anonymous` al crear los amigos de ejemplo) · En frimee.es, con una cuenta sin planes: Mis planes muestra «Tu primer viaje empieza aquí» y «Ver el ejemplo» abre el viaje a Lisboa | [x] |
| 2.11 | `20261108000003_guest_demo_long_trip.sql` (después de publicar el código que trae las fotos de `public/demo/lisboa`) | `select position('plan_fotos' in pg_get_functiondef('public.fn_guest_seed_demo()'::regprocedure)) > 0;` → **true** · Un invitado nuevo recibe el viaje Barcelona → Lisboa: 21 actividades, 13 fotos con su crédito al abrirlas | [x] |
| 2.12 | `20261108000004_plan_album.sql` | `select has_function_privilege('anon', 'public.fn_plan_album(bigint)', 'execute');` → **false** · `select has_function_privilege('authenticated', 'public.fn_plan_album(bigint)', 'execute');` → **true** | [x] |
| 2.13 | `20261108000005_account_delete_anonymize.sql` (antes de publicar el código: la ruta nueva llama a esta función) | `select has_function_privilege('authenticated', 'public.fn_account_delete(uuid)', 'execute');` → **false** · `select has_function_privilege('service_role', 'public.fn_account_delete(uuid)', 'execute');` → **true** · Después, con una cuenta de prueba con un plan compartido: Ajustes → Eliminar cuenta funciona, el plan sigue para los demás con «Usuario eliminado» y se puede registrar otra vez con el mismo email | [x] |
| 2.14 | `20261108000006_subplan_admin_only.sql` | `select position('''ADMIN''' in pg_get_functiondef('public.fn_subplan_create'::regproc)) > 0;` → **true** · `select position('''ADMIN''' in pg_get_functiondef('public.fn_subplan_update'::regproc)) > 0;` → **true** · Después, en la app: el admin crea y edita actividades; un participante sigue viendo el itinerario y su mapa | [x] |
| 2.15 | `20261108000007_rls_no_recursion.sql` | `select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'subplan';` → **1 fila** · `select has_function_privilege('anon', 'public.is_plan_participant(bigint)', 'execute');` → **false** · Después, con dos cuentas en el mismo plan: lo que una cambia en el itinerario o en los miembros le aparece a la otra sin recargar | [x] |
| 2.16 | `20261108000008_calls_hardening.sql` (antes de publicar el código: usa los estados y funciones nuevos) | `select jobname, schedule, active from cron.job where jobname = 'llamadas-expire';` → **1 fila, `*/5 * * * *`, true** · `select count(*) from llamadas where estado = 'ringing' and iniciada_at < now() - interval '2 minutes';` → **0** · `select has_function_privilege('anon', 'public.fn_call_info(uuid)', 'execute');` → **false** · Después, con dos cuentas: llamar y colgar mientras suena (al otro le deja de sonar), rechazar (quien llama lo ve), contestar | [x] |
| 2.17 | `20261109000001_call_push.sql` + desplegar `send-push` y `call-action` (antes de publicar la app Android de la fase 4 de llamadas) | Antes: en Edge Functions → Secrets, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` (ya están en producción) · `npx supabase functions deploy send-push --remote=fgbsmdktvnshwwmlrdih` · `npx supabase functions deploy call-action --no-verify-jwt --remote=fgbsmdktvnshwwmlrdih` · `select tgname from pg_trigger where tgname = 'trg_call_push';` → **1 fila** · `select has_function_privilege('authenticated', 'public.fn_call_decline(bigint, uuid)', 'execute');` → **false** · Después, con la app Android cerrada y el móvil bloqueado: una llamada suena a pantalla completa; «Rechazar» avisa a quien llama; «Contestar» abre la sala; durante la llamada, fuera de la app, sigue el audio y sale «Llamada en curso» | [x] |

---

## 3. Publicar

| # | Paso | Live |
|---|---|---|
| 3.0 | Desplegar `frimee-assistant` con el arreglo de las respuestas (`npx supabase functions deploy frimee-assistant --remote=fgbsmdktvnshwwmlrdih`). Sin sesión debe seguir dando 401. | [x] |
| 3.1 | Fusionar la PR #35 en `main`. | [ ] |
| 3.2 | El despliegue de Vercel termina en verde y apunta al commit de la fusión. | [ ] |
| 3.3 | frimee.es carga, y en la consola del navegador no hay errores nuevos. | [ ] |

---

## 4. Modo invitado

Activar primero los anónimos en producción (Authentication → Sign In / Providers → Allow
anonymous sign-ins). En local ya lo están. Probar en una **ventana de incógnito**.

| # | Comprobación | Local | Live |
|---|---|---|---|
| 4.1 | En `/login` aparece **"Probar como invitado"**. | [x] | [ ] |
| 4.2 | Al pulsarlo, entra sin pedir datos y lleva al plan **"Escapada a Lisboa"**, con fecha dentro de 7 días. | [x] | [ ] |
| 4.3 | El plan tiene **7 actividades** con lugares reales, **3 amigos** (Lucía, Marcos y Ana), **4 gastos** con sus deudas y **4 mensajes** en el chat, más el **mensaje de bienvenida de Frimee** al final, que explica cómo usar `@frimee` (los planes creados antes de este cambio no lo tienen). | [x] | [ ] |
| 4.4 | El mapa del día dibuja las **rutas** entre actividades. | [ ] | [ ] |
| 4.5 | Arriba aparece el **aviso de invitado** con la opción de guardar la cuenta. | [ ] | [ ] |
| 4.6 | Recargar la página mantiene la sesión y **no duplica** el plan de ejemplo. | [ ] | [ ] |
| 4.7 | El asistente responde a `@frimee hola` siendo invitado. | [ ] | [ ] |
| 4.8 | Cupo de llamadas: la **tercera** llamada de un invitado en el mismo día da error de límite (429). | [ ] | [ ] |
| 4.9 | Cupo de OCR: el **cuarto** ticket escaneado de un invitado da error de límite. Solo en local: en live cada lectura cuesta dinero en OpenAI. | [ ] | — |
| 4.10 | **Guardar mi cuenta**: nombre y email → llega el email de confirmación. | [ ] | [ ] |
| 4.11 | Abrir el enlace **en el mismo navegador** → confirma y pide la contraseña. | [ ] | [ ] |
| 4.12 | Abrir el enlace **en otra ventana** → "Email confirmado, vuelve a la ventana donde estabas"; al volver, pide la contraseña. | [ ] | [ ] |
| 4.13 | Tras poner la contraseña: cerrar sesión y entrar con email y contraseña → sigue teniendo el plan de Lisboa. El aviso ya no aparece. | [ ] | [ ] |
| 4.14 | La cuenta convertida tiene el nombre y el email reales (no `invitado-…@frimee.invalid`) en su perfil. | [ ] | [ ] |
| 4.15 | Un invitado que ya no existe (borrado por la limpieza) vuelve a `/login` al abrir la app, sin quedarse colgado. Solo en local: borrar uno a mano en dev. | [ ] | — |
| 4.16 | En el chat del plan, encima del campo de texto salen **3 sugerencias** (✨ "¿Qué tiempo hará?", "¿Cómo vamos de cuentas?", "Ideas para cenar") y el placeholder menciona `@frimee`. | [ ] | [ ] |
| 4.17 | Pulsar una sugerencia envía `@frimee …` y el asistente contesta **solo con texto**, sin JSON ni `\n` visibles. Después, las sugerencias desaparecen. | [ ] | [ ] |
| 4.18 | Cerrarlas con la × las oculta también al recargar. En un chat que no es de plan no aparecen. | [ ] | [ ] |

---

## 5. Lo que ya existía (que no se ha roto)

Con una cuenta normal. Para las pruebas de tiempo real hacen falta **dos cuentas** en dos
navegadores distintos (o uno normal y otro de incógnito).

| # | Comprobación | Local | Live |
|---|---|---|---|
| 5.1 | Registro con email nuevo → al confirmar, el perfil queda verificado (fallo 1). | [ ] | [ ] |
| 5.2 | Iniciar sesión, cerrar sesión y recuperar contraseña. | [ ] | [ ] |
| 5.3 | Crear un gasto en un plan (fallo 2). | [ ] | [ ] |
| 5.4 | Eliminar un gasto: desaparece y las deudas se recalculan (fallo 4). | [ ] | [ ] |
| 5.5 | Editar una actividad creada por **otro** participante. | [ ] | [ ] |
| 5.6 | Eliminar una actividad **sin** gastos (fallo 3). | [ ] | [ ] |
| 5.7 | Eliminar una actividad **con** gastos: sin marcar el tick, los gastos se mantienen; marcándolo, se anulan y las deudas cambian. | [ ] | [ ] |
| 5.8 | Abrir el chat del plan y cambiar a otro chat y volver: **ningún error** en la consola (`cannot add postgres_changes callbacks`). | [ ] | [ ] |
| 5.9 | Mensajes en tiempo real: lo que escribe una cuenta aparece en la otra sin recargar. | [ ] | [ ] |
| 5.10 | Encuestas: votar desde una cuenta y ver el voto en la otra. | [ ] | [ ] |
| 5.11 | Cambio de rol en vivo: hacer admin a la otra cuenta desde el chat; su página se actualiza sin recargar (fallo 5). | [ ] | [ ] |
| 5.12 | `@frimee` responde en el chat de un plan (con sesión). | [ ] | [ ] |
| 5.13 | Llamada de voz o vídeo entre las dos cuentas. | [ ] | [ ] |
| 5.14 | Feed: ver publicaciones, dar like y comentar. | [ ] | [ ] |
| 5.15 | Notificaciones: llega el aviso de un mensaje nuevo. | [ ] | [ ] |
| 5.16 | Crear un plan nuevo con destino (p. ej. "Roma, Italia") y abrir su chat: el primer mensaje es de **Frimee** y dice "el tiempo en **Roma**". No llega ninguna notificación push por ese mensaje. | [x] | [ ] |
| 5.17 | Abrir un plan desde **Mis planes**, ir a su **Chat** y pulsar otra vez **Mis planes** (o Feed, Mensajes…) en la barra lateral: la capa del plan **se cierra** y se ve la página nueva. Lo mismo desde el panel de notificaciones. | [ ] | [ ] |
| 5.18 | **Mis planes** en un portátil (p. ej. 1440 × 900): el calendario del mes se ve **entero** sin hacer scroll, con las barras de los planes legibles. | [ ] | [ ] |
| 5.19 | En **Mis planes**, vista **Semana** del lateral: 7 filas (lu–do) con los planes de cada día, "Sin planes" en los días vacíos y la de hoy resaltada. Pulsar un día abre **Día**; pulsar un plan lo abre. Las flechas cambian de semana. | [ ] | [ ] |
| 5.20 | Vista **Día** de un día con actividades (p. ej. el primer día del plan de Lisboa): cada actividad sale **en su franja horaria** con su hora y el nombre del plan, en el lateral y en el calendario ampliado. Pulsarla abre el plan. Las vistas Año, Mes y Semana siguen mostrando solo planes. | [ ] | [ ] |

---

## 6. Seguridad (sin sesión)

Las puede lanzar cualquiera desde la terminal con la clave pública; ninguna escribe nada.

| # | Comprobación | Local | Live |
|---|---|---|---|
| 6.1 | `frimee-assistant` sin sesión → **401 "No autorizado"**. | [x] | [ ] |
| 6.2 | `rpc/fn_guest_seed_demo` sin sesión → **permission denied**. | [x] | [ ] |
| 6.3 | `rpc/fn_guest_cleanup` sin sesión → **permission denied** o **no encontrada**: nadie puede borrar invitados desde fuera. | [x] | [ ] |

---

## Fallos encontrados durante la verificación

| Dónde | Fallo | Arreglo | Estado |
|---|---|---|---|
| Gastos → "Confirmar pago" | El modal era transparente: usaba `bg-surface-1`, una clase que no existe en el tema. La zona del comprobante tampoco cambiaba al pasar el ratón (`hover:bg-surface-3`, tampoco existe). | `bg-app`, como los otros 8 modales, y `hover:bg-surface`. | Arreglado en local |
| Calendario → **Día** (lateral y calendario ampliado) | Las actividades de los planes (subplanes) no aparecían en sus horas: la vista Día solo pintaba los planes. | Al entrar en Día se cargan las actividades de los planes de ese día (`fetchSubplanes`, con caché por plan) y se pintan en su franja: bloque claro con borde de color, hora y nombre del plan. Las de todo el día van en "todo el día". En el lateral, el scroll baja hasta la primera actividad. | Arreglado en local |
| Mis planes → calendario → **Semana** (escritorio) | En el lateral, "Semana" mostraba la misma columna de horas que "Día": el código solo distinguía año, mes y "lo demás" (el día). La semana de 7 columnas solo existía en el calendario ampliado. | `SidebarWeekAgenda`: la semana como agenda, una fila por día (lu–do) con sus planes; los que tienen hora la muestran delante. Pulsar el día abre la vista Día. Se probó también la versión en 7 columnas con horas y no cabe bien en ~360 px. | Arreglado en local |
| Mis planes → calendario (escritorio) | La vista de mes no cabía en la pantalla: medía 720 px y empezaba a 221 px, así que se salía 40 px en 1440 × 900 y 172 px en 1366 × 768. | Filas más compactas solo en el lateral de escritorio: menos margen por semana, día de 24 px y barras de 18 px (`CALENDAR_PLAN_PILL_SIDEBAR_CLASS`). Ahora mide 574 px: cabe en 1440 × 900 y en 1366 × 768 sobran 26 px (el lateral es sticky). | Arreglado en local |
| Plan abierto como capa → barra lateral | Desde el chat de un plan, pulsar "Mis planes" cambiaba la URL pero el plan y su chat seguían encima. El plan se abre como capa en la ruta paralela `@modal` (`(.)plans/[id]`), y en una navegación sin recarga Next.js mantiene lo que había en el hueco si la URL nueva no tiene nada en él (`default.tsx` solo cuenta en una carga completa). | `@modal/[...catchAll]/page.tsx` devuelve `null`: cualquier otra ruta vacía el hueco y cierra la capa. Las rutas interceptadas, más específicas, siguen ganando. `build-mobile.mjs` lo aparta del build estático, como hace con las interceptadas. | Arreglado en local |
| Chat | No había ninguna pista de que existe el asistente `@frimee`. | Sugerencias encima del campo y placeholder que lo menciona (chats de plan), y mensaje de bienvenida de Frimee **en todos los chats de plan nuevos**, con el destino del viaje (trigger `trg_chat_plan_welcome`, migración `20261027000006`; también lo usa el plan de ejemplo de los invitados). El autocompletado al escribir `@` queda para más adelante. | Hecho en local y dev |
| Itinerario | Un trayecto "A pie" mostraba el resultado en coche (Jerónimos → Alfama: 12,9 km en 34 min). `route_cache` solo usaba coordenadas como clave. | Columna `modo` (APIE/COCHE/BUS/METRO/TREN; taxi = coche) en la clave de la caché, en `/api/directions`, en la lectura nativa y en el trigger; bus, metro y tren piden a Google ese vehículo (`transit_mode`); caché vaciada y trayectos no en coche recalculados (migración `20261027000007`). | Hecho en local y dev |
| Seguridad | 29 funciones con permisos totales se podían llamar sin sesión y sin comprobar quién llamaba: cambiar ajustes o perfil de cualquiera, crear planes o mandar recordatorios en nombre de otro, leer itinerario, gastos, deudas, miembros o chat de cualquier plan, y ver el código para unirse a planes privados. | Migración `20261108000001`: borra las de depuración, deja las internas sin acceso desde fuera, añade la comprobación (miembro del plan o chat; tú mismo para tus datos) y quita `anon`. Probado en dev con un miembro, un ajeno y la app completa. | Hecho en dev |
| Itinerario → permisos | Crear y editar actividades solo lo impide la interfaz (los botones son de admin); en la base de datos `fn_subplan_create` y `fn_subplan_update` dejan a cualquier participante. Borrar ya es solo de admins (2.3). Además, `fn_subplan_create` no comprobaba nada: cualquiera con sesión podía añadir actividades a un plan ajeno. | Migración `20261108000006`: crear y editar solo para admins del plan. Guardar la ruta calculada y cambiar el transporte siguen para miembros (la app se los ofrece a todos). Probado en dev: admin, participante y ajeno. | Hecho en dev |
| Auth → emails (producción) | No salía ningún email de Supabase Auth desde abril (recuperar contraseña daba 500, y tampoco llegaban las confirmaciones de registro). El remitente SMTP era una dirección `@cayeyeste.com`, dominio no verificado en Resend: `550 The cayeyeste.com domain is not verified`. | Remitente `no-reply@frimee.es` (dominio verificado en Resend) en Authentication → Emails → SMTP Settings. | Arreglado en producción |
| Auth → recuperar contraseña (producción) | El enlace del email iniciaba sesión en la portada en vez de abrir `/reset/`: esa URL no estaba en Redirect URLs, así que Supabase ignoraba `redirect_to` y usaba la Site URL. | Añadidas `https://www.frimee.es/reset/`, `https://frimee.es/reset/` y `http://localhost:3000/reset/` en Authentication → URL Configuration. | Arreglado en producción |
| Ajustes → Eliminar cuenta | Falla para cualquiera que haya creado un plan, una actividad o un gasto: `/api/account/delete` borra el usuario de Auth y 14 tablas (`plan`, `subplan`, `gastos`, `liquidaciones`…) tienen `RESTRICT` hacia él. Si no tiene nada, se borra, pero no puede volver a entrar (ya no existe en Auth) ni registrarse con el mismo email durante 30 días (el perfil inactivo lo ocupa). Los «30 días para arrepentirse» no funcionan. | Se anonimiza en vez de borrar de Auth (`fn_account_delete`, migración `20261108000005`): planes solo suyos, borrados; planes compartidos sin deudas pendientes, sale de ellos; con deudas, queda como «Usuario eliminado» para que cuadren; si era el último admin, pasa a admin el miembro más antiguo. Datos personales, sesiones, métodos de acceso, foto de perfil y billetes, borrados; el email queda libre al momento. Probado en dev con 3 usuarios y los 3 casos. | Hecho en local y dev |
| Mis planes (usuario nuevo) | Una cuenta sin planes veía una pantalla vacía. | `EmptyPlansWelcome`: crear plan, unirse pegando el enlace de invitación (también `?code=` en la app nativa) y «Ver el ejemplo» (migración `20261108000002`: el plan de ejemplo ya no es solo para invitados). | Hecho en local y dev |
| Login, registro, recuperar | «Al continuar, aceptas los Términos…» no enlazaba a nada, y frimee.es/politica-de-privacidad daba 404: las páginas solo existían en la landing, que no está en ese dominio. | Páginas `/terminos-y-condiciones` y `/politica-de-privacidad` en la app con el **texto revisado de la landing palabra por palabra** (01/05/2026, responsables Victoria Martín y Cayetano Yeste), enlazadas desde las pantallas de acceso. Pendiente: la «Política de Cookies» a la que remiten no existe. | Hecho |
| Login con contraseña incorrecta | Salía la pantalla de carga de la F y volvía al formulario. Tras muchos intentos, el aviso de Supabase salía en inglés. | El formulario se queda con «Entrando...»; 429 → «Demasiados intentos seguidos…». | Hecho en local |
| Chat → `@frimee` crea una encuesta | La encuesta salía encima del mensaje de Frimee que la presenta: la app guardaba la encuesta antes que la respuesta. | `ChatConversation`: primero se guarda la respuesta y después la encuesta. | Hecho en local y dev |
| Modo invitado → plan de ejemplo | Era el viaje corto (7 actividades, sin fotos). | El viaje completo Barcelona → Lisboa con 13 fotos (migración `20261108000003`). Las fotos de Wikimedia muestran autor y licencia en el visor y una nota bajo la cuadrícula. | Hecho en local y dev |
| Itinerario y miembros en tiempo real | Los cambios de otros miembros no llegaban en directo. Las políticas de lectura de `plan` y `plan_usuarios` se consultaban entre sí (*infinite recursion detected*), y `subplan` no estaba publicada en Realtime. La app lee por funciones `security definer`, así que solo se notaba en el tiempo real. | Migración `20261108000007`: las políticas usan `is_plan_member()` / `is_plan_participant()` (nueva) y `subplan` entra en la publicación. Probado en dev con una suscripción real: los dos avisos llegan, y un ajeno no lee nada del plan. | Hecho en dev |
| Llamadas | Colgar, rechazar o perder una llamada nunca se guardaba (`void supabase.from(...).update(...)` no ejecuta la consulta): 35 llamadas atascadas en «sonando» en producción, al otro le seguía sonando y quien llamaba no se enteraba del rechazo. Una llamada entrante cortaba la que tenías. Sin tiempo límite de tono. Si quien contestaba entraba antes de que el otro terminara de conectarse, este se quedaba en «Llamando…». El token de LiveKit servía para salas de otros chats; `fn_llamada_record` escribía en cualquier chat. | Migración `20261108000008` (estados `rejected`/`busy`, `fn_call_info`, comprobación en `fn_llamada_record`, limpieza cada 5 min) y `useCall`/`CallProvider`/`CallRoom`/ruta del token: 45 s de tono, aviso del motivo, «ocupado», sala de su chat, vídeo adaptativo, conexión en paralelo. Probado en dev con 3 navegadores y LiveKit real: 29/29. | Hecho en local y dev |
| Chat → `@frimee` | La respuesta salía en bruto: `{"command": null, "reply": "…"}` con `\n` visibles y basura final (`</budget:` y `}`). El modelo a veces añade texto tras el JSON, y la función lo buscaba con `/\{[\s\S]*\}/`, de la primera `{` a la última `}`. | `parseAssistantReply()` en `frimee-assistant`: toma el primer objeto JSON completo (cuenta llaves fuera de las cadenas), escapa los saltos de línea reales dentro de las cadenas e ignora lo que venga después. 7 casos probados, incluido el real. | Desplegado en dev; **pendiente de desplegar en producción** |

---

## 7. Si algo sale mal

| Qué falla | Qué hacer |
|---|---|
| La web nueva tiene un fallo grave | Vercel → Deployments → el despliegue anterior → **Instant Rollback**. La base de datos nueva es compatible con la app anterior. |
| El modo invitado da problemas | Desactivar los usuarios anónimos en Authentication → Sign In / Providers. La app normal sigue funcionando. |
| La limpieza de invitados borra de más | `select cron.unschedule('guest-cleanup');` y revisar con calma. |
| La caducidad de la caché de rutas da problemas | `select cron.unschedule('route-cache-expire');` (solo deja de vaciar la caché; no toca los planes). |
| Una migración falla a medias | Parar: no aplicar las siguientes ni fusionar la PR. Cada fichero se puede revisar y repetir. |
