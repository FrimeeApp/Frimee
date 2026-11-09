import { Capacitor, registerPlugin } from "@capacitor/core";

const AppSettings = registerPlugin<{ open(): Promise<void>; setBackground(options: { color: string }): Promise<void> }>("AppSettings");

/** Android: the window colour behind the navigation bar (the app's background for the theme). */
export async function setWindowBackground(color: string): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await AppSettings.setBackground({ color });
  } catch (err) {
    console.warn("[native-ui] window background", err);
  }
}

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
