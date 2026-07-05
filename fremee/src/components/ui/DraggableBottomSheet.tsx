"use client";

import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type DraggableBottomSheetProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  isClosing?: boolean;
  disabled?: boolean;
  onDismiss: () => void;
  dragCloseThreshold?: number;
  dragVelocityThreshold?: number;
  handleLabel?: string;
  handleClassName?: string;
  onDragProgress?: (progress: number, isDragging: boolean) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void;
};

type DragState = {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  offset: number;
};

const DEFAULT_CLOSE_THRESHOLD = 220;
const DEFAULT_VELOCITY_THRESHOLD = 1.15;
const DRAG_ACTIVATION_DISTANCE = 3;
const MIN_VELOCITY_CLOSE_OFFSET = 90;
const DISTANCE_CLOSE_RATIO = 0.45;
const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[data-sheet-ignore-drag='true']",
].join(",");

function getClientY(event: ReactPointerEvent<HTMLElement>) {
  return event.clientY;
}

function shouldIgnoreDragStart(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-sheet-drag-handle='true']")) return false;

  return target.closest(INTERACTIVE_SELECTOR) !== null;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest(INTERACTIVE_SELECTOR) !== null;
}

export function DraggableBottomSheet({
  children,
  className = "",
  style,
  isClosing = false,
  disabled = false,
  onDismiss,
  dragCloseThreshold = DEFAULT_CLOSE_THRESHOLD,
  dragVelocityThreshold = DEFAULT_VELOCITY_THRESHOLD,
  handleLabel = "Arrastrar panel",
  handleClassName = "",
  onDragProgress,
  onPointerDown,
  onClick,
}: DraggableBottomSheetProps) {
  const dragRef = useRef<DragState | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const didDragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const setPanelDragMode = useCallback((active: boolean) => {
    const panel = panelRef.current;
    if (!panel) return;

    panel.style.animation = active ? "none" : "";
  }, []);

  const writeTransform = useCallback((offset: number, animated: boolean) => {
    offsetRef.current = offset;
    const panelHeight = panelRef.current?.clientHeight ?? window.innerHeight;
    onDragProgress?.(Math.min(offset / Math.max(panelHeight, 1), 1), !animated && offset > 0);

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || isClosing) return;

      panel.style.transition = animated
        ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)"
        : "none";
      panel.style.transform = `translate3d(0, ${offset}px, 0)`;
      animationFrameRef.current = null;
    });
  }, [isClosing, onDragProgress]);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;

    dragRef.current = null;
    setIsDragging(false);

    const panel = panelRef.current;
    const distanceThreshold = Math.max(
      dragCloseThreshold,
      (panel?.clientHeight ?? 0) * DISTANCE_CLOSE_RATIO,
    );
    const shouldDismiss =
      drag.offset >= distanceThreshold ||
      (drag.offset >= MIN_VELOCITY_CLOSE_OFFSET && drag.velocity >= dragVelocityThreshold);

    if (shouldDismiss) {
      setPanelDragMode(false);
      if (panel) {
        panel.style.setProperty("--app-sheet-close-start", `${drag.offset}px`);
        panel.style.transition = "";
        panel.style.transform = "";
      }
      onDragProgress?.(1, false);
      onDismiss();
      return;
    }

    writeTransform(0, true);
  }, [dragCloseThreshold, dragVelocityThreshold, onDismiss, onDragProgress, setPanelDragMode, writeTransform]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isClosing) return;

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const panel = panelRef.current;
    if (!panel) return;

    panel.style.animation = "";
    panel.style.transition = "";
    panel.style.transform = "";
  }, [isClosing]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event);
    if (event.defaultPrevented || shouldIgnoreDragStart(event.target)) {
      didDragRef.current = false;
      return;
    }
    if (disabled || isClosing || event.button !== 0) return;

    event.stopPropagation();

    const now = window.performance.now();
    didDragRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: getClientY(event),
      lastY: getClientY(event),
      lastTime: now,
      velocity: 0,
      offset: 0,
    };

    setIsDragging(true);
    setPanelDragMode(true);
    writeTransform(0, false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    const currentY = getClientY(event);
    const now = window.performance.now();
    const elapsed = Math.max(now - drag.lastTime, 1);
    const deltaFromStart = currentY - drag.startY;
    const deltaFromLast = currentY - drag.lastY;

    drag.velocity = deltaFromLast / elapsed;
    drag.offset = Math.max(0, deltaFromStart);
    didDragRef.current = didDragRef.current || drag.offset >= DRAG_ACTIVATION_DISTANCE;
    drag.lastY = currentY;
    drag.lastTime = now;

    writeTransform(drag.offset, false);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag();
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    dragRef.current = null;
    setIsDragging(false);
    onDragProgress?.(0, false);
    writeTransform(0, true);
  };

  return (
    <div
      ref={panelRef}
      data-closing={isClosing ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
      className={className}
      style={style}
      onPointerDownCapture={(event) => {
        if (!isInteractiveTarget(event.target)) return;

        didDragRef.current = false;
        dragRef.current = null;
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      onClick={onClick}
      onClickCapture={(event) => {
        if (isInteractiveTarget(event.target)) {
          didDragRef.current = false;
          return;
        }

        if (!didDragRef.current) return;

        didDragRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onTransitionEnd={() => {
        const panel = panelRef.current;
        if (!isDragging && offsetRef.current === 0 && panel) {
          panel.style.transition = "";
        }
      }}
    >
      <div className={`flex justify-center pt-[8px] ${handleClassName}`}>
        <button
          type="button"
          aria-label={handleLabel}
          data-sheet-drag-handle="true"
          className="group flex h-6 w-24 touch-none select-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]"
        >
          <span
            className={`h-[4px] w-10 rounded-full transition-colors duration-150 ${
              isDragging ? "bg-[var(--primary)]" : "bg-[var(--border)] group-hover:bg-[var(--border-strong)]"
            }`}
          />
        </button>
      </div>

      {children}
    </div>
  );
}
