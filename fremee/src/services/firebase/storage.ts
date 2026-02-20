import { getStorage } from "firebase/storage";
import { getFirebaseApp } from "./client";

export const storage = getStorage(getFirebaseApp());