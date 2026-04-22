/**
 * Mobile build script for Capacitor (static export).
 *
 * Next.js `output: export` is incompatible with API routes that use
 * request.searchParams. This script temporarily stubs those routes before
 * building and restores them afterwards.
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const PATCHES = [
  {
    file: "src/app/api/flights/track/route.ts",
    content: `export const dynamic = "force-static";
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ error: "not available in mobile build" }, { status: 404 });
}
`,
  },
];

const originals = {};

function restore() {
  for (const [file, content] of Object.entries(originals)) {
    writeFileSync(resolve(root, file), content, "utf8");
  }
  if (Object.keys(originals).length > 0) {
    console.log("✓ Restored patched files");
  }
}

process.on("exit", restore);
process.on("SIGINT", () => { restore(); process.exit(1); });
process.on("uncaughtException", (e) => { restore(); console.error(e); process.exit(1); });

// Clear Turbopack cache to avoid stale results
const cacheDir = resolve(root, ".next/cache");
if (existsSync(cacheDir)) {
  try {
    rmSync(cacheDir, { recursive: true, force: true });
    console.log("→ Cleared .next/cache");
  } catch { /* non-fatal */ }
}

for (const { file, content } of PATCHES) {
  const abs = resolve(root, file);
  originals[file] = readFileSync(abs, "utf8");
  writeFileSync(abs, content, "utf8");
  console.log(`→ Patched ${file}`);
}

try {
  execSync("cross-env BUILD_TARGET=capacitor next build", { stdio: "inherit", cwd: root });
} finally {
  restore();
}
