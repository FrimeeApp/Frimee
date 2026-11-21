// Run with: npm run test:hora   (Node's own test runner, no extra dependencies)
process.env.TZ = "Europe/Madrid"; // EXIF without zone is read in the device's zone

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leerHoraDeBytes, resolverHora } from "../src/lib/foto-hora.ts";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const AHORA = Date.parse("2026-11-21T16:00:00Z");
const LM = Date.parse("2026-11-21T15:00:00Z"); // lastModified of the file (when received / copied)
const SIN: Parameters<typeof resolverHora>[0] = { nombre: "foto.jpg", lastModified: LM };

test("EXIF con zona: usa el desfase del propio archivo", async () => {
  const r = await leerHoraDeBytes(fixture("exif-con-zona.jpg"), "a.jpg", LM);
  assert.deepEqual(r, { at: "2026-11-08T16:42:10.000Z", fuente: "exif" });
});

test("EXIF sin zona: se lee en la zona del dispositivo", async () => {
  const r = await leerHoraDeBytes(fixture("exif-sin-zona.jpg"), "a.jpg", LM);
  assert.deepEqual(r, { at: "2026-11-08T16:42:10.000Z", fuente: "exif" });
});

test("solo GPS (cámara sin fecha EXIF): hora UTC exacta", async () => {
  const r = await leerHoraDeBytes(fixture("solo-gps.jpg"), "a.jpg", LM);
  assert.deepEqual(r, { at: "2026-10-14T16:31:22.000Z", fuente: "gps" });
});

test("solo XMP", async () => {
  const r = await leerHoraDeBytes(fixture("solo-xmp.jpg"), "a.jpg", LM);
  assert.deepEqual(r, { at: "2026-10-14T16:31:22.000Z", fuente: "xmp" });
});

test("sin metadatos: cae en la fecha del archivo", async () => {
  const r = await leerHoraDeBytes(fixture("sin-metadatos.jpg"), "a.jpg", LM);
  assert.deepEqual(r, { at: new Date(LM).toISOString(), fuente: "archivo" });
});

test("fecha EXIF imposible (0000:00:00): se salta y usa la siguiente fuente", async () => {
  const r = await leerHoraDeBytes(fixture("exif-cero.jpg"), "a.jpg", LM);
  assert.equal(r?.fuente, "archivo");
});

test("archivo que no es imagen: no falla", async () => {
  const r = await leerHoraDeBytes(new Uint8Array([1, 2, 3]), "a.bin", LM);
  assert.equal(r?.fuente, "archivo");
});

test("GPS (UTC) gana a un EXIF sin zona", () => {
  const r = resolverHora(
    { ...SIN, exif: { DateTimeOriginal: "2026:10:14 18:31:22", GPSDateStamp: "2026:10:14", GPSTimeStamp: [16, 31, 22] } },
    AHORA,
  );
  assert.deepEqual(r, { at: "2026-10-14T16:31:22.000Z", fuente: "gps" });
});

test("EXIF con zona gana al GPS", () => {
  const r = resolverHora(
    { ...SIN, exif: { DateTimeOriginal: "2026:10:14 18:31:22", OffsetTimeOriginal: "+02:00", GPSDateStamp: "2026:10:14", GPSTimeStamp: [1, 0, 0] } },
    AHORA,
  );
  assert.equal(r?.fuente, "exif");
  assert.equal(r?.at, "2026-10-14T16:31:22.000Z");
});

test("nombres de archivo", () => {
  const nombre = (n: string) => resolverHora({ nombre: n, lastModified: 0 }, AHORA);
  assert.deepEqual(nombre("IMG_20261014_183122.jpg"), { at: "2026-10-14T16:31:22.000Z", fuente: "nombre" });
  assert.deepEqual(nombre("Screenshot_20261014-183122.png"), { at: "2026-10-14T16:31:22.000Z", fuente: "nombre" });
  assert.deepEqual(nombre("20261014_183122.jpg"), { at: "2026-10-14T16:31:22.000Z", fuente: "nombre" });
  assert.deepEqual(nombre("PXL_20261014_163122123.jpg"), { at: "2026-10-14T16:31:22.000Z", fuente: "nombre" }); // Pixel: UTC
  assert.equal(nombre("IMG-20261014-WA0001.jpg"), null); // WhatsApp: solo el día de recepción
  assert.equal(nombre("IMG_20261340_183122.jpg"), null); // mes 13
  assert.equal(nombre("IMG_20261014_256122.jpg"), null); // hora imposible
});

test("valores imposibles se descartan: futuro, antes de 2000", () => {
  assert.equal(resolverHora({ nombre: "x.jpg", lastModified: AHORA + 3_600_000 }, AHORA), null);
  assert.equal(resolverHora({ nombre: "x.jpg", lastModified: Date.UTC(1970, 0, 1) }, AHORA), null);
  assert.equal(resolverHora({ nombre: "x.jpg", lastModified: 0 }, AHORA), null);
});

test("sin ninguna fuente: sin hora (nunca se inventa la de subida)", () => {
  assert.equal(resolverHora({ nombre: "x.jpg", lastModified: 0 }, AHORA), null);
});
