import { Capacitor } from "@capacitor/core";

/**
 * Impide capturas y grabaciones de pantalla (en Android, FLAG_SECURE) y oculta el contenido en el selector de
 * apps recientes, mientras se enseña un código de billete. Solo en la app nativa; en el navegador no hace nada.
 * Devuelve la función que lo vuelve a permitir. Nunca lanza.
 */
export async function protectScreen(): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};
  try {
    const { PrivacyScreen } = await import("@capacitor/privacy-screen");
    await PrivacyScreen.enable();
    return () => { void PrivacyScreen.disable().catch(() => undefined); };
  } catch (err) {
    console.error("[billetes] No se pudo proteger la pantalla:", (err as { message?: string } | null)?.message ?? err);
    return () => {};
  }
}
