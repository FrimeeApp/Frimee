/**
 * Movement of the group, outside React. The scroll sets a target (route progress, see
 * routeProgress); a requestAnimationFrame loop eases the value towards it and calls the
 * subscribers every frame, so the map can move the vehicle imperatively instead of
 * re-rendering the page 60 times a second. A new `key` (another day) or reduced motion
 * jumps straight to the target.
 */
export type Motion = {
  setTarget: (value: number, key: string) => void;
  subscribe: (listener: (value: number) => void) => () => void;
  get: () => number;
};

export function createMotion(tauMs = 90): Motion {
  let value = 0;
  let target = 0;
  let key = "";
  let frame = 0;
  let last = 0;
  const listeners = new Set<(value: number) => void>();
  const emit = () => listeners.forEach((listener) => listener(value));
  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const tick = (now: number) => {
    const dt = Math.min(64, now - last);
    last = now;
    value += (target - value) * (1 - Math.exp(-dt / tauMs));
    if (Math.abs(target - value) < 0.0005) value = target;
    emit();
    frame = value === target ? 0 : requestAnimationFrame(tick);
  };

  return {
    setTarget(next, nextKey) {
      if (nextKey !== key || reduced()) {
        key = nextKey;
        target = next;
        value = next;
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        emit();
        return;
      }
      if (next === target) return;
      target = next;
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => value,
  };
}

/** Tiny store for the raw scroll position (active step and how far through it). */
export type ScrollStore = {
  set: (index: number, t: number) => void;
  subscribe: (listener: () => void) => () => void;
  get: () => { index: number; t: number };
};

export function createScrollStore(): ScrollStore {
  let state = { index: 0, t: 0 };
  const listeners = new Set<() => void>();
  return {
    set(index, t) {
      if (index === state.index && t === state.t) return;
      state = { index, t };
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => state,
  };
}
