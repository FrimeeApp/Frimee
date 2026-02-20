import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firestore";

export async function savePhotoDoc(params: {
  userId: string;
  downloadUrl: string;
  filePath: string;
}) {
  const ref = await addDoc(collection(db, "photos"), {
    userId: params.userId,
    downloadUrl: params.downloadUrl,
    filePath: params.filePath,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}