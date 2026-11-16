# Bloquear a una persona — diseño

Fecha: 2026-11-16 · Rama: `feat/bloquear`

## Por qué

Cuando una conversación se tuerce, lo primero que busca la gente es bloquear. Tiene que estar antes de abrir Frimee más allá de la beta.

## Objetivos

- Que puedas bloquear a alguien y deje de llegarte nada suyo, sin borrar nada.
- Que se pueda deshacer en el mismo sitio donde se bloqueó.

## Fuera de alcance

- **Reportar**: se quita del todo (nadie revisaría los reportes).
- **Seguir**: se oculta de la interfaz (botón «Seguir» y contadores de seguidores en el perfil). La tabla `seguidores` y su código se quedan: vuelven cuando vuelva la feed.
- Lista de «Personas bloqueadas» en Ajustes: no se hace.

## Lo que no debe pasar (anti-objetivos)

- Que bloquear borre chats, mensajes, amistades, gastos o actividades.
- Que el bloqueado pueda seguir escribiéndote llamando a la API directamente o con una app vieja.

## Cómo se comporta

Ejemplo: tú bloqueas a Marcos.

- **Amistad**: se mantiene. Al desbloquear, todo vuelve a estar como antes.
- **Chat 1 a 1**: sigue en las dos listas. Marcos puede seguir escribiendo como siempre (como en WhatsApp): a él le aparecen enviados, pero a ti no te llegan, ni en el chat, ni en tiempo real, ni como notificación o push, ni suben el contador de no leídos ni mueven el chat arriba en tu lista. Nunca le salen como leídos. Al desbloquear, lo que mandó durante el bloqueo sigue sin llegarte; lo nuevo sí.
- **Tu lado del 1 a 1**: donde escribes aparece «Has bloqueado a Marcos · Desbloquear». No puedes escribirle mientras esté bloqueado.
- **Grupos y planes compartidos**: los dos seguís dentro. Sus mensajes los ves como «Mensaje de una persona bloqueada». Sus gastos, actividades y votos se quedan como están.
- **Llamadas**: no te pueden llamar desde su 1 a 1 (a él le suena como si no contestaras).
- **Invitaciones**: no puede invitarte a planes ni añadirte a grupos nuevos.
- **Notificaciones**: no te llega ninguna generada por él.
- **«Amigos con los que hablar» y el buscador de amigos para empezar chat**: no aparece.
- **Tu foto de perfil**: Marcos deja de verla en todas partes (chat, listas, grupos, perfil); le sale el avatar por defecto, como en WhatsApp. Tú sí sigues viendo la suya. La base de datos se la devuelve vacía a él; la URL antigua que tuviera en caché no se puede revocar.
- **No se le avisa** de que está bloqueado.

## Dónde está el botón

En estos tres sitios pone «Bloquear», y cuando ya está bloqueado pasa a poner «Desbloquear»:

1. Menú de su perfil.
2. Zona roja de la info del chat 1 a 1.
3. Fila de la persona en la info de un grupo o plan.

Bloquear pide confirmación (sheet como las de «Vaciar el chat»). Desbloquear no.
Estilo: el de la zona roja que ya existe en la info del chat; sin tableros nuevos de Claude Design.

## Enfoques considerados

1. **Base de datos + app (elegido).** Tabla `bloqueos` (quién bloquea a quién). La base de datos impide lo importante (mensajes que no llegan, llamadas, invitaciones, notificaciones); la app pinta lo visible (aviso donde escribes, mensajes de grupo ocultos, listas). Protege aunque se use una app vieja o la API directa.
2. **Solo en la app.** Más rápido, pero no protege: cualquiera que llame a Supabase directamente seguiría escribiéndote. Descartado.
3. **Todo en la base de datos, también los grupos** (ocultar sus mensajes de grupo con RLS). No permitiría mostrar «Mensaje de una persona bloqueada» ni mantener las citas, y complica las consultas del chat. Descartado.

## Decisiones técnicas

- Tabla `bloqueos (bloqueador_id, bloqueado_id, created_at)`, sin acceso directo desde el cliente; solo funciones `security definer` (`fn_bloquear`, `fn_desbloquear`, y una para saber a quién tengo bloqueado).
- Mensajes 1 a 1 de un bloqueado: se guardan, pero marcados como ocultos para quien bloquea **en la base de datos** (RLS de `mensajes`), para que el realtime (`postgres_changes` en `ChatConversation`) tampoco se los entregue. Cómo marcarlos (columna en `mensajes` o `mensaje_oculto`) lo decide el plan, mirando el coste de la política RLS.
- Mensajes de grupo de un bloqueado: llegan normal y la app los sustituye por «Mensaje de una persona bloqueada».
- Llamadas, invitaciones, alta en grupos y notificaciones: se cortan en sus funciones y triggers actuales.
- Paso de publicación nuevo en `VERIFICACION_PUBLICACION.md` (2.32) con la migración.
- Pruebas: sección nueva en el tablero «Pruebas de Frimee».

## Lo que queda para el plan

- Lista exacta de funciones y triggers a tocar (envío, lista de chats, no leídos, lecturas, push, llamadas, invitaciones, grupos, amigos sugeridos, buscador).
- Textos exactos de las confirmaciones.
