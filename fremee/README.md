# Frimee

Aplicación de organización de viajes y planes con amigos.

## 🚀 Despliegue con Docker Compose

### Requisitos previos
- [Docker](https://docs.docker.com/get-docker/) instalado
- [Docker Compose](https://docs.docker.com/compose/install/) instalado

### Pasos

1. Clona este repositorio:
   ```bash
   git clone https://github.com/FrimeeApp/Frimee.git
   cd Frimee/fremee
   ```

2. Crea el archivo de variables de entorno a partir del ejemplo:
   ```bash
   cp .env.example .env.local
   ```

3. Edita `.env.local` y rellena tus claves (Supabase, Firebase, Google Maps, LiveKit).

4. Arranca la aplicación:
   ```bash
   docker-compose up -d
   ```

5. Abre el navegador en:
   ```
   http://localhost:3000
   ```

### Parar la aplicación
```bash
docker-compose down
```

---

## 🐳 Imagen Docker Hub

La imagen está disponible en: [hub.docker.com/r/frimee/frimee](https://hub.docker.com/r/frimee/frimee)

```bash
docker pull frimee/frimee:latest
```

---

## 🛠️ Desarrollo local

```bash
npm install
npm run dev
```
