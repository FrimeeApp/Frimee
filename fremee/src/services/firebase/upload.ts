import { ref, uploadBytes, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./storage";
import { ensureFirebaseAuth } from "./auth";

// ── WebP conversion ───────────────────────────────────────────────────────────

const MAX_IMAGE_DIM = 1920;

function clampDimensions(w: number, h: number, max = MAX_IMAGE_DIM): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function viaBitmap(file: Blob): Promise<Decoded> {
  const bitmap = await createImageBitmap(file);
  return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
}

async function viaImgElement(file: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Opens any photo the phone can produce: the browser's own decoders first, then a built-in HEIC/HEIF
 * decoder (loaded only when needed) for the formats Chrome does not read (HEIC, 10-bit HDR).
 */
async function decodeImage(file: File): Promise<Decoded> {
  try {
    return await viaBitmap(file);
  } catch {}
  try {
    return await viaImgElement(file);
  } catch {}
  const { isHeic, heicTo } = await import("heic-to/next");
  if (await isHeic(file)) {
    const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
    try {
      return await viaBitmap(jpeg);
    } catch {
      return viaImgElement(jpeg);
    }
  }
  throw new Error(`No se ha podido abrir la imagen (${file.type || "tipo desconocido"}, ${Math.round(file.size / 1024)} KB).`);
}

async function toWebP(file: File, quality = 0.85): Promise<Blob> {
  const decoded = await decodeImage(file);
  const { width, height } = clampDimensions(decoded.width, decoded.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(decoded.source, 0, 0, width, height);
  decoded.release();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/webp",
      quality,
    );
  });
}

async function dataUrlToWebP(dataUrl: string, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = clampDimensions(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      const result = canvas.toDataURL("image/webp", quality);
      resolve(result);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ── Upload functions ──────────────────────────────────────────────────────────

export async function uploadPhotoDataUrl(params: {
  dataUrl: string;
  userId: string;
}) {
  await ensureFirebaseAuth();
  const webpDataUrl = await dataUrlToWebP(params.dataUrl);
  const filePath = `photos/${params.userId}/${Date.now()}.webp`;
  const fileRef = ref(storage, filePath);
  await uploadString(fileRef, webpDataUrl, "data_url");
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadPlanCoverFile(params: { file: File; userId: string }) {
  await ensureFirebaseAuth();
  const webp = await toWebP(params.file, 0.92);
  const filePath = `plans/${params.userId}/${Date.now()}.webp`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, webp, { contentType: "image/webp" });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadDocumentFile(params: { file: File; userId: string }) {
  await ensureFirebaseAuth();
  const filePath = `documentos/${params.userId}/${Date.now()}_${params.file.name}`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, params.file, { contentType: params.file.type || "application/octet-stream" });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadMediaFile(params: { file: File; userId: string }) {
  await ensureFirebaseAuth();
  const isImage = params.file.type.startsWith("image/");
  let blob: Blob = params.file;
  let ext = params.file.name.split(".").pop()?.toLowerCase() ?? "bin";
  if (isImage) {
    blob = await toWebP(params.file);
    ext = "webp";
  }
  const filePath = `media/${params.userId}/${Date.now()}.${ext}`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, blob, { contentType: isImage ? "image/webp" : params.file.type });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadAudioFile(params: { file: File; userId: string }) {
  await ensureFirebaseAuth();
  const ext = params.file.name.split(".").pop()?.toLowerCase() ?? "mp3";
  const filePath = `audio/${params.userId}/${Date.now()}.${ext}`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, params.file, { contentType: params.file.type || "audio/mpeg" });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadPlanAlbumFile(params: { file: File; planId: number }) {
  await ensureFirebaseAuth();
  // Any photo must be uploadable: if it cannot be converted, the original goes up untouched.
  let body: Blob = params.file;
  // Storage rules only accept image/*; some pickers hand over files with no type.
  let contentType = params.file.type.startsWith("image/") ? params.file.type : "image/jpeg";
  let ext = (params.file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  try {
    body = await toWebP(params.file, 0.92);
    contentType = "image/webp";
    ext = "webp";
  } catch (error) {
    console.warn("[uploadPlanAlbumFile] no se pudo convertir, se sube el original:", error);
  }
  // Several photos are uploaded at once: the time alone can repeat to the millisecond and one would overwrite the other.
  const filePath = `plan-albums/${params.planId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, body, { contentType });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadAudioBlob(params: { blob: Blob; userId: string }) {
  await ensureFirebaseAuth();
  const ext = params.blob.type.includes("ogg") ? "ogg" : "webm";
  const filePath = `audio/${params.userId}/${Date.now()}.${ext}`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, params.blob, { contentType: params.blob.type });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}
