import { useCallback, useEffect, useRef, useState } from "react";

const MODAL_CLOSE_ANIMATION_MS = 140;

export function useModalCloseAnimation(onClose: () => void, isOpen = true) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

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
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return { isClosing: isOpen && isClosing, requestClose };
}
