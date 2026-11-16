import { Capacitor } from "@capacitor/core";

/**
 * ll-09: a call ringing while Frimee's tab is in the background (browser only; the Android app has
 * its own call notification). The page cannot show anything there, so: a system notification
 * (if allowed) and a blinking tab title. Both go away when the tab is seen or the call stops ringing.
 */

const canNotify = () =>
  typeof window !== "undefined" && "Notification" in window && !Capacitor.isNativePlatform();

/** Asked once, on a call the user makes or answers (browsers only ask after a gesture). */
export function askCallNotifications() {
  if (!canNotify() || Notification.permission !== "default") return;
  void Notification.requestPermission().catch(() => {});
}

/** Starts the alert if the tab is hidden now or becomes hidden; returns the cleanup. */
export function watchIncomingInBackground(texto: { titulo: string; quien: string; tag: string }) {
  if (typeof document === "undefined" || Capacitor.isNativePlatform()) return () => {};
  const originalTitle = document.title;
  let notification: Notification | null = null;
  let blink: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    notification?.close();
    notification = null;
    if (blink) clearInterval(blink);
    blink = null;
    document.title = originalTitle;
  };

  const start = () => {
    if (blink) return;
    let on = false;
    blink = setInterval(() => {
      on = !on;
      document.title = on ? `${texto.titulo} · ${texto.quien}` : originalTitle;
    }, 1000);
    if (canNotify() && Notification.permission === "granted") {
      try {
        notification = new Notification(texto.titulo, { body: texto.quien, tag: texto.tag, requireInteraction: true });
        notification.onclick = () => { window.focus(); stop(); };
      } catch { /* some browsers only allow notifications from a service worker */ }
    }
  };

  const sync = () => (document.visibilityState === "visible" ? stop() : start());
  sync();
  document.addEventListener("visibilitychange", sync);
  return () => {
    document.removeEventListener("visibilitychange", sync);
    stop();
  };
}
