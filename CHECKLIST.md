# Frimee — Checklist de producción

## 🔴 Bloqueadores críticos

- [ ] **Feedback en operaciones de páginas** — likes, envío de mensajes y carga de listas fallan en silencio (solo console.error)
- [ ] **Onboarding tras registro** — ahora mismo: registro → feed vacío sin guía
- [ ] **Notificaciones push** — `@capacitor/push-notifications` no instalado, la app no avisa con la pantalla cerrada

## 🟡 Importantes

- [ ] **Terms & Conditions + Política de privacidad** — links van a `#`, Apple y Google lo exigen para aprobar la app
- [ ] **Logging de errores (Sentry)** — si algo peta en producción no hay forma de saberlo
- [ ] **Metadata SEO por página** — todas comparten el mismo título; sin `og:image` los links en WhatsApp no muestran preview
- [ ] **Rate limiting en login/registro** — fuerza bruta posible en auth de Supabase

## 🟢 Polish

- [ ] **Skeleton loaders consistentes** — algunas páginas los tienen, otras no
- [ ] **Deep links ampliados** — solo funcionan para planes; mensajes, perfil y vuelos no tienen deep link
- [ ] **Página 404 mejorada** — funcional pero muy básica
- [ ] **Soporte offline básico** — mostrar mensaje cuando no hay conexión en vez de fallar en silencio

## ✅ Completado

- [x] **Sanitización de inputs** — todas las rutas API validan y limpian los datos de entrada
- [x] **Rate limiting en rutas API** — 6 endpoints protegidos con ventana deslizante via Supabase
- [x] **Separación de landings** — `/landing` y `/landing/v2` independientes del flujo de la app
- [x] **Root `/` como redirector** — web → login, nativo → feed, OAuth → callback
- [x] **Feedback visual en modales** — spinner → ✓ animado (éxito) / ✗ animado + mensaje (error) en AddGastoSheet, AddTicketModal, CreatePlanModal, PublishPlanModal y AddSubplanSheet
- [x] **PWA manifest completo** — añadidos `name`, `short_name`, `start_url`, `display: standalone`, `theme_color`, `background_color`
- [x] **Cambio de contraseña** — formulario inline en Settings > Seguridad, verifica contraseña actual antes de actualizar
- [x] **Eliminar cuenta** — confirmación inline con texto "ELIMINAR" + API route con service role, cumple GDPR
