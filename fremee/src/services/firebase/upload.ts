import { ref, uploadString, getDownloadURL } from "firebase/storage";
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