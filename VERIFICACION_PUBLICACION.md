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
| 2.1 | `20261027000000_sync_email_verified.sql` | `select count(*) from public.usuarios u join auth.users a on a.id = u.id where a.email_confirmed_at is not null and u.email_verified_at is null;` → **0** | [ ] |
| 2.2 | `20261027000001_seed_categorias_gasto.sql` | `select count(*) from public.categorias_gasto;` → **25** o más (en producción ya existían) | [ ] |
| 2.3 | `20261027000002_subplan_delete_permissions.sql` | `select pg_get_function_identity_arguments(p.oid) from pg_proc p where p.proname = 'fn_subplan_delete';` → **una sola fila**, con `p_delete_gastos boolean` | [ ] |
| 2.4 | `20261027000003_guest_profiles.sql` | `select tgname from pg_trigger where tgname = 'on_auth_user_password_set';` → **1 fila** · `select public.fn_guest_email('00000000-0000-0000-0000-000000000000');` → `invitado-…@frimee.invalid` | [ ] |
| 2.5 | `20261027000004_guest_demo_seed.sql` | `select has_function_privilege('anon', 'public.fn_guest_seed_demo()', 'execute');` → **false** | [ ] |
| 2.6 | `20261027000005_guest_cleanup.sql` | `select jobname, schedule, active from cron.job where jobname = 'guest-cleanup';` → **1 fila, `30 3 * * *`, true** · `select has_function_privilege('authenticated', 'public.fn_guest_cleanup(interval)', 'execute');` → **false** | [ ] |
| 2.7 | `20261027000006_plan_chat_welcome.sql` | `select tgenabled from pg_trigger where tgname = 'trg_chat_plan_welcome';` → **O** (activo) · `select has_function_privilege('authenticated', 'public.trg_chat_plan_welcome()', 'execute');` → **false** | [ ] |
| 2.8 | `20261027000007_route_cache_modo.sql` | `select indexdef from pg_indexes where indexname = 'route_cache_origin_dest_modo_key';` → incluye **modo** · `select has_function_privilege('authenticated', 'public.sync_route_cache_from_subplan(bigint)', 'execute');` → **false** · `select count(*) from route_cache;` → **0** justo después de aplicarla · `select jobname, schedule, active from cron.job where jobname = 'route-cache-expire';` → **1 fila, `45 3 * * *`, true** | [ ] |

---

## 3. Publicar

| # | Paso | Live |
|---|---|---|
| 3.0 | Desplegar `frimee-assistant` con el arreglo de las respuestas (`npx supabase functions deploy frimee-assistant --remote=fgbsmdktvnshwwmlrdih`). Sin sesión debe seguir dando 401. | [ ] |
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
