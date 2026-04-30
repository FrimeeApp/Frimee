"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastType = "error" | "success" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

let _nextId = 0;

const COLORS: Record<ToastType, string> = {
  error:   "bg-[var(--error)] text-white",
  success: "bg-[var(--primary)] text-white",
  info:    "bg-[var(--surface-2)] text-app",
};

const DURATION: Record<ToastType, number> = {
  error:   5000,
  success: 2500,
  info:    3000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++_nextId;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    const timer = setTimeout(() => dismiss(id), DURATION[type]);
    timers.current.set(id, timer);
  }, [dismiss]);

  const toastError   = useCallback((msg: string) => toast(msg, "error"),   [toast]);
  const toastSuccess = useCallback((msg: string) => toast(msg, "success"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, toastError, toastSuccess }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] left-0 right-0 z-[200] flex flex-col items-center gap-[var(--space-2)] px-[var(--space-4)] md:bottom-[var(--space-6)] md:items-end md:pr-[var(--space-6)]"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto max-w-sm rounded-[14px] px-[var(--space-4)] py-[var(--space-3)] text-body-sm font-[var(--fw-medium)] shadow-elev-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${COLORS[t.type]}`}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
