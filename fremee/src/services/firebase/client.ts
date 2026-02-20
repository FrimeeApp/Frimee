import { initializeApp, getApps, getApp } from "firebase/app";
import { firebaseConfig } from "./config";

export function getFirebaseApp() {
  if (!getApps().length) return initializeApp(firebaseConfig);
  return getApp();
}