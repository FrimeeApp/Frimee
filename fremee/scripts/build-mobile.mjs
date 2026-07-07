/**
 * Mobile build script for Capacitor (static export).
 *
 * Next.js `output: export` is incompatible with API routes that use
 * request.searchParams. This script temporarily stubs those routes before
 * building and restores them afterwards.
 *
 * It also flattens RSC payload files so Capacitor's HTTP server can find them.
 * Next.js generates:  out/PAGE/__next.!ROUTEGROUP/PAGENAME.txt
 * But fetches them at: /PAGE/__next.!ROUTEGROUP.PAGENAME.txt  (dots, not slashes)
 * Vercel rewrites these; Capacitor's file server doesn't — so we create copies.
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, rmSync, existsSync, readdirSync, cpSync, statSync, mkdirSync, renameSync } from "fs";
import { resolve, dirname, join } from "path";
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
const disabledRouteMoves = [
  {
    from: "src/app/(app)/@modal/(.)notifications",
    to: ".mobile-build-disabled/@modal/(.)notifications",
  },
  {
    from: "src/app/(app)/@modal/(.)plans",
    to: ".mobile-build-disabled/@modal/(.)plans",
  },
];
const movedRoutes = [];

function restore() {
  for (const [file, content] of Object.entries(originals)) {
    writeFileSync(resolve(root, file), content, "utf8");
  }
  for (const { from, to } of movedRoutes.toReversed()) {
    const fromAbs = resolve(root, from);
    const toAbs = resolve(root, to);
    if (!existsSync(fromAbs) && existsSync(toAbs)) {
      mkdirSync(dirname(fromAbs), { recursive: true });
      renameSync(toAbs, fromAbs);
    }
  }
  if (Object.keys(originals).length > 0) {
    console.log("✓ Restored patched files");
  }
  if (movedRoutes.length > 0) {
    console.log("✓ Restored disabled mobile routes");
  }
  for (const file of Object.keys(originals)) {
    delete originals[file];
  }
  movedRoutes.length = 0;
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

for (const route of disabledRouteMoves) {
  const fromAbs = resolve(root, route.from);
  const toAbs = resolve(root, route.to);
  if (!existsSync(fromAbs)) continue;
  if (existsSync(toAbs)) {
    throw new Error(`Cannot disable mobile route; temporary path already exists: ${route.to}`);
  }
  mkdirSync(dirname(toAbs), { recursive: true });
  renameSync(fromAbs, toAbs);
  movedRoutes.push(route);
  console.log(`→ Disabled static-export incompatible route ${route.from}`);
}

try {
  execSync("cross-env BUILD_TARGET=capacitor next build --webpack", { stdio: "inherit", cwd: root });
} finally {
  restore();
}

// ── Flatten RSC payload files ─────────────────────────────────────────────────
// Walk every directory in out/ and for each __next.!XXXX/ subdirectory,
// copy its files as __next.!XXXX.FILENAME next to the directory.
const outDir = resolve(root, "out");

// Android AssetManager cannot open files with "!" in their names.
// Next.js RSC filenames use "!" as prefix for route-group base64 hashes.
//
// Next.js generates:  out/PAGE/__next.!HASH/PAGENAME.txt   (directory)
//   and also:         out/PAGE/__next.!HASH.txt             (flat file)
// Next.js fetches:    /PAGE/__next.!HASH.PAGENAME.txt       (flat, with !)
//
// We need flat files with "-" instead of "!":
//   out/PAGE/__next.-HASH.PAGENAME.txt  ← from directory entries
//   out/PAGE/__next.-HASH.txt           ← from flat files
// Recursively flatten contents of an RSC "!" directory into dest as flat files.
// __next.!HASH/page.txt        → dest/__next.-HASH.page.txt
// __next.!HASH/page/__PAGE__.txt → dest/__next.-HASH.page.__PAGE__.txt
function flattenRscDir(rscDir, flatPrefix, destDir) {
  let count = 0;
  for (const entry of readdirSync(rscDir)) {
    const src = join(rscDir, entry);
    if (statSync(src).isDirectory()) {
      count += flattenRscDir(src, `${flatPrefix}.${entry}`, destDir);
    } else {
      const dest = join(destDir, `${flatPrefix}.${entry}`);
      if (!existsSync(dest)) { cpSync(src, dest); count++; }
    }
  }
  return count;
}

function fixRscBang(dir) {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const isDir = statSync(fullPath).isDirectory();

    if (isDir && entry.includes("!")) {
      // Flatten all contents (including nested subdirs) into sibling flat files
      count += flattenRscDir(fullPath, entry.replaceAll("!", "-"), dir);
      // Recurse for any nested "!" dirs inside
      count += fixRscBang(fullPath);
      continue;
    }

    if (isDir) {
      count += fixRscBang(fullPath);
      continue;
    }

    // Flat file with "!" → copy with "-"
    if (entry.includes("!")) {
      const dest = join(dir, entry.replaceAll("!", "-"));
      if (!existsSync(dest)) { cpSync(fullPath, dest); count++; }
    }
  }
  return count;
}

const fixed = fixRscBang(outDir);
console.log(`✓ Copied ${fixed} RSC file(s) with "!" → "-" for Capacitor`);

execSync("npx cap sync", { stdio: "inherit", cwd: root });
