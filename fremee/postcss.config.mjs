import path from "node:path";
import { fileURLToPath } from "node:url";

// Tailwind resuelve `@import "tailwindcss"` desde `base`, que por defecto es
// process.cwd(). Con Turbopack ese directorio a veces es la carpeta padre
// (frimee-main) y falla con «Can't resolve 'tailwindcss'». Lo fijamos aquí.
const base = path.dirname(fileURLToPath(import.meta.url));

const config = {
  plugins: {
    "@tailwindcss/postcss": { base },
  },
};

export default config;
