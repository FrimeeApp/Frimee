import { Capacitor } from "@capacitor/core";

/**
 * Sube el brillo de la pantalla al máximo mientras se enseña un código en la puerta, solo en la app nativa.
 * Devuelve la función que lo deja como estaba. En el navegador no hace nada. Nunca lanza.
 */
export async function raiseScreenBrightness(): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};
  try {
    const { ScreenBrightness } = await import("@capacitor-community/screen-brightness");
    const { brightness: before } = await ScreenBrightness.getBrightness();
    await ScreenBrightness.setBrightness({ brightness: 1 });
    // Android: -1 devuelve el brillo que el usuario tenía configurado.
    return () => { void ScreenBrightness.setBrightness({ brightness: before }).catch(() => undefined); };
  } catch (err) {
    console.error("[billetes] No se pudo subir el brillo:", (err as { message?: string } | null)?.message ?? err);
    return () => {};
  }
}
