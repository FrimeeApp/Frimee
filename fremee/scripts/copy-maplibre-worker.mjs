// MapLibre GL v6 loads its web worker from a separate file next to the library, which the
// Next.js bundler does not emit. Copy it into public/ so the album can point setWorkerUrl
// at it (same version as the installed package). Runs on postinstall and before dev.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const target = join(root, "public", "vendor", "maplibre-gl-worker.mjs");

if (!existsSync(source)) {
  console.warn("[maplibre] worker not found, skipping copy:", source);
} else {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log("[maplibre] worker copied to public/vendor/");
}
