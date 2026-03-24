# Frimee — Test Plan

> Estado: 🔲 Sin probar · ✅ OK · ❌ Falla · ⚠️ Parcial

---

## 1. FEED (`/feed`)

### 1.1 Carga inicial
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.1.1 | Primera carga sin caché | Skeleton → posts aparecen | ⚠️ Fix aplicado: imagen hacía pop, ahora con fade-in |
| 1.1.2 | Carga con caché (<5min) | Posts aparecen instantáneamente, luego refresca en background | ✅ Fix aplicado: shimmer por imagen + aspect-ratio reservado |
| 1.1.3 | Sin publicaciones en "Siguiendo" | Mensaje "Aun no hay publicaciones para mostrar" | ✅ |
| 1.1.4 | Sin conexión / error de red | No crash, mensaje de error o posts vacíos | ❌ Sin PWA/service worker la app no carga offline. Feature pendiente si se quiere soporte offline |

### 1.2 Tabs
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.2.1 | Click en "Explorar" | Tab activo cambia, underline se mueve | ✅ |
| 1.2.2 | Click en "Siguiendo" | Tab activo cambia, underline vuelve | ✅ |
| 1.2.3 | Resize ventana con tab activo | Underline se reposiciona correctamente | ✅ |

### 1.3 Post con imagen
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.3.1 | Imagen carga correctamente | Se muestra con overlay superior e inferior | ✅ |
| 1.3.2 | Avatar del autor visible | Foto o inicial de letra en círculo | ✅ |
| 1.3.3 | Click en nombre del autor | Navega a `/profile/{id}` | ✅ |
| 1.3.4 | Localización del plan visible | Texto en overlay inferior | ✅ |
| 1.3.5 | Rango de fechas correcto (mismo día) | Muestra solo una fecha | ✅ |
| 1.3.6 | Rango de fechas correcto (varios días) | "DD Mon – DD Mon" | ✅ |

### 1.4 Post sin imagen (estilo Twitter)
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.4.1 | Layout en columna (avatar izq + contenido dcha) | Correcto sin imagen de fondo | ✅ Verificado en código |
| 1.4.2 | Texto de descripción visible | Se muestra completo | ✅ Verificado en código |

### 1.5 Like
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.5.1 | Dar like a un post | Icono se rellena, contador +1, animación scale | ✅ |
| 1.5.2 | Quitar like | Icono vuelve a outline, contador -1 | ✅ |
| 1.5.3 | Like en post propio | Funciona pero NO genera notificación | ✅ Verificado en código |
| 1.5.4 | Like en post ajeno | Dueño recibe notificación de tipo `like` | ✅ Verificado en código |
| 1.5.5 | Doble click rápido | No genera estado inconsistente (loading guard) | ✅ |

### 1.6 Comentarios
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.6.1 | Click icono comentario | Sección se expande | ✅ |
| 1.6.2 | Click de nuevo | Sección se colapsa | ✅ |
| 1.6.3 | Escribir y enviar comentario (Enter) | Comentario aparece en lista | ✅ |
| 1.6.4 | Escribir y enviar (botón) | Igual que Enter | ✅ |
| 1.6.5 | Comentario vacío | No se envía | ✅ |
| 1.6.6 | Comentario en post ajeno | Dueño recibe notificación `comment` | ✅ Verificado en código |
| 1.6.7 | Comentario en post propio | NO genera notificación | ✅ Verificado en código |
| 1.6.8 | Borrar comentario propio | Desaparece de la lista | ✅ Fix aplicado: botón no tenía onClick |
| 1.6.9 | Borrar comentario ajeno | Botón de borrar no aparece | ✅ |
| 1.6.10 | Picker de emojis (abrir) | Se abre encima del input | ✅ |
| 1.6.11 | Picker de emojis (seleccionar) | Emoji se añade al texto | ✅ |
| 1.6.12 | Click fuera del picker | Se cierra | ✅ |
| 1.6.13 | Avatar de comentarista | Foto o inicial, link a perfil | ✅ |

### 1.7 Compartir plan
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.7.1 | Click botón compartir | Plan se publica como post, loading durante proceso | ⏸️ Pendiente de activar |
| 1.7.2 | Plan ya publicado | Comportamiento correcto (no duplicado) | ⏸️ Pendiente de activar |

### 1.8 Navegación
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.8.1 | Click "Ver plan" | Navega a `/plans/{id}` | 🔲 Pendiente de implementar |
| 1.8.2 | Click lupa (buscar) | Navega a `/search` | ✅ |

### 1.9 Notificaciones (campanita)
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.9.1 | Sin notificaciones no leídas | No se muestra badge | ✅ |
| 1.9.2 | Con notificaciones no leídas | Badge con número (máx "9+") | ✅ |
| 1.9.3 | Click campanita | Panel desliza desde la derecha | ✅ |
| 1.9.4 | Click fuera del panel | Panel se cierra | ✅ |
| 1.9.5 | Tecla Escape | Panel se cierra | ✅ |
| 1.9.6 | Nueva notificación en tiempo real | Aparece en el panel sin recargar | ✅ Fix aplicado: ahora recarga lista completa para evitar flash sin datos de actor |
| 1.9.7 | Volver al feed tras visitar panel | Badge se resetea a 0 | ✅ |
| 1.9.8 | Notificación `friend_request` | Aparece con botones Aceptar/Rechazar | ✅ |
| 1.9.9 | Aceptar solicitud | Botones desaparecen, amistad se crea en BD | ✅ |
| 1.9.10 | Rechazar solicitud | Botones desaparecen, amistad eliminada | ✅ |
| 1.9.11 | Reabrir panel tras aceptar | Notificación `friend_request` ya no aparece | ✅ |
| 1.9.12 | Agrupación por periodo | "Hoy", "Esta semana", "Este mes", "Anteriores" | ✅ |
| 1.9.13 | Punto azul en no leídas | Visible al abrir panel, desaparece tras 1.2s | ✅ |

### 1.10 Chat panel (sidebar desktop)
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.10.1 | Lista de chats visibles en XL | Muestra hasta 4 chats con nombre, preview y hora | ✅ |
| 1.10.2 | Chat con mensajes no leídos | Punto naranja en avatar | ✅ |
| 1.10.3 | Click en chat | Abre conversación en panel | ✅ |
| 1.10.4 | Mensaje en tiempo real | Aparece sin recargar | ✅ Fix: chats reordenados por último mensaje + llamadas muestran label correcto |
| 1.10.5 | Enviar mensaje (Enter) | Mensaje enviado, aparece en lista | ✅ |
| 1.10.6 | Enviar mensaje (botón) | Igual que Enter | ✅ |
| 1.10.7 | Botón volver | Vuelve a lista de chats | ✅ |
| 1.10.8 | Link "Ver todos" | Navega a `/messages` | ✅ |
| 1.10.9 | Panel oculto en mobile/tablet | No visible en pantallas < XL | ✅ |

### 1.11 AppSidebar
| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 1.11.1 | Links de navegación visibles | Feed, Calendar, Messages, Profile, etc. | ✅ |
| 1.11.2 | Link activo resaltado | El item del feed está activo | ✅ Fix aplicado: color primario + semibold en activo, resto en gris 60% |

---

## 2. BÚSQUEDA (`/search`)

| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 2.1 | Menos de 2 caracteres | No busca | ✅ |
| 2.2 | 2+ caracteres (debounce 250ms) | Resultados aparecen | ✅ |
| 2.3 | Sin resultados | Mensaje o lista vacía | ✅ |
| 2.4 | Click en usuario (estado: none) | Botón "Añadir" visible | ✅ |
| 2.5 | Click "Añadir" | Estado cambia a "Pendiente", notificación enviada | ✅ |
| 2.6 | Usuario con estado "Pendiente" | Botón "Pendiente" (cancelar) | ✅ |
| 2.7 | Usuario con estado "Friends" | Botón "Siguiendo" (eliminar) | ✅ |
| 2.8 | Click en nombre de usuario | Navega a `/profile/{id}` | ✅ |
| 2.9 | Buscar usuario propio | No aparece en resultados o sin botón de añadir | ✅ |
| 2.10 | Globo 3D se renderiza | Visible y con marcadores | ✅ |

---

## 3. MENSAJES (`/messages`)

| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 3.1 | Lista de chats carga | Muestra todos los chats | ✅ |
| 3.2 | Abrir conversación | Mensajes cargan correctamente | ✅ |
| 3.3 | Enviar texto | Mensaje aparece inmediatamente | ✅ |
| 3.4 | Mensaje en tiempo real | Llega sin recargar | ✅ |
| 3.5 | Preview de nota de voz | "🎤 Nota de voz" | ✅ |
| 3.6 | Preview de imagen | "📷 Foto" | ✅ Fix aplicado: shimmer + fade-in mientras carga |
| 3.7 | Preview de vídeo | "🎥 Vídeo" | ✅ |
| 3.8 | Preview de documento | "📄 Nombre" | ✅ |
| 3.9 | Nota de voz: reproducir | AudioPlayer funciona | ✅ |
| 3.10 | Imagen: ver en grande | Click abre lightbox fullscreen con flechas, thumbnails centrados y Escape para cerrar | ✅ |
| 3.11 | Chat de grupo: nombre y avatar | Icono de grupo, nombre del grupo | 🔲 |
| 3.12 | Llamada de audio | Inicia llamada, estado "outgoing" | 🔲 |
| 3.13 | Llamada perdida en historial | Aparece como "Llamada perdida" con icono | ✅ |
| 3.14 | Llamada con duración | "Audio call · 1:23" tras terminar | 🔲 |
| 3.15 | Marcar como leído al abrir | Contador de no leídos se resetea | 🔲 |

---

## 4. CALENDARIO (`/calendar`)

| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 4.1 | Vista mensual carga | Muestra mes actual con planes | 🔲 |
| 4.2 | Navegar mes anterior/siguiente | Cambia el mes | 🔲 |
| 4.3 | Click en día con plan | Muestra planes de ese día | 🔲 |
| 4.4 | Crear nuevo plan | Modal se abre, plan se crea | 🔲 |
| 4.5 | Tab "Activos" / "Hechos" | Filtra planes por estado | 🔲 |
| 4.6 | Buscar plan | Filtra por nombre | 🔲 |
| 4.7 | Vista de itinerario de un plan | Subplanes del día ordenados | 🔲 |
| 4.8 | Mapa de ruta del día | Polylines y marcadores correctos | 🔲 |

---

## 5. PLANES (`/plans/[id]`)

| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 5.1 | Carga del plan | Datos del plan visibles | 🔲 |
| 5.2 | Crear subplan (actividad) | Aparece en la lista y en el mapa | 🔲 |
| 5.3 | Crear subplan (viaje) | Calcula ruta automáticamente | 🔲 |
| 5.4 | Cambiar transporte | Ruta se recalcula | 🔲 |
| 5.5 | Horas ocupadas bloqueadas | No se puede seleccionar hora ya ocupada | 🔲 |
| 5.6 | Rango de fechas respeta timezone | No permite fecha fuera del rango del plan | 🔲 |
| 5.7 | Subplan multi-día (fin en otro día) | Campo fecha fin opcional visible | 🔲 |
| 5.8 | Insertar subplan entre existentes | Mapa se actualiza con nuevo orden | 🔲 |
| 5.9 | Exportar ruta a Google Maps | URL abre Maps con waypoints | 🔲 |
| 5.10 | Exportar a Waze | URL abre Waze con destino final | 🔲 |
| 5.11 | Gastos del plan | Se muestran correctamente | 🔲 |
| 5.12 | Plan con múltiples miembros | Todos pueden ver subplanes | 🔲 |

---

## 6. PERFIL (`/profile/[id]`)

| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 6.1 | Perfil propio | Botón editar nombre, subir foto | 🔲 |
| 6.2 | Perfil ajeno | Botón añadir/pendiente/siguiendo | 🔲 |
| 6.3 | Subir foto de perfil | Foto actualizada en perfil y feed | 🔲 |
| 6.4 | Editar nombre | Nombre actualizado | 🔲 |
| 6.5 | Planes públicos visibles | Lista de planes del usuario | 🔲 |
| 6.6 | Solicitud ya enviada | Botón "Pendiente" (no duplicar) | 🔲 |

---

## 7. GASTOS (`/mis-gastos`)

| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 7.1 | Lista pendientes carga | Muestra gastos pendientes | 🔲 |
| 7.2 | Lista pagados carga | Muestra historial | 🔲 |
| 7.3 | Solicitar confirmación | Estado cambia a EN_REVISION | 🔲 |
| 7.4 | Confirmar pago | Estado cambia a CONFIRMADA | 🔲 |
| 7.5 | Rechazar pago | Estado cambia a ANULADA | 🔲 |

---

## 8. LLAMADAS (global — cualquier página)

| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 8.1 | Recibir llamada en cualquier página | Pantalla de llamada entrante aparece | 🔲 |
| 8.2 | Aceptar llamada | Conecta con LiveKit | 🔲 |
| 8.3 | Rechazar llamada | Llamada termina | 🔲 |
| 8.4 | Llamada activa: colgar | Duración guardada en chat | 🔲 |
| 8.5 | Llamada perdida | Aparece en chat como "Llamada perdida" | 🔲 |

---

## 9. AUTENTICACIÓN

| # | Escenario | Esperado | Estado |
|---|-----------|----------|--------|
| 9.1 | Usuario no autenticado accede a `/feed` | Redirige a login | 🔲 |
| 9.2 | Token expirado | Sesión cerrada, redirige a login | 🔲 |
| 9.3 | Cerrar sesión | Redirige a login, limpia estado | 🔲 |

---

## Bugs conocidos / pendientes de verificar

| # | Descripción | Prioridad |
|---|-------------|-----------|
| B1 | SQL de notificaciones no ejecutado en prod aún | Alta |
| B2 | `fn_friend_request_send` sin patch de notificación en prod | Alta |
| B3 | RLS `notifications_rls_fix.sql` no ejecutado | Alta |
