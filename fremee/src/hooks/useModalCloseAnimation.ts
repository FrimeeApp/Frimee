import { useCallback, useEffect, useRef, useState } from "react";

const MODAL_CLOSE_ANIMATION_MS = 140;

const activeScrollLocks = new Set<symbol>();
let lockedScrollY = 0;
let previousBodyOverflow = "";
let previousBodyPosition = "";
let previousBodyTop = "";
let previousBodyWidth = "";
let previousBodyPaddingRight = "";
let previousHtmlOverscroll = "";

function lockDocumentScroll(lockId: symbol) {
  if (typeof window === "undefined") return;
  if (activeScrollLocks.has(lockId)) return;
  const wasUnlocked = activeScrollLocks.size === 0;
  activeScrollLocks.add(lockId);
  if (!wasUnlocked) return;

  const { body, documentElement } = document;
  lockedScrollY = window.scrollY;
  previousBodyOverflow = body.style.overflow;
  previousBodyPosition = body.style.position;
  previousBodyTop = body.style.top;
  previousBodyWidth = body.style.width;
  previousBodyPaddingRight = body.style.paddingRight;
  previousHtmlOverscroll = documentElement.style.overscrollBehavior;

  const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${lockedScrollY}px`;
  body.style.width = "100%";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  documentElement.style.overscrollBehavior = "none";
  body.setAttribute("data-modal-open", "true");
}

function unlockDocumentScroll(lockId: symbol) {
  if (typeof window === "undefined") return;
  if (!activeScrollLocks.delete(lockId)) return;
  if (activeScrollLocks.size > 0) return;

  const { body, documentElement } = document;
  body.style.overflow = previousBodyOverflow;
  body.style.position = previousBodyPosition;
  body.style.top = previousBodyTop;
  body.style.width = previousBodyWidth;
  body.style.paddingRight = previousBodyPaddingRight;
  documentElement.style.overscrollBehavior = previousHtmlOverscroll;
  body.removeAttribute("data-modal-open");
  window.scrollTo(0, lockedScrollY);
}

export function useModalCloseAnimation(onClose: () => void, isOpen = true) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const scrollLockIdRef = useRef<symbol>(Symbol("modal-scroll-lock"));

  const requestClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      setIsClosing(false);
      onClose();
    }, MODAL_CLOSE_ANIMATION_MS);
  }, [isClosing, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const lockId = scrollLockIdRef.current;
    lockDocumentScroll(lockId);
    return () => unlockDocumentScroll(lockId);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return { isClosing: isOpen && isClosing, requestClose };
}
