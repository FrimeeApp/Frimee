# Frimee — Checklist de producción

## 🔴 Bloqueadores críticos

- [ ] **Feedback en operaciones de páginas** — likes, mensajes y comentarios: cubiertos con toasts; errores en ChatConversation pendientes
- [ ] **Onboarding tras registro** — ahora mismo: registro → feed vacío sin guía
- [ ] **Notificaciones push** — `@capacitor/push-notifications` no instalado, la app no avisa con la pantalla cerrada

## 🟡 Importantes

- [ ] **Terms & Conditions + Política de privacidad** — links van a `#`, Apple y Google lo exigen para aprobar la app
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
- [x] **Feedback visual en modales** — spinner → ✓ animado (éxito) / ✗ animado + mensaje (error) en todos los modales de formulario
- [x] **PWA manifest completo** — añadidos `name`, `short_name`, `start_url`, `display: standalone`, `theme_color`, `background_color`
- [x] **Cambio de contraseña** — formulario inline en Settings > Seguridad, verifica contraseña actual antes de actualizar
- [x] **Eliminar cuenta** — confirmación inline con texto "ELIMINAR" + API route con service role, cumple GDPR
- [x] **Logging de errores (Sentry)** — `@sentry/nextjs` instalado, configs client/server/edge, `instrumentation.ts`. Requiere añadir `NEXT_PUBLIC_SENTRY_DSN` al `.env`
- [x] **Metadata SEO por página** — template `%s · Frimee` en root layout, og:image por defecto, título propio en feed/mensajes/wallet/calendario/gastos/ajustes/vuelos/planes/perfil
- [x] **Feedback en páginas (parcial)** — sistema de toasts (`ToastProvider` + `useToast`) en layout; likes, comentarios, inicio de chat y creación de grupo muestran error visible
