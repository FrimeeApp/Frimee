import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/**
 * Native side of calls on Android (board M19, CallNativePlugin.kt): the ongoing-call
 * notification that keeps the microphone alive with Frimee in the background, and its buttons.
 * Elsewhere every function does nothing.
 */
type OngoingOptions = { title: string; subtitle: string; video: boolean; muted: boolean };

type CallNativePlugin = {
  startOngoing(options: OngoingOptions): Promise<void>;
  updateOngoing(options: OngoingOptions): Promise<void>;
  stopOngoing(): Promise<void>;
  cancelIncoming(options: { llamadaId: string }): Promise<void>;
  takePendingCall(): Promise<{ url?: string | null }>;
  addListener(event: "callAction", listener: (e: { action: "mute" | "hangup" }) => void): Promise<PluginListenerHandle>;
};

const CallNative = registerPlugin<CallNativePlugin>("CallNative");
const isAndroid = () => Capacitor.getPlatform() === "android";

export async function startOngoingCall(options: OngoingOptions) {
  if (!isAndroid()) return;
  try { await CallNative.startOngoing(options); } catch (err) { console.warn("[call-native] start", err); }
}

export async function updateOngoingCall(options: OngoingOptions) {
  if (!isAndroid()) return;
  try { await CallNative.updateOngoing(options); } catch (err) { console.warn("[call-native] update", err); }
}

export async function stopOngoingCall() {
  if (!isAndroid()) return;
  try { await CallNative.stopOngoing(); } catch (err) { console.warn("[call-native] stop", err); }
}

export async function cancelIncomingCall(llamadaId: number) {
  if (!isAndroid()) return;
  try { await CallNative.cancelIncoming({ llamadaId: String(llamadaId) }); } catch { /* nothing to cancel */ }
}

/** The call link Frimee was opened with from a call notification (cold start), once. */
export async function takePendingCallLink(): Promise<string | null> {
  if (!isAndroid()) return null;
  try { return (await CallNative.takePendingCall()).url ?? null; } catch { return null; }
}

/** "Silenciar" / "Colgar" pressed in the ongoing-call notification. */
export function onCallNotificationAction(listener: (action: "mute" | "hangup") => void): () => void {
  if (!isAndroid()) return () => {};
  const handle = CallNative.addListener("callAction", (e) => listener(e.action));
  return () => { void handle.then((h) => h.remove()); };
}

/** fremee://call/<incoming|answer>?llamada=… (the call notification opened the app). */
export function parseCallUrl(url: string | undefined | null): { llamadaId: number; answer: boolean } | null {
  // Read by hand: WebViews differ in how new URL() splits custom schemes like fremee://.
  const match = url?.match(/^fremee:\/\/call\/(incoming|answer)\?(.*)$/);
  if (!match) return null;
  const llamadaId = Number(new URLSearchParams(match[2]).get("llamada"));
  if (!llamadaId) return null;
  return { llamadaId, answer: match[1] === "answer" };
}
