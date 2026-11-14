/**
 * Ringback tone for the caller while the other side rings ("Llamando…").
 * Spanish standard: 425 Hz, 1.5 s on / 3 s off. Generated with the Web Audio API (no audio file),
 * so it works the same on the web and inside the app's WebView. It starts right after the call
 * button is pressed, which counts as the user gesture browsers ask for before playing sound.
 */

const FREQUENCY_HZ = 425;
const ON_S = 1.5;
const CYCLE_S = 4.5; // 1.5 s tone + 3 s silence
const VOLUME = 0.12;
const RAMP_S = 0.02; // short fades so the tone does not click

let context: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gain: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function scheduleBeep(at: number) {
  if (!gain) return;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(VOLUME, at + RAMP_S);
  gain.gain.setValueAtTime(VOLUME, at + ON_S - RAMP_S);
  gain.gain.linearRampToValueAtTime(0, at + ON_S);
}

export function startRingback() {
  if (oscillator || typeof window === "undefined") return;
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  try {
    context ??= new AudioCtor();
    void context.resume().catch(() => {});
    gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = FREQUENCY_HZ;
    oscillator.connect(gain);
    oscillator.start();

    // Schedule each beep slightly ahead on the audio clock, so timer jitter is not heard.
    let next = context.currentTime + 0.05;
    scheduleBeep(next);
    timer = setInterval(() => {
      if (!context) return;
      next += CYCLE_S;
      scheduleBeep(next);
    }, CYCLE_S * 1000);
  } catch (err) {
    console.warn("[ringback] start", err);
    stopRingback();
  }
}

export function stopRingback() {
  if (timer) clearInterval(timer);
  timer = null;
  try {
    oscillator?.stop();
  } catch { /* already stopped */ }
  oscillator?.disconnect();
  gain?.disconnect();
  oscillator = null;
  gain = null;
  // The context is kept (and suspended): creating one per call can hit the browser's limit.
  void context?.suspend().catch(() => {});
}
