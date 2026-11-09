import { Capacitor, registerPlugin } from "@capacitor/core";

const AppSettings = registerPlugin<{ open(): Promise<void> }>("AppSettings");

/** Android: open Frimee's page in the system settings (to allow the camera or the microphone). */
export async function openAppSettings(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return false;
  try {
    await AppSettings.open();
    return true;
  } catch (err) {
    console.error("[settings] open", err);
    return false;
  }
}
