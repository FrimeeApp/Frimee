<div align="center">

# Frimee

[![Web App](https://img.shields.io/badge/-frimee.es-brightgreen?style=for-the-badge&logo=vercel&logoColor=white)](https://frimee.es "Abrir la app")
[![Landing](https://img.shields.io/badge/-landing.frimee.es-blue?style=for-the-badge&logo=safari&logoColor=white)](https://landing.frimee.es "Página de presentación")
[![License](https://img.shields.io/badge/-Propietario-red.svg?style=for-the-badge)](LICENSE "Licencia")
[![Last Commit](https://img.shields.io/github/last-commit/FrimeeApp/Frimee/main?label=último+commit&style=for-the-badge&display_timestamp=committer)](https://github.com/FrimeeApp/Frimee/commits "Historial de commits")
[![Commits](https://img.shields.io/github/commit-activity/m/FrimeeApp/Frimee?label=commits&style=for-the-badge)](https://github.com/FrimeeApp/Frimee/commits "Actividad")

</div>

Frimee es una aplicación para organizar viajes y planes entre amigos. Nace de algo que le pasa a casi cualquier grupo que prepara una escapada, y es que la información acaba repartida entre un chat de mensajería, una hoja de cálculo para los gastos, un mapa con sitios guardados, una carpeta de fotos y las capturas de pantalla de cada billete, de manera que nadie tiene claro del todo qué se ha decidido, quién ha pagado qué ni dónde está la reserva del hotel. Frimee junta todo eso en un solo plan, con el itinerario día a día, los gastos y las deudas, las fotos colocadas sobre el viaje, la conversación del grupo, las llamadas y los billetes de cada persona.

Está en producción en [frimee.es](https://frimee.es) y funciona tanto en el navegador como en Android, donde es la misma aplicación empaquetada con Capacitor, así que la web y el móvil salen del mismo código. Todavía no está en ninguna tienda de aplicaciones: la versión de Android se instala como un APK de prueba y el proyecto de iOS está preparado pero sin publicar. El diseño inicial y parte de la interfaz son de Victoria, y el resto del frontend y todo el backend los he hecho yo.

---

* [PROBARLO](#probarlo)
* [QUÉ HACE](#qué-hace)
    * [Planes e itinerario](#planes-e-itinerario)
    * [Gastos y pagos](#gastos-y-pagos)
    * [Álbum y recorrido](#álbum-y-recorrido)
    * [Chat, asistente y llamadas](#chat-asistente-y-llamadas)
    * [Cartera y vuelos de amistades](#cartera-y-vuelos-de-amistades)
    * [Pasaporte](#pasaporte)
    * [Invitar y privacidad](#invitar-y-privacidad)
    * [Lo que existe pero está apagado](#lo-que-existe-pero-está-apagado)
* [CÓMO ESTÁ HECHO](#cómo-está-hecho)
    * [Tecnologías](#tecnologías)
    * [Por dónde habla cada parte con cada servicio](#por-dónde-habla-cada-parte-con-cada-servicio)
    * [Seguridad y costes](#seguridad-y-costes)
    * [Cómo se trabaja](#cómo-se-trabaja)
* [INSTALACIÓN](#instalación)
* [BASE DE DATOS](#base-de-datos)
* [ESTRUCTURA DEL PROYECTO](#estructura-del-proyecto)
* [ESTADO Y LO QUE VIENE](#estado-y-lo-que-viene)
* [CONTRIBUIR](#contribuir)

---

# PROBARLO

La forma más rápida de ver cómo funciona es entrar en [frimee.es](https://frimee.es) y pulsar «Probar como invitado», que no pide registro ni correo. La aplicación crea una cuenta anónima y te deja dentro con un viaje a Lisboa en marcha, una quedada de cumpleaños que se acerca y un viaje a Roma ya terminado con su álbum de fotos, todos con amigos ficticios, y con conversaciones, gastos, encuestas y billetes de ejemplo, de manera que se pueden recorrer todas las pantallas con datos reales en lugar de pantallas vacías.

Una pastilla en la parte de arriba recuerda que estás en modo invitado y permite convertir la cuenta en una de verdad en cualquier momento, sin perder lo que hayas probado. Las cuentas de invitado se borran a los siete días, no pueden escribir ni invitar a personas reales, y las funciones que cuestan dinero cada vez que se usan, como la lectura de billetes, las llamadas o el asistente, tienen un límite diario pequeño. Quien prefiera una cuenta propia puede registrarse con correo y contraseña o con Google.

---

# QUÉ HACE

## Planes e itinerario

Todo gira alrededor del plan, que es un viaje o una quedada con nombre, fechas, destino, una portada opcional y sus miembros, entre los que hay una persona administradora que lo edita y el resto, que pueden añadir actividades y gastos y participar en el chat. El itinerario se organiza por días, y cada día admite actividades, restaurantes, alojamientos, vuelos, trenes y demás, con su hora y su lugar, de modo que un hotel de varias noches aparece en cada día que cubre y una actividad sin hora queda marcada como tal en lugar de inventarse una.

Entre dos actividades seguidas la aplicación calcula el tramo, con el medio de transporte, el tiempo y la distancia, y lo abre en Google Maps o Waze si hace falta, y cada día tiene su mapa con las paradas numeradas y la ruta, que se puede ver a pantalla completa. Crear un plan o una actividad se hace con un asistente de tres pasos que propone un nombre, deja el lugar y la hora para después si todavía no se saben y avisa si ya existe otro plan parecido en esas fechas. Los planes se pueden anclar, buscar y revisar desde un calendario con vistas de año, mes, semana y día, y el inicio resume lo que está en curso, lo que viene y lo que le toca decidir a cada persona.

## Gastos y pagos

Cualquier miembro puede registrar un gasto indicando quién lo pagó y cómo se reparte, ya sea a partes iguales, por porcentajes, por cantidades o por las líneas del ticket, y la aplicación va calculando quién debe cuánto a quién y simplifica las deudas para que haya el mínimo de pagos entre las personas. Los pagos pueden ser parciales, el que cobra los confirma, y cada plan puede tener un presupuesto y cada persona un tope personal para llevar la cuenta de lo que se gasta. Los tickets se pueden leer con la cámara para no teclear el importe, y desde un plan se genera un PDF con el resumen. Fuera de los planes, la pantalla «Mis gastos» reúne lo que debes y lo que te deben en todos tus viajes, y hay recordatorios de deuda para no tener que reclamarlas a mano.

## Álbum y recorrido

Las fotos y los vídeos del viaje se suben al plan y se colocan solos en la actividad o el tramo que les corresponde, usando la hora a la que se hicieron, que se lee de la propia foto y, cuando no está, de otros datos del archivo. Las que no se pueden ubicar con seguridad se quedan en «Sin clasificar» y se mueven a mano, y cada una enseña si se colocó automáticamente o a mano. Con todo eso, el álbum se convierte en un recorrido sobre el mapa, día a día, donde las fotos aparecen en el punto del viaje en el que se hicieron, y que se puede compartir desde el propio móvil. Los vídeos viven solo en la pestaña del álbum, hasta 100 MB cada uno.

## Chat, asistente y llamadas

El chat de cada plan, de cada grupo y de cada pareja de personas se parece más a un cuaderno de viaje que a una lista de burbujas, porque los días aparecen como capítulos relativos al viaje, los mensajes seguidos de una misma persona se agrupan y las decisiones importantes quedan marcadas como hitos que se pueden recorrer con una regla lateral. Admite texto, fotos, vídeo, documentos, notas de voz, ubicaciones y tarjetas de plan, encuestas con su propio sistema de empates (se reabren para quien no ha votado o se sortea con una pequeña animación), reacciones, respuestas con cita, mensajes fijados y destacados, y se puede eliminar un mensaje para uno mismo o para todos. Desde un chat sin plan se puede crear uno copiando la conversación al chat nuevo, y cada chat tiene un panel con las fotos, los archivos, los enlaces, los sitios y las decisiones que se han compartido.

En cualquier chat de plan se puede mencionar a **@frimee**, un asistente que funciona con Claude Haiku a través de una función de Supabase y que responde preguntas sobre el viaje, recomienda sitios y propone cambios, como añadir una actividad, registrar un gasto o crear una encuesta, que el grupo acepta o descarta antes de que se apliquen. Aparte, un segundo proceso lee los mensajes y marca con un rombo los que parecen un plan, un lugar o un gasto, para convertirlos en actividad con un solo toque. Las llamadas y videollamadas, tanto de pareja como de grupo, funcionan con LiveKit, con pantalla compartida en escritorio y, en Android, una notificación a pantalla completa con la aplicación cerrada, un tono propio y una notificación mientras la llamada sigue en curso.

## Cartera y vuelos de amistades

La Cartera guarda los billetes y las entradas de cada persona, con un papel y unas tintas que recuerdan a los de verdad, agrupados por plan y separados entre próximos y usados, que es un estado al que pasan solos pasadas veinticuatro horas desde que acaban. Al subir la foto o el PDF de un billete, la aplicación lo lee con un modelo de visión de OpenAI para rellenar el tipo, las fechas, el origen y el destino, el localizador, el asiento y el titular, y además lee en el propio dispositivo el código QR, Aztec o PDF417 que lleve, sin enviarlo a ningún servidor. Ese código se guarda cifrado en Supabase Vault, los archivos se guardan en un espacio privado y se abren con enlaces que caducan a los cinco minutos, y, en Android, mientras se enseña el código a la puerta, la pantalla sube al máximo de brillo y no se puede capturar ni grabar.

Si alguien lo permite en sus ajustes, sus amistades ven en el chat de pareja el vuelo que tiene en curso, con la ruta, las horas y cuánto lleva recorrido, pero nunca el localizador, el asiento ni el nombre del titular, y cada persona decide quién puede verlo.

## Pasaporte

Cada persona tiene un pasaporte, una libreta con tapa y páginas por año en la que cada viaje terminado deja un sello propio, uno por cada país en el que hubo una actividad o una noche, y unos sellos de hito más especiales cuando se consigue el primer viaje, el país número diez, veinticinco o cincuenta, volver a un país, un viaje largo, uno con mucha gente o una ruta por tres países o más. Los sellos se estampan al día siguiente de acabar el viaje, avisan con una notificación y una pantalla de «Sello nuevo», y al pulsar uno se abre una ficha con el plan, el álbum y las opciones de ocultar el viaje o de marcar que no se fue. El país de cada parada se decide con fronteras propias guardadas en PostGIS, y solo se recurre al geocodificador de Google cuando de un sitio hay únicamente el nombre y no sus coordenadas.

El pasaporte se puede enseñar a todo el mundo, solo a las amistades o a nadie, con la opción de ocultar los sellos de plan y dejar solo los de países y de esconder quién fue con quién, y el de una amistad se abre en modo lectura desde su perfil junto con lo que habéis hecho en común.

## Invitar y privacidad

Para invitar a un plan hay un código corto con su QR y una hoja para compartirlo, con un límite de intentos fallidos por hora para que nadie pueda adivinar códigos. Se puede bloquear a una persona, y entonces deja de poder escribirte, sus mensajes en los grupos compartidos aparecen ocultos y se deshace desde el mismo sitio. Eliminar la cuenta anonimiza los datos en lugar de dejar huecos en los planes de los demás, y la política de privacidad y los términos se pueden leer dentro de la propia aplicación.

## Lo que existe pero está apagado

Hay dos partes que están escritas y quedan fuera de la aplicación por ahora. La primera es la capa social, con un feed de planes publicados, los likes, los comentarios y los seguidores, que está oculta porque de momento la aplicación se centra en el grupo y no en la comunidad. La segunda es la sincronización con Google Calendar, que está desactivada hasta que Google verifique el permiso de calendario.

---

# CÓMO ESTÁ HECHO

## Tecnologías

La aplicación es un único proyecto de [Next.js](https://nextjs.org/) 16 con el App Router, [React](https://react.dev/) 19, [TypeScript](https://www.typescriptlang.org/) y [Tailwind CSS](https://tailwindcss.com/) 4, y de ese mismo código salen la web con servidor y sus rutas `/api`, la exportación estática que [Capacitor](https://capacitorjs.com/) 8 empaqueta como aplicación de Android e iOS y una imagen de Docker, según el valor de `BUILD_TARGET` al construir. Lo nativo, como las notificaciones a pantalla completa de las llamadas, los widgets de Android o el brillo de pantalla, va en plugins de Capacitor, algunos escritos a medida.

Para los datos usamos [Supabase](https://supabase.com/), que aporta PostgreSQL con seguridad por filas, la autenticación, incluidos los usuarios anónimos del modo invitado, Realtime para el chat, Storage, Vault para lo que va cifrado y funciones de borde para el asistente, las notificaciones push y otras tareas de fondo, y de [Firebase](https://firebase.google.com/) usamos Firestore para el contenido social, Storage para los archivos que suben los usuarios y Cloud Messaging para las notificaciones push. Los lugares y las rutas salen de [Google Maps](https://developers.google.com/maps), el mapa del álbum se dibuja con [MapLibre](https://maplibre.org/) sobre OpenFreeMap, las llamadas son de [LiveKit](https://livekit.io/), el asistente usa Claude Haiku, la lectura de billetes usa un modelo de visión de OpenAI, la lectura de códigos se hace con [zxing-wasm](https://github.com/Sec-ant/zxing-wasm), los errores llegan a [Sentry](https://sentry.io/) y la web se despliega en [Vercel](https://vercel.com/) con cada fusión a `main`.

## Por dónde habla cada parte con cada servicio

Los clientes hablan directamente con la mayoría de los servicios usando claves públicas, y la seguridad de esos accesos descansa en las políticas de la base de datos y no en esconder las rutas. Solo cuando algo necesita un secreto, como la clave de servicio de Supabase, el emisor de tokens de LiveKit, la lectura de billetes con OpenAI, el cálculo de rutas o el borrado de cuenta, la petición pasa por una ruta `/api` del propio servidor, y las tareas que no dependen de nadie que esté mirando la pantalla, como el asistente, los avisos push, la creación de los sellos del pasaporte, la limpieza de cuentas de invitado o el paso de los billetes a usados, viven en funciones de Supabase o en tareas programadas dentro de la propia base de datos.

## Seguridad y costes

La base de datos protege los datos con seguridad por filas, y las funciones que se saltan esa seguridad para poder hacer varias cosas a la vez comprueban primero quién las llama. Esa parte se revisó tabla por tabla en noviembre de 2026, cuando se cerraron funciones que cualquiera podía lanzar sin sesión y reglas de Firebase que dejaban listar y descargar archivos, y desde entonces Firebase acepta solo tokens firmados por el servidor a partir de la sesión de Supabase. El esquema, las políticas y las funciones no están en este repositorio, sino en uno privado, por razones que se explican más abajo.

Como la inteligencia artificial, la lectura de billetes, las rutas y las llamadas cuestan dinero cada vez que se usan, las rutas que las llaman tienen un límite de peticiones y un cupo diario, tanto por persona como para el servicio en conjunto, y más pequeño para los invitados, y los tramos de ruta se calculan una sola vez y se guardan para no recalcularlas cada vez que alguien abre una pantalla. Los datos de los billetes reciben un cuidado extra, porque el contenido de un código de embarque es una credencial: va cifrado, los archivos no son públicos, solo se aceptan imágenes y PDF de hasta 10 MB y a OpenAI se le pide que no almacene las peticiones.

## Cómo se trabaja

El trabajo se hace en ramas pequeñas con una fusión a `main` por cada cambio, y cada cambio que toca la base de datos lleva su migración, que se aplica primero en un proyecto de pruebas de Supabase y luego en el de producción, con una consulta de comprobación que decide si el paso está hecho, algo que se apunta en un documento de verificación que vive en el repositorio privado. Fusionar a `main` despliega en producción, así que el orden es siempre el mismo, primero la base de datos y luego el código.

Lo que se puede probar con código se prueba con código, como el cálculo de la hora de una foto, su colocación en el itinerario, la agrupación del álbum o el buscador de personas, que tienen sus propias pruebas en `fremee/tests`, y todo lo demás se comprueba a mano con un tablero de pruebas dividido por secciones, con varios cientos de comprobaciones que se marcan por separado en local y en producción y a las que se añaden las de cada cambio nuevo, empezando por las que no se pueden revisar sin una cuenta real, un móvil o una notificación.

---

# INSTALACIÓN

Conviene saber desde el principio que el esquema de la base de datos no está en este repositorio, de manera que esta guía sirve para arrancar la aplicación contra un proyecto de Supabase que ya tenga ese esquema, y sin él se puede leer y ejecutar el código, pero no se puede usar con datos.

## Requisitos previos

Hace falta [Node.js](https://nodejs.org/) 20 o superior con su npm, [Docker](https://www.docker.com/) con Docker Compose si se quiere desplegar con contenedores, y cuentas en [Supabase](https://supabase.com/), [Firebase](https://firebase.google.com/) y [LiveKit Cloud](https://livekit.io/), además de una clave de [Google Maps Platform](https://developers.google.com/maps). Para leer billetes con la cámara hace falta además una clave de OpenAI, y para recibir errores, un proyecto de Sentry.

## 1. Clonar e instalar dependencias

```bash
git clone https://github.com/FrimeeApp/Frimee.git
cd Frimee/fremee
npm install
```

La carpeta `fremee-landings` contiene la página de presentación y se instala aparte con su propio `npm install`.

## 2. Variables de entorno

Se parte del archivo de ejemplo y se rellenan los valores de cada proyecto:

```bash
cp .env.example .env.local
```

```env
# ── Supabase ──────────────────────────────────────────────────────────────────
# Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
# Solo en el servidor, nunca en el cliente
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── Firebase ──────────────────────────────────────────────────────────────────
# Cliente: Firebase Console → Project Settings → Your apps → Web app
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:...
# Servidor: cuenta de servicio con la que se firman los tokens de Firebase
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ── Google Maps ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
GOOGLE_MAPS_SERVER_KEY=AIza...

# ── LiveKit (llamadas) ────────────────────────────────────────────────────────
NEXT_PUBLIC_LIVEKIT_URL=wss://tu-app.livekit.cloud
NEXT_PUBLIC_WEB_APP_URL=https://frimee.es
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...

# ── Lectura de billetes y tickets ─────────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── Sentry (opcional) ─────────────────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

Las variables que empiezan por `NEXT_PUBLIC_` se incrustan en el código al construir, así que si cambian en producción hay que volver a construir o a desplegar.

## 3. Arrancar en desarrollo

```bash
npm run dev
```

La aplicación queda en [http://localhost:3000](http://localhost:3000). Para probarla desde un móvil en la misma red, con la aplicación de Android recargando en vivo, se usa `npm run dev:mobile`, y para generar la aplicación de Capacitor sin servidor, `npm run build:mobile`.

## 4. Despliegue con Docker

La imagen construye Next.js en modo independiente, sin necesidad de tener Node.js en el servidor. Se crea un `.env` con los valores de producción en la carpeta `fremee/`, y después se levanta el contenedor, que queda en el puerto 3000:

```bash
cp .env.example .env
docker compose up --build -d
```

Para ver los registros se usa `docker compose logs -f`, para pararlo `docker compose down` y para actualizarlo basta con `git pull` y volver a lanzar el primer comando.

---

# BASE DE DATOS

Frimee guarda casi todo en Supabase, que es PostgreSQL con sus políticas de seguridad, y deja a Firebase el contenido social y los archivos. El esquema, es decir, las migraciones, las funciones, las políticas de seguridad, las funciones de borde y las reglas de Firebase, no forman parte de este repositorio público, porque describen con todo detalle qué tablas hay y cómo se protegen, y viven en un repositorio privado de la misma organización. Este repositorio contiene solo el código de la aplicación, que se conecta a ese esquema con la URL y las claves del proyecto que se pongan en `.env.local`.

Si se quiere montar una instancia propia hay que crear el proyecto en Supabase, activar el proveedor de correo y, si se quiere, el de Google en Authentication, activar además los inicios de sesión anónimos para el modo invitado, añadir `http://localhost:3000` y `https://frimee.es` como direcciones de redirección permitidas y, en Firebase, crear la base Firestore y el almacenamiento y copiar los valores de la aplicación web, pero el esquema en sí hay que tenerlo por otro lado.

---

# ESTRUCTURA DEL PROYECTO

```
Frimee/
├── fremee/                      Aplicación principal (Next.js + Capacitor)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/           Rutas de la app con sesión: calendar, plans, plan,
│   │   │   │                    messages, passport, profile, search, wallet,
│   │   │   │                    mis-gastos, notifications, settings, join
│   │   │   ├── (auth)/          Inicio de sesión, registro y recuperar contraseña
│   │   │   ├── (legal)/         Términos y política de privacidad
│   │   │   ├── invitado/        Entrada del modo invitado
│   │   │   └── api/             Rutas del servidor: livekit, tickets y receipts (OCR),
│   │   │                        directions, firebase (tokens), flights, account
│   │   ├── components/          Interfaz, agrupada por área (chat, calls, plans,
│   │   │                        profile, wallet, flights, ui…)
│   │   ├── lib/                 Lógica pura y utilidades (itinerario, gastos, fotos,
│   │   │                        pasaporte, códigos de billete…)
│   │   ├── services/            Clientes de Supabase, Firebase y endpoints
│   │   └── styles/              Tema y estilos por componente
│   ├── android/ · ios/          Proyectos nativos de Capacitor
│   ├── public/                  Recursos estáticos
│   ├── tests/                   Pruebas de la lógica pura
│   ├── Dockerfile
│   └── docker-compose.yml
├── fremee-landings/             Página de presentación (landing.frimee.es)
└── README.md
```

---

# ESTADO Y LO QUE VIENE

Frimee está en producción, aunque es un proyecto en marcha y no un producto terminado. Las partes más trabajadas son los planes y el itinerario, los gastos, el álbum, el chat con su asistente, las llamadas, la Cartera y el pasaporte, y las que más se han movido en las últimas semanas son estas dos últimas, junto con la seguridad.

Lo siguiente que tengo pensado es completar los vuelos de amistades con los retrasos, las cancelaciones y los avisos en el móvil cuando un amigo despega o aterriza, ampliar el chat con las propuestas al grupo que se sellan en el plan cuando la mayoría las acepta, buscar sitios con Google Places desde el propio chat, dejar que cada actividad tenga sus propios participantes en lugar de dar por hecho que va todo el mundo, revisar los ajustes y publicar la aplicación de Android de forma estable.

---

# CONTRIBUIR

El código es propiedad de FrimeeApp y tiene todos los derechos reservados, como indica la [licencia](LICENSE), y está público para que se pueda leer y para enseñar cómo está hecho. Si encuentras un fallo o tienes una idea, lo mejor es abrir un [issue](https://github.com/FrimeeApp/Frimee/issues) contando qué pasa, en qué pantalla y con qué datos, y si se acaba convirtiendo en un cambio, saldrá de una rama aparte y entrará por una Pull Request hacia `main`.

---

<div align="center">

Hecho con mucho esfuerzo · [frimee.es](https://frimee.es) · [landing.frimee.es](https://landing.frimee.es)

</div>
