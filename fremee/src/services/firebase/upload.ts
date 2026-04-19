import { ref, uploadBytes, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./storage";

// ── WebP conversion ───────────────────────────────────────────────────────────

async function toWebP(file: File, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
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
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
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
  const webpDataUrl = await dataUrlToWebP(params.dataUrl);
  const filePath = `photos/${params.userId}/${Date.now()}.webp`;
  const fileRef = ref(storage, filePath);
  await uploadString(fileRef, webpDataUrl, "data_url");
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadPlanCoverFile(params: { file: File; userId: string }) {
  const webp = await toWebP(params.file);
  const filePath = `plans/${params.userId}/${Date.now()}.webp`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, webp, { contentType: "image/webp" });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadDocumentFile(params: { file: File; userId: string }) {
  const filePath = `documentos/${params.userId}/${Date.now()}_${params.file.name}`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, params.file, { contentType: params.file.type || "application/octet-stream" });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadMediaFile(params: { file: File; userId: string }) {
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
  const ext = params.file.name.split(".").pop()?.toLowerCase() ?? "mp3";
  const filePath = `audio/${params.userId}/${Date.now()}.${ext}`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, params.file, { contentType: params.file.type || "audio/mpeg" });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadPlanAlbumFile(params: { file: File; planId: number }) {
  const webp = await toWebP(params.file);
  const filePath = `plan-albums/${params.planId}/${Date.now()}.webp`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, webp, { contentType: "image/webp" });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}

export async function uploadAudioBlob(params: { blob: Blob; userId: string }) {
  const ext = params.blob.type.includes("ogg") ? "ogg" : "webm";
  const filePath = `audio/${params.userId}/${Date.now()}.${ext}`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, params.blob, { contentType: params.blob.type });
  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}
