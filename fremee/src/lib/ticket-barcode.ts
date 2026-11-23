/**
 * Lectura del código (QR, Aztec o PDF417) de la imagen de un billete, en el propio dispositivo: la imagen
 * no sale a ningún servidor para esto. El módulo (WebAssembly) se carga solo la primera vez que hace falta.
 * El archivo public/zxing/zxing_reader.wasm debe ser el de la versión instalada de zxing-wasm: al actualizar
 * el paquete, copiar node_modules/zxing-wasm/dist/reader/zxing_reader.wasm a public/zxing/.
 */

export type TicketCodeFormat = "qr" | "aztec" | "pdf417";
export type TicketCode = { formato: TicketCodeFormat; contenido: string };

const WASM_URL = "/zxing/zxing_reader.wasm";

const FORMAT_OF: Record<string, TicketCodeFormat> = { QRCode: "qr", Aztec: "aztec", PDF417: "pdf417" };

let ready: Promise<typeof import("zxing-wasm/reader")> | null = null;
function loadReader() {
  ready ??= import("zxing-wasm/reader").then((m) => {
    m.setZXingModuleOverrides({ locateFile: (path, prefix) => (path.endsWith(".wasm") ? WASM_URL : prefix + path) });
    return m;
  });
  return ready;
}

/** Devuelve el primer código válido de la imagen, o null si no hay ninguno o no se puede leer. Nunca lanza. */
export async function readTicketBarcode(image: Blob): Promise<TicketCode | null> {
  try {
    const { readBarcodes } = await loadReader();
    const found = await readBarcodes(image, { formats: ["QRCode", "Aztec", "PDF417"], tryHarder: true, tryRotate: true, maxNumberOfSymbols: 1 });
    const hit = found.find((r) => r.isValid && r.text && FORMAT_OF[r.format]);
    return hit ? { formato: FORMAT_OF[hit.format], contenido: hit.text } : null;
  } catch (err) {
    ready = null; // si falló la carga, la próxima vez se vuelve a intentar
    console.error("[billetes] No se pudo leer el código de la imagen:", (err as { message?: string } | null)?.message ?? err);
    return null;
  }
}
