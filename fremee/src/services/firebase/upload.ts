import { ref, uploadBytes, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./storage";

export async function uploadPhotoDataUrl(params: {
  dataUrl: string;
  userId: string;
}) {
  const { dataUrl, userId } = params;

  // Ej: photos/<userId>/1700000000000.jpg
  const filePath = `photos/${userId}/${Date.now()}.jpg`;
  const fileRef = ref(storage, filePath);

  // data_url = "data:image/jpeg;base64,...."
  await uploadString(fileRef, dataUrl, "data_url");

  const downloadUrl = await getDownloadURL(fileRef);

  return { filePath, downloadUrl };
}

export async function uploadPlanCoverFile(params: { file: File; userId: string }) {
  const ext = params.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filePath = `plans/${params.userId}/${Date.now()}.${ext}`;
  const fileRef = ref(storage, filePath);

  await uploadBytes(fileRef, params.file, { contentType: params.file.type || undefined });

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
  const ext = params.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filePath = `media/${params.userId}/${Date.now()}.${ext}`;
  const fileRef = ref(storage, filePath);

  await uploadBytes(fileRef, params.file, { contentType: params.file.type || "application/octet-stream" });

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

export async function uploadAudioBlob(params: { blob: Blob; userId: string }) {
  const ext = params.blob.type.includes("ogg") ? "ogg" : "webm";
  const filePath = `audio/${params.userId}/${Date.now()}.${ext}`;
  const fileRef = ref(storage, filePath);

  await uploadBytes(fileRef, params.blob, { contentType: params.blob.type });

  const downloadUrl = await getDownloadURL(fileRef);
  return { filePath, downloadUrl };
}
