<div align="center">

# Frimee

[![Web App](https://img.shields.io/badge/-frimee.es-brightgreen?style=for-the-badge&logo=vercel&logoColor=white)](https://frimee.es "Abrir la app")
[![Landing](https://img.shields.io/badge/-landing.frimee.es-blue?style=for-the-badge&logo=safari&logoColor=white)](https://landing.frimee.es "Página de presentación")
[![License: MIT](https://img.shields.io/badge/-MIT-blue.svg?style=for-the-badge)](LICENSE "Licencia")
[![Last Commit](https://img.shields.io/github/last-commit/FrimeeApp/Frimee/dev?label=último+commit&style=for-the-badge&display_timestamp=committer)](https://github.com/FrimeeApp/Frimee/commits "Historial de commits")
[![Commits](https://img.shields.io/github/commit-activity/m/FrimeeApp/Frimee?label=commits&style=for-the-badge)](https://github.com/FrimeeApp/Frimee/commits "Actividad")

</div>

Frimee es una plataforma web y móvil para organizar viajes y planes en grupo de forma completa y centralizada. Nace de un problema muy común: cuando varias personas preparan un viaje, la información acaba repartida entre mensajes, notas, capturas, pagos sueltos y decisiones que nadie tiene claras.

La aplicación centraliza toda esa gestión en un único espacio. Cada viaje o plan puede dividirse en subplanes, controlar gastos compartidos, coordinar participantes, consultar disponibilidad del grupo y publicarse en un feed social para que amigos e inspiración convivan en la misma herramienta.

---

* [DEMO Y ACCESO](#demo-y-acceso)
* [FUNCIONALIDADES](#funcionalidades)
    * [Gestión de planes](#gestión-de-planes)
    * [Gestión económica](#gestión-económica)
    * [Comunicación](#comunicación)
    * [Capa social](#capa-social)
* [TECNOLOGÍAS](#tecnologías)
* [INSTALACIÓN](#instalación)
    * [Requisitos previos](#requisitos-previos)
    * [Clonar e instalar dependencias](#1-clonar-e-instalar-dependencias)
    * [Variables de entorno](#2-variables-de-entorno)
    * [Arrancar en desarrollo](#3-arrancar-en-desarrollo)
    * [Despliegue con Docker](#4-despliegue-con-docker)
* [BASE DE DATOS](#base-de-datos)
    * [Crear proyecto en Supabase](#41-crear-el-proyecto-en-supabase)
    * [Aplicar esquema SQL](#42-aplicar-el-esquema-sql)
    * [Configurar autenticación](#43-configurar-autenticación)
    * [Configurar Firebase](#44-configurar-firebase)
* [ESTRUCTURA DEL PROYECTO](#estructura-del-proyecto)
* [ROADMAP](#roadmap)
* [CONTRIBUIR](#contribuir)

---

# DEMO Y ACCESO

<div align="center">

[![Abrir app](https://img.shields.io/badge/-Abrir_App_→_frimee.es-brightgreen?style=for-the-badge&logo=vercel&logoColor=white)](https://frimee.es)
[![Ver landing](https://img.shields.io/badge/-Ver_Landing_→_landing.frimee.es-blue?style=for-the-badge&logo=safari&logoColor=white)](https://landing.frimee.es)

</div>

La aplicación principal está desplegada en **[frimee.es](https://frimee.es)** con actualización continua desde la rama `main` a través de Vercel. La página de presentación está disponible en **[landing.frimee.es](https://landing.frimee.es)**.

Para acceder a la app es necesario crear una cuenta o iniciar sesión con Google. El registro es gratuito.

---

# FUNCIONALIDADES

## Gestión de planes

| Funcionalidad | Descripción |
|:---|:---|
| Crear planes y viajes | Define el destino, fechas, descripción y portada de cada plan |
| Subplanes y actividades | Divide un viaje en actividades concretas con su propio detalle |
| Participantes | Invita personas al plan y gestiona quién está dentro |
| Disponibilidad | Consulta la disponibilidad del grupo para encontrar fechas viables |
| Mapa y ubicaciones | Visualiza y guarda ubicaciones asociadas al plan con Google Maps |
| Calendario | Ubica planes y actividades en el tiempo con vista mensual |
| Sincronización | Exporta eventos a Google Calendar |

## Gestión económica

| Funcionalidad | Descripción |
|:---|:---|
| Gastos compartidos | Registra gastos indicando quién pagó y cómo se reparte |
| Balances | Calcula automáticamente quién debe cuánto a quién |
| Vista individual | Cada participante ve sus gastos pagados y deudas pendientes |

## Comunicación

| Funcionalidad | Descripción |
|:---|:---|
| Chat de plan | Mensajería en tiempo real dentro de cada plan |
| Mensajes de voz | Envía y escucha notas de audio en el chat |
| Videollamadas | Llamadas de vídeo integradas con LiveKit |

## Capa social

| Funcionalidad | Descripción |
|:---|:---|
| Feed | Explora planes publicados por amigos y por la comunidad |
| Publicar planes | Comparte tus viajes con foto, texto y visibilidad configurable |
| Likes y comentarios | Interactúa con las publicaciones de otros usuarios |
| Seguir usuarios | Sigue a personas para ver sus planes en tu feed |
| Perfil | Vista pública del perfil de cada usuario con sus planes publicados |

---

# TECNOLOGÍAS

El proyecto está desarrollado con un enfoque web y mobile híbrido:

| Tecnología | Uso |
|:---|:---|
| [Next.js](https://nextjs.org/) | Framework principal — App Router, SSR y API Routes |
| [React](https://react.dev/) | Construcción de la interfaz |
| [TypeScript](https://www.typescriptlang.org/) | Tipado estático en todo el proyecto |
| [Tailwind CSS](https://tailwindcss.com/) | Estilado de la interfaz |
| [Supabase](https://supabase.com/) | Base de datos PostgreSQL, autenticación y realtime |
| [Firebase](https://firebase.google.com/) | Firestore para publicaciones sociales y Storage para imágenes |
| [Google Maps](https://developers.google.com/maps) | Mapas, búsqueda de lugares y cálculo de rutas |
| [LiveKit](https://livekit.io/) | Videollamadas en tiempo real |
| [Capacitor](https://capacitorjs.com/) | Adaptación a entorno móvil nativo (iOS / Android) |

---

# INSTALACIÓN

## Requisitos previos

Antes de empezar, asegúrate de tener instalado:

- [Node.js](https://nodejs.org/) v20 o superior
- [npm](https://www.npmjs.com/) v9 o superior
- [Docker](https://www.docker.com/) y [Docker Compose](https://docs.docker.com/compose/) *(solo para despliegue con contenedores)*
- Una cuenta en [Supabase](https://supabase.com/) *(gratuita)*
- Una cuenta en [Firebase](https://firebase.google.com/) *(gratuita)*
- Una clave de API de [Google Maps Platform](https://developers.google.com/maps)
- Una cuenta en [LiveKit Cloud](https://livekit.io/) *(gratuita)*

---

## 1. Clonar e instalar dependencias

Clona el repositorio y entra en la carpeta de la aplicación principal:

```bash
git clone https://github.com/FrimeeApp/Frimee.git
cd frimee/fremee
```

Instala todas las dependencias:

```bash
npm install
```

Para la landing page (opcional):

```bash
cd ../fremee-landings
npm install
```

---

## 2. Variables de entorno

Copia el archivo de ejemplo y rellena tus propias claves:

```bash
cp .env.example .env.local
```

Edita `.env.local` con los valores de tus proyectos. A continuación se describe cada variable:

```env
# ── Supabase ──────────────────────────────────────────────────────────────────
# URL de tu proyecto Supabase (Dashboard → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Clave pública (anon key) de Supabase
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...

# Clave de servicio (service role) — solo en servidor, nunca en el cliente
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── Firebase ──────────────────────────────────────────────────────────────────
# Firebase Console → Project Settings → Your apps → Web app
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:...

# ── Google Maps ───────────────────────────────────────────────────────────────
# Google Cloud Console → APIs & Services → Credentials
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
GOOGLE_MAPS_SERVER_KEY=AIza...

# ── LiveKit (videollamadas) ────────────────────────────────────────────────────
# LiveKit Cloud Dashboard → Project → Keys
NEXT_PUBLIC_LIVEKIT_URL=wss://your-app.livekit.cloud
NEXT_PUBLIC_WEB_APP_URL=https://frimee.es
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...
```

> **Nota**: Las variables con el prefijo `NEXT_PUBLIC_` se incrustan en el bundle en tiempo de build. Si las cambias en producción, debes reconstruir la imagen o redesplegar.

---

## 3. Arrancar en desarrollo

```bash
cd fremee
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

Para desarrollo en red local con Capacitor (acceso desde móvil en la misma red):

```bash
npm run dev:mobile
```

---

## 4. Despliegue con Docker

Este método construye la aplicación Next.js en un contenedor de producción sin necesidad de instalar Node.js directamente en el servidor.

#### 4.1 Preparar variables de producción

En la carpeta `fremee/`, crea un archivo `.env` con los valores de producción:

```bash
cp .env.example .env
# Edita .env con los valores de producción
```

#### 4.2 Construir y levantar el contenedor

```bash
cd fremee
docker compose up --build -d
```

La app queda expuesta en el puerto `3000`. Para ver los logs en tiempo real:

```bash
docker compose logs -f
```

Para detener el contenedor:

```bash
docker compose down
```

#### 4.3 Actualizar a una nueva versión

```bash
git pull
docker compose up --build -d
```

---

# BASE DE DATOS

Frimee usa **Supabase** como base de datos principal (PostgreSQL) y **Firebase Firestore** para el contenido social.

## 4.1 Crear el proyecto en Supabase

1. Accede a [supabase.com](https://supabase.com/) y crea una cuenta gratuita.
2. Crea un nuevo proyecto y anota la **URL** y las **claves API** para añadirlas a `.env.local`.

## 4.2 Aplicar el esquema SQL

Desde el **SQL Editor** de Supabase (Dashboard → SQL Editor → New query), ejecuta los archivos en este orden:

```
supabase/sql/rpc_grupos.sql
supabase/sql/rls_grupos.sql
supabase/sql/rls_amistades.sql
supabase/sql/rls_missing_tables.sql
supabase/sql/rpc_friendship_actions.sql
supabase/sql/rpc_chat_extras.sql
supabase/sql/rpc_chat_leave_update.sql
supabase/sql/rpc_mensajes_audio.sql
supabase/sql/rpc_mensajes_document.sql
supabase/sql/notifications.sql
supabase/sql/notifications_friendship_triggers.sql
supabase/sql/notifications_rls_fix.sql
supabase/sql/route_cache.sql
supabase/sql/llamadas.sql
supabase/sql/llamadas_cleanup_stale.sql
supabase/sql/mensajes_llamadas.sql
supabase/sql/fix_enum_visibilidad_plan.sql
supabase/sql/fix_subplan_create_overloads.sql
supabase/sql/migrate_subplan_tipo_rls.sql
```

Puedes copiar el contenido de cada archivo en el editor SQL, o usar la [CLI de Supabase](https://supabase.com/docs/guides/cli) si prefieres ejecutarlos desde terminal.

## 4.3 Configurar autenticación

En el Dashboard de Supabase:

1. Ve a **Authentication → Providers** y activa el proveedor **Email**.
2. (Opcional) Activa **Google OAuth** si quieres login con Google: necesitarás un Client ID y Secret desde Google Cloud Console.
3. En **Authentication → URL Configuration**, añade `http://localhost:3000` como URL de redirección permitida para desarrollo local, y `https://frimee.es` para producción.

## 4.4 Configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Activa **Firestore Database** en modo producción.
3. Activa **Storage** para almacenamiento de imágenes de publicaciones.
4. Crea una aplicación web y copia los valores de configuración en `.env.local`.

---

# ESTRUCTURA DEL PROYECTO

```
frimee/
├── fremee/                  # Aplicación principal (Next.js)
│   ├── src/
│   │   ├── app/             # App Router de Next.js
│   │   │   ├── (app)/       # Rutas protegidas de la app
│   │   │   │   ├── feed/    # Feed social
│   │   │   │   ├── plan/    # Detalle de plan
│   │   │   │   ├── chat/    # Mensajería
│   │   │   │   ├── profile/ # Perfil de usuario
│   │   │   │   └── ...
│   │   │   ├── (auth)/      # Rutas de autenticación
│   │   │   └── api/         # API Routes del servidor
│   │   ├── components/      # Componentes reutilizables
│   │   └── lib/             # Clientes de Supabase, Firebase, etc.
│   ├── supabase/
│   │   └── sql/             # Migraciones y esquema de base de datos
│   ├── public/              # Assets estáticos
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
├── fremee-landings/         # Landing page (landing.frimee.es)
└── README.md
```

---

# ROADMAP

El desarrollo de Frimee se ha organizado en fases que reflejan su evolución:

**Fase 1 — Base del producto**
- Definición de la idea y necesidades del usuario
- Diseño inicial de la arquitectura y la interfaz
- Configuración del proyecto con Next.js, Supabase y Firebase

**Fase 2 — Gestión de planes**
- Creación de viajes y planes personalizados
- Subplanes y actividades dentro de cada plan
- Gestión de participantes y consulta de disponibilidad

**Fase 3 — Gestión económica**
- Registro de gastos compartidos con divisiones personalizadas
- Cálculo automático de balances pendientes
- Vista individual de lo pagado y lo que se debe

**Fase 4 — Comunicación**
- Chat en tiempo real dentro de cada plan
- Mensajes de voz
- Videollamadas integradas con LiveKit

**Fase 5 — Capa social**
- Publicación de planes en el feed con foto y texto
- Sistema de likes, comentarios y seguimiento de usuarios
- Exploración de planes de la comunidad

**Fase 6 — Integración y plataforma**
- Sincronización con Google Calendar
- Integración de Google Maps para ubicaciones y rutas
- Adaptación a móvil nativo con Capacitor (iOS / Android)
- Mejoras de rendimiento, accesibilidad y experiencia de usuario

---

# CONTRIBUIR

Las contribuciones son bienvenidas. Para proponer cambios:

1. Haz un fork del repositorio
2. Crea una rama desde `dev`: `git checkout -b feature/nombre-feature`
3. Realiza tus cambios y haz commit
4. Abre una Pull Request hacia `dev` describiendo los cambios

Para reportar bugs o sugerir mejoras, abre un [issue](https://github.com/FrimeeApp/Frimee/issues) con el máximo detalle posible.

---

<div align="center">

Hecho con mucho esfuerzo · [frimee.es](https://frimee.es) · [landing.frimee.es](https://landing.frimee.es)

</div>
