import { useEffect, useRef, type RefObject } from "react";

/** Gap between wheel events that starts a new gesture (trackpad inertia keeps them closer). */
const GESTURE_GAP_MS = 180;
/** Minimum time between two moves, while the smooth scroll settles. */
const MOVE_LOCK_MS = 650;
/** Finger travel that counts as a swipe. */
const SWIPE_PX = 30;
/** Hidden part of a step small enough to move straight on instead of scrolling to it. */
const SLIVER_PX = 64;

/**
 * Story paging: one gesture (wheel notch or trackpad flick, swipe, arrow/Page keys) moves to the
 * next or previous step, whatever its strength, and the trackpad's inertia does not add more.
 * A step taller than the visible area is read in chunks first, so nothing is skipped.
 *
 * `steps()` returns the step elements in order; `line()` is where a step's top sits once
 * reached (px from the top of the viewport, below sticky headers). While `busy()` (the page
 * is moving by itself) gestures are swallowed. Steps marked `data-step-pass` (legs, which play
 * on their own) are passed over going back up. Inside `root` only, and not inside elements
 * marked `data-paging-ignore` (overlays such as the photo viewer).
 */
export function useStepPaging(
  root: RefObject<HTMLElement | null>,
  steps: () => (HTMLElement | null)[],
  line: () => number,
  busy: () => boolean = () => false,
) {
  const stepsRef = useRef(steps);
  const lineRef = useRef(line);
  const busyRef = useRef(busy);
  useEffect(() => {
    stepsRef.current = steps;
    lineRef.current = line;
    busyRef.current = busy;
  }, [steps, line, busy]);

  useEffect(() => {
    let lockedUntil = 0;
    let lastWheel = 0;
    // A gesture has not moved yet: trackpads often start with a few sub-pixel events.
    let pending = false;
    let touchY: number | null = null;

    const handles = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null;
      return !!el && !!root.current?.contains(el) && !el.closest("[data-paging-ignore]");
    };

    const move = (dir: 1 | -1) => {
      const now = performance.now();
      if (now < lockedUntil || busyRef.current()) return;
      lockedUntil = now + MOVE_LOCK_MS;

      const at = lineRef.current();
      const view = Math.max(120, window.innerHeight - at);
      const els = stepsRef.current().filter((el): el is HTMLElement => !!el);
      let current = 0;
      els.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= at + 8) current = i;
      });
      const rect = els[current]?.getBoundingClientRect();
      if (!rect) return;

      let by = 0;
      if (dir > 0) {
        // Rest of this step below the fold: read it first; otherwise on to the next step. A sliver
        // (a line or two) is not worth a gesture of its own: it shows as the page moves on.
        if (rect.bottom > window.innerHeight + SLIVER_PX) by = Math.min(rect.bottom - window.innerHeight, view * 0.8);
        else if (els[current + 1]) by = els[current + 1].getBoundingClientRect().top - at;
      } else {
        // Scrolled into this step: back to its top in chunks; otherwise to the previous step.
        let previous = current - 1;
        if (els[previous]?.hasAttribute("data-step-pass") && els[previous - 1]) previous -= 1;
        if (rect.top < at - 4) by = -Math.min(at - rect.top, view * 0.8);
        else if (els[previous]) by = els[previous].getBoundingClientRect().top - at;
      }
      if (Math.abs(by) < 1) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollBy({ top: by, behavior: reduced ? "auto" : "smooth" });
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || !handles(e.target) || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheel > GESTURE_GAP_MS) pending = true;
      lastWheel = now;
      // One move per gesture, on its first event with real movement.
      if (pending && Math.abs(e.deltaY) >= 2) {
        pending = false;
        move(e.deltaY > 0 ? 1 : -1);
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = handles(e.target) && e.touches.length === 1 ? e.touches[0].clientY : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY !== null) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY === null) return;
      const dy = touchY - e.changedTouches[0].clientY;
      touchY = null;
      if (Math.abs(dy) >= SWIPE_PX) move(dy > 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.querySelector("[data-paging-ignore]")) return;
      const dir = e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey) ? 1
        : e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey) ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      move(dir);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [root]);
}
